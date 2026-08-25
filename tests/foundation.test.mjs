import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { buildSite } from "../scripts/lib/build.mjs";
import { evaluateGate } from "../scripts/lib/gate.mjs";
import { readJson, sha256File, writeJson } from "../scripts/lib/files.mjs";
import { runStaticChecks, runTechnicalQa } from "../scripts/lib/qa.mjs";
import { startStaticServer } from "../scripts/lib/server.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const validSource = path.join(repoRoot, "tests/fixtures/valid-source");
const issueId = "2026-08-20";
let workspace;
let distDir;
let evidenceDir;
let buildReport;
let technicalEvidence;
let approvedReview;
let previewDist;
let previewReport;

function reviewFor(report, overrides = {}) {
  const issue = report.issues.find((item) => item.issue_id === issueId);
  return {
    schema_version: 1,
    kind: "editorial_visual_review",
    scope: "local_non_production",
    reviewer: { type: "human", name: "Named Fixture Reviewer" },
    issue_id: issueId,
    candidate_digest: issue.candidate_digest,
    artifact_digest: report.artifact_digest,
    reviewed_at: "2026-08-20T09:30:00+08:00",
    decision: "APPROVE",
    checks: {
      editorial_truth_judgment: "APPROVE",
      harrytone: "APPROVE",
      cultural_appropriateness: "APPROVE",
      image_rights_disposition: "APPROVE",
      hierarchy: "APPROVE",
      reference_integrity: "APPROVE",
      visual_authorship: "APPROVE",
      desktop_mobile_translation: "APPROVE",
      historical_fidelity: "NOT_APPLICABLE",
    },
    comment: "Synthetic fixture review used only to test the local evidence interface.",
    ...overrides,
  };
}

async function clonedDist(name) {
  const target = path.join(workspace, name);
  await cp(distDir, target, { recursive: true });
  return target;
}

async function expectPrivateFixtureRejected(name, relativePath, contents = "fixture only\n") {
  const sourceCopy = path.join(workspace, `source-private-${name}`);
  const prohibitedPath = path.join(sourceCopy, issueId, relativePath);
  await cp(validSource, sourceCopy, { recursive: true });
  await mkdir(path.dirname(prohibitedPath), { recursive: true });
  await writeFile(prohibitedPath, contents, "utf8");
  await assert.rejects(
    buildSite({ repoRoot, sourceRoot: sourceCopy, outDir: path.join(workspace, `dist-private-${name}`), issueId }),
    /Private material check failed/,
  );
}

before(async () => {
  workspace = await mkdtemp(path.join(os.tmpdir(), "culture-taste-stage4-"));
  distDir = path.join(workspace, "dist-valid");
  evidenceDir = path.join(workspace, "evidence-valid");
  buildReport = await buildSite({ repoRoot, sourceRoot: validSource, outDir: distDir, issueId });
  technicalEvidence = await runTechnicalQa({
    repoRoot,
    distDir,
    issueId,
    evidenceDir,
    createdAt: "2026-08-20T09:15:00+08:00",
  });
  approvedReview = reviewFor(buildReport);
  previewDist = path.join(workspace, "dist-repository-preview");
  previewReport = await buildSite({ repoRoot, outDir: previewDist });
});

after(async () => {
  await rm(workspace, { recursive: true, force: true });
});

test("valid synthetic candidate succeeds technically", () => {
  assert.equal(technicalEvidence.status, "PASS");
  assert.equal(buildReport.issues[0].date_semantics.production_candidate_valid, true);
});

test("no-JavaScript reading and required render evidence pass", async () => {
  const checks = new Map(technicalEvidence.checks.map((check) => [check.id, check.status]));
  assert.equal(checks.get("no_js_reading"), "PASS");
  assert.equal(checks.get("desktop_render"), "PASS");
  assert.equal(checks.get("mobile_render"), "PASS");
  assert.equal(checks.get("reduced_motion_render"), "PASS");
  for (const name of ["desktop-1440x900", "mobile-390x844", "reduced-motion-1440x900"]) {
    assert.match(technicalEvidence.renders[name].sha256, /^[0-9a-f]{64}$/);
    await readFile(path.join(evidenceDir, technicalEvidence.renders[name].path));
  }
});

test("matching independent and named review evidence authorizes only the local simulation", async () => {
  const decision = await evaluateGate({ repoRoot, distDir, issueId, technicalEvidence, reviewEvidence: approvedReview, previousGoodRelease: "release-X" });
  assert.equal(decision.decision, "AUTHORIZED", decision.reasons.join("\n"));
  assert.equal(decision.production_authority, false);
  assert.equal(decision.selected_release, buildReport.issues[0].candidate_digest);
});

test("deterministic rebuild produces the same candidate and artifact digests", async () => {
  const secondOut = path.join(workspace, "dist-second");
  const second = await buildSite({ repoRoot, sourceRoot: validSource, outDir: secondOut, issueId });
  assert.equal(second.issues[0].candidate_digest, buildReport.issues[0].candidate_digest);
  assert.equal(second.artifact_digest, buildReport.artifact_digest);
});

test("shared core remains functional and leaves issue visual decisions to issue CSS", async () => {
  const baseCss = await readFile(path.join(repoRoot, "core/styles/base.css"), "utf8");
  const issueCss = await readFile(path.join(repoRoot, "src/issues/2026-08-25/issue.css"), "utf8");
  assert.match(baseCss, /\.skip-link/);
  assert.match(baseCss, /:focus-visible/);
  assert.match(baseCss, /prefers-reduced-motion/);
  assert.match(baseCss, /body\[data-shell="publication"\]/);
  assert.doesNotMatch(baseCss, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(baseCss, /(?:^|\n)\s*(?:article|h1|h2|h3)(?:\s|,|\{)/);
  assert.match(issueCss, /body\[data-issue="2026-08-25"\][\s\S]*background:/);
  assert.match(issueCss, /body\[data-issue="2026-08-25"\]\s+h1[\s\S]*font-size:/);
  assert.match(issueCss, /max-width:/);
});

test("repository Preview preserves all three historical originals as non-production issues", async () => {
  assert.deepEqual(previewReport.historical_issues.map((issue) => issue.issue_id), ["2026-08-20", "2026-08-21", "2026-08-22"]);
  assert.ok(previewReport.historical_issues.every((issue) => issue.production_eligible === false));
  assert.equal(
    await sha256File(path.join(previewDist, "issues/2026-08-20/original.html")),
    "b4b42d072a36f85a5490d9f1cbc0b0c4b4d148282fe379f4022dd08fb1074fd2",
  );
  assert.equal(
    await sha256File(path.join(previewDist, "issues/2026-08-21/original.html")),
    "f85bf5678c20363df68930488e61a02b610268b67e12ce7a7e2cdd2441994041",
  );
  assert.equal(
    await sha256File(path.join(previewDist, "issues/2026-08-22/original.pdf")),
    "2c3785f03eabfa45905c5240b6961b57b7d43fb36802b1e47ba30dbc3f7b7ffe",
  );
});

test("Preview homepage and archive expose the current 2026-08-23/24/25 fields plus historical issues", async () => {
  const home = await readFile(path.join(previewDist, "index.html"), "utf8");
  const archive = await readFile(path.join(previewDist, "archive/index.html"), "utf8");
  const current = await readFile(path.join(previewDist, "issues/2026-08-25/index.html"), "utf8");
  for (const date of ["2026-08-20", "2026-08-21", "2026-08-22", "2026-08-23", "2026-08-24", "2026-08-25"]) {
    assert.ok(home.includes(`issues/${date}/`));
    assert.ok(archive.includes(`issues/${date}/`));
  }
  assert.match(home, /NON-PRODUCTION PREVIEW/);
  assert.match(home, /meta name="robots" content="noindex,nofollow"/);
  assert.match(home, /rel="icon" type="image\/png" href="\.\/assets\/culture-taste-earth\.png"/);
  assert.match(archive, /rel="icon" type="image\/png" href="\.\.\/assets\/culture-taste-earth\.png"/);
  assert.match(current, /class="issue-brand"[\s\S]*culture-taste-earth\.png/);
  assert.match(home, /THE ROOM HAS A VOTE/);
  assert.match(home, /assets\/covers\/2026-08-23\.svg/);
  assert.match(archive, /assets\/covers\/2026-08-23\.svg/);
  assert.match(home, /assets\/covers\/2026-08-25\.svg/);
  assert.match(archive, /assets\/covers\/2026-08-25\.svg/);
  assert.doesNotMatch(home, /<div class="type-cover"[^>]*><span>THE DAY/);
  await readFile(path.join(previewDist, "assets/culture-taste-earth.png"));
  for (const cover of ["2026-08-20.png", "2026-08-21.png", "2026-08-22.jpg", "2026-08-23.svg", "2026-08-25.svg"]) {
    await readFile(path.join(previewDist, "assets/covers", cover));
  }
});

test("frontend integration reorganizes only the existing latest stories and keeps article reading intact", async () => {
  const home = await readFile(path.join(previewDist, "index.html"), "utf8");
  const current = await readFile(path.join(previewDist, "issues/2026-08-25/index.html"), "utf8");
  assert.equal((home.match(/<button type="button" data-theme-choice=/g) ?? []).length, 3);
  assert.equal((home.match(/<li data-story-card/g) ?? []).length, 8);
  assert.match(home, /id="daily-index-title"/);
  assert.match(home, /首次进入随机选择/);
  assert.match(current, /class="reading-progress"/);
  assert.match(current, /data-theme-status/);
  assert.match(current, /data-content-sha256="[0-9a-f]{64}"/);
  assert.equal((current.match(/class="issue-story"/g) ?? []).length, 9);
  assert.match(current, /data-story="exit"/);
  assert.match(current, /id="sources"/);
});

test("theme selection persists into stories while filtering and no-JavaScript reading still work", async () => {
  const server = await startStaticServer(previewDist);
  let browser;
  try {
    try {
      browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome" });
    } catch {
      browser = await chromium.launch({ headless: true });
    }

    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${server.origin}/`, { waitUntil: "domcontentloaded" });
    const firstTheme = await page.locator("html").getAttribute("data-visual-theme");
    assert.ok(["field", "coral", "analog"].includes(firstTheme));
    await page.reload();
    assert.equal(await page.locator("html").getAttribute("data-visual-theme"), firstTheme);

    await page.locator('[data-theme-choice="analog"]').click();
    assert.equal(await page.locator("html").getAttribute("data-visual-theme"), "analog");
    assert.equal(await page.locator("[data-theme-status]").count(), 0);
    await page.locator('[data-story-filter="objects"]').click();
    const visibleCategories = await page.locator("[data-story-card]").evaluateAll((cards) => cards.filter((card) => !card.hidden).map((card) => card.dataset.storyCategory));
    assert.ok(visibleCategories.length > 0);
    assert.ok(visibleCategories.every((category) => category === "objects"));

    const storyHref = await page.locator("[data-story-card] a").first().getAttribute("href");
    assert.match(storyHref, /theme=analog/);
    await page.goto(new URL(storyHref, `${server.origin}/`).href, { waitUntil: "domcontentloaded" });
    assert.equal(await page.locator("html").getAttribute("data-visual-theme"), "analog");
    assert.equal(await page.locator("[data-theme-status]").textContent(), "2000s TV");
    assert.equal(await page.locator(".issue-story").count(), 9);
    assert.equal(await page.locator('[data-story="exit"]').count(), 1);
    assert.match(await page.locator("main").innerText(), /Sources & Dates/);
    await context.close();

    const noJsContext = await browser.newContext({ javaScriptEnabled: false });
    const noJsPage = await noJsContext.newPage();
    await noJsPage.goto(`${server.origin}/`, { waitUntil: "domcontentloaded" });
    assert.equal(await noJsPage.locator("[data-story-card]").count(), 8);
    assert.equal(await noJsPage.locator(".theme-options").isVisible(), false);
    assert.equal(await noJsPage.locator(".radar-filters").isVisible(), false);
    await noJsPage.goto(`${server.origin}/issues/2026-08-25/`, { waitUntil: "domcontentloaded" });
    assert.equal(await noJsPage.locator(".issue-story").count(), 9);
    assert.match(await noJsPage.locator("main").innerText(), /Sources & Dates/);
    await noJsContext.close();
  } finally {
    await browser?.close();
    await server.close();
  }
});

test("2026-08-23 Preview has a dated visual and source chain for every story", async () => {
  const issue = await readFile(path.join(previewDist, "issues/2026-08-23/index.html"), "utf8");
  const manifest = await readJson(path.join(previewDist, "issues/2026-08-23/issue-manifest.public.json"));
  assert.equal((issue.match(/class="story-figure"/g) ?? []).length, 7);
  assert.equal(manifest.stories.length, 7);
  assert.equal(manifest.stories.filter((story) => story.media?.external_image_url).length, 5);
  assert.equal((issue.match(/data-external-preview="true"[\s\S]*?loading="lazy"/g) ?? []).length, 5);
  assert.ok(manifest.stories.every((story) => story.sources.length > 0 && story.media));
  assert.equal(manifest.status, "BLOCKED");
  assert.equal(manifest.rights_summary.status, "blocked");
});

test("independent static QA validates historical archive routes and assets", async () => {
  const qa = await runStaticChecks({ repoRoot, distDir: previewDist, issueId: "2026-08-25" });
  assert.equal(qa.checks.find((check) => check.id === "historical_archive").status, "PASS");
  assert.equal(qa.checks.find((check) => check.id === "assets").status, "PASS");
  assert.equal(qa.checks.find((check) => check.id === "internal_links").status, "PASS");
});

test("current 2026-08-25 Preview exposes one first-party official image per story and becomes the latest feed entry", async () => {
  const current = await readFile(path.join(previewDist, "issues/2026-08-25/index.html"), "utf8");
  const manifest = await readJson(path.join(previewDist, "issues/2026-08-25/issue-manifest.public.json"));
  assert.equal((current.match(/class="story-figure"/g) ?? []).length, 8);
  assert.equal(manifest.stories.length, 8);
  assert.equal(manifest.stories.filter((story) => story.media?.kind === "source_image").length, 8);
  assert.equal(manifest.stories.filter((story) => story.media?.origin_authority === "first_party_official").length, 8);
  assert.equal(manifest.stories.filter((story) => story.media?.rights_basis === "preview_user_authorized_external").length, 8);
  assert.equal((current.match(/data-media-kind="source_image"/g) ?? []).length, 8);
  assert.equal((current.match(/data-external-preview="true"/g) ?? []).length, 16);
  assert.equal(manifest.rights_summary.status, "blocked");
  assert.equal(manifest.rights_summary.unknown_required_assets, 8);
  assert.ok(manifest.stories.every((story) => story.sources.some((source) => source.relationship === "first_party_official" && source.url === story.media.origin_url)));
  assert.match(current, /musquiqui-life-of-navigation/);
  assert.match(current, /href="https:\/\/en\.jp\.bape\.com\/blogs\/news\/saintmxxxxxx-26fw"/);
  assert.match(current, /2026-08-25/);
  assert.match(await readFile(path.join(previewDist, "index.html"), "utf8"), /issues\/2026-08-25\//);
});

test("Preview source-image figures remain rights-blocked and click through to their publishers", async () => {
  const manifest = await readJson(path.join(previewDist, "issues/2026-08-24/issue-manifest.public.json"));
  assert.equal(manifest.rights_summary.status, "blocked");
  assert.equal(manifest.rights_summary.unknown_required_assets, 5);
  assert.equal(manifest.stories.filter((story) => story.media?.external_image_url).length, 5);
  assert.ok(manifest.stories.filter((story) => story.media?.external_image_url).every((story) => story.media.rights_basis === "preview_user_authorized_external"));
});

test("2026-08-22 historical web edition keeps all exact source pages addressable", async () => {
  const historical = await readFile(path.join(previewDist, "issues/2026-08-22/index.html"), "utf8");
  assert.match(historical, /HISTORICAL WEB EDITION/);
  assert.match(historical, /Download original PDF/);
  assert.equal((historical.match(/id="page-\d+"/g) ?? []).length, 16);
  assert.equal((historical.match(/loading="eager"/g) ?? []).length, 16);
});

test("Preview workflow verifies pull requests but deploys only on explicit manual dispatch", async () => {
  const workflow = await readFile(path.join(repoRoot, ".github/workflows/preview.yml"), "utf8");
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /branches: \[main, codex\/daily-automation-v1\]/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /if: github\.event_name == 'workflow_dispatch'/);
  assert.match(workflow, /NON-PRODUCTION|non-production/);
  assert.doesNotMatch(workflow, /schedule:/);
  assert.doesNotMatch(workflow, /^\s+push:/m);
});

test("malformed HTML fails independent static QA", async () => {
  const target = await clonedDist("dist-malformed");
  const htmlPath = path.join(target, "issues", issueId, "index.html");
  const html = await readFile(htmlPath, "utf8");
  await writeFile(htmlPath, html.replace("</main>", ""), "utf8");
  const qa = await runStaticChecks({ repoRoot, distDir: target, issueId });
  assert.equal(qa.checks.find((check) => check.id === "html_parse").status, "FAIL");
});

test("missing required asset fails independent static QA", async () => {
  const target = await clonedDist("dist-missing-asset");
  const htmlPath = path.join(target, "issues", issueId, "index.html");
  const html = await readFile(htmlPath, "utf8");
  await writeFile(htmlPath, html.replace("<article", '<img src="./missing.png" alt="Missing fixture"><article'), "utf8");
  const qa = await runStaticChecks({ repoRoot, distDir: target, issueId });
  assert.equal(qa.checks.find((check) => check.id === "assets").status, "FAIL");
});

test("JavaScript-only article fails the full-article/no-JS boundary", async () => {
  const target = await clonedDist("dist-js-only");
  const htmlPath = path.join(target, "issues", issueId, "index.html");
  const html = await readFile(htmlPath, "utf8");
  const jsOnly = html.replace(/<article[\s\S]*?<\/article>/, '<article aria-label="Article"><div id="app"></div><script>document.querySelector("#app").textContent="client only";</script></article>');
  await writeFile(htmlPath, jsOnly, "utf8");
  const qa = await runStaticChecks({ repoRoot, distDir: target, issueId });
  assert.equal(qa.checks.find((check) => check.id === "full_article_and_sources").status, "FAIL");
});

test("source image without a cleared provenance basis is rejected before build", async () => {
  const sourceCopy = path.join(workspace, "source-source-image-without-rights");
  await cp(validSource, sourceCopy, { recursive: true });
  const manifestPath = path.join(sourceCopy, issueId, "issue-manifest.public.json");
  const manifest = await readJson(manifestPath);
  manifest.media_required = true;
  manifest.stories[0].media = {
    asset: "assets/fixture.svg",
    alt: "Synthetic source image",
    caption: "Synthetic source image",
    credit: "Synthetic source",
    kind: "source_image",
  };
  await writeJson(manifestPath, manifest);
  await assert.rejects(
    buildSite({ repoRoot, sourceRoot: sourceCopy, outDir: path.join(workspace, "dist-source-image-without-rights"), issueId }),
    /failed schema validation/,
  );
});

test("source image marked found-online is rejected as an invalid rights basis", async () => {
  const sourceCopy = path.join(workspace, "source-source-image-found-online");
  await cp(validSource, sourceCopy, { recursive: true });
  const manifestPath = path.join(sourceCopy, issueId, "issue-manifest.public.json");
  const manifest = await readJson(manifestPath);
  manifest.media_required = true;
  manifest.stories[0].media = {
    asset: "assets/fixture.svg",
    alt: "Synthetic source image",
    caption: "Synthetic source image",
    credit: "Synthetic source",
    kind: "source_image",
    origin_url: "https://example.invalid/image.svg",
    rights_basis: "found_online",
  };
  await writeJson(manifestPath, manifest);
  await assert.rejects(
    buildSite({ repoRoot, sourceRoot: sourceCopy, outDir: path.join(workspace, "dist-source-image-found-online"), issueId }),
    /failed schema validation/,
  );
});

test("source-ledger.private.json fixture is rejected before build", async () => {
  await expectPrivateFixtureRejected("source-ledger", "source-ledger.private.json", "{}\n");
});

test(".env fixture is rejected before build", async () => {
  await expectPrivateFixtureRejected("env", ".env", "FIXTURE_TOKEN=not-a-real-secret\n");
});

test("credentials.json fixture is rejected before build", async () => {
  await expectPrivateFixtureRejected("credentials", "credentials.json", "{}\n");
});

test("private directory fixture is rejected before build", async () => {
  await expectPrivateFixtureRejected("private-directory", "private/notes.txt");
});

test("vendor/harry-tone fixture is rejected before build", async () => {
  await expectPrivateFixtureRejected("vendored-harrytone", "vendor/harry-tone/SKILL.md");
});

test("missing technical evidence is BLOCKED and preserves previous good", async () => {
  const decision = await evaluateGate({ repoRoot, distDir, issueId, technicalEvidence: null, reviewEvidence: approvedReview, previousGoodRelease: "release-X" });
  assert.equal(decision.decision, "BLOCKED");
  assert.equal(decision.selected_release, "release-X");
  assert.ok(decision.reasons.some((reason) => reason.includes("technical evidence is missing")));
});

test("missing editorial/visual review is BLOCKED", async () => {
  const decision = await evaluateGate({ repoRoot, distDir, issueId, technicalEvidence, reviewEvidence: null, previousGoodRelease: "release-X" });
  assert.equal(decision.decision, "BLOCKED");
  assert.equal(decision.selected_release, "release-X");
  assert.ok(decision.reasons.some((reason) => reason.includes("review is missing")));
});

test("stale review digest is BLOCKED", async () => {
  const staleReview = reviewFor(buildReport, { candidate_digest: "0".repeat(64) });
  const decision = await evaluateGate({ repoRoot, distDir, issueId, technicalEvidence, reviewEvidence: staleReview, previousGoodRelease: "release-X" });
  assert.equal(decision.decision, "BLOCKED");
  assert.equal(decision.selected_release, "release-X");
  assert.ok(decision.reasons.some((reason) => reason.includes("review candidate digest mismatch")));
});

test("artifact mutation after evidence capture is BLOCKED", async () => {
  const target = await clonedDist("dist-mutated-after-evidence");
  const htmlPath = path.join(target, "issues", issueId, "index.html");
  const html = await readFile(htmlPath, "utf8");
  await writeFile(htmlPath, html.replace("</body>", "<!-- post-evidence mutation -->\n</body>"), "utf8");
  const decision = await evaluateGate({ repoRoot, distDir: target, issueId, technicalEvidence, reviewEvidence: approvedReview, previousGoodRelease: "release-X" });
  assert.equal(decision.decision, "BLOCKED");
  assert.equal(decision.selected_release, "release-X");
  assert.ok(decision.reasons.some((reason) => reason.includes("current artifact digest mismatch")));
});

test("unknown required image rights are BLOCKED", async () => {
  const target = await clonedDist("dist-unknown-rights");
  const manifestPath = path.join(target, "issues", issueId, "issue-manifest.public.json");
  const manifest = await readJson(manifestPath);
  manifest.rights_summary = { required_assets: 1, unknown_required_assets: 1, status: "blocked" };
  await writeJson(manifestPath, manifest);
  const decision = await evaluateGate({ repoRoot, distDir: target, issueId, technicalEvidence, reviewEvidence: approvedReview, previousGoodRelease: "release-X" });
  assert.equal(decision.decision, "BLOCKED");
  assert.equal(decision.selected_release, "release-X");
  assert.ok(decision.reasons.some((reason) => reason.includes("rights")));
});

test("generator manifest PASS cannot bypass failing independent evidence", async () => {
  const failedTechnical = structuredClone(technicalEvidence);
  failedTechnical.status = "FAIL";
  failedTechnical.checks.find((check) => check.id === "html_parse").status = "FAIL";
  failedTechnical.checks.find((check) => check.id === "html_parse").detail = ["synthetic malformed HTML"];
  const manifest = await readJson(path.join(distDir, "issues", issueId, "issue-manifest.public.json"));
  assert.equal(manifest.status, "PASS");
  const decision = await evaluateGate({ repoRoot, distDir, issueId, technicalEvidence: failedTechnical, reviewEvidence: approvedReview, previousGoodRelease: "release-X" });
  assert.equal(decision.decision, "BLOCKED");
  assert.equal(decision.selected_release, "release-X");
  assert.ok(decision.reasons.some((reason) => reason.includes("technical evidence did not PASS")));
});
