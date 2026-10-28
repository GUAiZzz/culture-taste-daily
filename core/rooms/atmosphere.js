(()=>{
 const root=document.documentElement,layer=document.querySelector('.paper-atmosphere'),reduced=matchMedia('(prefers-reduced-motion:reduce)');if(!layer)return;
 let last=-Infinity;layer.dataset.ready="true";
 const enabled=()=>root.dataset.theme!=='analog'&&root.dataset.motion==='on'&&!reduced.matches&&!document.hidden;
 function reset(){layer.style.removeProperty('--wash-x');layer.style.removeProperty('--wash-y')}
 function shift(x,y){if(!enabled())return;const now=performance.now();if(now-last<90)return;last=now;layer.style.setProperty('--wash-x',Math.round(x*22)+'px');layer.style.setProperty('--wash-y',Math.round(y*16)+'px')}
 document.addEventListener('pointermove',e=>{if(e.pointerType==='mouse')shift(e.clientX/innerWidth-.5,e.clientY/innerHeight-.5)},{passive:true});
 window.addEventListener('scroll',()=>shift(Math.sin(scrollY/950)*.5,Math.cos(scrollY/800)*.5),{passive:true});
 document.addEventListener('pointerleave',reset);window.addEventListener('blur',reset);document.addEventListener('visibilitychange',()=>{if(document.hidden)reset()});
 reduced.addEventListener('change',reset);new MutationObserver(()=>{if(!enabled())reset()}).observe(root,{attributes:true,attributeFilter:['data-theme','data-motion']});
})();
