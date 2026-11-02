/* Two independent contexts: immutable browse origin and parent reading spot. */
const ROOT_KEY='ct-living-roots-v1',PARENT_KEY='ct-living-parents-v1',TTL=12*3600000,MAX=12;
let initialized=false,appliedToken=null,cancelled=false,incomingPositioned=false;
const read=key=>{try{const value=JSON.parse(sessionStorage.getItem(key)||'[]');return Array.isArray(value)?value:[];}catch{return [];}};
const now=()=>Date.now();
const valid=x=>x&&typeof x.token==='string'&&Number.isFinite(x.createdAt)&&now()-x.createdAt>=0&&now()-x.createdAt<TTL;
const list=key=>read(key).filter(valid).slice(-MAX);
const write=(key,entry)=>{try{sessionStorage.setItem(key,JSON.stringify([...list(key).filter(e=>e.token!==entry.token),entry].slice(-MAX)));}catch{}};
const token=()=>globalThis.crypto?.randomUUID?.()||`ct-${now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;
const urlOf=href=>{try{return new URL(href,location.href);}catch{return null;}};
const siteRoot=()=>urlOf(document.querySelector('[data-site-home]')?.href||'./');
const safeUrl=href=>{const url=urlOf(href),home=siteRoot();return url&&home&&!url.username&&!url.password&&url.origin===location.origin&&url.pathname.startsWith(home.pathname)?url:null;};
const cleanUrl=href=>{const u=urlOf(href);for(const k of ['ctroot','ctparent','ctreturn'])u.searchParams.delete(k);return u;};
const rootToken=()=>new URLSearchParams(location.search).get('ctroot')||history.state?.ctLivingRoot;
const parentToken=()=>new URLSearchParams(location.search).get('ctparent');
const currentRoot=()=>list(ROOT_KEY).find(x=>x.token===rootToken()&&safeUrl(x.url));
const currentParent=()=>list(PARENT_KEY).find(x=>x.token===parentToken()&&safeUrl(x.url));
const userInput=()=>{cancelled=true;};
const plainClick=e=>!e.defaultPrevented&&e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey;
const isStandalone=url=>/\/issues\/\d{4}-\d{2}-\d{2}\/stories\/[^/]+\/$/.test(url.pathname);
const isEdition=url=>/\/issues\/\d{4}-\d{2}-\d{2}\/$/.test(url.pathname);
const visible=node=>node&&node.getClientRects().length&&getComputedStyle(node).visibility!=='hidden';

export function getHomeRestore(config){
 const pending=currentRoot();
 const browse=history.state?.ctLivingBrowse;
 const validBrowse=browse&&browse.issueId===config.issueId&&Number.isFinite(browse.q)&&Number.isFinite(browse.createdAt)&&now()-browse.createdAt>=0&&now()-browse.createdAt<TTL;
 const scene=pending?.mode==='home'&&pending.issueId===config.issueId?pending:validBrowse?browse:null;
 if(!scene)return null;
 const kind=scene===pending?'return':'browse';
 const index=id=>config.stories.findIndex(s=>s.id===id);
 let q=kind==='return'&&scene.entryKind==='story'?index(scene.clickedStoryId):scene.revision===config.revision?scene.q:index(scene.activeStoryId);
 const missingId=(kind==='return'&&scene.entryKind==='story'||scene.revision!==config.revision)&&q<0;
 if(!Number.isFinite(q)||missingId)q=config.initialIndex||0;
 else q=Math.max(0,Math.min(config.stories.length-1,q));
 return {scene,q,kind,activeStoryId:config.stories[Math.round(q)]?.id};
}

export function persistBrowse(state=window.CTLivingEdition?.state?.()){
 if(!document.body.classList.contains('page-home')||!state||!Number.isFinite(state.q))return;
 const browse={mode:'home',issueId:state.issueId,revision:state.revision,q:state.q,activeStoryId:state.activeStoryId,
  ambientPalette:state.ambientPalette,createdAt:now()};
 try{history.replaceState({...history.state,ctLivingBrowse:browse},'',location.href);}catch{}
}

function focusOrigin(scene){
 if(cancelled)return;
 let target;
 if(scene.entryKind==='story'){
  const selector=scene.focusKind==='index-story'?'.living-index-row a':scene.focusKind==='current-story-title'?'[data-living-current]':'.living-art';
  target=[...document.querySelectorAll(selector)].find(a=>a.dataset.storyId===scene.clickedStoryId);
 }else if(scene.focusKind==='edition-action')target=document.querySelector('.living-read-edition');
 else if(scene.focusKind==='edition-title')target=document.querySelector('#living-title a');
 if(!target&&scene.focusId)target=document.getElementById(scene.focusId)?.querySelector('a')||document.getElementById(scene.focusId);
 target?.focus({preventScroll:true});
}

function saveRoot(link){
 const mode=document.body.classList.contains('page-home')?'home':document.body.classList.contains('page-archive')?'archive':null;
 if(!mode)return currentRoot();
 const state=window.CTLivingEdition?.state?.()||{};
 const clickedStoryId=link.dataset.storyId||null;
 const origin=cleanUrl(location.href);origin.hash='';
 const focusKind=link.closest('.living-index-row')?'index-story':link.matches('[data-living-current]')?'current-story-title':link.matches('.living-art')?'artwork':link.matches('.living-read-edition')?'edition-action':link.closest('#living-title')?'edition-title':'other';
 const scene={token:token(),createdAt:now(),mode,url:origin.href,scrollY:window.scrollY,focusKind,focusId:link.closest('[id]')?.id||null,
  issueId:state.issueId||document.body.dataset.issueDate,revision:state.revision||'',q:Number.isFinite(state.q)?state.q:0,
  activeStoryId:state.activeStoryId||null,clickedStoryId,entryKind:link.dataset.livingEntry==='story'?'story':'edition',
  ambientPalette:state.ambientPalette||null,indexMode:window.CTReadingSystem?.state?.().catalog||null,
  category:window.CTReadingSystem?.state?.().category||'all'};
 write(ROOT_KEY,scene);
 try{history.replaceState({...history.state,ctLivingRoot:scene.token},'',location.href);}catch{}
 return scene;
}

function paragraphSnapshot(){
 const marker=(document.querySelector('.site-header')?.getBoundingClientRect().bottom||56)+16;
 const all=[...document.querySelectorAll('[data-reading-body]')];
 for(const body of all){
  const lang=body.querySelector('[data-reading-language="en"]')?.hidden?'zh':body.querySelector('[data-reading-language="zh"]')?.hidden?'en':'zh';
  const section=body.querySelector(`[data-reading-language="${lang}"] .english-content`)||body.querySelector(`[data-reading-language="${lang}"]`);
  const ps=[...section?.children||[]].filter(e=>e.tagName==='P'&&visible(e));
  const index=ps.findIndex(p=>p.getBoundingClientRect().bottom>marker);
  if(index>=0&&body.getBoundingClientRect().top<=innerHeight){const b=ps[index].getBoundingClientRect();return{storyId:body.dataset.sourceBody,index,ratio:Math.max(0,Math.min(1,(marker-b.top)/Math.max(1,b.height)))};}
 }
 return null;
}

function saveParent(link){
 const p={token:token(),createdAt:now(),url:cleanUrl(location.href).href,scrollY:window.scrollY,paragraph:paragraphSnapshot(),
  clickedStoryId:link.closest('.issue-story')?.id.replace(/^story-/,'')||null,
  expanded:[...document.querySelectorAll('details[open][id]')].map(e=>e.id)};
 write(PARENT_KEY,p);return p;
}

function restoreScroll(snapshot,{parent=false,persisted=false}={}){
 if(!snapshot||persisted||cancelled)return;
 // Deferred page modules run after the CSS and locale bootstrap. Measure the
 // served DOM once, before its first readable frame; do not chase later loads.
  if(parent)for(const id of snapshot.expanded||[]){const d=document.getElementById(id);if(d?.tagName==='DETAILS')d.open=true;}
  let top=snapshot.scrollY;
  if(parent&&snapshot.paragraph){
   const b=[...document.querySelectorAll('[data-reading-body]')].find(e=>e.dataset.sourceBody===snapshot.paragraph.storyId);
   const section=b&&[...b.querySelectorAll('[data-reading-language]')].find(visible);
   const inner=section?.querySelector('.english-content')||section;
   const ps=[...inner?.children||[]].filter(e=>e.tagName==='P');
   const p=ps[Math.min(snapshot.paragraph.index,ps.length-1)];
   if(p){const r=p.getBoundingClientRect(),marker=(document.querySelector('.site-header')?.getBoundingClientRect().bottom||56)+16;top=scrollY+r.top+r.height*snapshot.paragraph.ratio-marker;}
  }
  if(Number.isFinite(top))scrollTo({top:Math.max(0,top),behavior:'instant'});
}

export function consumeHomeRestore(config,{persisted=false}={}){
 const restored=getHomeRestore(config);
 if(!restored||restored.kind!=='return'||appliedToken===restored.scene.token)return restored;
 appliedToken=restored.scene.token;
 restoreScroll(restored.scene,{persisted});focusOrigin(restored.scene);
 const u=new URL(location.href);u.searchParams.delete('ctreturn');u.searchParams.delete('ctparent');u.searchParams.delete('ctroot');
 const state={...history.state};delete state.ctLivingRoot;
 try{history.replaceState(state,'',u);}catch{}
 persistBrowse();
 return restored;
}

function wireReadingLinks(){
 const root=currentRoot(),parent=currentParent();
 const mode=document.body.className;
 if(!mode.includes('page-issue')&&!mode.includes('page-article'))return;
 for(const link of document.querySelectorAll('a[data-reading-return],a[data-back]')){
  const snapshot=parent||root;
  if(snapshot){const u=safeUrl(snapshot.url);if(!u)continue;u.hash='';if(root)u.searchParams.set('ctroot',root.token);u.searchParams.set('ctreturn','1');if(parent)u.searchParams.set('ctparent',parent.token);link.href=u.href;}
 }
 if(root?.mode==='home')for(const link of document.querySelectorAll('a[data-site-home]')){const u=safeUrl(root.url);if(u){u.searchParams.set('ctroot',root.token);u.searchParams.set('ctreturn','1');link.href=u.href;}}
 for(const link of document.querySelectorAll('a[data-story-nav],a.story-option')){
  const u=safeUrl(link.href);if(!u)continue;
  if(root)u.searchParams.set('ctroot',root.token);if(parent)u.searchParams.set('ctparent',parent.token);link.href=u.href;
 }
}

function positionIncoming(){
 const match=/^#story-([a-z0-9-]+)$/.exec(location.hash);if(!match)return;
 const article=document.getElementById('story-'+match[1]);if(!article)return;
 const img=article.querySelector('.reader-hero img.official');
 if(img)img.style.viewTransitionName='ct-entry-art';
 const navigationType=performance.getEntriesByType('navigation')[0]?.type;
 const freshNavigation=!navigationType||navigationType==='navigate';
 if(!incomingPositioned&&!cancelled&&!currentParent()&&freshNavigation){
  const offset=(document.querySelector('.site-header')?.getBoundingClientRect().bottom||56)+16;
  scrollTo({top:Math.max(0,scrollY+article.getBoundingClientRect().top-offset),behavior:'instant'});
 }
 incomingPositioned=true;
}

export function initNavigation(){
 if(initialized)return;initialized=true;
 cancelled=globalThis.CTEarlyNavigationInput?.consume?.()===true;
 for(const type of ['pointerdown','touchstart','wheel','keydown'])window.addEventListener(type,userInput,{passive:true});
 wireReadingLinks();
 const p=currentParent(),scene=currentRoot(),returning=new URLSearchParams(location.search).get('ctreturn')==='1';
 if(document.body.classList.contains('page-issue')&&p&&returning){
  restoreScroll(p,{parent:true});incomingPositioned=true;
  if(!cancelled&&p.clickedStoryId){
   const article=document.getElementById('story-'+p.clickedStoryId);
   [...article?.querySelectorAll('a[href]')||[]].find(a=>{const u=safeUrl(a.href);return u&&isStandalone(u);})?.focus({preventScroll:true});
  }
  // A fragment reintroduced before load is still read by the browser's late
  // initial anchor phase. A resumed paragraph uses the edition route itself.
  const u=new URL(location.href);u.hash='';u.searchParams.delete('ctreturn');u.searchParams.delete('ctparent');
  try{history.replaceState(history.state,'',u);}catch{}
 }
 if(document.body.classList.contains('page-archive')&&scene?.mode==='archive'&&returning){
  restoreScroll(scene);
  const u=new URL(location.href);u.searchParams.delete('ctreturn');u.searchParams.delete('ctroot');
  const state={...history.state};delete state.ctLivingRoot;
  try{history.replaceState(state,'',u);}catch{}
  focusOrigin(scene);
 }
 positionIncoming();
 document.addEventListener('click',event=>{
  if(!plainClick(event))return;
  const link=event.target.closest('a[href]');if(!link||link.target==='_blank'||link.hasAttribute('download'))return;
  const target=safeUrl(link.href);if(!target||(!isStandalone(target)&&!isEdition(target)))return;
  if(target.pathname===location.pathname&&target.hash===location.hash)return;
  let root=currentRoot();
  if(document.body.classList.contains('page-home')||document.body.classList.contains('page-archive'))root=saveRoot(link);
  if(root)target.searchParams.set('ctroot',root.token);
  if(document.body.classList.contains('page-issue')&&isStandalone(target)){const parent=saveParent(link);target.searchParams.set('ctparent',parent.token);}
  else if(currentParent()&&isStandalone(target))target.searchParams.set('ctparent',currentParent().token);
  link.href=target.href;
  window.CTUI?.feedback?.('confirm');
  const image=link.querySelector('.living-official');
  if(image?.naturalWidth)image.style.viewTransitionName='ct-entry-art';
 });
 window.addEventListener('pagereveal',event=>{
  const scene=currentRoot();
  if(document.body.classList.contains('page-home')&&scene)window.CTLivingEdition?.restore?.(scene,{focus:false,scroll:false});
  positionIncoming();
  event.viewTransition?.finished.finally(()=>document.querySelectorAll('[style*="view-transition-name"]').forEach(e=>e.style.viewTransitionName=''));
 });
 window.addEventListener('pageshow',event=>{
  if(event.persisted)cancelled=false;
  wireReadingLinks();
  const scene=currentRoot();
  if(event.persisted&&document.body.classList.contains('page-home')&&scene){appliedToken=null;window.CTLivingEdition?.restore?.(scene,{focus:true,persisted:true});}
 });
 window.addEventListener('pagehide',()=>{
  appliedToken=null;
  const scene=currentRoot();
  if(document.body.classList.contains('page-home')){
   window.CTLivingEdition?.pause?.();
   // Only a newly armed reading origin prepares a clicked bfcache focus. Once
   // consumed, ordinary departures preserve the reader's newer browse scene.
   if(scene)window.CTLivingEdition?.restore?.(scene,{focus:false,scroll:false});
   persistBrowse();
  }
 });
 document.addEventListener('keydown',event=>{
  if(event.key!=='Escape'||event.defaultPrevented||event.isComposing||document.querySelector('dialog[open]')||event.target.matches('input,textarea,select,[contenteditable="true"]'))return;
  const link=document.body.classList.contains('page-article')?document.querySelector('[data-reading-return]'):document.body.classList.contains('page-issue')?document.querySelector('[data-site-home]'):null;
  if(link&&safeUrl(link.href)){event.preventDefault();link.click();}
 });
 window.CTLivingNavigation=Object.freeze({currentRoot,currentParent,paragraphSnapshot,storageAvailable:()=>{try{sessionStorage.setItem('ct-storage-probe','1');sessionStorage.removeItem('ct-storage-probe');return true;}catch{return false;}}});
}
