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
import {
  renderArchive,
  renderFacsimile,
  renderHistoricalWrapper,
  renderHome,
  renderIssue,
  renderRss,
  renderSitemap,
} from "../../core/render.mjs";

const PUBLIC_MANIFEST = "issue-manifest.public.json";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

async function loadIssue({ repoRoot, sourceRoot, issueId, baseCss }) {
  const issueRoot = path.join(sourceRoot, issueId);
  await assertPublicTree(issueRoot);

  const contentPath = path.join(issueRoot, "content.md");
  const artPath = path.join(issueRoot, "art-direction.json");
  const stylePath = path.join(issueRoot, "issue.css");
  const manifestPath = path.join(issueRoot, PUBLIC_MANIFEST);
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
    issueCss,
    inputDigests,
    candidateDigest: digestMap(inputDigests),
    dateSemantics: evaluateDateSemantics(manifest),
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

async function buildHistoricalIssues({ historicalRoot, outDir, baseCss, siteCss, siteJs }) {
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
      await writeFile(path.join(issueOut, "index.html"), renderHistoricalWrapper({ meta, baseCss, siteCss, siteJs }), "utf8");
      await writeFile(path.join(issueOut, "original.html"), await readFile(originalPath));
    } else if (meta.migration_mode === "pdf_facsimile") {
      const sourcePages = path.join(issueRoot, "pages");
      const pageFiles = (await readdir(sourcePages)).filter((file) => /^page-\d{3}\.jpg$/.test(file)).sort();
      assertEqual(pageFiles.length, meta.page_count, `${issueId} facsimile page count`);
      await copyTree(sourcePages, path.join(issueOut, "pages"));
      await writeFile(path.join(issueOut, "original.pdf"), await readFile(originalPath));
      await writeFile(path.join(issueOut, "index.html"), renderFacsimile({ meta, pageFiles, baseCss, siteCss, siteJs }), "utf8");
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
  const [baseCss, siteCss, siteJs] = await Promise.all([
    readFile(path.join(repoRoot, "core/styles/base.css"), "utf8"),
    readFile(path.join(repoRoot, "core/styles/site.css"), "utf8"),
    readFile(path.join(repoRoot, "core/site.js"), "utf8"),
  ]);
  const issues = [];

  for (const id of await discoverDateDirectories(sourceRoot, issueId)) {
    const issue = await loadIssue({ repoRoot, sourceRoot, issueId: id, baseCss });
    const issueOut = path.join(outDir, "issues", id);
    await mkdir(issueOut, { recursive: true });
    await writeFile(
      path.join(issueOut, "index.html"),
      renderIssue({ content: issue.content, manifest: issue.manifest, baseCss, issueCss: issue.issueCss }),
      "utf8",
    );

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
    ? await buildHistoricalIssues({ historicalRoot: resolvedHistoricalRoot, outDir, baseCss, siteCss, siteJs })
    : [];
  const publicationIssues = [
    ...historical,
    ...issues.map((issue) => ({
      issue_id: issue.issueId,
      publication_date: issue.manifest.publication_date,
      title: issue.title,
      title_en: issue.titleEn,
      deck: issue.manifest.editorial_position,
      kind: "current",
      coverAsset: null,
      digest: issue.candidateDigest,
      production_eligible: issue.dateSemantics.production_candidate_valid,
    })),
  ].sort((a, b) => a.publication_date.localeCompare(b.publication_date));

  const archiveDir = path.join(outDir, "archive");
  await mkdir(archiveDir, { recursive: true });
  await writeFile(path.join(outDir, "index.html"), renderHome({ issues: publicationIssues, baseCss, siteCss, siteJs }), "utf8");
  await writeFile(path.join(archiveDir, "index.html"), renderArchive({ issues: publicationIssues, baseCss, siteCss, siteJs }), "utf8");
  await writeFile(path.join(outDir, "rss.xml"), renderRss({ issues: publicationIssues, baseUrl }), "utf8");
  await writeFile(path.join(outDir, "sitemap.xml"), renderSitemap({ issues: publicationIssues, baseUrl }), "utf8");

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
    },
    issues: issues.map((issue) => ({
      issue_id: issue.issueId,
      candidate_digest: issue.candidateDigest,
      issue_payload_digest: issue.issuePayloadDigest,
      source_hashes: issue.manifest.source_hashes,
      date_semantics: issue.dateSemantics,
    })),
    historical_issues: historical,
    artifact_digest: artifactDigest,
    artifact_files: artifactFiles,
  };
  await writeJson(path.join(outDir, "build-report.json"), report);
  return report;
}
