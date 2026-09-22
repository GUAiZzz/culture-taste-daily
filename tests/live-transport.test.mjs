import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLiveTransport, LIVE_ORIGIN } from '../scripts/lib/live-transport.mjs';

test('live transport rejects external, encoded and traversal targets before requests', async () => {
  const t = createLiveTransport({ fetchImpl: () => { throw Error('Must not request'); } });
  for (const file of ['https://example.com/', '../x', '/x', '%2e%2e/x', 'a?x=1']) await assert.rejects(t.get(file), /LIVE_FILE_SCOPE/);
});
test('an HTTP failure remains a failure and never launches a browser', async () => {
  const t = createLiveTransport({ fetchImpl: async () => ({ ok: false, status: 404 }), launchBrowser: () => { throw Error('Must not launch'); } });
  await assert.rejects(t.get('index.html'), /HTTP 404/);
  assert.equal(t.events.length, 0);
});
test('network failure uses bounded browser fallback, preserves bytes and blocks external redirects', async () => {
  let calls=0, launches=0, current, guard, closed=false;
  const p={route:async(_,fn)=>{guard=fn},goto:async url=>{current=url;return {ok:()=>true,url:()=>current,body:async()=>Buffer.from('exact bytes')}} ,url:()=>current};
  const t=createLiveTransport({delays:[0,0],fetchImpl:async()=>{calls++;throw Error('connect timeout')},launchBrowser:async()=>{launches++;return {newPage:async()=>p,close:async()=>{closed=true}}}});
  assert.equal((await t.get('index.html')).toString(),'exact bytes');
  assert.equal(current,LIVE_ORIGIN);
  assert.equal((await t.get('archive/index.html')).toString(),'exact bytes');
  assert.equal(current,LIVE_ORIGIN+'archive/');
  assert.equal(calls,3);assert.equal(launches,1);assert.equal(t.events.length,1);
  let action;await guard({request:()=>({url:()=> 'https://example.com/security'}),continue:()=>{action='continue'},abort:()=>{action='abort'}});assert.equal(action,'abort');
  p.goto=async()=>{current=LIVE_ORIGIN+'unexpected.html';return {ok:()=>true,url:()=>current}};
  await assert.rejects(t.get('index.html'),/ROUTE_MISMATCH/);
  await t.close();assert.ok(closed);
});
