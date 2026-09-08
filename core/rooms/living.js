(()=>{
'use strict';
const root=document.documentElement,reduce=matchMedia('(prefers-reduced-motion:reduce)'),enabled=()=>root.dataset.motion==='on'&&!reduce.matches&&!document.hidden;
let frameTimer=0,stopTimer=0,visible=false,draws=0,seed=1;
const sketch=document.querySelector('.doodle-scene'),holder=sketch?.closest('[data-material]');
const strokes=sketch?[...sketch.querySelectorAll('path')].map(e=>({e,d:e.getAttribute('d')})):[];
const groups=sketch?[...sketch.querySelectorAll('[data-ink-group]')]:[];
function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
function stop(){clearInterval(frameTimer);clearTimeout(stopTimer);frameTimer=0;stopTimer=0;for(const p of strokes)p.e.setAttribute('d',p.d);for(const g of groups)g.removeAttribute('transform');}
function redraw(){if(!enabled()||!visible){stop();return;}draws++;for(const p of strokes)p.e.setAttribute('d',p.d.replace(/-?\d+(?:\.\d+)?/g,n=>(Number(n)+(random()-.5)*3.2).toFixed(2)));groups.forEach((g,i)=>{const a=(random()-.5)*(i===2?8:2),x=(random()-.5)*5,y=(random()-.5)*(i===2?13:4);g.setAttribute('transform',`translate(${x} ${y}) rotate(${a} 400 320)`);});}
function play(){if(!holder||!enabled()||!visible||root.dataset.theme==='analog')return;stop();seed=(Math.random()*0xffffffff)>>>0;redraw();frameTimer=setInterval(redraw,115);stopTimer=setTimeout(stop,805);}
if(sketch){sketch.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch')play()});sketch.addEventListener('pointerleave',stop);sketch.addEventListener('click',play);holder.querySelector('[data-material-action]').addEventListener('click',play);new IntersectionObserver(([e])=>{visible=e.isIntersecting;if(!visible)stop()}).observe(sketch);}
new MutationObserver(()=>{if(!enabled()||root.dataset.theme==='analog')stop()}).observe(root,{attributes:true,attributeFilter:['data-theme','data-motion']});document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});window.addEventListener('pagehide',stop);window.addEventListener('blur',stop);reduce.addEventListener('change',stop);
const tv=document.querySelector('.television');let noiseTimer=0,noiseEnd=0,noiseFrames=0,tvVisible=false,lastRustle=0;
const snow=tv?document.createElement('canvas'):null,noise=snow?.getContext('2d');if(snow){snow.className='tv-static';snow.width=280;snow.height=180;snow.setAttribute('aria-hidden','true');tv.append(snow);new IntersectionObserver(([e])=>{tvVisible=e.isIntersecting;if(!tvVisible)stopNoise()}).observe(tv)}
function stopNoise(){clearInterval(noiseTimer);clearTimeout(noiseEnd);noiseTimer=noiseEnd=0;noise?.clearRect(0,0,280,180)}
function rustle(){stopNoise();if(!enabled()||!tvVisible||root.dataset.theme!=='analog')return;const draw=()=>{if(!enabled()||!tvVisible){stopNoise();return}noiseFrames++;noise.clearRect(0,0,280,180);for(let j=0;j<800;j++){const x=Math.random()*280,y=Math.random()*180;const edge=x<9||x>271||y<7||y>171;if(!edge)continue;noise.fillStyle=Math.random()>.5?'rgba(240,228,200,.4)':'rgba(0,0,0,.65)';noise.fillRect(x,y,Math.random()>.85?5:1,1)}};draw();noiseTimer=setInterval(draw,75);noiseEnd=setTimeout(stopNoise,225)}
if(tv){tv.addEventListener('pointerenter',()=>{if(Date.now()-lastRustle>5000){lastRustle=Date.now();rustle()}});tv.addEventListener('pointerleave',stopNoise)}document.addEventListener('visibilitychange',()=>{if(document.hidden)stopNoise()});window.addEventListener('blur',stopNoise);window.addEventListener('pagehide',stopNoise);reduce.addEventListener('change',stopNoise);new MutationObserver(()=>{if(!enabled()||root.dataset.theme!=='analog')stopNoise()}).observe(root,{attributes:true,attributeFilter:['data-theme','data-motion']});
Object.defineProperty(window,'CTLiving',{value:{state:()=>({running:!!frameTimer,visible,draws,noiseRunning:!!noiseTimer,noiseFrames,tvVisible}),stop}});
})();
