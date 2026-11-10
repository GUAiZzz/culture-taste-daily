import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const featurePath = path.join(root, 'src/site/assets/2026-11-10-feature.html');

test('the provisional feature keeps every bilingual story, index entry and image source', async () => {
  const html = await readFile(featurePath, 'utf8');
  const articles = [...html.matchAll(/<article id="([^"]+)">([\s\S]*?)<\/article>/g)];
  assert.equal(articles.length, 34);
  assert.equal(new Set(articles.map(([, id]) => id)).size, 34);
  for (const [, id, body] of articles) {
    assert.ok(html.includes(`href="#${id}"`), `missing index entry: ${id}`);
    assert.match(body, /<h3>中文<\/h3>/, `missing Chinese: ${id}`);
    assert.match(body, /<h3>English<\/h3>/, `missing English: ${id}`);
  }
  const figures = [...html.matchAll(/<figure\b[^>]*>([\s\S]*?)<\/figure>/g)];
  assert.ok(figures.length > 0, 'the feature should retain reviewed images');
  for (const [, figure] of figures) {
    assert.match(figure, /<img\b[^>]*alt="[^"]+"/, 'image needs descriptive alternative text');
    assert.match(figure, /<figcaption>[\s\S]*?<a href="https:\/\//, 'source link must remain visible without JavaScript');
  }
  assert.match(html, /noindex,nofollow/);
  assert.match(html, /非正式 Preview/);
  assert.match(html, /sources and image-use rights remain under review/i);
});

test('the feature is discoverable on the existing homepage', async () => {
  const renderer = await readFile(path.join(root, 'core/rooms/reading-render.mjs'), 'utf8');
  assert.match(renderer, /\/assets\/2026-11-10-feature\.html/);
});
