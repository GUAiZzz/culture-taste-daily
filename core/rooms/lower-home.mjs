import { escapeHtml as esc, selectDailyQuote } from './reading-content.mjs';

const number = value => String(value).padStart(2, '0');
const category = { fashion: ['时装', 'Fashion'], music: ['音乐', 'Music'], objects: ['物件', 'Objects'], city: ['城市', 'City'] };
const pair = (zh, en) => `<span data-locale-variant="zh">${esc(zh)}</span><span data-locale-variant="en" lang="en">${esc(en)}</span>`;
const attrs = (name, zh, en) => `${name}="${esc(zh)}" data-l10n-${name}-zh="${esc(zh)}" data-l10n-${name}-en="${esc(en)}"`;
const external = (url, body, attributes = '') => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer"${attributes ? ` ${attributes}` : ''}>${body}</a>`;

// Approved navigation labels; the complete, locked titles remain in the native
// directory and link names. Never apply a label to a corrected/reused story ID.
const approvedLabels = {
  'nact-shojo-manga-infinity-2026': ['少女漫画的经典，如何进入美术馆叙事', ['少女漫画', '进美术馆'], 'Manga enters the museum', null],
  'undercover-valentin-workwear': ['UNDERCOVER为马斯特里赫特家具工坊设计工作服', ['工坊里的', '工作服'], 'Workwear for the workshop', 'UNDERCOVER'],
  'nike-outkast-georgia-2026': ['Outkast × Georgia：Nike把“96”放进亚特兰大赛场', ['Nike 的', '亚特兰大96'], 'Nike’s Atlanta ’96', null],
  'noa-clean-noise-album-2026': ['把杂音加回来：NOA的“整洁”仍然在场', ['NOA，', '把杂音加回来'], 'NOA brings the noise back', null],
  'asics-michigan-amsi-lab-2026': ['鞋还没定型，先把研发搬进校园：ASICS × 密歇根的 2028 目标', ['把鞋履研发', '搬进校园'], 'Footwear research on campus', 'ASICS'],
  'apple-designers-of-tomorrow-paris-2026': ['当一把椅子会发出声音：四组设计师怎样把注意力带回物件', ['当一把椅子', '发出声音'], 'When a chair makes a sound', 'Apple'],
  'wales-bonner-adidas-fw26-archive': ['档案不是一个年代标签：Wales Bonner 与 adidas 重看合作关系', ['重看', '合作档案'], 'Revisiting the collaboration archive', 'Wales Bonner'],
  'auralee-tekla-wintering-2026': ['从温泉到冬居：AURALEE与Tekla第二次合作写下季节变化', ['从温泉，', '到冬居'], 'From hot springs to wintering', 'AURALEE × Tekla'],
  'flaming-lips-teardrop-throbs-2026': ['《The Teardrop Throbs》先把听歌入口写出来', ['先写下', '听歌入口'], 'A listening entry point', 'The Flaming Lips'],
  'miu-miu-holiday-2026-campaign': ['两间房，一周之内：Miu Miu 的节日广告与 Diop 展览', ['两间房，', '一周之内'], 'Two rooms, one week', 'Miu Miu']
};

export function bookmarkLabel(story) {
  const label = approvedLabels[story.id];
  if (!label || story.title !== label[0]) return { zh: esc(story.title), en: esc(story.english?.title || story.title), meta: null };
  return { zh: label[1].map(part => `<span class="bookmark-semantic-part">${esc(part)}</span>`).join('<wbr>'), en: esc(label[2]), meta: label[3] };
}

function photo(url, { index = '', treatment = 'photograph', kind = 'bookmark', alt = 'Story artwork', altEn = alt } = {}) {
  const validUrl = typeof url === 'string' && /^https:\/\//.test(url);
  return `<span class="home-photo ${kind === 'signal' ? 'signal-photo' : 'bookmark-photo'}" data-home-photo data-visual-frame ${kind === 'bookmark' ? 'data-preview-navigation="edition-story"' : ''} data-image="${validUrl ? 'pending' : 'unavailable'}" data-treatment="${esc(treatment)}"><span class="home-photo-fallback photo-fallback"><b>${esc(index)}</b><small>${pair(validUrl ? '原图待载' : '查看来源', validUrl ? 'Image pending' : 'Source ↗')}</small></span>${validUrl ? `<img class="home-thumbnail" data-external-preview="true" src="${esc(url)}" ${attrs('alt', alt, altEn)} loading="lazy" decoding="async" referrerpolicy="no-referrer">` : ''}</span>`;
}

export function renderBookmarks(issue, experienceStories = []) {
  const stories = issue.stories || [];
  const bookmarks = stories.map(story => {
    const label = bookmarkLabel(story), names = category[story.category] || ['', ''];
    const art = experienceStories.find(item => item.id === story.id);
    const meta = label.meta ? esc(label.meta) : pair(...names);
    const title = `<span data-locale-variant="zh">${label.zh}</span><span data-locale-variant="en" lang="en">${label.en}</span>`;
    return `<article class="story story-card bookmark-item" id="card-${esc(issue.date)}-${esc(story.id)}" data-story-category="${esc(story.category)}" data-category="${esc(story.category)}"><a class="bookmark ct-story-entry story-open" href="${esc(issue.url + '#story-' + story.id)}" data-internal data-living-entry="story" data-story-id="${esc(story.id)}" ${attrs('aria-label', `${number(story.index + 1)} · ${story.title}`, `${number(story.index + 1)} · ${story.english?.title || story.title}`)} ${attrs('title', story.title, story.english?.title || story.title)}>${photo(story.media?.external_image_url, { index: number(story.index + 1), treatment: art?.treatment || 'photograph', alt: story.locale?.altZh || story.media?.alt || story.title, altEn: story.locale?.altEn || story.english?.title || story.media?.alt || story.title })}<span class="bookmark-copy"><span class="bookmark-meta"><b>${number(story.index + 1)}</b><wbr><small>${meta}</small></span><strong class="bookmark-title">${title}</strong></span></a></article>`;
  });
  const rows = [];
  for (let i = 0; i < bookmarks.length; i += 2) rows.push(`<div class="bookmark-row" data-story-group>${bookmarks.slice(i, i + 2).join('')}</div>`);
  const fullDirectory = stories.map(story => `<a data-home-directory-category="${esc(story.category)}" href="${esc(issue.url + '#story-' + story.id)}" data-internal data-living-entry="story" data-story-id="${esc(story.id)}"><span>${number(story.index + 1)}</span><span>${pair(story.title, story.english?.title || story.title)}</span><small>${pair(...(category[story.category] || ['', '']))}</small></a>`).join('');
  const categories = [['all', ['全部', 'All']], ...Object.entries(category)].map(([key, names], i) => `<button type="button" data-home-category="${key}" data-category-filter="${key}" data-ct-control="pill" aria-pressed="${i === 0}">${pair(...names)} <small>${key === 'all' ? stories.length : stories.filter(story => story.category === key).length}</small></button>`).join('');
  const domains = new Set(stories.map(story => story.category)).size;
  return `<section class="living-contents stories daily-stories home-bookmarks" id="stories" aria-labelledby="bookmark-heading"><header class="bookmark-heading"><h2 id="bookmark-heading">${pair('本期书签', 'Edition bookmarks')}</h2><span>${pair(`${stories.length} 篇 / ${domains} 个领域`, `${stories.length} stories / ${domains} fields`)}</span></header><div class="living-index-list bookmark-list">${rows.join('')}</div><p class="home-empty" id="filter-empty" hidden>${pair('本期没有这一类文章。', 'No stories in this category.')}</p><details class="home-full-directory ct-details"><summary>${pair('完整文字目录', 'Full story directory')}<span class="directory-chevron" aria-hidden="true">↗</span></summary><div class="browse-controls"><nav class="category-rail" aria-label="筛选索引分类" data-l10n-aria-label-zh="筛选索引分类" data-l10n-aria-label-en="Filter the index">${categories}</nav></div><p class="home-filter-status filter-status" role="status" aria-live="polite">${pair(`显示 ${stories.length} / ${stories.length} 篇`, `Showing ${stories.length} / ${stories.length} stories`)}</p><nav class="home-directory-links" aria-label="本期完整目录" data-l10n-aria-label-zh="本期完整目录" data-l10n-aria-label-en="Complete edition contents">${fullDirectory}</nav></details></section>`;
}

export function renderFurtherSignals(issue) {
  if (!issue.extras?.length) return '';
  const entries = issue.extras.map(item => {
    const locale = issue.extraLocale?.[item.id];
    // A missing English edition is disclosed as an original title, never a
    // silently fabricated translation. New verified locale data takes priority.
    const title = locale?.titleEn ? pair(item.title, locale.titleEn) : `<span data-original-language="true">${esc(item.title)}</span>`;
    const approvedConverse = item.id === 'converse-vaquera-vx1-heel-2026' && item.official_url === 'https://www.nike.com/launch/t/converse-vaquera-vx-1-heel-shoes';
    const fact = approvedConverse ? pair('厚实滑板鞋轮廓，与细猫跟结合。', 'A substantial skate-shoe silhouette, paired with a kitten heel.') : locale?.deckEn ? pair(item.deck, locale.deckEn) : esc(item.deck);
    const mediaUrl = item.media?.kind === 'image' && item.media.origin_authority === 'first_party_official' ? item.media.url : null;
    const event = /^\d{4}-\d{2}-\d{2}$/.test(item.event_date || '') ? `<span>${approvedConverse ? pair(`${item.event_date.slice(5).replace('-', '.')} 发售`, `Released ${item.event_date}`) : esc(item.event_date)}</span>` : '';
    return external(item.official_url, `${photo(mediaUrl, { kind: 'signal', alt: item.title, altEn: locale?.titleEn || item.title })}<span class="signal-copy"><strong>${title}</strong><span class="signal-fact">${fact}</span><span class="signal-meta"><span>${esc(item.publisher)} ↗</span>${event}</span></span>`, 'class="signal-entry"');
  }).join('');
  return `<section class="home-further-signals" id="extra-signals"><header class="home-section-title"><h2>${pair('额外线索', 'Further signals')}</h2><span>${pair(`本期之外 · ${issue.extras.length} 条`, `Beyond this edition · ${issue.extras.length}`)}</span></header><div class="home-signals-list">${entries}</div></section>`;
}

export function renderReadBack(issues) {
  if (!issues.length) return '';
  return `<section class="home-read-back"><header class="home-section-title"><h2>${pair('再往前读', 'Read back')}</h2><a data-internal href="/archive/">${pair('全部往期 ↗', 'Full archive ↗')}</a></header><div class="home-history-grid">${issues.map(issue => {
    const date = issue.date || issue.issue_id;
    const count = issue.stories?.length || issue.article_count;
    const cover = issue.cover || (issue.coverAsset ? `<img src="/assets/${esc(issue.coverAsset)}" alt="" loading="lazy" decoding="async" width="88" height="66">` : `<span aria-hidden="true">${esc(date)}</span>`);
    return `<a class="home-history-row" data-internal href="/issues/${esc(date)}/?from=home"><span class="home-history-cover" aria-hidden="true">${cover}</span><span class="home-history-copy"><time datetime="${esc(date)}" data-locale-date="${esc(date)}">${esc(date.replaceAll('-', '.'))}</time><strong>${issue.en ? pair(issue.title, issue.en) : esc(issue.title)}</strong><small>${count ? pair(`${count} 篇`, `${count} stories`) : pair('历史原版', 'Historical edition')}<span aria-hidden="true">↗</span></small></span></a>`;
  }).join('')}</div></section>`;
}

export function renderHomeQuote(pool, date, mode = 'daily') {
  const quote = selectDailyQuote(pool, date);
  return `<section class="daily-quote home-quiet-quote" id="quotation-of-the-day" data-daily-quote data-quote-id="${quote.id}" data-quote-mode="${mode}" data-quote-date="${date}" aria-labelledby="quote-title"><header class="quote-heading"><h2 id="quote-title">${pair('今日引言', 'Quotation of the day')}</h2><time datetime="${date}" data-locale-date="${date}">${date.replaceAll('-', '.')}</time></header><blockquote cite="${esc(quote.sourceUrl)}"><p class="quote-original" data-quote-original lang="en">${esc(quote.text)}</p><p class="quote-translation" data-quote-translation data-locale-variant="zh">${esc(quote.translation)}</p></blockquote><div class="quote-footer"><cite class="quote-author" data-quote-author>${pair(`${quote.author} · ${quote.authorZh}`, quote.author)}</cite>${external(quote.sourceUrl, pair('出处 ↗', 'Source ↗'), `class="quote-source" data-quote-source ${attrs('title', `${quote.sourceTitle} · ${quote.sourceYear} · ${quote.translationNote}`, `${quote.sourceTitle} · ${quote.sourceYear}`)} ${attrs('aria-label', `引言出处：${quote.sourceTitle}`, `Quotation source: ${quote.sourceTitle}`)}`)}</div></section>`;
}
