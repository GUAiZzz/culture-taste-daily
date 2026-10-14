export function requestOriginUrl(request) {
  const seen = new Set();
  let current = request;
  while (current?.redirectedFrom() && !seen.has(current)) {
    seen.add(current); current = current.redirectedFrom();
  }
  return current?.url();
}

// Only browser resource diagnostics with a traced, declared image request may
// be separated from application errors. This does not certify source health.
export function externalPreviewConsoleOrigin({ text, locationUrl, imageResources, declaredUrls, siteOrigin, javaScriptEnabled = true }) {
  if (locationUrl) {
    // With scripts disabled Chromium attributes resource-header diagnostics to
    // the document. With scripts enabled a local console location always fails.
    try { if (javaScriptEnabled && new URL(locationUrl).origin === new URL(siteOrigin).origin) return null; } catch { return null; }
  }
  let resource;
  const header = text.match(/^Clear-Site-Data header on '([^']+)':/);
  if (header) resource = header[1];
  else if (/^Failed to load resource:/.test(text)) resource = locationUrl;
  else return null;
  const origin = imageResources.get(resource);
  return origin && declaredUrls.has(origin) ? origin : null;
}
