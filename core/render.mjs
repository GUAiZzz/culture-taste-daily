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

function themeBootstrap(page = "home") {
  return `<script>(()=>{const themes=["field","coral","analog"],page=${JSON.stringify(page)};let selected="field";try{const query=new URLSearchParams(location.search).get("theme"),stored=sessionStorage.getItem("ctd-theme"),manual=sessionStorage.getItem("ctd-theme-manual")==="1";if(themes.includes(query))selected=query;else if(page==="home"&&!manual)selected=themes[Math.floor(Math.random()*themes.length)];else if(themes.includes(stored))selected=stored;else selected=themes[Math.floor(Math.random()*themes.length)];sessionStorage.setItem("ctd-theme",selected);}catch{}document.documentElement.dataset.visualTheme=selected;})();</script>`;
}

function themeDots() {
  const themes = [
    ["field", "Field Green"],
    ["coral", "Coral Signal"],
    ["analog", "2000s TV"],
  ];
  return `<div class="theme-dots" role="group" aria-label="Choose visual theme">${themes.map(([value, label]) => `<button type="button" data-theme-choice="${value}" data-theme-label="${label}" aria-label="${label}" aria-pressed="false"></button>`).join("")}</div>`;
}

function textWordmark() {
  return `<span class="brand-type"><span>Culture &amp;</span><em>Taste</em><span>Daily</span></span>`;
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
      const loading = index === 0 ? "eager" : "lazy";
      const imageMarkup = externalImage
        ? `<a class="source-image-link" href="${escapeHtml(mediaSourceUrl)}" target="_blank" rel="noreferrer noopener"><img data-external-preview="true" src="${escapeHtml(externalImage)}" alt="${escapeHtml(story.media.alt)}" loading="${loading}" decoding="async" referrerpolicy="no-referrer" width="1200" height="720"></a><p class="source-image-fallback"><a href="${escapeHtml(mediaSourceUrl)}" target="_blank" rel="noreferrer noopener">图片加载失败？在来源页面查看原图 ↗</a></p>`
        : `<img src="./${escapeHtml(story.media.asset)}" alt="${escapeHtml(story.media.alt)}" loading="${loading}" decoding="async" width="1200" height="720">`;
      const figureLabel = externalImage ? `${mediaLabel} · PREVIEW ONLY` : mediaLabel;
      const figure = `<figure class="story-figure" data-media-kind="${escapeHtml(mediaKind)}"${externalImage ? " data-external-preview=\"true\"" : ""}>${imageMarkup}<figcaption><strong>${figureLabel}</strong> ${escapeHtml(story.media.caption)} <span>${escapeHtml(story.media.credit)}</span></figcaption></figure>`;
      storyPart = storyPart.replace("</h2>", `</h2>${figure}`);
    }
    return `<section class="issue-story" data-story="${escapeHtml(id)}" data-level="${escapeHtml(level)}"><p class="story-marker" aria-hidden="true">${count}</p>${storyPart}</section>`;
  });

  const firstId = manifest.stories[0]?.id ?? "sources";
  return `<header class="issue-cover"><div class="issue-cover-copy">${introduction}<a class="enter-issue" href="#${escapeHtml(firstId)}">Enter the issue <span aria-hidden="true">↓</span></a></div><div class="issue-cover-visual" aria-hidden="true"><span data-node="cover">COVER</span><span data-node="major">MAJOR</span><span data-node="signal">SIGNAL</span><span data-node="watch">WATCH</span><i></i></div></header>${sections.join("")}`;
}

export function renderIssue({ content, manifest, baseCss, themesCss = "", issueCss, siteJs = "" }) {
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
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="robots" content="noindex,nofollow">
  <meta name="color-scheme" content="dark">
  <link rel="icon" type="image/png" href="../../assets/culture-taste-earth.png">
  <title>${escapeHtml(title)} — Culture &amp; Taste Daily ${escapeHtml(manifest.publication_date)}</title>
  ${themeBootstrap("issue")}
  <style>${baseCss}\n${themesCss}\n${issueCss}</style>
</head>
<body data-issue="${escapeHtml(manifest.issue_id)}">
  <a class="skip-link" href="#main-content">Skip to content</a>
  <div class="reading-progress" aria-hidden="true"><span></span></div>
  <p class="non-production-label">${draftLabel}</p>
  <header class="site-header"><a class="issue-brand" href="../../" data-theme-home aria-label="Culture &amp; Taste Daily">${textWordmark()}</a><span>${escapeHtml(manifest.publication_date)} · Asia/Shanghai</span>${themeDots()}<a href="../../archive/" data-theme-link>Archive</a></header>
  <details class="issue-nav-panel" open><summary>Issue index <span aria-hidden="true">＋</span></summary><nav class="issue-nav" aria-label="Issue contents"><ul>${navigation}<li><a href="#sources"><span>index</span>Sources &amp; Dates</a></li></ul></nav></details>
  <main id="main-content">
    <article aria-labelledby="issue-title" data-content-sha256="${escapeHtml(manifest.source_hashes.content_sha256)}">${article}</article>
    ${sourceIndex(manifest)}
  </main>
  <footer class="site-footer"><a href="../../archive/">All issues</a><span>Static, readable without JavaScript</span></footer>
  ${siteJs ? `<script>${siteJs}</script>` : ""}
</body>
</html>
`;
}

function shell({ title, body, baseCss, themesCss = "", siteCss, siteJs = "", pathPrefix = "./", page = "home" }) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="robots" content="noindex,nofollow">
  <meta name="color-scheme" content="light dark">
  <link rel="icon" type="image/png" href="${pathPrefix}assets/culture-taste-earth.png">
  <title>${escapeHtml(title)}</title>
  ${themeBootstrap(page)}
  <style>${baseCss}\n${themesCss}\n${siteCss}</style>
</head>
<body data-shell="publication" data-page="${escapeHtml(page)}">
  <a class="skip-link" href="#main-content">Skip to content</a>
  <div class="preview-ribbon"><span>NON-PRODUCTION PREVIEW</span><span>SHANGHAI · 2026</span></div>
  <header class="publication-header">
    <a class="wordmark" href="${pathPrefix}" data-theme-home aria-label="Culture &amp; Taste Daily">${textWordmark()}</a>
    <p class="publication-mode">A daily field magazine<br>关于衣服、场地、物件与正在形成的文化</p>
    <div class="publication-actions"><nav aria-label="Publication"><a href="${pathPrefix}" data-theme-home>Latest</a><a href="${pathPrefix}archive/" data-theme-link>Archive</a></nav>${themeDots()}</div>
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
    ? `<img src="${pathPrefix}assets/${escapeHtml(issue.coverAsset)}" alt="${escapeHtml(issue.title_en || issue.title)} issue cover preview" loading="lazy" decoding="async">`
    : `<div class="type-cover" aria-hidden="true"><span>${escapeHtml(coverLead)}</span>${coverTail ? `<b>${escapeHtml(coverTail)}</b>` : ""}<i>${escapeHtml(issue.publication_date.slice(5).replace("-", "/"))}</i></div>`;
  return `<li class="issue-card" data-kind="${escapeHtml(issue.kind)}" style="--card-index:${position}"><a href="${pathPrefix}issues/${escapeHtml(issue.issue_id)}/" data-theme-link><div class="issue-card-cover">${cover}<span class="open-mark">OPEN ↗</span></div><div class="issue-card-copy"><p>${escapeHtml(issue.publication_date)} · ${escapeHtml(issue.kind === "current" ? "CURRENT FIELD" : "HISTORICAL ORIGINAL")}</p><h3>${escapeHtml(issue.title)}</h3><strong>${escapeHtml(issue.title_en)}</strong><span>${escapeHtml(issue.deck)}</span></div></a></li>`;
}

function issueGrid(issues, pathPrefix) {
  return `<ol class="issue-grid">${[...issues].reverse().map((issue, index) => issueCard(issue, pathPrefix, index)).join("")}</ol>`;
}

function issueRangeLabel(issues) {
  const dates = issues.map((issue) => issue.publication_date).sort();
  if (!dates.length) return "THE ISSUES";
  const [first, last] = [dates[0], dates.at(-1)];
  const monthName = (value) => new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" })
    .format(new Date(`${value}T00:00:00Z`)).toUpperCase();
  const day = (value) => String(Number(value.slice(8, 10))).padStart(2, "0");
  const firstMonth = monthName(first);
  const lastMonth = monthName(last);
  const range = firstMonth === lastMonth
    ? `${day(first)}—${day(last)} ${lastMonth}`
    : `${day(first)} ${firstMonth}—${day(last)} ${lastMonth}`;
  return `THE ISSUES / ${range}`;
}

function routeMap() {
  return `<svg class="route-map" viewBox="0 0 720 640" role="img" aria-label="A route connecting cover, major, signal and watch sections"><path d="M86 88 H410 V210 H620 V382 H330 V545 H86"/><circle cx="86" cy="88" r="14"/><circle cx="410" cy="210" r="14"/><circle cx="620" cy="382" r="14"/><circle cx="330" cy="545" r="14"/><text x="72" y="62">COVER</text><text x="360" y="188">MAJOR</text><text x="548" y="360">SIGNALS</text><text x="276" y="590">WATCH</text><text class="route-question" x="70" y="420">WHO GETS TO SPEAK?</text></svg>`;
}

function storyVisual(story, localPath, { loading = "lazy", label = "" } = {}) {
  if (!story?.media) return "";
  const external = story.media.external_image_url;
  const localImage = `<img class="local-art" src="${escapeHtml(localPath)}" alt="" loading="${loading}" decoding="async" width="1200" height="900">`;
  const sourceImage = external
    ? `<img class="source-art" data-external-preview="true" src="${escapeHtml(external)}" alt="${escapeHtml(story.media.alt)}" loading="${loading}" decoding="async" referrerpolicy="no-referrer" width="1200" height="900">`
    : "";
  return `${localImage}${sourceImage}${label ? `<span class="visual-label">${escapeHtml(label)}</span>` : ""}`;
}

function storyCategory(story) {
  const signal = `${story.id} ${story.title} ${story.english?.title ?? ""}`.toLowerCase();
  if (/(tmex|music|sound|音乐|声音)/.test(signal)) return "music";
  if (/(bape|stool|van-cleef|jewel|object|物件|珠宝|凳)/.test(signal)) return "objects";
  if (/(fashion|runway|seoul-fashion|时装|秀场)/.test(signal)) return "fashion";
  return "city";
}

function dailyIndex(issue) {
  if (!issue?.stories?.length) return "";
  const items = issue.dailyRadar?.items ?? issue.stories.map((story) => {
    const source = story.sources.find((candidate) => candidate.relationship === "first_party_official") ?? story.sources[0];
    return {
      id: story.id,
      category: storyCategory(story),
      included_story_id: story.id,
      included_in_issue: true,
      title: story.title,
      deck: story.english?.deck ?? story.english?.abstract ?? "Open the verified story and source chain.",
      publisher: source?.publisher ?? "Official source",
      official_url: story.media?.origin_url ?? source?.url ?? "#",
      media: story.media?.external_image_url ? { kind: "image", url: story.media.external_image_url, alt: story.media.alt, credit: story.media.credit } : null,
    };
  });
  const counts = Object.fromEntries(["fashion", "music", "objects", "city"].map((category) => [category, items.filter((item) => item.category === category).length]));
  const filters = [["all", "ALL", items.length], ["fashion", "FASHION", counts.fashion], ["music", "MUSIC", counts.music], ["objects", "OBJECTS", counts.objects], ["city", "CITY", counts.city]]
    .map(([value, label, count], index) => `<button type="button" data-story-filter="${value}" aria-pressed="${index === 0}"><span>${label}</span><small>${String(count).padStart(2, "0")}</small></button>`)
    .join("");
  const card = (item, index) => {
    const inIssue = item.included_in_issue !== false && Boolean(item.included_story_id);
    const href = inIssue ? `./issues/${escapeHtml(issue.issue_id)}/stories/${escapeHtml(item.included_story_id)}/` : escapeHtml(item.official_url);
    const linkAttrs = inIssue ? "data-theme-link" : `target="_blank" rel="noreferrer noopener"`;
    const imageUrl = item.media?.kind === "video" ? item.media.poster_url : item.media?.url;
    const media = imageUrl
      ? `<img class="source-art" data-external-preview="true" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.media.alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" width="900" height="900">`
      : "";
    const mediaLabel = item.media?.kind === "video" ? "VIDEO" : "OFFICIAL IMAGE";
    const date = item.event_date ?? item.published_date ?? issue.publication_date;
    return `<li data-story-card data-story-category="${escapeHtml(item.category)}" data-radar-kind="${inIssue ? "issue" : "extra"}"><a href="${href}" ${linkAttrs}><span class="radar-visual" data-visual-frame data-official-only data-category="${escapeHtml(item.category)}">${media}<span class="official-media-fallback"><b>${escapeHtml(item.publisher)}</b><small>OPEN OFFICIAL MEDIA ↗</small></span><span class="media-kind">${mediaLabel}</span><span class="visual-label">${String(index + 1).padStart(2, "0")}</span></span><span class="radar-meta"><strong>${escapeHtml(item.category)}</strong><span>${inIssue ? "IN ISSUE" : "EXTRA SIGNAL"}</span></span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.deck)}</p><span class="radar-source"><b>${escapeHtml(item.publisher)}</b><time>${escapeHtml(date)}</time></span><span class="radar-link">${inIssue ? "READ STORY" : "OPEN OFFICIAL"} ↗</span></a></li>`;
  };
  let index = 0;
  const groups = [
    ["issue", "01 / IN TODAY'S ISSUE", items.filter((item) => item.included_in_issue !== false && item.included_story_id)],
    ["extra", "02 / MORE FROM TODAY", items.filter((item) => item.included_in_issue === false || !item.included_story_id)],
  ].filter(([, , groupItems]) => groupItems.length).map(([kind, title, groupItems]) => `<section class="radar-group" data-radar-group="${kind}"><header><h3>${title}</h3></header><ol>${groupItems.map((item) => card(item, index++)).join("")}</ol></section>`).join("");
  return `<section class="daily-index" aria-labelledby="daily-index-title"><header><p>DAILY SELECTS / ${escapeHtml(issue.publication_date)}</p><div><h2 id="daily-index-title"><b>TODAY'S</b><i>FIELD NOTES.</i></h2></div></header><div class="radar-filters" role="group" aria-label="Filter today's selections">${filters}</div>${groups}</section>`;
}

export function renderHome({ issues, baseCss, themesCss, siteCss, siteJs }) {
  const latest = [...issues].sort((a, b) => a.publication_date.localeCompare(b.publication_date)).at(-1);
  const body = `<section class="home-hero" aria-labelledby="latest-title"><div class="hero-copy"><p class="hero-kicker">ISSUE ${String(issues.length).padStart(2, "0")} / ${escapeHtml(latest.publication_date)}</p><h1 id="latest-title"><a href="./issues/${escapeHtml(latest.issue_id)}/" data-theme-link>${escapeHtml(latest.title)}</a></h1><p class="hero-english">${escapeHtml(latest.title_en)}</p><p class="hero-deck">${escapeHtml(latest.deck)}</p><a class="hero-link" href="./issues/${escapeHtml(latest.issue_id)}/" data-theme-link>Read the latest issue <span aria-hidden="true">↗</span></a></div><div class="hero-map">${routeMap()}</div></section>
  ${dailyIndex(latest)}
  <section class="issue-field" aria-labelledby="field-title"><div class="section-heading"><p>${escapeHtml(issueRangeLabel(issues))}</p><h2 id="field-title">不是同一个模板。<br>是不同的进入。</h2><p>Each issue keeps its own visual grammar. The publication shell only helps you move between them.</p></div>${issueGrid(issues, "./")}</section>
  <section class="editorial-code" aria-labelledby="code-title"><p class="vertical-label">EDITORIAL CODE</p><div><h2 id="code-title">事实先站稳。<br>形式才开始冒险。</h2><p>We follow the story into its own visual world. References teach; they do not dictate. No JavaScript is required to read. No automated PASS can replace a human judgment.</p></div><dl><div><dt>01</dt><dd>TRUTH<br>可核验的事实</dd></div><div><dt>02</dt><dd>AUTHORSHIP<br>独立的表达</dd></div><div><dt>03</dt><dd>ACCESS<br>真实可用</dd></div></dl></section>`;
  return shell({ title: "Culture & Taste Daily — Preview", body, baseCss, themesCss, siteCss, siteJs, page: "home" });
}

export function renderArchive({ issues, baseCss, themesCss, siteCss, siteJs }) {
  const sorted = [...issues].sort((a, b) => b.publication_date.localeCompare(a.publication_date));
  const rows = sorted.map((issue, index) => `<li data-kind="${escapeHtml(issue.kind)}"><a href="../issues/${escapeHtml(issue.issue_id)}/"><span>${String(index + 1).padStart(2, "0")}</span><time datetime="${escapeHtml(issue.publication_date)}">${escapeHtml(issue.publication_date)}</time><div><strong>${escapeHtml(issue.title)}</strong><small>${escapeHtml(issue.title_en)}</small></div><em>${escapeHtml(issue.kind === "current" ? "CURRENT FIELD" : "ORIGINAL")}</em><i aria-hidden="true">↗</i></a></li>`).join("");
  const body = `<section class="archive-hero"><p>ARCHIVE / ${String(issues.length).padStart(2, "0")} ISSUES</p><h1>ARCHIVE</h1><div class="archive-note"><p>The archive is not a template gallery. It is a record of changing editorial positions, visual systems and constraints.</p><p>历史原件优先保留；无法恢复的部分会明确标注，而不是被新系统补写。</p></div></section><section class="archive-index" aria-labelledby="archive-title"><div class="archive-controls"><h2 id="archive-title">Complete index</h2><div role="group" aria-label="Filter issues"><button type="button" data-filter="all" aria-pressed="true">All</button><button type="button" data-filter="current" aria-pressed="false">Current</button><button type="button" data-filter="historical" aria-pressed="false">Historical</button></div></div><ol>${rows}</ol></section><section class="archive-covers" aria-label="Issue covers">${issueGrid(issues, "../")}</section>`;
  return shell({ title: "Archive — Culture & Taste Daily Preview", body, baseCss, themesCss, siteCss, siteJs, pathPrefix: "../", page: "archive" });
}

export function renderHistoricalWrapper({ meta, baseCss, themesCss, siteCss, siteJs }) {
  const body = `<section class="history-header"><p>${escapeHtml(meta.publication_date)} · HISTORICAL ORIGINAL</p><h1>${escapeHtml(meta.title)}</h1><strong>${escapeHtml(meta.title_en)}</strong><p>${escapeHtml(meta.deck)}</p><div class="history-actions"><a href="./original.html">Open the untouched original ↗</a><a href="../../archive/">Back to archive</a></div></section><section class="historical-frame" aria-labelledby="original-title"><div><p id="original-title">ORIGINAL SELF-CONTAINED HTML</p><span>Reader height adapts when scripts are available.</span></div><iframe data-historical-frame src="./original.html" title="Preserved Culture & Taste Daily issue ${escapeHtml(meta.publication_date)}"></iframe><p class="frame-fallback">If the embedded reader is unavailable, <a href="./original.html">open the untouched original in its own tab ↗</a>.</p></section><aside class="migration-note"><strong>Migration note</strong><p>${escapeHtml(meta.limitations.join(" "))}</p></aside>`;
  return shell({ title: `${meta.title} — Historical Preview`, body, baseCss, themesCss, siteCss, siteJs, pathPrefix: "../../", page: "historical" });
}

export function renderFacsimile({ meta, pageFiles, baseCss, themesCss, siteCss, siteJs }) {
  const pages = pageFiles.map((file, index) => `<li id="page-${index + 1}"><figure><img src="./pages/${escapeHtml(file)}" width="390" height="844" loading="${index === 0 ? "eager" : "lazy"}" decoding="async" alt="Historical web edition page ${index + 1} of ${pageFiles.length}"><figcaption><span>${String(index + 1).padStart(2, "0")} / ${String(pageFiles.length).padStart(2, "0")}</span><a href="#page-${index + 1}">Permalink ↗</a></figcaption></figure></li>`).join("");
  const body = `<section class="history-header facsimile-heading"><p>${escapeHtml(meta.publication_date)} · HISTORICAL WEB EDITION</p><h1>${escapeHtml(meta.title)}</h1><strong>${escapeHtml(meta.title_en)}</strong><p>${escapeHtml(meta.deck)}</p><div class="history-actions"><a href="./original.pdf">Download original PDF ↗</a><a href="../../archive/">Back to archive</a></div></section><section class="edition-intro"><p class="section-label">READING MAP / 16 SCREENS</p><h2>A page-by-page web edition, with the source still intact.</h2><p>The supplied artifact is a raster screenshot sequence. This reader gives each screen a stable anchor and keeps the exact PDF one click away; it does not invent missing article text.</p></section><aside class="migration-note"><strong>Honest limitation</strong><p>${escapeHtml(meta.limitations.join(" "))}</p></aside><ol class="facsimile-pages">${pages}</ol>`;
  return shell({ title: `${meta.title} — Historical Web Edition`, body, baseCss, themesCss, siteCss, siteJs, pathPrefix: "../../", page: "facsimile" });
}

function stripTags(value) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function storyContent(content, manifest, story) {
  const html = markdownRenderer(manifest).render(content, {});
  const startMarker = `<h2 id="${story.id}">`;
  const start = html.indexOf(startMarker);
  if (start < 0) return { lede: escapeHtml(story.english?.deck ?? story.title), body: [] };
  const afterHeading = html.indexOf("</h2>", start) + 5;
  const next = html.indexOf("<h2 id=", afterHeading);
  const section = html.slice(afterHeading, next < 0 ? undefined : next);
  const paragraphs = [...section.matchAll(/<p>([\s\S]*?)<\/p>/g)]
    .map((match) => ({ html: match[1], text: stripTags(match[1]) }))
    .filter((paragraph) => paragraph.text && !/^来源[：:]/.test(paragraph.text));
  return {
    lede: paragraphs[0]?.html ?? escapeHtml(story.english?.deck ?? story.title),
    body: paragraphs.slice(1).map((paragraph) => paragraph.html),
  };
}

function splitStoryTitle(title) {
  const characters = [...title];
  if (characters.length < 7) return [title];
  const cjkCount = characters.filter((character) => /[\u3400-\u9fff]/.test(character)).length;
  if (cjkCount / characters.length >= 0.6) {
    const lineCount = Math.ceil(characters.length / 5);
    const lineLength = Math.ceil(characters.length / lineCount);
    return Array.from({ length: lineCount }, (_, index) => characters.slice(index * lineLength, (index + 1) * lineLength).join(""));
  }
  const midpoint = Math.ceil(characters.length / 2);
  const candidates = characters
    .map((character, index) => (/[,，、：:；;—\s]/.test(character) ? index + 1 : -1))
    .filter((index) => index > 2 && index < characters.length - 2)
    .sort((a, b) => Math.abs(a - midpoint) - Math.abs(b - midpoint));
  const split = candidates[0] ?? midpoint;
  return [characters.slice(0, split).join(""), characters.slice(split).join("")];
}

function storySourceList(story) {
  const items = story.sources.map((source) => {
    const dates = [source.published_date, source.event_date].filter(Boolean).join(" · ");
    return `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer noopener">${escapeHtml(source.title)} ↗</a><span>${escapeHtml(source.publisher)}${dates ? ` · ${escapeHtml(dates)}` : ""}</span></li>`;
  }).join("");
  return `<section class="story-source-list" aria-labelledby="story-sources"><p>VERIFIED SOURCES / DATES</p><h2 id="story-sources">来源保持原样，阅读体验只改变观看方式。</h2><ol>${items}</ol></section>`;
}

function storyCard(story, number) {
  const localPath = story.media ? `../../${story.media.asset}` : "";
  return `<a class="related-card" href="../${escapeHtml(story.id)}/" data-theme-link><span class="related-card-visual" data-visual-frame>${storyVisual(story, localPath)}</span><span class="related-card-copy"><span>${String(number).padStart(2, "0")} · ${escapeHtml(story.level)}</span><strong>${escapeHtml(story.title)}</strong><span>READ STORY ↗</span></span></a>`;
}

export function renderStoryPage({ content, manifest, story, storyIndex, baseCss, themesCss = "", storyCss, siteJs = "" }) {
  const total = manifest.stories.length;
  const previous = manifest.stories[(storyIndex - 1 + total) % total];
  const next = manifest.stories[(storyIndex + 1) % total];
  const related = [1, 2, 3].map((offset) => manifest.stories[(storyIndex + offset) % total]);
  const parsed = storyContent(content, manifest, story);
  const bodyParagraphs = parsed.body.length ? parsed.body : [escapeHtml(story.english?.abstract ?? story.english?.deck ?? story.title)];
  const titleLines = splitStoryTitle(story.title).map((line) => `<span class="story-title-line">${escapeHtml(line)}</span>`).join("");
  const media = story.media ?? {};
  const mediaUrl = media.origin_url ?? story.sources[0]?.url ?? "#";
  const localPath = media.asset ? `../../${media.asset}` : "";
  const position = `${String(storyIndex + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
  const draftLabel = manifest.visibility === "future_draft" ? "TOMORROW DRAFT · NOT LATEST" : "PREVIEW EDITION · NOT PRODUCTION";
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="robots" content="noindex,nofollow">
  <meta name="color-scheme" content="light dark">
  <link rel="icon" type="image/png" href="../../../../assets/culture-taste-earth.png">
  <title>${escapeHtml(story.title)} — Culture &amp; Taste Daily ${escapeHtml(manifest.publication_date)}</title>
  ${themeBootstrap("story")}
  <style>${baseCss}\n${themesCss}\n${storyCss}</style>
</head>
<body data-story-reader data-issue="${escapeHtml(manifest.issue_id)}" data-story="${escapeHtml(story.id)}">
  <a class="skip-link" href="#main-content">Skip to content</a>
  <div class="story-reader-progress" aria-hidden="true"><span></span></div>
  <header class="story-reader-header">
    <a class="story-reader-brand" href="../../../../" data-theme-home aria-label="Culture &amp; Taste Daily">${textWordmark()}</a>
    <p class="story-position">${position} · ${escapeHtml(manifest.publication_date)}</p>
    <div class="story-reader-actions"><a href="../../../../#daily-index-title" data-theme-home>Daily Index</a><a href="../../" data-theme-link>Full issue</a>${themeDots()}</div>
  </header>
  <main id="main-content">
    <section class="story-opening" data-story-opening>
      <div class="story-opening-sticky">
        <div class="story-opening-copy"><p class="story-eyebrow">${escapeHtml(story.level)} / ${position} · ${draftLabel}</p><h1>${titleLines}</h1><p class="story-opening-english">${escapeHtml(story.english?.title ?? story.title)} — ${escapeHtml(story.english?.deck ?? "")}</p></div>
        <figure class="story-opening-visual" data-visual-frame>${storyVisual(story, localPath, { loading: "eager" })}<p class="image-failure-note">官方图片未载入，当前显示本地编辑图。</p><figcaption><span>OFFICIAL IMAGE · PREVIEW</span><a href="${escapeHtml(mediaUrl)}" target="_blank" rel="noreferrer noopener">查看来源 ↗</a></figcaption></figure>
      </div>
    </section>
    <section class="story-lede-stage"><p class="story-lede" data-word-reveal>${parsed.lede}</p></section>
    <section class="story-media-stage" data-media-stage><div class="story-media-sticky"><div class="story-media-frame" data-visual-frame>${storyVisual(story, localPath)}</div><p class="story-media-meta"><span>${escapeHtml(media.caption ?? story.title)}</span><a href="${escapeHtml(mediaUrl)}" target="_blank" rel="noreferrer noopener">${escapeHtml(media.credit ?? story.sources[0]?.publisher ?? "SOURCE")} ↗</a></p></div></section>
    <section class="story-reading-stage"><aside class="story-judgment"><p class="story-stage-label">EDITORIAL JUDGMENT / ${escapeHtml(story.level)}</p><h2>${escapeHtml(story.english?.title ?? "WHY IT MATTERS")}</h2><p>${escapeHtml(story.english?.abstract ?? story.english?.deck ?? "")}</p></aside><div class="story-body-copy">${bodyParagraphs.map((paragraph) => `<p>${paragraph}</p>`).join("")}</div></section>
    ${storySourceList(story)}
    <nav class="story-sibling-nav" aria-label="Story navigation"><a href="../${escapeHtml(previous.id)}/" data-theme-link>← ${escapeHtml(previous.title)}</a><a href="../../" data-theme-link>查看完整期刊</a><a href="../${escapeHtml(next.id)}/" data-theme-link>${escapeHtml(next.title)} →</a></nav>
    <section class="story-related" aria-labelledby="related-title"><div class="related-heading"><div><p>STAY IN TODAY'S ISSUE</p><h2 id="related-title">继续看同一天。</h2></div><span>${escapeHtml(manifest.publication_date)}</span></div><div class="related-grid">${related.map((item) => storyCard(item, manifest.stories.indexOf(item) + 1)).join("")}</div></section>
    <a class="next-story" href="../${escapeHtml(next.id)}/" data-theme-link><span class="next-story-media" data-visual-frame>${storyVisual(next, next.media ? `../../${next.media.asset}` : "")}</span><div class="next-story-copy"><span class="next-story-kicker">NEXT STORY · ${String(manifest.stories.indexOf(next) + 1).padStart(2, "0")}/${String(total).padStart(2, "0")}</span><h2>${escapeHtml(next.title)}</h2><span>CONTINUE READING ↗</span></div></a>
  </main>
  ${siteJs ? `<script>${siteJs}</script>` : ""}
</body>
</html>
`;
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
  const routes = ["", "archive/", ...issues.flatMap((issue) => [
    `issues/${issue.issue_id}/`,
    ...(issue.stories ?? []).map((story) => `issues/${issue.issue_id}/stories/${story.id}/`),
  ])];
  const urls = routes.map((route) => `<url><loc>${escapeXml(new URL(route, baseUrl).href)}</loc></url>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`;
}
