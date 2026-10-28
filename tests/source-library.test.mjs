import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { sourcePlan, validateSourceLibrary } from '../scripts/lib/source-library.mjs';
const library = JSON.parse(await readFile(new URL('../automation/source-library.json', import.meta.url)));
const radar = JSON.parse(await readFile(new URL('../automation/brand-radar.json', import.meta.url)));
const now = new Date('2026-10-27T17:00:00+08:00'), date = '2026-10-27';
test('all 99 subjects have explicit identity state; entrypoints never imply a completed scan', () => {
  assert.deepEqual(validateSourceLibrary(library, radar), []);
  const report = sourcePlan({ library, radar, date, now });
  assert.equal(report.total_subjects, 99); assert.equal(report.checked_subjects, 0);
  assert.equal(report.completed_research_attestation, false); assert.equal(report.publication_authority, false);
  assert.ok(report.unresolved_identities > 0);
});
test('inaccessible official profile is an access gap and requests a different route', () => {
  const subject = library.subjects.find(s => s.name === 'Human Made');
  const scan = [{ subject_id: subject.id, route_url: subject.routes[0].url, result: 'ACCESS_LIMITED', notes: 'Synthetic access failure', checked_at: '2026-10-27T13:00:00+08:00' }];
  const report = sourcePlan({ library, radar, date, now, scan });
  assert.equal(report.access_limited_subjects, 1);
  assert.equal(report.subjects.find(s => s.id === subject.id).next_action, 'USE_ALTERNATIVE_ROUTE');
  assert.equal(report.completed_research_attestation, false);
});
test('an early failed route cannot keep the scan queue from advancing to unchecked subjects', () => {
  const subject = library.subjects[0];
  const report = sourcePlan({ library, radar, date, now, scan: [{ subject_id: subject.id, route_url: subject.routes[0].url,
    result: 'ACCESS_LIMITED', notes: 'Synthetic failure', checked_at: '2026-10-27T13:00:00+08:00' }] });
  assert.notEqual(report.next_subject, subject.id);
  assert.equal(report.next_subject, library.subjects[1].id);
});
test('stale/future/unknown-route records and a found result without details cannot fill scan coverage', () => {
  const subject = library.subjects.find(s => s.routes.length), route_url = subject.routes[0].url;
  for (const fields of [
    { checked_at: '2026-10-26T13:00:00+08:00' }, { checked_at: '2026-10-28T13:00:00+08:00' },
    { route_url: 'https://unrelated.example/route' }, { result: 'FOUND', detail_urls: [] },
  ]) {
    const scan = [{ subject_id: subject.id, route_url, result: 'NO_NEW_SIGNAL', notes: 'Synthetic only', checked_at: '2026-10-27T13:00:00+08:00', ...fields }];
    assert.equal(sourcePlan({ library, radar, date, now, scan }).checked_subjects, 0);
  }
});
test('route identity cannot be justified by an Instagram profile alone', () => {
  const invalid = structuredClone(library), subject = invalid.subjects.find(s => s.routes.some(r => r.kind === 'official_instagram'));
  const route = subject.routes.find(r => r.kind === 'official_instagram'); route.identity_evidence_url = route.url;
  assert.ok(validateSourceLibrary(invalid, radar).includes(`SOURCE_ROUTE_IDENTITY:${subject.id}`));
});
test('social destinations, identity evidence and institutional routes are validated', () => {
  for (const mutate of [
    lib => { lib.subjects.find(s => s.routes.some(r => r.kind === 'official_instagram')).routes.find(r => r.kind === 'official_instagram').url = 'https://unrelated.example/profile'; },
    lib => { lib.subjects.find(s => s.routes.length).routes[0].identity_evidence_url = 'https://user:secret@example.invalid/proof'; },
    lib => { lib.additional_sources[0].routes[0].url = 'http://example.invalid/institution'; },
  ]) {
    const invalid = structuredClone(library); mutate(invalid); assert.ok(validateSourceLibrary(invalid, radar).length);
  }
});
