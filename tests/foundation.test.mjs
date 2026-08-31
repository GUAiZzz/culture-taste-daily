import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { buildSite } from "../scripts/lib/build.mjs";
import { evaluateGate } from "../scripts/lib/gate.mjs";
import { readJson, writeJson } from "../scripts/lib/files.mjs";
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
  for (const name of [
    "desktop-1440x900",
    "compact-320x568",
    "mobile-390x844",
    "mobile-430x932",
    "tablet-768x1024",
    "landscape-844x390",
    "reduced-motion-1440x900",
    "reduced-motion-390x844",
  ]) {
    assert.match(technicalEvidence.renders[name].sha256, /^[0-9a-f]{64}$/);
    await readFile(path.join(evidenceDir, technicalEvidence.renders[name].path));
  }
});

test("matching independent and named review evidence authorizes only the local simulation", async () => {
  const decision = await evaluateGate({ repoRoot, distDir, issueId, technicalEvidence, reviewEvidence: approvedReview, previousGoodRelease: "release-X" });
  assert.equal(decision.decision, "AUTHORIZED");
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
  assert.match(baseCss, /@media \(max-width: 50rem\)/);
  assert.match(baseCss, /@media \(max-width: 29\.9375rem\)/);
  assert.match(baseCss, /safe-area-inset-left/);
  assert.doesNotMatch(baseCss, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(baseCss, /(?:^|\n)\s*(?:article|h1|h2|h3)(?:\s|,|\{)/);
  assert.match(issueCss, /body\[data-issue="2026-08-25"\][\s\S]*background:/);
  assert.match(issueCss, /body\[data-issue="2026-08-25"\]\s+h1[\s\S]*font-size:/);
  assert.match(issueCss, /max-width:/);
});

test("mobile protocol and repository skill are present", async () => {
  const protocol = await readFile(path.join(repoRoot, "docs/MOBILE_EDITORIAL_PROTOCOL.md"), "utf8");
  const skill = await readFile(path.join(repoRoot, ".agents/skills/culture-taste-mobile/SKILL.md"), "utf8");
  assert.match(protocol, /320×568/);
  assert.match(protocol, /viewport-fit/);
  assert.match(protocol, /field.*coral.*analog/s);
  assert.match(skill, /MOBILE_EDITORIAL_PROTOCOL\.md/);
});

test("reader theme is selected once per session and follows issue navigation", async () => {
  const server = await startStaticServer(distDir);
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome" });
  try {
    const context = await browser.newContext({ viewport: { width: 900, height: 700 } });
    const page = await context.newPage();
    await page.goto(`${server.origin}/`, { waitUntil: "networkidle" });
    const firstTheme = await page.evaluate(() => document.documentElement.dataset.visualTheme);
    assert.ok(["field", "coral", "analog"].includes(firstTheme));
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await page.evaluate(() => document.documentElement.dataset.visualTheme), firstTheme);

    await page.click('[data-theme-choice="analog"]');
    const issueHref = await page.getAttribute("a[data-theme-link]", "href");
    assert.match(issueHref, /theme=analog/);
    await page.goto(new URL(issueHref, server.origin).href, { waitUntil: "networkidle" });
    assert.equal(await page.evaluate(() => document.documentElement.dataset.visualTheme), "analog");
    await context.close();
  } finally {
    await browser.close();
    await server.close();
  }
});

test("mobile controls support touch sizing and arrow-key selection", async () => {
  const server = await startStaticServer(distDir);
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome" });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto(`${server.origin}/`, { waitUntil: "networkidle" });
    assert.match(await page.locator('meta[name="viewport"]').getAttribute("content"), /viewport-fit=cover/);

    const themeButtons = page.locator("[data-theme-choice]");
    await themeButtons.first().focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await themeButtons.nth(1).getAttribute("aria-pressed"), "true");

    const filters = page.locator("[data-index-filter]");
    await filters.first().focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await filters.nth(1).getAttribute("aria-pressed"), "true");

    const dimensions = await page.locator(".site-header a, .theme-options button, .index-filters button").evaluateAll((controls) => controls.map((control) => {
      const rect = control.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    }));
    assert.ok(dimensions.every(({ width, height }) => width >= 43.5 && height >= 43.5));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
    await context.close();
  } finally {
    await browser.close();
    await server.close();
  }
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
