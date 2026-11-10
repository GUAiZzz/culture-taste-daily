import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {categoryNames, escapeHtml as esc, renderMarkdown} from './reading-content.mjs';

const ID=/^[a-z0-9-]+$/;
function https(value){
 const url=new URL(value);
 if(url.protocol!=='https:'||url.username||url.password||!url.hostname.includes('.')) throw Error('Invalid preview source URL');
 return value;
}
function fallback(title,index){
 const palettes=[['#e9e2d7','#9bb0a6','#c77b65'],['#e9e0d2','#a8b2c4','#ac6755'],['#e6e4d7','#b8aa99','#71988c'],['#deded5','#c7ae9e','#839bb0']];
 const [background,a,b]=palettes[index%palettes.length];
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 720" role="img" aria-label="Non-documentary editorial illustration"><rect width="1200" height="720" fill="${background}"/><circle cx="850" cy="210" r="235" fill="${a}" opacity=".66"/><path d="M0 565 C260 390 480 620 720 465 S1020 390 1200 520 V720 H0Z" fill="${b}" opacity=".62"/><text x="65" y="88" font-family="sans-serif" font-size="24" letter-spacing="5" fill="#333c37">CULTURE &amp; TASTE / ${String(index+1).padStart(2,'0')}</text><text x="65" y="655" font-family="sans-serif" font-size="22" fill="#333c37">${esc(title)}</text></svg>`;
}

// A reader-facing provisional feature is separate from validated daily issues.
// It carries no formal research attestation, image-rights approval or lock.
export async function loadPreviewReading({repoRoot,outDir,formalDates=[]}){
 const file=path.join(repoRoot,'src/preview-features/2026-11-10.json');
 let raw;
 try{raw=await readFile(file,'utf8');}catch(error){if(error.code==='ENOENT')return null;throw error;}
 const feature=JSON.parse(raw);
 if(feature.schemaVersion!==1||feature.date!=='2026-11-10'||feature.status!=='preview'||!Array.isArray(feature.stories)||feature.stories.length!==34)throw Error('Invalid provisional feature identity');
 // Once a formally admitted issue exists for this date, it takes precedence;
 // the separately retained feature input must not overwrite its routes/assets.
 if(formalDates.includes(feature.date))return null;
 const ids=new Set();
 for(const field of ['title','titleEn','position','positionEn','noticeZh','noticeEn'])if(typeof feature[field]!=='string'||!feature[field].trim())throw Error(`Missing provisional feature ${field}`);
 const stories=[];
 for(const [index,item] of feature.stories.entries()){
  if(!ID.test(item.id||'')||ids.has(item.id)||item.index!==index||!categoryNames[item.category])throw Error('Invalid provisional story identity');
  ids.add(item.id);
  for(const field of ['title','titleEn','zhDeck','enDeck','zhMarkdown','enMarkdown'])if(typeof item[field]!=='string'||!item[field].trim())throw Error(`Missing provisional story ${field}: ${item.id}`);
  if(!Array.isArray(item.images)||!Array.isArray(item.sources)||!item.sources.length)throw Error(`Missing provisional source data: ${item.id}`);
  const sourceIds=new Set();
  const sources=item.sources.map(source=>{
   https(source.url);if(sourceIds.has(source.url))throw Error(`Repeated provisional source: ${item.id}`);sourceIds.add(source.url);
   if(!source.labelZh||!source.labelEn)throw Error(`Missing provisional source label: ${item.id}`);
   return {url:source.url,title:source.labelZh,publisher:'',labelEn:source.labelEn};
  });
  for(const image of item.images){https(image.url);https(image.origin);if(!image.caption||!image.alt||!image.credit||image.rights!=='unknown')throw Error(`Invalid provisional image: ${item.id}`);}
  const asset=`assets/${item.id}-editorial-fallback.svg`;
  await mkdir(path.join(outDir,'issues',feature.date,'assets'),{recursive:true});
  await writeFile(path.join(outDir,'issues',feature.date,asset),fallback(item.title,index),'utf8');
  const image=item.images[0];
  const media=image?{kind:'source_image',asset,origin_url:image.origin,external_image_url:image.url,caption:image.caption,alt:image.alt,credit:image.credit}:{kind:'editorial_placeholder',asset,origin_url:sources[0].url,external_image_url:'',caption:'非纪实编辑配图，作品图片待补。',alt:'非纪实编辑配图',credit:'Culture & Taste Daily'};
  const inlineMedia=item.images.slice(1).map(row=>({external_image_url:row.url,origin_url:row.origin,caption:row.caption,alt:row.alt,credit:row.credit,after_zh_paragraph:2,after_en_paragraph:2,locale:{captionEn:row.captionEn||'Image from the linked source; usage rights remain under review.',altEn:item.titleEn,creditEn:row.credit}}));
  stories.push({id:item.id,index,date:feature.date,title:item.title,english:{title:item.titleEn,deck:item.enDeck},locale:{summaryEn:item.enDeck,altZh:media.alt,altEn:image?item.titleEn:'Non-documentary editorial illustration',captionEn:image?(image.captionEn||'Image from the linked source; usage rights remain under review.'):'Editorial illustration; source image pending.'},category:item.category,intro:item.zhDeck,zhMarkdown:item.zhMarkdown,enMarkdown:item.enMarkdown,enHtml:renderMarkdown(item.enMarkdown),englishKind:'full',sources,sourceLabelsEn:Object.fromEntries(sources.map(source=>[source.url,source.labelEn])),sourceOriginalLanguageExceptions:[],sourcesMarkdown:'',enSourcesMarkdown:'',media,inlineMedia,image_credit:media.credit,url:`/issues/${feature.date}/stories/${item.id}/`,issueTitle:feature.title,preview:true});
 }
 const hash=createHash('sha256').update(raw).digest('hex');
 return {date:feature.date,title:feature.title,en:feature.titleEn,locale:{positionEn:feature.positionEn,introEn:feature.positionEn,closingEn:''},extraLocale:{},position:feature.position,intro:renderMarkdown(feature.position),stories,extras:[],cover:'',closing:'',hash,locked:null,raw,url:`/issues/${feature.date}/`,preview:true,noticeZh:feature.noticeZh,noticeEn:feature.noticeEn};
}
