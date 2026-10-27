import { parseArgs } from 'node:util';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, unlink, readFile } from 'node:fs/promises';
import { assertRepository, gh, git } from './lib/github-scope.mjs';
import { REPOSITORY, PREVIEW_BASE, shanghaiDate, validResumeReceipt } from './lib/preview-policy.mjs';
import { historicalPreviewPolicy, historicalAuthorizationDigest, isAuthorizedHistoricalDate } from './lib/historical-supplements.mjs';
import { withEditorialWorkspaceLock } from './lib/editorial-workspace.mjs';
import { loadResumeEvidence, saveReleaseReceipt } from './lib/preview-handoff.mjs';
const { values } = parseArgs({ options: { date: { type: 'string' }, execute: { type: 'boolean' }, 'historical-supplement': { type: 'boolean' } } });
const identity = assertRepository();
if (identity.dirty) throw new Error('DIRTY_WORKTREE');
const date = values.date ?? shanghaiDate();
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('DATE_IDENTITY');
if (!values['historical-supplement'] && date !== shanghaiDate()) throw new Error('RESUME_CURRENT_DATE_REQUIRED');
await mkdir('.stage4/operations', { recursive: true });
const lock = '.stage4/operations/preview-release.lock';
await writeFile(lock, JSON.stringify({ date, pid: process.pid, mode: 'resume' }), { flag: 'wx' });
const receiptPath = `.stage4/operations/${date}.json`;
let receipt, updateReceipt = false;
const runsFor = sha => JSON.parse(gh(['api', `repos/${REPOSITORY}/actions/workflows/preview.yml/runs?head_sha=${sha}&event=workflow_dispatch&per_page=10`]))
  .workflow_runs.filter(run => run.head_sha === sha && run.event === 'workflow_dispatch').sort((a, b) => b.id - a.id);
try {
  const prs = JSON.parse(gh(['pr', 'list', '--repo', REPOSITORY, '--head', `automation/culture-taste-${date}`, '--base', PREVIEW_BASE, '--state', 'merged', '--json', 'number,mergeCommit,headRefOid']));
  if (prs.length !== 1) throw new Error('UNIQUE_MERGED_PR_REQUIRED');
  const pr = prs[0], sha = pr.mergeCommit.oid;
  try { receipt = JSON.parse(await readFile(receiptPath, 'utf8')); }
  catch { throw new Error('RELEASE_RECEIPT_INVALID_OR_UNAVAILABLE'); }
  const dailyPolicy = JSON.parse(await readFile('automation/daily-policy.json', 'utf8'));
  const authorization = values['historical-supplement'] ? JSON.parse(await readFile('automation/historical-supplements.json', 'utf8')) : null;
  if (authorization && (!isAuthorizedHistoricalDate(authorization, date)
    || receipt.historical_supplement?.authorization_id !== authorization.authorization_id
    || receipt.historical_supplement?.authorization_digest !== historicalAuthorizationDigest(authorization))) throw new Error('HISTORICAL_AUTHORITY');
  if (!authorization && receipt.historical_supplement) throw new Error('HISTORICAL_AUTHORITY');
  const policy = authorization ? historicalPreviewPolicy(dailyPolicy, authorization) : dailyPolicy;
  if (!validResumeReceipt(receipt, pr, policy, date)) throw new Error('VALIDATED_EXECUTE_RECEIPT_REQUIRED_REVALIDATE');
  updateReceipt = true;
  // Resolve a genuine uncertain merge from the matching actual GitHub record.
  receipt.merge_commit = sha;
  const base = JSON.parse(gh(['api', `repos/${REPOSITORY}/git/ref/heads/${PREVIEW_BASE}`])).object.sha;
  if (base !== sha) throw new Error('BASE_CHANGED_AFTER_MERGE');
  const latest = runsFor(sha)[0];
  const verifyLive = () => execFileSync(process.execPath, ['scripts/preview-live.mjs', '--sha', sha,
    authorization ? '--issue-date' : '--date', date], { stdio: 'inherit', timeout: 180_000 });
  if (latest?.status === 'completed' && latest.conclusion === 'success') verifyLive();
  else if (latest && latest.status !== 'completed') console.log(JSON.stringify({ state: 'PREVIEW_IN_PROGRESS', run: latest.id, sha }));
  else {
    // Use immutable committed input, not whichever checkout branch is active.
    let manifest, content;
    try {
      manifest = JSON.parse(git(['show', `${pr.headRefOid}:src/issues/${date}/issue-manifest.public.json`]));
      content = git(['show', `${pr.headRefOid}:src/issues/${date}/content.md`]);
    } catch { throw new Error('RESUME_COMMITTED_PACKAGE_UNAVAILABLE'); }
    const input = { repoRoot: identity.root, receipt, pr, policy, manifest, content, authorization };
    const checked = await loadResumeEvidence(input);
    if (checked.blockers.length) {
      console.log(JSON.stringify({ state: 'STOPPED', blockers: checked.blockers, publication_eligible: false }));
      throw new Error('RESUME_EVIDENCE_REVALIDATION_REQUIRED');
    }
    console.log(JSON.stringify({ state: latest ? 'PREVIEW_FAILED' : 'PREVIEW_NOT_DISPATCHED', sha,
      action: latest ? 'retry_failed_run' : 'dispatch', evidence_revalidated: true }));
    if (values.execute) {
      const dispatch = async () => {
        // Match the editorial writer's lock through final verification/dispatch.
        // Reconcile an uncertain prior dispatch before every external write.
        const fresh = await loadResumeEvidence(input);
        if (fresh.blockers.length) throw new Error('RESUME_EVIDENCE_CHANGED_BEFORE_DISPATCH');
        const actualBase = JSON.parse(gh(['api', `repos/${REPOSITORY}/git/ref/heads/${PREVIEW_BASE}`])).object.sha;
        if (actualBase !== sha) throw new Error('BASE_CHANGED_AFTER_MERGE');
        const actual = runsFor(sha)[0];
        if (actual?.status === 'completed' && actual.conclusion === 'success') return { verifyLive: true };
        if (actual && actual.status !== 'completed') {
          console.log(JSON.stringify({ state: 'PREVIEW_IN_PROGRESS', run: actual.id, sha })); return {};
        }
        if (actual && actual.run_attempt >= 3) throw new Error('DEPLOY_RETRY_LIMIT');
        receipt.merge_commit = sha; receipt.state = 'PREVIEW_DISPATCH_REQUESTED';
        receipt.resumed_at = new Date().toISOString(); await saveReleaseReceipt(receiptPath, receipt);
        if (actual) gh(['run', 'rerun', String(actual.id), '--repo', REPOSITORY, '--failed']);
        else gh(['workflow', 'run', 'preview.yml', '--repo', REPOSITORY, '--ref', PREVIEW_BASE, '-f', `expected_sha=${sha}`]);
        receipt.state = 'PREVIEW_DISPATCHED'; await saveReleaseReceipt(receiptPath, receipt);
        return {};
      };
      const result = !authorization && policy.editorial?.private_workspace_required === true
        ? await withEditorialWorkspaceLock({ repoRoot: identity.root, workspace: checked.privateResearch.workspace_path }, dispatch)
        : await dispatch();
      if (result.verifyLive) verifyLive();
    }
  }
} catch (error) {
  if (updateReceipt) {
    receipt.state = 'PREVIEW_RELEASE_INTERRUPTED'; receipt.reason = error.message;
    receipt.finished_at = new Date().toISOString(); await saveReleaseReceipt(receiptPath, receipt);
  }
  throw error;
} finally { await unlink(lock); }
