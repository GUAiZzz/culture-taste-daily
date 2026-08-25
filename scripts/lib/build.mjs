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
import { renderArchive, renderHome, renderIssue, renderRss, renderSitemap } from "../../core/render.mjs";

const PUBLIC_MANIFEST = "issue-manifest.public.json";

function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label} mismatch: expected ${expected}, received ${actual}`);
}

async function discoverIssues(sourceRoot, requestedIssue) {
  const entries = await readdir(sourceRoot, { withFileTypes: true });
  const issueIds = entries
    .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name))
    .map((entry) => entry.name)
    .filter((issueId) => !requestedIssue || issueId === requestedIssue)
    .sort();
  if (!issueIds.length) throw new Error(`No issue source found${requestedIssue ? ` for ${requestedIssue}` : ""}`);
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

async function loadIssue({ repoRoot, sourceRoot, issueId, baseCss, enhancementJs }) {
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
    "core/enhance.js": sha256(enhancementJs),
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
  };
}

export async function buildSite({
  repoRoot,
  sourceRoot = path.join(repoRoot, "src/issues"),
  outDir = path.join(repoRoot, "dist"),
  issueId,
  baseUrl = "https://culture-taste-daily.invalid/",
} = {}) {
  await resetDirectory(outDir, path.dirname(outDir));
  const [baseCss, enhancementJs] = await Promise.all([
    readFile(path.join(repoRoot, "core/styles/base.css"), "utf8"),
    readFile(path.join(repoRoot, "core/enhance.js"), "utf8"),
  ]);
  const issues = [];

  for (const id of await discoverIssues(sourceRoot, issueId)) {
    const issue = await loadIssue({ repoRoot, sourceRoot, issueId: id, baseCss, enhancementJs });
    const issueOut = path.join(outDir, "issues", id);
    await mkdir(issueOut, { recursive: true });
    await writeFile(
      path.join(issueOut, "index.html"),
      renderIssue({ content: issue.content, manifest: issue.manifest, artDirection: issue.artDirection, baseCss, issueCss: issue.issueCss, enhancementJs }),
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

  issues.sort((a, b) => a.manifest.publication_date.localeCompare(b.manifest.publication_date));
  const archiveDir = path.join(outDir, "archive");
  await mkdir(archiveDir, { recursive: true });
  await writeFile(path.join(outDir, "index.html"), renderHome({ issues, baseCss, enhancementJs }), "utf8");
  await writeFile(path.join(archiveDir, "index.html"), renderArchive({ issues, baseCss, enhancementJs }), "utf8");
  await writeFile(path.join(outDir, "rss.xml"), renderRss({ issues, baseUrl }), "utf8");
  await writeFile(path.join(outDir, "sitemap.xml"), renderSitemap({ issues, baseUrl }), "utf8");

  await assertPublicTree(outDir);
  const artifactFiles = await fileDigestMap(outDir, { exclude: ["build-report.json"] });
  const artifactDigest = digestMap(artifactFiles);
  const contract = await readJson(path.join(repoRoot, "dependencies/contract.json"));
  const report = {
    schema_version: 1,
    kind: "generator_build_report",
    scope: "local_non_production",
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
    artifact_digest: artifactDigest,
    artifact_files: artifactFiles,
  };
  await writeJson(path.join(outDir, "build-report.json"), report);
  return report;
}
