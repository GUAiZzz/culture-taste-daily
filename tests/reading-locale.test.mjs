import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { preferredLocale, localeHeadScript, localeCriticalCSS } from '../core/rooms/reading-locale.mjs';
import { parseStoryContent, paragraphCount, loadReadingModel, englishReadingKind } from '../core/rooms/reading-content.mjs';
const repoRoot=new URL('../',import.meta.url).pathname;
const issueDir=new URL('../src/issues/2026-10-28/',import.meta.url);
const raw=await readFile(new URL('content.md',issueDir),'utf8');
const manifest=JSON.parse(await readFile(new URL('issue-manifest.public.json',issueDir),'utf8'));
const locale=JSON.parse(await readFile(new URL('reading-locale.public.json',issueDir),'utf8'));
const correction=JSON.parse(await readFile(new URL('./fixtures/2026-10-28-English-correction.public.json',import.meta.url),'utf8'));
const hashText=value=>createHash('sha256').update(value).digest('hex');
const sections=raw.split(/^## /m).slice(1).map(section=>section.slice(section.indexOf('\n')+1).trim());
const parse=index=>parseStoryContent(sections[index],manifest.stories[index].english);

test('locale bootstrap and later preferences keep the existing local/session precedence',()=>{
 assert.equal(preferredLocale(name=>name==='localStorage'?'{"language":"en"}':'{"language":"zh"}'),'en');
 assert.equal(preferredLocale(name=>name==='localStorage'?'{"language":"invalid"}':'{"language":"en"}'),'zh');
 assert.equal(preferredLocale(name=>name==='localStorage'?'broken':'{"language":"en"}'),'en');
 assert.equal(preferredLocale(()=>{throw new Error('blocked');}),'zh');
 assert.equal(preferredLocale(()=>null),'zh');
 const root={dataset:{titleEn:'English title'},lang:'zh-CN'};
 const document={documentElement:root,title:'中文'};
 vm.runInNewContext(localeHeadScript,{document,window:{localStorage:{getItem:()=>'{"language":"en"}'},sessionStorage:{getItem:()=>null}}});
 assert.equal(root.dataset.locale,'en');assert.equal(root.lang,'en');assert.equal(document.title,'English title');
 assert.match(localeCriticalCSS,/html\[data-locale="en"\]/);
 assert.doesNotMatch(localeCriticalCSS,/(?<!data-)\[lang=/,'original source language must never be a hiding selector');
});

test('source boundaries separate all three source-heading forms without changing prose',()=>{
 const formats=['来源：','来源 / Sources:','Sources:'];
 for(const heading of formats){
  const parsed=parseStoryContent(`### 中文\n\n保留原段。\n\n### English\n\nPreserve the original paragraph.\n\n${heading}\n\n- [Exact source](https://example.org/source)`);
  assert.equal(parsed.zhMarkdown,'保留原段。');assert.equal(parsed.enMarkdown,'Preserve the original paragraph.');assert.equal(parsed.sourceBlocks.length,1);assert.match(parsed.sourcesMarkdown,/https:\/\/example.org\/source/);
 }
 const before=parseStoryContent('### 中文\n\n甲。\n\n来源：\n\n- [A](https://example.org/a)\n\n### English\n\nA.\n\nSources:\n\n- [A](https://example.org/a)');
 assert.equal(before.enMarkdown,'A.');assert.equal(before.sourceBlocks.length,2);
 assert.match(before.enSourcesMarkdown,/https:\/\/example.org\/a/);
});

test('corrected issue is exactly locked and every original citation remains bound',()=>{
 const hash=createHash('sha256').update(raw).digest('hex');
 assert.equal(hash,correction.correctedContentSha256);
 assert.notEqual(hash,correction.oldContentSha256);
 assert.equal(hash,manifest.content_lock.sha256);assert.equal(locale.sourceContentSha256,hash);
 assert.equal(manifest.stories.length,10);
 let citationCount=0;
 manifest.stories.forEach((story,index)=>{
  const parsed=parse(index);assert.ok(parsed.zhMarkdown);assert.ok(parsed.enMarkdown);
  assert.doesNotMatch(parsed.enMarkdown,/^(?:来源(?:\s*\/\s*Sources)?[：:]|Sources:)\s*$/mi);
  const originalURLs=new Set(parsed.sourceBlocks.flatMap(block=>[...block.markdown.matchAll(/\]\((https?:\/\/[^\s)]+)\)/g)].map(match=>match[1])));
  for(const url of originalURLs)assert.ok(story.sources.some(source=>source.url===url),`unbound citation ${story.id}: ${url}`);
  assert.equal(new Set(story.sources.map(source=>source.url)).size,story.sources.length);
  citationCount+=story.sources.length;
 });
 assert.equal(citationCount,102);
 assert.equal(parse(9).enMarkdown.includes('来源 / Sources:'),false);
 assert.equal(parse(8).enMarkdown.includes('Sources:'),false);
 assert.equal([...parse(8).enSourcesMarkdown.matchAll(/\]\((https?:\/\/[^\s)]+)\)/g)].length,10);
 assert.equal(parse(9).sourceBlocks[0].language,'shared');
});

test('Apple now has the authorized seven-paragraph full English reading body',async()=>{
 const dailyRadar=JSON.parse(await readFile(new URL('daily-radar.public.json',issueDir),'utf8'));
 const model=await loadReadingModel({repoRoot,validatedIssues:[{issueId:'2026-10-28',manifest,content:raw,dailyRadar}],publicationIssues:[]});
 const apple=model.latest.stories[5];
 assert.equal(apple.englishKind,'full');assert.equal(paragraphCount(apple.enMarkdown),7);assert.equal(paragraphCount(apple.zhMarkdown),7);assert.equal(apple.enMarkdown.split(/\s+/).length,524);
 assert.match(apple.enMarkdown,/closed on October 25/);
 assert.match(apple.enMarkdown,/not a finding about visitor response or the exhibition's impact/);
 assert.equal(apple.zhMarkdown,parse(5).zhMarkdown);
 assert.equal(model.latest.stories.filter(story=>story.inlineMedia.length).length,2);
 for(const story of model.latest.stories){assert.ok(story.locale.summaryEn);assert.ok(story.locale.captionEn);for(const image of story.inlineMedia){assert.ok(image.locale.altEn);assert.ok(image.locale.captionEn);assert.ok(image.locale.creditEn);}}
});

test('the existing Apple abstract exception never lowers future full-English requirements',()=>{
 assert.throws(()=>englishReadingKind({date:'2026-10-29',storyId:'apple-designers-of-tomorrow-paris-2026',contentSha256:locale.sourceContentSha256,hasBody:true,requestedKind:'abstract'}),/requires full English/);
 assert.throws(()=>englishReadingKind({date:'2026-10-28',storyId:'apple-designers-of-tomorrow-paris-2026',contentSha256:'new-content-lock',hasBody:true,requestedKind:'abstract'}),/requires full English/);
 assert.equal(englishReadingKind({date:'2026-10-27',storyId:'old-story',hasBody:false}), 'abstract');
});


test('English correction preserves every Chinese body, the other nine English bodies, metadata and source indexes',()=>{
 assert.equal(hashText(raw.split(/^## /m)[0]),correction.introSha256);
 assert.equal(hashText(JSON.stringify(manifest.stories)),correction.storiesMetadataSha256);
 assert.deepEqual(raw.split(/^## /m).slice(11),correction.trailingSections);
 for(const [index,guard] of correction.storyGuards.entries()){
  assert.equal(manifest.stories[index].id,guard.id);assert.equal(manifest.stories[index].title,guard.title);
  const actual=parse(index);assert.equal(hashText(actual.zhMarkdown),guard.zhMarkdownSha256);
  assert.equal(hashText(actual.sourcesMarkdown),guard.sourcesMarkdownSha256);assert.equal(hashText(actual.enSourcesMarkdown),guard.enSourcesMarkdownSha256);
  if(index!==5){assert.equal(hashText(actual.enMarkdown),guard.enMarkdownSha256);assert.equal(hashText(sections[index]),guard.sectionMarkdownSha256);}
 }
});

test('full English preserves every Apple paragraph citation sequence and bounded material detail',()=>{
 const apple=parse(5),zh=apple.zhMarkdown.split('\n\n'),en=apple.enMarkdown.split('\n\n');
 const citations=value=>[...value.matchAll(/\[(\d+)\]\((https?:\/\/[^\s)]+)\)/g)].map(m=>[m[1],m[2]]);
 assert.equal(zh.length,7);assert.equal(en.length,7);
 en.forEach((paragraph,index)=>assert.deepEqual(citations(paragraph),citations(zh[index])));
 for(const text of ['Isabel Rower','Padded Chair 1860','more than 1,500','Box Works','Yoonjeong Lee','New Form','approximately 5,000','Salem S. Charabi','The Emergence of Light','Parafernalia','MonoAmbiente 1','different projects','editorial reading'])assert.ok(apple.enMarkdown.includes(text),text);
});

test('the frozen historical abstract fixture remains honest without exempting the new correction',()=>{
 assert.equal(hashText(correction.oldAppleEnglish),correction.oldAppleEnglishSha256);
 assert.equal(correction.oldAppleEnglish.split(/\s+/).length,41);assert.equal(paragraphCount(correction.oldAppleEnglish),1);
 assert.equal(englishReadingKind({date:'2026-10-28',storyId:'apple-designers-of-tomorrow-paris-2026',contentSha256:correction.oldContentSha256,hasBody:true,requestedKind:'abstract'}),'abstract');
 assert.throws(()=>englishReadingKind({date:'2026-10-28',storyId:'apple-designers-of-tomorrow-paris-2026',contentSha256:correction.correctedContentSha256,hasBody:true,requestedKind:'abstract'}),/requires full English/);
});
