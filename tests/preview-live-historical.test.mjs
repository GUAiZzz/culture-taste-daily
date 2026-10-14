import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { digestMap } from '../scripts/lib/files.mjs';

const script = fileURLToPath(new URL('../scripts/preview-live.mjs', import.meta.url));
const sha = 'a'.repeat(40), oldDate = '2026-09-12', latest = '2026-09-22';
async function fixture(action) {
  const dir = await mkdtemp(path.join(tmpdir(), 'ctd-historical-live-test-'));
  try {
    const contents = {
      'index.html': `noindex current ${latest}`,
      'archive/index.html': `noindex archive ${oldDate} ${latest}`,
      [`issues/${oldDate}/index.html`]: `noindex ${oldDate} retrospective issue`,
      [`issues/${oldDate}/stories/one/index.html`]: `noindex ${oldDate} complete article one`,
      [`issues/${oldDate}/stories/two/index.html`]: `noindex ${oldDate} complete article two`,
    };
    const files = Object.fromEntries(Object.entries(contents).map(([file, bytes]) => [file, createHash('sha256').update(bytes).digest('hex')]));
    contents['preview-release.json'] = JSON.stringify({ repository:'GUAiZzz/culture-taste-daily', source_commit:sha,
      latest_issue:latest, artifact_digest:digestMap(files), files });
    const json = path.join(dir, 'responses.json'), preload = path.join(dir, 'preload.mjs');
    await writeFile(json, JSON.stringify(contents));
    await writeFile(preload, `import fs from 'node:fs';
const responses=JSON.parse(fs.readFileSync(process.env.CTD_TEST_RESPONSES,'utf8'));
globalThis.fetch=async value=>{const prefix='https://guaizzz.github.io/culture-taste-daily/';
 if(!String(value).startsWith(prefix))throw new Error('TEST_ORIGIN_SCOPE');
 let file=String(value).slice(prefix.length);if(!file||file.endsWith('/'))file+='index.html';
 return new Response(responses[file]??'missing',{status:file in responses?200:404});};`);
    const run = args => spawnSync(process.execPath, ['--import', preload, script, '--sha', sha, ...args], {
      cwd:dir, env:{...process.env,CTD_TEST_RESPONSES:json},encoding:'utf8',timeout:10000,
    });
    await action({ dir, contents, json, run });
  } finally { await rm(dir, { recursive:true,force:true }); }
}
test('historical route verification preserves the real homepage latest issue', async () => {
  await fixture(async ({dir,run}) => {
    const result=run(['--issue-date',oldDate]);assert.equal(result.status,0,result.stderr);
    const receipt=JSON.parse(await readFile(path.join(dir,'.stage4/operations/live.json'),'utf8'));
    assert.equal(receipt.date,oldDate);assert.equal(receipt.latest_issue,latest);assert.equal(receipt.routes.length,5);
    assert.notEqual(run(['--date',oldDate]).status,0,'ordinary date must still require latest');
  });
});
test('every older story hash and the source identity remain mandatory', async () => {
  await fixture(async ({contents,json,run}) => {
    contents[`issues/${oldDate}/stories/two/index.html`]+=' altered';await writeFile(json,JSON.stringify(contents));
    const result=run(['--issue-date',oldDate]);assert.notEqual(result.status,0);assert.match(result.stderr,/LIVE_CONTENT_MISMATCH/);
    assert.notEqual(run(['--issue-date','2026-09-13']).status,0,'unbuilt dates are unavailable');
  });
});
