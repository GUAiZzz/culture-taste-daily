import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { collectPublicHealthTargets, probeHealthTarget, runPublicSourceHealth } from "../scripts/lib/site-health.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function response({ status = 200, contentType = "text/html", url = "https://official.example/final" } = {}) {
  return {
    status,
    url,
    headers: { get: (name) => name.toLowerCase() === "content-type" ? contentType : null },
    body: { cancel: async () => {} },
  };
}

test("daily health inventory includes official pages, story images, radar media, and video posters", async () => {
  const inventory = await collectPublicHealthTargets({ repoRoot, scope: "daily", issueDate: "2026-08-25" });
  assert.deepEqual(inventory.issue_dates, ["2026-08-25"]);
  assert.equal(inventory.targets.filter((target) => target.kind === "official_image").length >= 9, true);
  assert.ok(inventory.targets.some((target) => target.kind === "official_video_page"));
  assert.ok(inventory.targets.some((target) => target.kind === "official_video_poster"));
  assert.ok(inventory.targets.every((target) => target.url.startsWith("https://")));
});

test("image health requires a successful image response", async () => {
  const target = { id: "image", kind: "official_image", expect: "image", url: "https://official.example/image", references: [] };
  const passed = await probeHealthTarget(target, { request: async () => response({ contentType: "image/jpeg" }), retries: 0 });
  assert.equal(passed.status, "PASS");
  const failed = await probeHealthTarget(target, { request: async () => response({ contentType: "text/html" }), retries: 0 });
  assert.equal(failed.status, "FAIL");
  assert.match(failed.attempts[0].error, /expected image content-type/);
});

test("anti-bot and transient page failures require browser review instead of impersonating a dead route", async () => {
  const target = { id: "page", kind: "official_origin_page", expect: "page", url: "https://official.example/page", references: [] };
  const blockedByBot = await probeHealthTarget(target, { request: async () => response({ status: 403 }), retries: 0 });
  assert.equal(blockedByBot.status, "REVIEW_REQUIRED");
  const actuallyMissing = await probeHealthTarget(target, { request: async () => response({ status: 404 }), retries: 0 });
  assert.equal(actuallyMissing.status, "FAIL");
});

test("health checks retry transient failures and fail closed without changing public source", async () => {
  let calls = 0;
  const recovered = await probeHealthTarget(
    { id: "page", kind: "official_origin_page", expect: "page", url: "https://official.example/page", references: [] },
    {
      request: async () => {
        calls += 1;
        if (calls === 1) throw new Error("temporary network failure");
        return response();
      },
      retries: 1,
    },
  );
  assert.equal(recovered.status, "PASS");
  assert.equal(recovered.attempts.length, 2);

  const report = await runPublicSourceHealth({
    repoRoot,
    scope: "daily",
    issueDate: "2026-08-25",
    request: async (url) => url.includes("tmc.taipei") ? response({ status: 503, url }) : response({ contentType: url.includes(".jpg") || url.includes(".png") || url.includes("shopify") || url.includes("bynder") || url.includes("cloudfront") || url.includes("shgcdn") || url.includes("ytimg") || url.includes("squarespace") || url.includes("vancleef") ? "image/jpeg" : "text/html", url }),
    retries: 0,
  });
  assert.equal(report.status, "BLOCKED");
  assert.ok(report.failure_count >= 1);
  assert.ok(report.limitations.some((item) => item.includes("never changes the current website")));
});

test("browser fallback can distinguish anti-bot responses from a dead public route", async () => {
  const report = await runPublicSourceHealth({
    repoRoot,
    scope: "daily",
    issueDate: "2026-08-25",
    request: async (url) => response({ status: 403, url }),
    retries: 0,
    fallbackProbe: async (target) => ({ ok: true, status: 200, final_url: target.url }),
  });
  assert.equal(report.status, "PASS");
  assert.ok(report.checks.every((check) => check.access_method === "browser_fallback"));
});
