import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { collectPreviewImageFacts, declaredPreviewMedia, previewImagesReadable, verifiedPreviewFallback } from '../scripts/lib/preview-fallback.mjs';

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
