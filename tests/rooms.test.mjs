import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,readdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {buildSite} from '../scripts/lib/build.mjs';
import {startStaticServer} from '../scripts/lib/server.mjs';
import {chromium} from 'playwright';
const repoRoot=path.resolve(import.meta.dirname,'..');let temp,report,server,browser,index;
before(async()=>{temp=await mkdtemp(path.join(os.tmpdir(),'ct-rooms-test-'));report=await buildSite({repoRoot,outDir:path.join(temp,'culture-taste-daily'),baseUrl:'https://guaizzz.github.io/culture-taste-daily/'});index=JSON.parse(await readFile(path.join(temp,'culture-taste-daily/content-index.json')));server=await startStaticServer(temp);browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL??'chrome',headless:true});});
after(async()=>{await browser?.close();await server?.close();if(temp)await rm(temp,{recursive:true,force:true});});
test('growing inventory determines latest issue, complete archive, body locks and deterministic output',async()=>{
 const sourceDates=(await readdir(path.join(repoRoot,'src/issues'))).sort();assert.equal(index.issues.at(-1).date,sourceDates.at(-1));
 const count=report.issues.filter(i=>i.issue_id>='2026-08-25').length;assert.equal(index.issues.length,count);
 for(const i of index.issues){const manifest=JSON.parse(await readFile(path.join(repoRoot,'src/issues',i.date,'issue-manifest.public.json')));assert.equal(index.articles.filter(s=>s.date===i.date).length,manifest.stories.length);const html=await readFile(path.join(temp,'culture-taste-daily',i.url,'index.html'),'utf8');assert.ok(html.includes(manifest.source_hashes.content_sha256));for(const s of manifest.stories)assert.ok(html.includes(s.title.replaceAll('&','&amp;')));}
 const again=await buildSite({repoRoot,outDir:path.join(temp,'second'),baseUrl:'https://guaizzz.github.io/culture-taste-daily/'});assert.equal(report.artifact_digest,again.artifact_digest);
});
for(const theme of ['field','coral','analog'])test(`${theme}: real subpath, filters, complete reading journey, fixed frame and responsive access`,async()=>{
 const context=await browser.newContext({viewport:{width:390,height:844}});await context.route(/^https:\/\//,r=>r.abort());const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base=server.origin+'/culture-taste-daily';await page.goto(base+'/?theme='+theme);await page.locator('.category-board .story-open').first().click();assert.match(page.url(),/\/culture-taste-daily\/issues\//);assert.equal(await page.locator('html').getAttribute('data-theme'),theme);assert.ok((await page.locator('#article-body').innerText()).length>100);
 await page.locator('.neighbor-stories a').last().click();await page.locator('.back-issue').click();assert.ok(await page.locator('.issue-toc').isVisible());await page.getByRole('navigation',{name:'主要导航'}).getByRole('link',{name:'往期档案'}).click();await page.locator('#catalog-search').fill('NO_SUCH_STORY_4729');assert.ok(await page.locator('.empty-state').isVisible());await page.locator('[data-clear-search]').click();await page.locator('[data-view="issues"]').click();await page.locator('[data-catalog="issues"] .issue-card:visible a').last().click();assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
 for(const width of [320,390,430,768,1440]){await page.setViewportSize({width,height:844});await page.goto(base+'/?theme='+theme);assert.equal(await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-innerWidth)),0);if(theme!=='analog'){const columns=await page.locator('.category-board').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length);assert.equal(columns,width<600?2:width<900?3:width<1200?4:5);}else{await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));assert.equal(await page.locator('.tv-screen-edge').evaluate(e=>getComputedStyle(e).position),'fixed');}}
 assert.deepEqual(errors,[]);await context.close();
});
test('no-JS retains the source and accessible links',async()=>{const c=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});const p=await c.newPage();await p.goto(server.origin+'/culture-taste-daily'+index.articles[0].url);assert.ok((await p.locator('#article-body').innerText()).length>100);assert.ok(await p.locator('.sources a').count());await c.close();});
test('reduced motion, keyboard room selection and filter restoration retain reader state',async()=>{
 const c=await browser.newContext({reducedMotion:'reduce',viewport:{width:390,height:844}});await c.route(/^https:\/\//,r=>r.abort());const p=await c.newPage();await p.goto(server.origin+'/culture-taste-daily/?theme=coral&filter=on&motion=on');
 assert.equal(await p.locator('html').getAttribute('data-motion'),'off');await p.locator('[data-open-dialog]').click();assert.equal(await p.locator('#room-dialog [data-motion]').isDisabled(),true);await p.locator('#room-dialog [data-room="coral"]').focus();await p.keyboard.press('ArrowRight');assert.equal(await p.locator('html').getAttribute('data-theme'),'analog');await p.locator('#room-dialog [data-restore]').click();assert.equal(await p.locator('html').getAttribute('data-filter'),'off');await p.keyboard.press('Escape');await p.getByRole('navigation',{name:'主要导航'}).getByRole('link',{name:'往期档案'}).click();assert.equal(await p.locator('html').getAttribute('data-theme'),'analog');assert.equal(await p.locator('html').getAttribute('data-filter'),'off');await c.close();
});
test('200 explicitly synthetic archive entries paginate, search and sort without entering the release',async()=>{
 const c=await browser.newContext();await c.route(/^https:\/\//,r=>r.abort());const p=await c.newPage();await p.goto(server.origin+'/culture-taste-daily/archive/?view=articles');
 await p.evaluate(()=>{const host=document.querySelector('[data-catalog="articles"]'),original=host.querySelector('[data-catalog-item]');const template=original.cloneNode(true);host.querySelectorAll('[data-catalog-item]').forEach(e=>e.remove());for(let i=0;i<200;i++){const e=template.cloneNode(true);e.id='fixture-'+i;e.dataset.search='SYNTHETIC ONLY '+i;e.dataset.date='2026-09-'+String(i%28+1).padStart(2,'0');e.hidden=false;host.append(e);}});
 await p.locator('#catalog-search').fill('SYNTHETIC ONLY');assert.equal(await p.locator('[data-catalog="articles"] [data-catalog-item]:visible').count(),24);assert.match(await p.locator('.catalog-status').innerText(),/200/);assert.match(await p.locator('.catalog-status').innerText(),/9/);await p.locator('#catalog-search').fill('UNMATCHED');assert.ok(await p.locator('.empty-state').isVisible());await c.close();
});
test('homepage keeps editorial order and empty categories do not occupy a card',async()=>{const c=await browser.newContext();await c.route(/^https:\/\//,r=>r.abort());const p=await c.newPage();await p.goto(server.origin+'/culture-taste-daily/?theme=coral');const latest=index.issues.at(-1),m=JSON.parse(await readFile(path.join(repoRoot,'src/issues',latest.date,'issue-manifest.public.json')));assert.deepEqual(await p.locator('.category-board .story-card').evaluateAll(es=>es.map(e=>e.id.replace(/^card-\d{4}-\d{2}-\d{2}-/,''))),m.stories.map(s=>s.id));await p.locator('[data-home-category="city"]').click();const expected=index.articles.filter(s=>s.date===latest.date&&s.category==='city').length;assert.equal(await p.locator('.category-board .story-card:visible').count(),expected);if(!expected)assert.ok(await p.locator('.home-empty').isVisible());await c.close();});

test('two distinct navigation destinations leave the mobile cover immediately below the header',async()=>{
 const base=server.origin+'/culture-taste-daily';
 for(const theme of ['field','coral','analog']){
  const c=await browser.newContext({reducedMotion:'reduce'});await c.route(/^https:\/\//,r=>r.abort());const p=await c.newPage();
  for(const [width,height] of [[320,568],[390,844],[430,932],[768,1024],[844,390],[1440,900]]){
   await p.setViewportSize({width,height});await p.goto(base+'/?theme='+theme);
   const geometry=await p.evaluate(()=>{
    const box=e=>{const r=e.getBoundingClientRect();return {y:r.y,height:r.height,width:r.width,right:r.right};};
    return {links:[...document.querySelectorAll('.masthead nav a')].map(box),header:box(document.querySelector('.masthead')),cover:box(document.querySelector(document.documentElement.dataset.theme==='analog'?'.television':'.home-hero')),overflow:document.documentElement.scrollWidth-innerWidth};
   });
   assert.equal(geometry.overflow,0,`${theme} ${width}: document overflow`);
   assert.equal(geometry.links.length,2);assert.equal(new Set(geometry.links.map(x=>x.y)).size,1,`${theme} ${width}: wrapped action`);
   for(const link of geometry.links){assert.ok(link.height>=44);assert.ok(link.width>=44);assert.ok(link.right<=width);}
   if(width<=479){
    assert.ok(geometry.header.height<=92);assert.ok(geometry.cover.y<=108);assert.equal(await p.locator('.reading-start').count(),0);
    const cover=theme==='analog'?'.broadcast-cover':'.home-hero';
    const heading=p.locator(cover+' h1');assert.ok(await heading.evaluate(e=>parseFloat(getComputedStyle(e).fontSize)<=48));
    if(theme==='analog'){
     const art=await p.locator('.broadcast-art').boundingBox(),paragraph=await p.locator('.broadcast-position').boundingBox();
     assert.ok(paragraph.y>=art.y+art.height);assert.ok(paragraph.width>art.width);
     assert.equal(await p.locator('.broadcast-art').evaluate(e=>getComputedStyle(e).float),'none');
    }
   }
  }
  await p.setViewportSize({width:390,height:844});
  for(const route of ['/','/archive/',index.issues.at(-1).url,index.articles[0].url]){
   await p.goto(base+route+'?theme='+theme);
   const header=p.locator('.masthead');assert.ok((await header.boundingBox()).height<=92);if(route===index.articles[0].url){assert.equal(await p.locator('.article-aside').isVisible(),false);assert.ok(await p.locator('.mobile-original-edition').isVisible());assert.ok((await p.locator('.article-header').boundingBox()).y<260);}
   await p.evaluate(()=>scrollTo(0,450));const frame=await header.boundingBox();assert.ok(frame.y>=0&&frame.y<=16);
   await p.locator('[data-open-dialog]').focus();await p.keyboard.press('Enter');assert.ok(await p.locator('#room-dialog').isVisible());await p.keyboard.press('Escape');
  }
  await p.goto(base+'/?theme='+theme);await p.getByRole('navigation',{name:'主要导航'}).getByRole('link',{name:'往期档案'}).click();assert.match(p.url(),/\/archive\//);assert.equal(await p.locator('html').getAttribute('data-theme'),theme);
  await p.getByRole('navigation',{name:'主要导航'}).getByRole('link',{name:'本期选读'}).click();assert.match(p.url(),/#[^?]*stories/);assert.ok(await p.locator('#stories').isVisible());
  await c.close();
 }
});

test('mobile browsing is two columns in every room, with single-row channel and category controls',async()=>{
 const base=server.origin+'/culture-taste-daily';
 for(const theme of ['field','coral','analog']){
  const c=await browser.newContext();await c.route(/^https:\/\//,r=>r.abort());const p=await c.newPage();
  for(const width of [320,390,430]){
   await p.setViewportSize({width,height:844});await p.goto(base+'/?theme='+theme);
   assert.equal(await p.locator('.category-board').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),2);assert.ok(await p.locator('.category-board .entry-label').first().isVisible());assert.equal(await p.locator('.category-board figcaption').first().evaluate(e=>getComputedStyle(e).flexWrap),'nowrap');
   assert.equal(new Set(await p.locator('[data-home-category]').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().y))).size,1);
   if(theme==='analog'){
    assert.match(await p.locator('[data-channel="0"]').innerText(),/封面/);
    assert.equal(await p.locator('.tv-zap').count(),0);
    assert.equal(new Set(await p.locator('[data-channel]').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().y))).size,1);
    assert.ok((await p.locator('.tv-guide').boundingBox()).y<(await p.locator('.tv-stage').boundingBox()).y);
    await p.locator('[data-channel="1"]').click();assert.ok(await p.locator('.broadcast-story').isVisible());assert.equal(await p.locator('[data-channel="1"]').getAttribute('aria-pressed'),'true');
    await p.locator('[data-channel="0"]').click();assert.ok(await p.locator('.broadcast-cover').isVisible());
   }
   await p.getByRole('navigation',{name:'主要导航'}).getByRole('link',{name:'往期档案'}).click();await p.locator('[data-view="articles"]').click();
   assert.equal(await p.locator('.article-catalog').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),2);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0);
  }
  await c.close();
 }
});

test('a long explicitly synthetic TV schedule stays on one rail and keyboard selection remains visible',async()=>{
 const c=await browser.newContext({viewport:{width:320,height:568}});await c.route(/^https:\/\//,r=>r.abort());const p=await c.newPage();
 let html=await readFile(path.join(temp,'culture-taste-daily/index.html'),'utf8');
 const count=index.issues.at(-1).stories+1;
 const templates=Array.from({length:10},(_,i)=>`<template data-channel-template="${count+i}"><h1>SYNTHETIC CHANNEL ${i}</h1></template>`).join('');
 const buttons=Array.from({length:10},(_,i)=>`<button data-channel="${count+i}" aria-pressed="false">TEST ${i}</button>`).join('');
 html=html.replace('</body>',templates+'</body>').replace(/(<div class="tv-channel-buttons"[^>]*>)([\s\S]*?)(<\/div>)/,(_,a,b,d)=>a+b+buttons+d);
 await p.route('**/culture-taste-daily/?theme=analog',r=>r.fulfill({contentType:'text/html',body:html}));
 await p.goto(server.origin+'/culture-taste-daily/?theme=analog');await p.locator('[data-channel="0"]').focus();await p.keyboard.press('End');
 const visible=await p.locator('.tv-channel-buttons').evaluate(e=>{const r=e.getBoundingClientRect(),s=e.querySelector('[aria-pressed=true]').getBoundingClientRect();return {left:s.left>=r.left-1,right:s.right<=r.right+1,overflow:document.documentElement.scrollWidth-innerWidth};});
 assert.deepEqual(visible,{left:true,right:true,overflow:0});assert.match(await p.locator('.tv-stage').innerText(),/SYNTHETIC CHANNEL 9/);await c.close();
});
