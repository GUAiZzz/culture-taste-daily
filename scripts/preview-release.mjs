import { parseArgs } from 'node:util';
import { readFile, mkdir, writeFile, unlink, realpath } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { assertRepository, git, gh } from './lib/github-scope.mjs';
import { REPOSITORY, PREVIEW_BASE, checkScope, evaluatePreview, policyDigest } from './lib/preview-policy.mjs';
import { readJson, sha256File, directoryDigest } from './lib/files.mjs';
import { assertPublicTree } from './lib/privacy.mjs';
import { REQUIRED_TECHNICAL_CHECKS } from './lib/qa.mjs';

const { values } = parseArgs({ options: {
  evidence: { type: 'string' }, 'private-evidence': { type: 'string' }, execute: { type: 'boolean' },
} });
const identity = assertRepository();
if (!values.evidence || !values['private-evidence']) throw new Error('Private --evidence and --private-evidence paths are required; no implicit approval');
for (const supplied of [values.evidence, values['private-evidence']]) {
  const file = await realpath(supplied);
  if (file === identity.root || file.startsWith(identity.root + path.sep)) throw new Error('PRIVATE_EVIDENCE_MUST_STAY_OUTSIDE_REPOSITORY');
}
const e = await readJson(values.evidence);
const date = e.target_date;
if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) throw new Error('DATE_IDENTITY');
await mkdir('.stage4/operations', { recursive: true });
const lock = '.stage4/operations/preview-release.lock';
// Exclusive creation: a second release cannot merge or dispatch concurrently.
await writeFile(lock, JSON.stringify({ date, pid: process.pid, started_at: new Date().toISOString() }), { flag: 'wx' });
const receiptPath = `.stage4/operations/${date}.json`;
const receipt = { date, state: 'CHECKING', production_eligible: false, source_commit: identity.head };
async function save() { await writeFile(receiptPath, JSON.stringify(receipt, null, 2)+'\n'); }
try {
  const policy = await readJson('automation/daily-policy.json');
  const meta = JSON.parse(gh(['api', `repos/${REPOSITORY}`]));
  const baseCommit = JSON.parse(gh(['api', `repos/${REPOSITORY}/git/ref/heads/${PREVIEW_BASE}`])).object.sha;
  if (git(['rev-parse', `origin/${PREVIEW_BASE}`]) !== baseCommit) throw new Error('STALE_BASE: fetch and revalidate before release');
  const changed = git(['diff', '--name-only', `${baseCommit}...HEAD`]).split('\n').filter(Boolean);
  const scope = checkScope({ repository: identity.repository, base: PREVIEW_BASE, branch: identity.branch, date, paths: changed, dirty: identity.dirty });
  if (scope.length) throw new Error(scope.join(', '));
  const prs = JSON.parse(gh(['pr', 'list', '--repo', REPOSITORY, '--head', identity.branch, '--base', PREVIEW_BASE, '--state', 'open', '--json', 'number,headRefOid,baseRefOid,isCrossRepository']));
  if (prs.length !== 1 || prs[0].headRefOid !== identity.head || prs[0].baseRefOid !== baseCommit || prs[0].isCrossRepository) throw new Error('UNIQUE_PR_OR_HEAD_IDENTITY');
  const pr = prs[0]; receipt.pr = pr.number;
  const remotePaths = JSON.parse(gh(['api', `repos/${REPOSITORY}/pulls/${pr.number}/files?per_page=100`])).map(file => file.filename);
  if (JSON.stringify(remotePaths.sort()) !== JSON.stringify(changed.sort())) throw new Error('REMOTE_DIFF_MISMATCH');
  execFileSync(process.execPath, ['scripts/check-public-diff.mjs', '--base', baseCommit], { stdio: 'inherit' });
  const runs = JSON.parse(gh(['api', `repos/${REPOSITORY}/actions/workflows/preview.yml/runs?head_sha=${identity.head}&event=pull_request&per_page=10`])).workflow_runs;
  const ci = runs.filter(run => run.head_sha === identity.head && run.event === 'pull_request').sort((a,b) => b.id-a.id)[0];
  if (!ci || ci.status !== 'completed' || ci.conclusion !== 'success') throw new Error('CI_INCOMPLETE');
  const reportBefore = await readJson('dist/build-report.json');
  const technical = await readJson(`.stage4/evidence/${date}/technical-evidence.json`);
  // Rebuild twice from the clean committed inputs; don't trust a generator digest.
  execFileSync('npm', ['run', 'build'], { stdio: 'ignore' });
  const first = await readJson('dist/build-report.json');
  execFileSync('npm', ['run', 'build'], { stdio: 'ignore' });
  const second = await readJson('dist/build-report.json');
  const issue = second.issues.find(item => item.issue_id === date);
  const manifest = await readJson(`src/issues/${date}/issue-manifest.public.json`);
  const radar = await readJson(`src/issues/${date}/daily-radar.public.json`);
  await assertPublicTree('dist');
  const sources = [...new Set([...manifest.stories.flatMap(s => s.sources.map(x => x.url)), ...radar.items.filter(i => !i.included_story_id).map(i => i.official_url)])];
  const media = [...new Set([...manifest.stories.map(s => s.media?.external_image_url), ...radar.items.flatMap(i => [i.media?.url, i.media?.poster_url])].filter(Boolean))];
  const dependency = await readJson('dependencies/harrytone.json');
  const runtime = {
    repository: meta.full_name, base_ref: PREVIEW_BASE, branch: identity.branch,
    scope_ok: !scope.length, clean: !identity.dirty, source_commit: identity.head, base_commit: baseCommit,
    candidate_digest: issue?.candidate_digest, artifact_digest: second.artifact_digest,
    harrytone_commit: dependency.commit, private_evidence_matches: await sha256File(values['private-evidence']) === e.research?.private_evidence_sha256,
    technical_qa: technical.status === 'PASS' && technical.candidate_digest === issue?.candidate_digest
      && technical.artifact_digest === second.artifact_digest
      && REQUIRED_TECHNICAL_CHECKS.every(id => technical.checks.some(c => c.id === id && c.status === 'PASS')) ? 'PASS' : 'FAIL',
    deterministic: first.artifact_digest === second.artifact_digest && reportBefore.artifact_digest === second.artifact_digest,
    privacy_scan: 'PASS', ci: ci.conclusion, push_permission: meta.permissions?.push === true,
    package_complete: Boolean(issue && radar.items?.length >= 10 && radar.items?.length <= 20),
    source_urls: sources, media_urls: media,
  };
  const decision = evaluatePreview({ evidence: e, runtime, policy });
  Object.assign(receipt, decision, { candidate_digest: issue?.candidate_digest, artifact_digest: second.artifact_digest, base_commit: baseCommit, ci_run: ci.id, policy_digest: policyDigest(policy) });
  await save(); console.log(JSON.stringify(receipt, null, 2));
  if (!decision.preview_eligible) { process.exitCode = 1; }
  else if (!values.execute) console.log('DRY_RUN: no merge or dispatch; use --execute only for this validated daily Preview.');
  else {
    // Recheck the exact base immediately before the head-pinned merge.
    const currentBase = JSON.parse(gh(['api', `repos/${REPOSITORY}/git/ref/heads/${PREVIEW_BASE}`])).object.sha;
    if (currentBase !== baseCommit) throw new Error('BASE_CHANGED: rerun QA and evidence on current base');
    gh(['pr', 'merge', String(pr.number), '--repo', REPOSITORY, '--merge', '--match-head-commit', identity.head]);
    const merged = JSON.parse(gh(['pr', 'view', String(pr.number), '--repo', REPOSITORY, '--json', 'state,mergeCommit']));
    if (merged.state !== 'MERGED') throw new Error('MERGE_NOT_CONFIRMED');
    receipt.merge_commit = merged.mergeCommit.oid; receipt.state = 'PREVIEW_MERGED'; await save();
    gh(['workflow', 'run', 'preview.yml', '--repo', REPOSITORY, '--ref', PREVIEW_BASE, '-f', `expected_sha=${receipt.merge_commit}`]);
    receipt.state = 'PREVIEW_DISPATCHED'; await save();
    // Bounded polling. Completion is a live hash check, never just a dispatch response.
    for (let attempt = 0; attempt < 120; attempt++) {
      const latest = JSON.parse(gh(['api', `repos/${REPOSITORY}/actions/workflows/preview.yml/runs?head_sha=${receipt.merge_commit}&event=workflow_dispatch&per_page=5`])).workflow_runs[0];
      if (latest?.status === 'completed') {
        receipt.deploy_run = latest.id; await save();
        if (latest.conclusion !== 'success') throw new Error(`PREVIEW_DEPLOY_FAILED: run ${latest.id}`);
        execFileSync(process.execPath, ['scripts/preview-live.mjs', '--sha', receipt.merge_commit, '--date', date], { stdio: 'inherit', timeout: 180_000 });
        Object.assign(receipt, await readJson('.stage4/operations/live.json')); await save();
        console.log(JSON.stringify(receipt, null, 2)); break;
      }
      if (attempt === 119) throw new Error('PREVIEW_DEPLOY_TIMEOUT');
      await new Promise(resolve => setTimeout(resolve, 10_000));
    }
  }
} catch (error) {
  receipt.state = 'STOPPED'; receipt.reason = error.message; receipt.finished_at = new Date().toISOString(); await save(); throw error;
} finally { await unlink(lock); }
