// QA exercises a local build, not live media health. Block external requests
// before they leave Chromium, and never let a local redirect reach the browser.
export async function createOfflineQaContext(browser, options, origin) {
  const allowed = new URL(origin).origin;
  const context = await browser.newContext({ ...options, serviceWorkers: 'block' });
  await context.route('**/*', async route => {
    let url;
    try { url = new URL(route.request().url()); } catch { return route.abort('blockedbyclient'); }
    if (url.origin !== allowed) return route.abort('blockedbyclient');
    // The local static server returns only files, but explicitly refuse any
    // redirect before Chromium can follow it (route does not intercept hops).
    try {
      const response = await route.fetch({ maxRedirects: 0 });
      if (response.status() >= 300 && response.status() < 400) return route.abort('blockedbyclient');
      return route.fulfill({ response });
    } catch { return route.abort('failed'); }
  });
  await context.routeWebSocket('**/*', socket => socket.close({ code: 1008, reason: 'QA network disabled' }));
  return context;
}
