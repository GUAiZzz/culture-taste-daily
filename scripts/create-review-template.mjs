import path from "node:path";
import { parseArgs } from "node:util";
import { readJson, stableJson, writeJson } from "./lib/files.mjs";
import { validateJsonFile } from "./lib/schema.mjs";

const { values } = parseArgs({
  options: {
    issue: { type: "string" },
    dist: { type: "string" },
    out: { type: "string" },
  },
});

const repoRoot = process.cwd();
const distDir = values.dist ? path.resolve(values.dist) : path.join(repoRoot, "dist");
const buildReport = await readJson(path.join(distDir, "build-report.json"));
const issueId = values.issue ?? buildReport.issues.at(-1)?.issue_id;
const issueReport = buildReport.issues.find((issue) => issue.issue_id === issueId);
if (!issueReport) throw new Error(`Build report has no issue ${issueId}`);
const outPath = values.out
  ? path.resolve(values.out)
  : path.join(repoRoot, ".stage4", "evidence", issueId, "editorial-visual-review.json");

const review = {
  schema_version: 1,
  kind: "editorial_visual_review",
  scope: "local_non_production",
  reviewer: { type: "human", name: "REPLACE_WITH_NAMED_HUMAN" },
  issue_id: issueId,
  candidate_digest: issueReport.candidate_digest,
  artifact_digest: buildReport.artifact_digest,
  reviewed_at: null,
  decision: "PENDING",
  checks: {
    editorial_truth_judgment: "PENDING",
    harrytone: "PENDING",
    cultural_appropriateness: "PENDING",
    image_rights_disposition: "PENDING",
    hierarchy: "PENDING",
    reference_integrity: "PENDING",
    visual_authorship: "PENDING",
    desktop_mobile_translation: "PENDING",
    historical_fidelity: "NOT_APPLICABLE",
  },
  comment: "Named human review is required. This template does not approve anything.",
};
await validateJsonFile(review, path.join(repoRoot, "schemas/editorial-review.schema.json"), "review template");
await writeJson(outPath, review);
process.stdout.write(stableJson({ status: "PENDING_REVIEW", review: path.relative(repoRoot, outPath).split(path.sep).join("/") }));
