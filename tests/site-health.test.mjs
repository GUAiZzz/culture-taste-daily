import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { collectPublicHealthTargets, probeHealthTarget, runPublicSourceHealth } from "../scripts/lib/site-health.mjs";
import { createPublicLookup, isAllowedHealthUrl, isPublicAddress, safePublicRequest } from '../scripts/lib/health-url-safety.mjs';

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

test("automatic browser fallback remains disabled for restricted pages", async () => {
  let fallbackCalls = 0;
  const report = await runPublicSourceHealth({
    repoRoot,
    scope: "daily",
    issueDate: "2026-08-25",
    request: async (url) => response({ status: 403, url }),
    retries: 0,
    fallbackProbe: async (target) => { fallbackCalls += 1; return { ok: true, status: 200, final_url: target.url }; },
  });
  assert.notEqual(report.status, "PASS");
  assert.ok(report.checks.some(check => check.status === 'REVIEW_REQUIRED'));
  assert.equal(fallbackCalls, 0);
});

test('redirects are never followed or promoted to PASS, and destinations are not printed', async () => {
  const target = { id:'source', kind:'official_origin_page', expect:'page', url:'https://official.example/source', references:[] };
  let calls = 0;
  const result = await probeHealthTarget(target, { retries: 2, request: async (url, options) => {
    calls++; assert.equal(options.redirect, 'manual');
    return { status:302, url, headers:{ get: name => name === 'location' ? 'https://192.168.20.5/synthetic-secret' : 'text/html' }, body:{ cancel:async()=>{} } };
  } });
  assert.equal(calls,1); assert.equal(result.status,'REVIEW_REQUIRED');
  assert.doesNotMatch(JSON.stringify(result), /192\.168|synthetic-secret/);
});

test('cross-origin final responses cannot be accepted even if a request implementation follows a redirect', async () => {
  const target = { id:'source', kind:'official_origin_page', expect:'page', url:'https://official.example/source', references:[] };
  const result = await probeHealthTarget(target, { retries:0, request:async()=>response({url:'https://other.example/synthetic-secret'}) });
  assert.equal(result.status,'REVIEW_REQUIRED'); assert.doesNotMatch(JSON.stringify(result), /other\.example|synthetic-secret/);
});

test('nonpublic and internal URL targets are stopped before a request and masked in output', async () => {
  for (const url of ['https://127.0.0.1/secret', 'https://10.2.3.4/secret', 'https://[::1]/secret', 'https://intranet.example/secret', 'https://office-sec.example/secret', 'https://network.corp/secret', 'https://localhost/secret', 'https://public.example/?token=secret']) {
    let calls=0; const target={id:'source',kind:'official_origin_page',expect:'page',url,references:[]};
    const result=await probeHealthTarget(target,{retries:0,request:async()=>{calls++;return response();}});
    assert.equal(calls,0); assert.equal(result.status,'REVIEW_REQUIRED'); assert.equal(result.url,'[blocked]');
    assert.doesNotMatch(JSON.stringify(result),/secret/);
  }
  assert.equal(isAllowedHealthUrl('https://public.example/path'),true);
  assert.equal(isAllowedHealthUrl('https://corp.asics.com/en/press/article'),true);
  assert.equal(isPublicAddress('127.0.0.1'),false);
  assert.equal(isPublicAddress('fc00::1'),false);
  assert.equal(isPublicAddress('8.8.8.8'),true);
});

test('DNS results are bound to the connection and any nonpublic answer blocks lookup', async () => {
  const run = records => new Promise(resolve => createPublicLookup((host, options, callback) => callback(null, records))('public.example', {all:true}, (error, addresses) => resolve({error,addresses})));
  const blocked=await run([{address:'8.8.8.8',family:4},{address:'10.2.3.4',family:4}]);
  assert.equal(blocked.error.code,'HEALTH_DNS_UNAVAILABLE_OR_NONPUBLIC');
  const allowed=await run([{address:'8.8.8.8',family:4}]);
  assert.equal(allowed.error,null); assert.deepEqual(allowed.addresses,[{address:'8.8.8.8',family:4}]);
});

test('direct transport also rejects a private target before opening a socket', async () => {
  await assert.rejects(safePublicRequest('https://127.0.0.1/'), /UNSAFE_TARGET_BLOCKED/);
});
