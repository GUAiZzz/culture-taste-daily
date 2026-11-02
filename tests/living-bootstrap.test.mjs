import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../core/rooms/living-bootstrap.js',import.meta.url),'utf8');
function boot(raw,{state={},search='?ctroot=t'}={}){
 const properties=new Map(),root={dataset:{pageType:'home',livingIssueId:'2026-10-28',livingRevision:'r1',livingStoryIds:'a,b,c',livingPalettes:'#111111,#222222,#333333;#444444,#555555,#666666;#777777,#888888,#999999'},style:{setProperty:(k,v)=>properties.set(k,v)}};
 vm.runInNewContext(source,{document:{documentElement:root},sessionStorage:{getItem:()=>raw},history:{state},location:{search,href:'https://preview.test/site/'+search,origin:'https://preview.test',pathname:'/site/'},URL,URLSearchParams,Date});
 return {properties,root};
}
const scene=extras=>({token:'t',mode:'home',createdAt:Date.now(),issueId:'2026-10-28',revision:'r1',entryKind:'story',clickedStoryId:'b',activeStoryId:'a',q:0,url:'https://preview.test/site/',...extras});
test('head ignores null/primitive/corrupt context records without blocking static paint',()=>{
 for(const raw of ['[null,false,0,"bad",{}]','{invalid','null','42'])assert.doesNotThrow(()=>boot(raw));
 assert.equal(boot('[null]').properties.has('--living-restored-q'),false);
});
test('head pending side selection restores current integer and current palette',()=>{
 const {properties}=boot(JSON.stringify([null,scene()]));
 assert.equal(properties.get('--living-restored-q'),'1');assert.equal(properties.get('--living-restored-ambient-a'),'#444444');
});
test('head edition elasticity clamps to nearest edge rather than initial artwork',()=>{
 assert.equal(boot(JSON.stringify([scene({entryKind:'edition',q:2.2})])).properties.get('--living-restored-q'),'2');
 assert.equal(boot(JSON.stringify([scene({entryKind:'edition',q:-.2})])).properties.get('--living-restored-q'),'0');
});
test('consumed origins do not override the latest independent browse history',()=>{
 const browse={createdAt:Date.now(),issueId:'2026-10-28',revision:'r1',q:2,activeStoryId:'c',ambientPalette:['#777777','#888888','#999999']};
 assert.equal(boot(JSON.stringify([scene()]),{state:{ctLivingBrowse:browse},search:''}).properties.get('--living-restored-q'),'2');
});
