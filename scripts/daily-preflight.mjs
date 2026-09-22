import path from "node:path";
import { parseArgs } from "node:util";
import { evaluateDailyPreflight } from "./lib/daily.mjs";
import { stableJson } from "./lib/files.mjs";

const { values } = parseArgs({
  options: {
    date: { type: "string" },
    now: { type: "string" },
  },
});

const now = values.now ? new Date(values.now) : new Date();
const report = await evaluateDailyPreflight({
  repoRoot: path.resolve(process.cwd()),
  now,
  issueDate: values.date,
});

process.stdout.write(stableJson(report));
if (report.status !== "READY_FOR_DRY_RUN") process.exitCode = 2;
