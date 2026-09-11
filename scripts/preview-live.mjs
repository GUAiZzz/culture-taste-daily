import { parseArgs } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { REPOSITORY, SHA, DIGEST } from './lib/preview-policy.mjs';
import { digestMap } from './lib/files.mjs';
import { createLiveTransport } from './lib/live-transport.mjs';
const { values } = parseArgs({ options: { sha: { type: 'string' }, date: { type: 'string' } } });
if (!SHA.test(values.sha ?? '')) throw new Error('An exact --sha is required');
const origin = 'https://guaizzz.github.io/culture-taste-daily/';
const transport = createLiveTransport();
const get = transport.get;
try {
let stamp;
for(let attempt=0;attempt<8;attempt++){
 stamp=JSON.parse((await get('preview-release.json')).toString('utf8'));
 if(stamp.source_commit===values.sha)break;
 if(attempt<7)await new Promise(resolve=>setTimeout(resolve,5000));
}
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
  const formal=(stamp.approved_routes??[]).includes(file);
  if ((formal ? !bytes.toString().includes('PUBLISHED EDITION') || /noindex/.test(bytes.toString()) : !/noindex/.test(bytes.toString())) || !bytes.toString().includes(file==='index.html'&&stamp.published_issue?stamp.published_issue:date)) throw new Error(`LIVE_PREVIEW_LABEL_OR_DATE ${file}`);
}
if(stamp.published_issue){
 const descriptorBytes=await get('production-release.json');
 if(createHash('sha256').update(descriptorBytes).digest('hex')!==stamp.files['production-release.json'])throw Error('LIVE_PUBLICATION_IDENTITY');
 const publication=JSON.parse(descriptorBytes);
 if(publication.latest_issue!==stamp.published_issue)throw Error('LIVE_APPROVED_DATE');
 for(const asset of publication.media){
  if(stamp.files[asset.path]!==asset.sha256)throw Error('LIVE_ASSET_REGISTRY');
  if(createHash('sha256').update(await get(asset.path)).digest('hex')!==asset.sha256)throw Error('LIVE_OFFICIAL_IMAGE '+asset.path);
 }
}
const receipt = { state: stamp.published_issue?'PUBLICATION_DEPLOYED':'PREVIEW_DEPLOYED', published_issue:stamp.published_issue??null, production_eligible: Boolean(stamp.published_issue), source_commit: values.sha,
  artifact_digest: stamp.artifact_digest, date, verified_at: new Date().toISOString(), routes: targets, origin,
  transport_fallbacks: transport.events };
await mkdir('.stage4/operations', { recursive: true });
await writeFile('.stage4/operations/live.json', JSON.stringify(receipt, null, 2)+'\n');
console.log(JSON.stringify(receipt, null, 2));
} finally { await transport.close(); }
