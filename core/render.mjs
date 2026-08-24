import MarkdownIt from "markdown-it";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function issueTitle(content) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "Culture & Taste Daily";
}

function markdownRenderer(manifest) {
  const markdown = new MarkdownIt({ html: false, linkify: false, typographer: false });
  const sectionIds = [...manifest.stories.map((story) => story.id), "exit"];
  let secondLevelIndex = 0;

  markdown.renderer.rules.heading_open = (tokens, index, options, env, renderer) => {
    const token = tokens[index];
    if (token.tag === "h1") token.attrSet("id", "issue-title");
    if (token.tag === "h2") {
      token.attrSet("id", sectionIds[secondLevelIndex] ?? `section-${secondLevelIndex + 1}`);
      secondLevelIndex += 1;
    }
    return renderer.renderToken(tokens, index, options);
  };

  markdown.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
    tokens[index].attrSet("data-source-link", "true");
    return renderer.renderToken(tokens, index, options);
  };

  return markdown;
}

function sourceIndex(manifest) {
  const items = manifest.stories.flatMap((story) =>
    story.sources.map((source) => {
      const dates = [source.published_date, source.event_date].filter(Boolean).join(" · ");
      return `<li><a href="${escapeHtml(source.url)}">${escapeHtml(source.title)}</a><span class="source-meta">${escapeHtml(source.publisher)}${dates ? ` · ${escapeHtml(dates)}` : ""}</span></li>`;
    }),
  );
  return `<section class="sources" id="sources" aria-labelledby="sources-title"><h2 id="sources-title">Sources &amp; Dates</h2><ol>${items.join("")}</ol></section>`;
}

export function renderIssue({ content, manifest, baseCss, issueCss }) {
  const markdown = markdownRenderer(manifest);
  const title = issueTitle(content);
  const article = markdown.render(content, {});
  const navigation = manifest.stories
    .map((story) => `<li><a href="#${escapeHtml(story.id)}">${escapeHtml(story.level)} · ${escapeHtml(story.title)}</a></li>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <link rel="icon" href="data:,">
  <title>${escapeHtml(title)} — Culture &amp; Taste Daily ${escapeHtml(manifest.publication_date)}</title>
  <style>${baseCss}\n${issueCss}</style>
</head>
<body data-issue="${escapeHtml(manifest.issue_id)}">
  <a class="skip-link" href="#main-content">Skip to content</a>
  <p class="non-production-label">LOCAL NON-PRODUCTION BUILD · MANIFEST STATUS IS REPORTING ONLY</p>
  <header class="site-header"><a href="../../">Culture &amp; Taste Daily</a><span>${escapeHtml(manifest.publication_date)} · Asia/Shanghai</span></header>
  <nav class="issue-nav" aria-label="Issue contents"><ul>${navigation}<li><a href="#sources">Sources &amp; Dates</a></li></ul></nav>
  <main id="main-content">
    <article aria-labelledby="issue-title" data-content-sha256="${escapeHtml(manifest.source_hashes.content_sha256)}">${article}</article>
    ${sourceIndex(manifest)}
  </main>
  <footer class="site-footer"><a href="../../archive/">Archive</a><span>Static, readable without JavaScript</span></footer>
</body>
</html>
`;
}

function shell({ title, body, baseCss, pathPrefix = "./" }) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="data:,">
  <title>${escapeHtml(title)}</title>
  <style>${baseCss}</style>
</head>
<body>
  <a class="skip-link" href="#main-content">Skip to content</a>
  <p class="non-production-label">LOCAL NON-PRODUCTION BUILD · NOT DEPLOYED</p>
  <header class="site-header"><a href="${pathPrefix}">Culture &amp; Taste Daily</a><a href="${pathPrefix}archive/">Archive</a></header>
  <main id="main-content">${body}</main>
  <footer class="site-footer"><span>Culture &amp; Taste Daily</span><span>Evidence-gated static foundation</span></footer>
</body>
</html>
`;
}

export function renderHome({ issues, baseCss }) {
  const latest = issues.at(-1);
  const body = `<section class="latest-issue" aria-labelledby="latest-title"><p>Latest non-production build</p><h1 id="latest-title">${escapeHtml(latest.title)}</h1><p>${escapeHtml(latest.manifest.editorial_position)}</p><p><a href="./issues/${escapeHtml(latest.manifest.issue_id)}/">Read issue ${escapeHtml(latest.manifest.issue_id)}</a></p></section>`;
  return shell({ title: "Culture & Taste Daily — Local build", body, baseCss });
}

export function renderArchive({ issues, baseCss }) {
  const items = [...issues]
    .reverse()
    .map((issue) => `<li><a href="../issues/${escapeHtml(issue.manifest.issue_id)}/">${escapeHtml(issue.manifest.publication_date)} — ${escapeHtml(issue.title)}</a></li>`)
    .join("");
  const body = `<section class="archive-list" aria-labelledby="archive-title"><h1 id="archive-title">Archive</h1><ol>${items}</ol></section>`;
  return shell({ title: "Archive — Culture & Taste Daily", body, baseCss, pathPrefix: "../" });
}

function escapeXml(value) {
  return escapeHtml(value).replaceAll("'", "&apos;");
}

export function renderRss({ issues, baseUrl }) {
  const items = [...issues]
    .reverse()
    .map((issue) => `<item><title>${escapeXml(issue.title)}</title><link>${escapeXml(new URL(`issues/${issue.manifest.issue_id}/`, baseUrl).href)}</link><guid>${escapeXml(issue.candidateDigest)}</guid><pubDate>${new Date(`${issue.manifest.publication_date}T00:00:00+08:00`).toUTCString()}</pubDate><description>${escapeXml(issue.manifest.editorial_position)}</description></item>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Culture &amp; Taste Daily</title><link>${escapeXml(baseUrl)}</link><description>Non-production static build</description>${items}</channel></rss>\n`;
}

export function renderSitemap({ issues, baseUrl }) {
  const routes = ["", "archive/", ...issues.map((issue) => `issues/${issue.manifest.issue_id}/`)];
  const urls = routes.map((route) => `<url><loc>${escapeXml(new URL(route, baseUrl).href)}</loc></url>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`;
}
