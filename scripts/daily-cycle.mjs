import path from 'node:path';
import { access, readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { execFileSync } from 'node:child_process';
import { evaluateDailyPreflight } from './lib/daily.mjs';
import { assertRepository } from './lib/github-scope.mjs';
import { shanghaiDate } from './lib/preview-policy.mjs';
import { initEditorialWorkspace, editorialWorkspaceStatus, exportEditorialResearch } from './lib/editorial-workspace.mjs';
import { sourcePlan } from './lib/source-library.mjs';

const { values } = parseArgs({ options: {
  'workspace-root': { type: 'string' }, online: { type: 'boolean' }, date: { type: 'string' },
} });
const repoRoot = process.cwd();
const date = values.date ?? shanghaiDate();
if (!values['workspace-root'] || !path.isAbsolute(values['workspace-root'])) throw new Error('PRIVATE_WORKSPACE_ABSOLUTE_PATH_REQUIRED');
if (date !== shanghaiDate()) throw new Error('WORKSPACE_CURRENT_DATE_REQUIRED');
const identity = assertRepository();
const preflight = await evaluateDailyPreflight({ repoRoot, issueDate: date });
const policy = JSON.parse(await readFile('automation/daily-policy.json', 'utf8'));
const workspace = path.join(values['workspace-root'], date, 'editorial');
const current = await initEditorialWorkspace({ repoRoot, workspace, date });
const progress = editorialWorkspaceStatus({ ...current, policy });
const library = JSON.parse(await readFile('automation/source-library.json', 'utf8'));
const radar = JSON.parse(await readFile('automation/brand-radar.json', 'utf8'));
const sourceQueue = sourcePlan({ library, radar, date, scan: current.state.source_scan ?? [] });
let online;
if (values.online) {
  try { online = JSON.parse(execFileSync(process.execPath, ['scripts/operation-state.mjs', '--online', '--date', date], { encoding: 'utf8', timeout: 180_000, stdio: ['ignore', 'pipe', 'pipe'] })); }
  catch { online = { status: 'ONLINE_RECONCILIATION_UNAVAILABLE', publication_authority: false }; }
}
let packagePresent = true;
try { await access(path.join('src/issues', date, 'issue-manifest.public.json')); } catch { packagePresent = false; }
let packageCheck;
if (packagePresent && progress.source_ready_for_package === 10 && progress.blockers.length === 0) {
  const exported = await exportEditorialResearch({ repoRoot, workspace, output: path.join(current.workspace, 'release-research.json') });
  try {
    packageCheck = JSON.parse(execFileSync(process.execPath, ['scripts/editorial-check.mjs', '--date', date, '--private-evidence', exported.path], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  } catch (error) {
    try { packageCheck = JSON.parse(error.stdout); } catch { packageCheck = { status: 'FAIL', code: 'EDITORIAL_PACKAGE_CHECK_FAILED' }; }
  }
}
const blocked = preflight.blockers.length || sourceQueue.blockers.length;
const finalOnly = preflight.research_phase === 'FINAL_RECONCILIATION_ONLY';
const next = finalOnly ? { action: 'RECONCILE_EXISTING_RELEASE_AND_REPORT_RESULT', research_allowed: false }
  : blocked ? { action: 'RESOLVE_PREFLIGHT_FAILURE', blockers: [...preflight.blockers, ...sourceQueue.blockers] }
    : online?.state === 'LIVE_DATE_PRESENT_REQUIRES_HASH_VERIFICATION' ? { action: 'VERIFY_EXISTING_LIVE_HASHES' }
      : online?.state === 'PREVIEW_MERGED_UNVERIFIED' ? { action: 'RESUME_MATCHING_RELEASE_RECEIPT', regenerate_candidate: false }
        : online?.state === 'DUPLICATE_PR' ? { action: 'RESOLVE_DUPLICATE_PR', publication_eligible: false }
      : packageCheck?.status === 'PASS' ? { action: 'RUN_VERIFY_HEALTH_AND_EXACT_HEAD_CI_THEN_PREVIEW_RELEASE' }
        : packageCheck?.status === 'FAIL' ? { action: 'REPAIR_PUBLIC_PACKAGE', blockers: packageCheck.checks?.flatMap(check => check.blockers ?? []) ?? [packageCheck.code] }
          : progress.issue_source_ready_for_package && sourceQueue.checked_subjects < sourceQueue.total_subjects
            ? { action: 'COMPLETE_REQUIRED_SOURCE_SCAN', subject: sourceQueue.next_subject, remaining: sourceQueue.total_subjects - sourceQueue.checked_subjects }
        : progress.issue_source_ready_for_package && !packagePresent ? { action: 'ASSEMBLE_PUBLIC_PACKAGE_FROM_RETAINED_DRAFTS' }
          : progress.next_action;
console.log(JSON.stringify({ schema_version: 1, kind: 'daily_editorial_cycle', date,
  state: finalOnly ? 'FINAL_RECONCILIATION_ONLY' : blocked ? 'BLOCKED' : packageCheck?.status === 'PASS' ? 'PACKAGE_COMPLETE_UNRELEASED' : 'COLLECTING',
  branch: identity.branch, workspace: current.workspace, research_phase: preflight.research_phase,
  focus_cohort: preflight.brand_radar?.focus_cohort_id, focus_subjects: preflight.brand_radar?.focus_subjects,
  required_regional_lanes: preflight.source_lanes, required_standing_beats: preflight.standing_beats,
  within_production_window: preflight.within_production_window, production_eligible: false, publication_eligible: false,
  progress, source_library: { total_subjects: sourceQueue.total_subjects, unresolved_identities: sourceQueue.unresolved_identities,
    checked_subjects: sourceQueue.checked_subjects, access_limited_subjects: sourceQueue.access_limited_subjects,
    next_subject: sourceQueue.next_subject, note: 'This queue does not attest a completed scan.' },
  online, package_check: packageCheck, next_action: next }, null, 2));
if (blocked && !finalOnly) process.exitCode = 1;
