/* One event-driven pointer service. No always-running animation loop, no audio writes. */
window.PulsePointer = (() => {
  'use strict';
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  let sx = 0, sy = 0, clock = 0, light = null, savedPosition = null;
  let x = 0, y = 0, frame = 0, target = null, rect = null, cx = 0, cy = 0;
  // Keep cover lighting off the title/subtitle area of catalog cards.
  const selector = '.card .ca,.tr-card,.vcard,.ha,.lys-art,#artWrap > .art,#bArt,.viz-wrap,.pp-vis';
  const enabled = () => !media.matches && fine.matches && !document.hidden && !window.pulseWinHidden && (typeof S !== 'function' || S().look.anim !== false);
  function clear(resetCamera = false) {
    cancelAnimationFrame(frame); frame = 0; if (resetCamera === true) { x = y = 0; }
    if (target) { if(light){const old=light;old.style.opacity='0';setTimeout(()=>old.remove(),260);light=null;}if(savedPosition!==null){target.style.position=savedPosition;savedPosition=null;}target.classList.remove('pulse-pointer'); for (const key of ['--pointer-x','--pointer-y','--pointer-rx','--pointer-ry']) target.style.removeProperty(key); }
    target = rect = null;
  }
  function flush() {
    frame = 0; if(light) light.style.opacity='1'; if (!enabled()) return clear(true);
    if (!target?.isConnected || !rect) return;
    const px = Math.max(0, Math.min(rect.width, cx - rect.left)), py = Math.max(0, Math.min(rect.height, cy - rect.top));
    target.style.setProperty('--pointer-x', px.toFixed(1)+'px'); target.style.setProperty('--pointer-y', py.toFixed(1)+'px');
    target.style.setProperty('--pointer-rx', ((.5-py/Math.max(1,rect.height))*3).toFixed(2)+'deg');
    target.style.setProperty('--pointer-ry', ((px/Math.max(1,rect.width)-.5)*3).toFixed(2)+'deg');
  }
  document.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || !enabled()) return clear(true);
    cx = e.clientX; cy = e.clientY; x = cx / Math.max(1,innerWidth)*2-1; y = cy / Math.max(1,innerHeight)*2-1;
    const next = e.target.closest?.(selector);
    // Never paint an artwork light over a playing video or its controls.
    if (next?.closest?.('#artWrap.video')) return clear(true);
    if (next !== target) {
      clear(); target=next;
      if (target) { rect=target.getBoundingClientRect();target.classList.add('pulse-pointer');
        if(getComputedStyle(target).position==='static'){savedPosition=target.style.position;target.style.position='relative';}
        light=document.createElement('span');light.className='pulse-pointer-light';light.setAttribute('aria-hidden','true');light.style.opacity='0';target.append(light);void light.offsetWidth; }
    }
    if (target && !frame) frame = requestAnimationFrame(flush);
  }, {passive:true});
  document.addEventListener('pointerout', e => { if (!e.relatedTarget) clear(true); }, {passive:true});
  document.addEventListener('scroll', clear, {passive:true,capture:true});
  window.addEventListener('resize', clear, {passive:true}); window.addEventListener('blur', clear);
  document.addEventListener('visibilitychange', clear);media.addEventListener('change',clear);fine.addEventListener('change',clear);
  return {position:() => {
    if(!enabled()) return null;
    const now=performance.now(), mix=1-Math.exp(-Math.min(.1,(now-(clock||now-16))/1000)*9);clock=now;
    sx+=(x-sx)*mix;sy+=(y-sy)*mix;return {x:sx,y:sy};
  }, clear};
})();
