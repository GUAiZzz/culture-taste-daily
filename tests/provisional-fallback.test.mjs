import {test} from 'node:test';
import assert from 'node:assert/strict';
import {declaredPreviewMedia,verifiedPreviewFallback} from '../scripts/lib/preview-fallback.mjs';

test('provisional image fallback stays bound to its exact source and story without claiming rights',()=>{
 const image={url:'https://cdn.example/photo.jpg',origin:'https://artist.example/event',alt:'An image',caption:'A caption',credit:'Credit',rights:'unknown'};
 const feature={schemaVersion:1,status:'preview',date:'2026-11-10',stories:[{id:'example-story',images:[image]}]};
 const origins=declaredPreviewMedia([],[],{},{},[feature]);
 const fact={url:image.url,external_preview:true,loaded:false,settled:true,alt:image.alt,fallback:{visible:true,text:'Source image unavailable',links:[{href:image.origin,visible:true}]}};
 assert.equal(verifiedPreviewFallback(fact,origins),true);
 assert.equal(verifiedPreviewFallback({...fact,url:'https://other.example/photo.jpg'},origins),false);
 assert.equal(verifiedPreviewFallback({...fact,fallback:{...fact.fallback,links:[{href:'https://artist.example/other',visible:true}]}},origins),false);
 assert.ok(origins.navigationTargets.get(image.url).has('/issues/2026-11-10/#story-example-story'));
 assert.throws(()=>declaredPreviewMedia([],[],{},{},[{...feature,status:'complete'}]),/Invalid provisional/);
 assert.throws(()=>declaredPreviewMedia([],[],{},{},[{...feature,stories:[{id:'example-story',images:[{...image,rights:'cleared'}]}]}]),/Incomplete provisional/);
});
