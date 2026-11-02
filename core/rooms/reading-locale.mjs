// One locale contract for the synchronous head and the progressively enhanced UI.
export const preferenceKey = 'culture-taste-reading-preferences';
export function preferredLocale(readStorage) {
  for (const name of ['localStorage', 'sessionStorage']) {
    try {
      const raw = readStorage(name);
      if (!raw) continue;
      const value = JSON.parse(raw);
      return value && typeof value === 'object' && value.language === 'en' ? 'en' : 'zh';
    } catch {}
  }
  return 'zh';
}
export const localeHeadScript = `(()=>{const key=${JSON.stringify(preferenceKey)};const choose=${preferredLocale.toString()};const locale=choose(name=>window[name].getItem(key));const root=document.documentElement;root.lang=locale==='en'?'en':'zh-CN';root.dataset.locale=locale;root.dataset.language=locale;const title=root.dataset[locale==='en'?'titleEn':'titleZh'];if(title)document.title=title;})();`;
// These rules are inline before any body markup. Without the bootstrap no content
// is hidden, so blocked JavaScript retains the static bilingual publication.
export const localeCriticalCSS = `html[data-locale="zh"] [data-locale-variant="en"],html[data-locale="en"] [data-locale-variant="zh"],html[data-locale="zh"] [data-reading-language="en"],html[data-locale="en"] [data-reading-language="zh"],html[data-locale="zh"] .title-en,html[data-locale="en"] .title-zh{display:none!important}html[data-locale] .english-reading>summary{display:none}`;
