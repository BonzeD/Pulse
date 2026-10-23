'use strict';
// Pulse API — шина событий и публичный интерфейс для плагинов (см. PLUGINS.md).
// Загружается первым; функции плеера подхватываются из app.js лениво.
const PX = (() => {
  const H = {}, trackMenu = [], tabs = [];
  return {
    on(ev, fn) { (H[ev] = H[ev] || []).push(fn); return () => { H[ev] = (H[ev] || []).filter((f) => f !== fn); }; },
    emit(ev, a) { const L = H[ev]; if (!L) return; for (const f of L) try { f(a); } catch (e) { console.error('[plugin]', ev, e); } },
    trackMenu, tabs
  };
})();
const fix = { tap: null, tab: 'time', q: null, res: null, busy: false }; let fixOpen = false;
const plug = { list: [], ok: {}, err: {} };
window.Pulse = {
  version: '1.0.2',
  on: PX.on,
  registerVisual: (v) => Viz.register(Object.assign(v, { plugin: true })),
  get visuals() { return Viz.STYLES.map((v) => ({ id: v.id, name: v.name })); },
  setVisual: (id) => setViz(id),
  addSettingsTab: (t) => { PX.tabs.push(t); try { rerenderSettings(); } catch {} },
  addTrackMenuItem: (fn) => PX.trackMenu.push(fn),
  addIcon(id, viewBox, inner) { id = /^i-/.test(id) ? id : 'i-' + id; const svg = document.querySelector('svg defs')?.parentNode; if (!svg || document.getElementById(id)) return; const s = document.createElementNS('http://www.w3.org/2000/svg', 'symbol'); s.id = id; s.setAttribute('viewBox', viewBox || '0 0 24 24'); s.innerHTML = inner; svg.appendChild(s); },
  get dj() { return typeof DJ !== 'undefined' ? DJ : null; },
  icon: (id) => ico(id),
  toast: (m, i) => toast(m, i),
  player: {
    toggle: () => toggle(), next: () => next(), prev: () => prev(), seek: (s) => E.seek(s), time: () => E.time(), duration: () => E.dur(),
    playing: () => playing, current: () => { const t = curTrack(); return t ? { ...t } : null; }, volume: (v) => (v == null ? lib.volume : setVolume(v)),
    tempo: () => tempoAt(E.time()), bands: () => Viz.bands()
  },
  lyrics: { lines: () => (lyState.lines || []).map((l) => ({ ...l })), current: () => lyState.curText, openCorrector: () => openFix() },
  storage(ns) {
    const box = () => ((lib.plugData = lib.plugData || {})[ns] = lib.plugData[ns] || {});
    return { get: (k, d) => (k in box() ? box()[k] : d), set: (k, v) => { box()[k] = v; save(); } };
  }
};
window.addEventListener('error', (e) => { const m = String(e.filename || '').match(/\/plugins\/([^?#]+)/); if (m) plug.err[decodeURIComponent(m[1])] = e.message; });
