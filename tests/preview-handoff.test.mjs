import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sha256 } from '../scripts/lib/files.mjs';
import { RESEARCH_CHECKS, policyDigest, validResumeReceipt } from '../scripts/lib/preview-policy.mjs';
import { initEditorialWorkspace, mutateEditorialWorkspace, exportEditorialResearch } from '../scripts/lib/editorial-workspace.mjs';
import { loadResumeEvidence, displayReleaseReceipt, saveReleaseReceipt } from '../scripts/lib/preview-handoff.mjs';

const policy = JSON.parse(await readFile(new URL('../automation/daily-policy.json', import.meta.url)));
const now = new Date('2026-10-27T14:00:00+08:00'), date = '2026-10-27';
const scratch = await mkdtemp(path.join(tmpdir(), 'ctd-preview-handoff-'));
after(() => rm(scratch, { recursive: true, force: true }));
let serial = 0;
async function fixture() {
  const root = path.join(scratch, String(++serial));
  const repoRoot = path.join(root, 'public'), workspace = path.join(root, 'private');
  await mkdir(path.join(repoRoot, 'automation'), { recursive: true });
  // A one-subject synthetic library isolates checkpoint binding. It is not a
  // genuine registry scan, evidence record or publication candidate.
  const library = { schema_version: 1, kind: 'culture_taste_source_library', subjects: [{
    id: 'test-brand', name: 'Synthetic Test Brand', routes: [{ kind: 'official_site', url: 'https://official.example/',
      identity_evidence_url: 'https://official.example/', verified_on: date, discovery_only: true }] }] };
  const radar = { cohorts: [{ id: 'synthetic', subjects: ['Synthetic Test Brand'] }] };
  await writeFile(path.join(repoRoot, 'automation/source-library.json'), JSON.stringify(library));
  await writeFile(path.join(repoRoot, 'automation/brand-radar.json'), JSON.stringify(radar));
  const stories = Array.from({ length: 10 }, (_, i) => ({ id: `story-${i}`, title: `Article ${i}`, level: i ? 'signal' : 'cover',
    english: { title: `Article ${i}`, deck: 'Synthetic bounded account.', abstract: 'A test fixture, not reporting.' },
    sources: Array.from({ length: 10 }, (_, n) => ({ url: `https://official.example/${i}/source-${n}` })) }));
  const articles = stories.map(story => ({ story_id: story.id, title: story.title, canonical_event_id: `event-${story.id}`,
    draft_markdown: `Synthetic body for ${story.id}. This fixture tests execution recovery, not culture reporting.` }));
  const sources = stories.flatMap(story => story.sources.map((source, i) => ({ story_id: story.id, url: source.url,
    underlying_source_id: `${story.id}-${i}`, kind: 'information', actually_read: true, substantive: true,
    supports: ['Synthetic assertion'], reading_notes: 'Synthetic notes only.', accessed_at: '2026-10-27T12:00:00+08:00' })));
  await initEditorialWorkspace({ repoRoot, workspace, date, now });
  await mutateEditorialWorkspace({ repoRoot, workspace, now, input: { expected_revision: 0, operation_id: 'synthetic-complete', articles, sources,
    source_scan: [{ subject_id: 'test-brand', route_url: 'https://official.example/', checked_at: '2026-10-27T13:00:00+08:00',
      result: 'NO_NEW_SIGNAL', notes: 'Synthetic attempt only.' }] } });
  const researchPath = path.join(workspace, 'research.json');
  await exportEditorialResearch({ repoRoot, workspace, output: researchPath });
  const manifest = { publication_date: date, candidate_created_at: '2026-10-27T11:00:00+08:00',
    research_locked_at: '2026-10-27T13:00:00+08:00', content_locked_at: '2026-10-27T13:15:00+08:00',
    content_lock: { locked_at: '2026-10-27T13:15:00+08:00' }, stories };
  const content = '# Synthetic fixture\n\n' + articles.map(article => `## ${article.title}\n\n${article.draft_markdown}\n\n`).join('');
  const sourceUrls = sources.map(source => source.url), image = 'https://official.example/image.jpg';
  const a = 'a'.repeat(40), b = 'b'.repeat(40), digest = 'd'.repeat(64);
  const evidence = { schema_version: 1, kind: 'preview_run_attestation', target_date: date, source_commit: a, base_commit: b,
    candidate_digest: digest, artifact_digest: digest, policy_digest: policyDigest(policy), checked_at: '2026-10-27T13:30:00+08:00',
    research: { complete: true, private_evidence_sha256: sha256(await readFile(researchPath)), harrytone_commit: a,
      checks: [...RESEARCH_CHECKS], within_production_window: true },
    health: { source_pages: sourceUrls.map(url => ({ url, status: 'PASS' })), media: [{ url: image, status: 'PASS',
      provenance_verified_at: '2026-10-27T13:00:00+08:00', linked_origin: true, fallback_verified: true, production_rights: 'unknown' }] } };
  const attestationPath = path.join(workspace, 'attestation.json');
  await writeFile(attestationPath, JSON.stringify(evidence));
  const runtime = { repository: 'GUAiZzz/culture-taste-daily', base_ref: 'preview-build-v1', branch: `automation/culture-taste-${date}`,
    scope_ok: true, clean: true, source_commit: a, base_commit: b, candidate_digest: digest, artifact_digest: digest,
    harrytone_commit: a, private_evidence_matches: true, technical_qa: 'PASS', deterministic: true, privacy_scan: 'PASS', ci: 'success',
    push_permission: true, package_complete: true, source_urls: sourceUrls, media_urls: [image], formal_story_count: 10, editorial_valid: true };
  const receipt = { schema_version: 2, kind: 'preview_release_receipt', date, state: 'PREVIEW_MERGE_UNCERTAIN', preview_eligible: true,
    execution_authorized: true, merge_attempted: true, source_commit: a, base_commit: b, candidate_digest: digest, artifact_digest: digest,
    policy_digest: policyDigest(policy), validated_runtime: runtime, private_inputs: { attestation_path: attestationPath,
      attestation_sha256: sha256(await readFile(attestationPath)), research_path: researchPath, research_sha256: sha256(await readFile(researchPath)) } };
  const pr = { headRefOid: a, mergeCommit: { oid: 'c'.repeat(40) } };
  return { repoRoot, workspace, manifest, content, receipt, pr, policy, now };
}

test('genuine uncertain merge keeps a resumable intent and rereads exact private evidence', async () => {
  const f = await fixture();
  assert.equal(validResumeReceipt(f.receipt, f.pr, f.policy, date), true);
  assert.deepEqual((await loadResumeEvidence(f)).blockers, []);
});

test('dry-run, stopped, legacy and missing intent receipts cannot authorize resume', async () => {
  const f = await fixture();
  for (const change of [r => { r.execution_authorized = false; }, r => { r.merge_attempted = false; },
    r => { r.state = 'PREVIEW_ELIGIBLE'; }, r => { r.state = 'STOPPED'; }, r => { delete r.schema_version; }]) {
    const receipt = structuredClone(f.receipt); change(receipt);
    assert.equal(validResumeReceipt(receipt, f.pr, f.policy, date), false);
  }
  assert.equal(validResumeReceipt({ ...f.receipt, state: 'PREVIEW_DISPATCH_REQUESTED', merge_commit: f.pr.mergeCommit.oid }, f.pr, f.policy, date), true);
});

test('editing retained research after export blocks a later resumed dispatch', async () => {
  const f = await fixture();
  await mutateEditorialWorkspace({ repoRoot: f.repoRoot, workspace: f.workspace, now, input: {
    expected_revision: 1, operation_id: 'new-finding', blockers: [{ code: 'SOURCE_CORRECTION_REQUIRED', detail: 'Synthetic correction.' }] } });
  const result = await loadResumeEvidence(f);
  assert.ok(result.blockers.includes('WORKSPACE_EXPORT_STALE'));
  assert.ok(result.blockers.includes('WORKSPACE_NOT_READY'));
});

test('replacing exported bytes or letting evidence expire cannot revive a receipt', async () => {
  const changed = await fixture();
  await writeFile(changed.receipt.private_inputs.research_path, '{}');
  assert.deepEqual((await loadResumeEvidence(changed)).blockers, ['RESUME_PRIVATE_INPUTS_CHANGED']);
  const stale = await fixture();
  assert.ok((await loadResumeEvidence({ ...stale, now: new Date('2026-10-27T21:00:00+08:00') })).blockers.includes('STALE_EVIDENCE'));
});

test('private parse failures and forbidden destinations never expose ledger snippets', async () => {
  const f = await fixture(); const bytes = '{"PRIVATE_TEXT_MUST_NOT_ESCAPE":';
  await writeFile(f.receipt.private_inputs.attestation_path, bytes);
  f.receipt.private_inputs.attestation_sha256 = sha256(bytes);
  const invalid = await loadResumeEvidence(f);
  assert.deepEqual(invalid.blockers, ['RESUME_PRIVATE_INPUTS_UNAVAILABLE']);
  assert.ok(!JSON.stringify(invalid).includes('PRIVATE_TEXT_MUST_NOT_ESCAPE'));
  f.receipt.private_inputs.attestation_path = path.join(f.repoRoot, 'private.json');
  await writeFile(f.receipt.private_inputs.attestation_path, bytes);
  assert.deepEqual((await loadResumeEvidence(f)).blockers, ['RESUME_PRIVATE_INPUTS_UNAVAILABLE']);
});

test('saved execute receipts are atomic owner-only files and console display omits inputs', async () => {
  const f = await fixture(); const file = path.join(f.workspace, 'receipt.json');
  await saveReleaseReceipt(file, f.receipt);
  assert.deepEqual(JSON.parse(await readFile(file)), f.receipt);
  assert.equal((await stat(file)).mode & 0o777, 0o600);
  const displayed = displayReleaseReceipt(f.receipt);
  assert.ok(!('private_inputs' in displayed)); assert.ok(!('validated_runtime' in displayed));
});
