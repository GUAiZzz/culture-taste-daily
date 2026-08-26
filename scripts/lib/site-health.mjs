import { readdir } from "node:fs/promises";
import path from "node:path";
import { exists, readJson, writeJson } from "./files.mjs";

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

    const radarPath = path.join(issueRoot, "daily-radar.public.json");
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
  request = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retries = DEFAULT_RETRIES,
} = {}) {
  const attempts = [];
  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await request(target.url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          Accept: target.expect === "image" ? "image/avif,image/webp,image/*,*/*;q=0.8" : "text/html,application/xhtml+xml,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.8,zh-CN;q=0.6",
          "User-Agent": "CultureTasteDailyHealth/1.0 (+https://guaizzz.github.io/culture-taste-daily/)",
          ...(target.expect === "image" ? { Range: "bytes=0-2047" } : {}),
        },
      });
      const contentType = response.headers?.get?.("content-type") ?? "";
      const ok = response.status >= 200 && response.status < 400 && acceptableContentType(target.expect, contentType);
      attempts.push({
        attempt,
        ok,
        status: response.status,
        final_url: response.url || target.url,
        content_type: contentType,
        error: ok ? null : target.expect === "image" && !acceptableContentType(target.expect, contentType)
          ? `expected image content-type, received ${contentType || "unknown"}`
          : `HTTP ${response.status}`,
      });
      await response.body?.cancel?.().catch(() => {});
      if (ok) return { ...target, status: "PASS", attempts };
    } catch (error) {
      attempts.push({
        attempt,
        ok: false,
        status: null,
        final_url: target.url,
        content_type: "",
        error: error?.name === "AbortError" ? `timeout after ${timeoutMs}ms` : String(error?.message ?? error),
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
  request = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retries = DEFAULT_RETRIES,
  concurrency = 4,
  fallbackProbe,
  reportPath,
} = {}) {
  const collected = await collectPublicHealthTargets({ repoRoot, scope, issueDate });
  let checks = await mapWithConcurrency(collected.targets, concurrency, (target) => probeHealthTarget(target, {
    request,
    timeoutMs,
    retries,
  }));
  if (fallbackProbe) {
    checks = await mapWithConcurrency(checks, 1, async (check) => {
      if (!['FAIL', 'REVIEW_REQUIRED'].includes(check.status)) return check;
      try {
        const fallback = await fallbackProbe(check);
        return fallback?.ok
          ? { ...check, status: "PASS", access_method: "browser_fallback", fallback }
          : { ...check, access_method: "browser_fallback_failed", fallback: fallback ?? { ok: false, error: "no fallback result" } };
      } catch (error) {
        return { ...check, access_method: "browser_fallback_failed", fallback: { ok: false, error: String(error?.message ?? error) } };
      }
    });
  }
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
      "This availability check verifies public routes and media responses, using a real-browser fallback when direct requests are blocked; it does not grant image usage rights.",
      "A passing response does not replace source reading, editorial review, or the first-party provenance gate.",
      "A failure blocks the automated candidate or weekly health result but never changes the current website.",
      "A REVIEW_REQUIRED page is protected by anti-bot controls or a transient network limit and must be opened in an interactive browser before the candidate may proceed.",
    ],
  };
  if (reportPath) await writeJson(reportPath, report);
  return report;
}
