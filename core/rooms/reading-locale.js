(() => {
  'use strict';
  const root = document.documentElement;
  const dictionary = {
    selectedLanguage: ['已切换为中文。', 'English selected.'],
    hapticsUnavailable: ['当前设备不提供通用震动接口，视觉反馈保持完整。', 'This browser does not provide general vibration. Visual feedback remains available.'],
    showStories: ['显示 {count} / {total} 篇', 'Showing {count} / {total} stories'],
    byIssue: ['按期浏览', 'Issues'], allArticles: ['全部文章', 'Stories'],
    issueUnit: ['期', 'issues'], storyUnit: ['篇', 'stories'],
    pageStatus: ['第 {page} / {pages} 页', 'Page {page} / {pages}'],
    previousPage: ['上一页', 'Previous'], nextPage: ['下一页', 'Next'],
    retryImage: ['重试图片', 'Retry image'],
    imageSlow: ['图像较慢，可先阅读', 'The image is slow; continue reading'],
    imageFailed: ['图片暂未载入', 'Image unavailable'],
    fallbackFailed: ['原创回退图 · 非纪实', 'Original fallback · non-documentary'],
    unavailable: ['图片暂不可用，可继续阅读或打开官方来源', 'Image unavailable. Continue reading or open the official source.'],
    fallbackSlow: ['原创回退图 · 官方图像较慢', 'Original fallback · official image is slow'],
    officialSlow: ['官方图像较慢，可先阅读', 'Official image is slow; continue reading'],
    fallbackLoading: ['原创回退图 · 官方图像载入中…', 'Original fallback · loading official image…'],
    officialLoading: ['官方图像载入中…', 'Loading official image…'],
    artwork: ['作品图像', 'Artwork'], quoteSource: ['引言出处：{title}', 'Quotation source: {title}']
  };
  let locale = root.dataset.locale === 'en' ? 'en' : 'zh';
  function t(key, vars = {}) {
    const value = dictionary[key]?.[locale === 'en' ? 1 : 0];
    if (value === undefined) throw new Error(`Missing locale key: ${key}`);
    return value.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? `{${name}}`));
  }
  function date(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return iso || '';
    return locale === 'en'
      ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`))
      : iso.replaceAll('-', '.');
  }
  function apply(scope = document) {
    scope.querySelectorAll('[data-l10n-zh]').forEach(node => { node.textContent = node.getAttribute(`data-l10n-${locale}`) || ''; });
    scope.querySelectorAll('[data-l10n]').forEach(node => { node.textContent = t(node.dataset.l10n); });
    for (const name of ['alt', 'aria-label', 'title', 'placeholder', 'data-caption', 'data-credit']) {
      scope.querySelectorAll(`[data-l10n-${name}-zh]`).forEach(node => {
        const value = node.getAttribute(`data-l10n-${name}-${locale}`);
        if (value !== null) node.setAttribute(name, value);
      });
    }
    scope.querySelectorAll('[data-locale-date]').forEach(node => { node.textContent = date(node.dataset.localeDate); });
    const title = root.dataset[locale === 'en' ? 'titleEn' : 'titleZh'];
    if (title) document.title = title;
  }
  function update(next) {
    const changed = locale !== next;
    locale = next === 'en' ? 'en' : 'zh';
    root.dataset.locale = locale; root.dataset.language = locale;
    root.lang = locale === 'en' ? 'en' : 'zh-CN';
    apply();
    if (changed) document.dispatchEvent(new CustomEvent('ct:locale-change', { detail: { locale } }));
  }
  window.CTLocale = Object.freeze({ get locale() { return locale; }, t, date, apply });
  window.CTUI?.subscribe(preferences => update(preferences.language));
  if (!window.CTUI) apply();
  document.addEventListener('ct:content-updated', event => apply(event.detail?.root || document));
})();
