import { parseArgs } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { REPOSITORY, SHA, DIGEST } from './lib/preview-policy.mjs';
import { digestMap } from './lib/files.mjs';
const { values } = parseArgs({ options: { sha: { type: 'string' }, date: { type: 'string' } } });
if (!SHA.test(values.sha ?? '')) throw new Error('An exact --sha is required');
const origin = 'https://guaizzz.github.io/culture-taste-daily/';
async function get(file) {
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(new URL(file, origin), { signal: AbortSignal.timeout(20000), cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) { last = error; if (attempt < 2) await new Promise(resolve => setTimeout(resolve, [2000, 8000][attempt])); }
  }
  throw new Error(`LIVE_ROUTE_UNAVAILABLE ${file}: ${last.message}`);
}
const stamp = JSON.parse((await get('preview-release.json')).toString('utf8'));
if (stamp.repository !== REPOSITORY || stamp.source_commit !== values.sha || !DIGEST.test(stamp.artifact_digest ?? '')) throw new Error('LIVE_IDENTITY_MISMATCH');
if (!stamp.files || typeof stamp.files !== 'object' || Array.isArray(stamp.files) || digestMap(stamp.files) !== stamp.artifact_digest) throw new Error('LIVE_MANIFEST_DIGEST_MISMATCH');
if (Object.keys(stamp.files).some(file => file.includes('..') || file.startsWith('/') || file.includes('\\') || !DIGEST.test(stamp.files[file]))) throw new Error('LIVE_FILE_SCOPE');
const date = values.date ?? stamp.latest_issue;
if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || (values.date && stamp.latest_issue !== values.date)) throw new Error('LIVE_DATE_MISMATCH');
const stories = Object.keys(stamp.files).filter(file => file.startsWith(`issues/${date}/stories/`) && file.endsWith('/index.html'));
if (!stories.length) throw new Error('LIVE_STORIES_MISSING');
const targets = ['index.html', 'archive/index.html', `issues/${date}/index.html`, ...stories];
for (const file of targets) {
  const bytes = await get(file);
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== stamp.files[file]) throw new Error(`LIVE_CONTENT_MISMATCH ${file}`);
  if (!/noindex/.test(bytes.toString()) || !bytes.toString().includes(date)) throw new Error(`LIVE_PREVIEW_LABEL_OR_DATE ${file}`);
}
const receipt = { state: 'PREVIEW_DEPLOYED', production_eligible: false, source_commit: values.sha,
  artifact_digest: stamp.artifact_digest, date, verified_at: new Date().toISOString(), routes: targets, origin };
await mkdir('.stage4/operations', { recursive: true });
await writeFile('.stage4/operations/live.json', JSON.stringify(receipt, null, 2)+'\n');
console.log(JSON.stringify(receipt, null, 2));
