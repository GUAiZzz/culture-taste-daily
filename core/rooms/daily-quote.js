(() => {
  'use strict';
  const config=window.CT_DAILY_QUOTES,quotes=config?.quotes;
  if(!Array.isArray(quotes)||!quotes.length)return;
  const timezone='Asia/Shanghai',dayMs=86400000,baseDay=Date.UTC(2026,9,28)/dayMs;
  const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'});
  function dateKey(now=new Date()){
    const parts=Object.fromEntries(formatter.formatToParts(now).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }
  function quoteForDate(key){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(key))throw new RangeError('Expected YYYY-MM-DD');
    const [year,month,day]=key.split('-').map(Number),stamp=Date.UTC(year,month-1,day);
    if(new Date(stamp).toISOString().slice(0,10)!==key)throw new RangeError('Invalid date');
    return quotes[((stamp/dayMs-baseDay)%quotes.length+quotes.length)%quotes.length];
  }
  function renderPanel(panel, quote, key) {
    const english=document.documentElement.dataset.locale==='en';
    panel.dataset.quoteId=quote.id;panel.dataset.quoteDate=key;
    const text=panel.querySelector('[data-quote-original]'),translation=panel.querySelector('[data-quote-translation]'),author=panel.querySelector('[data-quote-author]'),time=panel.querySelector('time'),source=panel.querySelector('[data-quote-source]');
    if(text)text.textContent=quote.text;if(translation)translation.textContent=quote.translation;
    if(author)author.textContent=english?quote.author:quote.authorZh?`${quote.author} · ${quote.authorZh}`:quote.author;
    if(time){time.dateTime=key;time.dataset.localeDate=key;time.textContent=window.CTLocale?.date(key)||key.replaceAll('-','.');}
    if(source){source.href=quote.sourceUrl;const titleZh=`${quote.sourceTitle} · ${quote.sourceYear} · ${quote.translationNote}`,titleEn=`${quote.sourceTitle} · ${quote.sourceYear}`;
      source.setAttribute('data-l10n-title-zh',titleZh);source.setAttribute('data-l10n-title-en',titleEn);source.title=english?titleEn:titleZh;
      const labelZh=`引言出处：${quote.sourceTitle}`,labelEn=`Quotation source: ${quote.sourceTitle}`;source.setAttribute('data-l10n-aria-label-zh',labelZh);source.setAttribute('data-l10n-aria-label-en',labelEn);source.setAttribute('aria-label',english?labelEn:labelZh);}
    const block=panel.querySelector('blockquote');if(block)block.cite=quote.sourceUrl;
  }
  function render(key=dateKey()){
    const quote=quoteForDate(key);
    document.querySelectorAll('[data-daily-quote][data-quote-mode="daily"]').forEach(panel=>renderPanel(panel,quote,key));return quote.id;
  }
  let timer=0;
  function refresh(){render();clearTimeout(timer);const [year,month,day]=dateKey().split('-').map(Number);
    const next=Date.UTC(year,month-1,day+1)-8*3600000;timer=setTimeout(refresh,Math.max(1000,Math.min(2147483647,next-Date.now()+100)));}
  window.CTDailyQuote=Object.freeze({timezone,dateKey,quoteForDate});refresh();
  document.addEventListener('ct:locale-change',()=>{document.querySelectorAll('[data-daily-quote]').forEach(panel=>{const key=panel.dataset.quoteMode==='daily'?dateKey():panel.dataset.quoteDate;renderPanel(panel,quoteForDate(key),key);});});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});window.addEventListener('pageshow',refresh);window.addEventListener('pagehide',()=>clearTimeout(timer));
})();
