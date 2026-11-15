import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {buildSite} from '../scripts/lib/build.mjs';
import {loadPreviewReading} from '../core/rooms/preview-reading.mjs';

const root=path.resolve(import.meta.dirname,'..');
let temp,out,feature,today,index,home;
before(async()=>{
 temp=await mkdtemp(path.join(os.tmpdir(),'ct-preview-native-'));
 out=path.join(temp,'site');
 await buildSite({repoRoot:root,outDir:out,baseUrl:'https://guaizzz.github.io/culture-taste-daily/'});
 feature=JSON.parse(await readFile(path.join(root,'src/preview-features/2026-11-10.json'),'utf8'));
 today=JSON.parse(await readFile(path.join(root,'src/preview-features/2026-11-11.json'),'utf8'));
 index=JSON.parse(await readFile(path.join(out,'content-index.json'),'utf8'));
 home=await readFile(path.join(out,'index.html'),'utf8');
});
after(async()=>{if(temp)await rm(temp,{recursive:true,force:true});});

test('native navigation presents the latest readable edition without the prior banner',async()=>{
 assert.equal(feature.stories.length,34);
 assert.equal(new Set(feature.stories.map(story=>story.id)).size,34);
 const latest=index.issues.at(-1);
 assert.ok(home.includes(`data-issue-date="${latest.date}"`));
 assert.doesNotMatch(home,/aria-label="11 月 10 日图文专题"/);
 if(latest.date===feature.date&&latest.status==='preview')for(const story of feature.stories)assert.ok(home.includes(`id="card-2026-11-10-${story.id}"`),story.id);
 const sameDate=index.issues.find(issue=>issue.date===feature.date);
 assert.ok(sameDate,'the date remains in the index');
 if(sameDate.status==='preview')assert.equal(sameDate.stories,34);
 const newDate=index.issues.find(issue=>issue.date===today.date);
 assert.ok(newDate,'the new date remains in the index');assert.equal(new Set(today.stories.map(story=>story.id)).size,22);
 if(newDate.status==='preview'){
  assert.equal(newDate.stories,22);
  if(latest.date===today.date)for(const story of today.stories)assert.ok(home.includes(`id="card-2026-11-11-${story.id}"`),story.id);
 }
 assert.ok(index.issues.some(issue=>issue.date==='2026-11-03'));
});

test('each preview story has native bilingual reading, a source and a visual fallback',async()=>{
 const sameDate=index.issues.find(issue=>issue.date===feature.date);
 if(sameDate.status!=='preview'){
  const legacy=await readFile(path.join(out,'assets/2026-11-10-feature.html'),'utf8');
  assert.match(legacy,/非正式 Preview/);
  assert.equal((await loadPreviewReading({repoRoot:root,outDir:path.join(temp,'replaced'),formalDates:[feature.date]})),null);
  return;
 }
 const issue=await readFile(path.join(out,'issues/2026-11-10/index.html'),'utf8');
 assert.equal((issue.match(/<article class="issue-story/g)||[]).length,34);
 for(const story of feature.stories){
  const html=await readFile(path.join(out,'issues/2026-11-10/stories',story.id,'index.html'),'utf8');
  assert.match(html,/data-reading-language="zh"/);
  assert.match(html,/data-reading-language="en"/);
  assert.match(html,/data-english-kind="full"/);
  assert.match(html,/来源和图片|资料与图片使用依据仍在核验/);
  assert.match(html,/noindex,nofollow/);
  assert.ok(html.includes('editorial-fallback.svg'),story.id);
  assert.ok(story.sources.some(source=>html.includes(source.url.replaceAll('&','&amp;'))),story.id);
  for(const image of story.images){
   const escaped=image.url.replaceAll('&','&amp;');
   const rendered=[...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].filter(match=>match[1]===escaped);
   assert.equal(rendered.length,1,`${story.id}: each image should be rendered once and shared between languages`);
  }
 }
 const provenance=JSON.parse(await readFile(path.join(out,'provenance.json'),'utf8'));
 assert.equal(provenance.issues.at(-1).date,index.issues.filter(issue=>issue.status!=='preview').at(-1).date);
 const expected=[feature,today].filter(item=>index.issues.find(issue=>issue.date===item.date)?.status==='preview');
 assert.deepEqual(provenance.preview_features.map(item=>[item.date,item.stories,item.status]),expected.map(item=>[item.date,item.stories.length,'sources_and_image_rights_under_review']));
 assert.equal(provenance.preview_articles,expected.reduce((count,item)=>count+item.stories.length,0));
});


test('the new edition retains all 22 complete bilingual stories, unique images and source-linked fallbacks',async()=>{
 const sameDate=index.issues.find(issue=>issue.date===today.date);
 if(sameDate.status!=='preview'){
  assert.equal(await loadPreviewReading({repoRoot:root,outDir:path.join(temp,'replaced-today'),formalDates:[today.date],featureDate:today.date,expectedCount:22}),null);
  return;
 }
 const issue=await readFile(path.join(out,'issues/2026-11-11/index.html'),'utf8');
 assert.equal((issue.match(/<article class="issue-story/g)||[]).length,22);
 const images=today.stories.flatMap(story=>story.images.map(image=>image.url));
 assert.equal(new Set(images).size,images.length,'different stories must not reuse the same image');
 for(const story of today.stories){
  const html=await readFile(path.join(out,'issues/2026-11-11/stories',story.id,'index.html'),'utf8');
  assert.match(html,/data-reading-language="zh"/);assert.match(html,/data-reading-language="en"/);
  assert.match(html,/data-english-kind="full"/);assert.match(html,/noindex,nofollow/);
  assert.match(html,/editorial-fallback\.svg/);
  assert.ok(story.sources.some(source=>html.includes(source.url.replaceAll('&','&amp;'))),story.id);
  for(const image of story.images){const escaped=image.url.replaceAll('&','&amp;');assert.equal([...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].filter(match=>match[1]===escaped).length,1,story.id);}
 }
});

test('preview pictures disclose their own rights next to the image without mislabelling public-domain images',async()=>{
 const issue=index.issues.find(item=>item.date===today.date);
 if(issue.status!=='preview')return;
 if(index.issues.at(-1).date===today.date)assert.match(home,/data-living-rights/);
 for(const story of today.stories){
  const html=await readFile(path.join(out,'issues/2026-11-11/stories',story.id,'index.html'),'utf8');
  const hero=html.match(/<figure class="photo image-frame reader-hero"[\s\S]*?<\/figure>/)?.[0];assert.ok(hero,story.id);
  if(!story.images.length){assert.match(hero,/非纪实编辑配图/);assert.doesNotMatch(hero,/data-image-rights=/);continue;}
  const image=story.images[0];
  assert.ok(hero.includes(`data-image-rights="${image.rights}"`),story.id);
  if(image.rights==='public_domain'){assert.match(hero,/公有领域图像/);assert.doesNotMatch(hero,/图片使用依据待核验/);assert.doesNotMatch(html,/本篇资料与图片使用依据仍在核验/);assert.match(html,/本篇资料仍在核验/);}
  else {assert.match(hero,/图片使用依据待核验/);assert.match(hero,/Image-use rights under review/);}
  assert.ok(hero.includes(image.origin.replaceAll('&','&amp;')),story.id);
 }
});

test('a published-preview issue discloses unknown external-image rights in the reader',async()=>{
 const manifest=JSON.parse(await readFile(path.join(root,'src/issues/2026-11-03/issue-manifest.public.json'),'utf8'));
 const story=manifest.stories.find(item=>item.media.rights_basis==='preview_user_authorized_external');
 assert.ok(story);
 const html=await readFile(path.join(out,'issues/2026-11-03/stories',story.id,'index.html'),'utf8');
 const hero=html.match(/<figure class="photo image-frame reader-hero"[\s\S]*?<\/figure>/)?.[0];
 assert.ok(hero);
 assert.match(hero,/data-image-rights="unknown"/);
 assert.match(hero,/图片使用依据待核验/);
 assert.ok(hero.includes(story.media.origin_url.replaceAll('&','&amp;')));
});
