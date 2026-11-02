import {motionConfig,rubber,unrubber,createRelease,sampleRelease,advanceMotionClock} from './living-physics.js';
import {createFrameBudget} from './living-performance.js';
import {initNavigation,getHomeRestore,consumeHomeRestore,persistBrowse} from './living-navigation.js';
import {createArtworkMaterials} from './living-materials.js';

// A deferred classic script can finish before this module's dependency graph.
// The reader must apply locale/layout before we restore a reading paragraph;
// the public completion marker is released only after that restoration.
let experienceStarted=false;
function initializeExperience(){
 if(experienceStarted||!window.CTReadingSystem||!document.documentElement.classList.contains('reading-ui-ready'))return;
 experienceStarted=true;
 initNavigation();
 const edition=document.querySelector('[data-living-edition]');
 if(edition&&!initializeEdition(edition))throw new Error('Living edition enhancement did not initialize');
 document.documentElement.classList.add('reading-ready');
 document.dispatchEvent(new CustomEvent('ct:reading-ready'));
}
document.addEventListener('ct:reading-ui-ready',initializeExperience,{once:true});
initializeExperience();

function initializeEdition(edition){
 let config;
 try{config=JSON.parse(document.getElementById('living-config').textContent);}catch{return false;}
 const artworks=[...edition.querySelectorAll('.living-art')],n=artworks.length;
 if(!n||n!==config.stories.length)return false;
 const stage=edition.querySelector('[data-living-stage]'),surface=edition.querySelector('[data-living-surface]');
 const previous=edition.querySelector('[data-living-prev]'),next=edition.querySelector('[data-living-next]');
 const title=edition.querySelector('[data-living-current]'),category=edition.querySelector('[data-living-category]');
 const number=edition.querySelector('[data-living-number]'),position=edition.querySelector('[data-living-position]');
 const announcement=edition.querySelector('[data-living-announcement]');
 const ui=window.CTUI;
 const reduced=matchMedia('(prefers-reduced-motion:reduce)');
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const pad=x=>String(x).padStart(2,'0');
 const locale=()=>document.documentElement.dataset.locale==='en'?'en':'zh';
 const categoryNames={fashion:['时装','Fashion'],music:['音乐','Music'],objects:['物件','Objects'],city:['城市','City']};
 const makeId=()=>globalThis.crypto?.randomUUID?.()||String(performance.now());
 const resolvedHrefs=artworks.map(a=>a.href);
 const hexRgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);
 const linear=x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4;
 const gamma=x=>x<=.0031308?12.92*x:1.055*x**(1/2.4)-.055;
 const lab=h=>{const [r,g,b]=hexRgb(h).map(linear),l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);return[.2104542553*l+.793617785*m-.0040720468*s,1.9779984951*l-2.428592205*m+.4505937099*s,.0259040371*l+.7827717662*m-.808675766*s];};
 const fromLab=([L,A,B])=>{const l=(L+.3963377774*A+.2158037573*B)**3,m=(L-.1055613458*A-.0638541728*B)**3,s=(L-.0894841775*A-1.291485548*B)**3;return'#'+[4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.707614701*s].map(x=>Math.round(clamp(gamma(x),0,1)*255).toString(16).padStart(2,'0')).join('');};
 const palettes=config.stories.map(s=>s.palette.map(lab));
 const restored=getHomeRestore(config);
 let q=restored?.q??config.initialIndex,active=clamp(Math.round(q),0,n-1),v=0,phase='idle';
 let pendingTarget=null,flight=null,frame=0,down=null,suppressClick=false,measureFrame=0;
 let gestureId=makeId(),ambientPalette=config.stories[active].palette.slice(),lastPause=null;
 let layout={width:1,height:1,S:144,widths:[],heights:[],paintWidths:[],paintHeights:[],centers:[],tangents:[],mobile:false,peek:48};
 const trace=[],debug=new URLSearchParams(location.search).has('debug');
 let lastAnnounced=-1,disposed=false,keyboardFocusTarget=null,pendingImageMeasure=false;
 const activatedImages=new WeakSet();
 const motionBudget=createFrameBudget();
 let softeningDisabled=false,budgetFrame=0,budgetWasActive=false;
 edition.querySelector('.living-controls').hidden=n<2;
 const materials=createArtworkMaterials({stage,controls:edition.querySelector('.living-controls'),getArtwork:()=>artworks[active],getPalette:()=>ambientPalette.slice(),isBusy:()=>phase!=='idle',feedback:(...args)=>ui?.feedback?.(...args)});

 function blendAmbient(){
  const at=clamp(q,0,n-1),lo=Math.floor(at),hi=Math.min(n-1,lo+1),mix=at-lo;
  ambientPalette=palettes[lo].map((color,i)=>fromLab(color.map((c,j)=>c+(palettes[hi][i][j]-c)*mix)));
  ambientPalette.forEach((color,i)=>edition.style.setProperty('--ambient-'+['a','b','c'][i],color));
 }

 function renderMetadata(force=false){
  let changed=false;
  while(active<n-1&&q>active+.56){active++;changed=true;}
  while(active>0&&q<active-.56){active--;changed=true;}
  if(!changed&&!force)return;
  const story=config.stories[active],language=locale(),name=language==='en'?story.titleEn:story.titleZh;
  title.textContent=name;title.href=resolvedHrefs[active];title.dataset.storyId=story.id;
  category.textContent=categoryNames[story.category]?.[language==='en'?1:0]||story.category;
  number.textContent=`${pad(active+1)} / ${pad(n)}`;
  position.replaceChildren(document.createTextNode(pad(active+1)),Object.assign(document.createElement('span'),{textContent:'—'}),document.createTextNode(pad(n)));
  updateControls();
  artworks.forEach((a,i)=>{a.tabIndex=i===active?0:-1;a.setAttribute('aria-current',i===active?'true':'false');});
  if(changed)ui?.feedback?.('selection.step',{velocity:v,gestureId});
 }

 function render(){
  let camera=layout.centers[0]||0;
  if(n>1){
   if(q<=0)camera=layout.centers[0]+q*layout.tangents[0];
   else if(q>=n-1)camera=layout.centers[n-1]+(q-n+1)*layout.tangents[n-1];
   else{
    const i=Math.floor(q),t=q-i,t2=t*t,t3=t2*t;
    // C1 monotone camera path: portrait/landscape spacing must not create a
    // pixel-velocity seam each time a continuous q passes an integer.
    camera=(2*t3-3*t2+1)*layout.centers[i]+(t3-2*t2+t)*layout.tangents[i]+(-2*t3+3*t2)*layout.centers[i+1]+(t3-t2)*layout.tangents[i+1];
   }
  }
  const record=config.variant==='record',range=layout.mobile?1.48:2.48;
  artworks.forEach((art,i)=>{
   const d=i-q,abs=Math.abs(d);
   const smoothDistance=Math.sqrt(d*d+.0144)-.12;
   const scale=Math.pow(record?.90:.82,smoothDistance),angle=52*Math.tanh(d*(record?(layout.mobile?-8:-12):(layout.mobile?-20:-32))/52);
   const depth=-smoothDistance*(record?60:120),x=layout.centers[i]-camera;
   const farEdgeProjection=1200/(1200-depth+scale*Math.abs(Math.sin(angle*Math.PI/180))*layout.paintWidths[i]/2);
   const sideTallEnough=layout.paintHeights[i]*scale*farEdgeProjection>=48;
   const visible=abs<range&&(!layout.mobile||abs<.75||sideTallEnough);
   art.dataset.rendered='true';art.setAttribute('aria-hidden',String(!visible));
   if(!visible)return;
   art.style.transform=`translate(-50%,-50%) translate3d(${x.toFixed(3)}px,0,${depth.toFixed(3)}px) rotateY(${angle.toFixed(3)}deg) scale(${scale.toFixed(5)})`;
   art.style.zIndex=String(1000-Math.round(abs*100));
   art.style.opacity=String(clamp((range-abs)/.35,0,1));
   const blur=reduced.matches||softeningDisabled||i===Math.round(clamp(q,0,n-1))?0:1.5*clamp((Math.abs(v)-2)/8,0,1);
   art.querySelector('.living-art-surface').style.filter=blur>.01?`blur(${blur.toFixed(2)}px)`:'none';
  });
  blendAmbient();renderMetadata();
  materials.sync();
  updateControls();
  for(const i of [active-1,active,active+1])if(artworks[i])activateImage(i);
  if(keyboardFocusTarget!==null){
   const target=artworks[keyboardFocusTarget];
   if(target?.getAttribute('aria-hidden')==='false'){target.focus({preventScroll:true});if(!flight)keyboardFocusTarget=null;}
  }
  if(debug){
   Object.assign(stage.dataset,{q:String(q),velocity:String(v),phase,target:String(flight?.release.target??''),omega:String(flight?.release.omega??'')});
   trace.push({at:performance.now(),q,v,phase,active,target:flight?.release.target,omega:flight?.release.omega});if(trace.length>1200)trace.shift();
  }
 }

 function measure(){
  const rect=stage.getBoundingClientRect(),mobile=innerWidth<=740,record=config.variant==='record';
  // 24px is a viewport-start guard; a TV border/gutter is not added again.
  const left=mobile?Math.max(0,24-rect.left):0,right=mobile?Math.max(0,24-(innerWidth-rect.right)):0;
  surface.style.left=`${left}px`;surface.style.right=`${right}px`;
  const width=Math.max(1,rect.width-left-right),height=rect.height;
  const baseWidth=mobile?Math.min(width*(record?.76:.74),Math.max(100,width-96)):Math.min(record?420:540,width*(record?.50:.52));
  const mats=config.stories.map(s=>record&&s.treatment!=='cover'?16:0);
  const paintWidths=config.stories.map((s,i)=>Math.max(1,Math.min(baseWidth-mats[i],(height*.82-mats[i])*s.ratio)));
  // The paper is OUTSIDE the photographic rectangle. Giving both the frame and
  // inner photo the same aspect ratio created wide-banner letterboxing.
  const widths=paintWidths.map((w,i)=>w+mats[i]);
  const paintHeights=paintWidths.map((w,i)=>w/config.stories[i].ratio);
  const heights=paintHeights.map((h,i)=>Math.max(44,h+mats[i]));
  const spacing=record?(mobile?.40:.31):(mobile?.62:.55);
  const sideDistance=Math.sqrt(1+.0144)-.12;
  const sideScale=Math.pow(record?.90:.82,sideDistance);
  const rotationDeg=52*Math.tanh((record?(mobile?8:12):(mobile?20:32))/52),rotation=rotationDeg*Math.PI/180;
  const depth=sideDistance*(record?60:120),perspective=1200;
  const minimumGap=(centerWidth,sidePaintWidth)=>{
   const outerProjection=perspective/(perspective+depth-sideScale*Math.sin(rotation)*sidePaintWidth/2);
   return (centerWidth/2+50)/outerProjection-sideScale*Math.cos(rotation)*sidePaintWidth/2;
  };
  const centers=[0];
  for(let i=1;i<n;i++){
   const minimum=Math.max(minimumGap(widths[i-1],paintWidths[i]),minimumGap(widths[i],paintWidths[i-1]));
   centers.push(centers[i-1]+Math.max(baseWidth*spacing,minimum));
  }
  const gaps=centers.slice(1).map((x,i)=>x-centers[i]);
  const tangents=centers.map((_,i)=>i===0?gaps[0]||0:i===n-1?gaps[n-2]||0:2*gaps[i-1]*gaps[i]/(gaps[i-1]+gaps[i]));
  layout={width,height,S:clamp(width*.42,144,260),widths,heights,paintWidths,paintHeights,centers,tangents,mobile,peek:48};
  artworks.forEach((a,i)=>{a.style.width=`${widths[i]}px`;a.style.height=`${heights[i]}px`;});
  render();
 }

 function announce(){
  if(lastAnnounced===active)return;lastAnnounced=active;
  const s=config.stories[active];announcement.textContent=`${active+1} / ${n} · ${locale()==='en'?s.titleEn:s.titleZh}`;
 }
 function updateControls(){const selected=pendingTarget??active;previous.disabled=selected===0;next.disabled=selected===n-1;}
 function clearPress(){artworks.forEach(a=>delete a.dataset.pressed);surface.dataset.dragging='false';}
 function observeBudget(time){
  budgetFrame=0;
  if(document.hidden||disposed){motionBudget.resetClock();budgetWasActive=false;return;}
  // This clock is continuous during manipulation/settling. Pointer events alone
  // are sparse and cannot be used to infer missed animation frames.
  if(budgetWasActive){
   const result=motionBudget.sample(time);
   if(result.disabled&&!softeningDisabled){
    softeningDisabled=true;edition.dataset.motionSoftening='disabled';
    artworks.forEach(a=>a.querySelector('.living-art-surface').style.filter='none');
   }
  }
  budgetWasActive=!!(down?.locked||flight);
  if(budgetWasActive&&!softeningDisabled)budgetFrame=requestAnimationFrame(observeBudget);
  else{motionBudget.resetClock();budgetWasActive=false;}
 }
 function watchBudget(){
  if(budgetFrame||softeningDisabled||document.hidden)return;
  motionBudget.resetClock();budgetWasActive=true;budgetFrame=requestAnimationFrame(observeBudget);
 }
 function stop(){materials.cancel();if(frame)cancelAnimationFrame(frame);frame=0;flight=null;pendingTarget=null;v=0;}
 function direct(index,{focus=false,announceChange=true}={}){
  if(down){down=null;suppressClick=true;}
  keyboardFocusTarget=null;
  stop();q=clamp(index,0,n-1);active=clamp(Math.round(q),0,n-1);phase='idle';clearPress();render();renderMetadata(true);
  if(pendingImageMeasure){pendingImageMeasure=false;measure();}
  if(announceChange)announce();if(focus)artworks[active].focus({preventScroll:true});
  persistBrowse(getState());
 }
 function tick(time){
  frame=0;if(!flight)return;
  if(document.querySelector('dialog[open]')){pause();return;}
  const clock=advanceMotionClock(flight.elapsed,time-flight.lastTime,document.hidden);
  flight.lastTime=time;flight.elapsed=clock.elapsedSeconds;
  if(clock.paused){lastPause={gap:clock.droppedMs,q};direct(clamp(Math.round(q),0,n-1),{announceChange:false});return;}
  const point=sampleRelease(flight.release,flight.elapsed);q=point.q;v=point.v;phase='settling';render();
  if(point.done){flight=null;pendingTarget=null;v=0;phase='idle';render();if(pendingImageMeasure){pendingImageMeasure=false;measure();}announce();persistBrowse(getState());ui?.feedback?.('snap.complete',{gestureId});}
  else frame=requestAnimationFrame(tick);
 }
 function release(velocity,explicitTarget=null){
  if(document.querySelector('dialog[open]')){pause();return;}
  stop();
  const model=createRelease(q,reduced.matches?0:velocity,n,active,explicitTarget===null?{}:{target:explicitTarget});
  if(reduced.matches||n<2){direct(model.target??0);return;}
  pendingTarget=model.target;flight={release:model,elapsed:0,lastTime:performance.now()};phase='settling';updateControls();persistBrowse(getState());frame=requestAnimationFrame(tick);watchBudget();
 }
 function select(index,{direct:immediate=false,focus=false}={}){
  index=clamp(Math.round(index),0,n-1);gestureId=makeId();
  if(immediate||reduced.matches){direct(index,{focus});return;}
  const carried=v;release(carried,index);
  if(focus){keyboardFocusTarget=index;if(artworks[index].getAttribute('aria-hidden')==='false')artworks[index].focus({preventScroll:true});}
 }
 function getState(){return{issueId:config.issueId,revision:config.revision,q,v,activeStoryId:config.stories[active].id,activeIndex:active,phase,target:pendingTarget,ambientPalette:ambientPalette.slice(),gestureId,modelVersion:motionConfig.version,lastPause,motionBudget:motionBudget.snapshot(),materials:materials.state(),layout:{width:layout.width,height:layout.height,S:layout.S,mobile:layout.mobile}};}
 function pause(){direct(clamp(q,0,n-1),{announceChange:false});}
 function restore(scene,options={}){
  if(scene.mode!=='home'||scene.issueId!==config.issueId)return;
  const result=getHomeRestore(config);if(!result)return;
  direct(result.q,{focus:options.focus===true,announceChange:false});
  if(options.scroll!==false)consumeHomeRestore(config,{persisted:options.persisted===true});
 }

 function addSample(value,time){
  if(!down)return;
  const previous=down.samples.at(-1);
  if(previous?.time===time){previous.q=value;return;}
  down.samples.push({q:value,time});
  while(down.samples.length>12||down.samples.length>2&&time-down.samples[0].time>80)down.samples.shift();
 }
 function estimatedVelocity(time){
  if(!down||time-down.lastMoveAt>=50||down.samples.length<2)return 0;
  const samples=down.samples.filter(s=>time-s.time<=80);
  if(samples.length<2)return 0;
  const meanT=samples.reduce((a,s)=>a+s.time,0)/samples.length,meanQ=samples.reduce((a,s)=>a+s.q,0)/samples.length;
  const variance=samples.reduce((a,s)=>a+(s.time-meanT)**2,0);
  return variance>0?clamp(samples.reduce((a,s)=>a+(s.time-meanT)*(s.q-meanQ),0)/variance*1000,-10,10):0;
 }
 function cancelInput({snap=true}={}){
  if(down){suppressClick=true;down=null;}
  clearPress();if(snap)release(0);else stop();
 }
 surface.addEventListener('pointerdown',event=>{
  if(event.button!==0||event.isPrimary===false||window.visualViewport?.scale>1.01||document.querySelector('dialog[open]'))return;
  if(event.pointerType==='touch'&&(event.clientX<24||event.clientX>innerWidth-24))return;
  suppressClick=false;stop();phase='press-candidate';gestureId=makeId();
  artworks.forEach(a=>a.querySelector('.living-art-surface').style.filter='none');
  const art=event.target.closest('.living-art');
  down={id:event.pointerId,x:event.clientX,y:event.clientY,q0:q,u0:unrubber(q,n),maxDistance:0,locked:false,native:false,storyId:art?.dataset.storyId,samples:[],lastMoveAt:event.timeStamp,pointerType:event.pointerType};
  if(art)art.dataset.pressed='true';addSample(q,event.timeStamp);
 });
 surface.addEventListener('pointermove',event=>{
  if(!down||event.pointerId!==down.id)return;
  if(event.pointerType!=='touch'&&(event.buttons&1)===0){cancelInput();return;}
  const dx=event.clientX-down.x,dy=event.clientY-down.y;
  down.maxDistance=Math.max(down.maxDistance,Math.hypot(dx,dy));
  const threshold=down.pointerType==='touch'?10:6;
  if(!down.locked&&down.maxDistance>=threshold){
   if(Math.abs(dx)>=1.25*Math.abs(dy)){down.locked=true;phase='dragging';surface.dataset.dragging='true';watchBudget();try{surface.setPointerCapture(event.pointerId);}catch{}}
   else{down.native=true;cancelInput();return;}
  }
  if(!down?.locked)return;
  if(event.cancelable)event.preventDefault();
  down.lastMoveAt=event.timeStamp;q=rubber(down.u0-dx/layout.S,n);addSample(q,event.timeStamp);v=estimatedVelocity(event.timeStamp);
  if(q<0)ui?.feedback?.('boundary',{side:'start',gestureId});
  if(q>n-1)ui?.feedback?.('boundary',{side:'end',gestureId});
  if(q>=0)ui?.feedback?.('boundary.rearm',{side:'start',insidePx:q*layout.S,gestureId});
  if(q<=n-1)ui?.feedback?.('boundary.rearm',{side:'end',insidePx:(n-1-q)*layout.S,gestureId});
  if(!frame)frame=requestAnimationFrame(()=>{frame=0;render();});
 },{passive:false});
 surface.addEventListener('pointerup',event=>{
  if(!down||event.pointerId!==down.id)return;
  const gesture=down;
  if(gesture.locked){
   const velocity=estimatedVelocity(event.timeStamp);suppressClick=true;down=null;clearPress();
   if(frame){cancelAnimationFrame(frame);frame=0;}render();release(velocity);
   try{surface.releasePointerCapture(event.pointerId);}catch{}
  }else{
   const art=event.target.closest('.living-art');
   if(gesture.maxDistance>=(gesture.pointerType==='touch'?10:6)||art?.dataset.storyId!==gesture.storyId)suppressClick=true;
   down=null;phase='idle';clearPress();
  }
 });
 surface.addEventListener('click',event=>{
  if(suppressClick&&event.detail!==0){event.preventDefault();event.stopImmediatePropagation();suppressClick=false;}
 },true);
 surface.addEventListener('pointercancel',()=>cancelInput());
 window.addEventListener('pointerup',event=>{
  // Before the drag threshold we intentionally do not capture. A release just
  // outside the stage must still finish that candidate; otherwise later hover
  // would be mistaken for a held drag.
  if(down&&event.pointerId===down.id&&!(event.target instanceof Node&&surface.contains(event.target)))cancelInput();
 },true);
 surface.addEventListener('lostpointercapture',event=>{
  // Touch initially has implicit capture on the image surface. Its legitimate
  // transfer to this drag surface must not cancel the new horizontal gesture.
  if(down&&event.pointerId===down.id&&event.target===surface&&!surface.hasPointerCapture(event.pointerId))cancelInput();
 });
 surface.addEventListener('contextmenu',()=>cancelInput());
 window.addEventListener('pointerdown',event=>{if(down&&event.pointerId!==down.id)cancelInput();},true);
 window.addEventListener('blur',()=>{if(down)cancelInput();else if(flight)direct(Math.round(q),{announceChange:false});});
 previous.addEventListener('click',()=>select((pendingTarget??active)-1));
 next.addEventListener('click',()=>select((pendingTarget??active)+1));
 stage.addEventListener('keydown',event=>{
  if(event.defaultPrevented||event.isComposing||document.querySelector('dialog[open]')||!['ArrowLeft','ArrowRight','Home','End','Escape','Enter'].includes(event.key))return;
  if(event.key==='Enter'){
   if(pendingTarget!==null){event.preventDefault();artworks[pendingTarget].click();}
   return;
  }
  event.preventDefault();
  if(event.key==='Home'||event.key==='End')direct(event.key==='Home'?0:n-1,{focus:true});
  else if(event.key==='Escape'){cancelInput();}
  else select((pendingTarget??active)+(event.key==='ArrowRight'?1:-1),{focus:true});
 });
 const remesure=()=>{if(disposed)return;if(measureFrame)cancelAnimationFrame(measureFrame);measureFrame=requestAnimationFrame(()=>{measureFrame=0;if(down)cancelInput({snap:false});if(flight)direct(active,{announceChange:false});measure();});};
 window.addEventListener('resize',remesure,{passive:true});
 document.addEventListener('ct:locale-change',()=>{renderMetadata(true);artworks.forEach(art=>setImageStatus(art,art.dataset.image));remesure();});
 ui?.subscribe?.(()=>{renderMetadata(true);remesure();});
 reduced.addEventListener('change',()=>{if(flight)direct(pendingTarget??active,{announceChange:false});measure();});
 document.addEventListener('visibilitychange',()=>{
  if(!document.hidden)return;
  // A hidden tab may receive no rAF at all. Cut this clock synchronously so its
  // suspended interval is never mistaken for a slow foreground animation.
  if(budgetFrame)cancelAnimationFrame(budgetFrame);
  budgetFrame=0;budgetWasActive=false;motionBudget.resetClock();
  if(down||flight)pause();
 });
 const modalObserver=new MutationObserver(()=>{if(document.querySelector('dialog[open]'))pause();});
 document.querySelectorAll('dialog').forEach(dialog=>modalObserver.observe(dialog,{attributes:true,attributeFilter:['open']}));
 if('ResizeObserver'in window)new ResizeObserver(remesure).observe(stage);
 function bindImage(art,image,index){
  if(activatedImages.has(image))return;activatedImages.add(image);let timer=0;
  const state=()=>{
   clearTimeout(timer);const loaded=image.naturalWidth>0&&image.naturalHeight>0;
   setImageStatus(art,loaded?'loaded':'failed');
   if(loaded){const ratio=image.naturalWidth/image.naturalHeight;if(Math.abs(config.stories[index].ratio-ratio)>.002){config.stories[index].ratio=ratio;if(down||flight)pendingImageMeasure=true;else remesure();}}
  };
  image.addEventListener('load',state);image.addEventListener('error',state);
  if(image.complete&&image.isConnected)state();else{setImageStatus(art,'loading');timer=setTimeout(()=>{if(!image.complete)setImageStatus(art,'slow');},8000);}
 }
 function setImageStatus(art,value){
  art.dataset.image=value;
  // A successful asynchronous load may keep the declared aspect ratio, so it
  // does not schedule another layout/render. Refresh the optional control here
  // rather than leaving it disabled until an unrelated resize or selection.
  materials.sync();
  const label=art.querySelector('.living-art-error');
  if(value==='slow')label.textContent=locale()==='en'?'Official image is loading slowly. You can read now.':'官方图像加载较慢，可先进入阅读。';
  else if(value==='failed')label.textContent=locale()==='en'?'Official image unavailable · editorial fallback':'官方图像暂不可用 · 非纪实回退图';
 }
 function activateImage(index){
  const art=artworks[index];if(!art)return;
  let image=art.querySelector('.living-official');
  if(!image){const template=art.querySelector('template[data-living-image]');if(!template)return;image=template.content.querySelector('img');bindImage(art,image,index);template.replaceWith(image);window.CTLocale?.apply?.(art);}
  else bindImage(art,image,index);
  if(image.loading!=='eager')image.loading='eager';
  const priority=index===active?'high':'auto';if(image.fetchPriority!==priority)image.fetchPriority=priority;
 }
 artworks.forEach((art,index)=>{const img=art.querySelector('.living-official');if(img)bindImage(art,img,index);else art.dataset.image='deferred';});
 edition.dataset.enhanced='true';measure();renderMetadata(true);
 window.CTLivingEdition=Object.freeze({state:getState,select,restore,pause,config:()=>JSON.parse(JSON.stringify(config)),trace:()=>trace.slice(),clearTrace:()=>trace.splice(0),measure,unfold:materials.trigger});
 consumeHomeRestore(config);
 document.dispatchEvent(new CustomEvent('ct:living-ready',{detail:{issueId:config.issueId,variant:config.variant}}));
 return true;
}
