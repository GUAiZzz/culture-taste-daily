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
  "headline_layout",
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
      if (displayReference && /^https?:/i.test(displayReference)) {
        const externalPreview = item.attributes["data-external-preview"] === "true";
        if (!externalPreview) {
          assetErrors.push(`${toPosix(path.relative(distDir, htmlFile))}: remote display dependency ${displayReference}`);
        }
      }
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

async function captureCase({ browser, origin, issueId, evidenceDir, name, width, height, javaScriptEnabled, reducedMotion, manifest, urlPath, testArchiveAccordion = false }) {
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
  const externalPreviewFailures = [];
  const externalPreviewUrls = new Set(
    manifest.stories.map((story) => story.media?.external_image_url).filter(Boolean),
  );
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    const failure = `${request.url()} ${request.failure()?.errorText ?? "failed"}`;
    if (externalPreviewUrls.has(request.url())) externalPreviewFailures.push(failure);
    else requestFailures.push(failure);
  });
  await page.goto(`${origin}/${urlPath ?? `issues/${issueId}/`}`, { waitUntil: "domcontentloaded" });
  const resolveExternalPreviews = javaScriptEnabled && (
    urlPath === ""
    || name.startsWith("story-")
    || (!urlPath && ["desktop-1440x900", "mobile-390x844"].includes(name))
  );
  if (resolveExternalPreviews) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await page.evaluate(() => {
        for (const image of document.querySelectorAll('img[data-external-preview="true"]')) image.loading = "eager";
      });
      await page.waitForFunction(
        () => [...document.querySelectorAll('img[data-external-preview="true"]')].every((image) => image.complete),
        null,
        { timeout: 20_000 },
      ).catch(() => {});
      const unresolved = await page.evaluate(() => [...document.querySelectorAll('img[data-external-preview="true"]')]
        .filter((image) => !image.complete || image.naturalWidth === 0)
        .length);
      if (unresolved === 0 || attempt === 1) break;
      await page.reload({ waitUntil: "domcontentloaded" });
    }
    await page.evaluate(async () => {
      const decodeWithTimeout = (image) => Promise.race([
        image.decode().catch(() => undefined),
        new Promise((resolve) => setTimeout(resolve, 5_000)),
      ]);
      await Promise.all([...document.querySelectorAll('img[data-external-preview="true"]')]
        .map(decodeWithTimeout));
    });
  }
  await page.waitForTimeout(500);

  const facts = await page.evaluate((storyTitles) => {
    const mainText = document.querySelector("main")?.innerText ?? "";
    const images = [...document.images];
    const isDeferredImage = (image) => image.loading === "lazy" && !image.complete;
    const isDeferredExternalPreview = (image) => image.loading === "lazy"
      && image.dataset.externalPreview === "true"
      && !image.complete;
    const headline = document.querySelector(".hero-copy h1");
    const headlineStyle = headline ? getComputedStyle(headline) : null;
    const headlineFontSize = headlineStyle ? Number.parseFloat(headlineStyle.fontSize) : null;
    const headlineLineHeight = headlineStyle ? Number.parseFloat(headlineStyle.lineHeight) : null;
    const viewportWidth = document.documentElement.clientWidth;
    const headings = [...document.querySelectorAll("h1, h2, h3")];
    const controls = [...document.querySelectorAll(".site-header a, .site-footer a, .publication-header a, .story-reader-header a, .issue-nav a, button")]
      .filter((control) => control.getClientRects().length > 0);
    return {
      main_text_length: mainText.length,
      missing_story_titles: storyTitles.filter((title) => !mainText.includes(title)),
      sources_and_dates: mainText.includes("Sources & Dates"),
      horizontal_overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      clipped_headings: headings.filter((heading) => {
        const rect = heading.getBoundingClientRect();
        return rect.left < -1 || rect.right > viewportWidth + 1 || heading.scrollWidth > heading.clientWidth + 1;
      }).map((heading) => heading.id || heading.textContent.trim().slice(0, 40)),
      controls_below_44px: controls.filter((control) => {
        const rect = control.getBoundingClientRect();
        return rect.width < 43.5 || rect.height < 43.5;
      }).map((control) => control.getAttribute("aria-label") || control.textContent.trim().slice(0, 40)),
      viewport_fit_cover: document.querySelector('meta[name="viewport"]')?.content.includes("viewport-fit=cover") ?? false,
      broken_images: images
        .filter((image) => image.dataset.externalPreview !== "true" && !isDeferredImage(image) && (!image.complete || image.naturalWidth === 0))
        .map((image) => image.currentSrc || image.src),
      deferred_external_previews: images
        .filter(isDeferredExternalPreview)
        .map((image) => image.currentSrc || image.src),
      external_preview_images: images
        .filter((image) => image.dataset.externalPreview === "true")
        .map((image) => ({
          url: image.currentSrc || image.src,
          settled: image.complete,
          loaded: image.complete && image.naturalWidth > 0,
        })),
      image_failed_frames: document.querySelectorAll("[data-visual-frame].image-failed").length,
      story_visual_count: document.querySelectorAll(".issue-story .story-figure").length,
      issue_index_is_native_disclosure: Boolean(document.querySelector(".issue-nav-panel > summary")),
      nested_scroll_frames: [...document.querySelectorAll("iframe[data-historical-frame]")].filter((frame) => frame.scrollHeight > frame.clientHeight + 50).length,
      reduced_motion_matches: matchMedia("(prefers-reduced-motion: reduce)").matches,
      headline_layout: headline ? {
        font_size: headlineFontSize,
        line_height: headlineLineHeight,
        line_height_ratio: headlineLineHeight / headlineFontSize,
        horizontal_overflow: Math.max(0, headline.scrollWidth - headline.clientWidth),
      } : null,
      archive_issue_links: document.querySelectorAll(".week-date-ledger a").length,
      archive_hidden_panels: [...document.querySelectorAll("[data-week-panel]")].filter((panel) => panel.hidden).length,
      archive_week_toggles: document.querySelectorAll("[data-week-toggle]").length,
    };
  }, manifest.stories.map((story) => story.title));

  if (testArchiveAccordion) {
    const toggles = page.locator("[data-week-toggle]");
    const count = await toggles.count();
    if (count) await toggles.first().click();
    facts.archive_accordion = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll("[data-week-toggle]")];
      if (!buttons.length) return { valid: true, available: false };
      const expanded = buttons.filter((button) => button.getAttribute("aria-expanded") === "true");
      const button = expanded[0];
      const panel = button ? document.getElementById(button.getAttribute("aria-controls")) : null;
      return {
        valid: expanded.length === 1 && Boolean(panel) && !panel.hidden && location.hash === `#${button.closest("[data-week-dossier]").id}`,
        available: true,
        expanded: expanded.length,
      };
    });
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
  return { facts, consoleErrors, requestFailures, externalPreviewFailures, render };
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
        { name: "compact-320x568", width: 320, height: 568, javaScriptEnabled: true, reducedMotion: false },
        { name: "mobile-390x844", width: 390, height: 844, javaScriptEnabled: true, reducedMotion: false },
        { name: "mobile-430x932", width: 430, height: 932, javaScriptEnabled: true, reducedMotion: false },
        { name: "tablet-768x1024", width: 768, height: 1024, javaScriptEnabled: true, reducedMotion: false },
        { name: "landscape-844x390", width: 844, height: 390, javaScriptEnabled: true, reducedMotion: false },
        { name: "no-js-390x844", width: 390, height: 844, javaScriptEnabled: false, reducedMotion: false },
        { name: "reduced-motion-1440x900", width: 1440, height: 900, javaScriptEnabled: true, reducedMotion: true },
        { name: "reduced-motion-390x844", width: 390, height: 844, javaScriptEnabled: true, reducedMotion: true },
        { name: "home-desktop-1440x900", width: 1440, height: 900, javaScriptEnabled: true, reducedMotion: false, urlPath: "" },
        { name: "home-mobile-390x844", width: 390, height: 844, javaScriptEnabled: true, reducedMotion: false, urlPath: "" },
        { name: "home-landscape-844x390", width: 844, height: 390, javaScriptEnabled: true, reducedMotion: false, urlPath: "" },
        { name: "story-mobile-390x844", width: 390, height: 844, javaScriptEnabled: true, reducedMotion: false, urlPath: `issues/${issueId}/stories/${staticResult.manifest.stories[0].id}/` },
        { name: "story-landscape-844x390", width: 844, height: 390, javaScriptEnabled: true, reducedMotion: false, urlPath: `issues/${issueId}/stories/${staticResult.manifest.stories[0].id}/` },
        { name: "archive-desktop-1440x900", width: 1440, height: 900, javaScriptEnabled: true, reducedMotion: false, urlPath: "archive/", testArchiveAccordion: true },
        { name: "archive-landscape-844x390", width: 844, height: 390, javaScriptEnabled: true, reducedMotion: false, urlPath: "archive/", testArchiveAccordion: true },
        { name: "archive-no-js-390x844", width: 390, height: 844, javaScriptEnabled: false, reducedMotion: false, urlPath: "archive/" },
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

      const capturePasses = (item) => item.facts.horizontal_overflow === 0
          && item.facts.clipped_headings.length === 0
          && item.facts.controls_below_44px.length === 0
          && item.facts.viewport_fit_cover
          && item.facts.broken_images.length === 0
          && item.facts.external_preview_images.every((image) => image.loaded
            || !image.settled
            || item.facts.deferred_external_previews.includes(image.url))
          && item.facts.image_failed_frames === 0
          && item.consoleErrors.length === 0
          && item.requestFailures.length === 0;
      const desktop = captures["desktop-1440x900"];
      checks.push(result("desktop_render", capturePasses(desktop), {
        ...desktop.facts,
        console_errors: desktop.consoleErrors,
        request_failures: desktop.requestFailures,
        external_preview_failures: desktop.externalPreviewFailures,
      }));

      const mobileNames = ["compact-320x568", "mobile-390x844", "mobile-430x932", "tablet-768x1024", "landscape-844x390", "home-landscape-844x390", "story-mobile-390x844", "story-landscape-844x390", "archive-landscape-844x390"];
      checks.push(result("mobile_render", mobileNames.every((name) => capturePasses(captures[name])), Object.fromEntries(mobileNames.map((name) => [name, {
        ...captures[name].facts,
        console_errors: captures[name].consoleErrors,
        request_failures: captures[name].requestFailures,
        external_preview_failures: captures[name].externalPreviewFailures,
      }]))));

      const reducedNames = ["reduced-motion-1440x900", "reduced-motion-390x844"];
      checks.push(result("reduced_motion_render", reducedNames.every((name) => captures[name].facts.reduced_motion_matches && capturePasses(captures[name])), Object.fromEntries(reducedNames.map((name) => [name, captures[name].facts]))));

      const headlineLayouts = [captures["home-desktop-1440x900"], captures["home-mobile-390x844"]]
        .map((item) => item.facts.headline_layout);
      const headlineOk = headlineLayouts.every((headline) => headline
        && headline.line_height_ratio >= 0.9
        && headline.horizontal_overflow === 0);
      checks.push(result("headline_layout", headlineOk, headlineLayouts));

      const shellCaptures = [captures["home-desktop-1440x900"], captures["home-mobile-390x844"], captures["home-landscape-844x390"], captures["archive-desktop-1440x900"], captures["archive-landscape-844x390"], captures["archive-no-js-390x844"], captures["historical-20-mobile-390x844"], captures["historical-21-mobile-390x844"], captures["historical-22-mobile-390x844"]].filter(Boolean);
      const shellOk = shellCaptures.every((item) => item.facts.horizontal_overflow === 0
        && item.facts.broken_images.length === 0
        && item.facts.image_failed_frames === 0
        && item.facts.nested_scroll_frames === 0
        && item.consoleErrors.length === 0
        && item.requestFailures.length === 0)
        && captures["home-desktop-1440x900"].facts.external_preview_images.every((image) => image.loaded)
        && captures["home-mobile-390x844"].facts.external_preview_images.every((image) => image.loaded)
        && captures["archive-desktop-1440x900"].facts.archive_accordion?.valid
        && captures["archive-no-js-390x844"].facts.archive_hidden_panels === 0
        && captures["archive-no-js-390x844"].facts.archive_issue_links === captures["archive-desktop-1440x900"].facts.archive_issue_links;
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
    for (const id of ["no_js_reading", "keyboard_focus", "desktop_render", "mobile_render", "reduced_motion_render", "headline_layout", "publication_shell_render"]) {
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
