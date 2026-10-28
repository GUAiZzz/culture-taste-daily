// Exercise the same visibility-triggered loading state a reader encounters.
// Never manufacture a loaded/failed state: the page must provide it itself.
export async function settleVisiblePreviewFallbacks(page) {
  const initialScroll = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
  const pending = await page.locator('img[data-external-preview="true"]').evaluateAll(images =>
    images.flatMap((image, index) => {
      const frame = image.closest('[data-photo], .extra-thumb');
      return !image.complete && !image.hidden && frame && !['slow', 'failed'].includes(frame.dataset.image) ? [index] : [];
    }));
  for (const index of pending) {
    await page.locator('img[data-external-preview="true"]').nth(index).scrollIntoViewIfNeeded();
    // Give the browser's intersection observer a frame to notify the page.
    await page.waitForTimeout(100);
  }
  if (pending.length) await page.waitForFunction(() =>
    [...document.querySelectorAll('img[data-external-preview="true"]')].every(image => {
      const frame = image.closest('[data-photo], .extra-thumb');
      return image.complete || !frame || ['slow', 'failed'].includes(frame.dataset.image);
    }), null, { timeout: 10_000 }).catch(() => {});
  await page.evaluate(({ x, y }) => scrollTo({ left: x, top: y, behavior: 'instant' }), initialScroll);
}
