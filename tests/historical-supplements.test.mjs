import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { HISTORICAL_DATES, historicalAuthorizationDigest, historicalPreviewPolicy,
  isAuthorizedHistoricalDate, historicalPackageBlockers, historicalSourceBlockers } from '../scripts/lib/historical-supplements.mjs';
import { evaluatePreview, RESEARCH_CHECKS, policyDigest } from '../scripts/lib/preview-policy.mjs';

const authorization = JSON.parse(await readFile(new URL('../automation/historical-supplements.json', import.meta.url)));
const dailyPolicy = JSON.parse(await readFile(new URL('../automation/daily-policy.json', import.meta.url)));
const now = new Date('2026-10-15T13:00:00+08:00');
function fixture() {
  const date = '2026-09-12', prepared = '2026-10-15T10:00:00+08:00';
  const zh = `历史补刊：覆盖 ${date}，实际制作日期 2026-10-15。`;
  const en = `Retrospective: coverage ${date}, prepared 2026-10-15.`;
  const stories = Array.from({ length: 10 }, (_, i) => ({ id: `story-${i}`, title: `Article ${i}`, level: i ? 'signal' : 'cover',
    english: { title: `English ${i}`, deck: en + ' Evidence-bounded account.', abstract: 'An account with an explicit retrospective boundary.' },
    sources: Array.from({ length: 10 }, (_, n) => ({ url: `https://source.example/${i}/${n}` })),
  }));
  const manifest = { publication_date: date, candidate_created_at: prepared, research_locked_at: '2026-10-15T12:00:00+08:00',
    content_locked_at: '2026-10-15T12:01:00+08:00', content_lock: { locked_at: '2026-10-15T12:01:00+08:00' },
    editorial_position: '历史补刊，保留实际研究日期。', stories,
    historical_supplement: { kind: 'historical_supplement', authorization_id: authorization.authorization_id, coverage_date: date,
      prepared_at: prepared, disclosure_zh: zh, disclosure_en: en },
  };
  const content = `# 历史补刊\n\n${zh}\n${en}\n` + stories.map(s => `\n## ${s.title}\n\n${zh}\nEvidence-backed reporting.\n`).join('');
  const privateResearch = { article_sources: stories.map(s => ({ story_id: s.id, canonical_event_id: `event-${s.id}`, sources: s.sources.map((r, n) => ({
    url: r.url, underlying_source_id: `${s.id}-${n}`, kind: 'information', actually_read: true, substantive: true,
    accessed_at: '2026-10-15T11:00:00+08:00', supports: ['Specific reported fact in this test fixture.'], reading_notes: 'Fixture for gate behavior, not publication evidence.',
  })) })) };
  return { manifest, content, privateResearch, authorization, now };
}
test('bounded authority includes exactly the 26 missing dates and no live issue', () => {
  assert.equal(HISTORICAL_DATES.length, 26);
  for (const date of HISTORICAL_DATES) assert.equal(isAuthorizedHistoricalDate(authorization, date), true);
  for (const date of ['2026-09-08', '2026-09-22', '2026-10-15']) assert.equal(isAuthorizedHistoricalDate(authorization, date), false);
  assert.equal(isAuthorizedHistoricalDate({ ...authorization, authorized_dates: [...HISTORICAL_DATES, '2026-09-08'] }, '2026-09-12'), false);
  assert.equal(isAuthorizedHistoricalDate({ ...authorization, authorized_at: '2026-09-01T12:00:00+08:00' }, '2026-09-12'), false);
});
test('complete disclosed package and read-source records validate', () => {
  assert.deepEqual(historicalPackageBlockers(fixture()), []);
  assert.deepEqual(historicalSourceBlockers(fixture()), []);
});
test('nine or eleven formal articles fail independently of sources', () => {
  for (const count of [9, 11]) { const f = fixture(); f.manifest.stories = Array.from({length: count}, (_, i) => f.manifest.stories[i % 10]);
    assert.ok(historicalPackageBlockers(f).includes('FORMAL_STORY_COUNT_MISMATCH')); }
});
test('backdated research, future preparation and missing article disclosure fail', () => {
  for (const change of [f => { f.manifest.research_locked_at = '2026-09-12T12:00:00+08:00'; },
    f => { f.manifest.historical_supplement.prepared_at = '2026-10-16T10:00:00+08:00'; },
    f => { f.content = f.content.replace('## Article 4\n\n' + f.manifest.historical_supplement.disclosure_zh, '## Article 4\n\nHidden disclosure.'); },
    f => { f.manifest.stories[0].level = 'watch'; }]) {
    const f = fixture(); change(f); assert.ok(historicalPackageBlockers(f).length); }
});
test('tracking links and fragments never create extra information sources', () => {
  const f = fixture(); f.manifest.stories[0].sources[9].url = f.manifest.stories[0].sources[0].url + '?utm_source=feed#credit';
  assert.ok(historicalPackageBlockers(f).includes('SUBSTANTIVE_SOURCE_COUNT_MISMATCH:story-0'));
});
test('duplicate article identities and repeated underlying events cannot pad ten stories', () => {
  const packageInput=fixture();packageInput.manifest.stories[9].id=packageInput.manifest.stories[0].id;
  assert.ok(historicalPackageBlockers(packageInput).includes('FORMAL_STORY_IDENTITY_MISMATCH'));
  const sourceInput=fixture();sourceInput.privateResearch.article_sources[9].canonical_event_id=sourceInput.privateResearch.article_sources[0].canonical_event_id;
  assert.ok(historicalSourceBlockers(sourceInput).includes('EVENT_DEDUPLICATION_FAILED:story-9'));
});
test('unread, credit-only, duplicate underlying sources and out-of-lock access do not count', () => {
  for (const change of [s => { s.actually_read = false; }, s => { s.kind = 'image_credit'; }, s => { s.supports = []; },
    s => { s.underlying_source_id = 'story-0-0'; }, s => { s.accessed_at = '2026-10-15T12:30:00+08:00'; }]) {
    const f = fixture(); change(f.privateResearch.article_sources[0].sources[9]);
    assert.ok(historicalSourceBlockers(f).includes('SUBSTANTIVE_SOURCE_COUNT_MISMATCH:story-0')); }
});
function releaseFixture() {
  const sha = 'a'.repeat(40), base = 'b'.repeat(40), digest = 'c'.repeat(64), date = '2026-09-12';
  const policy = historicalPreviewPolicy(dailyPolicy, authorization);
  return { now, policy, evidence: { schema_version: 1, kind: 'preview_run_attestation', target_date: date,
    source_commit: sha, base_commit: base, candidate_digest: digest, artifact_digest: digest, policy_digest: policyDigest(policy),
    checked_at: '2026-10-15T12:30:00+08:00', historical_supplement: { authorization_id: authorization.authorization_id, authorization_digest: historicalAuthorizationDigest(authorization) },
    research: { complete: true, private_evidence_sha256: digest, harrytone_commit: sha, checks: [...RESEARCH_CHECKS], within_production_window: false },
    health: { source_pages: [{url:'https://source.example/detail',status:'PASS'}],media:[{url:'https://source.example/media',
      provenance_verified_at:'2026-10-15T12:00:00+08:00',linked_origin:true,fallback_verified:true,status:'PASS',production_rights:'unknown'}] } },
    runtime: { repository: 'GUAiZzz/culture-taste-daily',base_ref:'preview-build-v1',branch:`automation/culture-taste-${date}`,
      source_commit:sha,base_commit:base,candidate_digest:digest,artifact_digest:digest,scope_ok:true,clean:true,harrytone_commit:sha,
      private_evidence_matches:true,technical_qa:'PASS',deterministic:true,privacy_scan:'PASS',ci:'success',push_permission:true,
      package_complete:true,source_urls:['https://source.example/detail'],media_urls:['https://source.example/media'],
      formal_story_count:10,historical_supplement_valid:true,historical_supplement_blockers:[],already_live_historical_date:false } };
}
test('historical release retains current-day provenance and every ordinary fail-closed gate', () => {
  const f=releaseFixture(); const result=evaluatePreview(f); assert.equal(result.preview_eligible,true);assert.equal(result.production_eligible,false);
  for(const change of [i=>{i.runtime.ci='failure';},i=>{i.runtime.technical_qa='FAIL';},i=>{i.runtime.privacy_scan='FAIL';},
    i=>{i.evidence.research.complete=false;},i=>{i.runtime.already_live_historical_date=true;},i=>{i.runtime.formal_story_count=2;},
    i=>{i.evidence.historical_supplement.authorization_digest='wrong';},i=>{i.evidence.health.media[0].provenance_verified_at='2026-09-12T12:00:00+08:00';}]) {
    const i=releaseFixture();change(i);assert.equal(evaluatePreview(i).preview_eligible,false); }
});
test('ordinary past-dated releases cannot borrow the supplement authority implicitly', () => {
  const f=releaseFixture();delete f.evidence.historical_supplement;assert.equal(evaluatePreview(f).preview_eligible,false);
  f.policy=dailyPolicy;f.evidence.policy_digest=policyDigest(dailyPolicy);assert.equal(evaluatePreview(f).preview_eligible,false);
});
