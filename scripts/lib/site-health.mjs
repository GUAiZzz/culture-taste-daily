import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { exists, readJson, writeJson } from "./files.mjs";
import { isAllowedHealthUrl, safePublicRequest } from "./health-url-safety.mjs";
import { parseStoryContent, validateReadingMedia } from "../../core/rooms/reading-content.mjs";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_RETRIES = 2;

function shanghaiDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function addTarget(targets, target) {
  if (!target.url || !/^https:\/\//i.test(target.url)) return;
  const key = `${target.expect}:${target.url}`;
  const existing = targets.get(key);
  if (existing) {
    existing.references.push(...target.references);
    return;
  }
  targets.set(key, { ...target, references: [...target.references] });
}

async function issueDates(repoRoot) {
  const root = path.join(repoRoot, "src", "issues");
  if (!(await exists(root))) return [];
  return (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && DATE_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

async function optionalObject(file) {
  let value;
  try { value = await readJson(file); }
  catch (error) { if (error.code === "ENOENT") return {}; throw error; }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid reading media metadata object");
  return value;
}

// Shared by health inventory and the guarded release. A displayed inline image
// cannot bypass the dated source/media attestation merely by living outside the
// locked issue manifest. Reuse the renderer's exact provenance/body validation.
export async function collectIssueReadingMedia({ repoRoot, issueDate, manifest }) {
  if (!DATE_PATTERN.test(issueDate) || manifest?.issue_id !== issueDate) throw new Error("Reading media issue identity mismatch");
  const [central, local, corrections] = await Promise.all([
    optionalObject(path.join(repoRoot, "core", "rooms", "reading-media.json")),
    optionalObject(path.join(repoRoot, "src", "issues", issueDate, "reading-media.public.json")),
    optionalObject(path.join(repoRoot, "core", "rooms", "media-corrections.json")),
  ]);
  const stories = manifest.stories ?? [];
  for (const key of Object.keys(central)) {
    if (!/^\d{4}-\d{2}-\d{2}\/[a-z0-9-]+$/.test(key)) throw new Error("Invalid central reading media key");
    if (key.startsWith(`${issueDate}/`) && !stories.some(story => key === `${issueDate}/${story.id}`)) throw new Error("Unknown central reading media story");
  }
  for (const key of Object.keys(local)) {
    if (!stories.some(story => key === story.id || key === `${issueDate}/${story.id}`)) throw new Error("Unknown issue reading media story");
  }
  const declared = stories.map((story, index) => {
    const key = `${issueDate}/${story.id}`;
    const definitions = [
      Object.hasOwn(central, key) ? central[key] : undefined,
      Object.hasOwn(local, story.id) ? local[story.id] : undefined,
      Object.hasOwn(local, key) ? local[key] : undefined,
    ].filter(value => value !== undefined);
    if (definitions.length > 1) throw new Error(`Conflicting reading media ${key}`);
    if (definitions.length && !Array.isArray(definitions[0])) throw new Error(`Invalid reading media for ${story.id}`);
    return { story, index, key, rows: definitions[0] ?? [] };
  });
  if (!declared.some(item => item.rows.length)) return [];
  const content = await readFile(path.join(repoRoot, "src", "issues", issueDate, "content.md"), "utf8");
  const sections = content.split(/^## /m).slice(1);
  return declared.flatMap(({ story, index, key, rows }) => {
    if (!rows.length) return [];
    const section = sections[index], newline = section?.indexOf("\n");
    if (newline === undefined || newline < 0 || section.slice(0, newline).trim() !== story.title) throw new Error(`Reading media section mismatch ${key}`);
    const parsed = parseStoryContent(section.slice(newline + 1).trim(), story.english);
    const correction = corrections[key];
    const media = correction ? { ...story.media, external_image_url: correction.external_image_url, alt: correction.alt, origin_url: correction.origin_url } : story.media;
    return validateReadingMedia(rows, { ...story, ...parsed, media }).map(row => ({ ...row, issue_id: issueDate, story_id: story.id }));
  });
}

export async function collectIssueReleaseUrls({ repoRoot, issueDate, manifest, radar }) {
  const readingMedia = await collectIssueReadingMedia({ repoRoot, issueDate, manifest });
  return {
    source_urls: [...new Set([
      ...manifest.stories.flatMap(story => story.sources.map(source => source.url)),
      ...radar.items.filter(item => !item.included_story_id).map(item => item.official_url),
      ...readingMedia.map(image => image.origin_url),
    ])],
    media_urls: [...new Set([
      ...manifest.stories.map(story => story.media?.external_image_url),
      ...radar.items.flatMap(item => [item.media?.url, item.media?.poster_url]),
      ...readingMedia.map(image => image.external_image_url),
    ].filter(Boolean))],
  };
}

export async function collectPublicHealthTargets({ repoRoot, scope = "weekly", issueDate } = {}) {
  if (!repoRoot) throw new Error("repoRoot is required");
  if (!["daily", "weekly"].includes(scope)) throw new Error("scope must be daily or weekly");
  const availableDates = await issueDates(repoRoot);
  const targetDate = issueDate ?? shanghaiDate();
  const dates = scope === "daily" ? availableDates.filter((date) => date === targetDate) : availableDates;
  if (scope === "daily" && dates.length === 0) throw new Error(`No public issue source exists for ${targetDate}`);

  const targets = new Map();
  for (const date of dates) {
    const issueRoot = path.join(repoRoot, "src", "issues", date);
    const manifest = await readJson(path.join(issueRoot, "issue-manifest.public.json"));
    if (scope === "weekly" && manifest.visibility === "future_draft") continue;

    for (const story of manifest.stories ?? []) {
      for (const source of story.sources ?? []) {
        addTarget(targets, {
          id: `${date}:${story.id}:source`,
          kind: "official_or_editorial_page",
          expect: "page",
          url: source.url,
          references: [{ issue_id: date, story_id: story.id, field: "sources.url" }],
        });
      }
      if (story.media?.origin_url) {
        addTarget(targets, {
          id: `${date}:${story.id}:origin`,
          kind: "official_origin_page",
          expect: "page",
          url: story.media.origin_url,
          references: [{ issue_id: date, story_id: story.id, field: "media.origin_url" }],
        });
      }
      if (story.media?.external_image_url) {
        addTarget(targets, {
          id: `${date}:${story.id}:image`,
          kind: "official_image",
          expect: "image",
          url: story.media.external_image_url,
          references: [{ issue_id: date, story_id: story.id, field: "media.external_image_url" }],
        });
      }
    }

    for (const image of await collectIssueReadingMedia({ repoRoot, issueDate: date, manifest })) {
      addTarget(targets, {
        id: `${date}:${image.story_id}:inline-origin`, kind: "official_origin_page", expect: "page", url: image.origin_url,
        references: [{ issue_id: date, story_id: image.story_id, field: "reading_media.origin_url" }],
      });
      addTarget(targets, {
        id: `${date}:${image.story_id}:inline-image`, kind: "official_image", expect: "image", url: image.external_image_url,
        references: [{ issue_id: date, story_id: image.story_id, field: "reading_media.external_image_url" }],
      });
    }

    const ordinaryPath = path.join(issueRoot, "daily-radar.public.json");
    const radarPath = await exists(ordinaryPath) ? ordinaryPath : path.join(issueRoot, "retrospective-index.public.json");
    if (await exists(radarPath)) {
      const radar = await readJson(radarPath);
      for (const item of radar.items ?? []) {
        if (item.official_url) {
          addTarget(targets, {
            id: `${date}:${item.id}:radar-origin`,
            kind: "radar_official_page",
            expect: "page",
            url: item.official_url,
            references: [{ issue_id: date, radar_id: item.id, field: "official_url" }],
          });
        }
        if (item.media?.url) {
          addTarget(targets, {
            id: `${date}:${item.id}:radar-media`,
            kind: item.media.kind === "video" ? "official_video_page" : "official_image",
            expect: item.media.kind === "video" ? "page" : "image",
            url: item.media.url,
            references: [{ issue_id: date, radar_id: item.id, field: "media.url" }],
          });
        }
        if (item.media?.poster_url) {
          addTarget(targets, {
            id: `${date}:${item.id}:radar-poster`,
            kind: "official_video_poster",
            expect: "image",
            url: item.media.poster_url,
            references: [{ issue_id: date, radar_id: item.id, field: "media.poster_url" }],
          });
        }
      }
    }
  }
  return { issue_dates: dates, targets: [...targets.values()] };
}

function acceptableContentType(expect, value) {
  if (expect !== "image") return true;
  const contentType = String(value ?? "").toLowerCase();
  return contentType.startsWith("image/") || contentType.startsWith("application/octet-stream");
}

export async function probeHealthTarget(target, {
  request = safePublicRequest,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retries = DEFAULT_RETRIES,
} = {}) {
  const attempts = [];
  if (!isAllowedHealthUrl(target.url)) return { ...target, url: '[blocked]', status: 'REVIEW_REQUIRED',
    attempts: [{ attempt: 0, ok: false, status: null, final_url: null, content_type: '', error: 'UNSAFE_TARGET_BLOCKED' }] };
  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await request(target.url, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: target.expect === "image" ? "image/avif,image/webp,image/*,*/*;q=0.8" : "text/html,application/xhtml+xml,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.8,zh-CN;q=0.6",
          "User-Agent": "CultureTasteDailyHealth/1.0 (+https://guaizzz.github.io/culture-taste-daily/)",
          ...(target.expect === "image" ? { Range: "bytes=0-2047" } : {}),
        },
      });
      // Keep only the media type; never echo arbitrary remote header parameters.
      const contentType = String(response.headers?.get?.("content-type") ?? "")
        .match(/^[a-z0-9.+-]+\/[a-z0-9.+-]+/i)?.[0] ?? "";
      const redirected = response.status >= 300 && response.status < 400;
      const responseOriginMismatch = response.url && new URL(response.url).origin !== new URL(target.url).origin;
      const ok = !redirected && !responseOriginMismatch && response.status >= 200 && response.status < 300 && acceptableContentType(target.expect, contentType);
      attempts.push({
        attempt,
        ok,
        status: response.status,
        final_url: responseOriginMismatch || redirected ? null : target.url,
        content_type: contentType,
        error: ok ? null : redirected || responseOriginMismatch ? 'REDIRECT_REVIEW_REQUIRED' : target.expect === "image" && !acceptableContentType(target.expect, contentType)
          ? `expected image content-type, received ${contentType || "unknown"}`
          : `HTTP ${response.status}`,
      });
      await response.body?.cancel?.().catch(() => {});
      if (ok) return { ...target, status: "PASS", attempts };
      if (redirected || responseOriginMismatch) return { ...target, status: 'REVIEW_REQUIRED', attempts };
    } catch (error) {
      attempts.push({
        attempt,
        ok: false,
        status: null,
        final_url: target.url,
        content_type: "",
        error: error?.name === "AbortError" ? `timeout after ${timeoutMs}ms` : 'CONNECTION_OR_DNS_ERROR',
      });
    } finally {
      clearTimeout(timer);
    }
  }
  const last = attempts.at(-1);
  const accessLimited = target.expect === "page" && (
    [401, 403, 429].includes(last?.status)
    || (last?.status >= 500 && last?.status <= 599)
    || last?.status === null
  );
  return { ...target, status: accessLimited ? "REVIEW_REQUIRED" : "FAIL", attempts };
}

async function mapWithConcurrency(items, limit, worker) {
  const output = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next;
      next += 1;
      output[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return output;
}

export async function runPublicSourceHealth({
  repoRoot,
  scope = "weekly",
  issueDate,
  checkedAt = new Date().toISOString(),
  request = safePublicRequest,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retries = DEFAULT_RETRIES,
  concurrency = 4,
  reportPath,
} = {}) {
  const collected = await collectPublicHealthTargets({ repoRoot, scope, issueDate });
  let checks = await mapWithConcurrency(collected.targets, concurrency, (target) => probeHealthTarget(target, {
    request,
    timeoutMs,
    retries,
  }));
  const failures = checks.filter((check) => check.status === "FAIL");
  const reviewRequired = checks.filter((check) => check.status === "REVIEW_REQUIRED");
  const report = {
    schema_version: 1,
    kind: "public_source_health",
    scope,
    checked_at: checkedAt,
    issue_dates: collected.issue_dates,
    status: failures.length > 0 ? "BLOCKED" : reviewRequired.length > 0 ? "REVIEW_REQUIRED" : "PASS",
    target_count: checks.length,
    failure_count: failures.length,
    review_required_count: reviewRequired.length,
    failures: failures.map((failure) => ({
      id: failure.id,
      kind: failure.kind,
      url: failure.url,
      references: failure.references,
      last_attempt: failure.attempts.at(-1),
    })),
    review_required: reviewRequired.map((review) => ({
      id: review.id,
      kind: review.kind,
      url: review.url,
      references: review.references,
      last_attempt: review.attempts.at(-1),
      fallback: review.fallback ?? null,
    })),
    checks,
    limitations: [
      "This availability check verifies public routes and media responses without following redirects; it does not grant image usage rights.",
      "A passing response does not replace source reading, editorial review, or the first-party provenance gate.",
      "A failure blocks the automated candidate or weekly health result but never changes the current website.",
      "Automatic browser fallback is disabled. A REVIEW_REQUIRED route needs separate controlled review before the candidate may proceed.",
    ],
  };
  if (reportPath) await writeJson(reportPath, report);
  return report;
}
