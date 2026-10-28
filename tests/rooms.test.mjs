import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,readdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {buildSite} from '../scripts/lib/build.mjs';
import {startStaticServer} from '../scripts/lib/server.mjs';
import {createOfflineQaContext} from '../scripts/lib/offline-qa.mjs';
import {chromium} from 'playwright';
const repoRoot=path.resolve(import.meta.dirname,'..');let temp,report,server,browser,index;
const base=()=>server.origin+'/culture-taste-daily';
const context=options=>createOfflineQaContext(browser,{viewport:{width:390,height:844},...options},server.origin);
before(async()=>{temp=await mkdtemp(path.join(os.tmpdir(),'ct-reading-system-test-'));report=await buildSite({repoRoot,outDir:path.join(temp,'culture-taste-daily'),baseUrl:'https://guaizzz.github.io/culture-taste-daily/'});index=JSON.parse(await readFile(path.join(temp,'culture-taste-daily/content-index.json')));server=await startStaticServer(temp);browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL??'chrome',headless:true});});
after(async()=>{await browser?.close();await server?.close();if(temp)await rm(temp,{recursive:true,force:true});});

test('growing inventory preserves latest issue, article order, locks and deterministic artifact bytes',async()=>{
 const sourceDates=(await readdir(path.join(repoRoot,'src/issues'))).sort();assert.equal(index.issues.at(-1).date,sourceDates.at(-1));
 assert.equal(index.issues.length,report.issues.filter(issue=>issue.issue_id>='2026-08-25').length);
 for(const issue of index.issues){
  const m=JSON.parse(await readFile(path.join(repoRoot,'src/issues',issue.date,'issue-manifest.public.json')));
  const html=await readFile(path.join(temp,'culture-taste-daily',issue.url,'index.html'),'utf8');
  assert.ok(html.includes(`data-content-sha256="${m.source_hashes.content_sha256}"`));
  assert.ok(html.includes('data-reading-system="soft-v1"'));
  assert.deepEqual(index.articles.filter(story=>story.date===issue.date).map(story=>story.id),m.stories.map(story=>story.id));
  for(const story of m.stories)assert.ok(html.includes(story.title.replaceAll('&','&amp;')));
 }
 const again=await buildSite({repoRoot,outDir:path.join(temp,'second'),baseUrl:'https://guaizzz.github.io/culture-taste-daily/'});assert.equal(report.artifact_digest,again.artifact_digest);
});

for(const [query,style,theme] of [['style=field&theme=light','field','light'],['style=coral&theme=warm','coral','warm'],['style=analog&theme=dark','analog','dark'],['theme=field','field',null],['theme=coral','coral',null],['theme=analog','analog',null]])test(`${query} opens the same reading system and preserves its visual style across routes`,async()=>{
 const c=await context(),p=await c.newPage(),errors=[];p.on('pageerror',error=>errors.push(error.message));
 await p.goto(base()+'/?'+query);await p.waitForSelector('html.reading-ready');assert.equal(await p.locator('html').getAttribute('data-style'),style);if(theme)assert.equal(await p.locator('html').getAttribute('data-theme'),theme);
 await p.locator('.category-board .story-open').first().click();await p.waitForURL(/\/culture-taste-daily\/issues\//);await p.waitForSelector('html.reading-ready');assert.match(p.url(),/\/culture-taste-daily\/issues\//);assert.equal(await p.locator('html').getAttribute('data-style'),style);if(theme)assert.equal(await p.locator('html').getAttribute('data-theme'),theme);
 assert.ok((await p.locator('#article-body').innerText()).length>100);
 assert.equal(await p.locator('.reader-toolbar [data-language]').count(),0);assert.equal(await p.locator('.reader-toolbar a[href*="#sources"]').count(),0);
 await p.locator('[data-open-settings]').click();assert.ok(await p.locator('#reading-settings').isVisible());assert.equal(await p.locator('#reading-settings [data-language]').count(),2);
 assert.equal(await p.locator('#reading-settings fieldset,#reset-preferences').count(),0);await p.keyboard.press('Escape');
 await p.locator('a[data-reading-return]').first().click();await p.waitForURL(url=>url.pathname==='/culture-taste-daily/');await p.waitForSelector('html.reading-ready');assert.equal(new URL(p.url()).pathname,'/culture-taste-daily/');assert.equal(await p.locator('html').getAttribute('data-style'),style);if(theme)assert.equal(await p.locator('html').getAttribute('data-theme'),theme);
 await p.getByRole('navigation',{name:'主要导航'}).getByRole('link',{name:'往期档案'}).click();await p.waitForURL(url=>url.pathname==='/culture-taste-daily/archive/');await p.waitForSelector('html.reading-ready');assert.equal(await p.locator('html').getAttribute('data-style'),style);if(theme)assert.equal(await p.locator('html').getAttribute('data-theme'),theme);
 assert.deepEqual(errors,[]);await c.close();
});

test('six responsive sizes preserve complete headings, horizontal categories and 44px controls on all current routes',async()=>{
 const c=await context({reducedMotion:'reduce'}),p=await c.newPage();
 const routes=['/','/archive/',index.issues.at(-1).url,index.articles.find(story=>story.date===index.issues.at(-1).date).url];
 for(const [width,height]of[[320,568],[390,844],[430,932],[768,1024],[844,390],[1440,900]]){
  await p.setViewportSize({width,height});
  for(const style of ['field','coral','analog'])for(const theme of ['light','dark','warm'])for(const route of routes){
   await p.goto(base()+route+(route.includes('?')?'&':'?')+'style='+style+'&theme='+theme);await p.waitForSelector('html.reading-ready');
   const geometry=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,clipped:[...document.querySelectorAll('h1,h2,h3')].filter(e=>e.getClientRects().length&&e.scrollWidth>e.clientWidth+2).map(e=>e.textContent),small:[...document.querySelectorAll('[data-ct-control]')].filter(e=>e.getClientRects().length&&!e.closest('dialog')).filter(e=>{let r=e.getBoundingClientRect();return r.width<43.5||r.height<43.5}).map(e=>e.textContent),categories:[...document.querySelectorAll('[data-home-category]')].map(e=>({whiteSpace:getComputedStyle(e).whiteSpace,shrink:getComputedStyle(e).flexShrink}))}));
   assert.equal(geometry.overflow,0,`${width} ${style}/${theme} ${route}: overflow`);assert.deepEqual(geometry.clipped,[],`${width} ${style}/${theme} ${route}: heading`);assert.deepEqual(geometry.small,[],`${width} ${style}/${theme} ${route}: touch controls`);assert.ok(geometry.categories.every(item=>item.whiteSpace==='nowrap'&&item.shrink==='0'));
   await p.locator('[data-open-settings]').click();const panel=await p.locator('#reading-settings').boundingBox();assert.ok(panel.x>=0&&panel.y>=0&&panel.x+panel.width<=width+1&&panel.y+panel.height<=height+1);await p.keyboard.press('Escape');
  }
 }
 await c.close();
});

test('no JavaScript retains both language layers, source links, archive and article access',async()=>{
 const c=await context({javaScriptEnabled:false}),p=await c.newPage();
 await p.goto(base()+index.articles[0].url);assert.ok((await p.locator('#article-body').innerText()).length>100);assert.ok(await p.locator('#chinese-reading').isVisible());assert.ok(await p.locator('#english-reading').isVisible());assert.ok(await p.locator('.sources a').count());
 await p.goto(base()+'/archive/');assert.equal(await p.locator('[data-catalog-item]:visible').count(),await p.locator('[data-catalog-item]').count());
 await c.close();
});

test('a failed enhancement script cannot hide locked reading content',async()=>{
 const c=await context(),p=await c.newPage();
 await c.route('**/rooms/reading-system.js*',route=>route.abort());
 await p.goto(base()+index.articles[0].url);
 assert.ok(await p.locator('#chinese-reading').isVisible());assert.ok(await p.locator('#english-reading').isVisible());
 assert.ok((await p.locator('#article-body').innerText()).length>100);assert.ok(await p.locator('.sources a').count());
 await c.close();
});

test('homepage filtering retains source order and one main entry per article',async()=>{
 const c=await context(),p=await c.newPage();await p.goto(base()+'/');
 const latest=index.issues.at(-1),m=JSON.parse(await readFile(path.join(repoRoot,'src/issues',latest.date,'issue-manifest.public.json')));
 assert.deepEqual(await p.locator('.category-board .story-card').evaluateAll(items=>items.map(e=>e.id.replace(/^card-\d{4}-\d{2}-\d{2}-/,''))),m.stories.map(story=>story.id));
 assert.equal(await p.locator('.category-board a.story-open').count(),m.stories.length);
 await p.locator('[data-home-category="city"]').click();assert.equal(await p.locator('.category-board .story-card:visible').count(),index.articles.filter(story=>story.date===latest.date&&story.category==='city').length);
 await c.close();
});

test('archive search, month, category and reset work with preserved original categories',async()=>{
 const c=await context(),p=await c.newPage();await p.goto(base()+'/archive/');
 const missing=await p.locator('[data-catalog="issues"] [data-catalog-item]').evaluateAll(items=>items.filter(e=>!e.dataset.categories?.trim()).map(e=>e.dataset.date));assert.deepEqual(missing,[]);
 await p.locator('#catalog-search').fill('NO_SUCH_STORY_4729');assert.ok(await p.locator('.empty-state').isVisible());await p.locator('[data-clear-search]').click();assert.ok(await p.locator('.empty-state').isHidden());
 await p.locator('[data-view="articles"]').click();assert.ok(await p.locator('[data-catalog="articles"] .story-card:visible').count());
 await p.locator('[data-category-filter="music"]').click();assert.ok(await p.locator('[data-catalog="articles"] .story-card:visible').evaluateAll(items=>items.every(e=>e.dataset.category==='music')));
 await p.locator('#catalog-month').selectOption('2026-08');assert.ok(await p.locator('[data-catalog="articles"] .story-card:visible').evaluateAll(items=>items.every(e=>e.dataset.date.startsWith('2026-08'))));
 await p.locator('[data-clear-search]').click();assert.equal(await p.locator('#catalog-month').inputValue(),'all');assert.equal(await p.locator('[data-category-filter="all"]').getAttribute('aria-pressed'),'true');
 await c.close();
});

test('loaded portrait and landscape images use natural ratios; unavailable images retain exact official links',async()=>{
 const c=await context(),p=await c.newPage();
 await c.route('https://www.nact.jp/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="200"><rect width="100" height="200" fill="#aaa"/></svg>'}));
 await p.goto(base()+index.articles.find(story=>story.id==='nact-shojo-manga-infinity-2026').url);
 const img=p.locator('.reader-hero img[data-external-preview]').first();await img.waitFor();await p.waitForFunction(()=>{const image=document.querySelector('.reader-hero img[data-external-preview]');return image.complete&&image.naturalWidth>0;});
 const ratio=await img.evaluate(image=>{const r=image.getBoundingClientRect();return{actual:r.width/r.height,natural:image.naturalWidth/image.naturalHeight}});assert.ok(Math.abs(ratio.actual-ratio.natural)<.01,'synthetic portrait is not forced into a fixed frame');
 assert.ok(await p.locator('[data-inline-visual]').count());assert.ok(await p.locator('.photo figcaption a[href^="https:"]').count());await c.close();
});

// These two cards are deliberately synthetic layout fixtures, not new stories.
test('eleventh and twelfth cards retain readable widths when a daily package grows',async()=>{
 const c=await context({reducedMotion:'reduce'}),p=await c.newPage();
 for(const [width,height]of[[320,568],[390,844],[768,1024],[1440,900]]){
  await p.setViewportSize({width,height});await p.goto(base()+'/');await p.waitForSelector('html.reading-ready');
  await p.evaluate(()=>{const card=document.querySelector('.category-board .story-card:last-child');for(const index of [11,12]){const copy=card.cloneNode(true);copy.id='synthetic-layout-'+index;copy.className='story story-card story-'+index;copy.dataset.layoutFixture='true';card.parentElement.append(copy);}});
  const layout=await p.locator('[data-layout-fixture]').evaluateAll(cards=>cards.map(card=>{const rect=card.getBoundingClientRect(),group=card.parentElement.getBoundingClientRect();return {width:rect.width,groupWidth:group.width,inside:rect.left>=group.left-1&&rect.right<=group.right+1};}));
  assert.ok(layout.every(card=>card.inside&&card.width>=(card.groupWidth-80)/3),`${width}px: additional cards remain readable`);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0);
 }
 await c.close();
});

test('unavailable-image metadata stays horizontal in compact two-column cards',async()=>{
 const c=await context({reducedMotion:'reduce'}),p=await c.newPage();
 for(const [width,height]of[[320,568],[390,844]]){
  await p.setViewportSize({width,height});await p.goto(base()+'/');await p.locator('.story-3').scrollIntoViewIfNeeded();await p.locator('.story-3 [data-retry-photo]').waitFor({state:'visible'});
  const geometry=await p.locator('.story-3 .photo-note').evaluate(note=>{const source=note.querySelector('.source-state'),retry=note.querySelector('[data-retry-photo]');return {source:source.getBoundingClientRect().width,retryHeight:retry.getBoundingClientRect().height,retryWhiteSpace:getComputedStyle(retry).whiteSpace};});
  assert.ok(geometry.source>=100,`${width}: source description remains a readable line`);assert.equal(geometry.retryWhiteSpace,'nowrap');assert.equal(geometry.retryHeight,44);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0);
 }
 await c.close();
});

test('saved style is applied before the body parser reaches its first content',async()=>{
 for(const [query,style,theme]of[['style=analog&theme=dark','analog','dark'],['style=coral&theme=warm','coral','warm'],['theme=analog','analog','dark']]){
  const c=await context(),p=await c.newPage();
  try{
   // A test-only parser-time probe distinguishes head bootstrap from deferred setup.
   await p.route(base()+'/?*',async route=>{const response=await route.fetch({maxRedirects:0});const html=await response.text();await route.fulfill({response,body:html.replace(/(<body[^>]*>)/,'$1<script>document.documentElement.dataset.styleAtBody=document.documentElement.dataset.style;document.documentElement.dataset.themeAtBody=document.documentElement.dataset.theme;</script>')});});
   await p.goto(base()+'/?'+query);await p.waitForSelector('html.reading-ready');
   assert.equal(await p.locator('html').getAttribute('data-style-at-body'),style);assert.equal(await p.locator('html').getAttribute('data-theme-at-body'),theme);
  }finally{await c.close();}
 }
});
