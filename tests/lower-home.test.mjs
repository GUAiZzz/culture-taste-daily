import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { bookmarkLabel, renderBookmarks, renderFurtherSignals, renderReadBack, renderHomeQuote } from '../core/rooms/lower-home.mjs';

const story = (id, index, title = 'An exact <locked> title') => ({ id, index, title, english: { title: `English story ${index + 1}` }, category: index % 2 ? 'fashion' : 'city', media: { external_image_url: `https://official.example/${id}.jpg` } });
const fixture = { date: '2026-10-28', url: '/issues/2026-10-28/', stories: [story('one', 0), story('two', 1), story('three', 2)] };

test('bookmarks preserve order, all exact story destinations and complete titles without requiring JavaScript', () => {
  const html = renderBookmarks(fixture);
  assert.equal((html.match(/class="bookmark-row"/g) || []).length, 2, 'an odd count retains its final story');
  assert.equal((html.match(/class="story story-card bookmark-item"/g) || []).length, 3);
  for (const item of fixture.stories) {
    assert.ok(html.includes(`href="${fixture.url}#story-${item.id}"`));
    assert.ok(html.includes(`data-story-id="${item.id}"`));
    assert.ok(html.includes(item.english.title));
  }
  assert.ok(html.indexOf('#story-one') < html.indexOf('#story-two'));
  assert.ok(html.indexOf('#story-two') < html.indexOf('#story-three'));
  assert.ok(html.includes('An exact &lt;locked&gt; title'));
  assert.match(html, /<details class="home-full-directory ct-details">/);
  assert.doesNotMatch(html, /<details[^>]+\bopen\b/);
  assert.match(html, /data-home-category="fashion"/);
  assert.match(html, /data-story-category="city"/);
  assert.match(html, /3 stories \/ 2 fields/);
});

test('bookmarks do not repeat story photographs and retain ordered, accessible links without JavaScript', () => {
  const html = renderBookmarks(fixture);
  assert.doesNotMatch(html, /<img\b|data-home-photo|official\.example\/[^\"]+\.jpg/);
  for (const item of fixture.stories) {
    const sequence = String(item.index + 1).padStart(2, '0');
    assert.ok(html.includes(`<span class="bookmark-number" aria-hidden="true">${sequence}</span>`));
    assert.ok(html.includes(`aria-label="${sequence} · ${item.title.replaceAll('<', '&lt;').replaceAll('>', '&gt;')}"`));
  }
});

test('approved short labels require the exact locked title, leaving a correction safe', () => {
  const original = story('undercover-valentin-workwear', 1, 'UNDERCOVER为马斯特里赫特家具工坊设计工作服');
  assert.equal(bookmarkLabel(original).meta, 'UNDERCOVER');
  assert.ok(bookmarkLabel(original).zh.includes('工坊里的'));
  const corrected = { ...original, title: 'Corrected workwear story' };
  assert.equal(bookmarkLabel(corrected).zh, corrected.title);
  assert.equal(bookmarkLabel(corrected).meta, null);
  assert.ok(renderBookmarks({ ...fixture, stories: [original] }).includes(original.title));
});

test('further signals use only their own first-party media and remain direct official links', () => {
  const extra = { id: 'a', title: 'Exact <signal>', deck: 'Original fact', publisher: 'Institution', official_url: 'https://official.example/source', event_date: '2026-10-29', media: { kind: 'image', url: 'https://official.example/a.jpg', origin_authority: 'first_party_official' } };
  const html = renderFurtherSignals({ extras: [extra], extraLocale: { a: { titleEn: 'A signal', deckEn: 'English fact' } } });
  assert.ok(html.includes('href="https://official.example/source" target="_blank" rel="noopener noreferrer"'));
  assert.ok(html.includes('src="https://official.example/a.jpg"'));
  assert.ok(html.includes('Exact &lt;signal&gt;'));
  assert.ok(html.includes('English fact'));
  assert.doesNotMatch(html, /发售|Released/, 'generic event dates are not invented release claims');
  const unverified = renderFurtherSignals({ extras: [{ ...extra, media: { ...extra.media, origin_authority: 'independent_publication' } }] });
  assert.ok(!unverified.includes('src="https://official.example/a.jpg"'));
  assert.ok(unverified.includes('href="https://official.example/source"'));
});

test('read-back uses real model dates, counts and original covers; quotations keep their source hooks', async () => {
  const html = renderReadBack([{ date: '2026-09-22', title: 'Original title', en: 'English title', stories: [1, 2], cover: '<svg viewBox="0 0 100 75"><path d="M1 1"/></svg>' }]);
  assert.ok(html.includes('/issues/2026-09-22/?from=home'));
  assert.ok(html.includes('datetime="2026-09-22"'));
  assert.ok(html.includes('2 stories'));
  assert.ok(html.includes('<svg viewBox="0 0 100 75">'));
  const pool = JSON.parse(await readFile(new URL('../core/rooms/daily-quotes.public.json', import.meta.url), 'utf8'));
  const quote = renderHomeQuote(pool, '2026-10-30');
  assert.ok(quote.includes('data-quote-mode="daily"'));
  assert.ok(quote.includes('data-quote-source'));
  assert.ok(quote.includes('data-quote-original'));
  assert.ok(quote.includes('data-quote-translation data-locale-variant="zh"'));
});
