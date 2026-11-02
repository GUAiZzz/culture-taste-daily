import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../core/rooms/reading-feedback.js',import.meta.url),'utf8');
function policy(verifiedEvents=[]){let time=0;const window={};vm.runInNewContext(source,{window,performance:{now:()=>time}});return {request:window.CTFeedbackPolicy.create({clock:()=>time,verifiedEvents}).request,at:value=>{time=value;}};}
test('feedback is first-immediate, merges a commit for 80 ms and cools globally for 120 ms',()=>{
 const p=policy();assert.equal(p.request('tap',{commitId:'a'}).allowed,true);
 p.at(79);assert.equal(p.request('navigation',{commitId:'a'}).reason,'same-commit');
 p.at(80);assert.equal(p.request('tap',{commitId:'b'}).reason,'global-cooldown');
 p.at(120);assert.equal(p.request('tap',{commitId:'b'}).allowed,true);
});
test('asynchronous feedback requires event-specific platform verification',()=>{
 const p=policy();for(const event of ['selection.step','boundary','snap.complete'])assert.equal(p.request(event,{velocity:0,side:'start',gestureId:'g'}).reason,'unverified-event');
});
test('verified selection has 250 ms cooldown and at most four events in each half-open second',()=>{
 const p=policy(['selection.step']);assert.equal(p.request('selection.step',{velocity:2.01}).reason,'fast-selection');
 for(const time of [0,250,500,750]){p.at(time);assert.equal(p.request('selection.step',{velocity:2}).allowed,true);}
 p.at(999);assert.equal(p.request('selection.step',{velocity:1}).allowed,false);
 p.at(1000);assert.equal(p.request('selection.step',{velocity:1}).allowed,true);
});
test('boundary rearm requires 12px inward movement and a different gesture',()=>{
 const p=policy(['boundary']);assert.equal(p.request('boundary',{side:'left',gestureId:'g1'}).allowed,true);
 p.at(130);assert.equal(p.request('boundary',{side:'start',gestureId:'g1'}).reason,'boundary-latched');
 p.request('boundary.rearm',{side:'left',insidePx:11.9});p.at(260);assert.equal(p.request('boundary',{side:'left',gestureId:'g2'}).reason,'boundary-latched');
 p.request('boundary.rearm',{side:'start',insidePx:12});p.at(390);assert.equal(p.request('boundary',{side:'start',gestureId:'g1'}).reason,'boundary-latched');
 assert.equal(p.request('boundary',{side:'start',gestureId:'g2'}).allowed,true);
});
