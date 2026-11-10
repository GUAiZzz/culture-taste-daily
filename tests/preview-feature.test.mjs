import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {buildSite} from '../scripts/lib/build.mjs';
import {loadPreviewReading} from '../core/rooms/preview-reading.mjs';

const root=path.resolve(import.meta.dirname,'..');
let temp,out,feature,index,home;
before(async()=>{
 temp=await mkdtemp(path.join(os.tmpdir(),'ct-preview-native-'));
 out=path.join(temp,'site');
 await buildSite({repoRoot:root,outDir:out,baseUrl:'https://guaizzz.github.io/culture-taste-daily/'});
 feature=JSON.parse(await readFile(path.join(root,'src/preview-features/2026-11-10.json'),'utf8'));
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
 }
 const provenance=JSON.parse(await readFile(path.join(out,'provenance.json'),'utf8'));
 assert.equal(provenance.issues.at(-1).date,index.issues.filter(issue=>issue.status!=='preview').at(-1).date);
 assert.equal(provenance.preview_features[0].status,'sources_and_image_rights_under_review');
 assert.equal(provenance.preview_articles,34);
});
