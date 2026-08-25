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

function renderThemePicker() {
  const themes = [
    ["field", "01", "FIELD GREEN", "冷静、自然的绿色光场"],
    ["coral", "02", "CORAL SIGNAL", "更直接的珊瑚色信号"],
    ["analog", "03", "2000s TV", "褪色、扫描线与模拟噪点"],
  ];
  const choices = themes.map(([value, number, title, description]) => `<button type="button" data-theme-choice="${value}" aria-pressed="false"><span>${number}</span><strong>${title}</strong><small>${description}</small></button>`).join("");
  return `<section class="theme-picker" aria-labelledby="theme-picker-title"><div><p>CHOOSE YOUR SIGNAL</p><h2 id="theme-picker-title">同一份内容，三种观看温度。</h2><p>首次进入会随机选择；你也可以在这里接管。进入文章后，滤镜继续保持，内容与版式不变。</p></div><div class="theme-options">${choices}</div><noscript><p>当前以原始视觉显示；开启 JavaScript 后可选择并保留主题。</p></noscript></section>`;
}

function renderFeatureMatrix(artDirection) {
  const matrix = artDirection?.feature_matrix;
  if (!matrix?.items?.length || !matrix.after_story_id) return { storyId: null, html: "" };
  const items = matrix.items.map((item, index) => `<li><span class="matrix-object" aria-hidden="true" data-object="${index + 1}"></span><span>${escapeHtml(item.label)}</span><small>${escapeHtml(item.note)}</small></li>`).join("");
  return {
    storyId: matrix.after_story_id,
    html: `<aside class="feature-matrix" aria-labelledby="feature-matrix-title"><header><p>${escapeHtml(matrix.eyebrow)}</p><h3 id="feature-matrix-title">${escapeHtml(matrix.title)}</h3></header><ol>${items}</ol></aside>`,
  };
}

function addFeatureMatrix(article, artDirection) {
  const matrix = renderFeatureMatrix(artDirection);
  if (!matrix.storyId) return article;
  const marker = `id="${escapeHtml(matrix.storyId)}"`;
  const start = article.indexOf(`<h2 ${marker}`);
  if (start < 0) return article;
  const end = article.indexOf("</h2>", start);
  if (end < 0) return article;
  return `${article.slice(0, end + 5)}${matrix.html}${article.slice(end + 5)}`;
}

function enhancementScript(enhancementJs) {
  return enhancementJs ? `<script>${enhancementJs}</script>` : "";
}

export function renderIssue({ content, manifest, artDirection, baseCss, issueCss, enhancementJs }) {
  const markdown = markdownRenderer(manifest);
  const title = issueTitle(content);
  const article = addFeatureMatrix(markdown.render(content, {}), artDirection);
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
  <div class="reading-progress" aria-hidden="true"><span></span></div>
  <p class="non-production-label">LOCAL NON-PRODUCTION BUILD · MANIFEST STATUS IS REPORTING ONLY</p>
  <header class="site-header"><a href="../../" data-theme-link>Culture &amp; Taste Daily</a><span>${escapeHtml(manifest.publication_date)} · Asia/Shanghai</span><span class="theme-status">FILTER · <strong data-theme-status>ORIGINAL</strong></span></header>
  <nav class="issue-nav" aria-label="Issue contents"><ul>${navigation}<li><a href="#sources">Sources &amp; Dates</a></li></ul></nav>
  <main id="main-content">
    <article aria-labelledby="issue-title" data-content-sha256="${escapeHtml(manifest.source_hashes.content_sha256)}">${article}</article>
    ${sourceIndex(manifest)}
  </main>
  <footer class="site-footer"><a href="../../archive/">Archive</a><span>Static, readable without JavaScript</span></footer>
  ${enhancementScript(enhancementJs)}
</body>
</html>
`;
}

function shell({ title, body, baseCss, enhancementJs, pathPrefix = "./", page = "home" }) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="data:,">
  <title>${escapeHtml(title)}</title>
  <style>${baseCss}</style>
</head>
<body data-shell="publication" data-page="${escapeHtml(page)}">
  <a class="skip-link" href="#main-content">Skip to content</a>
  <p class="non-production-label">LOCAL NON-PRODUCTION BUILD · NOT DEPLOYED</p>
  <header class="site-header"><a href="${pathPrefix}">Culture &amp; Taste Daily</a><a href="${pathPrefix}archive/">Archive</a></header>
  <main id="main-content">${body}</main>
  <footer class="site-footer"><span>Culture &amp; Taste Daily</span><span>Evidence-gated static foundation</span></footer>
  ${enhancementScript(enhancementJs)}
</body>
</html>
`;
}

function categoryFor(issue, story) {
  return issue.artDirection?.index_categories?.[story.id] ?? "city";
}

function renderDailyIndex(issue) {
  const labels = [["all", "ALL"], ["fashion", "FASHION"], ["music", "MUSIC"], ["objects", "OBJECTS"], ["city", "CITY"]];
  const filters = labels.map(([value, label], index) => `<button type="button" data-index-filter="${value}" aria-pressed="${index === 0}">${label}</button>`).join("");
  const cards = issue.manifest.stories.map((story, index) => {
    const category = categoryFor(issue, story);
    return `<li data-index-card data-index-category="${escapeHtml(category)}"><a href="./issues/${escapeHtml(issue.manifest.issue_id)}/#${escapeHtml(story.id)}" data-theme-link><span class="index-visual" data-visual="${escapeHtml(story.level)}" data-sequence="${index + 1}" aria-hidden="true"></span><span class="index-meta"><b>${escapeHtml(category)}</b><time datetime="${escapeHtml(issue.manifest.publication_date)}">${escapeHtml(issue.manifest.publication_date.replaceAll("-", "."))}</time></span><strong>${escapeHtml(story.title)}</strong><span class="read-story">READ STORY ↗</span></a></li>`;
  }).join("");
  return `<section class="daily-index" aria-labelledby="daily-index-title"><header><p>02 / DAILY INDEX</p><div><h2 id="daily-index-title"><b>WHAT'S</b><i>ON OUR RADAR.</i></h2><p>五个入口，今天的不同切面。你可以从这里开始，也可以继续往下滑。</p></div></header><div class="index-filters" role="group" aria-label="Filter stories">${filters}</div><ol>${cards}</ol></section>`;
}

export function renderHome({ issues, baseCss, enhancementJs }) {
  const latest = issues.at(-1);
  const body = `<section class="latest-issue" aria-labelledby="latest-title"><p>01 / CULTURE &amp; TASTE DAILY · ${escapeHtml(latest.manifest.publication_date)}</p><h1 id="latest-title">${escapeHtml(latest.title)}</h1><p>${escapeHtml(latest.manifest.editorial_position)}</p><p><a href="./issues/${escapeHtml(latest.manifest.issue_id)}/" data-theme-link>ENTER TODAY'S ISSUE ↗</a></p></section>${renderThemePicker()}${renderDailyIndex(latest)}`;
  return shell({ title: "Culture & Taste Daily — Local build", body, baseCss, enhancementJs, page: "home" });
}

export function renderArchive({ issues, baseCss, enhancementJs }) {
  const items = [...issues]
    .reverse()
    .map((issue) => `<li><a href="../issues/${escapeHtml(issue.manifest.issue_id)}/" data-theme-link>${escapeHtml(issue.manifest.publication_date)} — ${escapeHtml(issue.title)}</a></li>`)
    .join("");
  const body = `<section class="archive-list" aria-labelledby="archive-title"><h1 id="archive-title">Archive</h1><ol>${items}</ol></section>`;
  return shell({ title: "Archive — Culture & Taste Daily", body, baseCss, enhancementJs, pathPrefix: "../", page: "archive" });
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
