import { chromium } from 'playwright';

export const LIVE_ORIGIN = 'https://guaizzz.github.io/culture-taste-daily/';

// Browser fallback changes only transport. The caller still checks the exact
// source SHA, complete artifact manifest, route hashes and Preview labels.
export function createLiveTransport({ fetchImpl = fetch, launchBrowser, delays = [2000, 8000] } = {}) {
  let browser, page;
  const events = [];
  const launch = launchBrowser ?? (async () => {
    try { return await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome' }); }
    catch { return chromium.launch({ headless: true }); }
  });
  function target(file) {
    if (!file || file.startsWith('/') || file.includes('..') || file.includes('\\') || /[?#%]/.test(file)) throw new Error('LIVE_FILE_SCOPE');
    const url = new URL(file, LIVE_ORIGIN);
    if (!url.href.startsWith(LIVE_ORIGIN)) throw new Error('LIVE_FILE_SCOPE');
    // Pages canonicalizes index.html to its directory. Request that exact
    // equivalent directly rather than permitting arbitrary redirects.
    return url.href.replace(/index\.html$/, '');
  }
  async function fromBrowser(url) {
    if (!browser) {
      browser = await launch();
      page = await browser.newPage({ javaScriptEnabled: false });
      // Do not follow external redirects or load publishers' images/scripts.
      await page.route('**/*', route => route.request().url().startsWith(LIVE_ORIGIN)
        ? route.continue() : route.abort());
    }
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (!response?.ok() || response.url() !== url) throw new Error('LIVE_BROWSER_ROUTE_MISMATCH ' + url);
    return Buffer.from(await response.body());
  }
  async function get(file) {
    const url = target(file);
    if (page) return fromBrowser(url);
    let last;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetchImpl(url, { signal: AbortSignal.timeout(20000), cache: 'no-store', redirect: 'error' });
        // An HTTP failure is site evidence, not permission to switch transport.
        if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { httpFailure: true });
        return Buffer.from(await response.arrayBuffer());
      } catch (error) {
        if (error.httpFailure) throw new Error(`LIVE_ROUTE_UNAVAILABLE ${file}: ${error.message}`);
        last = error;
        if (attempt < 2) await new Promise(resolve => setTimeout(resolve, delays[attempt] ?? 0));
      }
    }
    events.push({ file, transport: 'browser', reason: last?.message ?? 'network failure' });
    try { return await fromBrowser(url); }
    catch (error) { throw new Error(`LIVE_ROUTE_UNAVAILABLE ${file}: ${error.message}`); }
  }
  return { get, events, close: async () => { await browser?.close(); } };
}
