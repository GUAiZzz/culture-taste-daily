import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { categoryNames, escapeHtml as esc, renderMarkdown, renderWithInsertions, loadReadingModel, selectDailyQuote } from './reading-content.mjs';

const internal = (href, content, classes = '', attributes = '') => `<a data-internal href="${esc(href)}"${classes ? ` class="${classes}"` : ''}${attributes ? ` ${attributes}` : ''}>${content}</a>`;
const external = (href, content, attributes = '') => `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer"${attributes ? ` ${attributes}` : ''}>${content}</a>`;
const number = n => String(n).padStart(2, '0');
const storyHref = (story, from = 'issue') => `${story.url}?from=${from}`;
const dateLabel = date => `${Number(date.slice(5, 7))} 月 ${Number(date.slice(8))} 日`;

function settings() {
  const buttons = (attribute, options) => options.map(([key, label], index) => `<button type="button" data-ct-control="pill" ${attribute}="${key}" aria-pressed="${index === 0}">${label}</button>`).join('');
  return `<dialog class="reader-settings-dialog ct-dialog" id="reading-settings" aria-labelledby="settings-title"><div class="settings-sheet"><div class="settings-header ct-dialog-head"><h2 id="settings-title">阅读设置</h2><button type="button" data-ct-close data-ct-control="icon" class="settings-close" aria-label="关闭阅读设置">×</button></div><div class="ct-settings-group reader-language-group"><h3>正文语言</h3><div class="ct-theme-options reader-language-options" role="group" aria-label="正文语言">${buttons('data-language', [['zh', '中文'], ['en', 'EN']])}</div></div><div class="reader-font-control ct-font-control ct-settings-group"><div class="font-label-row ct-font-label"><label for="font-size">正文字号</label><output id="font-value" data-reader-font-value data-font-value for="font-size">19px</output></div><input id="font-size" data-reader-font data-font-size class="reader-font-range ct-font-range" type="range" min="17" max="25" step="1" value="19" aria-valuetext="19px"></div><div class="ct-settings-group"><h3>阅读风格</h3><div class="ct-theme-options reader-style-options" role="group" aria-label="阅读风格">${buttons('data-pref-style', [['field', '场域'], ['coral', '印刷'], ['analog', '信号']])}</div></div><div class="ct-settings-group"><h3>阅读外观</h3><div class="ct-theme-options reader-theme-options" role="group" aria-label="阅读外观">${buttons('data-pref-theme', [['light', '明亮'], ['dark', '夜读'], ['warm', '暖灰']])}</div></div><div class="ct-settings-group"><h3>工具外观</h3><div class="ct-theme-options surface-options" role="group" aria-label="工具外观">${buttons('data-pref-surface', [['solid', '实色'], ['glass', '轻玻璃']])}</div></div><label class="ct-setting-row"><span>触感反馈</span><input type="checkbox" id="haptics-toggle" data-haptics class="ct-switch" role="switch"></label><p role="status" id="settings-status" class="sr-only" aria-live="polite"></p></div></dialog>`;
}

function imageDialog() {
  return `<dialog class="image-dialog ct-dialog" id="image-dialog" aria-label="放大查看图像"><div class="dialog-header"><span>把作品看近一点</span><button class="dialog-close" data-ct-close data-ct-control="icon" type="button" aria-label="关闭放大图像">×</button></div><div class="dialog-image-area"><img src="/assets/culture-taste-earth.png" alt=""><span class="dialog-error">图片暂不可用，请打开官方来源查看。</span></div><div class="dialog-caption"><p><span class="dialog-caption-text"></span><span class="dialog-credit"></span></p><a class="dialog-source" href="#main" target="_blank" rel="noopener noreferrer">官方来源 ↗</a></div></dialog>`;
}

function settingsTrigger() {
  return `<button class="room-trigger settings-trigger" data-open-settings data-open-dialog data-ct-control="icon" aria-haspopup="dialog" aria-controls="reading-settings" aria-label="阅读设置" type="button"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 7h16M4 17h16M8 4v6M16 14v6"/></svg></button>`;
}

function header({ article = false, story, issue } = {}) {
  if (article) return `<header class="site-header reader-toolbar" id="toolbar"><div class="tool-inner"><a data-internal data-back data-reading-return data-ct-control="icon" class="reader-back" href="${esc(issue.url + '#story-' + story.id)}" aria-label="返回本期目录"><span aria-hidden="true">←</span></a>${settingsTrigger()}</div><div class="progress-track" aria-hidden="true"><div id="progress-fill" data-reader-progress></div></div></header>`;
  return `<header class="site-header masthead">${internal('/', 'Culture <i>&amp;</i> Taste <small>Daily</small>', 'wordmark brand', 'data-site-home aria-label="Culture & Taste Daily 首页"')}<nav class="site-nav" aria-label="主要导航">${internal('/#stories', '本期选读')}${internal('/archive/', '往期档案')}</nav>${settingsTrigger()}</header>`;
}

function photoWindow(story, { eager = false } = {}) {
  const media = story.media;
  return `<div class="story-image photo-window"><img class="fallback" src="/issues/${story.date}/${esc(media.asset)}" alt="" aria-hidden="true" width="1200" height="720"><span class="photo-fallback fallback-label" data-preview-fallback><span class="media-message" data-photo-status role="status" aria-live="polite">原创回退图 · 非纪实</span></span><img class="official" data-external-preview="true" src="${esc(media.external_image_url)}" alt="${esc(media.alt)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async" referrerpolicy="no-referrer"></div>`;
}

function photoCaption(story) {
  const media = story.media;
  return `<figcaption class="story-source"><div class="photo-note"><span class="source-state" data-original-note="官方外链图片">${esc(media.caption || '官方外链图片')}</span>${external(media.origin_url, '官方图源 <span aria-hidden="true">↗</span>', `data-ct-control="subtle" aria-label="查看官方图源：${esc(story.title)}"`)}<button type="button" data-retry-photo data-ct-control="pill" hidden>重试图片</button></div><p class="image-credit">${esc(media.credit || story.image_credit || story.sources[0]?.publisher)}</p></figcaption>`;
}

function storyCard(story, { from = 'home', archive = false } = {}) {
  return `<article class="story story-card story-${story.index + 1}" id="card-${story.date}-${story.id}" data-story-category="${story.category}" data-category="${story.category}"${archive ? ` data-catalog-item data-kind="articles" data-date="${story.date}" data-search="${esc([story.title, story.english?.title, story.issueTitle, story.date].join(' '))}"` : ''}><figure class="photo" data-photo data-media-kind="${esc(story.media.kind)}">${internal(storyHref(story, from), `${photoWindow(story, { eager: from === 'home' && story.index < 2 })}<div class="story-copy card-copy"><p class="story-meta meta"><span class="category">${categoryNames[story.category]}</span><time datetime="${story.date}">${dateLabel(story.date)}</time></p><h2 class="entry-title" id="title-${story.date}-${story.id}">${esc(story.title)}</h2></div>`, 'ct-story-entry story-open', `aria-labelledby="title-${story.date}-${story.id}"`)}${photoCaption(story)}</figure><p class="story-summary editorial-deck">${esc(story.intro)}</p></article>`;
}

function inlineFigure(rows) {
  const first = rows[0];
  return `<figure class="inline-visual ${rows.length > 1 ? 'visual-pair' : 'visual-single'}" data-inline-visual data-after-zh="${first.after_zh_paragraph}" data-after-en="${first.after_en_paragraph}"><div class="visual-grid">${rows.map(row => `<figure class="visual-item photo" data-photo data-media-kind="source_image"><a class="visual-open" data-zoom-image href="${esc(row.external_image_url)}" target="_blank" rel="noopener noreferrer" data-caption="${esc(row.caption)}" data-credit="${esc(row.credit)}" data-origin="${esc(row.origin_url)}" aria-label="放大查看：${esc(row.alt)}"><span class="inline-placeholder photo-fallback" data-preview-fallback><span class="image-loading" data-photo-status role="status">点击查看官方图片</span><span class="image-unavailable">图片暂不可用，可继续阅读或打开官方来源</span></span><img class="official" data-external-preview="true" src="${esc(row.external_image_url)}" alt="${esc(row.alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer"></a><figcaption class="visual-caption">${esc(row.caption)}<span class="visual-credit">${esc(row.credit)}</span>${external(row.origin_url, '官方来源 ↗', 'data-ct-control="subtle"')}</figcaption></figure>`).join('')}</div></figure>`;
}

function languageBodies(story, { issue = false } = {}) {
  const groups = new Map();
  for (const row of story.inlineMedia) {
    const key = `${row.after_zh_paragraph}/${row.after_en_paragraph}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const insertions = new Map();
  for (const rows of groups.values()) insertions.set(rows[0].after_zh_paragraph, (insertions.get(rows[0].after_zh_paragraph) || '') + inlineFigure(rows));
  const suffix = issue ? `-${story.id}` : '';
  return `<div class="article-body prose" id="${issue ? `issue-body-${story.id}` : 'article-body'}" data-reading-body data-source-body="${story.id}"><section class="zh-reading" id="chinese-reading${suffix}" data-reading-language="zh" lang="zh-CN" aria-label="${esc(story.title)} · 中文正文">${renderWithInsertions(story.zhMarkdown, insertions)}</section><details class="en-reading english-reading" id="english-reading${suffix}" data-reading-language="en" lang="en" open><summary>${story.hasFullEnglish ? 'Read the complete story in English' : 'Read the English abstract'} <span aria-hidden="true">↓</span></summary><div class="english-content">${story.enHtml}</div></details></div>`;
}

function sourceDetails(story, { issue = false } = {}) {
  const rawUrls = new Set([...story.sourcesMarkdown.matchAll(/\]\((https?:\/\/[^\s)]+)\)/g)].map(match => match[1]));
  const extra = story.sources.filter(source => !rawUrls.has(source.url));
  const metadata = source => `<small class="source-metadata">${esc(source.publisher)}${source.published_date ? ' · 发布 ' + esc(source.published_date) : ''}${source.event_date ? ' · 活动 ' + esc(source.event_date) : ''}</small>`;
  // Retain the locked footer, including its notes and order. Add canonical dates
  // next to the original citation rather than rendering a second source index.
  const footer = renderMarkdown(story.sourcesMarkdown).replace(/<a\b[^>]*href="([^"]+)"[^>]*>[\s\S]*?<\/a>/g, (anchor, href) => {
    const source = story.sources.find(item => esc(item.url) === href);
    return source ? anchor + metadata(source) : anchor;
  });
  return `<details class="sources ct-details" id="${issue ? 'sources-' + story.id : 'sources'}" open><summary><span><span class="eyebrow sr-only">Sources &amp; Dates</span><strong>资料索引</strong></span><span class="sources-summary-right">${story.sources.length} 条来源</span></summary><div class="source-copy">${footer}${extra.length ? `<ol class="source-supplement">${extra.map(source => `<li>${external(source.url, esc(source.title || source.publisher) + ' ↗')}${metadata(source)}</li>`).join('')}</ol>` : ''}</div>${story.inlineMedia.length ? `<details class="image-notes ct-details"><summary>图像资料与使用边界 <span>${story.inlineMedia.length} 张正文图</span></summary>${story.inlineMedia.map(row => `<div class="image-note-row"><p>${esc(row.caption)}</p><p>${esc(row.credit)}</p><p class="image-rights-note">官方出处已核验，复制使用权未确认；本 Preview 仅外链原官方图片。</p>${external(row.origin_url, '官方页面 ↗')}</div>`).join('')}</details>` : ''}</details>`;
}

function mainFigure(story, eager = false) {
  const media = story.media;
  return `<figure class="photo image-frame reader-hero" data-photo data-media-kind="${esc(media.kind)}"><a class="hero-visual-open" data-zoom-image href="${esc(media.external_image_url)}" target="_blank" rel="noopener noreferrer" data-caption="${esc(media.caption || '')}" data-credit="${esc(media.credit || story.image_credit)}" data-origin="${esc(media.origin_url)}" aria-label="放大查看：${esc(media.alt)}">${photoWindow(story, { eager })}</a>${photoCaption(story)}</figure>`;
}

function quoteMarkup(pool, date, mode = 'static') {
  const quote = selectDailyQuote(pool, date);
  return `<section class="daily-quote" id="quotation-of-the-day" data-daily-quote data-quote-id="${quote.id}" data-quote-mode="${mode}" data-quote-date="${date}" aria-labelledby="quote-title"><div class="quote-heading"><h2 id="quote-title">QUOTATION OF THE DAY</h2><time datetime="${date}">${date.replaceAll('-', '.')}</time></div><blockquote cite="${esc(quote.sourceUrl)}"><p class="quote-original" data-quote-original lang="en">${esc(quote.text)}</p><p class="quote-translation" data-quote-translation>${esc(quote.translation)}</p></blockquote><div class="quote-footer"><cite class="quote-author" data-quote-author>${esc(quote.author)} · ${esc(quote.authorZh)}</cite>${external(quote.sourceUrl, '出处 <span aria-hidden="true">↗</span>', `class="quote-source" data-quote-source title="${esc(quote.sourceTitle)} · ${quote.sourceYear} · ${esc(quote.translationNote)}" aria-label="引言出处：${esc(quote.sourceTitle)}"`)}</div></section>`;
}

function issueCard(issue, { archive = false } = {}) {
  const date = issue.date || issue.issue_id, title = issue.title;
  const categories = issue.categories || [...new Set((issue.stories || []).map(story => story.category).filter(Boolean))];
  const cover = issue.cover || (issue.coverAsset ? `<img src="/assets/${esc(issue.coverAsset)}" alt="${esc(title)} 原版封面" loading="lazy" decoding="async">` : `<strong>${esc(title)}</strong>`);
  return `<article class="issue-card" id="issue-${date}"${archive ? ` data-catalog-item data-kind="issues" data-date="${date}" data-categories="${categories.join(' ')}" data-search="${esc([date, title, ...(issue.stories || []).map(story => story.title)].join(' '))}"` : ''}>${internal(`/issues/${date}/?from=${archive ? 'archive' : 'home'}`, `<div class="cover-box">${cover}</div><div class="issue-card-copy"><time datetime="${date}">${date}</time><h3>${esc(title)}</h3><span>${issue.count_label ? esc(issue.count_label) + ' · ' : issue.stories?.length ? issue.stories.length + ' 篇 · ' : ''}${issue.preservation_kind && issue.preservation_kind !== 'native_issue' ? '历史原版 · ' : ''}进入本期 ↗</span></div>`, 'issue-open')}</article>`;
}

function extras(issue) {
  if (!issue.extras.length) return '';
  return `<section class="extras further-signals" id="extra-signals"><header class="section-heading"><div><p class="eyebrow">FURTHER SIGNALS</p><h2>继续留意</h2></div><p>本期之外的 ${issue.extras.length} 条线索，直达官方来源。</p></header><div class="extra-list">${issue.extras.map((item, index) => external(item.official_url, `<span class="signal-number">${number(index + 1)}</span><span class="extra-copy"><small>${categoryNames[item.category] || ''}</small><strong>${esc(item.title)}</strong><span>${esc(item.deck)}</span></span><span class="extra-source">${esc(item.publisher)} ↗</span>`)).join('')}</div></section>`;
}

function normalizeHtml(html) {
  let index = 0;
  html = html.replace(/<svg\b[\s\S]*?<\/svg>/g, svg => {
    const prefix = `art-${++index}-`, ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    for (const id of ids) svg = svg.replaceAll(`id="${id}"`, `id="${prefix}${id}"`).replaceAll(`url(#${id})`, `url(#${prefix}${id})`).replaceAll(`href="#${id}"`, `href="#${prefix}${id}"`);
    return svg.replace(/aria-labelledby="([^"]+)"/g, (_, value) => `aria-labelledby="${value.split(' ').map(id => ids.includes(id) ? prefix + id : id).join(' ')}"`);
  });
  return html.split(/(<script[\s\S]*?<\/script>)/g).map(part => part.startsWith('<script') ? part : part.replace(/&(?!#\d+;|#x[\da-f]+;|[a-z]+;)/gi, '&amp;')).join('');
}

export async function buildReadingSystem({ repoRoot, outDir, validatedIssues, publicationIssues }) {
  const { issues, latest, dates, allStories, preserved, legacyStories, quotePool } = await loadReadingModel({ repoRoot, validatedIssues, publicationIssues });
  if (!latest) return [];
  await mkdir(path.join(outDir, 'rooms'), { recursive: true });
  const assetRevisions = {}, assetContents = {};
  const textureNames = ['print-stock.svg', 'coral-ink.svg', 'text-ink.svg', 'tv-grain.svg', 'tv-wear.svg'];
  const assetNames = [...textureNames, 'interaction.css', 'interaction.js', 'reading-system.css', 'reading-system.js', 'daily-quote.css', 'daily-quote.js', 'daily-quotes.js'];
  for (const name of assetNames) {
    assetContents[name] = await readFile(path.join(repoRoot, 'core/rooms', name));
    assetRevisions[name] = createHash('sha256').update(assetContents[name]).digest('hex').slice(0, 12);
  }
  for (const name of assetNames) {
    let bytes = assetContents[name];
    if (name.endsWith('.css')) {
      bytes = Buffer.from(bytes.toString().replace(/url\((['"]?)(?:\.\/)?(print-stock\.svg|coral-ink\.svg|text-ink\.svg|tv-grain\.svg|tv-wear\.svg)\1\)/g, (_, quote, asset) => `url(${quote}./${asset}?v=${assetRevisions[asset]}${quote})`));
      assetRevisions[name] = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
    }
    await writeFile(path.join(outDir, 'rooms', name), bytes);
  }
  await copyFile(path.join(repoRoot, 'core/rooms/daily-quotes.public.json'), path.join(outDir, 'rooms/daily-quotes.public.json'));
  const routes = [];
  function shell(title, body, { type = 'home', issue = latest, story } = {}) {
    const article = type === 'article';
    return `<!DOCTYPE html><html lang="zh-CN" data-theme="light" data-style="field" data-surface="solid"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow"><meta name="color-scheme" content="light dark"><title>${esc(title)} · Culture &amp; Taste</title><link rel="icon" href="/assets/culture-taste-earth.png"><link rel="stylesheet" href="/rooms/interaction.css"><link rel="stylesheet" href="/rooms/reading-system.css"><link rel="stylesheet" href="/rooms/daily-quote.css"><script src="/rooms/interaction.js" defer></script><script src="/rooms/daily-quotes.js" defer></script><script src="/rooms/daily-quote.js" defer></script><script src="/rooms/reading-system.js" defer></script></head><body data-reader="rooms-v2" data-reading-system="soft-v1" data-content-sha256="${issue.hash}" data-issue-date="${issue.date}" class="page-${type}" id="top"><div class="paper-atmosphere" aria-hidden="true"></div><div class="reading-tv-surface" aria-hidden="true"></div><div class="tv-screen-edge" aria-hidden="true"></div><a class="skip skip-link" href="#main">跳到正文</a>${header({ article, issue, story })}<main id="main">${body}${article ? '' : quoteMarkup(quotePool, issue.date, type === 'home' ? 'daily' : 'static')}</main>${settings()}${imageDialog()}<footer class="site-footer">${internal('/', 'Culture &amp; Taste Daily', '', 'data-site-home')}${internal('/archive/', '往期档案 ↗')}<a href="/history/">版本历史 ↗</a><span class="footer-note preview-note">NON-PRODUCTION PREVIEW · 最新 ${latest.date}</span></footer>${article ? '<a href="#main" class="back-top" data-ct-control="icon" aria-label="返回文章顶部">↑</a>' : ''}${type === 'home' ? '<a href="#stories" class="floating-return js-only" data-ct-control="pill" aria-label="回到文章分类" aria-hidden="true" tabindex="-1">本期文章 <span aria-hidden="true">↑</span></a>' : ''}<div class="sr-only" role="status" id="reader-status" aria-live="polite"></div></body></html>`;
  }
  async function page(url, html) {
    const file = url === '/' ? 'index.html' : url.slice(1) + 'index.html';
    const depth = url === '/' ? 0 : url.split('/').filter(Boolean).length, prefix = depth ? '../'.repeat(depth) : './';
    html = normalizeHtml(html).replace(/(href|src)="\/rooms\/([^"]+)"/g, (_, attribute, name) => `${attribute}="/rooms/${name}${assetRevisions[name] ? '?v=' + assetRevisions[name] : ''}"`).replace(/(href|src)="\/(?!\/)([^"]*)"/g, (_, attribute, value) => `${attribute}="${prefix}${value}"`);
    await mkdir(path.dirname(path.join(outDir, file)), { recursive: true });
    await writeFile(path.join(outDir, file), html);
    routes.push(url);
  }
  function intro(issue, home = false) {
    return `<section class="issue-intro ${home ? 'home-intro' : 'issue-heading'}"><div class="hero-copy"><p class="eyebrow">${issue.date} · ${issue.stories.length} 篇正式文章</p><h1>${esc(issue.title)}</h1><p class="intro-en" lang="en">${esc(issue.en)}</p><p class="issue-position">${esc(issue.position)}</p></div><div class="issue-meta"><span>FASHION · MUSIC · OBJECTS · CITY</span>${home ? internal(issue.url + '#issue-contents', '本期目录 ↗', 'issue-index-link') : internal(issue.url + 'original-edition.html', '本期原版陈列 ↗', 'issue-index-link')}</div></section>`;
  }
  function homeStories(issue) {
    const groups = [], boundaries = [0, 2, 5, 7, Math.max(7, issue.stories.length)];
    for (let n = 0; n < boundaries.length - 1; n++) {
      const rows = issue.stories.slice(boundaries[n], boundaries[n + 1]);
      if (rows.length) groups.push(`<div class="story-group ${n === 0 ? 'lead-group' : n === 1 ? 'group-spacing' : 'bottom-group'}" data-group data-story-group>${rows.map(story => storyCard(story)).join('')}</div>`);
    }
    return `<section class="stories daily-stories" id="stories"><div class="browse-controls"><div><p class="eyebrow">IN THIS ISSUE</p><h2>本期选读</h2></div><nav class="category-rail category-jumps" aria-label="筛选本期分类">${[['all', '全部'], ...Object.entries(categoryNames)].map(([key, label], index) => `<button type="button" data-home-category="${key}" data-category-filter="${key}" data-ct-control="pill" aria-pressed="${index === 0}">${label} <small>${key === 'all' ? issue.stories.length : issue.stories.filter(story => story.category === key).length}</small></button>`).join('')}</nav></div><p class="home-filter-status filter-status" role="status" aria-live="polite">本期正式文章 · ${issue.stories.length} 篇</p><div class="category-board">${groups.join('')}</div><p class="home-empty filter-empty" id="filter-empty" hidden>本期没有这一类文章，可换个领域继续读。</p></section>`;
  }
  await page('/', shell('最新一期', `${intro(latest, true)}${homeStories(latest)}${extras(latest)}<section class="previous-issues"><header class="section-heading"><h2>再往前读</h2>${internal('/archive/', '全部往期 ↗')}</header><div class="issue-grid">${issues.slice(0, -1).reverse().slice(0, 3).map(issue => issueCard(issue)).join('')}</div></section>`));

  for (const issue of issues) {
    const toc = `<nav class="issue-toc" id="issue-contents" aria-label="本期目录"><p class="eyebrow">CONTENTS · ${issue.stories.length}</p>${issue.stories.map(story => `<a href="#story-${story.id}"><span>${number(story.index + 1)}</span><span>${esc(story.title)}</span><small>${categoryNames[story.category]}</small></a>`).join('')}</nav>`;
    const articles = issue.stories.map(story => `<article class="issue-story" id="story-${story.id}" data-story-category="${story.category}"><header class="article-header"><p class="eyebrow">${number(story.index + 1)} · ${categoryNames[story.category]}</p><h2 class="title-zh">${internal(storyHref(story), esc(story.title), 'story-open')}</h2><p class="title-en" lang="en">${esc(story.english.title)}</p></header>${mainFigure(story)}${languageBodies(story, { issue: true })}${sourceDetails(story, { issue: true })}${internal(storyHref(story), '单独阅读 ↗', 'text-link')}<a href="#issue-contents" class="return-contents" data-ct-control="subtle">返回本期目录 ↑</a></article>`).join('');
    await page(issue.url, shell(issue.title, `${intro(issue)}<section class="issue-opening"><div class="intro-copy prose">${issue.intro}</div>${toc}</section><section class="issue-body">${articles}<div class="issue-exit prose">${issue.closing}</div></section>${extras(issue)}`, { type: 'issue', issue }));
    for (const story of issue.stories) {
      const neighbor = (candidate, direction) => candidate ? internal(storyHref(candidate), `<span class="pager-label">${direction === 'prev' ? '← 本期上一篇' : '本期下一篇 →'}</span><span>${esc(candidate.title)}</span>`, `pager-item ${direction}`, 'data-story-nav') : `<span class="pager-item disabled" aria-disabled="true"><span class="pager-label">${direction === 'prev' ? '← 本期上一篇' : '本期下一篇 →'}</span><span>${direction === 'prev' ? '这是本期第一篇' : '这是本期最后一篇'}</span></span>`;
      const issueIndex = `<details class="issue-index ct-details"><summary><span>本期全部文章</span><span>${issue.stories.length} 篇</span></summary><div class="story-options">${issue.stories.map(candidate => internal(storyHref(candidate), `<span>${number(candidate.index + 1)}</span><span>${esc(candidate.title)}</span>`, `story-option${candidate.id === story.id ? ' current' : ''}`, candidate.id === story.id ? 'aria-current="page"' : '')).join('')}</div></details>`;
      const body = `<div class="reading-layout" id="reading"><article class="article-main"><header class="article-header"><p class="eyebrow"><time datetime="${issue.date}">${issue.date}</time> · ${categoryNames[story.category]} · 第 ${story.index + 1} / ${issue.stories.length} 篇</p><h1 class="title-zh">${esc(story.title)}</h1><p class="title-en" lang="en">${esc(story.english.title)}</p></header>${mainFigure(story, true)}${languageBodies(story)}<div class="article-end" aria-hidden="true"><i>&amp;</i></div>${sourceDetails(story)}<nav class="article-pager" aria-label="本期前后文章">${neighbor(issue.stories[story.index - 1], 'prev')}${neighbor(issue.stories[story.index + 1], 'next')}</nav>${issueIndex}<div class="article-return">${internal(issue.url + '#story-' + story.id, '返回本期目录 ↑', 'return-contents', 'data-reading-return data-back')}${internal(issue.url + 'original-edition.html', '本期原版陈列 ↗')}</div></article></div><noscript><p class="nojs-notice">完整静态阅读：中文、英文和资料索引均已包含在本页。</p></noscript>`;
      await page(story.url, shell(story.title, body, { type: 'article', issue, story }));
    }
  }

  const archiveStories = [...allStories, ...legacyStories];
  const preservedWithCategories = preserved.map(issue => ({ ...issue, stories: (issue.stories || []).map(story => ({ ...story, category: legacyStories.find(candidate => candidate.id === story.id && candidate.date === issue.issue_id)?.category })) }));
  const archiveIssues = [...issues, ...preservedWithCategories].sort((a, b) => (b.date || b.issue_id).localeCompare(a.date || a.issue_id));
  const legacyCards = legacyStories.map(story => `<article class="story story-card legacy-story" id="card-${story.date}-${story.id}" data-catalog-item data-kind="articles" data-date="${story.date}" data-category="${story.category}" data-search="${esc([story.title, story.issueTitle, story.date].join(' '))}">${internal(storyHref(story, 'archive'), `<div class="story-copy"><p class="story-meta">${story.date} · ${categoryNames[story.category]}</p><h2 class="entry-title">${esc(story.title)}</h2><p>阅读保留原版 ↗</p></div>`, 'ct-story-entry story-open')}</article>`).join('');
  const months = [...new Set(archiveIssues.map(issue => (issue.date || issue.issue_id).slice(0, 7)))];
  const archive = `<header class="archive-title issue-intro"><div class="hero-copy"><p class="eyebrow">CULTURE &amp; TASTE · ARCHIVE</p><h1>往期档案</h1><p>${publicationIssues.length} 期刊物 · ${archiveStories.length} 篇文章</p></div></header><section class="catalog" id="catalog"><div class="catalog-tools"><div class="catalog-tabs" role="group" aria-label="档案浏览方式"><button type="button" data-view="issues" data-ct-control="pill" aria-pressed="true">按期浏览 <small>${publicationIssues.length}</small></button><button type="button" data-view="articles" data-ct-control="pill" aria-pressed="false">全部文章 <small>${archiveStories.length}</small></button></div><div class="article-tools"><label class="search-label"><span>搜索期刊与文章</span><input type="search" id="catalog-search" placeholder="日期、标题、人物或品牌" autocomplete="off"></label><label class="month-label"><span>收录月份</span><select id="catalog-month"><option value="all">全部月份</option>${months.map(month => `<option value="${month}">${month.replace('-', ' 年 ')} 月</option>`).join('')}</select></label><div class="category-tabs" role="group" aria-label="文章分类">${[['all', '全部'], ...Object.entries(categoryNames)].map(([key, label], index) => `<button type="button" data-category-filter="${key}" data-ct-control="pill" aria-pressed="${index === 0}">${label}</button>`).join('')}</div></div><div class="catalog-feedback"><p class="catalog-status" role="status" aria-live="polite">全部期刊与文章</p><button type="button" class="catalog-reset" data-clear-search data-ct-control="pill">清除筛选</button></div></div><div class="week-heading"><span>由新到旧</span><span>完整日期档案</span></div><div class="catalog-items issue-grid" data-catalog="issues">${archiveIssues.map(issue => issueCard(issue, { archive: true })).join('')}</div><div class="catalog-items article-catalog" data-catalog="articles"><h2 class="nojs-title">全部文章</h2>${allStories.map(story => storyCard(story, { from: 'archive', archive: true })).join('')}${legacyCards}</div><div class="empty-state" hidden><h2>没有匹配的内容</h2><p>试试其他关键词、月份或分类。</p></div><nav class="pagination" aria-label="档案分页"></nav><noscript><p>静态阅读模式：完整期刊与文章均列于本页。</p></noscript></section>`;
  await page('/archive/', shell('往期档案', archive, { type: 'archive' }));
  await writeFile(path.join(outDir, 'content-index.json'), JSON.stringify({ issues: issues.map(issue => ({ date: issue.date, title: issue.title, url: issue.url, stories: issue.stories.length })), articles: archiveStories.map(({ id, title, date, category, url, index }) => ({ id, title, date, category, url, index })) }, null, 2));
  await writeFile(path.join(outDir, 'provenance.json'), JSON.stringify({ pages: routes.length, routes, issues: issues.map(issue => ({ date: issue.date, stories: issue.stories.length, radar: issue.extras.length + issue.stories.length, sha256: createHash('sha256').update(issue.raw).digest('hex'), locked: issue.locked })), articles: allStories.length, extras: issues.reduce((sum, issue) => sum + issue.extras.length, 0), source_modified: false, original_photos: 'External first-party Preview images only; reproduction rights remain unresolved', renderer_version: 'soft-v1', content_compatibility: 'rooms-v2', inline_media: issues.flatMap(issue => issue.stories.filter(story => story.inlineMedia.length).map(story => ({ issue: issue.date, story: story.id, images: story.inlineMedia.length }))) }, null, 2));
  return dates;
}
