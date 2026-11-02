/* Synchronous public-scene restore. Preferences remain owned by CTUI. */
(() => {
 'use strict';
 const root=document.documentElement;
 if(root.dataset.pageType!=='home')return;
 let entries=[];
 try{const data=JSON.parse(sessionStorage.getItem('ct-living-roots-v1')||'[]');if(Array.isArray(data))entries=data;}catch{}
 const token=new URLSearchParams(location.search).get('ctroot')||history.state?.ctLivingRoot;
 const pending=entries.find(x=>x&&typeof x==='object'&&x.token===token&&x.mode==='home'&&Date.now()-x.createdAt>=0&&Date.now()-x.createdAt<43200000);
 const browse=history.state?.ctLivingBrowse;
 const scene=pending||browse;
 if(!scene||scene.issueId!==root.dataset.livingIssueId||!Number.isFinite(scene.createdAt)||Date.now()-scene.createdAt<0||Date.now()-scene.createdAt>=43200000)return;
 if(pending)try{const source=new URL(scene.url,location.href);if(source.origin!==location.origin||source.pathname.replace(/index\.html$/,'')!==location.pathname.replace(/index\.html$/,''))return;}catch{return;}
 const ids=(root.dataset.livingStoryIds||'').split(',');
 let q=pending&&scene.entryKind==='story'?ids.indexOf(scene.clickedStoryId):scene.revision===root.dataset.livingRevision?scene.q:ids.indexOf(scene.activeStoryId);
 const missingId=(pending&&scene.entryKind==='story'||scene.revision!==root.dataset.livingRevision)&&q<0;
 if(!Number.isFinite(q)||missingId)return;
 q=Math.max(0,Math.min(ids.length-1,q));
 root.style.setProperty('--living-restored-q',String(q));
 const currentPalettes=(root.dataset.livingPalettes||'').split(';').map(v=>v.split(','));
 const colors=pending&&scene.entryKind==='story'||scene.revision!==root.dataset.livingRevision?currentPalettes[Math.round(q)]:scene.ambientPalette;
 if(Array.isArray(colors)&&colors.length===3&&colors.every(c=>/^#[0-9a-f]{6}$/i.test(c)))colors.forEach((color,i)=>root.style.setProperty('--living-restored-ambient-'+['a','b','c'][i],color));
 if(pending)root.dataset.livingRestoreToken=scene.token;
})();
