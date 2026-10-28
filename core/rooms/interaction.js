(() => {
  'use strict';
  const KEY='culture-taste-reading-preferences';
  const defaults=Object.freeze({style:'field',theme:'light',surface:'solid',haptics:false,fontSize:19,language:'zh'});
  const styleDefaults={field:'light',coral:'warm',analog:'dark'};
  const subscribers=new Set(),dialogs=new WeakMap();
  let preferences={...defaults},hadPersisted=false,lockCount=0,previousOverflow='',previousGutter='';
  const normalize=value=>{
    const input=value&&typeof value==='object'?value:{};
    return {style:['field','coral','analog'].includes(input.style)?input.style:defaults.style,theme:['light','dark','warm'].includes(input.theme)?input.theme:defaults.theme,
      surface:['solid','glass'].includes(input.surface)?input.surface:defaults.surface,
      haptics:input.haptics===true,fontSize:Math.min(25,Math.max(17,Math.round(Number(input.fontSize)||19))),
      language:input.language==='en'?'en':'zh'};
  };
  const read=()=>{
    try{const raw=localStorage.getItem(KEY);if(raw){const value=normalize(JSON.parse(raw));hadPersisted=true;return value;}}catch{}
    try{const raw=sessionStorage.getItem(KEY);if(raw){const value=normalize(JSON.parse(raw));hadPersisted=true;return value;}}catch{}
    return {...preferences};
  };
  const write=()=>{try{localStorage.setItem(KEY,JSON.stringify(preferences));}catch{}
    try{sessionStorage.setItem(KEY,JSON.stringify(preferences));}catch{}};
  const apply=()=>{
    const root=document.documentElement;
    root.dataset.style=preferences.style;root.dataset.theme=preferences.theme;root.dataset.surface=preferences.surface;
    root.classList.toggle('no-glass',preferences.surface==='solid');
    root.classList.toggle('glass-tools',preferences.surface==='glass');
    root.style.setProperty('--reader-font',`${preferences.fontSize}px`);
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.content={light:'#fafaf8',dark:'#202523',warm:'#f4f2ef'}[preferences.theme];
    subscribers.forEach(fn=>fn({...preferences}));
  };
  preferences=read();
  const query=new URLSearchParams(location.search),queryTheme=query.get('theme'),queryStyle=query.get('style');
  if(['field','coral','analog'].includes(queryTheme)){
    preferences.style=queryTheme;if(!hadPersisted)preferences.theme=styleDefaults[queryTheme];
  }else if(['light','dark','warm'].includes(queryTheme))preferences.theme=queryTheme;
  if(['field','coral','analog'].includes(queryStyle))preferences.style=queryStyle;
  if(['light','dark','warm','field','coral','analog'].includes(queryTheme)||['field','coral','analog'].includes(queryStyle)){
    write();const url=new URL(location.href);url.searchParams.delete('theme');url.searchParams.delete('style');try{history.replaceState(null,'',url);}catch{}
  }
  apply();
  const getPreferences=()=>({...preferences});
  const setPreferences=patch=>{
    const next=normalize({...preferences,...patch});
    document.dispatchEvent(new CustomEvent('ct:preferences-will-change',{detail:{previous:{...preferences},next:{...next}}}));
    preferences=next;write();apply();return getPreferences();
  };
  const subscribe=fn=>{subscribers.add(fn);fn(getPreferences());return()=>subscribers.delete(fn);};
  const feedback=()=>{if(preferences.haptics&&typeof navigator.vibrate==='function'){try{navigator.vibrate(8);}catch{}}};
  const renderSettingsIcon=button=>{if(button)button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h3m4 0h9M4 12h9m4 0h3M4 18h3m4 0h9"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="18" r="2"/></svg>';};
  const resolve=(element,scope=document)=>typeof element==='string'?scope.querySelector(element):element;
  const bindDialog=(element,options={})=>{
    const dialog=resolve(element);if(!dialog)return {open(){},close(){}};
    if(dialogs.has(dialog))return dialogs.get(dialog);
    let lastFocus=null,locked=false,outsideDown=false;
    const close=()=>{if(dialog.open)dialog.close();};
    const open=trigger=>{
      if(dialog.open||typeof dialog.showModal!=='function')return;
      lastFocus=resolve(trigger)||resolve(options.opener)||document.activeElement;
      if(lockCount===0){previousOverflow=document.documentElement.style.overflow;previousGutter=document.documentElement.style.scrollbarGutter;}
      lockCount++;locked=true;document.documentElement.style.overflow='hidden';document.documentElement.style.scrollbarGutter='stable';
      dialog.showModal();resolve(options.opener)?.setAttribute('aria-expanded','true');
      const first=resolve(options.initialFocus,dialog)||dialog.querySelector('[data-ct-close],button,input,select,a[href]');
      first?.focus({preventScroll:true});feedback();
    };
    const opener=resolve(options.opener);
    opener?.setAttribute('aria-haspopup','dialog');opener?.setAttribute('aria-expanded','false');
    if(dialog.id)opener?.setAttribute('aria-controls',dialog.id);
    opener?.addEventListener('click',()=>open(opener));
    dialog.querySelectorAll('[data-ct-close]').forEach(button=>button.addEventListener('click',close));
    dialog.addEventListener('close',()=>{
      if(locked){lockCount=Math.max(0,lockCount-1);locked=false;
        if(lockCount===0){document.documentElement.style.overflow=previousOverflow;document.documentElement.style.scrollbarGutter=previousGutter;}}
      resolve(options.opener)?.setAttribute('aria-expanded','false');
      if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});
    });
    dialog.addEventListener('keydown',event=>{
      if(event.key!=='Tab')return;
      const items=[...dialog.querySelectorAll('a[href],button,input,select,textarea,summary,[tabindex]:not([tabindex="-1"])')].filter(item=>!item.disabled&&item.getClientRects().length&&item.getAttribute('tabindex')!=='-1');
      if(!items.length){event.preventDefault();return;}
      const first=items[0],last=items.at(-1),active=document.activeElement;
      if(event.shiftKey&&(active===first||!dialog.contains(active))){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&(active===last||!dialog.contains(active))){event.preventDefault();first.focus();}
    });
    const outside=event=>{const box=dialog.getBoundingClientRect();return event.target===dialog&&(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom);};
    dialog.addEventListener('pointerdown',event=>{outsideDown=outside(event);});
    dialog.addEventListener('click',event=>{if(outsideDown&&outside(event))close();outsideDown=false;});
    const controller={open,close};dialogs.set(dialog,controller);return controller;
  };
  document.addEventListener('keydown',event=>{
    if(event.defaultPrevented||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    const button=event.target.closest('button[aria-pressed]'),group=button?.closest('[role="group"]');
    if(!group)return;
    const items=[...group.querySelectorAll('button[aria-pressed]')].filter(item=>!item.disabled&&item.getClientRects().length);
    const index=items.indexOf(button);if(index<0)return;event.preventDefault();
    const next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowRight'?1:-1)+items.length)%items.length;
    items[next].focus({preventScroll:true});items[next].click();
  });
  window.addEventListener('storage',event=>{if(event.key!==KEY&&event.key!==null)return;
    const next=read();document.dispatchEvent(new CustomEvent('ct:preferences-will-change',{detail:{previous:{...preferences},next:{...next}}}));preferences=next;apply();});
  window.addEventListener('pageshow',event=>{if(event.persisted){const next=read();document.dispatchEvent(new CustomEvent('ct:preferences-will-change',{detail:{previous:{...preferences},next:{...next}}}));preferences=next;apply();}});
  window.CTUI=Object.freeze({getPreferences,setPreferences,subscribe,feedback,bindDialog,renderSettingsIcon});
})();
