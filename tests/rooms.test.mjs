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
 await p.goto(base()+'/?'+query);assert.equal(await p.locator('html').getAttribute('data-style'),style);if(theme)assert.equal(await p.locator('html').getAttribute('data-theme'),theme);
 await p.locator('.category-board .story-open').first().click();assert.match(p.url(),/\/culture-taste-daily\/issues\//);assert.equal(await p.locator('html').getAttribute('data-style'),style);if(theme)assert.equal(await p.locator('html').getAttribute('data-theme'),theme);
 assert.ok((await p.locator('#article-body').innerText()).length>100);
 assert.equal(await p.locator('.reader-toolbar [data-language]').count(),0);assert.equal(await p.locator('.reader-toolbar a[href*="#sources"]').count(),0);
 await p.locator('[data-open-settings]').click();assert.ok(await p.locator('#reading-settings').isVisible());assert.equal(await p.locator('#reading-settings [data-language]').count(),2);
 assert.equal(await p.locator('#reading-settings fieldset,#reset-preferences').count(),0);await p.keyboard.press('Escape');
 await p.locator('a[data-reading-return]').first().click();await p.waitForSelector('html.reading-ready');assert.equal(new URL(p.url()).pathname,'/culture-taste-daily/');assert.equal(await p.locator('html').getAttribute('data-style'),style);if(theme)assert.equal(await p.locator('html').getAttribute('data-theme'),theme);
 await p.getByRole('navigation',{name:'主要导航'}).getByRole('link',{name:'往期档案'}).click();await p.waitForSelector('html.reading-ready');assert.equal(await p.locator('html').getAttribute('data-style'),style);if(theme)assert.equal(await p.locator('html').getAttribute('data-theme'),theme);
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
