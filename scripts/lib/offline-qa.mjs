// QA exercises a local build, not live media health. Block external requests
// before they leave Chromium, and never let a local redirect reach the browser.
export async function createOfflineQaContext(browser, options, origin) {
  const allowed = new URL(origin).origin;
  const context = await browser.newContext({ ...options, serviceWorkers: 'block' });
  let closing = false;
  const close = context.close.bind(context);
  context.close = async (...args) => { closing = true; return await close(...args); };
  context.on('close', () => { closing = true; });
  const cleanupCancellation = error => closing && /(?:Target (?:page, context or browser|page|context|browser) has been closed|(?:Browser|browser|context|page) (?:has been|is|was) closed|Fetch response has been disposed|Request context disposed)/.test(String(error?.message ?? error));
  const abort = async (route, reason) => {
    try { await route.abort(reason); }
    catch (error) { if (!cleanupCancellation(error)) throw error; }
  };
  await context.route('**/*', async route => {
    let url;
    try { url = new URL(route.request().url()); } catch { return await abort(route, 'blockedbyclient'); }
    if (url.origin !== allowed) return await abort(route, 'blockedbyclient');
    // The local static server returns only files, but explicitly refuse any
    // redirect before Chromium can follow it (route does not intercept hops).
    try {
      const response = await route.fetch({ maxRedirects: 0 });
      if (response.status() >= 300 && response.status() < 400) return await abort(route, 'blockedbyclient');
      await route.fulfill({ response });
    } catch (error) {
      if (cleanupCancellation(error)) return;
      await abort(route, 'failed');
    }
  });
  await context.routeWebSocket('**/*', socket => socket.close({ code: 1008, reason: 'QA network disabled' }));
  return context;
}
