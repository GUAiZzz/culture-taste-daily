import path from 'node:path';
import { parseArgs } from 'node:util';
import { readJson, fileDigestMap, digestMap, writeJson } from './lib/files.mjs';
import { assertRepository } from './lib/github-scope.mjs';
import { SHA } from './lib/preview-policy.mjs';
const { values } = parseArgs({ options: { sha: { type: 'string' } } });
const identity = assertRepository();
if (!SHA.test(values.sha ?? '') || values.sha !== identity.head) throw new Error('SOURCE_COMMIT_MISMATCH');
const report = await readJson('dist/build-report.json');
let publication=null;
try {publication=await readJson('dist/production-release.json');} catch(error) {if(error.code!=='ENOENT')throw error;}
const files = await fileDigestMap(path.resolve('dist'));
delete files['preview-release.json'];
await writeJson('dist/preview-release.json', {
  schema_version: 1, kind: publication?'approved_publication_with_preview_archive':'non_production_preview_release', published_issue:publication?.latest_issue??null, approved_routes:publication?.routes??[], repository: identity.repository,
  source_commit: identity.head, latest_issue: report.archive_weeks.flatMap(week => week.issue_ids).sort().at(-1),
  artifact_digest: digestMap(files), files,
});
console.log(`Stamped verified site ${identity.head}`);
