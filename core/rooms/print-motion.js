/* A short registration settle on entry. No timers, scroll loop or perpetual noise. */
(()=>{
 const root=document.documentElement,reduced=matchMedia('(prefers-reduced-motion:reduce)'),elements=[...document.querySelectorAll('[data-print-motion]')],active=new Map(),seen=new WeakSet();
 const enabled=()=>root.dataset.theme==='coral'&&root.dataset.motion==='on'&&!reduced.matches&&!document.hidden;
 function stop(){for(const animation of active.values())animation.cancel();active.clear()}
 function enter(el){if(!enabled()||seen.has(el))return;seen.add(el);const layer=el.querySelector('.print-register');if(!layer)return;const a=layer.animate([{transform:'translateX(-10px)',opacity:.14},{transform:'translateX(1px)',opacity:.38,offset:.72},{transform:'translateX(0)',opacity:getComputedStyle(layer).opacity}],{duration:650,easing:'cubic-bezier(.2,.65,.3,1)'});active.set(el,a);a.finished.catch(()=>{}).finally(()=>{if(active.get(el)===a)active.delete(el)})}
 const observer=new IntersectionObserver(entries=>{for(const e of entries){if(e.isIntersecting)enter(e.target);else{active.get(e.target)?.cancel();active.delete(e.target)}}},{threshold:.3});elements.forEach(e=>observer.observe(e));
 function sync(){stop();if(enabled())for(const e of elements){const r=e.getBoundingClientRect();if(r.bottom>0&&r.top<innerHeight)enter(e)}}
 new MutationObserver(sync).observe(root,{attributes:true,attributeFilter:['data-theme','data-motion']});reduced.addEventListener('change',sync);document.addEventListener('visibilitychange',sync);window.addEventListener('pagehide',stop);
})();
