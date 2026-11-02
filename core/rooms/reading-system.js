(() => {
  'use strict';
  const ui=window.CTUI,root=document.documentElement;
  if(!ui||!document.querySelector('[data-reading-system="soft-v1"]'))return;
  const t=(key,vars)=>window.CTLocale?.t(key,vars)||key;
  const categories=new Set(['all','fashion','music','objects','city']);
  const query=new URLSearchParams(location.search);
  const settings=document.querySelector('#reading-settings');
  const trigger=document.querySelector('[data-open-settings]');
  const status=document.querySelector('#reader-status,[data-reading-status]');
  const readingBodies=[...document.querySelectorAll('[data-reading-body]')];
  const body=document.querySelector('[data-reading-body],#article-body');
  const zh=body?.querySelector('[data-reading-language="zh"],#chinese-reading,.zh-reading');
  const en=body?.querySelector('[data-reading-language="en"],#english-reading,.en-reading');
  const isReader=document.body.classList.contains('page-article')&&Boolean(body&&zh&&en);
  const hasReadingBodies=readingBodies.length>0;
  const toolbar=document.querySelector('#toolbar');
  const articleEnd=document.querySelector('.article-end')||readingBodies.at(-1)||body;
  let currentCategory='all',catalogState=null,renderCatalog=null;
  let readingAnchor=null,settingsAnchor=null,pendingAnchor=null,anchorFrame=0;
  let frame=0,measureNeeded=true,returnThreshold=Infinity,returnVisible=null;
  let controlsStuck=null,headerScrolled=null;
  const returnLink=document.querySelector('.floating-return');
  const browseControls=document.querySelector('.browse-controls,.category-jumps');
  let sentinel=null;

  const paragraphsIn=container=>{
    const chinese=container.querySelector('[data-reading-language="zh"]');
    const english=container.querySelector('[data-reading-language="en"]');
    const active=chinese?.hidden?english?.querySelector('.english-content')||english:chinese;
    return [...active?.children||[]].filter(node=>node.tagName==='P');
  };
  const activeParagraphs=()=>readingBodies.flatMap(paragraphsIn);
  function captureReadingAnchor(){
    if(!hasReadingBodies)return null;
    const marker=Math.max(96,(toolbar?.getBoundingClientRect().bottom||76)+20);
    if(window.scrollY<30||body.getBoundingClientRect().top>marker)return {kind:'top',y:window.scrollY};
    const paragraphs=activeParagraphs(),index=paragraphs.findIndex(p=>p.getBoundingClientRect().bottom>marker);
    if(index<0)return {kind:'end',offset:articleEnd.getBoundingClientRect().top};
    const rect=paragraphs[index].getBoundingClientRect();
    const container=paragraphs[index].closest('[data-reading-body]');
    return {kind:'paragraph',index,story:container?.dataset.sourceBody,localIndex:container?paragraphsIn(container).indexOf(paragraphs[index]):index,ratio:Math.max(0,Math.min(1,(marker-rect.top)/Math.max(1,rect.height))),marker};
  }
  function restoreReadingAnchor(anchor){
    if(!anchor||!hasReadingBodies)return;
    cancelAnimationFrame(anchorFrame);
    anchorFrame=requestAnimationFrame(()=>{
      if(settings?.open){pendingAnchor=anchor;return;}
      if(anchor.kind==='top')window.scrollTo({top:anchor.y,behavior:'instant'});
      else if(anchor.kind==='end')window.scrollBy({top:articleEnd.getBoundingClientRect().top-anchor.offset,behavior:'instant'});
      else{
        const container=readingBodies.find(item=>item.dataset.sourceBody===anchor.story);
        const ps=container?paragraphsIn(container):activeParagraphs(),index=container?anchor.localIndex:anchor.index;
        const paragraph=ps[Math.min(index,ps.length-1)];
        if(paragraph){const box=paragraph.getBoundingClientRect();window.scrollTo({top:window.scrollY+box.top+box.height*anchor.ratio-anchor.marker,behavior:'instant'});}
      }
      scheduleFrame();
    });
  }
  function setLanguage(language){
    const english=language==='en';
    readingBodies.forEach(container=>{
    const chinese=container.querySelector('[data-reading-language="zh"]'),translation=container.querySelector('[data-reading-language="en"]');
    if(!chinese||!translation)return;
    const target=english?translation.querySelector('.english-content')||translation:chinese;
    container.querySelectorAll('[data-inline-visual]').forEach(figure=>{
      const paragraphs=[...target.children].filter(node=>node.tagName==='P');
      const requested=Number(figure.dataset[english?'afterEn':'afterZh'])||1;
      const paragraph=paragraphs[Math.max(0,Math.min(paragraphs.length-1,requested-1))];
      if(paragraph)paragraph.insertAdjacentElement('afterend',figure);
    });
    chinese.hidden=english;translation.hidden=!english;translation.open=english;translation.classList.toggle('active-language',english);
    const scope=container.closest('.issue-story,.article-main')||document;
    const titleZh=scope.querySelector('.title-zh'),titleEn=scope.querySelector('.title-en');
    if(titleZh)titleZh.hidden=english;if(titleEn)titleEn.hidden=!english;
    });
    root.dataset.language=language;root.dataset.locale=language;root.lang=english?'en':'zh-CN';
    window.CTLocale?.apply();
    if(status)status.textContent=t('selectedLanguage');
    if(renderCatalog)renderCatalog({write:false});
  }
  const languageButtons=[...document.querySelectorAll('button[data-language]')];
  const font=document.querySelector('input[data-reader-font],input[data-font-size],#font-size');
  const fontValue=document.querySelector('output[data-reader-font-value],output[data-font-value],#font-value');
  const haptics=document.querySelector('input[data-haptics],#haptics-toggle');
  const settingsStatus=settings?.querySelector('[role="status"]');
  document.addEventListener('ct:preferences-will-change',event=>{
    if(event.detail.previous.fontSize!==event.detail.next.fontSize||event.detail.previous.language!==event.detail.next.language||event.detail.previous.style!==event.detail.next.style){readingAnchor=settings?.open?settingsAnchor:captureReadingAnchor();}
  });
  trigger?.addEventListener('click',()=>{settingsAnchor=captureReadingAnchor();pendingAnchor=null;},true);
  ui.renderSettingsIcon(trigger);
  if(settings&&trigger){
    ui.bindDialog(settings,{opener:trigger,initialFocus:'[data-pref-theme][aria-pressed="true"]'});
    settings.addEventListener('close',()=>{const anchor=pendingAnchor;pendingAnchor=null;settingsAnchor=null;if(anchor)restoreReadingAnchor(anchor);});
  }
  languageButtons.forEach(button=>button.addEventListener('click',()=>{ui.setPreferences({language:button.dataset.language});ui.feedback();}));
  document.querySelectorAll('[data-pref-theme]').forEach(button=>button.addEventListener('click',()=>{ui.setPreferences({theme:button.dataset.prefTheme});ui.feedback();}));
  document.querySelectorAll('[data-pref-style]').forEach(button=>button.addEventListener('click',()=>{ui.setPreferences({style:button.dataset.prefStyle});ui.feedback();}));
  document.querySelectorAll('[data-pref-surface]').forEach(button=>button.addEventListener('click',()=>{ui.setPreferences({surface:button.dataset.prefSurface});ui.feedback();}));
  font?.addEventListener('input',()=>ui.setPreferences({fontSize:Number(font.value)}));
  font?.addEventListener('change',ui.feedback);
  haptics?.addEventListener('change',()=>{ui.setPreferences({haptics:haptics.checked});ui.feedback();
    if(settingsStatus){const unavailable=haptics.checked&&typeof navigator.vibrate!=='function';settingsStatus.dataset.hapticUnavailable=String(unavailable);settingsStatus.textContent=unavailable?t('hapticsUnavailable'):'';}});
  document.addEventListener('ct:locale-change',()=>{if(settingsStatus?.dataset.hapticUnavailable==='true')settingsStatus.textContent=t('hapticsUnavailable');});
  let previousLanguage=null;
  ui.subscribe(preferences=>{
    languageButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.language===preferences.language)));
    document.querySelectorAll('[data-pref-theme]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.prefTheme===preferences.theme)));
    document.querySelectorAll('[data-pref-style]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.prefStyle===preferences.style)));
    document.querySelectorAll('[data-pref-surface]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.prefSurface===preferences.surface)));
    if(font){font.value=String(preferences.fontSize);font.setAttribute('aria-valuetext',`${preferences.fontSize}px`);}
    if(fontValue){fontValue.value=`${preferences.fontSize}px`;fontValue.style.fontSize=`${preferences.fontSize}px`;}
    if(haptics)haptics.checked=preferences.haptics;
    if(previousLanguage!==preferences.language)setLanguage(preferences.language);
    previousLanguage=preferences.language;
    if(readingAnchor){if(settings?.open)pendingAnchor=readingAnchor;else restoreReadingAnchor(readingAnchor);readingAnchor=null;}
    scheduleFrame(true);
  });

  const homeButtons=[...document.querySelectorAll('[data-home-category]')];
  const homeCards=[...document.querySelectorAll('.category-board .story-card,.category-board .story,.living-index-list .story-card')];
  const homeDirectoryLinks=[...document.querySelectorAll('[data-home-directory-category]')];
  const groupNodes=[...document.querySelectorAll('[data-group],[data-story-group]')];
  function updateHomeLinks(){
    [...homeCards.flatMap(card=>[...card.querySelectorAll('a.ct-story-entry,a.story-open')]),...homeDirectoryLinks].forEach(link=>{
      const url=new URL(link.href,location.href);url.searchParams.delete('category');
      if(currentCategory!=='all')url.searchParams.set('category',currentCategory);
      link.href=url.href;
    });
  }
  function filterHome(category,{write=true}={}){
    currentCategory=categories.has(category)?category:'all';root.dataset.category=currentCategory;
    homeCards.forEach(card=>card.hidden=currentCategory!=='all'&&(card.dataset.storyCategory||card.dataset.category)!==currentCategory);
    homeDirectoryLinks.forEach(link=>link.hidden=currentCategory!=='all'&&link.dataset.homeDirectoryCategory!==currentCategory);
    homeButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.homeCategory===currentCategory)));
    groupNodes.forEach(group=>group.hidden=![...group.querySelectorAll('.story-card,.story')].some(card=>!card.hidden));
    const count=homeCards.filter(card=>!card.hidden).length;
    const output=document.querySelector('.home-filter-status,#filter-status');if(output)output.textContent=t('showStories',{count,total:homeCards.length});
    const empty=document.querySelector('.home-empty,#filter-empty');if(empty)empty.hidden=count>0;
    if(write){const url=new URL(location.href);url.searchParams.delete('category');
      if(currentCategory==='all')url.searchParams.delete('home-category');else url.searchParams.set('home-category',currentCategory);
      url.searchParams.delete('restore');url.searchParams.delete('ctx');try{history.replaceState(null,'',url);}catch{}}
    updateHomeLinks();scheduleFrame(true);
  }
  const categoryFromUrl=()=>{const q=new URLSearchParams(location.search),key=q.get('home-category')||q.get('category');return categories.has(key)?key:'all';};
  if(homeButtons.length){
    filterHome(categoryFromUrl(),{write:false});
    homeButtons.forEach(button=>button.addEventListener('click',()=>{filterHome(button.dataset.homeCategory);button.scrollIntoView({block:'nearest',inline:'nearest',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});ui.feedback();}));
    window.addEventListener('popstate',()=>filterHome(categoryFromUrl(),{write:false}));
  }

  // Measure against the unreserved rail width to avoid a cue creating its own overflow.
  const categoryRail=browseControls?.querySelector('.category-rail');
  if(categoryRail&&homeButtons.length){
    let railFrame=0;
    // Match the other segmented preference controls: keyboard navigation
    // moves focus and applies the selected category in a single action.
    categoryRail.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      const button=event.target.closest('[data-home-category]');
      const index=homeButtons.indexOf(button);
      if(index<0)return;
      event.preventDefault();
      const next=event.key==='Home'?0:event.key==='End'?homeButtons.length-1:
        (index+(event.key==='ArrowRight'?1:-1)+homeButtons.length)%homeButtons.length;
      homeButtons[next].focus({preventScroll:true});
      homeButtons[next].click();
    });
    const measureRail=()=>{
      railFrame=0;
      const reserve=browseControls.dataset.railOverflow==='true'?20:0;
      const overflow=categoryRail.scrollWidth>categoryRail.clientWidth+reserve+1;
      browseControls.dataset.railOverflow=String(overflow);
      browseControls.dataset.railMore=String(overflow&&categoryRail.scrollLeft+categoryRail.clientWidth<categoryRail.scrollWidth-1);
    };
    const scheduleRail=()=>{if(!railFrame)railFrame=requestAnimationFrame(measureRail);};
    categoryRail.addEventListener('focusin',event=>{
      const button=event.target.closest('[data-home-category]');
      if(!button||!categoryRail.contains(button))return;
      const rail=categoryRail.getBoundingClientRect(),item=button.getBoundingClientRect(),inset=8;
      if(item.left<rail.left+inset)categoryRail.scrollLeft-=rail.left+inset-item.left;
      else if(item.right>rail.right-inset)categoryRail.scrollLeft+=item.right-(rail.right-inset);
    });
    categoryRail.addEventListener('scroll',scheduleRail,{passive:true});
    window.addEventListener('resize',scheduleRail,{passive:true});
    window.addEventListener('pageshow',scheduleRail);
    if('ResizeObserver'in window){const railObserver=new ResizeObserver(scheduleRail);railObserver.observe(categoryRail);}
    scheduleRail();
  }

  const catalog=document.querySelector('#catalog');
  if(catalog){
    const search=document.querySelector('#catalog-search'),month=document.querySelector('#catalog-month');
    const empty=catalog.querySelector('.empty-state'),pagination=catalog.querySelector('.pagination');
    const containers={issues:catalog.querySelector('[data-catalog="issues"]'),articles:catalog.querySelector('[data-catalog="articles"]')};
    const items=()=>[...catalog.querySelectorAll('[data-catalog-item]')];
    const fromUrl=()=>{const q=new URLSearchParams(location.search);catalogState={view:q.get('view')==='articles'?'articles':'issues',q:q.get('q')||'',month:/^\d{4}-\d{2}$/.test(q.get('month')||'')?q.get('month'):'all',category:categories.has(q.get('category'))?q.get('category'):'all',page:Math.max(1,parseInt(q.get('page')||'1',10)||1)};};
    const updateUrl=()=>{const url=new URL(location.href);url.searchParams.delete('restore');url.searchParams.delete('ctx');
      for(const [key,value]of Object.entries(catalogState)){if((key==='view'&&value==='issues')||(key==='q'&&!value)||((key==='category'||key==='month')&&value==='all')||(key==='page'&&value===1))url.searchParams.delete(key);else url.searchParams.set(key,value);}
      try{history.replaceState(null,'',url);}catch{}};
    renderCatalog=({write=true,scroll=false}={})=>{
      const state=catalogState;currentCategory=state.category;
      if(search)search.value=state.q;if(month)month.value=state.month;
      for(const [key,container]of Object.entries(containers))if(container)container.hidden=key!==state.view;
      catalog.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===state.view)));
      catalog.querySelectorAll('[data-category-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.categoryFilter===state.category)));
      const needle=state.q.trim().toLocaleLowerCase();
      const eligible=items().filter(item=>item.dataset.kind===state.view&&(state.month==='all'||item.dataset.date?.startsWith(state.month))&&(state.category==='all'||(state.view==='issues'?(item.dataset.categories||'').split(' ').includes(state.category):item.dataset.category===state.category))&&(!needle||(item.dataset.search||item.textContent).toLocaleLowerCase().includes(needle))).sort((a,b)=>(b.dataset.date||'').localeCompare(a.dataset.date||''));
      const size=state.view==='issues'?12:24,pages=Math.max(1,Math.ceil(eligible.length/size));state.page=Math.min(state.page,pages);
      const visible=new Set(eligible.slice((state.page-1)*size,state.page*size));items().forEach(item=>item.hidden=!visible.has(item));
      if(empty)empty.hidden=eligible.length>0;
      const output=catalog.querySelector('.catalog-status');if(output)output.textContent=`${t(state.view==='issues'?'byIssue':'allArticles')} / ${eligible.length} ${t(state.view==='issues'?'issueUnit':'storyUnit')}${eligible.length?' · '+t('pageStatus',{page:state.page,pages}):''}`;
      const heading=catalog.querySelector('.week-heading');if(heading)heading.hidden=state.view!=='issues';
      if(pagination){pagination.replaceChildren();if(pages>1)for(let n=0;n<pages+2;n++){
        const target=n===0?state.page-1:n===pages+1?state.page+1:n,button=document.createElement('button');
        button.type='button';button.dataset.ctControl='pill';button.textContent=n===0?t('previousPage'):n===pages+1?t('nextPage'):String(n);
        button.disabled=target<1||target>pages;if(n===state.page)button.setAttribute('aria-current','page');
        button.addEventListener('click',()=>{state.page=target;renderCatalog({scroll:true});pagination.querySelector('[aria-current="page"]')?.focus({preventScroll:true});ui.feedback();});pagination.append(button);
      }}
      if(write)updateUrl();if(scroll)catalog.scrollIntoView({block:'start',behavior:'instant'});scheduleFrame(true);
    };
    fromUrl();renderCatalog({write:false});
    catalog.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{catalogState.view=button.dataset.view;catalogState.page=1;renderCatalog();ui.feedback();}));
    catalog.querySelectorAll('[data-category-filter]').forEach(button=>button.addEventListener('click',()=>{catalogState.category=button.dataset.categoryFilter;catalogState.page=1;renderCatalog();ui.feedback();}));
    month?.addEventListener('change',()=>{catalogState.month=month.value;catalogState.page=1;renderCatalog();});
    search?.addEventListener('input',()=>{catalogState.q=search.value;catalogState.page=1;renderCatalog();});
    catalog.querySelector('[data-clear-search]')?.addEventListener('click',()=>{Object.assign(catalogState,{q:'',month:'all',category:'all',page:1});renderCatalog();search?.focus({preventScroll:true});ui.feedback();});
    window.addEventListener('popstate',()=>{fromUrl();renderCatalog({write:false});});
  }

  // Routing and two-level restoration belong exclusively to living-navigation.js.
  if(returnLink&&browseControls){sentinel=document.createElement('span');sentinel.className='browse-sentinel';sentinel.setAttribute('aria-hidden','true');browseControls.before(sentinel);returnLink.setAttribute('aria-hidden','true');returnLink.tabIndex=-1;}
  function flushFrame(){
    frame=0;
    if(measureNeeded){if(sentinel){
      // The compact sticky bar replaces its removed padding with bottom margin
      // so the document retains its original footprint. Include that margin
      // in the return shortcut threshold, which tracks the full original block.
      const bottomMargin=parseFloat(getComputedStyle(browseControls).marginBottom)||0;
      returnThreshold=sentinel.getBoundingClientRect().top+window.scrollY+browseControls.offsetHeight+bottomMargin;
    }
      const header=document.querySelector('.site-header'),headerHeight=header?.offsetHeight||82;
      root.style.setProperty('--reading-header-height',`${headerHeight}px`);
      measureNeeded=false;}
    const currentHeader=document.querySelector('.site-header');
    if(currentHeader)root.style.setProperty('--reading-anchor-offset',`${Math.max(0,currentHeader.getBoundingClientRect().bottom)+16}px`);
    // Keep the publication material continuous until the controls actually
    // stick; only then add a protective surface over moving content.
    if(sentinel&&browseControls){
      const top=parseFloat(getComputedStyle(browseControls).top)||0;
      const stuck=sentinel.getBoundingClientRect().top<=top;
      if(stuck!==controlsStuck){controlsStuck=stuck;browseControls.dataset.stuck=String(stuck);}
    }
    const masthead=document.querySelector('.page-home .masthead,.page-issue .masthead');
    if(masthead){const scrolled=window.scrollY>1;if(scrolled!==headerScrolled){headerScrolled=scrolled;masthead.dataset.scrolled=String(scrolled);}}
    if(returnLink){const visible=window.scrollY>returnThreshold;if(visible!==returnVisible){returnVisible=visible;returnLink.dataset.returnVisible=String(visible);returnLink.setAttribute('aria-hidden',String(!visible));returnLink.tabIndex=visible?0:-1;
      if(!visible&&document.activeElement===returnLink)homeButtons.find(button=>button.getAttribute('aria-pressed')==='true')?.focus({preventScroll:true});}}
    if(isReader){const fill=document.querySelector('#progress-fill,[data-reader-progress]');if(fill){const start=body.getBoundingClientRect().top+window.scrollY-100,end=articleEnd.getBoundingClientRect().top+window.scrollY-window.innerHeight+80;fill.style.transform=`scaleX(${Math.max(0,Math.min(1,(window.scrollY-start)/Math.max(1,end-start)))})`;}}
  }
  function scheduleFrame(measure=false){if(measure===true)measureNeeded=true;if(!frame)frame=requestAnimationFrame(flushFrame);}
  window.addEventListener('scroll',()=>scheduleFrame(),{passive:true});window.addEventListener('resize',()=>scheduleFrame(true),{passive:true});window.addEventListener('pageshow',()=>scheduleFrame(true));
  window.addEventListener('pagehide',()=>{if(frame)cancelAnimationFrame(frame);frame=0;cancelAnimationFrame(anchorFrame);});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleFrame(true);});
  if('ResizeObserver'in window){const observer=new ResizeObserver(()=>scheduleFrame(true));if(browseControls)observer.observe(browseControls);const header=document.querySelector('.site-header');if(header)observer.observe(header);}

  document.querySelectorAll('img.official,img.official-image,img[data-official]').forEach(img=>{
    const holder=img.closest('.story-image,.visual-open,.image-frame')||img.parentElement;
    const target=img.closest('[data-photo]')||holder;
    const stateHolders=new Set([holder,target,img.closest('.story-card'),img.closest('.image-frame')].filter(Boolean));
    const caption=target.querySelector('.source-state');
    const message=holder.querySelector('.media-message,.image-loading'),unavailable=holder.querySelector('.image-unavailable');
    const hasFallback=Boolean(holder.querySelector('img.fallback,img.fallback-image'));
    if(unavailable){unavailable.setAttribute('role','status');unavailable.setAttribute('aria-live','polite');}
    const retryParent=holder.closest('.visual-item')?.querySelector('.visual-caption')||target.querySelector('figcaption')||target;
    let retry=retryParent.querySelector('[data-retry-photo]');
    if(!retry){retry=document.createElement('button');retry.type='button';retry.dataset.retryPhoto='';retry.dataset.ctControl='subtle';retry.textContent=t('retryImage');retry.hidden=true;retryParent.append(retry);}
    const originalCaption=()=>caption?.dataset[window.CTLocale?.locale==='en'?'captionEn':'captionZh']||caption?.dataset.originalNote||caption?.textContent||'';
    let currentImageState='loading';
    let timer=0,observer=null;
    const state=value=>{currentImageState=value;stateHolders.forEach(node=>{node.dataset.image=value;node.classList.toggle('loaded',value==='loaded');node.classList.toggle('failed',value==='failed');});retry.hidden=!['failed','slow'].includes(value);
      if(caption)caption.textContent=value==='loaded'?originalCaption():value==='slow'?t('imageSlow'):value==='failed'?t('imageFailed'):originalCaption();
      if(message){message.removeAttribute('data-l10n');message.textContent=t(value==='failed'?(hasFallback?'fallbackFailed':'unavailable'):value==='slow'?(hasFallback?'fallbackSlow':'officialSlow'):(hasFallback?'fallbackLoading':'officialLoading'));}
      if(unavailable)unavailable.textContent=t('unavailable');retry.textContent=t('retryImage');};
    document.addEventListener('ct:locale-change',()=>state(currentImageState));
    const settle=()=>{clearTimeout(timer);observer?.disconnect();if(img.naturalWidth&&img.naturalHeight){img.width=img.naturalWidth;img.height=img.naturalHeight;if(holder.matches('.story-image[data-known-image-ratio]')){holder.style.setProperty('--reader-image-ratio',String(img.naturalWidth/img.naturalHeight));}state('loaded');}else state('failed');scheduleFrame(true);};
    const start=()=>{clearTimeout(timer);timer=setTimeout(()=>{if(!img.naturalWidth)state('slow');},6500);};
    img.addEventListener('load',settle);img.addEventListener('error',settle);
    retry.addEventListener('click',()=>{state('loading');start();const src=img.getAttribute('src');img.loading='eager';img.removeAttribute('src');img.setAttribute('src',src);ui.feedback();});
    state('loading');if(img.complete)settle();else if('IntersectionObserver'in window){observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){img.loading='eager';start();observer.disconnect();}},{rootMargin:'150px'});observer.observe(holder);}else start();
  });

  const imageDialog=document.querySelector('#image-dialog');
  if(imageDialog){
    const controller=ui.bindDialog(imageDialog,{initialFocus:'[data-ct-close]'}),dialogImg=imageDialog.querySelector('img');
    const area=imageDialog.querySelector('.dialog-image-area'),caption=imageDialog.querySelector('.dialog-caption-text'),credit=imageDialog.querySelector('.dialog-credit'),source=imageDialog.querySelector('.dialog-source');
    const links=[...document.querySelectorAll('[data-zoom-image]')];let selected=0;
    const navigation=imageDialog.querySelector('.dialog-navigation'),count=imageDialog.querySelector('[data-image-count]');
    if(navigation)navigation.hidden=links.length<2;
    const size=()=>{if(!dialogImg?.naturalWidth||!dialogImg?.naturalHeight)return;const maxWidth=Math.max(200,Math.min(1120,innerWidth-28)),maxHeight=Math.max(180,innerHeight*.68),scale=Math.min(1,maxWidth/dialogImg.naturalWidth,maxHeight/dialogImg.naturalHeight);imageDialog.style.width=`${Math.round(Math.min(maxWidth,Math.max(Math.min(320,maxWidth),dialogImg.naturalWidth*scale)))}px`;};
    const open=(link,index)=>{if(!dialogImg)return;selected=index;area?.classList.remove('failed');dialogImg.src=link.href;dialogImg.alt=link.querySelector('img')?.alt||link.dataset.caption||t('artwork');if(caption)caption.textContent=link.dataset.caption||'';if(credit)credit.textContent=link.dataset.credit||'';if(source)source.href=link.dataset.origin||link.href;if(count)count.textContent=`${index+1} / ${links.length}`;controller.open(link);if(dialogImg.complete&&dialogImg.naturalWidth)size();};
    links.forEach((link,index)=>link.addEventListener('click',event=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;event.preventDefault();open(link,index);}));
    document.addEventListener('ct:locale-change',()=>{if(!imageDialog.open)return;const link=links[selected];if(!link)return;if(dialogImg)dialogImg.alt=link.querySelector('img')?.alt||t('artwork');if(caption)caption.textContent=link.dataset.caption||'';if(credit)credit.textContent=link.dataset.credit||'';});
    const move=step=>{const next=(selected+step+links.length)%links.length;open(links[next],next);};
    imageDialog.querySelector('[data-image-previous]')?.addEventListener('click',()=>move(-1));
    imageDialog.querySelector('[data-image-next]')?.addEventListener('click',()=>move(1));
    dialogImg?.addEventListener('load',()=>{area?.classList.remove('failed');size();});dialogImg?.addEventListener('error',()=>{area?.classList.add('failed');imageDialog.style.width='min(400px,calc(100vw - 28px))';});
    imageDialog.addEventListener('keydown',event=>{if(links.length<2||!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();move(event.key==='ArrowRight'?1:-1);});
    window.addEventListener('resize',()=>{if(imageDialog.open)size();},{passive:true});
  }
  document.querySelectorAll('.ct-details').forEach(details=>{const summary=details.querySelector(':scope>summary');if(summary){summary.addEventListener('click',event=>{if(event.isTrusted&&event.button===0)ui.feedback('disclosure.toggle');queueMicrotask(()=>summary.setAttribute('aria-expanded',String(details.open)));});summary.setAttribute('aria-expanded',String(details.open));details.addEventListener('toggle',()=>{summary.setAttribute('aria-expanded',String(details.open));scheduleFrame(true);});}});
  document.querySelectorAll('[data-open-contents]').forEach(link=>link.addEventListener('click',event=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const url=new URL(link.href,location.href);if(url.pathname!==location.pathname)return;const toc=document.getElementById('issue-contents');const disclosure=toc?.querySelector('details');if(disclosure){disclosure.open=true;const current=link.closest('.issue-story')?.id;toc.querySelectorAll('a[href^="#story-"]').forEach(item=>{if(item.getAttribute('href')==='#'+current)item.setAttribute('aria-current','location');else item.removeAttribute('aria-current');});}}));
  document.querySelectorAll('a[target="_blank"]').forEach(link=>link.addEventListener('click',event=>{if(event.isTrusted&&!event.defaultPrevented&&event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey)ui.feedback('source.open');}));
  const hashTarget=location.hash&&document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if(hashTarget){if(hashTarget.id==='issue-contents')hashTarget.querySelector('details')?.setAttribute('open','');if(hashTarget.matches('details'))hashTarget.open=true;hashTarget.closest('details')?.setAttribute('open','');}

  // The original signal room used a 225ms edge rustle, never perpetual snow.
  const television=document.querySelector('.issue-intro,.archive-title,.article-main');
  const reducedMotion=matchMedia('(prefers-reduced-motion:reduce)');
  let noiseTimer=0,noiseEnd=0,noiseFrames=0,tvVisible=false,lastRustle=0;
  const snow=television?document.createElement('canvas'):null,noise=snow?.getContext('2d');
  const stopNoise=()=>{clearInterval(noiseTimer);clearTimeout(noiseEnd);noiseTimer=noiseEnd=0;noise?.clearRect(0,0,280,180);};
  const noiseEnabled=()=>root.dataset.style==='analog'&&!reducedMotion.matches&&!document.hidden&&tvVisible;
  const rustle=()=>{stopNoise();if(!noise||!noiseEnabled())return;
    const draw=()=>{if(!noiseEnabled()){stopNoise();return;}noiseFrames++;noise.clearRect(0,0,280,180);
      for(let j=0;j<800;j++){const x=Math.random()*280,y=Math.random()*180;if(!(x<9||x>271||y<7||y>171))continue;noise.fillStyle=Math.random()>.5?'rgba(240,228,200,.4)':'rgba(0,0,0,.65)';noise.fillRect(x,y,Math.random()>.85?5:1,1);}};
    draw();noiseTimer=setInterval(draw,75);noiseEnd=setTimeout(stopNoise,225);
  };
  if(snow){snow.className='ct-tv-static';snow.width=280;snow.height=180;snow.setAttribute('aria-hidden','true');document.body.append(snow);
    if('IntersectionObserver'in window)new IntersectionObserver(([entry])=>{tvVisible=entry.isIntersecting;if(!tvVisible)stopNoise();}).observe(television);else tvVisible=true;
    television.addEventListener('pointerenter',()=>{if(Date.now()-lastRustle>5000){lastRustle=Date.now();rustle();}});television.addEventListener('pointerleave',stopNoise);
    ui.subscribe(()=>{if(!noiseEnabled())stopNoise();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)stopNoise();});window.addEventListener('blur',stopNoise);window.addEventListener('pagehide',stopNoise);reducedMotion.addEventListener('change',stopNoise);
  }
  // This marks usable reader layout, including native-link/script-failure
  // fallback. The entry module publishes reading-ready after navigation and
  // incoming paragraph/focus restoration have also completed.
  root.classList.add('js','reading-ui-ready');if(hasReadingBodies)root.classList.add('reader-ready');
  flushFrame();
  window.CTReadingSystem=Object.freeze({state:()=>({category:currentCategory,catalog:catalogState?{...catalogState}:null,preferences:ui.getPreferences(),reader:isReader}),material:()=>({style:root.dataset.style,noiseRunning:Boolean(noiseTimer),noiseFrames,tvVisible}),refresh:()=>{renderCatalog?.({write:false});scheduleFrame(true);}});
  document.dispatchEvent(new CustomEvent('ct:reading-ui-ready'));
})();
