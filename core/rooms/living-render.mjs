import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {escapeHtml as esc} from './reading-content.mjs';
import {renderBookmarks} from './lower-home.mjs';

const pair=(zh,en)=>`<span data-locale-variant="zh">${esc(zh)}</span><span data-locale-variant="en" lang="en">${esc(en)}</span>`;
const category={fashion:['时装','Fashion'],music:['音乐','Music'],objects:['物件','Objects'],city:['城市','City']};
const safeJson=value=>JSON.stringify(value).replaceAll('<','\\u003c').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');
const number=n=>String(n).padStart(2,'0');

export async function livingEditionMarkup({repoRoot,issue,variant='space'}){
 if(!['record','space'].includes(variant))throw new Error('CT_LIVING_EDITION must be record or space');
 let experience;
 try{experience=JSON.parse(await readFile(path.join(repoRoot,'src/issues',issue.date,'edition-experience.public.json'),'utf8'));}
 catch(error){if(error.code!=='ENOENT')throw error;experience={version:1,issueId:issue.date,revision:issue.hash.slice(0,12),initialStoryId:issue.stories[0]?.id,visualThesis:issue.position,stories:[]};}
 if(experience.version!==1||experience.issueId!==issue.date)throw new Error('Invalid edition experience identity');
 const ids=new Set(issue.stories.map(s=>s.id));
 if(experience.stories.some(s=>!ids.has(s.id))||new Set(experience.stories.map(s=>s.id)).size!==experience.stories.length)throw new Error('Invalid edition experience story binding');
 const stories=issue.stories.map(story=>{
  const art=experience.stories.find(s=>s.id===story.id)||{};
  const palette=art.palette||['#d6ddcb','#93a39a','#cfb68e'];
  if(palette.length!==3||!palette.every(c=>/^#[0-9a-f]{6}$/i.test(c)))throw new Error('Invalid ambient palette');
  const ratio=Number(art.aspectRatio)||1.6;
  if(ratio<0.2||ratio>5)throw new Error('Invalid image ratio');
  const imageRights=story.media.usage_rights||(story.media.rights_basis==='preview_user_authorized_external'?'unknown':issue.preview?'placeholder':null);
  return {id:story.id,index:story.index,titleZh:story.title,titleEn:story.english.title,category:story.category,issueUrl:issue.url+'#story-'+story.id,image:story.media.external_image_url,imageRights,fallback:'/issues/'+issue.date+'/'+story.media.asset,alt:story.media.alt,altZh:story.locale?.altZh||story.media.caption||story.media.alt,altEn:story.locale?.altEn||story.media.alt,ratio,palette,treatment:art.treatment||'photograph',paletteBasis:art.paletteBasis||'edition-default'};
 });
 const initial=Math.max(0,stories.findIndex(s=>s.id===experience.initialStoryId));
 issue.livingExperience={revision:experience.revision,stories:stories.map(s=>({id:s.id,palette:s.palette}))};
 const config={version:1,issueId:issue.date,revision:experience.revision,contentSha256:issue.hash,variant,initialIndex:initial,stories};
 if(!stories.length)return `<section class="living-empty"><h1>${pair('本期暂不可用','This edition is unavailable')}</h1><a href="/archive/">${pair('浏览往期','Browse the archive')}</a></section>`;
 const artwork=stories.map((s,i)=>{
  const near=Math.abs(i-initial)<=1;
  const image=s.image?`<img class="living-official" data-external-preview="true" src="${esc(s.image)}" alt="${esc(s.altZh)}" data-l10n-alt-zh="${esc(s.altZh)}" data-l10n-alt-en="${esc(s.altEn)}" width="${Math.round(1000*s.ratio)}" height="1000" loading="${near?'eager':'lazy'}" fetchpriority="${i===initial?'high':'auto'}" decoding="async" referrerpolicy="no-referrer">`:'';
  // Far artwork is inert until approached. No-JS still has real linked images.
  const source=!image?'':near?image:`<template data-living-image>${image}</template><noscript>${image}</noscript>`;
  return `<a class="living-art" data-visual-frame data-preview-navigation="edition-story" href="${esc(s.issueUrl)}" data-internal data-living-entry="story" data-story-id="${s.id}" data-index="${i}" data-art-treatment="${esc(s.treatment)}" style="--art-index:${i};--art-ratio:${s.ratio}" aria-label="${esc(s.titleZh)}" data-l10n-aria-label-zh="${esc(s.titleZh)}" data-l10n-aria-label-en="${esc(s.titleEn)}"><span class="living-art-surface"><img class="living-fallback" src="${esc(s.fallback)}" alt="" aria-hidden="true" width="1200" height="720">${source}<span class="living-art-error photo-fallback">${pair('官方图像暂不可用 · 非纪实回退图','Official image unavailable · editorial fallback')}</span></span></a>`;
 }).join('');
 const current=stories[initial];
 const rights=current.imageRights==='public_domain'?pair('公有领域图像','Public-domain image'):current.imageRights==='unknown'?pair('图片使用依据待核验','Image-use rights under review'):current.imageRights==='placeholder'?pair('非纪实编辑配图','Non-documentary illustration'):'';
 const full=`<a class="living-read-edition" href="${esc(issue.url)}" data-internal data-living-entry="edition">${pair('阅读完整一期','Read the full edition')}<span aria-hidden="true">↗</span></a>`;

 return `<section class="living-edition" data-living-edition data-variant="${variant}" data-issue-id="${issue.date}" aria-labelledby="living-title" style="--living-initial-q:${initial};--ambient-a:var(--living-restored-ambient-a,${current.palette[0]});--ambient-b:var(--living-restored-ambient-b,${current.palette[1]});--ambient-c:var(--living-restored-ambient-c,${current.palette[2]})"><div class="living-ambient" aria-hidden="true"><i></i><i></i><i></i></div><header class="living-heading"><div class="living-heading-copy"><p class="living-edition-date"><time datetime="${issue.date}" data-locale-date="${issue.date}">${issue.date}</time><span aria-hidden="true"> / </span>${pair('本期合集 · '+stories.length+' 篇文章',"This edition · "+stories.length+' stories')}</p><h1 id="living-title"><a href="${esc(issue.url)}" data-internal data-living-entry="edition">${pair(issue.title,issue.en)}</a></h1></div>${full}</header><div class="living-stage" data-living-stage role="group" aria-label="${esc('浏览本期作品')}" data-l10n-aria-label-zh="浏览本期作品" data-l10n-aria-label-en="Browse this edition's artwork"><div class="living-surface" data-living-surface>${artwork}</div><span class="living-stage-rule" aria-hidden="true"></span></div><div class="living-current"><p class="living-current-meta"><span data-living-category>${pair(...category[current.category])}</span><span aria-hidden="true"> · </span><span data-living-number>${number(initial+1)} / ${number(stories.length)}</span></p><h2><a data-living-current href="${esc(current.issueUrl)}" data-internal data-living-entry="story" data-story-id="${current.id}">${pair(current.titleZh,current.titleEn)}</a></h2>${issue.preview||stories.some(story=>story.imageRights)?`<p class="living-rights" data-living-rights>${rights}</p>`:''}<p class="living-help">${pair('滑动浏览，点图片进入对应篇章','Browse the collection. Open any image to read its story.')}</p></div><div class="living-controls" role="group" aria-label="浏览作品" data-l10n-aria-label-zh="浏览作品" data-l10n-aria-label-en="Browse artwork"><button type="button" data-living-prev data-ct-control="icon" aria-label="上一件作品" data-l10n-aria-label-zh="上一件作品" data-l10n-aria-label-en="Previous artwork"><span aria-hidden="true">←</span></button><span class="living-position" data-living-position aria-live="off">${number(initial+1)}<span aria-hidden="true">—</span>${number(stories.length)}</span><button type="button" data-living-next data-ct-control="icon" aria-label="下一件作品" data-l10n-aria-label-zh="下一件作品" data-l10n-aria-label-en="Next artwork"><span aria-hidden="true">→</span></button></div><p class="sr-only" data-living-announcement role="status" aria-live="polite"></p><noscript><p class="living-nojs">${pair('所有文章均在下方索引，可直接阅读。官方图像不可用时，底图为非纪实编辑回退图。','Every story is available in the index below. If an official image is unavailable, its base is a non-documentary editorial fallback.')}</p></noscript><script type="application/json" id="living-config">${safeJson(config)}</script></section>${renderBookmarks(issue,stories)}`;
}
