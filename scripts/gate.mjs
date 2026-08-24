import path from "node:path";
import { parseArgs } from "node:util";
import { exists, readJson, stableJson } from "./lib/files.mjs";
import { writeGateDecision } from "./lib/gate.mjs";

const { values } = parseArgs({
  options: {
    issue: { type: "string" },
    dist: { type: "string" },
    technical: { type: "string" },
    review: { type: "string" },
    out: { type: "string" },
    "previous-good": { type: "string" },
  },
});

const repoRoot = process.cwd();
const distDir = values.dist ? path.resolve(values.dist) : path.join(repoRoot, "dist");
const buildReport = await readJson(path.join(distDir, "build-report.json"));
const issueId = values.issue ?? buildReport.issues.at(-1)?.issue_id;
if (!issueId) throw new Error("No issue id supplied or available in build-report.json");
const technicalPath = values.technical
  ? path.resolve(values.technical)
  : path.join(repoRoot, ".stage4", "evidence", issueId, "technical-evidence.json");
const reviewPath = values.review
  ? path.resolve(values.review)
  : path.join(repoRoot, ".stage4", "evidence", issueId, "editorial-visual-review.json");
const outPath = values.out
  ? path.resolve(values.out)
  : path.join(repoRoot, ".stage4", "evidence", issueId, "gate-decision.json");

const technicalEvidence = (await exists(technicalPath)) ? await readJson(technicalPath) : null;
const reviewEvidence = (await exists(reviewPath)) ? await readJson(reviewPath) : null;
const decision = await writeGateDecision({
  repoRoot,
  distDir,
  issueId,
  technicalEvidence,
  reviewEvidence,
  previousGoodRelease: values["previous-good"] ?? null,
  outPath,
});
process.stdout.write(stableJson(decision));
if (decision.decision === "BLOCKED") process.exitCode = 1;
