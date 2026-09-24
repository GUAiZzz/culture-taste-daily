import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {mkdtemp,mkdir,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {approvedIssues} from '../scripts/lib/production.mjs';
const root=process.cwd();
test('approved publication matches locked content and all five local official assets',async()=>{
 const config=await approvedIssues(root);assert.equal(config.issues.length,1);assert.equal(config.issues[0].date,'2026-09-08');assert.equal(config.issues[0].images.length,5);
});
test('publication fails closed when approval, reviewed content or image changes',async()=>{
 const temp=await mkdtemp(path.join(os.tmpdir(),'ct-publication-'));
 try{
 await mkdir(path.join(temp,'deployment'),{recursive:true});await mkdir(path.join(temp,'src/issues'),{recursive:true});
 await cp(path.join(root,'src/issues/2026-09-08'),path.join(temp,'src/issues/2026-09-08'),{recursive:true});
 const registry=await readFile(path.join(root,'deployment/production-issues.json'),'utf8');
 const config=JSON.parse(registry);
 const future=JSON.parse(registry);future.issues[0].date='2026-09-09';
 await writeFile(path.join(temp,'deployment/production-issues.json'),JSON.stringify(future));await assert.rejects(approvedIssues(temp),/PRODUCTION_APPROVAL_SCOPE/);
 config.issues[0].approved_by='unverified';
 await writeFile(path.join(temp,'deployment/production-issues.json'),JSON.stringify(config));await assert.rejects(approvedIssues(temp),/PRODUCTION_APPROVAL/);
 await writeFile(path.join(temp,'deployment/production-issues.json'),registry);
 const content=path.join(temp,'src/issues/2026-09-08/content.md'),original=await readFile(content);
 await writeFile(content,'changed');await assert.rejects(approvedIssues(temp),/PRODUCTION_REVIEW_CHANGED/);await writeFile(content,original);
 await writeFile(path.join(temp,'src/issues/2026-09-08',config.issues[0].images[0].asset),'changed');await assert.rejects(approvedIssues(temp),/PRODUCTION_ASSET/);
 }finally{await rm(temp,{recursive:true,force:true});}
});
