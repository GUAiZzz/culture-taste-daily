import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { collectPreviewImageFacts, declaredPreviewMedia, previewImagesReadable, verifiedPreviewFallback } from '../scripts/lib/preview-fallback.mjs';
import { settleVisiblePreviewFallbacks } from '../scripts/lib/preview-scroll.mjs';

const imageUrl = 'https://official.example/current-image.jpg';
const originUrl = 'https://official.example/current-event';
const manifest = { stories: [{ sources: [{ relationship: 'first_party_official', url: originUrl }], media: {
  kind: 'source_image', origin_authority: 'first_party_official', rights_basis: 'preview_user_authorized_external',
  external_image_url: imageUrl, origin_url: originUrl,
} }] };
const origins = declaredPreviewMedia([manifest]);
const sample = () => ({ url: imageUrl, external_preview: true, loaded: false, settled: true, alt: 'Official event image',
  fallback: { visible: true, text: 'Official image unavailable; read the linked source.', links: [{ href: originUrl, visible: true }] } });

test('an externally linked Preview image needs declared first-party provenance and an exact visible source link', () => {
  assert.equal(verifiedPreviewFallback(sample(), origins), true);
  for (const change of [
    item => { item.external_preview = false; },
    item => { item.url = 'https://other.example/image.jpg'; },
    item => { item.alt = ''; },
    item => { item.fallback.visible = false; },
    item => { item.fallback.text = ''; },
    item => { item.fallback.links[0].visible = false; },
    item => { item.fallback.links[0].href = 'https://official.example/unrelated'; },
    item => { item.settled = false; },
  ]) { const image = sample(); change(image); assert.equal(verifiedPreviewFallback(image, origins), false); }
  const noOfficialSource = structuredClone(manifest); noOfficialSource.stories[0].sources[0].relationship = 'independent';
  assert.equal(verifiedPreviewFallback(sample(), declaredPreviewMedia([noOfficialSource])), false);
});

test('missing local media, unknown failed frames and missing failure evidence remain failures', () => {
  const facts = { external_preview_images: [sample()], image_failed_frames: 0, failed_visual_frames: [] };
  assert.equal(previewImagesReadable(facts, origins), true);
  assert.equal(previewImagesReadable({ ...facts, broken_images: ['/missing-local.svg'] }, origins), false);
  assert.equal(previewImagesReadable({ ...facts, image_failed_frames: 1 }, origins), false);
  assert.equal(previewImagesReadable({ ...facts, image_failed_frames: 1, failed_visual_frames: [{ external_image_urls: [] }] }, origins), false);
  assert.equal(previewImagesReadable({ ...facts, image_failed_frames: 1, failed_visual_frames: [{ external_image_urls: [imageUrl] }] }, origins), true);
  assert.equal(previewImagesReadable({ ...facts, image_failed_frames: 1, failed_visual_frames: [{ external_image_urls: ['https://other.example/image.jpg'] }] }, origins), false);
});

test('deferred images remain distinct from checked readable fallbacks', () => {
  const image = { ...sample(), settled: false, fallback: { visible: false } };
  const facts = { external_preview_images: [image], image_failed_frames: 0, failed_visual_frames: [], deferred_external_previews: [image.url] };
  assert.equal(previewImagesReadable(facts, origins), false);
  assert.equal(previewImagesReadable(facts, origins, { allowDeferred: true }), true);
});

test('historical image corrections inherit only the exact declared official origin and its host', () => {
  const m = structuredClone(manifest); m.issue_id = '2026-09-04'; m.stories[0].id = 'old-story';
  const key = '2026-09-04/old-story';
  const correction = { [key]: { external_image_url: 'https://official.example/corrected.jpg', origin_url: originUrl, reason: 'Reviewed historical image correction.' } };
  assert.ok(declaredPreviewMedia([m], [], correction).has(correction[key].external_image_url));
  const wrongHost = structuredClone(correction); wrongHost[key].external_image_url = 'https://other.example/image.jpg';
  assert.equal(declaredPreviewMedia([m], [], wrongHost).has(wrongHost[key].external_image_url), false);
  const wrongOrigin = structuredClone(correction); wrongOrigin[key].origin_url = 'https://official.example/unrelated';
  assert.equal(declaredPreviewMedia([m], [], wrongOrigin).has(wrongOrigin[key].external_image_url), false);
  const missingProof = structuredClone(correction); missingProof[key].reason = '';
  assert.equal(declaredPreviewMedia([m], [], missingProof).has(missingProof[key].external_image_url), false);
});

test('inline reading media binds to the exact story, official source, rights disposition and asset host', () => {
  const m = structuredClone(manifest); m.issue_id = '2026-10-28'; m.stories[0].id = 'one-story';
  const key = '2026-10-28/one-story', url = 'https://official.example/detail.jpg';
  const entry = { external_image_url: url, origin_url: originUrl,
    origin_authority: 'first_party_official', rights_basis: 'preview_user_authorized_external',
    alt: 'A verified detail from the same event', credit: 'Official institution' };
  assert.ok(declaredPreviewMedia([m], [], {}, { [key]: [entry] }).has(url));
  for (const patch of [
    { origin_url: 'https://official.example/unrelated' },
    { external_image_url: 'https://unrelated.example/detail.jpg' },
    { origin_authority: 'independent_media' },
    { rights_basis: 'unknown' }, { alt: '' }, { credit: '' },
  ]) {
    const media = { [key]: [{ ...entry, ...patch }] };
    const expectedUrl = media[key][0].external_image_url;
    assert.equal(declaredPreviewMedia([m], [], {}, media).has(expectedUrl), false);
  }
  assert.equal(declaredPreviewMedia([m], [], {}, { '2026-10-28/other-story': [entry] }).has(url), false);
});

let browser;
before(async () => {
  try { browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' }); }
  catch { browser = await chromium.launch({ headless: true }); }
});
after(async () => { await browser?.close(); });

async function observed(html, options = {}) {
  const context = await browser.newContext(options);
  await context.route('https://official.example/**', route => route.abort());
  const page = await context.newPage();
  try {
    await page.setContent(html, { waitUntil: 'load' });
    return await page.evaluate(collectPreviewImageFacts);
  } finally { await context.close(); }
}
const roomFigure = (href = originUrl, attributes = '') => `<figure data-photo data-image="failed"><div><span class="photo-fallback" ${attributes}><b>图像暂未载入</b><span>来源与正文仍可阅读。</span></span><img data-external-preview="true" src="${imageUrl}" alt="Official event image"></div><figcaption><a href="${href}">官方图源</a></figcaption></figure>`;

test('real room fallback remains readable after external transport fails, including without JavaScript', async () => {
  for (const javaScriptEnabled of [true, false]) {
    const facts = await observed(roomFigure(), { javaScriptEnabled });
    assert.equal(facts.external_preview_images[0].loaded, false);
    assert.equal(verifiedPreviewFallback(facts.external_preview_images[0], origins), true);
    assert.equal(previewImagesReadable({ ...facts, image_failed_frames: 0 }, origins), true);
  }
});

test('real DOM fallback rejects hidden explanation and unrelated source destinations', async () => {
  for (const html of [roomFigure('https://official.example/unrelated'), roomFigure(originUrl, 'hidden')]) {
    const facts = await observed(html);
    assert.equal(verifiedPreviewFallback(facts.external_preview_images[0], origins), false);
  }
});

test('V1 failed image with a visible explanation and exact official origin is measured separately', async () => {
  const facts = await observed(`<figure class="story-opening-visual image-failed" data-visual-frame><img data-external-preview="true" src="${imageUrl}" alt="Official event image"><p class="image-failure-note">官方图片未载入，当前显示本地编辑图。</p><figcaption><a href="${originUrl}">查看来源</a></figcaption></figure>`);
  assert.equal(facts.failed_visual_frames.length, 1);
  assert.equal(previewImagesReadable({ ...facts, image_failed_frames: 1 }, origins), true);
});

test('radar image fallback is tied to the visible exact official link, including without JavaScript', async () => {
  const radar = { items: [{ official_url: originUrl, media: { kind: 'image', url: imageUrl,
    origin_authority: 'first_party_official', rights_basis: 'preview_user_authorized_external' } }] };
  const declared = declaredPreviewMedia([], [radar]);
  const markup = href => `<a href="${href}"><span class="extra-thumb"><span class="official-media-fallback">官方图源 ↗</span><img data-external-preview="true" src="${imageUrl}" alt="Official image"></span></a>`;
  for (const javaScriptEnabled of [true, false]) {
    const good = await observed(markup(originUrl), { javaScriptEnabled });
    assert.equal(verifiedPreviewFallback(good.external_preview_images[0], declared), true);
    const bad = await observed(markup('https://official.example/unrelated'), { javaScriptEnabled });
    assert.equal(verifiedPreviewFallback(bad.external_preview_images[0], declared), false);
  }
});

test('QA scrolling triggers the actual reader slow state without accepting an unresolved image early', async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route('https://official.example/**', async route => {
    await new Promise(resolve => setTimeout(resolve, 15_000));
    await route.abort().catch(() => {});
  });
  const page = await context.newPage();
  try {
    const js = await readFile(new URL('../core/rooms/site.js', import.meta.url), 'utf8');
    const start = js.indexOf('function initPhotos('), end = js.indexOf('\ninitPhotos();', start);
    assert.ok(start >= 0 && end > start);
    const handler = js.slice(start, end + '\ninitPhotos();'.length);
    await page.setContent(`<div style="height:2200px"></div>${roomFigure().replace('data-image="failed"', '')}<script>${handler}</script>`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { document.querySelector('img').loading = 'eager'; });
    const before = await page.evaluate(collectPreviewImageFacts);
    assert.equal(verifiedPreviewFallback(before.external_preview_images[0], origins), false);
    await settleVisiblePreviewFallbacks(page);
    const after = await page.evaluate(collectPreviewImageFacts);
    assert.equal(after.external_preview_images[0].loaded, false);
    assert.equal(after.external_preview_images[0].failure_state, true);
    assert.equal(verifiedPreviewFallback(after.external_preview_images[0], origins), true);
  } finally { await context.close(); }
});

test('a slow radar image exposes the linked fallback using the actual reader handler', async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route('https://official.example/**', async route => {
    await new Promise(resolve => setTimeout(resolve, 15_000));
    await route.abort().catch(() => {});
  });
  const page = await context.newPage();
  try {
    const js = await readFile(new URL('../core/rooms/site.js', import.meta.url), 'utf8');
    const start = js.indexOf("document.querySelectorAll('.extra-thumb img')"), end = js.indexOf('\nconst revealed=', start);
    assert.ok(start >= 0 && end > start);
    const markup = `<div style="height:2200px"></div><a href="${originUrl}"><span class="extra-thumb"><span class="official-media-fallback">官方图源 ↗</span><img data-external-preview="true" src="${imageUrl}" alt="Official image" loading="lazy" width="68" height="68"></span></a>`;
    await page.setContent(`${markup}<script>${js.slice(start, end)}</script>`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { document.querySelector('img').loading = 'eager'; });
    const declared = declaredPreviewMedia([], [{ items: [{ official_url: originUrl, media: { kind: 'image', url: imageUrl,
      origin_authority: 'first_party_official', rights_basis: 'preview_user_authorized_external' } }] }]);
    assert.equal(verifiedPreviewFallback((await page.evaluate(collectPreviewImageFacts)).external_preview_images[0], declared), false);
    await settleVisiblePreviewFallbacks(page);
    const result = (await page.evaluate(collectPreviewImageFacts)).external_preview_images[0];
    assert.equal(result.failure_state, true);
    assert.equal(verifiedPreviewFallback(result, declared), true);
  } finally { await context.close(); }
});
