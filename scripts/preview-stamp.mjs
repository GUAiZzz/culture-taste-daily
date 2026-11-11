import path from 'node:path';
import { parseArgs } from 'node:util';
import { readJson, fileDigestMap, digestMap, writeJson } from './lib/files.mjs';
import { assertRepository } from './lib/github-scope.mjs';
import { SHA } from './lib/preview-policy.mjs';
import { previewIssueMetadata } from './lib/preview-issue-metadata.mjs';
const { values } = parseArgs({ options: { sha: { type: 'string' } } });
const identity = assertRepository();
if (!SHA.test(values.sha ?? '') || values.sha !== identity.head) throw new Error('SOURCE_COMMIT_MISMATCH');
const report = await readJson('dist/build-report.json');
const metadata = previewIssueMetadata(await readJson('dist/content-index.json'));
const latestFormal = report.archive_weeks.flatMap(week => week.issue_ids).sort().at(-1);
if (latestFormal !== metadata.latest_formal_issue) throw new Error('PREVIEW_FORMAL_ISSUE_MISMATCH');
const files = await fileDigestMap(path.resolve('dist'));
delete files['preview-release.json'];
await writeJson('dist/preview-release.json', {
  schema_version: 1, kind: 'non_production_preview_release', repository: identity.repository,
  source_commit: identity.head, ...metadata,
  artifact_digest: digestMap(files), files,
});
console.log(`Stamped non-production Preview ${identity.head}`);
