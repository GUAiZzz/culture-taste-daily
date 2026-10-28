import { parseArgs } from 'node:util';
import { readFile, mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { assertRepository, git, gh } from './lib/github-scope.mjs';
import { REPOSITORY, PREVIEW_BASE, checkScope, evaluatePreview, policyDigest, shanghaiDate } from './lib/preview-policy.mjs';
import { readJson, sha256, sha256File, directoryDigest } from './lib/files.mjs';
import { assertPublicTree } from './lib/privacy.mjs';
import { REQUIRED_TECHNICAL_CHECKS } from './lib/qa.mjs';
import { historicalPreviewPolicy, historicalPackageBlockers, historicalSourceBlockers, historicalAuthorizationDigest, isAuthorizedHistoricalDate } from './lib/historical-supplements.mjs';
import { editorialBlockers } from './lib/editorial-policy.mjs';
import { validateEditorialBinding } from './lib/editorial-binding.mjs';
import { externalWorkspacePath, withEditorialWorkspaceLock } from './lib/editorial-workspace.mjs';
import { loadResumeEvidence, displayReleaseReceipt, saveReleaseReceipt } from './lib/preview-handoff.mjs';

const { values } = parseArgs({ options: {
  evidence: { type: 'string' }, 'private-evidence': { type: 'string' }, execute: { type: 'boolean' },
} });
const identity = assertRepository();
if (!values.evidence || !values['private-evidence']) throw new Error('Private --evidence and --private-evidence paths are required; no implicit approval');
const privatePaths = {
  attestation_path: await externalWorkspacePath(identity.root, values.evidence),
  research_path: await externalWorkspacePath(identity.root, values['private-evidence']),
};
async function readPrivateInput(file) {
  try { const bytes = await readFile(file); return { value: JSON.parse(bytes.toString('utf8')), sha256: sha256(bytes) }; }
  catch { throw new Error('PRIVATE_EVIDENCE_INVALID'); }
}
const attestation = await readPrivateInput(privatePaths.attestation_path);
const research = await readPrivateInput(privatePaths.research_path);
const e = attestation.value, privateResearch = research.value;
const privateInputs = { ...privatePaths, attestation_sha256: attestation.sha256, research_sha256: research.sha256 };
const date = e.target_date;
if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) throw new Error('DATE_IDENTITY');
await mkdir('.stage4/operations', { recursive: true });
const lock = '.stage4/operations/preview-release.lock';
// Exclusive creation: a second release cannot merge or dispatch concurrently.
await writeFile(lock, JSON.stringify({ date, pid: process.pid, started_at: new Date().toISOString() }), { flag: 'wx' });
const receiptPath = `.stage4/operations/${date}.json`;
const receipt = { schema_version: 2, kind: 'preview_release_receipt', date, state: 'CHECKING',
  execution_authorized: false, merge_attempted: false, preview_eligible: false, production_eligible: false, source_commit: identity.head };
async function save() { await saveReleaseReceipt(receiptPath, receipt); }
try {
  const dailyPolicy = await readJson('automation/daily-policy.json');
  const authorization = e.historical_supplement ? await readJson('automation/historical-supplements.json') : null;
  const policy = authorization ? historicalPreviewPolicy(dailyPolicy, authorization) : dailyPolicy;
  if (authorization && !isAuthorizedHistoricalDate(authorization, date)) throw new Error('HISTORICAL_AUTHORITY');
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
  if (Boolean(manifest.historical_supplement) !== Boolean(e.historical_supplement)) throw new Error('HISTORICAL_AUTHORITY');
  const editorialChecks = authorization ? [] : editorialBlockers({ manifest,
    content: await readFile(`src/issues/${date}/content.md`, 'utf8'), privateResearch, policy });
  if (!authorization && policy.editorial?.private_workspace_required === true) editorialChecks.push(...await validateEditorialBinding({
    repoRoot: identity.root, manifest, content: await readFile(`src/issues/${date}/content.md`, 'utf8'), privateResearch, policy,
  }));
  const historicalBlockers = authorization ? [
    ...historicalPackageBlockers({ manifest, content: await readFile(`src/issues/${date}/content.md`, 'utf8'), authorization }),
    ...historicalSourceBlockers({ manifest, privateResearch, authorization }),
  ] : [];
  if (authorization && manifest.research_locked_at.slice(0, 10) !== shanghaiDate()) historicalBlockers.push('HISTORICAL_REFRESH_REQUIRED');
  let alreadyLiveHistoricalDate = false;
  if (authorization) {
    alreadyLiveHistoricalDate = Boolean(git(['ls-tree', baseCommit, '--', `src/issues/${date}/issue-manifest.public.json`]));
  }
  const radar = await readJson(`src/issues/${date}/daily-radar.public.json`);
  await assertPublicTree('dist');
  const sources = [...new Set([...manifest.stories.flatMap(s => s.sources.map(x => x.url)), ...radar.items.filter(i => !i.included_story_id).map(i => i.official_url)])];
  const media = [...new Set([...manifest.stories.map(s => s.media?.external_image_url), ...radar.items.flatMap(i => [i.media?.url, i.media?.poster_url])].filter(Boolean))];
  const dependency = await readJson('dependencies/harrytone.json');
  const runtime = {
    repository: meta.full_name, base_ref: PREVIEW_BASE, branch: identity.branch,
    scope_ok: !scope.length, clean: !identity.dirty, source_commit: identity.head, base_commit: baseCommit,
    candidate_digest: issue?.candidate_digest, artifact_digest: second.artifact_digest,
    harrytone_commit: dependency.commit, private_evidence_matches: research.sha256 === e.research?.private_evidence_sha256,
    technical_qa: technical.status === 'PASS' && technical.candidate_digest === issue?.candidate_digest
      && technical.artifact_digest === second.artifact_digest
      && REQUIRED_TECHNICAL_CHECKS.every(id => technical.checks.some(c => c.id === id && c.status === 'PASS')) ? 'PASS' : 'FAIL',
    deterministic: first.artifact_digest === second.artifact_digest && reportBefore.artifact_digest === second.artifact_digest,
    privacy_scan: 'PASS', ci: ci.conclusion, push_permission: meta.permissions?.push === true,
    package_complete: Boolean(issue && radar.items?.length >= 10 && radar.items?.length <= 20),
    source_urls: sources, media_urls: media,
    formal_story_count: manifest.stories.length,
    editorial_valid: !editorialChecks.length,
    editorial_blockers: editorialChecks,
    historical_supplement_valid: authorization ? !historicalBlockers.length : false,
    historical_supplement_blockers: historicalBlockers,
    already_live_historical_date: alreadyLiveHistoricalDate,
  };
  const decision = evaluatePreview({ evidence: e, runtime, policy });
  Object.assign(receipt, decision, { candidate_digest: issue?.candidate_digest, artifact_digest: second.artifact_digest, base_commit: baseCommit,
    ci_run: ci.id, policy_digest: policyDigest(policy), private_inputs: privateInputs, validated_runtime: runtime });
  if (authorization) receipt.historical_supplement = { authorization_id: authorization.authorization_id,
    authorization_digest: historicalAuthorizationDigest(authorization), coverage_date: date };
  await save(); console.log(JSON.stringify(displayReleaseReceipt(receipt), null, 2));
  if (!decision.preview_eligible) { process.exitCode = 1; }
  else if (!values.execute) console.log('DRY_RUN: no merge or dispatch; use --execute only for this validated daily Preview.');
  else {
    const handoff = async () => {
      const currentEvidence = await loadResumeEvidence({ repoRoot: identity.root, receipt, pr, policy, manifest,
        content: await readFile(`src/issues/${date}/content.md`, 'utf8'), authorization });
      if (currentEvidence.blockers.length) throw new Error('RELEASE_HANDOFF_EVIDENCE_CHANGED');
      // Persist actual execute intent before the potentially uncertain side effect.
      const currentBase = JSON.parse(gh(['api', `repos/${REPOSITORY}/git/ref/heads/${PREVIEW_BASE}`])).object.sha;
      if (currentBase !== baseCommit) throw new Error('BASE_CHANGED: rerun QA and evidence on current base');
      receipt.execution_authorized = true; receipt.merge_attempted = true;
      receipt.merge_requested_at = new Date().toISOString(); receipt.state = 'PREVIEW_MERGE_REQUESTED'; await save();
      gh(['pr', 'merge', String(pr.number), '--repo', REPOSITORY, '--merge', '--match-head-commit', identity.head]);
      const merged = JSON.parse(gh(['pr', 'view', String(pr.number), '--repo', REPOSITORY, '--json', 'state,mergeCommit,headRefOid']));
      if (merged.state !== 'MERGED' || merged.headRefOid !== identity.head) throw new Error('MERGE_NOT_CONFIRMED');
      receipt.merge_commit = merged.mergeCommit.oid; receipt.state = 'PREVIEW_MERGED'; await save();
      gh(['workflow', 'run', 'preview.yml', '--repo', REPOSITORY, '--ref', PREVIEW_BASE, '-f', `expected_sha=${receipt.merge_commit}`]);
      receipt.state = 'PREVIEW_DISPATCHED'; await save();
    };
    if (!authorization && policy.editorial?.private_workspace_required === true) {
      await withEditorialWorkspaceLock({ repoRoot: identity.root, workspace: privateResearch.workspace_path }, handoff);
    } else await handoff();
    // Bounded polling. Completion is a live hash check, never just a dispatch response.
    for (let attempt = 0; attempt < 120; attempt++) {
      const latest = JSON.parse(gh(['api', `repos/${REPOSITORY}/actions/workflows/preview.yml/runs?head_sha=${receipt.merge_commit}&event=workflow_dispatch&per_page=5`])).workflow_runs[0];
      if (latest?.status === 'completed') {
        receipt.deploy_run = latest.id; await save();
        if (latest.conclusion !== 'success') throw new Error(`PREVIEW_DEPLOY_FAILED: run ${latest.id}`);
        execFileSync(process.execPath, ['scripts/preview-live.mjs', '--sha', receipt.merge_commit,
          authorization ? '--issue-date' : '--date', date], { stdio: 'inherit', timeout: 180_000 });
        const live = await readJson('.stage4/operations/live.json');
        const { source_commit: liveSource, artifact_digest: liveArtifact, ...liveFacts } = live;
        Object.assign(receipt, liveFacts, { live_source_commit: liveSource, live_artifact_digest: liveArtifact }); await save();
        console.log(JSON.stringify(displayReleaseReceipt(receipt), null, 2)); break;
      }
      if (attempt === 119) throw new Error('PREVIEW_DEPLOY_TIMEOUT');
      await new Promise(resolve => setTimeout(resolve, 10_000));
    }
  }
} catch (error) {
  receipt.reason = error.message; receipt.finished_at = new Date().toISOString();
  if (receipt.execution_authorized && receipt.merge_attempted) {
    if (receipt.merge_commit) receipt.state = 'PREVIEW_RELEASE_INTERRUPTED';
    else {
      // A failed response does not tell us whether GitHub accepted the merge.
      try {
        const actual = JSON.parse(gh(['pr', 'view', String(receipt.pr), '--repo', REPOSITORY, '--json', 'state,mergeCommit,headRefOid']));
        if (actual.state === 'MERGED' && actual.headRefOid === receipt.source_commit && actual.mergeCommit?.oid) {
          receipt.merge_commit = actual.mergeCommit.oid; receipt.state = 'PREVIEW_RELEASE_INTERRUPTED';
        } else {
          receipt.state = 'STOPPED'; receipt.preview_eligible = false; receipt.execution_authorized = false;
        }
      } catch { receipt.state = 'PREVIEW_MERGE_UNCERTAIN'; }
    }
  } else { receipt.state = 'STOPPED'; receipt.preview_eligible = false; receipt.execution_authorized = false; }
  await save(); throw error;
} finally { await unlink(lock); }
