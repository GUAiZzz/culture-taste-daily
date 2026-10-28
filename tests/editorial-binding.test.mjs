import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sha256 } from '../scripts/lib/files.mjs';
import { normalizeEditorialBody, editorialBindingBlockers, validateEditorialBinding } from '../scripts/lib/editorial-binding.mjs';

const now = new Date('2026-10-27T14:00:00+08:00');
const policy = { editorial: { formal_story_count: 10, exact_count_effective_from: '2026-10-12',
  minimum_substantive_sources_per_story: 10, sources_effective_from: '2026-09-16', private_workspace_required: true } };
function fixture(count = 10) {
  const articles = Array.from({ length: count }, (_, i) => ({ story_id: `story-${i}`, title: `Article ${i}`, canonical_event_id: `event-${i}`,
    draft: { markdown: `Synthetic article body ${i}. This is an evidence-binding fixture, not researched content.\n`,
      updated_at: '2026-10-27T13:00:00+08:00' } }));
  for (const article of articles) article.draft.sha256 = sha256(article.draft.markdown);
  const article_sources = articles.map(article => ({ story_id: article.story_id, canonical_event_id: article.canonical_event_id,
    sources: Array.from({ length: 10 }, (_, i) => ({ url: `https://official.example/${article.story_id}/source-${i}`,
      underlying_source_id: `${article.story_id}-${i}`, kind: 'information', actually_read: true, substantive: true,
      supports: ['Synthetic fixture claim'], reading_notes: 'Fixture only, no real reporting.', accessed_at: '2026-10-27T12:00:00+08:00' })) }));
  const state = { target_date: '2026-10-27', revision: 3, articles, article_sources, discoveries: [], blockers: [] };
  const current = { state, workspace: '/private/tmp/ctd-binding-test', digest: 'a'.repeat(64) };
  const privateResearch = { schema_version: 1, kind: 'private_editorial_research', target_date: state.target_date,
    workspace_path: current.workspace, workspace_revision: state.revision, workspace_digest: current.digest,
    article_sources: structuredClone(article_sources), drafts: articles.map(article => ({ story_id: article.story_id,
      sha256: sha256(normalizeEditorialBody(article.draft.markdown)) })) };
  const manifest = { publication_date: state.target_date, stories: articles.map(article => ({ id: article.story_id, title: article.title })) };
  const content = '# Synthetic fixture\n\n' + articles.map(article => `## ${article.title}\n\n${article.draft.markdown}\n`).join('');
  return { now, policy, manifest, content, current, privateResearch };
}

test('current source ledger and exact saved draft bodies bind to public articles', () => {
  assert.deepEqual(editorialBindingBlockers(fixture()), []);
  const f = fixture(); f.content = f.content.replace(/\n/g, '\r\n');
  assert.deepEqual(editorialBindingBlockers(f), []);
});

test('old exports stop after source edits, draft edits or even a new checkpoint revision', () => {
  for (const change of [
    f => { f.current.state.revision += 1; },
    f => { f.current.digest = 'b'.repeat(64); },
    f => { f.current.state.article_sources[0].sources[0].reading_notes = 'Corrected source finding.'; },
    f => { f.current.state.articles[0].draft.markdown = 'Revised draft.'; },
    f => { f.current.state.blockers = [{ code: 'EDITORIAL_CORRECTION', detail: 'Synthetic correction is pending.' }]; },
  ]) { const f = fixture(); change(f); assert.ok(editorialBindingBlockers(f).length); }
});

test('matching old hashes cannot hide a different article or current ledger', () => {
  const source = fixture(); source.privateResearch.article_sources[0].sources[0].reading_notes = 'Old reading claim';
  assert.ok(editorialBindingBlockers(source).includes('WORKSPACE_LEDGER_MISMATCH'));
  const body = fixture(); body.content = body.content.replace('Synthetic article body 0.', 'Changed public text 0.');
  assert.ok(editorialBindingBlockers(body).includes('WORKSPACE_DRAFT_BINDING:story-0'));
  const title = fixture(); title.manifest.stories[0].title = 'Unrelated article';
  assert.ok(editorialBindingBlockers(title).includes('WORKSPACE_DRAFT_BINDING:story-0'));
});

test('missing export metadata, missing drafts and wrong-day workspace fail closed', () => {
  for (const change of [
    f => { delete f.privateResearch.workspace_path; }, f => { delete f.privateResearch.workspace_digest; },
    f => { f.privateResearch.drafts.pop(); }, f => { f.privateResearch.drafts[0].sha256 = null; },
    f => { f.privateResearch.target_date = '2026-10-26'; },
    f => { f.current.state.target_date = '2026-10-26'; },
  ]) { const f = fixture(); change(f); assert.ok(editorialBindingBlockers(f).length); }
});

test('an unready carried draft or incomplete source set cannot reuse a complete export', () => {
  const f = fixture(); f.current.state.articles[0].draft.updated_at = '2026-10-26T13:00:00+08:00';
  assert.ok(editorialBindingBlockers(f).includes('WORKSPACE_NOT_READY'));
  const source = fixture(); source.current.state.article_sources[0].sources[0].actually_read = false;
  source.privateResearch.article_sources = structuredClone(source.current.state.article_sources);
  assert.ok(editorialBindingBlockers(source).includes('WORKSPACE_NOT_READY'));
});

const scratch = await mkdtemp(path.join(tmpdir(), 'ctd-binding-io-'));
after(() => rm(scratch, { recursive: true, force: true }));
test('release re-reads private state and treats missing or forbidden workspace as unavailable', async () => {
  const repoRoot = path.join(scratch, 'public'); await mkdir(repoRoot);
  const f = fixture();
  assert.deepEqual(await validateEditorialBinding({ ...f, repoRoot, privateResearch: {} }), ['PRIVATE_WORKSPACE_REQUIRED']);
  assert.deepEqual(await validateEditorialBinding({ ...f, repoRoot,
    privateResearch: { ...f.privateResearch, workspace_path: path.join(scratch, 'missing') } }), ['WORKSPACE_BINDING_UNAVAILABLE']);
  assert.deepEqual(await validateEditorialBinding({ ...f, repoRoot,
    privateResearch: { ...f.privateResearch, workspace_path: repoRoot } }), ['WORKSPACE_BINDING_UNAVAILABLE']);
});

test('A3 binding covers every article in an eleven/twelve-story cumulative update', () => {
  for (const count of [11, 12]) {
    const f = JSON.parse(JSON.stringify(fixture(count)).replaceAll('2026-10-27', '2026-10-28'));
    f.now = new Date('2026-10-28T14:00:00+08:00');
    f.policy.editorial.minimum_formal_story_count = 10;
    f.policy.editorial.minimum_count_effective_from = '2026-10-28';
    assert.deepEqual(editorialBindingBlockers(f), []);
    f.current.state.article_sources[count - 1].sources[9].actually_read = false;
    f.privateResearch.article_sources = structuredClone(f.current.state.article_sources);
    assert.ok(editorialBindingBlockers(f).includes('WORKSPACE_NOT_READY'));
  }
});
