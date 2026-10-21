/* Pulse 1.0.0: interruptible navigation motion, resizable sidecar, recoverable player bar. */
(() => {
  'use strict';
  const B = document.body, pp = $('pp'), side = $('side'), bar = $('bar');
  const reduced = () => !animOn() || matchMedia('(prefers-reduced-motion: reduce)').matches;
  let motions = [];
  const cancelMotion = () => { for (const a of motions) a.cancel(); motions = []; B.classList.remove('sidebar-moving'); };
  const navClick = $('btnNav').onclick;
  $('btnNav').onclick = function (e) {
    // Read visible (already interpolated) geometry before cancelling an interrupted move.
    const nodes = [side, ...side.querySelectorAll('.nv, .nv > svg, .nv > span, .nv > em, .cl-sw, .cl-sw > button, .new-pl, .side-list, .side-sep, .clean-nav > summary')];
    const before = new Map(nodes.map(el => [el, el.getBoundingClientRect()]));
    cancelMotion();
    navClick.call(this, e);
    if (reduced() || getComputedStyle(side).display === 'none') return;
    const finalRects = new Map(nodes.map(el => [el, el.getBoundingClientRect()]));
    const first = before.get(side), after = finalRects.get(side);
    if (!after.width || !first.width) return;
    B.classList.add('sidebar-moving');
    const visible = nodes.filter(el => finalRects.get(el).width && finalRects.get(el).height);
    const interpolate = (el, t) => {
      const r = finalRects.get(el), a = before.get(el);
      return { x: a.width ? a.x + (r.x - a.x) * t : r.x,
        y: a.height ? a.y + (r.y - a.y) * t : r.y + (1 - t) * 8,
        width: a.width ? a.width + (r.width - a.width) * t : r.width,
        height: a.height ? a.height + (r.height - a.height) * t : r.height };
    };
    for (const el of visible) {
      const r = finalRects.get(el), a = before.get(el);
      let parent = el.parentElement;
      while (parent && !visible.includes(parent)) parent = parent.parentElement;
      const pr = parent && finalRects.get(parent);
      const frames = Array.from({ length: 21 }, (_, i) => {
        const t = i / 20, d = interpolate(el, t), pd = parent ? interpolate(parent, t) : null;
        const psx = pd ? pd.width / pr.width : 1, psy = pd ? pd.height / pr.height : 1;
        const x = pd ? (d.x - pd.x) / psx - (r.x - pr.x) : d.x - r.x;
        const y = pd ? (d.y - pd.y) / psy - (r.y - pr.y) : d.y - r.y;
        return { offset: t, opacity: a.width ? 1 : t, transform: `translate(${x}px,${y}px) scale(${d.width / r.width / psx},${d.height / r.height / psy})` };
      });
      motions.push(el.animate(frames, { duration: 320, easing: 'cubic-bezier(.22,.8,.3,1)' }));
    }
    Promise.all(motions.map(a => a.finished.catch(() => {}))).then(() => {
      if (!side.getAnimations().some(a => a.playState === 'running')) B.classList.remove('sidebar-moving');
    });
  };
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', cancelMotion);

  // A real separator rather than CSS zoom: text keeps its font size and wraps naturally.
  const pane = pp.querySelector('.pp-side'), grip = document.createElement('div');
  grip.id = 'ppResize'; grip.className = 'pp-resize'; grip.tabIndex = 0;
  grip.setAttribute('role', 'separator'); grip.setAttribute('aria-orientation', 'vertical');
  grip.setAttribute('aria-label', 'Ширина панели: Далее, Текст, Похожие');
  grip.title = 'Потяни, чтобы изменить ширину. Двойной клик — сброс. Стрелки ← → — точная настройка';
  grip.innerHTML = '<i></i>'; pane.prepend(grip);
  let drag = null;
  const limits = () => ({ min: 260, max: Math.max(260, Math.min(720, B.classList.contains('clean-panel-only') ? innerWidth - 48 : pp.clientWidth * .58)) });
  function panelWidth(value, persist = false) {
    const { min, max } = limits(), width = Math.round(Math.max(min, Math.min(max, value || Math.min(480, innerWidth * .38))));
    pp.style.setProperty('--pp-panel-width', width + 'px');
    grip.setAttribute('aria-valuemin', min); grip.setAttribute('aria-valuemax', Math.round(max)); grip.setAttribute('aria-valuenow', width);
    scC = null;
    if (persist) { S().ui.playerPanelWidth = width; save(); }
    return width;
  }
  function syncPanel() { panelWidth(+S().ui.playerPanelWidth); }
  grip.addEventListener('pointerdown', e => {
    if (e.button !== 0) return; e.preventDefault(); e.stopPropagation();
    drag = { id: e.pointerId, x: e.clientX, width: pane.getBoundingClientRect().width, saved: S().ui.playerPanelWidth };
    grip.setPointerCapture(e.pointerId); B.classList.add('panel-resizing');
  });
  grip.addEventListener('pointermove', e => { if (drag && e.pointerId === drag.id) panelWidth(drag.width + drag.x - e.clientX); });
  function endDrag(e, cancel = false) {
    if (!drag || e.pointerId !== drag.id) return;
    const old = drag; drag = null; B.classList.remove('panel-resizing');
    if (cancel) panelWidth(old.saved); else panelWidth(parseFloat(pp.style.getPropertyValue('--pp-panel-width')), true);
    if (grip.hasPointerCapture(old.id)) grip.releasePointerCapture(old.id);
    Viz.resize();
  }
  grip.addEventListener('pointerup', e => endDrag(e));
  grip.addEventListener('pointercancel', e => endDrag(e, true));
  grip.addEventListener('lostpointercapture', e => endDrag(e));
  const resetPanel = () => { S().ui.playerPanelWidth = 0; syncPanel(); save(); };
  grip.addEventListener('dblclick', resetPanel);
  grip.addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(e.key)) return;
    e.preventDefault(); e.stopPropagation();
    if (e.key === 'Escape' && drag) return endDrag({ pointerId: drag.id }, true);
    if (e.key === 'Home') return resetPanel();
    const v = e.key === 'End' ? limits().max : +grip.getAttribute('aria-valuenow') + (e.key === 'ArrowLeft' ? 1 : -1) * (e.shiftKey ? 40 : 16);
    panelWidth(v, true); Viz.resize();
  });
  window.addEventListener('resize', () => { cancelMotion(); syncPanel(); });

  const hide = document.createElement('button'); hide.id = 'btnBarHide'; hide.type = 'button'; hide.className = 'ib sm';
  hide.title = 'Скрыть панель плеера (Ctrl+Shift+B)'; hide.setAttribute('aria-label', 'Скрыть панель плеера'); hide.innerHTML = ico('down'); bar.append(hide);
  const zone = document.createElement('div'); zone.id = 'barRevealZone';
  const show = document.createElement('button'); show.id = 'btnBarShow'; show.type = 'button'; show.className = 'chip'; show.innerHTML = ico('up') + '<span>Показать плеер</span>'; show.title = 'Показать панель плеера (Ctrl+Shift+B)'; zone.append(show); B.append(zone);
  let barOff = false, pointer = null;
  function revealAtPointer() {
    const near = barOff && pointer && pointer.x >= 0 && pointer.x <= innerWidth && pointer.y <= innerHeight && pointer.y >= innerHeight - 104 && Math.abs(pointer.x - innerWidth / 2) <= Math.min(180, (innerWidth - 32) / 2);
    B.classList.toggle('player-reveal-hover', !!near);
  }
  function syncBar() {
    const hidden = S().ui.playerBarHidden === true;
    B.classList.toggle('player-bar-hidden', hidden);
    barOff = hidden || (B.classList.contains('lyonly') && !B.classList.contains('lys-bar'));
    // Input is disabled at once; visibility waits until the exit animation has finished.
    bar.inert = barOff; bar.setAttribute('aria-hidden', String(barOff));
    show.hidden = zone.hidden = !barOff;
    revealAtPointer();
  }
  function setBar(hidden, keyboard = false) {
    if (hidden && bar.contains(document.activeElement)) document.activeElement.blur();
    S().ui.playerBarHidden = hidden;
    if (!hidden && B.classList.contains('lyonly') && S().ly.kBar === 'off') S().ly.kBar = 'on';
    if (typeof lybSync === 'function') lybSync();
    syncBar(); save();
    if (keyboard) (hidden ? show : hide).focus({ preventScroll: true });
  }
  hide.onclick = e => { e.stopPropagation(); setBar(true, e.detail === 0); };
  show.onclick = e => { e.stopPropagation(); setBar(false, e.detail === 0); };
  window.addEventListener('pointermove', e => { pointer = { x: e.clientX, y: e.clientY }; revealAtPointer(); }, { passive: true });
  // Leaving the native strip can land inside an iframe: no parent move follows.
  zone.addEventListener('pointerleave', () => { pointer = null; revealAtPointer(); });
  zone.addEventListener('pointerenter', e => { pointer = { x: e.clientX, y: e.clientY }; revealAtPointer(); });
  document.documentElement.addEventListener('pointerleave', () => { pointer = null; revealAtPointer(); });
  window.addEventListener('blur', () => { pointer = null; revealAtPointer(); });
  window.addEventListener('resize', revealAtPointer);
  window.addEventListener('keydown', e => {
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyB' && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && !e.target.isContentEditable) { e.preventDefault(); setBar(!S().ui.playerBarHidden, true); }
  });
  const apply = applyCustom; applyCustom = function () { const r = apply.apply(this, arguments); syncPanel(); syncBar(); return r; };
  const open = openPP; openPP = function () { const r = open.apply(this, arguments); syncPanel(); return r; };
  new MutationObserver(syncBar).observe(B, { attributes: true, attributeFilter: ['class'] });
  syncPanel(); syncBar();
})();

/* Settings workspace: size from actual view/player geometry, never guessed sticky offsets. */
(()=>{
 let pending=0,current=null;const V=$('view'),P=$('page');if(!V||!P)return;
 function layout(){pending=0;const w=P.querySelector(':scope>.set-wrap.set2');if(!w||w.querySelector('.set-full')){document.body.classList.remove('settings-nav-open');V.style.removeProperty('--settings-mobile');if(current){current.classList.remove('settings-workspace');current.style.removeProperty('--settings-height');}current=null;return;}
  if(current!==w){current=w;V.scrollTop=0;w.classList.add('settings-workspace');}
  const r=w.getBoundingClientRect(),vr=V.getBoundingClientRect(),bar=$('bar'),br=bar?.getBoundingClientRect();let bottom=Math.min(innerHeight,vr.bottom)-16;
  if(br&&br.width>0&&br.height>0&&getComputedStyle(bar).visibility!=='hidden'&&getComputedStyle(bar).display!=='none'&&br.top>r.top+160)bottom=Math.min(bottom,br.top-20);
  const zoom=w.offsetWidth?r.width/w.offsetWidth:1;const height=Math.max(180,Math.floor((bottom-r.top)/Math.max(.25,zoom)));
  if(w.style.getPropertyValue('--settings-height')!==height+'px')w.style.setProperty('--settings-height',height+'px');
  if(!document.body.classList.contains('ui-clean')){let select=w.querySelector('.settings-mobile-nav');if(!select){select=document.createElement('select');select.className='settings-mobile-nav';select.setAttribute('aria-label','Раздел настроек');select.addEventListener('change',()=>{w.querySelector('[data-stab="'+CSS.escape(select.value)+'"]')?.click();});w.querySelector('.set-side').append(select);}
   const tabs=allTabs(),stamp=tabs.map(t=>t.id+':'+t.title).join('|');if(select.dataset.tabs!==stamp){select.replaceChildren(...tabs.map(t=>{const option=document.createElement('option');option.value=t.id;option.textContent=window.PulseI18n?PulseI18n.t(t.title):t.title;return option;}));select.dataset.tabs=stamp;}select.value=lib.setTab||tabs[0]?.id;
  }
 }
 function schedule(){if(!pending)pending=requestAnimationFrame(layout);}
 new MutationObserver(schedule).observe(P,{childList:true});
 const resize=new ResizeObserver(schedule);resize.observe(V);if($('bar'))resize.observe($('bar'));
 window.addEventListener('resize',schedule);document.addEventListener('click',e=>{if(e.target.closest?.('[data-stab],[data-set],[data-tg],.clean-setting-picker'))setTimeout(schedule,0);});
 document.addEventListener('keydown',e=>{const a=e.target.closest?.('.set-side nav a[data-stab]');if(a&&(e.key==='Enter'||e.key===' ')){e.preventDefault();a.click();}});
 schedule();
})();
// On a narrow settings workspace the app menu is a drawer, not a 240px column.
document.addEventListener('click',e=>{const workspace=document.querySelector('.settings-workspace');if(!workspace||innerWidth>760||document.body.classList.contains('ui-clean'))return;if(e.target.closest?.('#btnNav')){e.preventDefault();e.stopImmediatePropagation();const open=document.body.classList.toggle('settings-nav-open');$('btnNav').setAttribute('aria-expanded',String(open));}else if(e.target.closest?.('#view')){document.body.classList.remove('settings-nav-open');$('btnNav')?.setAttribute('aria-expanded','false');}},true);
