import {test} from 'node:test';
import assert from 'node:assert/strict';
import {declaredPreviewMedia,verifiedPreviewFallback} from '../scripts/lib/preview-fallback.mjs';
const url='https://official.example/art.jpg',origin='https://official.example/story';
const manifest={issue_id:'2026-10-28',stories:[{id:'story-id',sources:[{url:origin,relationship:'first_party_official'}],media:{kind:'source_image',origin_authority:'first_party_official',rights_basis:'preview_user_authorized_external',external_image_url:url,origin_url:origin}}]};
const origins=declaredPreviewMedia([manifest]);
function image(){return {url,alt:'Verified story artwork',external_preview:true,loaded:false,settled:true,navigation:{kind:'edition-story',href:'https://site.example/culture-taste-daily/issues/2026-10-28/#story-story-id',pageUrl:'https://site.example/culture-taste-daily/',storyId:'story-id',homepage:true,visible:true,inactive:false,current:true},fallback:{visible:true,text:'Official image unavailable. Read this story and its sources.',links:[]}};}
test('navigation fallback binds the exact declared image, edition, story and project route',()=>{
 assert.equal(verifiedPreviewFallback(image(),origins),true);
 for(const href of ['https://site.example/wrong-prefix/issues/2026-10-28/#story-story-id','https://site.example/culture-taste-daily/extra/issues/2026-10-28/#story-story-id','https://evil.example/culture-taste-daily/issues/2026-10-28/#story-story-id','https://site.example/culture-taste-daily/issues/2026-10-28/?redirect=bad#story-story-id','https://site.example/culture-taste-daily/issues/2026-10-28/#story-other','https://site.example/culture-taste-daily/%2fextra/issues/2026-10-28/#story-story-id']){const value=image();value.navigation.href=href;assert.equal(verifiedPreviewFallback(value,origins),false,href);}
 for(const change of [v=>v.url+='wrong',v=>v.navigation.homepage=false,v=>v.navigation.storyId='other',v=>v.fallback.text='',v=>v.fallback.visible=false]){const value=image();change(value);assert.equal(verifiedPreviewFallback(value,origins),false);}
 assert.equal(verifiedPreviewFallback(undefined,origins),false);
});
test('hidden neighboring artwork never exempts the current central image from a visible fallback',()=>{
 const value=image();value.navigation.visible=false;value.navigation.inactive=true;value.fallback.visible=false;
 assert.equal(verifiedPreviewFallback(value,origins),false);
 value.navigation.current=false;assert.equal(verifiedPreviewFallback(value,origins),true);
 value.navigation.inactive=false;assert.equal(verifiedPreviewFallback(value,origins),false);
});
