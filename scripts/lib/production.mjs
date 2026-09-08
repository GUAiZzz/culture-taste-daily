import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {readJson,sha256File,fileDigestMap,digestMap,writeJson} from './files.mjs';
export async function approvedIssues(repoRoot){
 const config=await readJson(path.join(repoRoot,'deployment/production-issues.json'));
 if(config.schema_version!==1||config.repository!=='GUAiZzz/culture-taste-daily'||!Number.isSafeInteger(config.previous_good_run)||!config.issues.length)throw Error('PRODUCTION_AUTHORITY');
 // This owner instruction covers exactly one reviewed edition, not future production automation.
 if(config.issues.length!==1||config.issues[0].date!=='2026-09-08')throw Error('PRODUCTION_APPROVAL_SCOPE');
 const dates=new Set();
 for(const i of config.issues){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(i.date)||dates.has(i.date)||i.approval_basis!=='repository_owner_confirmed_publication_and_image_permission'||i.approved_by!=='repository_owner'||!Number.isFinite(Date.parse(i.recorded_at))||! /^[a-f0-9]{40}$/.test(i.reviewed_source_commit))throw Error('PRODUCTION_APPROVAL');dates.add(i.date);
  const dir=path.join(repoRoot,'src/issues',i.date),m=await readJson(path.join(dir,'issue-manifest.public.json'));
  if(await sha256File(path.join(dir,'content.md'))!==i.content_sha256||await sha256File(path.join(dir,'art-direction.json'))!==i.art_direction_sha256||await sha256File(path.join(dir,'issue.css'))!==i.issue_style_sha256||m.harrytone.commit!==i.harrytone_commit)throw Error('PRODUCTION_REVIEW_CHANGED');
  if(m.rights_summary.status!=='clear'||m.rights_summary.unknown_required_assets!==0||i.images.length!==m.stories.length||new Set(i.images.map(x=>x.story_id)).size!==m.stories.length)throw Error('PRODUCTION_RIGHTS');
  for(const s of m.stories){const a=i.images.find(x=>x.story_id===s.id);
   if(!a||!/^assets\/official-[a-z0-9-]+\.(jpg|png)$/.test(a.asset)||a.asset!==s.media.asset||s.media.external_image_url||s.media.rights_basis!=='documented_permission'||s.media.origin_authority!=='first_party_official'||!a.source_url.startsWith('https://')||await sha256File(path.join(dir,a.asset))!==a.sha256)throw Error('PRODUCTION_ASSET '+s.id);
  }
 }
 return config;
}
export async function finalizeProduction({repoRoot,distDir,report,config}){
 for(const i of config.issues){const r=report.issues.find(x=>x.issue_id===i.date);if(!r?.date_semantics.production_candidate_valid)throw Error('PRODUCTION_DATE');
  const m=await readJson(path.join(distDir,'issues',i.date,'issue-manifest.public.json'));m.visibility='published';m.status='PASS';await writeJson(path.join(distDir,'issues',i.date,'issue-manifest.public.json'),m);
  const original=path.join(distDir,'issues',i.date,'original-edition.html');let html=await readFile(original,'utf8');html=html.replaceAll('noindex,nofollow','index,follow').replaceAll('PREVIEW EDITION · NOT PRODUCTION','PUBLISHED EDITION');await writeFile(original,html);
  r.issue_payload_digest=digestMap(await fileDigestMap(path.dirname(original),{exclude:['issue-manifest.public.json']}));
  m.artifact_digests.issue_payload_sha256=r.issue_payload_digest;await writeJson(path.join(path.dirname(original),'issue-manifest.public.json'),m);
 }
 const dates=config.issues.map(x=>x.date).sort(),latest=dates.at(-1);
 const routes=['index.html',...config.issues.flatMap(i=>[`issues/${i.date}/index.html`,...i.images.map(x=>`issues/${i.date}/stories/${x.story_id}/index.html`)])];
 for(const route of routes){const html=await readFile(path.join(distDir,route),'utf8');if(!html.includes('PUBLISHED EDITION')||html.includes('noindex,nofollow')||/<img\b[^>]*src="https?:/i.test(html))throw Error('PRODUCTION_PAGE '+route)}
 const prefix=new URL(report.base_url).pathname.replace(/\/$/,'');
 await writeFile(path.join(distDir,'robots.txt'),`User-agent: *\nDisallow: ${prefix}/history/\nDisallow: ${prefix}/archive/\nDisallow: ${prefix}/issues/\n${dates.map(d=>`Allow: ${prefix}/issues/${d}/`).join('\n')}\nSitemap: ${report.base_url}sitemap.xml\n`);
 const urls=['',...config.issues.flatMap(i=>[`issues/${i.date}/`,...i.images.map(x=>`issues/${i.date}/stories/${x.story_id}/`)])];
 await writeFile(path.join(distDir,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u=>`<url><loc>${report.base_url}${u}</loc></url>`).join('')}</urlset>`);
 // Only approved editions enter the formal feed. Historical Preview remains accessible through the archive.
 let rss=await readFile(path.join(distDir,'rss.xml'),'utf8');rss=rss.replace(/<item>[\s\S]*?<\/item>/g,item=>dates.some(d=>item.includes(`/issues/${d}/`))?item:'').replace('Non-production Culture &amp; Taste preview','Culture &amp; Taste Daily');await writeFile(path.join(distDir,'rss.xml'),rss);
 await writeJson(path.join(distDir,'production-release.json'),{schema_version:1,kind:'approved_publication',latest_issue:latest,approved_issues:dates,approval_sha256:await sha256File(path.join(repoRoot,'deployment/production-issues.json')),previous_good_run:config.previous_good_run,routes,media:config.issues.flatMap(i=>i.images.map(x=>({path:`issues/${i.date}/${x.asset}`,sha256:x.sha256})))});
 report.scope='approved_publication_with_preserved_preview_archive';report.production_authority=false;report.owner_approved_issues=dates;report.artifact_files=await fileDigestMap(distDir,{exclude:['build-report.json']});report.artifact_digest=digestMap(report.artifact_files);await writeJson(path.join(distDir,'build-report.json'),report);
 return {dates,routes};
}
