import path from "node:path";
import { parseArgs } from "node:util";
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
const report = await runPublicSourceHealth({
    repoRoot,
    scope: values.scope,
    issueDate: values.date,
    timeoutMs: Number(values.timeout),
    retries: Number(values.retries),
    reportPath,
  });

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
