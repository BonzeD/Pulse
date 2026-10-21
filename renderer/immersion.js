/* Immersion is a visual style of the native lyrics stage, not a second player. */
window.PulseImmersion = (() => {
  'use strict';
  const C = window.PulseImmersionCore;
  let canvas, scene, stage, raf = 0, last = 0, travel = 0, ambient = 0, frames = 0;
  let track = null, seed = 0, tint = C.coverColor(null), token = 0, slow = 0, eco = false;
  let contextLost = false, error = null, quality = 'auto', world = 2, reduced = false;
  const director = C.create();
  const active = () => !!stage?.isConnected && stage.dataset.vis === 'immersion';
  const hidden = () => document.hidden || !!window.pulseWinHidden;
  const motion = () => matchMedia('(prefers-reduced-motion: reduce)').matches || S().look.anim === false;
  const stop = () => { cancelAnimationFrame(raf); raf = 0; last = 0; };
  function showError(message) {
    stop();
    if (!error) {
      error = document.createElement('div'); error.className = 'lys-scene-error';
      error.setAttribute('role', 'alert');
      stage.append(error);
    }
    error.textContent = message;
  }
  function syncTrack() {
    const t = curTrack(), key = t ? String(t.id) : 'pulse-immersion';
    if (key === track) return;
    track = key; seed = C.world(key).seed; director.reset(key); travel = 0;
    tint = C.coverColor(null);
    const request = ++token;
    if (t) Promise.resolve(Viz.palette(artOf(t, 544))).then(p => {
      if (request === token) tint = C.coverColor(p);
    }).catch(() => {});
  }
  function tick(now) {
    raf = 0;
    if (!active() || hidden() || contextLost || !scene || error) { last = 0; return; }
    raf = requestAnimationFrame(tick);
    reduced = motion();
    const gap = reduced ? 100 : eco ? 1000 / 30 : Math.max(1000 / 60, S().perf.fps > 0 ? 1000 / S().perf.fps : 0);
    if (now - last < gap - 1) return;
    const elapsed = last ? now - last : 16.7, dt = Math.min(.2, elapsed / 1000); last = now;
    syncTrack(); ambient += reduced ? 0 : dt;
    const fr = readSpectrum(now, outLat() * 1000 + (S().viz.lag || 0));
    const s = director.step({id:track, dt, freq:fr?.f, wave:fr?.w, sampleRate:fr?.sampleRate || 48000, fftSize:fr?.fftSize || 2048, playing:!!playing, calm:reduced, position:E.time()});
    travel += reduced ? 0 : s.speed * dt;
    const start = performance.now();
    try {
      scene.draw({width:stage.clientWidth, height:stage.clientHeight, time:travel, ambientTime:ambient, audioTime:s.age,
        playing:!!playing, seed, world, energy:reduced ? 0 : s.power, bass:reduced ? 0 : s.bass,
        mid:reduced ? 0 : s.mid, treble:reduced ? 0 : s.treble, kick:reduced ? 0 : s.kick,
        calm:reduced ? 1 : 0, reduced:reduced ? 1 : 0, accent:tint, eco,
        pointer:reduced ? null : window.PulsePointer?.position(),
        software:scene.software && quality === 'auto', high:quality === 'high' || quality === 'auto' && S().perf.mode === 'high'});
      frames++;
    } catch (e) { console.error('Pulse scene', e); showError('Не удалось отрисовать сцену. Выбери другой режим выше — музыка продолжает играть.'); return; }
    slow = performance.now() - start > 25 ? slow + 1 : Math.max(0, slow - 1);
    if (quality === 'auto' && slow > 60) eco = true;
  }
  function start() {
    if (!active() || hidden() || contextLost || error) return;
    if (!scene) {
      if (S().perf.gpu === false) return showError('Включи графику на видеокарте в настройках или выбери другой режим выше.');
      try { scene = window.PulseImmersionScene.create(canvas); }
      catch (e) { console.error('Pulse scene', e); return showError('Сцена требует WebGL. Выбери другой режим выше — музыка продолжает играть.'); }
      eco = quality === 'eco' || quality === 'auto' && (scene.software || S().perf.mode === 'eco');
    }
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function detach() {
    stop(); token++; scene?.destroy(); scene = null; canvas?.remove(); error?.remove();
    canvas = stage = error = null; track = null; contextLost = false;
  }
  function attach(st) {
    if (stage === st) return start();
    detach(); stage = st; world = S().ly.kWorld === 'ocean' ? 1 : 2;
    quality = ['auto', 'balanced', 'high', 'eco'].includes(S().ly.kSceneQuality) ? S().ly.kSceneQuality : 'auto';
    canvas = document.createElement('canvas'); canvas.className = 'lys-scene';
    canvas.setAttribute('aria-label', world === 1 ? 'Чёрное море' : 'Орбитальная станция');
    stage.prepend(canvas);
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); contextLost = true; showError('Графический контекст потерян. Переключи режим и вернись — музыка не прерывается.'); });
    canvas.addEventListener('webglcontextrestored', () => { scene?.destroy(); scene = null; contextLost = false; error?.remove(); error = null; start(); });
    start();
  }
  function configure() {
    world = S().ly.kWorld === 'ocean' ? 1 : 2;
    quality = ['auto', 'balanced', 'high', 'eco'].includes(S().ly.kSceneQuality) ? S().ly.kSceneQuality : 'auto';
    eco = quality === 'eco' || quality === 'auto' && (S().perf.mode === 'eco' || scene?.software);
    slow = 0; if (canvas) canvas.setAttribute('aria-label', world === 1 ? 'Чёрное море' : 'Орбитальная станция');
  }
  // Retained public entry point for integrations: always enters the native stage.
  function open() {
    if (typeof czE !== 'undefined' && czE.on) return toast('Сначала закрой редактор: «Готово» или «Отмена»');
    S().ly.vis = 'immersion'; save();
    if (lys.on) lysApply(); else lyStageOpen(true);
  }
  const close = () => { if (active()) lyStageOpen(false); };
  document.addEventListener('visibilitychange', () => { if (hidden()) stop(); else start(); });
  // Electron can hide/minimize without changing document.visibilityState.
  setInterval(() => { if (hidden()) stop(); else if (active() && !raf) start(); }, 600);
  return {open, close, attach, detach, configure, active, stats:() => ({active:active(), world, quality, eco, reduced, contextLost, draws:frames, travel, ambient, raf:!!raf, renderer:scene?.stats?.() || null})};
})();
