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
  return `<section class="sources" id="sources" aria-labelledby="sources-title"><p class="section-label">INDEX / VERIFIED LINKS</p><h2 id="sources-title">Sources &amp; Dates</h2><ol>${items.join("")}</ol></section>`;
}

function wrapIssueSections(article, manifest) {
  const parts = article.split(/(?=<h2 id="[^"]+">)/);
  const introduction = parts.shift() ?? "";
  const sections = parts.map((part, index) => {
    const id = part.match(/^<h2 id="([^"]+)">/)?.[1] ?? `section-${index + 1}`;
    const story = manifest.stories.find((item) => item.id === id);
    const level = story?.level ?? (id === "exit" ? "exit" : "section");
    const count = id === "exit" ? "EXIT" : String(index + 1).padStart(2, "0");
    let storyPart = part;
    if (story?.english) {
      const english = `<div class="story-english"><strong>${escapeHtml(story.english.title)}</strong><span>${escapeHtml(story.english.deck)}</span><small>${escapeHtml(story.english.abstract)}</small></div>`;
      storyPart = storyPart.replace("</h2>", `</h2>${english}`);
    }
    if (story?.media) {
      const mediaKind = story.media.kind ?? "original_illustration";
      const mediaLabel = {
        source_image: "SOURCE IMAGE",
        original_illustration: "ORIGINAL EDITORIAL VISUAL",
        data_diagram: "ORIGINAL DATA DIAGRAM",
        historical_artifact: "HISTORICAL ARTIFACT",
      }[mediaKind] ?? "EDITORIAL VISUAL";
      const externalImage = story.media.external_image_url;
      const mediaSourceUrl = story.media.origin_url ?? story.sources[0]?.url ?? "#";
      const imageMarkup = externalImage
        ? `<a class="source-image-link" href="${escapeHtml(mediaSourceUrl)}" target="_blank" rel="noreferrer noopener"><img data-external-preview="true" src="${escapeHtml(externalImage)}" alt="${escapeHtml(story.media.alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" width="1200" height="720"></a><p class="source-image-fallback"><a href="${escapeHtml(mediaSourceUrl)}" target="_blank" rel="noreferrer noopener">图片加载失败？在来源页面查看原图 ↗</a></p>`
        : `<img src="./${escapeHtml(story.media.asset)}" alt="${escapeHtml(story.media.alt)}" loading="eager" decoding="async" width="1200" height="720">`;
      const figureLabel = externalImage ? `${mediaLabel} · PREVIEW ONLY` : mediaLabel;
      const figure = `<figure class="story-figure" data-media-kind="${escapeHtml(mediaKind)}"${externalImage ? " data-external-preview=\"true\"" : ""}>${imageMarkup}<figcaption><strong>${figureLabel}</strong> ${escapeHtml(story.media.caption)} <span>${escapeHtml(story.media.credit)}</span></figcaption></figure>`;
      storyPart = storyPart.replace("</h2>", `</h2>${figure}`);
    }
    return `<section class="issue-story" data-story="${escapeHtml(id)}" data-level="${escapeHtml(level)}"><p class="story-marker" aria-hidden="true">${count}</p>${storyPart}</section>`;
  });

  const firstId = manifest.stories[0]?.id ?? "sources";
  return `<header class="issue-cover"><div class="issue-cover-copy">${introduction}<a class="enter-issue" href="#${escapeHtml(firstId)}">Enter the issue <span aria-hidden="true">↓</span></a></div><div class="issue-cover-visual" aria-hidden="true"><span data-node="cover">COVER</span><span data-node="major">MAJOR</span><span data-node="signal">SIGNAL</span><span data-node="watch">WATCH</span><i></i></div></header>${sections.join("")}`;
}

export function renderIssue({ content, manifest, baseCss, issueCss }) {
  const markdown = markdownRenderer(manifest);
  const title = issueTitle(content);
  const article = wrapIssueSections(markdown.render(content, {}), manifest);
  const navigation = manifest.stories
    .map((story) => `<li><a href="#${escapeHtml(story.id)}"><span>${escapeHtml(story.level)}</span>${escapeHtml(story.title)}</a></li>`)
    .join("");

  const draftLabel = manifest.visibility === "future_draft" ? "TOMORROW DRAFT · NOT LATEST" : "PREVIEW EDITION · NOT PRODUCTION";
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <meta name="color-scheme" content="dark">
  <link rel="icon" type="image/png" href="../../assets/culture-taste-earth.png">
  <title>${escapeHtml(title)} — Culture &amp; Taste Daily ${escapeHtml(manifest.publication_date)}</title>
  <style>${baseCss}\n${issueCss}</style>
</head>
<body data-issue="${escapeHtml(manifest.issue_id)}">
  <a class="skip-link" href="#main-content">Skip to content</a>
  <p class="non-production-label">${draftLabel}</p>
  <header class="site-header"><a class="issue-brand" href="../../"><img class="brand-mark" src="../../assets/culture-taste-earth.png" alt=""><span>Culture &amp; Taste Daily</span></a><span>${escapeHtml(manifest.publication_date)} · Asia/Shanghai</span><a href="../../archive/">Archive</a></header>
  <details class="issue-nav-panel" open><summary>Issue index <span aria-hidden="true">＋</span></summary><nav class="issue-nav" aria-label="Issue contents"><ul>${navigation}<li><a href="#sources"><span>index</span>Sources &amp; Dates</a></li></ul></nav></details>
  <main id="main-content">
    <article aria-labelledby="issue-title" data-content-sha256="${escapeHtml(manifest.source_hashes.content_sha256)}">${article}</article>
    ${sourceIndex(manifest)}
  </main>
  <footer class="site-footer"><a href="../../archive/">All issues</a><span>Static, readable without JavaScript</span></footer>
</body>
</html>
`;
}

function shell({ title, body, baseCss, siteCss, siteJs = "", pathPrefix = "./", page = "home" }) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <meta name="color-scheme" content="light dark">
  <link rel="icon" type="image/png" href="${pathPrefix}assets/culture-taste-earth.png">
  <title>${escapeHtml(title)}</title>
  <style>${baseCss}\n${siteCss}</style>
</head>
<body data-shell="publication" data-page="${escapeHtml(page)}">
  <a class="skip-link" href="#main-content">Skip to content</a>
  <div class="preview-ribbon"><span>NON-PRODUCTION PREVIEW</span><span>SHANGHAI · 2026</span></div>
  <header class="publication-header">
    <a class="wordmark" href="${pathPrefix}"><img class="brand-mark" src="${pathPrefix}assets/culture-taste-earth.png" alt=""><span class="wordmark-text"><span>Culture</span><span>&amp; Taste</span><span>Daily</span></span></a>
    <p class="publication-mode">A daily field magazine<br>关于衣服、场地、物件与正在形成的文化</p>
    <nav aria-label="Publication"><a href="${pathPrefix}">Latest</a><a href="${pathPrefix}archive/">Archive</a></nav>
  </header>
  <main id="main-content">${body}</main>
  <footer class="publication-footer"><p>Culture &amp; Taste Daily</p><p>Every issue keeps its own visual world.<br>Preview before production.</p><a href="${pathPrefix}archive/">Open the complete archive ↗</a></footer>
  ${siteJs ? `<script>${siteJs}</script>` : ""}
</body>
</html>
`;
}

function issueCard(issue, pathPrefix, position) {
  const coverWords = (issue.title_en || issue.title).trim().split(/\s+/);
  const coverBreak = Math.max(1, Math.ceil(coverWords.length / 2));
  const coverLead = coverWords.slice(0, coverBreak).join(" ");
  const coverTail = coverWords.slice(coverBreak).join(" ");
  const cover = issue.coverAsset
    ? `<img src="${pathPrefix}assets/${escapeHtml(issue.coverAsset)}" alt="${escapeHtml(issue.title_en || issue.title)} issue cover preview">`
    : `<div class="type-cover" aria-hidden="true"><span>${escapeHtml(coverLead)}</span>${coverTail ? `<b>${escapeHtml(coverTail)}</b>` : ""}<i>${escapeHtml(issue.publication_date.slice(5).replace("-", "/"))}</i></div>`;
  return `<li class="issue-card" data-kind="${escapeHtml(issue.kind)}" style="--card-index:${position}"><a href="${pathPrefix}issues/${escapeHtml(issue.issue_id)}/"><div class="issue-card-cover">${cover}<span class="open-mark">OPEN ↗</span></div><div class="issue-card-copy"><p>${escapeHtml(issue.publication_date)} · ${escapeHtml(issue.kind === "current" ? "CURRENT FIELD" : "HISTORICAL ORIGINAL")}</p><h3>${escapeHtml(issue.title)}</h3><strong>${escapeHtml(issue.title_en)}</strong><span>${escapeHtml(issue.deck)}</span></div></a></li>`;
}

function issueGrid(issues, pathPrefix) {
  return `<ol class="issue-grid">${[...issues].reverse().map((issue, index) => issueCard(issue, pathPrefix, index)).join("")}</ol>`;
}

function routeMap() {
  return `<svg class="route-map" viewBox="0 0 720 640" role="img" aria-label="A route connecting cover, major, signal and watch sections"><path d="M86 88 H410 V210 H620 V382 H330 V545 H86"/><circle cx="86" cy="88" r="14"/><circle cx="410" cy="210" r="14"/><circle cx="620" cy="382" r="14"/><circle cx="330" cy="545" r="14"/><text x="72" y="62">COVER</text><text x="360" y="188">MAJOR</text><text x="548" y="360">SIGNALS</text><text x="276" y="590">WATCH</text><text class="route-question" x="70" y="420">WHO GETS TO SPEAK?</text></svg>`;
}

export function renderHome({ issues, baseCss, siteCss, siteJs }) {
  const latest = [...issues].sort((a, b) => a.publication_date.localeCompare(b.publication_date)).at(-1);
  const body = `<section class="home-hero" aria-labelledby="latest-title"><div class="hero-copy"><p class="hero-kicker">ISSUE ${String(issues.length).padStart(2, "0")} / ${escapeHtml(latest.publication_date)}</p><h1 id="latest-title"><a href="./issues/${escapeHtml(latest.issue_id)}/">${escapeHtml(latest.title)}</a></h1><p class="hero-english">${escapeHtml(latest.title_en)}</p><p class="hero-deck">${escapeHtml(latest.deck)}</p><a class="hero-link" href="./issues/${escapeHtml(latest.issue_id)}/">Read the latest issue <span aria-hidden="true">↗</span></a></div><div class="hero-map">${routeMap()}</div></section>
  <section class="issue-field" aria-labelledby="field-title"><div class="section-heading"><p>THE ISSUES / 20—24 AUG</p><h2 id="field-title">不是同一个模板。<br>是不同的进入。</h2><p>Each issue keeps its own visual grammar. The publication shell only helps you move between them.</p></div>${issueGrid(issues, "./")}</section>
  <section class="editorial-code" aria-labelledby="code-title"><p class="vertical-label">EDITORIAL CODE</p><div><h2 id="code-title">事实先站稳。<br>形式才开始冒险。</h2><p>We follow the story into its own visual world. References teach; they do not dictate. No JavaScript is required to read. No automated PASS can replace a human judgment.</p></div><dl><div><dt>01</dt><dd>TRUTH<br>可核验的事实</dd></div><div><dt>02</dt><dd>AUTHORSHIP<br>独立的表达</dd></div><div><dt>03</dt><dd>ACCESS<br>真实可用</dd></div></dl></section>`;
  return shell({ title: "Culture & Taste Daily — Preview", body, baseCss, siteCss, siteJs, page: "home" });
}

export function renderArchive({ issues, baseCss, siteCss, siteJs }) {
  const sorted = [...issues].sort((a, b) => b.publication_date.localeCompare(a.publication_date));
  const rows = sorted.map((issue, index) => `<li data-kind="${escapeHtml(issue.kind)}"><a href="../issues/${escapeHtml(issue.issue_id)}/"><span>${String(index + 1).padStart(2, "0")}</span><time datetime="${escapeHtml(issue.publication_date)}">${escapeHtml(issue.publication_date)}</time><div><strong>${escapeHtml(issue.title)}</strong><small>${escapeHtml(issue.title_en)}</small></div><em>${escapeHtml(issue.kind === "current" ? "CURRENT FIELD" : "ORIGINAL")}</em><i aria-hidden="true">↗</i></a></li>`).join("");
  const body = `<section class="archive-hero"><p>ARCHIVE / ${String(issues.length).padStart(2, "0")} ISSUES</p><h1>ARCHIVE</h1><div class="archive-note"><p>The archive is not a template gallery. It is a record of changing editorial positions, visual systems and constraints.</p><p>历史原件优先保留；无法恢复的部分会明确标注，而不是被新系统补写。</p></div></section><section class="archive-index" aria-labelledby="archive-title"><div class="archive-controls"><h2 id="archive-title">Complete index</h2><div role="group" aria-label="Filter issues"><button type="button" data-filter="all" aria-pressed="true">All</button><button type="button" data-filter="current" aria-pressed="false">Current</button><button type="button" data-filter="historical" aria-pressed="false">Historical</button></div></div><ol>${rows}</ol></section><section class="archive-covers" aria-label="Issue covers">${issueGrid(issues, "../")}</section>`;
  return shell({ title: "Archive — Culture & Taste Daily Preview", body, baseCss, siteCss, siteJs, pathPrefix: "../", page: "archive" });
}

export function renderHistoricalWrapper({ meta, baseCss, siteCss, siteJs }) {
  const body = `<section class="history-header"><p>${escapeHtml(meta.publication_date)} · HISTORICAL ORIGINAL</p><h1>${escapeHtml(meta.title)}</h1><strong>${escapeHtml(meta.title_en)}</strong><p>${escapeHtml(meta.deck)}</p><div class="history-actions"><a href="./original.html">Open the untouched original ↗</a><a href="../../archive/">Back to archive</a></div></section><section class="historical-frame" aria-labelledby="original-title"><div><p id="original-title">ORIGINAL SELF-CONTAINED HTML</p><span>Reader height adapts when scripts are available.</span></div><iframe data-historical-frame src="./original.html" title="Preserved Culture & Taste Daily issue ${escapeHtml(meta.publication_date)}"></iframe><p class="frame-fallback">If the embedded reader is unavailable, <a href="./original.html">open the untouched original in its own tab ↗</a>.</p></section><aside class="migration-note"><strong>Migration note</strong><p>${escapeHtml(meta.limitations.join(" "))}</p></aside>`;
  return shell({ title: `${meta.title} — Historical Preview`, body, baseCss, siteCss, siteJs, pathPrefix: "../../", page: "historical" });
}

export function renderFacsimile({ meta, pageFiles, baseCss, siteCss, siteJs }) {
  const pages = pageFiles.map((file, index) => `<li id="page-${index + 1}"><figure><img src="./pages/${escapeHtml(file)}" width="390" height="844" loading="eager" alt="Historical web edition page ${index + 1} of ${pageFiles.length}"><figcaption><span>${String(index + 1).padStart(2, "0")} / ${String(pageFiles.length).padStart(2, "0")}</span><a href="#page-${index + 1}">Permalink ↗</a></figcaption></figure></li>`).join("");
  const body = `<section class="history-header facsimile-heading"><p>${escapeHtml(meta.publication_date)} · HISTORICAL WEB EDITION</p><h1>${escapeHtml(meta.title)}</h1><strong>${escapeHtml(meta.title_en)}</strong><p>${escapeHtml(meta.deck)}</p><div class="history-actions"><a href="./original.pdf">Download original PDF ↗</a><a href="../../archive/">Back to archive</a></div></section><section class="edition-intro"><p class="section-label">READING MAP / 16 SCREENS</p><h2>A page-by-page web edition, with the source still intact.</h2><p>The supplied artifact is a raster screenshot sequence. This reader gives each screen a stable anchor and keeps the exact PDF one click away; it does not invent missing article text.</p></section><aside class="migration-note"><strong>Honest limitation</strong><p>${escapeHtml(meta.limitations.join(" "))}</p></aside><ol class="facsimile-pages">${pages}</ol>`;
  return shell({ title: `${meta.title} — Historical Web Edition`, body, baseCss, siteCss, siteJs, pathPrefix: "../../", page: "facsimile" });
}

function escapeXml(value) {
  return escapeHtml(value).replaceAll("'", "&apos;");
}

export function renderRss({ issues, baseUrl }) {
  const items = [...issues]
    .sort((a, b) => b.publication_date.localeCompare(a.publication_date))
    .map((issue) => `<item><title>${escapeXml(issue.title)}</title><link>${escapeXml(new URL(`issues/${issue.issue_id}/`, baseUrl).href)}</link><guid>${escapeXml(issue.digest)}</guid><pubDate>${new Date(`${issue.publication_date}T00:00:00+08:00`).toUTCString()}</pubDate><description>${escapeXml(issue.deck)}</description></item>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Culture &amp; Taste Daily</title><link>${escapeXml(baseUrl)}</link><description>Non-production Culture &amp; Taste preview</description>${items}</channel></rss>\n`;
}

export function renderSitemap({ issues, baseUrl }) {
  const routes = ["", "archive/", ...issues.map((issue) => `issues/${issue.issue_id}/`)];
  const urls = routes.map((route) => `<url><loc>${escapeXml(new URL(route, baseUrl).href)}</loc></url>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`;
}
