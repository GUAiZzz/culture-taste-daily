import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requestOriginUrl, externalPreviewConsoleOrigin } from '../scripts/lib/preview-network-diagnostics.mjs';
const official='https://official.example/image.jpg', filtered='http://filter.example/blocked';
const context={imageResources:new Map([[official,official],[filtered,official]]),declaredUrls:new Set([official]),siteOrigin:'http://127.0.0.1:4321'};
test('a traced declared image header diagnostic is retained as external-media evidence',()=>{
  assert.equal(externalPreviewConsoleOrigin({...context,text:`Clear-Site-Data header on '${filtered}': Not supported for insecure origins.`,locationUrl:''}),official);
});
test('application errors and local script messages remain page failures',()=>{
  assert.equal(externalPreviewConsoleOrigin({...context,text:'TypeError: article navigation failed',locationUrl:official}),null);
  assert.equal(externalPreviewConsoleOrigin({...context,text:`Clear-Site-Data header on '${filtered}': example`,locationUrl:'http://127.0.0.1:4321/site.js'}),null);
});
test('scripts-disabled document attribution requires the same traced image diagnostic',()=>{
  assert.equal(externalPreviewConsoleOrigin({...context,javaScriptEnabled:false,
    text:`Clear-Site-Data header on '${filtered}': Not supported for insecure origins.`,locationUrl:'http://127.0.0.1:4321/archive/'}),official);
  assert.equal(externalPreviewConsoleOrigin({...context,javaScriptEnabled:false,
    text:'TypeError: article navigation failed',locationUrl:'http://127.0.0.1:4321/archive/'}),null);
});
test('untraced and undeclared resources cannot be exempted',()=>{
  assert.equal(externalPreviewConsoleOrigin({...context,text:`Clear-Site-Data header on 'http://unknown.example/': example`,locationUrl:''}),null);
  assert.equal(externalPreviewConsoleOrigin({...context,declaredUrls:new Set(),text:'Failed to load resource: network failure',locationUrl:filtered}),null);
});
test('failed-image redirects retain the original official URL',()=>{
  const first={url:()=>official,redirectedFrom:()=>null};
  const last={url:()=>filtered,redirectedFrom:()=>first};
  assert.equal(requestOriginUrl(last),official);
});
