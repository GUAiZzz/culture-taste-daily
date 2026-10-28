import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { REPOSITORY, PREVIEW_BASE, RESEARCH_CHECKS, policyDigest, checkScope, evaluatePreview } from '../scripts/lib/preview-policy.mjs';
const policy = JSON.parse(await readFile(new URL('../automation/daily-policy.json', import.meta.url)));
const now = new Date('2026-09-06T14:00:00+08:00');
const a = 'a'.repeat(40), b = 'b'.repeat(40), d = 'd'.repeat(64);
function fixture() {
  const evidence = { schema_version: 1, kind: 'preview_run_attestation', target_date: '2026-09-06', source_commit: a, base_commit: b,
    candidate_digest: d, artifact_digest: d, policy_digest: policyDigest(policy), checked_at: '2026-09-06T13:30:00+08:00',
    research: { complete: true, private_evidence_sha256: d, harrytone_commit: a, checks: [...RESEARCH_CHECKS], within_production_window: true },
    health: { source_pages: [{ url: 'https://official.example/event', status: 'PASS' }], media: [{ url: 'https://official.example/image', provenance_verified_at: '2026-09-06T13:00:00+08:00', linked_origin: true, fallback_verified: true, status: 'PASS', production_rights: 'unknown' }] } };
  const runtime = { repository: REPOSITORY, base_ref: PREVIEW_BASE, branch: 'automation/culture-taste-2026-09-06', scope_ok: true, clean: true, source_commit: a, base_commit: b, candidate_digest: d, artifact_digest: d, harrytone_commit: a, private_evidence_matches: true, technical_qa: 'PASS', deterministic: true, privacy_scan: 'PASS', ci: 'success', push_permission: true, package_complete: true, source_urls: ['https://official.example/event'], media_urls: ['https://official.example/image'] };
  return { evidence, runtime, policy, now };
}
test('complete Preview can proceed with unknown rights; production remains blocked', () => {
  const result = evaluatePreview(fixture()); assert.equal(result.preview_eligible, true); assert.equal(result.production_eligible, false);
  assert.ok(result.production_blockers.includes('IMAGE_RIGHTS_UNKNOWN'));
});
for (const [field, value] of Object.entries({ repository: 'wrong/repo', base_ref: 'main', branch: 'main', source_commit: b, base_commit: a, scope_ok: false, clean: false, private_evidence_matches: false, technical_qa: 'FAIL', deterministic: false, privacy_scan: 'FAIL', ci: 'pending', push_permission: false, package_complete: false, candidate_digest: '0'.repeat(64), artifact_digest: '1'.repeat(64) })) {
  test(`Preview stops on ${field}`, () => { const input = fixture(); input.runtime[field] = value; assert.equal(evaluatePreview(input).preview_eligible, false); });
}
test('source restriction requires dated browser verification and never becomes Production approval', () => {
  const input = fixture(); input.evidence.health.source_pages[0].status = 'REVIEW_REQUIRED';
  assert.equal(evaluatePreview(input).preview_eligible, false);
  input.evidence.health.source_pages[0].browser_verified_at = '2026-09-06T13:15:00+08:00';
  assert.equal(evaluatePreview(input).preview_eligible, true);
});
test('temporary image failure needs previously verified official provenance and fallback', () => {
  const input = fixture(); input.evidence.health.media[0].status = 'TEMPORARILY_UNAVAILABLE';
  assert.equal(evaluatePreview(input).preview_eligible, true);
  delete input.evidence.health.media[0].provenance_verified_at;
  assert.equal(evaluatePreview(input).preview_eligible, false);
});
test('research, date, missing evidence, stale evidence and policy drift fail closed', () => {
  for (const change of [i => { i.evidence.research.checks.pop(); }, i => { i.evidence = {}; }, i => { i.evidence.target_date = '2026-09-05'; }, i => { i.evidence.checked_at = '2026-09-05T13:30:00+08:00'; }, i => { i.evidence.policy_digest = 'wrong'; }]) {
    const input = fixture(); change(input); assert.equal(evaluatePreview(input).preview_eligible, false);
  }
});
test('dated content scope rejects core, other dates, traversal, foreign repositories and empty changes', () => {
  const scope = { repository: REPOSITORY, base: PREVIEW_BASE, branch: 'automation/culture-taste-2026-09-06', date: '2026-09-06', paths: ['src/issues/2026-09-06/content.md'] };
  assert.deepEqual(checkScope(scope), []);
  for (const paths of [[], ['core/site.js'], ['src/issues/2026-09-05/content.md'], ['src/issues/2026-09-06/../secret']]) assert.ok(checkScope({ ...scope, paths }).length);
  assert.ok(checkScope({ ...scope, repository: 'other/repo' }).length);
});

test('scheduler comparison catches missing recovery and weekly/day restrictions', async () => {
  const { checkSchedule } = await import('../scripts/lib/schedule.mjs');
  assert.equal(checkSchedule(policy, 'RRULE:FREQ=DAILY;BYHOUR=11,13,15,17,18;BYMINUTE=0'), true);
  for (const rule of ['RRULE:FREQ=DAILY;BYHOUR=11;BYMINUTE=0', 'RRULE:FREQ=DAILY;BYHOUR=11,13,15,17,18;BYMINUTE=0;BYDAY=MO', 'RRULE:FREQ=DAILY;INTERVAL=2;BYHOUR=11,13,15,17,18;BYMINUTE=0']) assert.equal(checkSchedule(policy, rule), false);
});


test('resume requires the original eligible receipt, source head and current policy', async () => {
  const { validResumeReceipt } = await import('../scripts/lib/preview-policy.mjs');
  const p = { headRefOid: 'a'.repeat(40), mergeCommit: { oid: 'b'.repeat(40) } };
  const rule = { output: { deploy_production: false } };
  const receipt = { schema_version: 2, kind: 'preview_release_receipt', date: '2026-09-06', state: 'PREVIEW_MERGED',
    preview_eligible: true, execution_authorized: true, merge_attempted: true, source_commit: p.headRefOid,
    merge_commit: p.mergeCommit.oid, policy_digest: policyDigest(rule), base_commit: 'c'.repeat(40),
    candidate_digest: d, artifact_digest: d, validated_runtime: { source_commit: p.headRefOid },
    private_inputs: { attestation_path: '/private/tmp/attestation.json', attestation_sha256: d,
      research_path: '/private/tmp/research.json', research_sha256: d } };
  assert.equal(validResumeReceipt(receipt, p, rule, receipt.date), true);
  for (const bad of [null, {}, {...receipt, preview_eligible: false}, {...receipt, source_commit: 'c'.repeat(40)},
    {...receipt, policy_digest: 'wrong'}, {...receipt, merge_commit: 'd'.repeat(40)},
    {...receipt, execution_authorized: false}, {...receipt, merge_attempted: false},
    {...receipt, state: 'STOPPED'}, {...receipt, state: 'PREVIEW_ELIGIBLE'}, {...receipt, private_inputs: undefined},
    {...receipt, schema_version: undefined}, {...receipt, merge_commit: undefined}]) assert.equal(validResumeReceipt(bad, p, rule, receipt.date), false);
  for (const state of ['PREVIEW_MERGE_REQUESTED', 'PREVIEW_MERGE_UNCERTAIN']) {
    assert.equal(validResumeReceipt({ ...receipt, state, merge_commit: undefined }, p, rule, receipt.date), true);
    assert.equal(validResumeReceipt({ ...receipt, state, execution_authorized: false, merge_commit: undefined }, p, rule, receipt.date), false);
  }
});

function modernFixture() {
  const f = fixture();
  f.now = new Date('2026-10-27T14:00:00+08:00');
  f.policy = { ...policy, editorial: { formal_story_count: 10, exact_count_effective_from: '2026-10-12',
    minimum_substantive_sources_per_story: 10, sources_effective_from: '2026-09-16' } };
  f.evidence.target_date = '2026-10-27';
  f.evidence.checked_at = '2026-10-27T13:30:00+08:00';
  f.evidence.policy_digest = policyDigest(f.policy);
  f.evidence.health.media[0].provenance_verified_at = '2026-10-27T13:00:00+08:00';
  f.runtime.branch = 'automation/culture-taste-2026-10-27';
  f.runtime.formal_story_count = 10;
  f.runtime.editorial_valid = true;
  f.runtime.editorial_blockers = [];
  return f;
}

test('ordinary release requires exact ten even when the research attestation claims complete', () => {
  assert.equal(evaluatePreview(modernFixture()).preview_eligible, true);
  for (const count of [0, 2, 9, 11, undefined]) {
    const f = modernFixture(); f.runtime.formal_story_count = count;
    assert.ok(evaluatePreview(f).blockers.includes('FORMAL_STORY_COUNT_MISMATCH'));
  }
});

test('ordinary release requires derived per-story source validation, not a complete flag', () => {
  for (const valid of [false, undefined]) {
    const f = modernFixture(); f.runtime.editorial_valid = valid;
    assert.ok(evaluatePreview(f).blockers.includes('EDITORIAL_INCOMPLETE'));
  }
  const f = modernFixture(); f.runtime.editorial_blockers = ['SUBSTANTIVE_SOURCE_COUNT_MISMATCH:story-0'];
  assert.equal(evaluatePreview(f).preview_eligible, false);
  assert.ok(evaluatePreview(f).blockers.includes('SUBSTANTIVE_SOURCE_COUNT_MISMATCH:story-0'));
});
