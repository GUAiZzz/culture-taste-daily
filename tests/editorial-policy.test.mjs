import assert from 'node:assert/strict';
import { test } from 'node:test';
import { editorialRequirements, editorialPackageBlockers, editorialSourceReport,
  editorialBlockers, substantiveInformationUrl } from '../scripts/lib/editorial-policy.mjs';

const policy = { editorial: { formal_story_count: 10, exact_count_effective_from: '2026-10-12',
  minimum_substantive_sources_per_story: 10, sources_effective_from: '2026-09-16' } };
const now = new Date('2026-10-27T14:00:00+08:00');
function fixture() {
  const stories = Array.from({ length: 10 }, (_, i) => ({ id: `story-${i}`, title: `正式文章 ${i}`,
    level: i ? 'signal' : 'cover', english: { title: `Article ${i}`, deck: 'A bounded account.', abstract: 'Verified context, with uncertainty retained.' },
    sources: Array.from({ length: 10 }, (_, n) => ({ url: `https://official.example/story-${i}/source-${n}` })),
  }));
  return { policy, now, manifest: { publication_date: '2026-10-27', stories,
    candidate_created_at: '2026-10-27T11:00:00+08:00', research_locked_at: '2026-10-27T13:00:00+08:00',
    content_locked_at: '2026-10-27T13:15:00+08:00', content_lock: { locked_at: '2026-10-27T13:15:00+08:00' } },
    content: '# Test fixture\n\n' + stories.map(story => `## ${story.title}\n\n这是测试文章的完整正文占位，仅用于校验流程，不是事实或可发布内容。\n`).join('\n'),
    privateResearch: { article_sources: stories.map(story => ({ story_id: story.id, canonical_event_id: `event-${story.id}`,
      sources: story.sources.map((source, index) => ({ url: source.url, kind: 'information', actually_read: true, substantive: true,
        underlying_source_id: `${story.id}-${index}`, supports: ['Explicit fact supported in this synthetic test.'],
        reading_notes: 'Synthetic test notes; not publication evidence.', accessed_at: '2026-10-27T12:00:00+08:00' })),
    })) } };
}

test('ordinary complete package and per-story read ledgers share one validator', () => {
  const f = fixture();
  assert.deepEqual(editorialBlockers(f), []);
  assert.deepEqual(editorialSourceReport(f).stories.map(story => story.qualifying_source_count), Array(10).fill(10));
});

test('count and per-story source requirements have separate effective dates', () => {
  assert.equal(editorialRequirements(policy, '2026-09-15').minimum_sources_per_story, 0);
  assert.equal(editorialRequirements(policy, '2026-09-16').minimum_sources_per_story, 10);
  assert.equal(editorialRequirements(policy, '2026-10-11', { unpublished: false }).exact_story_count, null);
  assert.equal(editorialRequirements(policy, '2026-10-08').exact_story_count, 10);
  assert.equal(editorialRequirements(policy, '2026-10-12').exact_story_count, 10);
  assert.equal(editorialRequirements({ editorial: { ...policy.editorial, formal_story_count: 2 } }, '2026-10-27').policy_valid, false);
});

test('two, nine and eleven articles cannot be disguised by radar or source counts', () => {
  for (const count of [2, 9, 11]) {
    const f = fixture();
    f.manifest.stories = Array.from({ length: count }, (_, i) => f.manifest.stories[i % 10]);
    f.manifest.radar = Array(20).fill({ title: 'supplemental signal' });
    assert.ok(editorialPackageBlockers(f).includes('FORMAL_STORY_COUNT_MISMATCH'));
  }
});

test('duplicate identities, missing story bodies and incomplete English stop the package', () => {
  for (const change of [
    f => { f.manifest.stories[9].id = f.manifest.stories[0].id; },
    f => { f.manifest.stories[9].title = f.manifest.stories[0].title; },
    f => { f.content = f.content.replace('## 正式文章 9', '## Removed'); },
    f => { f.content += '\n## 正式文章 9\nDuplicate section.'; },
    f => { f.manifest.stories[0].english.deck = ' '; },
    f => { f.manifest.stories[0].level = 'watch'; },
  ]) { const f = fixture(); change(f); assert.ok(editorialPackageBlockers(f).length); }
});

test('credit, discovery, search and profile URLs never count as information reads', () => {
  for (const url of ['https://official.example/', 'https://official.example/image.jpg',
    'https://official.example/search?q=project', 'https://www.google.com/search?q=project',
    'https://www.instagram.com/officialbrand/']) assert.throws(() => substantiveInformationUrl(url));
  assert.equal(substantiveInformationUrl('https://www.instagram.com/p/OfficialPost/'), 'https://www.instagram.com/p/OfficialPost');
  for (const url of ['https://official.example/', 'https://official.example/image.jpg']) {
    const f = fixture(); f.manifest.stories[0].sources[9].url = url; f.privateResearch.article_sources[0].sources[9].url = url;
    assert.ok(editorialBlockers(f).includes('SUBSTANTIVE_SOURCE_COUNT_MISMATCH:story-0'));
  }
});

test('tracking links, fragments and repeated underlying material cannot pad a source set', () => {
  for (const change of [
    f => { const url = f.manifest.stories[0].sources[0].url + '?utm_source=feed#caption'; f.manifest.stories[0].sources[9].url = url; f.privateResearch.article_sources[0].sources[9].url = url; },
    f => { f.privateResearch.article_sources[0].sources[9].underlying_source_id = ' STORY-0-0 '; },
  ]) { const f = fixture(); change(f); assert.equal(editorialSourceReport(f).stories[0].qualifying_source_count, 9); }
});

test('unread, nonsubstantive and unsupported sources are excluded independently', () => {
  for (const change of [
    source => { source.actually_read = false; }, source => { source.kind = 'image_credit'; },
    source => { source.substantive = false; }, source => { source.supports = []; },
    source => { source.reading_notes = ''; }, source => { source.discovery_only = true; },
    source => { source.url = 'https://other.example/unpublished'; },
  ]) {
    const f = fixture(); change(f.privateResearch.article_sources[0].sources[9]);
    assert.equal(editorialSourceReport(f).stories[0].qualifying_source_count, 9);
    assert.ok(editorialBlockers(f).includes('SUBSTANTIVE_SOURCE_COUNT_MISMATCH:story-0'));
  }
});

test('repeated underlying events and missing or malformed ledgers stop release', () => {
  const event = fixture(); event.privateResearch.article_sources[9].canonical_event_id = ' EVENT-STORY-0 ';
  assert.ok(editorialSourceReport(event).blockers.includes('EVENT_DEDUPLICATION_FAILED:story-9'));
  for (const ledger of [undefined, {}, { article_sources: 'invalid' }, { article_sources: [] }]) {
    const f = fixture(); f.privateResearch = ledger; assert.ok(editorialSourceReport(f).blockers.length);
  }
  const duplicate = fixture(); duplicate.privateResearch.article_sources.push(duplicate.privateResearch.article_sources[0]);
  assert.ok(editorialSourceReport(duplicate).blockers.includes('SOURCE_LEDGER_MISSING:story-0'));
});

test('each source must have an honest +08 timestamp before research lock and now', () => {
  for (const accessed_at of ['2026-10-27T13:30:00+08:00', '2026-10-28T12:00:00+08:00', '2026-10-27T04:00:00Z', 'not-a-date']) {
    const f = fixture(); f.privateResearch.article_sources[0].sources[9].accessed_at = accessed_at;
    assert.equal(editorialSourceReport(f).stories[0].qualifying_source_count, 9);
  }
  const f = fixture(); f.manifest.research_locked_at = '2026-10-28T13:00:00+08:00';
  assert.ok(editorialPackageBlockers(f).includes('EDITORIAL_ACTUAL_TIMESTAMPS'));
});

test('unlocked checkpoints can report provisional reads without granting final eligibility', () => {
  const f = fixture(); delete f.manifest.research_locked_at;
  const report = editorialSourceReport({ ...f, allowUnlocked: true });
  assert.equal(report.provisional, true); assert.equal(report.stories[0].qualifying_source_count, 10);
  assert.equal(editorialSourceReport(f).stories[0].qualifying_source_count, 0);
  assert.ok(editorialBlockers(f).includes('EDITORIAL_ACTUAL_TIMESTAMPS'));
});
