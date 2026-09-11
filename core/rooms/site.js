(() => {
'use strict';
const root=document.documentElement,settings=window.__CTSettings||{theme:'field',motion:true,filter:false};
const names={field:['Field Notes','场域'],coral:['Coral Print','印刷'],analog:['Analog Signal','信号']};
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
let destroyed=false,visualFrame=0,progressFrames=0;
const controls=[...document.querySelectorAll('[data-room]')];
const dialog=document.querySelector('#room-dialog');
const safeStore=(key,value)=>{try{sessionStorage.setItem(key,JSON.stringify(value));}catch{}};
const readStore=key=>{try{return JSON.parse(sessionStorage.getItem(key));}catch{return null;}};
const effectiveMotion=()=>settings.motion&&!reduce.matches;
function addSettings(url){for(const [key,value] of Object.entries({theme:settings.theme,motion:settings.motion?'on':'off',filter:settings.filter?'on':'off',palette:settings.palette||'rose'}))url.searchParams.set(key,value);return url.pathname+url.search+url.hash;}
function updateLinks(){document.querySelectorAll('a[data-internal]').forEach(a=>{const url=new URL(a.href,location.href);if(url.origin===location.origin)a.href=addSettings(url);});}
function preservePoint(){const headerBottom=document.querySelector('.masthead').getBoundingClientRect().bottom,y=Math.min(headerBottom+110,innerHeight*.4);const paragraphs=[...document.querySelectorAll('#article-body p,.issue-story-body .prose p')].map(block=>({block,rect:block.getBoundingClientRect()})).filter(x=>x.rect.bottom>headerBottom+20&&x.rect.top<innerHeight*.65).sort((a,b)=>Math.abs(a.rect.top-y)-Math.abs(b.rect.top-y));if(paragraphs.length)return {block:paragraphs[0].block,top:paragraphs[0].rect.top};let candidate=document.elementFromPoint(innerWidth*.6,y);if(candidate?.closest('dialog,.masthead,.room-inline'))candidate=null;const block=candidate?.closest('.prose p,.story-card,.issue-card,.section-heading,.article-header,.hero,.issue-toc,.sources,.coda');return block?{block,top:block.getBoundingClientRect().top}:{scroll:scrollY};}
function apply({write=true,anchor=null}={}){
 root.dataset.palette=settings.palette||'rose';document.querySelectorAll('button[data-palette]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.palette===root.dataset.palette)));root.dataset.theme=settings.theme;root.dataset.filter=settings.filter?'on':'off';root.dataset.motion=effectiveMotion()?'on':'off';
 controls.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.room===settings.theme)));
 document.querySelectorAll('[data-current-room]').forEach(e=>e.textContent=names[settings.theme][1]);
 document.querySelectorAll('[data-room-sign]').forEach(e=>e.textContent=names[settings.theme][0].toUpperCase()+' / '+names[settings.theme][1]);
 document.querySelectorAll('input[data-motion]').forEach(e=>{e.checked=effectiveMotion();e.disabled=reduce.matches;});
 document.querySelectorAll('input[data-filter]').forEach(e=>e.checked=settings.filter);
 document.querySelectorAll('[data-restore]').forEach(e=>e.hidden=!settings.filter);
 document.querySelectorAll('.treatment').forEach(e=>e.textContent=settings.filter?'／轻滤镜':'／原色');
 document.querySelectorAll('[data-setting-status]').forEach(e=>e.textContent=reduce.matches?'已遵循系统减少动态设置':settings.filter?'轻摄影质感 · 随时恢复原色':'图片保持原色');
 if(write){safeStore('ct-art-direction-settings',settings);history.replaceState(history.state,'',addSettings(new URL(location.href)));}
 updateLinks();document.querySelectorAll('.art-surface').forEach(e=>e.tabIndex=-1);art?.reset();art?.render();
 if(anchor){if(anchor.block?.isConnected)scrollBy({top:anchor.block.getBoundingClientRect().top-anchor.top,behavior:'instant'});else if(anchor.scroll!==undefined)scrollTo({top:anchor.scroll,behavior:'instant'});}
 scheduleProgress();
}
let selectionAnchor=null;
document.querySelector('[data-open-dialog]')?.addEventListener('click',()=>{selectionAnchor=preservePoint();dialog.showModal();dialog.querySelector(`[data-room="${settings.theme}"]`).focus({preventScroll:true});});
document.querySelector('[data-close-dialog]')?.addEventListener('click',()=>dialog.close());
dialog?.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
dialog?.addEventListener('close',()=>{selectionAnchor=null;});
controls.forEach(b=>b.addEventListener('click',()=>{const anchor=dialog.open?selectionAnchor:preservePoint();settings.theme=b.dataset.room;apply({anchor});}));
document.querySelectorAll('button[data-palette]').forEach(b=>b.addEventListener('click',()=>{settings.palette=b.dataset.palette;apply({anchor:dialog.open?selectionAnchor:preservePoint()});}));
for(const group of document.querySelectorAll('.room-options,.category-tabs,.catalog-tabs,.palette-options'))group.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;const bs=[...group.querySelectorAll('button')],i=bs.indexOf(document.activeElement);if(i<0)return;e.preventDefault();const n=e.key==='Home'?0:e.key==='End'?bs.length-1:(i+(e.key==='ArrowRight'?1:-1)+bs.length)%bs.length;bs[n].focus();bs[n].click();});
document.querySelectorAll('input[data-motion]').forEach(e=>e.addEventListener('change',()=>{settings.motion=e.checked;apply();}));
document.querySelectorAll('input[data-filter]').forEach(e=>e.addEventListener('change',()=>{settings.filter=e.checked;apply();}));
document.querySelectorAll('[data-restore]').forEach(e=>e.addEventListener('click',()=>{settings.filter=false;apply();e.parentElement.querySelector('[data-filter]').focus();}));
reduce.addEventListener('change',()=>apply({write:false}));
function initPhotos(container=document){container.querySelectorAll('[data-photo]').forEach(figure=>{
 if(figure.dataset.bound)return;figure.dataset.bound='true';const img=figure.querySelector('img'),status=figure.querySelector('[data-photo-status]'),retry=figure.querySelector('[data-retry-photo]');let timer=0,observer=null;
 const show=(state,text)=>{figure.dataset.image=state;if(status)status.textContent=text;if(retry)retry.hidden=!['failed','slow'].includes(state)};
 const settle=()=>{clearTimeout(timer);if(!img.complete)return;show(img.naturalWidth?'loaded':'failed',img.naturalWidth?'图片已载入':'图像暂未载入');observer?.disconnect()};
 const start=()=>{clearTimeout(timer);show('loading','图片载入中');timer=setTimeout(()=>{if(img.naturalWidth)settle();else show('slow','图片加载较慢')},8000)};
 img.addEventListener('load',settle);img.addEventListener('error',()=>{clearTimeout(timer);show('failed','图像暂未载入');observer?.disconnect()});
 retry?.addEventListener('click',()=>{const src=img.getAttribute('src');if(!src)return;start();img.loading='eager';img.removeAttribute('src');img.setAttribute('src',src)});
 if(img.complete)settle();else{show('loading','图片载入中');observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){start();observer.disconnect()}},{rootMargin:'200px'});observer.observe(img)}
});}

initPhotos();
const homeButtons=[...document.querySelectorAll('[data-home-category]')];
if(homeButtons.length){
 const categories=['all','fashion','music','objects','city'];
 const fromUrl=()=>{const key=new URLSearchParams(location.search).get('home-category');return categories.includes(key)?key:'all'};
 function filterHome(key,write=true){document.querySelectorAll('.category-board .story-card').forEach(e=>e.hidden=key!=='all'&&e.dataset.storyCategory!==key);homeButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.homeCategory===key)));const shown=document.querySelectorAll('.category-board .story-card:not([hidden])').length;document.querySelector('.home-empty').hidden=shown>0;document.querySelector('.home-filter-status').textContent=(key==='all'?'本期正式文章':homeButtons.find(b=>b.dataset.homeCategory===key).childNodes[0].textContent.trim())+' · '+shown+' 篇';if(write){const u=new URL(location.href);if(key==='all')u.searchParams.delete('home-category');else u.searchParams.set('home-category',key);history.replaceState(history.state,'',u)}scheduleProgress()}
 homeButtons.forEach(b=>b.addEventListener('click',()=>filterHome(b.dataset.homeCategory)));
 document.querySelector('.category-jumps').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;const i=homeButtons.indexOf(document.activeElement);if(i<0)return;e.preventDefault();const n=e.key==='Home'?0:e.key==='End'?homeButtons.length-1:(i+(e.key==='ArrowRight'?1:-1)+homeButtons.length)%homeButtons.length;homeButtons[n].focus();homeButtons[n].click()});
 filterHome(fromUrl(),false);window.addEventListener('popstate',()=>filterHome(fromUrl(),false));
}
document.querySelectorAll('.extra-thumb img').forEach(img=>{const fail=()=>img.hidden=true;img.addEventListener('error',fail);if(img.complete&&!img.naturalWidth)fail();});
const revealed=new WeakSet();const revealObserver=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting&&!revealed.has(entry.target)){revealed.add(entry.target);entry.target.classList.add('in-view');}},{threshold:.08});
document.querySelectorAll('[data-reveal],.section-heading').forEach(e=>revealObserver.observe(e));
function updateProgress(){visualFrame=0;if(document.hidden||destroyed)return;progressFrames++;const body=document.querySelector('#article-body')||document.querySelector('.issue-body')||document.querySelector('main');const rect=body.getBoundingClientRect(),start=scrollY+rect.top-130,end=start+rect.height-Math.min(innerHeight*.65,500);const value=Math.max(0,Math.min(100,(scrollY-start)/Math.max(1,end-start)*100));document.querySelectorAll('[data-progress]').forEach(e=>e.textContent=String(Math.round(value)).padStart(2,'0'));root.style.setProperty('--progress',value+'%');}
function scheduleProgress(){if(!visualFrame&&!document.hidden&&!destroyed)visualFrame=requestAnimationFrame(updateProgress);}
window.addEventListener('scroll',scheduleProgress,{passive:true});window.addEventListener('resize',scheduleProgress,{passive:true});
// Preserve the archive's exact URL and native scroll position when leaving its results.
document.addEventListener('click',e=>{const a=e.target.closest('a[data-internal]');if(!a)return;if(location.pathname.endsWith('/archive/'))safeStore('ct-art-direction-archive-return',{url:location.pathname+location.search+location.hash,scroll:scrollY});});
const returnButton=document.querySelector('[data-back-results]');const returnState=readStore('ct-art-direction-archive-return');
if(returnButton&&returnState?.url && new URL(returnState.url,location.origin).pathname.endsWith('/archive/')){returnButton.hidden=false;returnButton.addEventListener('click',()=>{safeStore('ct-art-direction-restore-archive',true);location.href=addSettings(new URL(returnState.url,location.origin));});}
let catalogState=null,catalogRender=null;
const catalog=document.querySelector('#catalog');
if(catalog){
 const search=document.querySelector('#catalog-search'),articleTools=document.querySelector('.article-tools'),empty=document.querySelector('.empty-state'),pagination=document.querySelector('.pagination');
 const containers={issues:document.querySelector('[data-catalog=issues]'),articles:document.querySelector('[data-catalog=articles]')};
 const items=()=>[...catalog.querySelectorAll('[data-catalog-item]')];
 function fromUrl(){const q=new URLSearchParams(location.search);catalogState={view:q.get('view')==='articles'?'articles':'issues',q:q.get('q')||'',month:/^\d{4}-\d{2}$/.test(q.get('month')||'')?q.get('month'):'all',category:['fashion','music','objects','city'].includes(q.get('category'))?q.get('category'):'all',page:Math.max(1,parseInt(q.get('page')||'1',10)||1)};}
 function updateUrl(){const url=new URL(location.href);for(const [k,v] of Object.entries(catalogState)){if((k==='view'&&v==='issues')||(k==='q'&&!v)||((k==='category'||k==='month')&&v==='all')||(k==='page'&&v===1))url.searchParams.delete(k);else url.searchParams.set(k,v);}history.replaceState(history.state,'',addSettings(url));}
 function renderCatalog({write=true,scroll=false}={}){
  const s=catalogState;search.value=s.q;articleTools.hidden=false;const month=document.querySelector('#catalog-month');const months=[...new Set(items().map(e=>e.dataset.date?.slice(0,7)).filter(Boolean))].sort().reverse();if(s.month!=='all'&&!months.includes(s.month))months.unshift(s.month);month.replaceChildren(new Option('全部月份','all'),...months.map(m=>new Option(m.replace('-',' 年 ')+' 月',m)));month.value=s.month;document.querySelector('.week-heading').hidden=s.view!=='issues';Object.entries(containers).forEach(([k,e])=>e.hidden=k!==s.view);
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===s.view)));
  document.querySelectorAll('[data-category-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.categoryFilter===s.category)));
  const eligible=items().filter(e=>e.dataset.kind===s.view&&(s.month==='all'||e.dataset.date?.startsWith(s.month))&&(s.category==='all'||(s.view==='issues'?(e.dataset.categories||'').split(' ').includes(s.category):e.dataset.category===s.category))&&(!s.q||(e.dataset.search||'').toLocaleLowerCase().includes(s.q.toLocaleLowerCase().trim()))).sort((a,b)=>(b.dataset.date||'').localeCompare(a.dataset.date||''));
  const size=s.view==='issues'?12:24,pages=Math.max(1,Math.ceil(eligible.length/size));s.page=Math.min(s.page,pages);const shown=new Set(eligible.slice((s.page-1)*size,s.page*size));items().forEach(e=>e.hidden=!shown.has(e));empty.hidden=eligible.length>0;
  document.querySelector('.catalog-status').textContent=`${s.view==='issues'?'按期浏览':'全部文章'} / ${eligible.length} ${s.view==='issues'?'期':'篇'}${eligible.length?` · 第 ${s.page} / ${pages} 页`:''}`;
  pagination.replaceChildren();if(pages>1){for(let n=0;n<pages+2;n++){const target=n===0?s.page-1:n===pages+1?s.page+1:n,b=document.createElement('button');b.type='button';b.textContent=n===0?'上一页':n===pages+1?'下一页':String(n);b.disabled=target<1||target>pages;if(n===s.page)b.setAttribute('aria-current','page');b.addEventListener('click',()=>{s.page=target;renderCatalog({scroll:true});pagination.querySelector('[aria-current=page]')?.focus({preventScroll:true});});pagination.append(b);}}
  if(write)updateUrl();if(scroll)catalog.scrollIntoView({block:'start',behavior:'instant'});scheduleProgress();
 }
 catalogRender=renderCatalog;fromUrl();renderCatalog({write:false});
 document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{catalogState.view=b.dataset.view;catalogState.page=1;renderCatalog();}));
 document.querySelectorAll('[data-category-filter]').forEach(b=>b.addEventListener('click',()=>{catalogState.category=b.dataset.categoryFilter;catalogState.page=1;renderCatalog();}));
 document.querySelector('#catalog-month').addEventListener('change',e=>{catalogState.month=e.target.value;catalogState.page=1;renderCatalog();});
 search.addEventListener('input',()=>{catalogState.q=search.value;catalogState.page=1;renderCatalog();search.focus({preventScroll:true});});
 document.querySelector('[data-clear-search]').addEventListener('click',()=>{catalogState.q='';catalogState.month='all';catalogState.category='all';catalogState.page=1;renderCatalog();search.focus();});
 window.addEventListener('popstate',()=>{fromUrl();renderCatalog({write:false});});
 if(readStore('ct-art-direction-restore-archive')){safeStore('ct-art-direction-restore-archive',false);requestAnimationFrame(()=>scrollTo(0,readStore('ct-art-direction-archive-return')?.scroll||0));}
}
// Input-driven material studies. Original images never enter the effect pipeline.
function createArt(){
 const holder=document.querySelector('[data-material]');if(!holder)return null;
 let active=false,frames=0,timer=0,visible=false;const button=holder.querySelector('[data-material-action]'),note=holder.querySelector('.material-note');
 function reset(){clearTimeout(timer);active=false;holder.classList.remove('material-active');holder.style.removeProperty('--hand-x');holder.style.removeProperty('--hand-y');button.setAttribute('aria-pressed','false');}
 function render(){reset();frames++;note.textContent='';button.disabled=!effectiveMotion();}
 button.addEventListener('click',()=>{if(!effectiveMotion())return;clearTimeout(timer);active=!active;holder.classList.toggle('material-active',active);button.setAttribute('aria-pressed',String(active));frames++;note.textContent=!holder.querySelector('.doodle-scene')&&settings.theme!=='analog'?(active?'封面来自本期原创设计。':''):settings.theme==='field'?(active?'物件还认得出来，线条不必太听话。':''):settings.theme==='coral'?(active?'这一笔，和上一笔不太一样。':''):(active?'CH '+holder.dataset.materialDate.slice(-2)+' · '+holder.dataset.materialTitle:'');if(settings.theme==='analog')timer=setTimeout(()=>{reset();frames++;},900);});
 holder.querySelector('.art-surface').addEventListener('pointermove',e=>{if(e.pointerType==='touch'||!effectiveMotion()||document.hidden||!visible)return;const r=e.currentTarget.getBoundingClientRect();holder.style.setProperty('--hand-x',((e.clientX-r.left)/r.width-.5)*8+'px');holder.style.setProperty('--hand-y',((e.clientY-r.top)/r.height-.5)*6+'px');frames++;});
 holder.addEventListener('pointerleave',()=>{holder.style.removeProperty('--hand-x');holder.style.removeProperty('--hand-y');});
 new IntersectionObserver(([e])=>{visible=e.isIntersecting;if(!visible)reset()}).observe(holder);
 return {reset,render,state:()=>({frames,running:false,strength:active?1:0,visible,kind:'material'})};
}
const art=createArt();
function suspend(){if(visualFrame)cancelAnimationFrame(visualFrame);visualFrame=0;art?.reset();}
document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();else scheduleProgress();});document.addEventListener('freeze',suspend);window.addEventListener('blur',()=>art?.reset());window.addEventListener('pagehide',()=>{suspend();destroyed=true;});window.addEventListener('pageshow',()=>{destroyed=false;apply({write:false});});
apply();
Object.defineProperty(window,'CTRooms',{value:Object.freeze({state:()=>({settings:{...settings},effectiveMotion:effectiveMotion(),hidden:document.hidden,progressFrames,art:art?.state()??null,catalog:catalogState?{...catalogState}:null}),refreshCatalog:()=>{catalogRender?.();initPhotos();updateLinks();}})});
})();
