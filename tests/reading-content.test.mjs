import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseStoryContent, paragraphCount, renderWithInsertions, validateReadingMedia, validateQuotePool, selectDailyQuote, loadReadingModel } from '../core/rooms/reading-content.mjs';
import { buildReadingSystem } from '../core/rooms/reading-render.mjs';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const json = async file => JSON.parse(await readFile(path.join(repoRoot, file), 'utf8'));
const sourceIssues = async () => {
  const result = [];
  for (const issueId of (await readdir(path.join(repoRoot, 'src/issues'))).filter(date => date >= '2026-08-25').sort()) {
    const prefix = `src/issues/${issueId}`;
    const manifest = await json(`${prefix}/issue-manifest.public.json`);
    let dailyRadar;
    try { dailyRadar = await json(`${prefix}/daily-radar.public.json`); } catch (error) { if (error.code !== 'ENOENT') throw error; dailyRadar = await json(`${prefix}/retrospective-index.public.json`); }
    result.push({ issueId, manifest, content: await readFile(path.join(repoRoot, prefix, 'content.md'), 'utf8'), dailyRadar });
  }
  return result;
};

test('bilingual parsing preserves a source block before the English text', () => {
  const source = 'AN ENGLISH TITLE\n\n### 中文\n\n第一段。[注](https://example.com/context)\n\n第二段。\n\n来源：\n\n- [原始资料](https://example.com/source)（原署名）\n\n### English\n\nThe first paragraph.\n\nThe second paragraph.';
  const parsed = parseStoryContent(source, { title: 'AN ENGLISH TITLE', deck: 'Do not append this deck.', abstract: 'Do not append this abstract.' });
  assert.equal(parsed.zhMarkdown, '第一段。[注](https://example.com/context)\n\n第二段。');
  assert.equal(parsed.enMarkdown, 'The first paragraph.\n\nThe second paragraph.');
  assert.equal(parsed.sourcesMarkdown, '- [原始资料](https://example.com/source)（原署名）');
  assert.ok(!parsed.enHtml.includes('Do not append'));
  assert.ok(!parsed.zhHtml.includes('原始资料'));
});

test('legacy articles keep their Chinese text and expose one bounded English layer', () => {
  const parsed = parseStoryContent('正文第一段。\n\n正文第二段。\n\n来源：[资料](https://example.com/)', { title: 'TITLE', deck: 'One abstract.', abstract: 'One abstract.' });
  assert.equal(parsed.zhMarkdown, '正文第一段。\n\n正文第二段。');
  assert.equal(parsed.enMarkdown, 'One abstract.');
  assert.equal(parsed.hasFullEnglish, false);
  assert.throws(() => parseStoryContent('### 中文\n\n中文却没有英文分块。'), /Incomplete bilingual/);
});

test('inline figures enter between top-level paragraphs without changing text or links', () => {
  const input = '第一段。\n\n> 引用内的一段。\n\n第二段。[原文](https://example.com/)\n\n第三段。';
  assert.equal(paragraphCount(input), 3);
  const plain = renderWithInsertions(input);
  const enhanced = renderWithInsertions(input, new Map([[2, '<figure data-test>作品图</figure>']]));
  assert.equal(enhanced.replace('<figure data-test>作品图</figure>', ''), plain);
  assert.match(enhanced, /第二段[\s\S]*?<\/p>\s*<figure data-test>/);
});

test('quote pool attribution and day mapping are validated and deterministic', async () => {
  const pool = await json('core/rooms/daily-quotes.public.json');
  assert.equal(validateQuotePool(pool).quotes.length, 7);
  const first = selectDailyQuote(pool, '2026-10-28');
  assert.equal(first.id, 'wilde-dorian-gray-preface-1891');
  assert.equal(selectDailyQuote(pool, '2026-11-04').id, first.id);
  assert.equal(selectDailyQuote(pool, '2026-10-27').id, pool.quotes.at(-1).id);
  assert.throws(() => selectDailyQuote(pool, '2026-02-30'));
  const missingAttribution = structuredClone(pool); delete missingAttribution.quotes[0].sourceTitle;
  assert.throws(() => validateQuotePool(missingAttribution), /Missing quote sourceTitle/);
  const duplicate = structuredClone(pool); duplicate.quotes.push(duplicate.quotes[0]);
  assert.throws(() => validateQuotePool(duplicate), /Duplicate/);
});

test('reading model preserves every locked story, source footer, order and hash', async () => {
  const validatedIssues = await sourceIssues();
  const before = JSON.stringify(validatedIssues);
  const model = await loadReadingModel({ repoRoot, validatedIssues, publicationIssues: [] });
  assert.equal(JSON.stringify(validatedIssues), before, 'public inputs were mutated');
  assert.equal(model.issues.length, validatedIssues.filter(issue => issue.manifest.visibility !== 'future_draft').length);
  for (const issue of model.issues) {
    const source = validatedIssues.find(item => item.issueId === issue.date);
    assert.equal(createHash('sha256').update(issue.raw).digest('hex'), source.manifest.content_lock.sha256);
    assert.equal(issue.hash, source.manifest.source_hashes.content_sha256);
    assert.deepEqual(issue.stories.map(story => story.id), source.manifest.stories.map(story => story.id));
    for (const story of issue.stories) {
      assert.deepEqual(story.sources, source.manifest.stories[story.index].sources);
      assert.ok(story.zhMarkdown.length > 0);
      assert.ok(story.enMarkdown.length > 0);
      assert.ok(!story.zhHtml.includes('### 中文'));
      assert.ok(!story.enHtml.includes('### English'));
    }
  }
  assert.equal(model.latest.date, '2026-10-28');
  assert.equal(model.latest.stories.length, 10);
  assert.equal(model.latest.stories.filter(story => story.hasFullEnglish).length, 10);
  assert.deepEqual(model.latest.stories.map(story => story.inlineMedia.length), [2, 2, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.match(model.latest.stories[8].enMarkdown, /The Teardrop Throbs/);
});

test('inline-media input fails closed on unbound source, rights, duplicates and paragraph position', async () => {
  const model = await loadReadingModel({ repoRoot, validatedIssues: await sourceIssues(), publicationIssues: [] });
  const story = model.latest.stories[0], rows = structuredClone(story.inlineMedia);
  assert.equal(validateReadingMedia(rows, story), rows);
  for (const [field, value, expected] of [
    ['origin_url', 'https://unrelated.example.com/exhibition/', /bound first-party/],
    ['rights_basis', 'found_online', /provenance/],
    ['after_zh_paragraph', 900, /after_zh_paragraph/],
    ['after_en_paragraph', 0, /after_en_paragraph/],
    ['external_image_url', 'http://www.nact.jp/image.jpg', /HTTPS/],
    ['external_image_url', 'https://unrelated.example.com/image.jpg', /image host/],
    ['credit', '', /Missing inline credit/],
  ]) {
    const changed = structuredClone(rows); changed[0][field] = value;
    assert.throws(() => validateReadingMedia(changed, story), expected);
  }
  assert.throws(() => validateReadingMedia([rows[0], rows[0]], story), /Repeated inline image/);
  assert.throws(() => validateReadingMedia([{ ...rows[0], external_image_url: story.media.external_image_url }], story), /Repeated inline image/);
});

test('new issues require actual bilingual source blocks rather than metadata summaries', async () => {
  const current = (await sourceIssues()).find(issue => issue.issueId === '2026-10-28');
  current.content = current.content.replace(/^### (?:中文|English)\s*$/gm, '');
  await assert.rejects(loadReadingModel({ repoRoot, validatedIssues: [current], publicationIssues: [] }), /Complete source-authored English/);
});

test('historical archive metadata keeps verified categories, counts and untouched original hashes', async () => {
  const dates = ['2026-08-20', '2026-08-21', '2026-08-22'];
  const publicationIssues = await Promise.all(dates.map(async date => ({ ...await json(`src/historical/${date}/meta.json`), preservation_kind: 'historical_original' })));
  const originals = await Promise.all(publicationIssues.map(issue => readFile(path.join(repoRoot, 'src/historical', issue.issue_id, issue.original_file))));
  const model = await loadReadingModel({ repoRoot, validatedIssues: await sourceIssues(), publicationIssues });
  assert.deepEqual(model.preserved.map(issue => issue.article_count), [10, 8, 8]);
  assert.deepEqual(model.preserved.map(issue => issue.count_label), ['7 篇长读 · 3 则短讯', '8 篇文章', '8 则选读 · 16 页原件']);
  for (const [index, issue] of model.preserved.entries()) {
    assert.deepEqual(new Set(issue.categories), new Set(['fashion', 'music', 'objects', 'city']));
    assert.equal(createHash('sha256').update(originals[index]).digest('hex'), publicationIssues[index].source_sha256);
    assert.equal(issue.stories, undefined, 'historical reader paths must not be invented');
  }
});

test('served pages include complete source content, stable issue boundaries and cache-versioned shared assets', async t => {
  const validatedIssues = await sourceIssues();
  const model = await loadReadingModel({ repoRoot, validatedIssues, publicationIssues: [] });
  const outDir = await mkdtemp(path.join(tmpdir(), 'ct-reading-content-test-'));
  t.after(() => rm(outDir, { recursive: true, force: true }));
  const publicationIssues = model.issues.map(issue => ({ issue_id: issue.date, title: issue.title, stories: issue.stories }));
  for (const date of ['2026-08-20', '2026-08-21', '2026-08-22']) publicationIssues.push({ ...await json(`src/historical/${date}/meta.json`), preservation_kind: 'historical_original' });
  await buildReadingSystem({ repoRoot, outDir, validatedIssues, publicationIssues });
  const home = await readFile(path.join(outDir, 'index.html'), 'utf8');
  assert.equal((home.match(/class="ct-story-entry story-open"/g) || []).length, model.latest.stories.length);
  assert.match(home, /data-quote-mode="daily"/);
  assert.match(home, /rooms\/reading-system\.js\?v=[a-f0-9]{12}/);
  assert.match(home, /data-style="field"/);
  for (const layer of ['paper-atmosphere', 'reading-tv-surface', 'tv-screen-edge']) assert.match(home, new RegExp(`<div class="${layer}" aria-hidden="true"></div>`));
  const compiledCss = await readFile(path.join(outDir, 'rooms/reading-system.css'), 'utf8');
  assert.match(compiledCss, /text-ink\.svg\?v=[a-f0-9]{12}/);
  assert.equal((home.match(/data-pref-style="/g) || []).length, 3);
  const archive = await readFile(path.join(outDir, 'archive/index.html'), 'utf8');
  for (const date of ['2026-08-20', '2026-08-21', '2026-08-22']) {
    assert.match(archive, new RegExp(`id="issue-${date}"[^>]*data-categories="[^"]+"`));
  }
  assert.ok(archive.includes('7 篇长读 · 3 则短讯'));
  assert.ok(archive.includes('8 则选读 · 16 页原件'));
  for (const issue of model.issues) {
    const issueHtml = await readFile(path.join(outDir, issue.url, 'index.html'), 'utf8');
    assert.match(issueHtml, /data-quote-mode="static"/);
    for (const story of issue.stories) {
      const html = await readFile(path.join(outDir, story.url, 'index.html'), 'utf8');
      for (const paragraph of story.zhHtml.match(/<p>[\s\S]*?<\/p>/g) || []) assert.ok(html.includes(paragraph), `${issue.date}/${story.id}: missing locked paragraph`);
      assert.ok(html.includes(story.enHtml), `${issue.date}/${story.id}: missing English`);
      assert.equal(html.split(story.enHtml).length - 1, 1, `${story.id}: duplicated English`);
      const withoutAddedMetadata = html.replace(/<small class="source-metadata">[\s\S]*?<\/small>/g, '');
      assert.ok(withoutAddedMetadata.includes(renderWithInsertions(story.sourcesMarkdown)), `${story.id}: missing original source footer or notes`);
      for (const source of story.sources) {
        if (source.published_date) assert.ok(html.includes('发布 ' + source.published_date), `${story.id}: missing source publication date`);
        if (source.event_date) assert.ok(html.includes('活动 ' + source.event_date), `${story.id}: missing source event date`);
      }
      assert.match(html, /Sources &amp; Dates/);
      assert.match(html, /id="reading-settings"/);
      assert.ok(html.includes('#story-' + story.id));
      if (story.index === 0) assert.match(html, /这是本期第一篇/);
      if (story.index === issue.stories.length - 1) assert.match(html, /这是本期最后一篇/);
    }
  }
});
