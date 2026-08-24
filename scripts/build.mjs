import path from "node:path";
import { parseArgs } from "node:util";
import { buildSite } from "./lib/build.mjs";
import { stableJson } from "./lib/files.mjs";

const { values } = parseArgs({
  options: {
    issue: { type: "string" },
    source: { type: "string" },
    out: { type: "string" },
    "base-url": { type: "string" },
  },
});

const repoRoot = process.cwd();
const report = await buildSite({
  repoRoot,
  sourceRoot: values.source ? path.resolve(values.source) : undefined,
  outDir: values.out ? path.resolve(values.out) : undefined,
  issueId: values.issue,
  baseUrl: values["base-url"],
});

process.stdout.write(stableJson({
  status: "BUILT_NON_PRODUCTION",
  artifact_digest: report.artifact_digest,
  issues: report.issues.map(({ issue_id, candidate_digest, date_semantics }) => ({ issue_id, candidate_digest, date_semantics })),
}));
