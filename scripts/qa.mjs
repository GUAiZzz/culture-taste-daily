import path from "node:path";
import { parseArgs } from "node:util";
import { readJson, stableJson } from "./lib/files.mjs";
import { runTechnicalQa } from "./lib/qa.mjs";

const { values } = parseArgs({
  options: {
    issue: { type: "string" },
    dist: { type: "string" },
    evidence: { type: "string" },
    at: { type: "string" },
  },
});

const repoRoot = process.cwd();
const distDir = values.dist ? path.resolve(values.dist) : path.join(repoRoot, "dist");
const buildReport = await readJson(path.join(distDir, "build-report.json"));
const issueId = values.issue ?? buildReport.issues.at(-1)?.issue_id;
if (!issueId) throw new Error("No issue id supplied or available in build-report.json");
const evidenceDir = values.evidence
  ? path.resolve(values.evidence)
  : path.join(repoRoot, ".stage4", "evidence", issueId);

const evidence = await runTechnicalQa({ repoRoot, distDir, issueId, evidenceDir, createdAt: values.at });
process.stdout.write(stableJson({
  status: evidence.status,
  issue_id: evidence.issue_id,
  candidate_digest: evidence.candidate_digest,
  artifact_digest: evidence.artifact_digest,
  evidence: toRelative(path.join(evidenceDir, "technical-evidence.json")),
}));
if (evidence.status !== "PASS") process.exitCode = 1;

function toRelative(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}
