/* Five quick activations of the existing brand reveal a persistent Prism lens.
 * Sound stays on the existing local/YouTube signal and shared transport. */
window.PulsePrism = (() => {
  'use strict';
  const brand=document.getElementById('brand');
  const motion=matchMedia('(prefers-reduced-motion: reduce)'),colors=matchMedia('(forced-colors: active)');
  const text={
    ru:{title:'Prism · живая музыка',close:'Вернуться',hint:'Esc — вернуться к музыке',live:'Свет следует за музыкой',wait:'Включи музыку — свет оживёт',calm:'Спокойный режим · движение отключено'},
    en:{title:'Prism · live music',close:'Return',hint:'Esc — back to music',live:'Light follows your music',wait:'Play music to bring the light to life',calm:'Calm mode · motion disabled'},
    ja:{title:'Prism · ライブミュージック',close:'戻る',hint:'Esc — 音楽に戻る',live:'音楽に寄り添う光',wait:'音楽を再生すると光が動き出します',calm:'静かなモード · 動きを停止'},
    uk:{title:'Prism · жива музика',close:'Повернутися',hint:'Esc — повернутися до музики',live:'Світло слідує за музикою',wait:'Увімкни музику — світло оживе',calm:'Спокійний режим · рух вимкнено'}
  };
  let spectrumBars=[],host=null,art=null,model=null,focusBefore=null,releaseTimer=0,closing=false;
  let clicks=0,firstClick=0,lastClick=0,lastStatus='',opened=0,draws=0;
  const inertBefore=new Map();
  const active=()=>!!host&&!closing;
  const hidden=()=>document.hidden||!!window.pulseWinHidden;
  const calm=()=>motion.matches||S().look.anim===false;
  const words=()=>text[window.PulseI18n?.language?.()]||text.en;
  function status(kind){
    if(!host)return;
    const t=words(),key=calm()?'calm':kind;
    const content=t[key]||t.wait;
    if(content!==lastStatus){host.querySelector('.sp-live-status').textContent=content;host.dataset.signal=key;lastStatus=content;}
  }
  function sample(now,dt){
    // Same delayed source as the main visualizers: no duplicate AudioContext,
    // microphone request, track switch, playback restart or fake oscillator.
    const fr=readSpectrum(now,outLat()*1000+(S().viz.lag||0));
    const state=model.step(fr,dt);status(state.signal?'live':'wait');drawMiniSpectrum(state);return state;
  }
  function drawMiniSpectrum(state){
    const live=state?.signal&&!(typeof playing==='boolean'&&!playing);
    for(let i=0;i<spectrumBars.length;i++){
      const position=i*(8/(spectrumBars.length-1)),band=Math.floor(position),mix=position-band;
      const level=live?Math.max(0,Math.min(1,(state.bands[band]||0)*(1-mix)+(state.bands[Math.min(8,band+1)]||0)*mix)):0;
      spectrumBars[i].style.transform='scaleY('+Math.max(2/28,level).toFixed(4)+')';
    }
  }
  function translate(){
    if(!host)return;const t=words();
    host.setAttribute('aria-label',t.title);host.querySelector('.sp-live-back span').textContent=t.close;
    host.querySelector('.sp-live-back').setAttribute('aria-label',t.close+' (Esc)');host.querySelector('.sp-live-hint')?.remove();
    lastStatus='';status(model?.state.signal?'live':'wait');
  }
  function syncBackground(){
    // Native stage state and settings are untouched. Only invisible rendering
    // is suspended; shared audio, DJ queues, timecode and system media continue.
    if(typeof mrSync==='function')mrSync();
    if(typeof lys!=='undefined'&&lys.on){cancelAnimationFrame(lys.raf);lys.raf=0;if(!active()&&!hidden())lys.raf=requestAnimationFrame(lysLoop);}
    window.dispatchEvent(new Event('pulse-prism-visibility'));
  }
  function makeArt(){
    if(!host||closing)return;
    art?.destroy();art=null;
    // A released WebGL context cannot be resurrected with getContext on the
    // old canvas. Replace only on media changes/rebuilds, never in a frame.
    const oldCanvas=host.querySelector('canvas');oldCanvas.replaceWith(oldCanvas.cloneNode(false));
    host.classList.remove('sp-prism-ready','sp-prism-fallback');
    host.classList.toggle('sp-calm',calm());
    if(calm()||colors.matches){drawMiniSpectrum(null);host.classList.add('sp-prism-fallback');status(calm()?'calm':'wait');return;}
    try{art=window.PulsePrismArt(host.querySelector('canvas'),host,{live:true,sample,onCalm:makeArt,onLoss:()=>{drawMiniSpectrum(null);status('wait');}});}
    catch{host.classList.add('sp-prism-fallback');}
    art?.visible(!hidden());status('wait');
  }
  function onVisibility(){if(!active())return;host.classList.toggle('wait',hidden());art?.visible(!hidden());}
  function onMedia(){makeArt();translate();}
  function onKey(e){
    if(!active())return;
    if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();return;}
    if(e.code==='Space'){e.preventDefault();e.stopImmediatePropagation();toggle();return;}
    if(e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();close();return;}
    if(e.key==='Tab'){e.preventDefault();e.stopImmediatePropagation();host.querySelector('.sp-live-back').focus({preventScroll:true});}
  }
  function remove(){
    clearTimeout(releaseTimer);releaseTimer=0;if(!host)return;
    host.remove();spectrumBars=[];host=null;model=null;closing=false;document.body.classList.remove('prism-live');
    for(const [el,inert]of inertBefore)el.inert=inert;inertBefore.clear();
    syncBackground();
    if(focusBefore?.isConnected&&!focusBefore.closest('[inert]'))focusBefore.focus({preventScroll:true});else brand?.focus({preventScroll:true});
    focusBefore=null;
  }
  function close(immediate=false){
    if(!host||closing)return;closing=true;draws+=art?.stats().frames||0;art?.destroy();art=null;
    window.removeEventListener('keydown',onKey,true);window.removeEventListener('pulse-language',translate);
    document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('pulse-window-visibility',onVisibility);
    motion.removeEventListener('change',onMedia);colors.removeEventListener('change',onMedia);
    if(immediate||calm()||hidden()){remove();return;}
    // Remain modal/inert until the short fade has fully finished.
    host.classList.add('bye');releaseTimer=setTimeout(remove,520);
  }
  function open(){
    if(host||document.getElementById('splash')||document.querySelector('.pulse-tools'))return false;
    clicks=0;lastClick=firstClick=0;lastStatus='';closing=false;model=PulsePrismSignal.create();focusBefore=document.activeElement;
    host=document.createElement('section');host.id='prismLive';host.className='prism-live-scene';host.dataset.style='prism';
    host.setAttribute('role','dialog');host.setAttribute('aria-modal','true');host.tabIndex=-1;
    host.innerHTML='<div class="sp-prism-static"></div><canvas class="sp-prism" aria-hidden="true"></canvas><div class="sp-vig"></div><div class="sp-grain"></div><button type="button" class="sp-live-back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 6l-6 6 6 6"/></svg><span></span><kbd>Esc</kbd></button><div class="sp-core"><p class="sp-live-eyebrow">PRISM / LIVE</p><div class="sp-word" aria-label="Pulse" data-i18n-skip><b>P</b><b>u</b><b>l</b><b>s</b><b>e</b></div><div class="sp-signal" aria-hidden="true"><i></i></div><div class="sp-mini-spectrum" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><p class="sp-live-status" data-i18n-skip></p></div>';
    for(const el of document.body.children)if(el instanceof HTMLElement&&!['SCRIPT','STYLE','LINK'].includes(el.tagName)){inertBefore.set(el,el.inert);el.inert=true;}
    document.body.appendChild(host);spectrumBars=[...host.querySelectorAll('.sp-mini-spectrum i')];drawMiniSpectrum(null);document.body.classList.add('prism-live');opened++;
    host.querySelector('.sp-live-back').addEventListener('click',()=>close());
    // Invisible chrome, but mouse/touch users can leave with a double tap.
    host.addEventListener('dblclick',()=>close());
    window.addEventListener('keydown',onKey,true);window.addEventListener('pulse-language',translate);
    document.addEventListener('visibilitychange',onVisibility);window.addEventListener('pulse-window-visibility',onVisibility);
    motion.addEventListener('change',onMedia);colors.addEventListener('change',onMedia);
    translate();syncBackground();makeArt();onVisibility();host.focus({preventScroll:true});return true;
  }
  if(brand){
    brand.setAttribute('role','button');brand.tabIndex=0;
    // Existing home navigation is preserved on ordinary clicks. Only the fifth
    // one is consumed, before the original onclick gets the same activation.
    brand.addEventListener('click',e=>{
      if(e.button>0||host)return;const now=performance.now();
      if(!clicks||now-lastClick>450||now-firstClick>1600){clicks=0;firstClick=now;}
      lastClick=now;if(++clicks===5){clicks=0;e.preventDefault();e.stopImmediatePropagation();open();}
    },true);
    brand.addEventListener('keydown',e=>{if(!e.repeat&&(e.key==='Enter'||e.key===' ')){e.preventDefault();e.stopPropagation();brand.click();}});
  }
  window.addEventListener('pagehide',()=>{close(true);if(closing)remove();});
  function setCoverPalette(p){
    const fallback=[[243,220,231],[215,201,239],[198,220,230]];
    const valid=Array.isArray(p)&&p.length>=3&&p.slice(0,3).every(c=>Array.isArray(c)&&c.length>=3&&c.every(v=>Number.isFinite(v)&&v>=0&&v<=255));
    const chosen=valid?p:fallback,st=document.documentElement.style;
    // Only once per decoded cover, never in the audio/render loop. Brighten
    // very dark art so the identity remains legible on the near-black scene.
    chosen.slice(0,3).forEach((c,i)=>{const rgb=c.map(v=>Math.round(v*.62+255*.38));st.setProperty('--prism-ink'+(i+1),rgb.join(','));});
  }
  return{open,close,active,setCoverPalette,stats:()=>({active:active(),opened,draws:draws+(art?.stats().frames||0),renderer:art?.stats()||null,signal:!!model?.state.signal})};
})();
