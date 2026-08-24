import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { HtmlValidate } from "html-validate";
import { chromium } from "playwright";
import {
  digestMap,
  fileDigestMap,
  readJson,
  sha256File,
  stableJson,
  toPosix,
  walkFiles,
  writeJson,
} from "./files.mjs";
import { scanForPrivateMaterial } from "./privacy.mjs";
import { validateJsonFile } from "./schema.mjs";
import { startStaticServer } from "./server.mjs";

const CHECK_IDS = [
  "manifest_schema",
  "artifact_integrity",
  "html_parse",
  "language_and_landmarks",
  "heading_structure",
  "full_article_and_sources",
  "story_visuals",
  "no_js_reading",
  "assets",
  "internal_links",
  "historical_archive",
  "private_material_absent",
  "accessibility_structure",
  "keyboard_focus",
  "desktop_render",
  "mobile_render",
  "reduced_motion_render",
  "publication_shell_render",
];

export const REQUIRED_TECHNICAL_CHECKS = Object.freeze([...CHECK_IDS]);

function result(id, ok, detail) {
  return { id, status: ok ? "PASS" : "FAIL", detail };
}

function attributes(tag) {
  return Object.fromEntries(
    [...tag.matchAll(/\s([:\w-]+)\s*=\s*(["'])(.*?)\2/gs)].map((match) => [match[1].toLowerCase(), match[3]]),
  );
}

function htmlTags(html, names) {
  return [...html.matchAll(new RegExp(`<(?:${names.join("|")})\\b[^>]*>`, "gis"))].map((match) => ({ tag: match[0], attributes: attributes(match[0]) }));
}

function targetForLink(distDir, htmlFile, href) {
  const withoutFragment = href.split("#")[0].split("?")[0];
  if (!withoutFragment) return null;
  if (/^(?:https?:|mailto:|tel:|data:)/i.test(withoutFragment)) return null;
  let target = withoutFragment.startsWith("/")
    ? path.join(distDir, withoutFragment)
    : path.resolve(path.dirname(htmlFile), withoutFragment);
  if (withoutFragment.endsWith("/")) target = path.join(target, "index.html");
  return target;
}

async function htmlValidation(htmlFiles) {
  const validator = new HtmlValidate({
    extends: ["html-validate:recommended"],
    rules: {
      "no-inline-style": "off",
      "prefer-native-element": "off",
      "require-sri": "off",
      "valid-id": ["error", { relaxed: true }],
    },
  });
  const failures = [];
  for (const file of htmlFiles) {
    const report = await validator.validateFile(file);
    for (const validation of report.results) {
      for (const message of validation.messages) {
        failures.push(`${toPosix(path.basename(file))}:${message.line}:${message.column} ${message.ruleId} ${message.message}`);
      }
    }
  }
  return failures;
}

export async function runStaticChecks({ repoRoot, distDir, issueId }) {
  const checks = [];
  const buildReport = await readJson(path.join(distDir, "build-report.json"));
  const issueReport = buildReport.issues.find((issue) => issue.issue_id === issueId);
  if (!issueReport) throw new Error(`Build report has no issue ${issueId}`);
  const manifestPath = path.join(distDir, "issues", issueId, "issue-manifest.public.json");
  const manifest = await readJson(manifestPath);

  try {
    await validateJsonFile(manifest, path.join(repoRoot, "schemas/issue-manifest.public.schema.json"), "built public manifest");
    checks.push(result("manifest_schema", true, "public manifest v2 is valid"));
  } catch (error) {
    checks.push(result("manifest_schema", false, error.message));
  }

  const currentFiles = await fileDigestMap(distDir, { exclude: ["build-report.json"] });
  const currentArtifactDigest = digestMap(currentFiles);
  checks.push(result("artifact_integrity", currentArtifactDigest === buildReport.artifact_digest, {
    expected: buildReport.artifact_digest,
    actual: currentArtifactDigest,
  }));

  const allHtmlFiles = (await walkFiles(distDir)).filter((file) => file.endsWith(".html"));
  const htmlFiles = allHtmlFiles.filter((file) => path.basename(file) !== "original.html");
  const parseFailures = await htmlValidation(htmlFiles);
  checks.push(result("html_parse", parseFailures.length === 0, parseFailures));

  const issueHtmlPath = path.join(distDir, "issues", issueId, "index.html");
  const issueHtml = await readFile(issueHtmlPath, "utf8");
  const landmarkOk = /<html\s+lang="zh-CN"/i.test(issueHtml)
    && /<header\b/i.test(issueHtml)
    && /<nav\b[^>]*aria-label=/i.test(issueHtml)
    && /<main\b/i.test(issueHtml)
    && /<article\b/i.test(issueHtml)
    && /<footer\b/i.test(issueHtml);
  checks.push(result("language_and_landmarks", landmarkOk, landmarkOk ? "zh-CN and semantic landmarks present" : "missing lang or landmark"));

  const h1Count = (issueHtml.match(/<h1\b/gi) ?? []).length;
  const h2Count = (issueHtml.match(/<h2\b/gi) ?? []).length;
  checks.push(result("heading_structure", h1Count === 1 && h2Count >= manifest.stories.length + 1, { h1: h1Count, h2: h2Count }));

  const missingStories = manifest.stories.filter((story) => !issueHtml.includes(story.title)).map((story) => story.id);
  const hasContentHash = issueHtml.includes(`data-content-sha256="${manifest.source_hashes.content_sha256}"`);
  const hasSources = /Sources &amp; Dates/.test(issueHtml);
  checks.push(result("full_article_and_sources", missingStories.length === 0 && hasContentHash && hasSources, {
    missing_stories: missingStories,
    content_hash_marker: hasContentHash,
    sources_and_dates: hasSources,
  }));

  const storySections = [...issueHtml.matchAll(/<section class="issue-story" data-story="([^"]+)"[\s\S]*?<\/section>/g)].map((match) => match[0]);
  const visualFailures = manifest.media_required
    ? manifest.stories.filter((story) => {
        const section = storySections.find((candidate) => candidate.includes(`data-story="${story.id}"`)) ?? "";
        const kind = story.media?.kind ?? "original_illustration";
        return !new RegExp(`<figure class="story-figure"[^>]*data-media-kind="${kind}"[\\s\\S]*?<img\\b[^>]*\\balt="[^"]+"[\\s\\S]*?<figcaption>`).test(section);
      }).map((story) => story.id)
    : [];
  checks.push(result("story_visuals", visualFailures.length === 0, {
    required: Boolean(manifest.media_required),
    story_count: manifest.stories.length,
    visual_failures: visualFailures,
  }));

  const assetErrors = [];
  const linkErrors = [];
  for (const htmlFile of allHtmlFiles) {
    const html = await readFile(htmlFile, "utf8");
    if (/@import\s+(?:url\()?['"]?https?:|url\(\s*['"]?https?:/i.test(html)) {
      assetErrors.push(`${toPosix(path.relative(distDir, htmlFile))}: remote display CSS dependency`);
    }
    for (const item of htmlTags(html, ["img", "script", "link", "source", "video", "iframe", "a"])) {
      const src = item.attributes.src;
      const href = item.attributes.href;
      if (src === "" || href === "") assetErrors.push(`${toPosix(path.relative(distDir, htmlFile))}: empty src/href`);
      const displayReference = src ?? (item.tag.toLowerCase().startsWith("<link") && item.attributes.rel === "stylesheet" ? href : null);
      if (displayReference && /^https?:/i.test(displayReference)) assetErrors.push(`${toPosix(path.relative(distDir, htmlFile))}: remote display dependency ${displayReference}`);
      if (displayReference) {
        const target = targetForLink(distDir, htmlFile, displayReference);
        if (target) {
          try {
            await readFile(target);
          } catch {
            assetErrors.push(`${toPosix(path.relative(distDir, htmlFile))}: missing asset ${displayReference}`);
          }
        }
      }
      if (href) {
        const target = targetForLink(distDir, htmlFile, href);
        if (target) {
          try {
            await readFile(target);
          } catch {
            linkErrors.push(`${toPosix(path.relative(distDir, htmlFile))}: unresolved link ${href}`);
          }
        }
        if (href.startsWith("#") && !new RegExp(`id=["']${href.slice(1).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`).test(html)) {
          linkErrors.push(`${toPosix(path.relative(distDir, htmlFile))}: missing anchor ${href}`);
        }
      }
    }
  }
  checks.push(result("assets", assetErrors.length === 0, assetErrors));
  checks.push(result("internal_links", linkErrors.length === 0, linkErrors));

  const historicalErrors = [];
  const historicalIssues = buildReport.historical_issues ?? [];
  if (historicalIssues.length) {
    const archiveHtml = await readFile(path.join(distDir, "archive", "index.html"), "utf8");
    for (const historical of historicalIssues) {
      const issueRoot = path.join(distDir, "issues", historical.issue_id);
      for (const requiredPath of [
        path.join(issueRoot, "index.html"),
        path.join(issueRoot, historical.migration_mode === "pdf_facsimile" || historical.migration_mode === "historical_web_edition" ? "original.pdf" : "original.html"),
        path.join(distDir, "assets", historical.coverAsset),
      ]) {
        try {
          await readFile(requiredPath);
        } catch {
          historicalErrors.push(`missing historical artifact: ${toPosix(path.relative(distDir, requiredPath))}`);
        }
      }
      if (!archiveHtml.includes(historical.issue_id)) historicalErrors.push(`archive omits historical issue ${historical.issue_id}`);
      if (historical.production_eligible !== false) historicalErrors.push(`historical issue ${historical.issue_id} is not explicitly non-production`);
    }
  }
  checks.push(result("historical_archive", historicalErrors.length === 0, historicalIssues.length ? historicalErrors : "not included in this isolated fixture build"));

  const privateFindings = await scanForPrivateMaterial(distDir);
  checks.push(result("private_material_absent", privateFindings.length === 0, privateFindings));

  const images = htmlTags(issueHtml, ["img"]);
  const missingAlt = images.filter((image) => image.attributes.alt === undefined).length;
  const a11yOk = /class="skip-link"/i.test(issueHtml) && /:focus-visible/.test(issueHtml) && missingAlt === 0;
  checks.push(result("accessibility_structure", a11yOk, { skip_link: /class="skip-link"/i.test(issueHtml), focus_style: /:focus-visible/.test(issueHtml), missing_alt: missingAlt }));

  return { checks, buildReport, issueReport, manifest, currentArtifactDigest };
}

async function launchChromium() {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) {
    return chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
  }
  try {
    return await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome" });
  } catch (channelError) {
    try {
      return await chromium.launch({ headless: true });
    } catch (bundledError) {
      throw new Error(`No Playwright-compatible Chromium is available. Channel error: ${channelError.message}; bundled error: ${bundledError.message}`);
    }
  }
}

async function captureCase({ browser, origin, issueId, evidenceDir, name, width, height, javaScriptEnabled, reducedMotion, manifest, urlPath, testArchiveFilter = false }) {
  const context = await browser.newContext({
    viewport: { width, height },
    javaScriptEnabled,
    reducedMotion: reducedMotion ? "reduce" : "no-preference",
    colorScheme: "light",
    locale: "zh-CN",
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const requestFailures = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => requestFailures.push(`${request.url()} ${request.failure()?.errorText ?? "failed"}`));
  await page.goto(`${origin}/${urlPath ?? `issues/${issueId}/`}`, { waitUntil: "networkidle" });

  const facts = await page.evaluate((storyTitles) => {
    const mainText = document.querySelector("main")?.innerText ?? "";
    const images = [...document.images];
    return {
      main_text_length: mainText.length,
      missing_story_titles: storyTitles.filter((title) => !mainText.includes(title)),
      sources_and_dates: mainText.includes("Sources & Dates"),
      horizontal_overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      broken_images: images.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.currentSrc || image.src),
      story_visual_count: document.querySelectorAll(".issue-story .story-figure").length,
      issue_index_is_native_disclosure: Boolean(document.querySelector(".issue-nav-panel > summary")),
      nested_scroll_frames: [...document.querySelectorAll("iframe[data-historical-frame]")].filter((frame) => frame.scrollHeight > frame.clientHeight + 50).length,
      reduced_motion_matches: matchMedia("(prefers-reduced-motion: reduce)").matches,
    };
  }, manifest.stories.map((story) => story.title));

  if (testArchiveFilter) {
    await page.locator('[data-filter="historical"]').click();
    facts.archive_filter = await page.evaluate(() => ({
      historical_visible: [...document.querySelectorAll('.archive-index li[data-kind="historical"]')].every((item) => !item.classList.contains("is-hidden")),
      current_hidden: [...document.querySelectorAll('.archive-index li[data-kind="current"]')].every((item) => item.classList.contains("is-hidden")),
    }));
    await page.locator('[data-filter="all"]').click();
  }

  if (javaScriptEnabled) {
    await page.keyboard.press("Tab");
    facts.keyboard_focus = await page.evaluate(() => {
      const active = document.activeElement;
      const style = getComputedStyle(active);
      return {
        tag: active?.tagName ?? null,
        class_name: active?.className ?? null,
        outline_style: style.outlineStyle,
        outline_width: style.outlineWidth,
      };
    });
  }

  const screenshotPath = path.join(evidenceDir, "renders", `${name}.png`);
  await mkdir(path.dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true, animations: "disabled" });
  const render = {
    path: toPosix(path.relative(evidenceDir, screenshotPath)),
    sha256: await sha256File(screenshotPath),
    width,
    height,
    java_script: javaScriptEnabled,
    reduced_motion: reducedMotion,
  };
  await context.close();
  return { facts, consoleErrors, requestFailures, render };
}

export async function runTechnicalQa({ repoRoot, distDir, issueId, evidenceDir, createdAt = new Date().toISOString(), capture = true }) {
  const staticResult = await runStaticChecks({ repoRoot, distDir, issueId });
  const checks = [...staticResult.checks];
  const renders = {};
  const staticFailed = checks.some((check) => check.status === "FAIL");

  if (capture && !staticFailed) {
    const server = await startStaticServer(distDir);
    const browser = await launchChromium();
    try {
      const cases = [
        { name: "desktop-1440x900", width: 1440, height: 900, javaScriptEnabled: true, reducedMotion: false },
        { name: "mobile-390x844", width: 390, height: 844, javaScriptEnabled: true, reducedMotion: false },
        { name: "no-js-390x844", width: 390, height: 844, javaScriptEnabled: false, reducedMotion: false },
        { name: "reduced-motion-1440x900", width: 1440, height: 900, javaScriptEnabled: true, reducedMotion: true },
        { name: "home-desktop-1440x900", width: 1440, height: 900, javaScriptEnabled: true, reducedMotion: false, urlPath: "" },
        { name: "home-mobile-390x844", width: 390, height: 844, javaScriptEnabled: true, reducedMotion: false, urlPath: "" },
        { name: "archive-desktop-1440x900", width: 1440, height: 900, javaScriptEnabled: true, reducedMotion: false, urlPath: "archive/", testArchiveFilter: true },
        ...(staticResult.buildReport.historical_issues?.length ? [
          { name: "historical-20-mobile-390x844", width: 390, height: 844, javaScriptEnabled: true, reducedMotion: false, urlPath: "issues/2026-08-20/" },
          { name: "historical-21-mobile-390x844", width: 390, height: 844, javaScriptEnabled: true, reducedMotion: false, urlPath: "issues/2026-08-21/" },
          { name: "historical-22-mobile-390x844", width: 390, height: 844, javaScriptEnabled: true, reducedMotion: false, urlPath: "issues/2026-08-22/" },
        ] : []),
      ];
      const captures = {};
      for (const item of cases) {
        captures[item.name] = await captureCase({
          browser,
          origin: server.origin,
          issueId,
          evidenceDir,
          manifest: staticResult.manifest,
          ...item,
        });
        renders[item.name] = captures[item.name].render;
      }

      const noJs = captures["no-js-390x844"];
      checks.push(result("no_js_reading", noJs.facts.main_text_length > 1000 && noJs.facts.missing_story_titles.length === 0 && noJs.facts.sources_and_dates, noJs.facts));

      const keyboard = captures["desktop-1440x900"].facts.keyboard_focus;
      checks.push(result("keyboard_focus", keyboard?.tag === "A" && keyboard.outline_style !== "none" && keyboard.outline_width !== "0px", keyboard));

      for (const [checkId, captureName] of [
        ["desktop_render", "desktop-1440x900"],
        ["mobile_render", "mobile-390x844"],
      ]) {
        const item = captures[captureName];
        const ok = item.facts.horizontal_overflow === 0 && item.facts.broken_images.length === 0 && item.consoleErrors.length === 0 && item.requestFailures.length === 0;
        checks.push(result(checkId, ok, { ...item.facts, console_errors: item.consoleErrors, request_failures: item.requestFailures }));
      }
      const reduced = captures["reduced-motion-1440x900"];
      checks.push(result("reduced_motion_render", reduced.facts.reduced_motion_matches && reduced.facts.horizontal_overflow === 0, reduced.facts));

      const shellCaptures = [captures["home-desktop-1440x900"], captures["home-mobile-390x844"], captures["archive-desktop-1440x900"], captures["historical-20-mobile-390x844"], captures["historical-21-mobile-390x844"], captures["historical-22-mobile-390x844"]].filter(Boolean);
      const shellOk = shellCaptures.every((item) => item.facts.horizontal_overflow === 0
        && item.facts.broken_images.length === 0
        && item.facts.nested_scroll_frames === 0
        && item.consoleErrors.length === 0
        && item.requestFailures.length === 0)
        && captures["archive-desktop-1440x900"].facts.archive_filter?.historical_visible
        && captures["archive-desktop-1440x900"].facts.archive_filter?.current_hidden;
      checks.push(result("publication_shell_render", shellOk, {
        home_desktop: captures["home-desktop-1440x900"].facts,
        home_mobile: captures["home-mobile-390x844"].facts,
        archive: captures["archive-desktop-1440x900"].facts,
      }));
    } finally {
      await browser.close();
      await server.close();
    }
  } else {
    for (const id of ["no_js_reading", "keyboard_focus", "desktop_render", "mobile_render", "reduced_motion_render", "publication_shell_render"]) {
      checks.push(result(id, false, capture ? "render checks skipped because static QA failed" : "render checks not requested"));
    }
  }

  checks.sort((a, b) => CHECK_IDS.indexOf(a.id) - CHECK_IDS.indexOf(b.id));
  const evidence = {
    schema_version: 1,
    kind: "independent_technical_evidence",
    scope: "local_non_production",
    producer: { role: "independent_technical", tool: "scripts/qa.mjs" },
    issue_id: issueId,
    candidate_digest: staticResult.issueReport.candidate_digest,
    artifact_digest: staticResult.buildReport.artifact_digest,
    created_at: createdAt,
    status: checks.every((check) => check.status === "PASS") ? "PASS" : "FAIL",
    checks,
    renders,
    limitations: [
      "Technical evidence does not judge visual taste, editorial quality, HarryTone quality, cultural appropriateness, pacing, or authorship.",
      "This evidence has local non-production scope and grants no production authority.",
    ],
  };
  await validateJsonFile(evidence, path.join(repoRoot, "schemas/technical-evidence.schema.json"), "technical evidence");
  await writeJson(path.join(evidenceDir, "technical-evidence.json"), evidence);
  return evidence;
}
