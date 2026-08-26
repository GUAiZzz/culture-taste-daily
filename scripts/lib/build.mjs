import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  copyTree,
  digestMap,
  directoryDigest,
  exists,
  fileDigestMap,
  readJson,
  resetDirectory,
  sha256,
  sha256File,
  stableJson,
  writeJson,
} from "./files.mjs";
import { assertPublicTree } from "./privacy.mjs";
import { validateJsonFile } from "./schema.mjs";
import { evaluateDateSemantics } from "./dates.mjs";
import { assertOfficialStoryImages } from "./official-media.mjs";
import {
  renderArchive,
  renderFacsimile,
  renderHistoricalWrapper,
  renderHome,
  renderIssue,
  renderRss,
  renderSitemap,
  renderStoryPage,
} from "../../core/render.mjs";

const PUBLIC_MANIFEST = "issue-manifest.public.json";
const PUBLIC_DAILY_RADAR = "daily-radar.public.json";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const RADAR_CATEGORIES = ["fashion", "music", "objects", "city"];

function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label} mismatch: expected ${expected}, received ${actual}`);
}

async function discoverDateDirectories(root, requestedIssue, required = true) {
  if (!(await exists(root))) {
    if (required) throw new Error(`Source root does not exist: ${root}`);
    return [];
  }
  const entries = await readdir(root, { withFileTypes: true });
  const issueIds = entries
    .filter((entry) => entry.isDirectory() && DATE_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .filter((candidate) => !requestedIssue || candidate === requestedIssue)
    .sort();
  if (required && !issueIds.length) throw new Error(`No issue source found${requestedIssue ? ` for ${requestedIssue}` : ""}`);
  return issueIds;
}

async function verifyDependencies(repoRoot, manifest) {
  const contract = await readJson(path.join(repoRoot, "dependencies/contract.json"));
  const harrytone = await readJson(path.join(repoRoot, "dependencies/harrytone.json"));
  const core = await readJson(path.join(repoRoot, "core/version.json"));
  const contractHash = await sha256File(path.join(repoRoot, contract.path));

  assertEqual(contractHash, contract.sha256, "canonical contract hash");
  for (const amendment of contract.amendments ?? []) {
    assertEqual(await sha256File(path.join(repoRoot, amendment.path)), amendment.sha256, `contract amendment ${amendment.id} hash`);
  }
  assertEqual(manifest.contract.repository, contract.repository, "contract repository");
  assertEqual(manifest.contract.path, contract.path, "contract path");
  assertEqual(manifest.contract.commit, contract.canonical_main_commit, "contract commit");
  assertEqual(manifest.contract.activation_commit, contract.activation_commit, "contract activation commit");
  assertEqual(manifest.core_version, core.version, "core version");
  assertEqual(manifest.harrytone.repository, harrytone.repository, "HarryTone repository");
  assertEqual(manifest.harrytone.branch, harrytone.branch, "HarryTone branch");
  assertEqual(manifest.harrytone.commit, harrytone.commit, "HarryTone commit");

  return { contract, harrytone, core };
}

function englishTitle(content) {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.find((line, index) => index > 0 && /^[A-Z0-9$][A-Z0-9$ &/.,'’—-]+$/.test(line)) ?? "CULTURE & TASTE DAILY";
}

function normalizedUrl(value) {
  if (!value) return null;
  const url = new URL(value);
  url.hash = "";
  url.search = "";
  return url.href.replace(/\/$/, "");
}

function sorted(values) {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function focusCohortForDate(brandRadar, issueId) {
  const day = Math.floor(Date.parse(`${issueId}T00:00:00Z`) / 86_400_000);
  return brandRadar.cohorts[day % brandRadar.cohorts.length];
}

function standingBeatsForDate(policy, issueId) {
  const isThursday = new Date(`${issueId}T00:00:00Z`).getUTCDay() === 4;
  return policy.standing_beats
    .filter((beat) => beat.cadence === "daily" || (beat.cadence === "thursday" && isThursday))
    .map((beat) => beat.id);
}

function assertCoverageAttestation(radar, issueId, policy, brandRadar) {
  if (!policy.daily_radar.source_coverage_attestation_required) return;
  if (issueId < policy.daily_radar.source_coverage_attestation_effective_from) return;
  if (!radar.coverage) throw new Error(`${issueId} daily radar is missing the source coverage attestation`);
  const coverage = radar.coverage;
  const allSubjects = brandRadar.cohorts.flatMap((cohort) => cohort.subjects);
  const focus = focusCohortForDate(brandRadar, issueId);
  const expectedDigest = sha256(stableJson(allSubjects));
  const comparisons = [
    ["regional lanes", coverage.regional_lanes_checked, policy.required_source_lanes],
    ["focus subjects", coverage.focus_subjects_checked, focus.subjects],
    ["standing beats", coverage.standing_beats_checked, standingBeatsForDate(policy, issueId)],
  ];
  for (const [label, actual, expected] of comparisons) {
    if (stableJson(sorted(actual ?? [])) !== stableJson(sorted(expected))) {
      throw new Error(`${issueId} daily radar ${label} coverage is incomplete`);
    }
  }
  if (coverage.full_registry_daily_quick_scan !== true) throw new Error(`${issueId} daily radar did not attest the full registry quick scan`);
  if (coverage.registry_subject_count !== allSubjects.length || coverage.registry_digest !== expectedDigest) {
    throw new Error(`${issueId} daily radar registry coverage does not match automation/brand-radar.json`);
  }
  if (coverage.focus_cohort_id !== focus.id) throw new Error(`${issueId} daily radar focus cohort is incorrect`);
  if (coverage.deduplication_lookback_days !== policy.daily_radar.deduplication_lookback_days) {
    throw new Error(`${issueId} daily radar deduplication window is incorrect`);
  }
}

async function priorRadarIndex(sourceRoot, issueId, lookbackDays) {
  const dates = (await discoverDateDirectories(sourceRoot, null, false))
    .filter((date) => date < issueId)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, lookbackDays);
  const ids = new Map();
  const urls = new Map();
  for (const date of dates) {
    const radarPath = path.join(sourceRoot, date, PUBLIC_DAILY_RADAR);
    const manifestPath = path.join(sourceRoot, date, PUBLIC_MANIFEST);
    if (!(await exists(radarPath))) continue;
    const radar = await readJson(radarPath);
    const manifest = (await exists(manifestPath)) ? await readJson(manifestPath) : { stories: [] };
    const stories = new Map((manifest.stories ?? []).map((story) => [story.id, story]));
    for (const item of radar.items ?? []) {
      ids.set(item.id, date);
      if (item.included_story_id) ids.set(item.included_story_id, date);
      const story = stories.get(item.included_story_id);
      const officialUrl = item.official_url ?? story?.media?.origin_url ?? story?.sources?.find((source) => source.relationship === "first_party_official")?.url;
      const key = normalizedUrl(officialUrl);
      if (key) urls.set(key, date);
    }
  }
  return { ids, urls };
}

function hydrateDailyRadar(radar, manifest, issueId, priorIndex = null) {
  assertEqual(radar.date, issueId, "daily radar date");
  const storyById = new Map(manifest.stories.map((story) => [story.id, story]));
  const seen = new Set();
  const counts = Object.fromEntries(RADAR_CATEGORIES.map((category) => [category, 0]));
  const items = radar.items.map((item) => {
    if (seen.has(item.id)) throw new Error(`${issueId} daily radar repeats item ${item.id}`);
    seen.add(item.id);
    counts[item.category] += 1;

    if (!item.included_story_id) {
      for (const field of ["title", "deck", "publisher", "official_url", "media"]) {
        if (!item[field]) throw new Error(`${issueId} daily radar extra ${item.id} is missing ${field}`);
      }
      if (item.media.origin_authority !== "first_party_official") throw new Error(`${issueId} daily radar item ${item.id} lacks first-party official media`);
      if (item.media.kind === "video" && !item.media.poster_url) throw new Error(`${issueId} daily radar video ${item.id} is missing an official poster`);
      return { ...item, included_in_issue: false };
    }

    const story = storyById.get(item.included_story_id);
    if (!story) throw new Error(`${issueId} daily radar references unknown story ${item.included_story_id}`);
    const officialSource = story.sources.find((source) => source.relationship === "first_party_official") ?? story.sources.find((source) => source.url === story.media?.origin_url);
    if (!story.media?.external_image_url || story.media.origin_authority !== "first_party_official" || !officialSource) {
      throw new Error(`${issueId} daily radar story ${story.id} lacks first-party official media`);
    }
    return {
      id: item.id,
      category: item.category,
      included_story_id: story.id,
      included_in_issue: true,
      title: story.title,
      deck: story.english?.deck ?? story.english?.abstract ?? "Open the verified story and source chain.",
      publisher: officialSource.publisher,
      official_url: story.media.origin_url ?? officialSource.url,
      published_date: officialSource.published_date,
      event_date: officialSource.event_date,
      media: {
        kind: "image",
        url: story.media.external_image_url,
        alt: story.media.alt,
        credit: story.media.credit,
        origin_authority: story.media.origin_authority,
        rights_basis: story.media.rights_basis,
      },
    };
  });

  if (priorIndex) {
    for (const item of items) {
      const repeatedIdDate = priorIndex.ids.get(item.id) ?? priorIndex.ids.get(item.included_story_id);
      if (repeatedIdDate) throw new Error(`${issueId} daily radar reuses ${item.id} from ${repeatedIdDate}`);
      const repeatedUrlDate = priorIndex.urls.get(normalizedUrl(item.official_url));
      if (repeatedUrlDate) throw new Error(`${issueId} daily radar reuses the official event URL for ${item.id} from ${repeatedUrlDate}`);
    }
  }

  for (const category of RADAR_CATEGORIES) {
    if (counts[category] < 2) throw new Error(`${issueId} daily radar requires at least two ${category} items; received ${counts[category]}`);
  }
  return { ...radar, items, counts };
}

async function loadIssue({ repoRoot, sourceRoot, issueId, baseCss, dailyPolicy, brandRadar }) {
  const issueRoot = path.join(sourceRoot, issueId);
  await assertPublicTree(issueRoot);

  const contentPath = path.join(issueRoot, "content.md");
  const artPath = path.join(issueRoot, "art-direction.json");
  const stylePath = path.join(issueRoot, "issue.css");
  const manifestPath = path.join(issueRoot, PUBLIC_MANIFEST);
  const dailyRadarPath = path.join(issueRoot, PUBLIC_DAILY_RADAR);
  const [content, artDirection, manifest] = await Promise.all([
    readFile(contentPath, "utf8"),
    readJson(artPath),
    readJson(manifestPath),
  ]);
  const issueCss = (await exists(stylePath)) ? await readFile(stylePath, "utf8") : "";

  await validateJsonFile(manifest, path.join(repoRoot, "schemas/issue-manifest.public.schema.json"), `${issueId} public manifest`);
  assertEqual(issueId, manifest.issue_id, "issue directory/id");
  assertEqual(issueId, manifest.publication_date, "issue id/publication date");
  assertEqual(await sha256File(contentPath), manifest.content_lock.sha256, "content lock");
  assertEqual(await sha256File(contentPath), manifest.source_hashes.content_sha256, "content source hash");
  assertEqual(await sha256File(artPath), manifest.source_hashes.art_direction_sha256, "art direction source hash");
  const actualStyleHash = issueCss ? await sha256File(stylePath) : null;
  assertEqual(actualStyleHash, manifest.source_hashes.issue_style_sha256, "issue style source hash");
  await verifyDependencies(repoRoot, manifest);
  assertOfficialStoryImages(manifest, dailyPolicy.official_image_gate);
  let dailyRadar = null;
  let dailyRadarDigest = null;
  if (await exists(dailyRadarPath)) {
    const rawDailyRadar = await readJson(dailyRadarPath);
    await validateJsonFile(rawDailyRadar, path.join(repoRoot, "schemas/daily-radar.public.schema.json"), `${issueId} public daily radar`);
    const freshGateApplies = issueId >= dailyPolicy.daily_radar.fresh_event_gate_effective_from;
    assertCoverageAttestation(rawDailyRadar, issueId, dailyPolicy, brandRadar);
    const priorIndex = freshGateApplies
      ? await priorRadarIndex(sourceRoot, issueId, dailyPolicy.daily_radar.deduplication_lookback_days)
      : null;
    dailyRadar = hydrateDailyRadar(rawDailyRadar, manifest, issueId, priorIndex);
    dailyRadarDigest = await sha256File(dailyRadarPath);
  }

  if (manifest.media_required) {
    for (const story of manifest.stories) {
      if (!story.media) throw new Error(`${issueId} story ${story.id} is missing required media`);
      const mediaPath = path.join(issueRoot, story.media.asset.replace(/^assets\//, "assets/"));
      if (!(await exists(mediaPath))) throw new Error(`${issueId} story ${story.id} media asset is missing: ${story.media.asset}`);
      if (story.media.external_image_url) {
        if (manifest.visibility !== "published_preview" && manifest.visibility !== "future_draft") {
          throw new Error(`${issueId} story ${story.id} external source image is Preview-only`);
        }
        if (story.media.rights_basis !== "preview_user_authorized_external") {
          throw new Error(`${issueId} story ${story.id} external source image lacks the Preview-only rights label`);
        }
        if (manifest.rights_summary.status !== "blocked" || manifest.rights_summary.unknown_required_assets < 1) {
          throw new Error(`${issueId} external source image requires a blocked public rights summary`);
        }
      }
    }
  }

  const inputDigests = {
    "content.md": await sha256File(contentPath),
    "art-direction.json": await sha256File(artPath),
    [PUBLIC_MANIFEST]: await sha256File(manifestPath),
    "issue.css": actualStyleHash ?? sha256(""),
    "core/base.css": sha256(baseCss),
    "contract/identity": sha256(stableJson(manifest.contract)),
    "harrytone/identity": sha256(stableJson(manifest.harrytone)),
  };

  return {
    issueId,
    issueRoot,
    content,
    artDirection,
    manifest,
    dailyRadar,
    dailyRadarDigest,
    issueCss,
    inputDigests,
    candidateDigest: digestMap(inputDigests),
    dateSemantics: evaluateDateSemantics(manifest, dailyPolicy.schedule),
    title: content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? issueId,
    titleEn: englishTitle(content),
  };
}

function validateHistoricalMeta(meta, issueId) {
  assertEqual(meta.issue_id, issueId, "historical issue directory/id");
  assertEqual(meta.publication_date, issueId, "historical issue date");
  if (!meta.title || !meta.title_en || !meta.deck) throw new Error(`Historical issue ${issueId} is missing public display metadata`);
  if (!/^[0-9a-f]{64}$/.test(meta.source_sha256)) throw new Error(`Historical issue ${issueId} has an invalid source digest`);
  if (meta.production_eligible !== false) throw new Error(`Historical issue ${issueId} cannot be marked production eligible in Preview`);
  if (!Array.isArray(meta.limitations) || !meta.limitations.length) throw new Error(`Historical issue ${issueId} must disclose migration limitations`);
}

async function buildHistoricalIssues({ historicalRoot, outDir, baseCss, themesCss, siteCss, siteJs }) {
  const historical = [];
  for (const issueId of await discoverDateDirectories(historicalRoot, null, false)) {
    const issueRoot = path.join(historicalRoot, issueId);
    await assertPublicTree(issueRoot);
    const meta = await readJson(path.join(issueRoot, "meta.json"));
    validateHistoricalMeta(meta, issueId);
    const originalPath = path.join(issueRoot, meta.original_file);
    assertEqual(await sha256File(originalPath), meta.source_sha256, `${issueId} historical original hash`);

    const issueOut = path.join(outDir, "issues", issueId);
    await mkdir(issueOut, { recursive: true });
    if (meta.migration_mode === "preserved_self_contained_html") {
      await writeFile(path.join(issueOut, "index.html"), renderHistoricalWrapper({ meta, baseCss, themesCss, siteCss, siteJs }), "utf8");
      await writeFile(path.join(issueOut, "original.html"), await readFile(originalPath));
    } else if (meta.migration_mode === "pdf_facsimile" || meta.migration_mode === "historical_web_edition") {
      const sourcePages = path.join(issueRoot, "pages");
      const pageFiles = (await readdir(sourcePages)).filter((file) => /^page-\d{3}\.jpg$/.test(file)).sort();
      assertEqual(pageFiles.length, meta.page_count, `${issueId} facsimile page count`);
      await copyTree(sourcePages, path.join(issueOut, "pages"));
      await writeFile(path.join(issueOut, "original.pdf"), await readFile(originalPath));
      await writeFile(path.join(issueOut, "index.html"), renderFacsimile({ meta, pageFiles, baseCss, themesCss, siteCss, siteJs }), "utf8");
    } else {
      throw new Error(`Unsupported historical migration mode for ${issueId}: ${meta.migration_mode}`);
    }

    const digest = await directoryDigest(issueRoot);
    historical.push({
      issue_id: issueId,
      publication_date: meta.publication_date,
      title: meta.title,
      title_en: meta.title_en,
      deck: meta.deck,
      kind: "historical",
      coverAsset: meta.cover_asset,
      digest,
      migration_mode: meta.migration_mode,
      source_sha256: meta.source_sha256,
      production_eligible: false,
      limitations: meta.limitations,
    });
  }
  return historical;
}

export async function buildSite({
  repoRoot,
  sourceRoot = path.join(repoRoot, "src/issues"),
  historicalRoot,
  outDir = path.join(repoRoot, "dist"),
  issueId,
  baseUrl = "https://culture-taste-daily.invalid/",
} = {}) {
  await resetDirectory(outDir, path.dirname(outDir));
  const defaultSourceRoot = path.join(repoRoot, "src/issues");
  const includeHistorical = historicalRoot !== null && !issueId && path.resolve(sourceRoot) === path.resolve(defaultSourceRoot);
  const resolvedHistoricalRoot = historicalRoot ?? path.join(repoRoot, "src/historical");
  const [baseCss, themesCss, storyCss, siteCss, siteJs, dailyPolicy, brandRadar] = await Promise.all([
    readFile(path.join(repoRoot, "core/styles/base.css"), "utf8"),
    readFile(path.join(repoRoot, "core/styles/themes.css"), "utf8"),
    readFile(path.join(repoRoot, "core/styles/story.css"), "utf8"),
    readFile(path.join(repoRoot, "core/styles/site.css"), "utf8"),
    readFile(path.join(repoRoot, "core/site.js"), "utf8"),
    readJson(path.join(repoRoot, "automation/daily-policy.json")),
    readJson(path.join(repoRoot, "automation/brand-radar.json")),
  ]);
  const issues = [];

  for (const id of await discoverDateDirectories(sourceRoot, issueId)) {
    const issue = await loadIssue({
      repoRoot,
      sourceRoot,
      issueId: id,
      baseCss,
      dailyPolicy,
      brandRadar,
    });
    const issueOut = path.join(outDir, "issues", id);
    await mkdir(issueOut, { recursive: true });
    await writeFile(
      path.join(issueOut, "index.html"),
      renderIssue({ content: issue.content, manifest: issue.manifest, baseCss, themesCss, issueCss: issue.issueCss, siteJs }),
      "utf8",
    );

    for (const [storyIndex, story] of issue.manifest.stories.entries()) {
      const storyOut = path.join(issueOut, "stories", story.id);
      await mkdir(storyOut, { recursive: true });
      await writeFile(
        path.join(storyOut, "index.html"),
        renderStoryPage({ content: issue.content, manifest: issue.manifest, story, storyIndex, baseCss, themesCss, storyCss, siteJs }),
        "utf8",
      );
    }

    const assetsRoot = path.join(issue.issueRoot, "assets");
    if (await exists(assetsRoot)) await copyTree(assetsRoot, path.join(issueOut, "assets"));

    const issuePayloadDigest = await directoryDigest(issueOut);
    const builtManifest = structuredClone(issue.manifest);
    builtManifest.artifact_digests.issue_payload_sha256 = issuePayloadDigest;
    await writeJson(path.join(issueOut, PUBLIC_MANIFEST), builtManifest);
    issue.builtManifest = builtManifest;
    issue.issuePayloadDigest = issuePayloadDigest;
    issues.push(issue);
  }

  const siteAssets = path.join(repoRoot, "src/site/assets");
  if (await exists(siteAssets)) {
    await assertPublicTree(siteAssets);
    await copyTree(siteAssets, path.join(outDir, "assets"));
  }

  const historical = includeHistorical
    ? await buildHistoricalIssues({ historicalRoot: resolvedHistoricalRoot, outDir, baseCss, themesCss, siteCss, siteJs })
    : [];
  const currentIssues = await Promise.all(issues.map(async (issue) => {
    const shellCover = `covers/${issue.issueId}.svg`;
    const coverAsset = (await exists(path.join(siteAssets, shellCover))) ? shellCover : null;
    if (issue.issueId >= dailyPolicy.cover_variation_gate.effective_from
      && dailyPolicy.cover_variation_gate.local_cover_required
      && !coverAsset) {
      throw new Error(`${issue.issueId} requires an issue-specific local archive cover`);
    }
    return {
      issue_id: issue.issueId,
      publication_date: issue.manifest.publication_date,
      title: issue.title,
      title_en: issue.titleEn,
      deck: issue.manifest.editorial_position,
      kind: "current",
      coverAsset,
      digest: issue.candidateDigest,
      production_eligible: issue.dateSemantics.production_candidate_valid,
      visibility: issue.manifest.visibility,
      stories: issue.manifest.stories,
      dailyRadar: issue.dailyRadar,
    };
  }));
  const coveredIssues = currentIssues.filter((issue) => issue.coverAsset).sort((a, b) => a.publication_date.localeCompare(b.publication_date));
  for (const [index, issue] of coveredIssues.entries()) {
    if (issue.issue_id < dailyPolicy.cover_variation_gate.effective_from || !dailyPolicy.cover_variation_gate.exact_asset_reuse_forbidden) continue;
    const currentHash = await sha256File(path.join(siteAssets, issue.coverAsset));
    const previous = coveredIssues.slice(Math.max(0, index - dailyPolicy.cover_variation_gate.comparison_window_issues), index);
    for (const candidate of previous) {
      if (currentHash === await sha256File(path.join(siteAssets, candidate.coverAsset))) {
        throw new Error(`${issue.issue_id} archive cover exactly reuses ${candidate.issue_id}`);
      }
    }
  }
  const publicationIssues = [
    ...historical,
    ...currentIssues.filter((issue) => issue.visibility !== "future_draft"),
  ].sort((a, b) => a.publication_date.localeCompare(b.publication_date));

  const archiveDir = path.join(outDir, "archive");
  await mkdir(archiveDir, { recursive: true });
  await writeFile(path.join(outDir, "index.html"), renderHome({ issues: publicationIssues, baseCss, themesCss, siteCss, siteJs }), "utf8");
  await writeFile(path.join(archiveDir, "index.html"), renderArchive({ issues: publicationIssues, baseCss, themesCss, siteCss, siteJs }), "utf8");
  await writeFile(path.join(outDir, "rss.xml"), renderRss({ issues: publicationIssues, baseUrl }), "utf8");
  await writeFile(path.join(outDir, "sitemap.xml"), renderSitemap({ issues: publicationIssues, baseUrl }), "utf8");
  const robotsBase = new URL(baseUrl).pathname.replace(/\/$/, "");
  await writeFile(path.join(outDir, "robots.txt"), `User-agent: *\nDisallow: ${robotsBase}/issues/*/original.html\nDisallow: ${robotsBase}/issues/*/original.pdf\nDisallow: ${robotsBase}/issues/*/pages/\n`, "utf8");

  await assertPublicTree(outDir);
  const artifactFiles = await fileDigestMap(outDir, { exclude: ["build-report.json"] });
  const artifactDigest = digestMap(artifactFiles);
  const contract = await readJson(path.join(repoRoot, "dependencies/contract.json"));
  const report = {
    schema_version: 1,
    kind: "generator_build_report",
    scope: "local_non_production_preview",
    production_authority: false,
    base_url: baseUrl,
    contract: {
      repository: contract.repository,
      path: contract.path,
      commit: contract.canonical_main_commit,
      activation_commit: contract.activation_commit,
      sha256: contract.sha256,
      amendments: contract.amendments ?? [],
    },
    issues: issues.map((issue) => ({
      issue_id: issue.issueId,
      candidate_digest: issue.candidateDigest,
      issue_payload_digest: issue.issuePayloadDigest,
      source_hashes: issue.manifest.source_hashes,
      daily_radar_sha256: issue.dailyRadarDigest,
      date_semantics: issue.dateSemantics,
    })),
    historical_issues: historical,
    artifact_digest: artifactDigest,
    artifact_files: artifactFiles,
  };
  await writeJson(path.join(outDir, "build-report.json"), report);
  return report;
}
