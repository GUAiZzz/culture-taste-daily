import { createHash } from 'node:crypto';

export const REPOSITORY = 'GUAiZzz/culture-taste-daily';
export const PREVIEW_BASE = 'preview-build-v1';
export const SHA = /^[a-f0-9]{40}$/;
export const DIGEST = /^[a-f0-9]{64}$/;
export const RESEARCH_CHECKS = Object.freeze([
  'regional_lanes', 'full_registry_scan', 'focus_cohort', 'standing_beats',
  'event_deduplication', 'prior_two_issue_deduplication', 'official_story_media',
  'source_reading', 'chinese_editorial', 'bounded_english', 'harrytone',
  'detail_reference', 'seven_issue_variation', 'cover', 'radar',
]);
export const policyDigest = policy => createHash('sha256').update(JSON.stringify(policy)).digest('hex');
export function shanghaiDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function checkScope({ repository, base, branch, date, paths, dirty = false }) {
  const reasons = [];
  if (repository !== REPOSITORY) reasons.push('REPOSITORY_IDENTITY');
  if (base !== PREVIEW_BASE) reasons.push('BASE_IDENTITY');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || Number.isNaN(Date.parse(`${date}T00:00:00+08:00`))) reasons.push('DATE_IDENTITY');
  if (branch !== `automation/culture-taste-${date}`) reasons.push('BRANCH_IDENTITY');
  if (dirty) reasons.push('DIRTY_WORKTREE');
  if (!Array.isArray(paths) || !paths.length) reasons.push('EMPTY_CANDIDATE');
  for (const file of paths ?? []) {
    if (file.includes('..') || file.includes('\\') || !(file.startsWith(`src/issues/${date}/`) || file === `src/site/assets/covers/${date}.svg`)) reasons.push('PUBLIC_PATH_SCOPE');
  }
  return [...new Set(reasons)];
}

// This evaluates evidence completeness and disposition, not editorial truth.
// Evidence is private, bound to the exact candidate and checked against runtime facts.
export function evaluatePreview({ evidence, runtime, policy, now = new Date() }) {
  const blockers = [];
  const productionBlockers = ['NAMED_HUMAN_APPROVAL_REQUIRED', 'PRODUCTION_CUTOVER_DISABLED'];
  const e = evidence ?? {};
  const r = runtime ?? {};
  const fail = (ok, code) => { if (!ok) blockers.push(code); };
  fail(e.schema_version === 1 && e.kind === 'preview_run_attestation', 'EVIDENCE_SCHEMA');
  fail(policy?.output?.merge === true && policy?.output?.deploy_preview === true && policy?.output?.deploy_production === false, 'PREVIEW_AUTHORITY');
  fail(e.target_date === shanghaiDate(now) && e.target_date >= policy?.preview_authority?.effective_from, 'DATE_IDENTITY');
  fail(r.repository === REPOSITORY && r.base_ref === PREVIEW_BASE && r.branch === `automation/culture-taste-${e.target_date}`, 'REPOSITORY_IDENTITY');
  fail(r.scope_ok === true && r.clean === true, 'PUBLIC_PATH_SCOPE');
  for (const field of ['source_commit', 'base_commit']) fail(SHA.test(e[field] ?? '') && e[field] === r[field], field.toUpperCase());
  for (const field of ['candidate_digest', 'artifact_digest']) fail(DIGEST.test(e[field] ?? '') && e[field] === r[field], field.toUpperCase());
  fail(e.policy_digest === policyDigest(policy), 'POLICY_DRIFT');
  const age = now - new Date(e.checked_at);
  fail(Number.isFinite(age) && age >= 0 && age <= 6 * 60 * 60 * 1000, 'STALE_EVIDENCE');
  fail(e.research?.complete === true && DIGEST.test(e.research?.private_evidence_sha256 ?? '')
    && e.research?.harrytone_commit === r.harrytone_commit
    && SHA.test(r.harrytone_commit ?? '')
    && Array.isArray(e.research?.checks) && RESEARCH_CHECKS.every(check => e.research.checks.includes(check)), 'RESEARCH_INCOMPLETE');
  fail(r.private_evidence_matches === true, 'PRIVATE_EVIDENCE_MISSING');
  fail(r.technical_qa === 'PASS' && r.deterministic === true, 'TECHNICAL_QA');
  fail(r.privacy_scan === 'PASS', 'PRIVATE_MATERIAL');
  fail(r.ci === 'success', 'CI_INCOMPLETE');
  fail(r.push_permission === true, 'GITHUB_PUSH_PERMISSION');
  fail(r.package_complete === true, 'PACKAGE_INCOMPLETE');
  const pages = Array.isArray(e.health?.source_pages) ? e.health.source_pages : [];
  fail(Array.isArray(r.source_urls) && r.source_urls.length > 0
    && r.source_urls.every(url => pages.some(p => p.url === url && (p.status === 'PASS'
      || (p.status === 'REVIEW_REQUIRED' && validVerification(p.browser_verified_at, now, e.target_date))))), 'SOURCE_UNVERIFIED');
  const media = Array.isArray(e.health?.media) ? e.health.media : [];
  fail(Array.isArray(r.media_urls) && r.media_urls.length > 0
    && r.media_urls.every(url => media.some(m => m.url === url
      && validVerification(m.provenance_verified_at, now, e.target_date)
      && m.linked_origin === true && m.fallback_verified === true
      && ['PASS', 'TEMPORARILY_UNAVAILABLE'].includes(m.status)
      && ['unknown', 'cleared'].includes(m.production_rights))), 'OFFICIAL_MEDIA_UNVERIFIED');
  if (media.some(m => m.production_rights !== 'cleared')) productionBlockers.push('IMAGE_RIGHTS_UNKNOWN');
  if (e.research?.within_production_window !== true) productionBlockers.push('RESEARCH_WINDOW');
  if (pages.some(p => p.status !== 'PASS')) productionBlockers.push('SOURCE_ACCESS_REVIEW');
  return { state: blockers.length ? 'STOPPED' : 'PREVIEW_ELIGIBLE', preview_eligible: !blockers.length,
    production_eligible: false, blockers: [...new Set(blockers)], production_blockers: productionBlockers };
}
function validVerification(value, now, date) {
  const time = new Date(value);
  return typeof value === 'string' && /\+08:00$/.test(value) && value.startsWith(date)
    && Number.isFinite(time.getTime()) && time <= now;
}

export function validResumeReceipt(receipt, pr, policy, date) {
  return receipt?.preview_eligible === true && receipt.date === date
    && receipt.source_commit === pr?.headRefOid && SHA.test(pr?.headRefOid ?? '')
    && SHA.test(pr?.mergeCommit?.oid ?? '') && receipt.policy_digest === policyDigest(policy)
    && (!receipt.merge_commit || receipt.merge_commit === pr.mergeCommit.oid);
}
