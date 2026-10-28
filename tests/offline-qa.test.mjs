import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { chromium } from 'playwright';
import { createOfflineQaContext } from '../scripts/lib/offline-qa.mjs';
import { collectPreviewImageFacts, declaredPreviewMedia, previewImagesReadable } from '../scripts/lib/preview-fallback.mjs';

async function listen(handler) {
  const server = createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

test('offline QA blocks cross-origin resources and redirects before any request, with or without JavaScript', async () => {
  let externalRequests = 0, workerRequests = 0;
  const other = await listen((req, res) => { externalRequests++; res.end('not allowed'); });
  other.server.on('upgrade', (req, socket) => { externalRequests++; socket.destroy(); });
  const local = await listen((req, res) => {
    if (req.url === '/redirect') { res.writeHead(302, { Location: `${other.origin}/forbidden` }).end(); return; }
    if (req.url === '/sw.js') { workerRequests++; res.end('self.addEventListener("fetch", () => {})'); return; }
    res.setHeader('content-type', 'text/html');
    res.end(`<figure data-photo><span class="photo-fallback">Image unavailable</span><img data-external-preview="true" src="${other.origin}/image.jpg" alt="Official image"><figcaption><a href="${other.origin}/origin">Official origin</a></figcaption></figure><img src="${other.origin}/unofficial.jpg" alt="Undeclared image"><script>fetch('${other.origin}/fetch').catch(()=>{});navigator.serviceWorker?.register('/sw.js').catch(()=>{});const ws=new WebSocket('${other.origin.replace('http:', 'ws:')}/socket');ws.onerror=()=>{}</script>`);
  });
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' });
  try {
    for (const javaScriptEnabled of [true, false]) {
      const context = await createOfflineQaContext(browser, { javaScriptEnabled }, local.origin);
      const page = await context.newPage();
      await page.goto(local.origin, { waitUntil: 'load' });
      await page.waitForTimeout(200);
      const facts = await page.evaluate(collectPreviewImageFacts);
      assert.equal(facts.external_preview_images[0].loaded, false);
      assert.equal(facts.external_preview_images[0].fallback.visible, true);
      assert.equal(facts.external_preview_images[0].fallback.links[0].visible, true);
      assert.equal((await page.locator('img').nth(1).evaluate(img => img.complete && img.naturalWidth === 0)), true);
      // An image without an official declaration cannot borrow the fallback.
      assert.equal(previewImagesReadable({ ...facts, broken_images: ['undeclared'], image_failed_frames: 0 }, declaredPreviewMedia([])), false);
      await page.goto(`${local.origin}/redirect`, { waitUntil: 'load' }).catch(() => {});
      await context.close();
    }
    assert.equal(externalRequests, 0);
    assert.equal(workerRequests, 0);
  } finally {
    await browser.close();
    await Promise.all([new Promise(resolve => local.server.close(resolve)), new Promise(resolve => other.server.close(resolve))]);
  }
});
