import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { assertClosingPaletteVariation, buildSite, contrastRatio } from "../scripts/lib/build.mjs";
import { groupIssuesByIsoWeek, isoWeekForDate } from "../scripts/lib/dates.mjs";
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

test("mobile protocol and repository skill are present", async () => {
  const protocol = await readFile(path.join(repoRoot, "docs/MOBILE_EDITORIAL_PROTOCOL.md"), "utf8");
  const skill = await readFile(path.join(repoRoot, ".agents/skills/culture-taste-mobile/SKILL.md"), "utf8");
  assert.match(protocol, /320x568/);
  assert.match(protocol, /viewport-fit/);
  assert.match(protocol, /field.*coral.*analog/s);
  assert.match(skill, /MOBILE_EDITORIAL_PROTOCOL\.md/);
});

test("ISO week grouping is deterministic across boundaries, leap days, and missing publication days", () => {
  assert.deepEqual(isoWeekForDate("2026-08-31"), {
    key: "2026-W36", year: 2026, week: 36, start: "2026-08-31", end: "2026-09-06",
  });
  assert.equal(isoWeekForDate("2021-01-01").key, "2020-W53");
  assert.equal(isoWeekForDate("2024-02-29").key, "2024-W09");
  const weeks = groupIssuesByIsoWeek([
    { issue_id: "a", publication_date: "2026-08-31" },
    { issue_id: "b", publication_date: "2026-08-28" },
    { issue_id: "c", publication_date: "2026-08-24" },
  ]);
  assert.deepEqual(weeks.map((week) => [week.key, week.issues.map((issue) => issue.issue_id)]), [
    ["2026-W36", ["a"]],
    ["2026-W35", ["b", "c"]],
  ]);
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

test("Preview homepage is bounded to the current week while Archive exposes every issue once by week", async () => {
  const home = await readFile(path.join(previewDist, "index.html"), "utf8");
  const archive = await readFile(path.join(previewDist, "archive/index.html"), "utf8");
  const current = await readFile(path.join(previewDist, "issues/2026-09-02/index.html"), "utf8");
  for (const date of ["2026-08-20", "2026-08-21", "2026-08-22", "2026-08-23", "2026-08-24", "2026-08-25", "2026-08-26", "2026-08-27", "2026-08-28", "2026-08-29", "2026-08-30", "2026-08-31", "2026-09-01", "2026-09-02"]) {
    assert.equal((archive.match(new RegExp(`href="\\.\\.\\/issues\\/${date}\\/"`, "g")) ?? []).length, 1, date);
  }
  assert.equal((home.match(/<li class="issue-card(?:\s|\")/g) ?? []).length, 3);
  assert.equal((home.match(/issue-card--lead/g) ?? []).length, 1);
  assert.match(home, /<li class="issue-card(?:\s|\")[\s\S]*?issues\/2026-09-02\//);
  assert.doesNotMatch(home, /<li class="issue-card(?:\s|\")[\s\S]*?issues\/2026-08-30\//);
  assert.match(home, /NON-PRODUCTION PREVIEW/);
  assert.match(home, /THE ISSUES \/ 31 AUG—02 SEP · 2026-W36/);
  assert.match(home, /OPEN WEEKLY ARCHIVE/);
  assert.match(home, /meta name="robots" content="noindex,nofollow"/);
  assert.match(home, /rel="icon" type="image\/png" href="\.\/assets\/culture-taste-earth\.png"/);
  assert.match(archive, /rel="icon" type="image\/png" href="\.\.\/assets\/culture-taste-earth\.png"/);
  assert.match(current, /class="issue-brand"[\s\S]*class="brand-type"/);
  assert.doesNotMatch(current, /class="issue-brand"[\s\S]{0,240}<img/);
  assert.doesNotMatch(home, /SAME FRAME, NEW MOVE/);
  assert.match(archive, /assets\/covers\/2026-08-23\.svg/);
  assert.match(archive, /assets\/covers\/2026-08-27\.svg/);
  assert.match(archive, /assets\/covers\/2026-08-30\.svg/);
  assert.match(home, /assets\/covers\/2026-09-02\.svg/);
  assert.match(archive, /assets\/covers\/2026-08-31\.svg/);
  assert.match(archive, /assets\/covers\/2026-09-01\.svg/);
  assert.match(archive, /assets\/covers\/2026-09-02\.svg/);
  assert.match(archive, /id="week-2026-W36"[\s\S]*?CURRENT WEEK/);
  assert.match(archive, /id="week-2026-W35"[\s\S]*?HISTORICAL/);
  assert.match(archive, /id="week-2026-W34"/);
  assert.doesNotMatch(archive, /data-filter=/);
  assert.doesNotMatch(archive, /class="archive-covers"/);
  assert.doesNotMatch(home, /<div class="type-cover"[^>]*><span>THE DAY/);
  await readFile(path.join(previewDist, "assets/culture-taste-earth.png"));
  for (const cover of ["2026-08-20.png", "2026-08-21.png", "2026-08-22.jpg", "2026-08-23.svg", "2026-08-25.svg", "2026-08-26.svg", "2026-08-27.svg", "2026-08-30.svg", "2026-08-31.svg", "2026-09-01.svg", "2026-09-02.svg"]) {
    await readFile(path.join(previewDist, "assets/covers", cover));
  }
});

test("frontend integration keeps the formal issue intact while adding the supplemental daily radar", async () => {
  const home = await readFile(path.join(previewDist, "index.html"), "utf8");
  const current = await readFile(path.join(previewDist, "issues/2026-09-02/index.html"), "utf8");
  assert.equal((home.match(/<button type="button" data-theme-choice=/g) ?? []).length, 3);
  assert.match(home, /class="wordmark"[\s\S]*<em>Taste<\/em>/);
  assert.doesNotMatch(home, /class="wordmark"[^>]*>[\s\S]{0,240}<img/);
  assert.equal((home.match(/<li data-story-card/g) ?? []).length, 10);
  assert.match(home, /id="daily-index-title"/);
  assert.doesNotMatch(home, /先看正式日报/);
  assert.match(home, /01 \/ IN TODAY'S ISSUE/);
  assert.match(home, /02 \/ MORE FROM TODAY/);
  assert.equal((home.match(/data-official-only/g) ?? []).length, 10);
  assert.equal((home.match(/data-radar-kind="issue"/g) ?? []).length, 4);
  assert.equal((home.match(/data-radar-kind="extra"/g) ?? []).length, 6);
  assert.doesNotMatch(home, /class="local-art"/);
  assert.doesNotMatch(home, /<span class="radar-visual"[^>]*>[\s\S]*?<i aria-hidden="true"><\/i>/);
  assert.doesNotMatch(home, /class="theme-picker"/);
  assert.equal((home.match(/issues\/2026-09-02\/stories\/[^/]+\//g) ?? []).length, 4);
  assert.match(current, /class="reading-progress"/);
  assert.equal((current.match(/<button type="button" data-theme-choice=/g) ?? []).length, 3);
  assert.match(current, /data-content-sha256="[0-9a-f]{64}"/);
  assert.equal((current.match(/class="issue-story"/g) ?? []).length, 5);
  assert.match(current, /data-story="exit"/);
  assert.match(current, /id="sources"/);
  const storyRoutes = await readdir(path.join(previewDist, "issues/2026-09-02/stories"));
  assert.equal(storyRoutes.length, 4);
  for (const storyId of storyRoutes) await readFile(path.join(previewDist, "issues/2026-09-02/stories", storyId, "index.html"));
  const firstStory = await readFile(path.join(previewDist, "issues/2026-09-02/stories", storyRoutes[0], "index.html"), "utf8");
  assert.match(firstStory, /class="story-reader-brand"[\s\S]*<em>Taste<\/em>/);
  assert.doesNotMatch(firstStory, /class="story-reader-brand"[^>]*>[\s\S]{0,240}<img/);
  const sitemap = await readFile(path.join(previewDist, "sitemap.xml"), "utf8");
  for (const storyId of storyRoutes) assert.match(sitemap, new RegExp(`issues/2026-09-02/stories/${storyId}/`));
});

test("daily coda uses one issue-locked editorial quotation and a validated non-repeating palette", async () => {
  const home = await readFile(path.join(previewDist, "index.html"), "utf8");
  const quotationPool = await readJson(path.join(repoRoot, "automation/closing-quotation-pool.json"));
  const nativeIssues = [];
  for (const issueDate of ["2026-08-23", "2026-08-24", "2026-08-25", "2026-08-26", "2026-08-27", "2026-08-28", "2026-08-29", "2026-08-30", "2026-08-31", "2026-09-01", "2026-09-02"]) {
    const artDirection = await readJson(path.join(repoRoot, `src/issues/${issueDate}/art-direction.json`));
    const manifest = await readJson(path.join(repoRoot, `src/issues/${issueDate}/issue-manifest.public.json`));
    assert.deepEqual(manifest.art_direction, Object.fromEntries(Object.keys(manifest.art_direction).map((key) => [key, artDirection[key]])));
    assert.ok(contrastRatio(artDirection.closing_palette.background, artDirection.closing_palette.foreground) >= 4.5);
    assert.ok(contrastRatio(artDirection.closing_palette.background, artDirection.closing_palette.accent) >= 3);
    nativeIssues.push({ issueId: issueDate, manifest });
  }
  const latestArtDirection = await readJson(path.join(repoRoot, "src/issues/2026-09-02/art-direction.json"));
  const selectedQuotation = quotationPool.candidates.find(({ id }) => id === latestArtDirection.closing_quotation.id);
  assert.ok(selectedQuotation);
  assert.equal(latestArtDirection.closing_quotation.text, selectedQuotation.text);
  assert.equal(latestArtDirection.closing_quotation.language, selectedQuotation.language);
  assert.equal(latestArtDirection.closing_quotation.credit, quotationPool.authorship);
  assert.deepEqual(quotationPool.language_priority, ["en", "zh-CN"]);
  assert.equal(quotationPool.selection_mode, "editor_selected_and_issue_locked");
  assert.match(home, /class="daily-coda"/);
  assert.match(home, /DAILY QUOTATION \/ 2026-W36 · EN/);
  assert.match(home, /A release begins only when someone can truly enter it\./);
  assert.match(home, /--coda-bg:#102A2A;--coda-fg:#E9F0E7;--coda-accent:#90F0D0/);
  assert.doesNotMatch(home, /最后一根支撑不被拆掉，提醒方法仍在承担结果/);
  assert.doesNotMatch(home, /We follow the story into its own visual world/);
  assert.doesNotMatch(home, /STABLE PRINCIPLES/);
  assert.doesNotMatch(home, /class="coda-principles"/);
  assert.doesNotMatch(home, /事实先站稳/);
  assert.doesNotMatch(home, /class="editorial-code"/);
  assert.doesNotThrow(() => assertClosingPaletteVariation(nativeIssues, {
    required: true, effective_from: "2026-08-23", comparison_window_issues: 7,
  }));
  const repeated = structuredClone(nativeIssues);
  repeated.at(-1).manifest.art_direction.closing_palette = structuredClone(repeated.at(-2).manifest.art_direction.closing_palette);
  assert.throws(() => assertClosingPaletteVariation(repeated, {
    required: true, effective_from: "2026-08-23", comparison_window_issues: 7,
  }), /exactly repeats/);
});

test("theme controls share equal marks while desktop and mobile keep distinct editorial compositions", async () => {
  const server = await startStaticServer(previewDist);
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome" });
    const facts = {};
    for (const [name, viewport] of Object.entries({ desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } })) {
      const context = await browser.newContext({ viewport });
      await context.route(/^https:\/\//, (route) => route.abort());
      const page = await context.newPage();
      await page.goto(`${server.origin}/`, { waitUntil: "domcontentloaded" });
      facts[name] = await page.evaluate(() => ({
        navigation: getComputedStyle(document.querySelector(".publication-header nav")).display,
        heroColumns: getComputedStyle(document.querySelector(".home-hero")).gridTemplateColumns,
        radarColumns: getComputedStyle(document.querySelector(".radar-group ol")).gridTemplateColumns,
        issueFieldHeight: document.querySelector(".issue-field").getBoundingClientRect().height,
        issueCardDisplay: getComputedStyle(document.querySelector(".issue-card > a")).display,
        issueCoverRatio: (() => {
          const rect = document.querySelector(".issue-card-cover").getBoundingClientRect();
          return rect.width / rect.height;
        })(),
        dots: [...document.querySelectorAll(".theme-dots button")].map((button) => {
          const rect = button.getBoundingClientRect();
          const mark = getComputedStyle(button, "::before");
          return { hit: [rect.width, rect.height], mark: [mark.width, mark.height] };
        }),
      }));
      await context.close();
    }
    assert.equal(facts.desktop.navigation, "flex");
    assert.equal(facts.mobile.navigation, "none");
    assert.notEqual(facts.desktop.heroColumns, facts.mobile.heroColumns);
    assert.notEqual(facts.desktop.radarColumns, facts.mobile.radarColumns);
    assert.ok(facts.desktop.issueCoverRatio < 1);
    assert.ok(facts.mobile.issueCoverRatio < 1);
    assert.equal(facts.desktop.issueCardDisplay, "block");
    assert.equal(facts.mobile.issueCardDisplay, "grid");
    assert.notEqual(facts.desktop.issueFieldHeight, facts.mobile.issueFieldHeight);
    for (const layout of Object.values(facts)) {
      assert.deepEqual(layout.dots.map((dot) => dot.hit), [[44, 44], [44, 44], [44, 44]]);
      assert.deepEqual(layout.dots.map((dot) => dot.mark), [["12px", "12px"], ["12px", "12px"], ["12px", "12px"]]);
    }
  } finally {
    await browser?.close();
    await server.close();
  }
});

test("weekly Archive progressively enhances into a single-open keyboard accordion with deep links", async () => {
  const server = await startStaticServer(previewDist);
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome" });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto(`${server.origin}/archive/`, { waitUntil: "domcontentloaded" });
    const toggles = page.locator("[data-week-toggle]");
    assert.equal(await toggles.count(), 2);
    assert.deepEqual(await toggles.evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-expanded"))), ["false", "false"]);
    await toggles.first().focus();
    await toggles.first().press("Enter");
    assert.equal(await toggles.first().getAttribute("aria-expanded"), "true");
    assert.equal(await page.locator("#panel-2026-W35").getAttribute("hidden"), null);
    assert.equal(await page.evaluate(() => location.hash), "#week-2026-W35");
    assert.equal(await page.evaluate(() => document.activeElement?.closest("[data-week-dossier]")?.id), "week-2026-W35");
    await toggles.nth(1).click();
    assert.equal(await toggles.first().getAttribute("aria-expanded"), "false");
    assert.equal(await toggles.nth(1).getAttribute("aria-expanded"), "true");
    assert.equal(await page.locator("#panel-2026-W35").getAttribute("hidden"), "");
    await page.goto(`${server.origin}/archive/#week-2026-W35`, { waitUntil: "domcontentloaded" });
    assert.equal(await page.locator('#week-2026-W35 [data-week-toggle]').getAttribute("aria-expanded"), "true");
    assert.equal(await page.locator("#panel-2026-W35").getAttribute("hidden"), null);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
    await context.close();

    const noJs = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
    const noJsPage = await noJs.newPage();
    await noJsPage.goto(`${server.origin}/archive/`, { waitUntil: "domcontentloaded" });
    assert.equal(await noJsPage.locator(".week-date-ledger a").count(), 14);
    assert.equal(await noJsPage.locator("[data-week-panel][hidden]").count(), 0);
    await noJs.close();
  } finally {
    await browser?.close();
    await server.close();
  }
});

test("daily radar has at least two official-media selections in every category without changing the issue manifest", async () => {
  const radar = JSON.parse(await readFile(path.join(repoRoot, "src/issues/2026-08-26/daily-radar.public.json"), "utf8"));
  const priorRadar = JSON.parse(await readFile(path.join(repoRoot, "src/issues/2026-08-25/daily-radar.public.json"), "utf8"));
  const manifest = JSON.parse(await readFile(path.join(repoRoot, "src/issues/2026-08-26/issue-manifest.public.json"), "utf8"));
  assert.equal(manifest.stories.length, 5);
  assert.equal(radar.items.length, 10);
  for (const category of ["fashion", "music", "objects", "city"]) {
    assert.ok(radar.items.filter((item) => item.category === category).length >= 2, category);
  }
  for (const extra of radar.items.filter((item) => !item.included_story_id)) {
    assert.equal(extra.media.origin_authority, "first_party_official");
    assert.match(extra.official_url, /^https:\/\//);
    assert.match(extra.media.url, /^https:\/\//);
  }
  const priorIds = new Set(priorRadar.items.map((item) => item.id));
  const priorUrls = new Set(priorRadar.items.map((item) => item.official_url).filter(Boolean));
  assert.ok(radar.items.every((item) => !priorIds.has(item.id)), "current radar repeats a prior item id");
  assert.ok(radar.items.filter((item) => item.official_url).every((item) => !priorUrls.has(item.official_url)), "current radar repeats a prior official URL");
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
    await context.addInitScript(() => {
      const count = Number(sessionStorage.getItem("ctd-test-random-count") ?? "0");
      sessionStorage.setItem("ctd-test-random-count", String(count + 1));
      Math.random = () => count % 2 === 0 ? 0 : 0.5;
    });
    const page = await context.newPage();
    await page.goto(`${server.origin}/`, { waitUntil: "domcontentloaded" });
    const firstTheme = await page.locator("html").getAttribute("data-visual-theme");
    assert.ok(["field", "coral", "analog"].includes(firstTheme));
    await page.reload({ waitUntil: "domcontentloaded" });
    assert.notEqual(await page.locator("html").getAttribute("data-visual-theme"), firstTheme);

    await page.locator('[data-theme-choice="analog"]').click();
    assert.equal(await page.locator("html").getAttribute("data-visual-theme"), "analog");
    assert.equal(await page.locator('[data-theme-choice="analog"]').getAttribute("aria-pressed"), "true");
    await page.locator('[data-story-filter="objects"]').click();
    const visibleCategories = await page.locator("[data-story-card]").evaluateAll((cards) => cards.filter((card) => !card.hidden).map((card) => card.dataset.storyCategory));
    assert.ok(visibleCategories.length > 0);
    assert.ok(visibleCategories.every((category) => category === "objects"));

    const storyHref = await page.locator("[data-story-card] a").first().getAttribute("href");
    assert.match(storyHref, /theme=analog/);
    await page.goto(new URL(storyHref, `${server.origin}/`).href, { waitUntil: "domcontentloaded" });
    assert.equal(await page.locator("html").getAttribute("data-visual-theme"), "analog");
    assert.equal(await page.locator('[data-theme-choice="analog"]').getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator("body[data-story-reader]").count(), 1);
    assert.equal(await page.locator("main h1").count(), 1);
    assert.match(await page.locator("main").innerText(), /VERIFIED SOURCES \/ DATES/);
    await page.reload({ waitUntil: "domcontentloaded" });
    assert.equal(await page.locator("html").getAttribute("data-visual-theme"), "analog");
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)), 0);
    await context.close();

    const fallbackContext = await browser.newContext();
    await fallbackContext.route(/^https:\/\//, (route) => route.abort());
    const fallbackPage = await fallbackContext.newPage();
    await fallbackPage.goto(`${server.origin}/`, { waitUntil: "domcontentloaded" });
    await fallbackPage.waitForFunction(() => document.querySelector("[data-official-only]")?.classList.contains("image-failed"));
    assert.equal(await fallbackPage.locator("[data-official-only] .local-art").count(), 0);
    assert.ok(await fallbackPage.locator("[data-official-only].image-failed .official-media-fallback").first().isVisible());
    await fallbackPage.goto(`${server.origin}/issues/2026-08-25/stories/seoul-fashion-week-two-city-systems/`, { waitUntil: "domcontentloaded" });
    await fallbackPage.waitForFunction(() => document.querySelector("[data-visual-frame]")?.classList.contains("image-failed"));
    assert.ok(await fallbackPage.locator("[data-visual-frame].image-failed .local-art").count() > 0);
    assert.match(await fallbackPage.locator("main").innerText(), /官方图片未载入/);
    await fallbackContext.close();

    const retryContext = await browser.newContext();
    const retryImagePrefix = "https://imgproxy.berlinonline.net/pOTJAidaH2lezG7mtW0KfSPlA8ywe8r77lh0yp-a2nw/resizing_type:fit/width:1200/height:1200/gravity:ce/enlarge:0/q:70/cb:2026090206/aHR0cHM6Ly9wb3B1bGEtbWlkZGxld2FyZS5zMy5hbWF6b25hd3MuY29tL2JvLW1pZGRsZXdhcmUvYm8uYmRlX2NoYW5uZWwuZXZlbnQvaW1hZ2VzLzE2MS81M2ZlNzNlMC01MGY0LTFlMGQtY2FhMS0wMDljMTZhYjcwMzcuanBn.jpg";
    let retryAttempts = 0;
    await retryContext.route((url) => url.href.startsWith(retryImagePrefix), async (route) => {
      retryAttempts += 1;
      if (retryAttempts === 1) {
        await route.abort("failed");
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#ff512b"/></svg>',
      });
    });
    const retryPage = await retryContext.newPage();
    await retryPage.goto(`${server.origin}/`, { waitUntil: "domcontentloaded" });
    const retryImage = retryPage.locator('img[alt="Official Berlin.de ONE MILLION porcelain vessel event image"]');
    await retryImage.scrollIntoViewIfNeeded();
    await retryPage.waitForFunction(() => {
      const image = document.querySelector('img[alt="Official Berlin.de ONE MILLION porcelain vessel event image"]');
      return image?.complete && image.naturalWidth > 0 && image.src.includes("ctd_retry=1");
    }, null, { timeout: 10_000 });
    assert.ok(retryAttempts >= 2);
    assert.equal(await retryImage.locator("..").evaluate((frame) => frame.classList.contains("image-failed")), false);
    await retryContext.close();

    const reducedContext = await browser.newContext({ reducedMotion: "reduce" });
    const reducedPage = await reducedContext.newPage();
    await reducedPage.goto(`${server.origin}/issues/2026-08-25/stories/seoul-fashion-week-two-city-systems/`, { waitUntil: "domcontentloaded" });
    assert.equal(await reducedPage.locator(".story-opening-sticky").evaluate((element) => getComputedStyle(element).position), "relative");
    assert.equal(await reducedPage.locator(".story-title-line").first().evaluate((element) => getComputedStyle(element).translate), "none");
    await reducedContext.close();

    const noJsContext = await browser.newContext({ javaScriptEnabled: false });
    const noJsPage = await noJsContext.newPage();
    await noJsPage.goto(`${server.origin}/`, { waitUntil: "domcontentloaded" });
    assert.equal(await noJsPage.locator("[data-story-card]").count(), 10);
    assert.equal(await noJsPage.locator(".theme-picker").count(), 0);
    assert.equal(await noJsPage.locator(".radar-filters").isVisible(), false);
    const noJsStory = await noJsPage.locator("[data-story-card] a").first().getAttribute("href");
    await noJsPage.goto(new URL(noJsStory, `${server.origin}/`).href, { waitUntil: "domcontentloaded" });
    assert.equal(await noJsPage.locator("body[data-story-reader]").count(), 1);
    assert.match(await noJsPage.locator("main").innerText(), /VERIFIED SOURCES \/ DATES/);
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
  assert.equal((issue.match(/loading="eager"/g) ?? []).length, 1);
  assert.equal((issue.match(/data-external-preview="true"[^>]*loading="lazy"/g) ?? []).length, 5);
  assert.ok(manifest.stories.every((story) => story.sources.length > 0 && story.media));
  assert.equal(manifest.status, "BLOCKED");
  assert.equal(manifest.rights_summary.status, "blocked");
});

test("independent static QA validates historical archive routes and assets", async () => {
  const qa = await runStaticChecks({ repoRoot, distDir: previewDist, issueId: "2026-08-26" });
  assert.equal(qa.checks.find((check) => check.id === "historical_archive").status, "PASS");
  assert.equal(qa.checks.find((check) => check.id === "assets").status, "PASS");
  assert.equal(qa.checks.find((check) => check.id === "internal_links").status, "PASS");
});

test("2026-08-26 Preview exposes one first-party official image per story and is filed in its historical week", async () => {
  const current = await readFile(path.join(previewDist, "issues/2026-08-26/index.html"), "utf8");
  const manifest = await readJson(path.join(previewDist, "issues/2026-08-26/issue-manifest.public.json"));
  assert.equal((current.match(/class="story-figure"/g) ?? []).length, 5);
  assert.equal(manifest.stories.length, 5);
  assert.equal(manifest.stories.filter((story) => story.media?.kind === "source_image").length, 5);
  assert.equal(manifest.stories.filter((story) => story.media?.origin_authority === "first_party_official").length, 5);
  assert.equal(manifest.stories.filter((story) => story.media?.rights_basis === "preview_user_authorized_external").length, 5);
  assert.equal((current.match(/data-media-kind="source_image"/g) ?? []).length, 5);
  assert.equal((current.match(/data-external-preview="true"/g) ?? []).length, 10);
  assert.equal(manifest.rights_summary.status, "blocked");
  assert.equal(manifest.rights_summary.unknown_required_assets, 5);
  assert.ok(manifest.stories.every((story) => story.sources.some((source) => source.relationship === "first_party_official" && source.url === story.media.origin_url)));
  assert.match(current, /stussy-jeju-archive-store/);
  assert.match(current, /href="https:\/\/www\.stussy\.com\/blogs\/news\/jeju-archive-store"/);
  assert.match(current, /2026-08-26/);
  assert.doesNotMatch(await readFile(path.join(previewDist, "index.html"), "utf8"), /<li class="issue-card"[\s\S]*?issues\/2026-08-26\//);
  assert.match(await readFile(path.join(previewDist, "archive/index.html"), "utf8"), /id="week-2026-W35"[\s\S]*?issues\/2026-08-26\/[\s\S]*?HISTORICAL/);
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
  assert.equal((historical.match(/loading="eager"/g) ?? []).length, 1);
  assert.equal((historical.match(/loading="lazy"/g) ?? []).length, 15);
});

test("Preview workflow verifies pull requests but deploys only on explicit manual dispatch", async () => {
  const workflow = await readFile(path.join(repoRoot, ".github/workflows/preview.yml"), "utf8");
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /branches: \[main, preview-build-v1\]/);
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
