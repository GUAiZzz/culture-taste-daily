import path from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright";
import { stableJson } from "./lib/files.mjs";
import { runPublicSourceHealth } from "./lib/site-health.mjs";

const { values } = parseArgs({
  options: {
    scope: { type: "string", default: "weekly" },
    date: { type: "string" },
    timeout: { type: "string", default: "12000" },
    retries: { type: "string", default: "2" },
    report: { type: "string" },
  },
});

if (!["daily", "weekly"].includes(values.scope)) throw new Error("--scope must be daily or weekly");
if (values.scope === "daily" && !values.date) throw new Error("--date is required for daily health checks");

const repoRoot = process.cwd();
const reportPath = values.report
  ? path.resolve(values.report)
  : path.join(repoRoot, ".stage4", "health", `${values.scope}-${values.date ?? "all"}.json`);
let browser;
let context;
async function browserFallback(target) {
  if (!browser) {
    try {
      browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome" });
    } catch {
      browser = await chromium.launch({ headless: true });
    }
    context = await browser.newContext({ locale: "zh-CN" });
  }
  const page = await context.newPage();
  try {
    const response = await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: Math.max(20_000, Number(values.timeout)) });
    const status = response?.status() ?? null;
    if (target.expect === "image") {
      await page.waitForFunction(() => {
        const image = document.images[0];
        return Boolean(image?.complete && image.naturalWidth > 0);
      }, null, { timeout: 15_000 });
      const dimensions = await page.evaluate(() => ({ width: document.images[0]?.naturalWidth ?? 0, height: document.images[0]?.naturalHeight ?? 0 }));
      return { ok: dimensions.width > 0 && dimensions.height > 0 && (status === null || status < 400), status, final_url: page.url(), dimensions };
    }
    await page.waitForFunction(() => (document.body?.innerText?.trim().length ?? 0) > 40, null, { timeout: 15_000 });
    const title = await page.title();
    const text_length = await page.evaluate(() => document.body?.innerText?.trim().length ?? 0);
    return { ok: text_length > 40 && (status === null || status < 400), status, final_url: page.url(), title, text_length };
  } finally {
    await page.close();
  }
}

let report;
try {
  report = await runPublicSourceHealth({
    repoRoot,
    scope: values.scope,
    issueDate: values.date,
    timeoutMs: Number(values.timeout),
    retries: Number(values.retries),
    fallbackProbe: browserFallback,
    reportPath,
  });
} finally {
  await context?.close();
  await browser?.close();
}

process.stdout.write(stableJson({
  status: report.status,
  scope: report.scope,
  issue_dates: report.issue_dates,
  target_count: report.target_count,
  failure_count: report.failure_count,
  review_required_count: report.review_required_count,
  failures: report.failures,
  review_required: report.review_required,
  report: path.relative(repoRoot, reportPath).split(path.sep).join("/"),
}));
if (report.status === "BLOCKED") process.exitCode = 1;
if (report.status === "REVIEW_REQUIRED") process.exitCode = 2;
