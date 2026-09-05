import { parseArgs } from 'node:util';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, unlink, readFile } from 'node:fs/promises';
import { assertRepository, gh } from './lib/github-scope.mjs';
import { REPOSITORY, PREVIEW_BASE, shanghaiDate, validResumeReceipt } from './lib/preview-policy.mjs';
const { values } = parseArgs({ options: { date: { type: 'string' }, execute: { type: 'boolean' } } });
assertRepository();
const date = values.date ?? shanghaiDate();
if (date !== shanghaiDate()) throw new Error('Resume is limited to the current Shanghai date');
await mkdir('.stage4/operations', { recursive: true });
const lock = '.stage4/operations/preview-release.lock';
await writeFile(lock, JSON.stringify({ date, pid: process.pid, mode: 'resume' }), { flag: 'wx' });
try {
  const prs = JSON.parse(gh(['pr', 'list', '--repo', REPOSITORY, '--head', `automation/culture-taste-${date}`, '--base', PREVIEW_BASE, '--state', 'merged', '--json', 'number,mergeCommit,headRefOid']));
  if (prs.length !== 1) throw new Error('UNIQUE_MERGED_PR_REQUIRED');
  const sha = prs[0].mergeCommit.oid;
  const receipt = JSON.parse(await readFile(`.stage4/operations/${date}.json`, 'utf8'));
  const policy = JSON.parse(await readFile('automation/daily-policy.json', 'utf8'));
  if (!validResumeReceipt(receipt, prs[0], policy, date)) throw new Error('VALIDATED_RELEASE_RECEIPT_REQUIRED');
  const base = JSON.parse(gh(['api', `repos/${REPOSITORY}/git/ref/heads/${PREVIEW_BASE}`])).object.sha;
  if (base !== sha) throw new Error('BASE_CHANGED_AFTER_MERGE: inspect current state before resuming');
  const runs = JSON.parse(gh(['api', `repos/${REPOSITORY}/actions/workflows/preview.yml/runs?head_sha=${sha}&event=workflow_dispatch&per_page=10`])).workflow_runs.sort((a,b) => b.id-a.id);
  const latest = runs[0];
  if (latest?.status === 'completed' && latest.conclusion === 'success') {
    execFileSync(process.execPath, ['scripts/preview-live.mjs', '--sha', sha, '--date', date], { stdio: 'inherit' });
  } else if (latest && latest.status !== 'completed') console.log(JSON.stringify({ state: 'PREVIEW_IN_PROGRESS', run: latest.id, sha }));
  else {
    console.log(JSON.stringify({ state: latest ? 'PREVIEW_FAILED' : 'PREVIEW_NOT_DISPATCHED', sha, action: latest ? 'retry_failed_run' : 'dispatch' }));
    if (values.execute) {
      if (latest) {
        if (latest.run_attempt >= 3) throw new Error('DEPLOY_RETRY_LIMIT');
        gh(['run', 'rerun', String(latest.id), '--repo', REPOSITORY, '--failed']);
      } else gh(['workflow', 'run', 'preview.yml', '--repo', REPOSITORY, '--ref', PREVIEW_BASE, '-f', `expected_sha=${sha}`]);
    }
  }
} finally { await unlink(lock); }
