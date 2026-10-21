'use strict';
// Диджей-пульт Pulse: две деки, кроссфейдер, ручки каналов, эффекты, лупы, хот-кью,
// автомикс по долям/фразам с подгонкой темпа и фазы, выбор треков из очереди/поиска/плейлистов.
// Деки — decks[0] и decks[1] из app.js. «В эфире» та, что сейчас в audio.
const dj = {
  busy: false, from: null, fromNodes: null, fromId: null, timer: null, next: null, prepId: null, skipId: null, t0: 0, X: 0,
  rate: 1, rates: [1, 1], rateT: null, xf: 0, xfAnim: null, load: null, loops: [null, null], brake: [null, null],
  anFrom: null, anTo: null, plan: null, tab: 'queue', q: '', res: null, resQ: '', lists: null, fx: { echo: 0, rev: 0, eTo: 'both', rTo: 'both', fb: 45, beat: 0.75 },
  wf: {}, ids: [null, null]
};
const djK = [0, 1].map(() => ({ low: 0, mid: 0, high: 0, filter: 0, vol: 100, pitch: 0 }));
const djSleep = (ms) => new Promise((r) => setTimeout(r, ms));
const djAn = (t) => (t ? Promise.race([getAnalysis(t), djSleep(2500).then(() => null)]) : Promise.resolve(null));
const djA = () => Math.max(0, decks.indexOf(audio)), djO = () => 1 - djA();
const djClamp = (v, a, b) => Math.max(a, Math.min(b, v));
// ---------- скорость дек ----------
function djRateOf(a) { const i = decks.indexOf(a); if (i < 0) return 1; return dj.rates[i] * (1 + djK[i].pitch / 100); }
function djSetRate(i) { const a = decks[i]; if (!a || dj.brake[i]) return; a.playbackRate = (+S().audio.speed || 1) * djRateOf(a); a.preservesPitch = S().dj.keylock !== false; if (a === audio) dj.rate = dj.rates[i]; }
// ---------- кроссфейдер и каналы ----------
function djCurve(x) { // x: 0 = дека 1, 1 = дека 2 → [g0, g1]
  const c = S().dj.curve;
  if (c === 'linear') return [1 - x, x];
  if (c === 'sharp') return [djClamp((1 - x) * 8, 0, 1), djClamp(x * 8, 0, 1)];
  return [Math.cos(x * Math.PI / 2), Math.sin(x * Math.PI / 2)];
}
function djSetXf(x, tc = 0.015) {
  dj.xf = djClamp(x, 0, 1); if (!actx || !deckNodes.length) return;
  const g = djCurve(dj.xf); deckNodes.forEach((N, i) => { N.g.gain.cancelScheduledValues(0); N.g.gain.setTargetAtTime(g[i], actx.currentTime, tc); });
}
const djKillDb = (v) => (v <= -26 ? -60 : v);
function djApplyDeck(i) {
  const N = deckNodes[i]; if (!N || !actx) return; const k = djK[i], t = actx.currentTime, fv = k.filter / 100;
  N.uLow.gain.setTargetAtTime(djKillDb(k.low), t, 0.02); N.uMid.gain.setTargetAtTime(djKillDb(k.mid), t, 0.02); N.uHigh.gain.setTargetAtTime(djKillDb(k.high), t, 0.02);
  N.uLp.frequency.setTargetAtTime(fv < 0 ? 20000 * Math.pow(0.0075, -fv) : 22000, t, 0.03);
  N.uHp.frequency.setTargetAtTime(fv > 0 ? 10 * Math.pow(500, fv) : 10, t, 0.03);
  N.vol.gain.setTargetAtTime(Math.pow(k.vol / 100, 2), t, 0.02);
  djSetRate(i); djApplySends();
}
// ---------- эффекты: эхо в долю и реверб ----------
let djFx = null;
function djImpulse(sec) {
  const r = actx.sampleRate, n = Math.floor(r * sec), b = actx.createBuffer(2, n, r);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6); }
  return b;
}
function djBuildFx(bus, out) {
  const eIn = actx.createGain(), dl = actx.createDelay(4), fb = actx.createGain(), eW = actx.createGain(), eLp = actx.createBiquadFilter();
  eLp.type = 'lowpass'; eLp.frequency.value = 6000; fb.gain.value = 0.45; eW.gain.value = 0.9; dl.delayTime.value = 0.375;
  eIn.connect(dl); dl.connect(eLp); eLp.connect(fb); fb.connect(dl); eLp.connect(eW); eW.connect(out || bus);
  const rIn = actx.createGain(), cv = actx.createConvolver(), rW = actx.createGain(); cv.buffer = djImpulse(2.8); rW.gain.value = 0.8;
  rIn.connect(cv); cv.connect(rW); rW.connect(out || bus);
  deckNodes.forEach((N) => { N.send.connect(eIn); N.rsend = actx.createGain(); N.rsend.gain.value = 0; N.vol.connect(N.rsend); N.rsend.connect(rIn); });
  djFx = { eIn, dl, fb, eW, rIn, cv, rW };
  deckNodes.forEach((_, i) => djApplyDeck(i)); djSetXf(djA() ? 1 : 0, 0.001);
}
function djBeatSec() { const T = tempoAt(E.time()); return 60 / ((T.conf ? T.bpm : 120) * ((audio && audio.playbackRate) || 1)); }
function djApplySends() {
  if (!djFx) return; const F = dj.fx, t = actx.currentTime, on = (to, i) => to === 'both' || +to === i;
  deckNodes.forEach((N, i) => { if (!N.rsend) return; N.send.gain.setTargetAtTime(on(F.eTo, i) ? F.echo / 100 : 0, t, 0.02); N.rsend.gain.setTargetAtTime(on(F.rTo, i) ? F.rev / 100 : 0, t, 0.03); });
  djFx.fb.gain.setTargetAtTime(F.fb / 100 * 0.85, t, 0.05);
  djFx.dl.delayTime.setTargetAtTime(djClamp(djBeatSec() * F.beat, 0.05, 3.9), t, 0.05);
}
// ---------- анализ: края трека, доли и фразы ----------
function djEdges(an, dur) {
  if (!an || !an.energy || !dur) return { start: 0, end: dur || 0 };
  let s = 0, e = dur; for (let t = 0; t < Math.min(20, dur); t += 0.1) if (an.energy(t) > 0.06) { s = Math.max(0, t - 0.05); break; }
  for (let t = dur; t > dur - 25 && t > 0; t -= 0.1) if (an.energy(t) > 0.06) { e = Math.min(dur, t + 0.3); break; }
  return { start: s, end: e };
}
function djLen(an, rate) { // длина перехода в секундах
  const s = S().dj; if (s.unit === 'beats' && an && an.bpm) return (s.beats * 60) / (an.bpm * (rate || 1));
  return s.fade;
}
// момент старта перехода: начало фразы (кратно 16 долям от сильной доли), чтобы новый трек вступил «в квадрат»
function djPlanFor(t, an, d) {
  const s = S().dj, rate = audio.playbackRate || 1, ed = s.trim ? djEdges(an, d) : { end: d };
  const X = Math.min(djLen(an, 1) , d / 4); let at = ed.end - X;
  if (s.beat && s.phrase && an && an.grid && an.grid.length > 16) {
    const g = an.grid, d0 = an.down || 0, P = Math.max(4, Math.min(32, s.unit === 'beats' ? s.beats : 16));
    for (let k = g.length - 1; k >= 0; k--) if ((k - d0) % P === 0 && g[k] <= ed.end - X && g[k] > ed.end - X - 40) { at = g[k]; break; }
  } else if (s.beat && an && an.grid && an.grid.length) { const g0 = [...an.grid].reverse().find((x) => x <= at); if (g0 != null && at - g0 < 2) at = g0; }
  return { id: t.id, at: Math.max(0, at), X, end: ed.end, rate };
}
// ---------- выбор следующего ----------
function djNextPick() {
  const q = lib.queue, n = dj.next;
  if (dj.load) return dj.load;
  if (n && q.tracks[n.i] && q.tracks[n.i].id === n.t.id && (lib.shuffle || nextIdx(true) === n.i)) return n;
  const i = nextIdx(true); return i >= 0 ? { i, t: q.tracks[i] } : null;
}
function djPrepare() {
  const n = djNextPick(); if (!n) return; dj.next = n; if (dj.prepId === n.t.id) return; dj.prepId = n.t.id;
  const go = off[n.t.id] ? Promise.resolve({ ok: true }) : online() ? pulse.resolve(n.t.id) : Promise.resolve(null);
  go.then((r) => { if (r && r.ok) getAnalysis(n.t); });
}
function djTick(tm) {
  const s = S().dj; if (!s.on) return; djLoops(); if (dj.from) djPhaseLock();
  if (!s.auto || dj.busy || engine !== 'audio' || lib.repeat === 'one') return;
  if (dj.load && !decks[dj.load.d].paused) return; // диджей ведёт вручную
  const t = curTrack(), d = audio.duration; if (!t || !d || !isFinite(d) || d < 30 || dj.skipId === t.id) return;
  const an = beatState.an;
  if (!dj.plan || dj.plan.id !== t.id || (an && !dj.plan.an)) { dj.plan = djPlanFor(t, an, d); dj.plan.an = !!an; }
  if (dj.plan.end - tm < dj.plan.X + 45) djPrepare();
  if (tm >= dj.plan.at - 0.03 && tm < dj.plan.end) djStart(false);
}
// ---------- автоматика перехода ----------
function djEnvelope(O, N, oi, ni, at, X, style) {
  const n = 64, out = new Float32Array(n), inn = new Float32Array(n), G = (x) => djCurve(oi ? 1 - x : x);
  for (let i = 0; i < n; i++) { const g = G(i / (n - 1)); out[i] = g[oi]; inn[i] = g[ni]; }
  [O.g.gain, N.g.gain, O.low.gain, N.low.gain, O.hp.frequency, N.hp.frequency].forEach((a) => a.cancelScheduledValues(0));
  N.low.gain.value = 0; N.hp.frequency.value = 10; O.low.gain.value = 0; O.hp.frequency.value = 10;
  if (style === 'cut') X = Math.min(X, 0.08 + djBeatSec() * 0.25);
  if (style === 'brake' || style === 'echo') { // старый трек тормозит/уходит в эхо, новый — с первой доли
    O.g.gain.setValueAtTime(O.g.gain.value, at); O.g.gain.linearRampToValueAtTime(0, at + X);
    N.g.gain.setValueAtTime(0, at); N.g.gain.linearRampToValueAtTime(inn[n - 1], at + Math.min(0.12, X));
    return X;
  }
  O.g.gain.setValueCurveAtTime(out, at, X); N.g.gain.setValueCurveAtTime(inn, at, X);
  if (style === 'bass') {
    const m = at + X / 2; N.low.gain.setValueAtTime(-30, at); N.low.gain.setValueAtTime(-30, m - 0.04); N.low.gain.linearRampToValueAtTime(0, m + 0.04);
    O.low.gain.setValueAtTime(0, m - 0.04); O.low.gain.linearRampToValueAtTime(-30, m + 0.04);
  }
  if (style === 'filter') {
    O.hp.frequency.setValueAtTime(10, at); O.hp.frequency.exponentialRampToValueAtTime(2200, at + X);
    N.hp.frequency.setValueAtTime(1000, at); N.hp.frequency.exponentialRampToValueAtTime(10, at + X * 0.85);
  }
  return X;
}
function djBrake(i, sec = 1.1, stop = true) {
  const a = decks[i]; if (!a || a.paused) return; clearInterval(dj.brake[i]); const r0 = a.playbackRate, t0 = performance.now(), keep = a.preservesPitch; a.preservesPitch = false;
  dj.brake[i] = setInterval(() => {
    const p = (performance.now() - t0) / (sec * 1000);
    if (p >= 1) { clearInterval(dj.brake[i]); dj.brake[i] = null; if (stop) a.pause(); a.preservesPitch = keep; a.playbackRate = r0; djSetRate(i); return; }
    a.playbackRate = Math.max(0.07, r0 * (1 - p) * (1 - p));
  }, 30);
}
async function djStart(manual) {
  if (!S().dj.on) { if (manual) toast('Режим диджея выключен'); return; }
  if (engine !== 'audio') { if (manual) toast('Сведение работает в режимах «Песня» и «Визуал»'); return; }
  if (dj.busy) return;
  const n = djNextPick(); if (!n) { if (manual) toast('В очереди нет следующего трека'); return; }
  const t = n.t, url = audioUrl(t); if (!url) { if (manual) toast('Следующий трек недоступен офлайн'); return; }
  dj.busy = true; const curId = curTrack()?.id, s = S().dj;
  try {
    initAudioGraph(); actx.resume();
    const od = audio, oi = djA(), ni = 1 - oi, nd = decks[ni], O = deckNodes[oi], N = deckNodes[ni];
    const preloaded = dj.load && dj.load.t.id === t.id && nd.src;
    if (!preloaded) {
      if (!off[t.id]) { const r = await pulse.resolve(t.id); if (!r || !r.ok) throw new Error(r ? r.error : 'нет звука'); }
      if (curTrack()?.id !== curId) throw new Error('cancel');
      N.g.gain.cancelScheduledValues(0); N.g.gain.value = 0; nd.src = url;
      await new Promise((res) => { nd.addEventListener('canplay', res, { once: true }); nd.addEventListener('error', res, { once: true }); setTimeout(res, 9000); });
      if (nd.error || curTrack()?.id !== curId) throw new Error('cancel');
    }
    const anN = await djAn(t), anC = beatState.an, wasPlaying = preloaded && !nd.paused;
    let startAt = preloaded ? nd.currentTime : s.trim ? djEdges(anN, nd.duration).start : 0, rate = 1, delay = 0;
    const effC = anC && anC.bpm ? anC.bpm * ((od.playbackRate || 1) / (+S().audio.speed || 1)) : 0;
    if (s.beat && effC && anN && anN.bpm) {
      let r = effC / anN.bpm; if (r > 1.4) r /= 2; if (r < 0.71) r *= 2;
      if (Math.abs(r - 1) <= (s.range || 8) / 100) rate = r;
      if (!wasPlaying && anN.grid && anN.grid.length) { const d0 = anN.down || 0, g = anN.grid; let k = g.findIndex((x) => x >= startAt - 0.05); if (k >= 0) { while (k < g.length - 1 && (k - d0) % 4 !== 0) k++; startAt = g[k]; } }
      const T = tempoAt(E.time()); if (!wasPlaying && T.conf) { const per = 60 / T.bpm / (od.playbackRate || 1); const ph = ((T.pos % 4) + 4) % 4; delay = (4 - ph) % 1 * per; if (delay < 0.04) delay += per; }
    }
    if (!wasPlaying) nd.currentTime = startAt;
    dj.rates[ni] = wasPlaying ? dj.rates[ni] : rate; djK[ni].pitch = wasPlaying ? djK[ni].pitch : 0; djSetRate(ni);
    if (delay) await djSleep(delay * 1000 - 12);
    if (curTrack()?.id !== curId) throw new Error('cancel');
    const style = manual && s.style === 'cut' ? 'cut' : s.style;
    const X0 = manual ? Math.max(djLen(anC, 1), 2) : (dj.plan && dj.plan.X) || djLen(anC, 1);
    const X = djEnvelope(O, N, oi, ni, actx.currentTime + 0.02, X0, style);
    if (!wasPlaying) await nd.play().catch(() => {});
    if (style === 'brake') djBrake(oi, Math.min(X, 1.6), false);
    if (style === 'echo') { const F = dj.fx, e0 = F.echo, to = F.eTo; F.echo = 70; F.eTo = String(oi); djApplySends(); setTimeout(() => { F.echo = e0; F.eTo = to; djApplySends(); }, X * 1000 + 2500); }
    // текущим становится новый трек
    const q = lib.queue; if (q.idx >= 0 && q.idx !== n.i) hist.push(q.idx); q.idx = n.i; remember(t);
    dj.anFrom = anC; dj.anTo = anN; dj.fromId = curId;
    audio = nd; audioTrackId = t.id; dj.from = od; dj.fromNodes = O; dj.next = null; dj.prepId = null; dj.load = null; dj.plan = null; dj.t0 = performance.now(); dj.X = X; dj.xfFrom = dj.xf; dj.xfTo = ni;
    onTrackChange(); playing = !nd.paused; onPlayState(); onStarted();
    clearTimeout(dj.timer); dj.timer = setTimeout(() => djFinish(), X * 1000 + 250);
    setTimeout(djRender, 50);
  } catch (e) {
    dj.busy = false; if (e.message !== 'cancel') { dj.skipId = curId; if (manual) toast('Не получилось свести: ' + e.message, 'alert'); }
  }
}
// во время перехода держим доли обеих дек вместе (мягко подкручивая темп новой)
function djPhaseLock() {
  const s = S().dj, A = dj.anFrom, B = dj.anTo, od = dj.from, nd = audio; if (!s.beat || !A || !B || !od || od.paused || nd.paused) return;
  const pa = tempoOf(A, od.currentTime), pb = tempoOf(B, nd.currentTime); if (!pa || !pb) return;
  let e = ((pb.pos - pa.pos) % 1 + 1.5) % 1 - 0.5; const per = 60 / (pb.bpm * nd.playbackRate), es = e * per, i = decks.indexOf(nd);
  if (Math.abs(es) > 0.16) return; const base = (+S().audio.speed || 1) * djRateOf(nd);
  nd.playbackRate = Math.abs(es) < 0.008 ? base : base * (1 - djClamp(es * 0.9, -0.04, 0.04)); void i;
}
function djFinish(hard) {
  if (hard) djUnload();
  if (!dj.from) { if (hard && actx && deckNodes.length) djSetXf(djA() ? 1 : 0, 0.005); return; } clearTimeout(dj.timer);
  const od = dj.from, O = dj.fromNodes, ni = djA(), N = deckNodes[ni];
  try { od.pause(); od.removeAttribute('src'); od.load(); } catch {}
  for (const x of [O, N]) if (x) { [x.g.gain, x.low.gain, x.hp.frequency].forEach((a) => a.cancelScheduledValues(0)); x.low.gain.value = 0; x.hp.frequency.value = 10; }
  dj.loops[decks.indexOf(od)] = null; dj.from = null; dj.fromNodes = null; dj.busy = false; dj.anFrom = null;
  djSetXf(ni ? 1 : 0, 0.005);
  if (dj.rates[ni] !== 1 && !hard && S().dj.glide) djRateHome(ni); else if (hard) { dj.rates[ni] = 1; djSetRate(ni); }
  else djSetRate(ni);
  setTimeout(djRender, 30);
}
function djRateHome(i) {
  clearInterval(dj.rateT);
  dj.rateT = setInterval(() => { const d = 1 - dj.rates[i]; if (Math.abs(d) < 0.002) { dj.rates[i] = 1; clearInterval(dj.rateT); } else dj.rates[i] += d * 0.06; djSetRate(i); }, 250);
}
function djApply() { if (actx) applyEq(); }
// ---------- ручное сведение: загрузить в свободную деку ----------
async function djLoad(i, target) {
  if (!S().dj.on) return toast('Режим диджея выключен');
  const q = lib.queue, t = q.tracks[i]; if (!t) return;
  // в деку, которая в эфире, — значит «включить сейчас»
  if (target != null && decks[target] === audio) { djUnload(); return playIdx(i); }
  if (engine !== 'audio') return toast('Деки работают в режимах «Песня» и «Визуал» — сейчас играет встроенный YouTube');
  if (dj.from) djFinish();
  if (i === q.idx) return toast('Этот трек уже в эфире');
  const url = audioUrl(t); if (!url) return toast('Трек недоступен офлайн');
  initAudioGraph(); actx.resume();
  const d = djO(), a = decks[d];
  if (dj.load && dj.load.d === d) djUnload();
  dj.loading = { d, t }; djRender();
  if (!off[t.id]) { const r = await pulse.resolve(t.id); if (!r || !r.ok) { dj.loading = null; djRender(); return toast(r ? r.error : 'нет звука', 'alert'); } }
  dj.loading = null;
  if (decks.indexOf(audio) === d) return djRender();
  try { a.pause(); } catch {} a.src = url; dj.load = { i, t, d }; dj.rates[d] = 1; djK[d].pitch = 0; djSetRate(d); dj.loops[d] = null; dj.plan = null;
  a.addEventListener('loadedmetadata', () => { djAn(t).then((an) => { if (dj.load && dj.load.t.id === t.id && S().dj.trim) { const st = djEdges(an, a.duration).start; if (a.paused && a.currentTime < 0.5) a.currentTime = st; } djRender(); }); }, { once: true });
  toast(`Дека ${d + 1}: ${t.title}`, 'dj'); djRender();
}
function djUnload() { const L = dj.load; if (!L) return; const a = decks[L.d]; dj.load = null; if (a !== audio) try { a.pause(); a.removeAttribute('src'); a.load(); } catch {} }
// кроссфейдер дошёл до загруженной деки — она становится «в эфире»
function djCommit() {
  const L = dj.load; if (!L) return; const a = decks[L.d]; if (a === audio || a.paused) return;
  const q = lib.queue; if (!q.tracks[L.i] || q.tracks[L.i].id !== L.t.id) { const j = q.tracks.findIndex((x) => x.id === L.t.id); if (j < 0) return; L.i = j; }
  const od = audio; if (q.idx >= 0) hist.push(q.idx); q.idx = L.i; remember(L.t);
  audio = a; audioTrackId = L.t.id; dj.load = null; dj.plan = null; dj.next = null; dj.prepId = null;
  onTrackChange(); playing = !a.paused; onPlayState(); onStarted();
  // старая дека доигрывает беззвучно и останавливается, если кроссфейдер так и остался на новой
  setTimeout(() => { const oi = decks.indexOf(od); if (od !== audio && djCurve(dj.xf)[oi] < 0.02 && !(dj.load && dj.load.d === oi)) { try { od.pause(); od.removeAttribute('src'); od.load(); } catch {} dj.loops[oi] = null; djRender(); } }, 1500);
  djRender();
}
function djOnEnded() { // дека в эфире закончилась, а загруженная уже играет — просто переводим эфир
  if (dj.load && !decks[dj.load.d].paused) { djSetXf(dj.load.d ? 1 : 0, 0.05); djCommit(); return true; }
  return false;
}
// ---------- плей, кью, синк, лупы, хот-кью ----------
const djTrackOf = (i) => (decks[i] === audio ? curTrack() : dj.load && dj.load.d === i ? dj.load.t : dj.from === decks[i] ? (lib.queue.tracks.find((x) => x.id === dj.fromId) || null) : null);
const djAnOf = (i) => { const t = djTrackOf(i); if (!t) return null; if (decks[i] === audio && beatState.an) return beatState.an; const p = anCache.get(t.id); if (p && !p.done) p.then((an) => (p.done = an || true)); return p && p.done && p.done !== true ? p.done : null; };
function djPlay(i) {
  const a = decks[i]; if (a === audio) return playing ? E.pause() : E.play();
  if (!a.src) return djLoadNext(); initAudioGraph(); actx.resume();
  if (a.paused) a.play().catch(() => {}); else a.pause();
}
function djLoadNext() { if (dj.load) djUnload(); const n = djNextPick(); if (n) djLoad(n.i); else toast('В очереди нет следующего трека'); }
function djCue(i) { const a = decks[i], t = djTrackOf(i); if (!t) return; const c = (lib.cues && lib.cues[t.id]) || []; const at = c.find((x) => x != null); a.currentTime = at != null ? at : 0; if (a !== audio) a.pause(); }
function djSync(i) {
  const j = 1 - i, A = djAnOf(j), B = djAnOf(i), ai = decks[i], aj = decks[j];
  if (!A || !B || !A.bpm || !B.bpm) return toast('Ещё не знаю темп обоих треков');
  const effJ = A.bpm * djRateOf(aj); let r = effJ / B.bpm; if (r > 1.4) r /= 2; if (r < 0.71) r *= 2;
  dj.rates[i] = r; djK[i].pitch = 0; djSetRate(i);
  const pa = tempoOf(A, aj.currentTime), pb = tempoOf(B, ai.currentTime);
  if (pa && pb && !aj.paused) { let e = ((pb.pos - pa.pos) % 1 + 1.5) % 1 - 0.5; ai.currentTime = Math.max(0, ai.currentTime - e * 60 / B.bpm); }
  toast(`Дека ${i + 1}: ${Math.round(effJ)} BPM`, 'sync'); djRender();
}
function djLoopToggle(i, beats) {
  const a = decks[i], an = djAnOf(i); if (dj.loops[i] && dj.loops[i].n === beats) { dj.loops[i] = null; return djRender(); }
  const bpm = an && an.bpm ? an.bpm : tempoAt(a.currentTime).bpm, per = 60 / bpm; let st = a.currentTime;
  if (an && an.grid && an.grid.length) { const g = an.grid; let k = g.length - 1; while (k > 0 && g[k] > st) k--; if (st - g[k] < per) st = g[k]; }
  dj.loops[i] = { a: st, b: st + beats * per, n: beats }; djRender();
}
function djLoops() { dj.loops.forEach((L, i) => { if (!L) return; const a = decks[i]; if (!a.src) { dj.loops[i] = null; return; } if (a.currentTime >= L.b - 0.008) a.currentTime = L.a + (a.currentTime - L.b); }); }
function djHot(i, n, clear) {
  const t = djTrackOf(i); if (!t) return; lib.cues = lib.cues || {}; const c = lib.cues[t.id] = lib.cues[t.id] || [];
  const a = decks[i];
  if (clear) { c[n] = null; } else if (c[n] == null) { c[n] = +a.currentTime.toFixed(3); toast(`Метка ${n + 1}: ${fmt(c[n])}`, 'tap'); }
  else { a.currentTime = c[n]; if (a.paused && a !== audio) a.play().catch(() => {}); if (a === audio && !playing) E.play(); }
  save(); djRender();
}
function djNudge(i, d) { const a = decks[i]; if (!a.src) return; a.currentTime = Math.max(0, a.currentTime + d); }
function djSetK(i, f, v) { djK[i][f] = v; djApplyDeck(i); }
function djX(i, v) { djSetXf(v); if (dj.load && dj.load.d === (v > 0.97 ? 1 : v < 0.03 ? 0 : -1)) djCommit(); }
// ---------- страница «Диджей» ----------
const djBpm = (an, a) => (an && an.bpm ? (an.bpm * (a ? djRateOf(a) * (+S().audio.speed || 1) : 1)).toFixed(1) : null);
const djKnob = (i, f, nm, min, max, unit) => `<label class="dj-k"><em>${nm}</em><input type="range" min="${min}" max="${max}" step="1" value="${djK[i][f]}" data-dk="${i}.${f}" title="Двойной клик — сброс"><span data-dkv="${i}.${f}">${djK[i][f]}${unit}</span></label>`;
function djDeckHtml(i) {
  const a = decks[i], t = djTrackOf(i), onAir = a === audio, an = djAnOf(i), cues = (t && lib.cues && lib.cues[t.id]) || [], L = dj.loops[i];
  const ld = dj.loading && dj.loading.d === i;
  const st = onAir ? `<span class="badge live">В эфире</span>` : ld ? '<span class="badge">Загружаю…</span>' : dj.load && dj.load.d === i ? `<span class="badge">${a.paused ? 'Готова' : 'Играет — веди кроссфейдер'}</span>` : dj.from === a ? '<span class="badge">Уходит</span>' : '<span class="badge dim">Пустая</span>';
  const title = t ? esc(t.title) : ld ? esc(dj.loading.t.title) : 'Загрузи трек';
  return `<div class="deck d${i} ${onAir ? 'air' : ''} ${t ? '' : 'vacant'}">
    <div class="deck-top"><div class="dd-art" style="background-image:url('${t ? esc(artOf(t, 226)) : ''}')"></div><div class="dd-info"><em>Дека ${i + 1} ${st}</em><b>${title}</b><span>${t ? esc(t.author || '') : onAir ? '' : 'Кнопкой ниже или из списка треков'}</span><div class="dd-meta" id="ddm${i}">${djMetaHtml(i)}</div></div></div>
    <canvas class="dd-wave" id="ddw${i}" data-seek="${i}"></canvas>
    <div class="deck-tr">
      <button class="pb big ${!a.paused && a.src ? 'on' : ''}" data-dj="play" data-d="${i}" title="Играть / пауза">${ico(!a.paused && a.src ? 'pause' : 'play')}</button>
      <button class="pb" data-dj="cue" data-d="${i}" title="В начало / к первой метке">CUE</button>
      <button class="pb" data-dj="sync" data-d="${i}" title="Подогнать темп и долю под другую деку">SYNC</button>
      <button class="pb" data-dj="brake" data-d="${i}" title="Торможение пластинки">${ico('stop')}</button>
      <button class="pb" data-dj="nudge" data-v="-0.03" data-d="${i}" title="Чуть назад">−</button><button class="pb" data-dj="nudge" data-v="0.03" data-d="${i}" title="Чуть вперёд">+</button>
      <button class="pb wide" data-dj="pick" data-d="${i}" title="Выбрать трек для этой деки">${ico('list')}${onAir ? 'Заменить' : 'Трек…'}</button>
      ${!onAir ? `<button class="pb" data-dj="loadnext" data-d="${i}" title="Загрузить следующий трек из очереди">${ico('down')}</button>` : ''}
    </div>
    <div class="pads"><div class="pad-g"><em>Луп, долей</em>${[1, 2, 4, 8, 16].map((n) => `<button class="pad ${L && L.n === n ? 'on' : ''}" data-dj="loop" data-v="${n}" data-d="${i}">${n}</button>`).join('')}</div>
    <div class="pad-g"><em>Метки <small>(ПКМ — стереть)</small></em>${[0, 1, 2, 3].map((n) => `<button class="pad hc ${cues[n] != null ? 'set' : ''}" data-dj="hot" data-v="${n}" data-d="${i}" title="${cues[n] != null ? fmt(cues[n]) : 'Поставить метку'}">${n + 1}</button>`).join('')}</div></div>
    <div class="dj-knobs">${djKnob(i, 'high', 'Верх', -26, 6, 'dB')}${djKnob(i, 'mid', 'Середина', -26, 6, 'dB')}${djKnob(i, 'low', 'Низ', -26, 6, 'dB')}${djKnob(i, 'filter', 'Фильтр', -100, 100, '%')}${djKnob(i, 'pitch', 'Темп', -16, 16, '%')}${djKnob(i, 'vol', 'Громкость', 0, 100, '%')}</div>
  </div>`;
}
function djPickHtml(compact) {
  const q = lib.queue, T = compact ? 'queue' : dj.tab, tg0 = dj.target;
  const deckBtn = (k, d) => `<button class="btn sm dk ${tg0 === d ? 'hl' : ''}" data-pk="deck" data-to="${d}" data-k="${k}" title="${decks[d] === audio ? 'В деку ' + (d + 1) + ' (в эфире) — включить сейчас' : 'Загрузить в деку ' + (d + 1)}">${ico('dj')}${d + 1}</button>`;
  const act = (k) => `<div class="pk-act">${deckBtn(k, 0)}${deckBtn(k, 1)}<button class="btn sm" data-pk="next" data-k="${k}" title="Сыграет следующим (автомикс сведёт его)">${ico('queue')}</button><button class="btn sm" data-pk="end" data-k="${k}" title="В конец очереди">${ico('plus')}</button></div>`;
  const tr = (x, k, extra) => `<div class="dj-qi"><img src="${esc(artOf(x, 60))}" ${IMG_ERR}/><div><b>${esc(x.title)}</b><span>${esc(x.author || '')}${x.dur ? ' · ' + fmt(x.dur) : ''}</span></div>${extra || ''}${act(k)}</div>`;
  let body = '';
  if (T === 'queue') {
    const n = djNextPick(), up = q.tracks.map((x, i) => ({ x, i })).filter(({ i }) => i > q.idx).slice(0, compact ? 6 : 80);
    body = up.length ? up.map(({ x, i }) => { const k = reg({ q: i, t: x }); return tr(x, k, `${n && n.i === i ? '<span class="badge">дальше</span>' : ''}<button class="btn sm ghost" data-pk="rm" data-k="${k}" title="Убрать из очереди">${ico('x')}</button>`); }).join('') : '<p class="pk-empty">Очередь пуста — найди треки во вкладке «Треки» → «Поиск» или включи плейлист</p>';
  } else if (T === 'search') {
    body = `<form class="pk-search" data-pkf="1"><input id="djQ" placeholder="Трек, исполнитель…" value="${esc(dj.q)}" spellcheck="false"><button class="btn sm">${ico('search')}Найти</button></form>`;
    body += dj.res === 'load' ? '<p class="pk-empty">Ищу…</p>' : Array.isArray(dj.res) ? (dj.res.length ? dj.res.map((x) => tr(x, reg({ t: x }))).join('') : '<p class="pk-empty">Ничего не нашлось</p>') : '';
  } else {
    const L = [...lib.playlists.map((p) => ({ name: p.name, sub: tr0(p.tracks.length), p })), ...(accLists || []).map((p) => ({ name: p.name, sub: p.sub || 'YouTube Music', b: p.browseId || 'VL' + p.listId }))];
    body = L.length ? L.map((x) => { const k = reg(x); return `<div class="dj-qi pl"><div class="pl-ic">${ico('list')}</div><div><b>${esc(x.name)}</b><span>${esc(x.sub || '')}</span></div><div class="pk-act"><button class="btn sm" data-pl="play" data-k="${k}">${ico('play')}Играть</button><button class="btn sm" data-pl="shuf" data-k="${k}" title="Перемешать и играть">${ico('shuffle')}</button><button class="btn sm" data-pl="add" data-k="${k}" title="Добавить в очередь">${ico('plus')}</button></div></div>`; }).join('') : '<p class="pk-empty">Плейлистов пока нет</p>';
  }
  const tabs = compact ? `<h4 class="pk-h">Дальше в очереди <a data-djtab="tracks">все треки →</a></h4>` : `<div class="pk-tabs">${[['queue', 'Очередь'], ['search', 'Поиск'], ['lists', 'Плейлисты']].map(([k, n]) => `<button class="chip ${T === k ? 'on' : ''}" data-pkt="${k}">${n}</button>`).join('')}<span class="pk-hint">${ico('dj')}1 / ${ico('dj')}2 — в деку · ${ico('queue')} следующим · ${ico('plus')} в конец</span></div>`;
  const tgt = !compact && tg0 != null ? `<div class="pk-target">${ico('dj')}Выбери трек для <b>деки ${tg0 + 1}</b><button class="btn sm ghost" data-dj="untarget">${ico('x')}</button></div>` : '';
  return `<section class="set-sec dj-pick ${compact ? 'compact' : ''}">${tgt}${tabs}<div class="dj-q">${body}</div></section>`;
}
const tr0 = (n) => (typeof tr === 'function' ? tr(n) : n + ' треков');
const DJ_TABS = [['deck', 'dj', 'Пульт'], ['tracks', 'list', 'Треки'], ['auto', 'sync', 'Автомикс'], ['eq', 'eq', 'Эквалайзер'], ['midi', 'piano', 'MIDI-пульт']];
function djHtml() {
  const s = S(), D = s.dj, F = dj.fx, P = lib.djPage || 'deck';
  const R2 = (title, sub, c) => row(title, sub, c);
  const fxTo = (k) => seg0(k, [['0', '1'], ['both', '1+2'], ['1', '2']]);
  const head = `<div class="dj-head"><h1 class="sh-title">${ico('dj')}Диджей</h1><div class="dj-hc">
    <label class="dj-auto" title="Включить или выключить весь режим диджея">${tg('dj.on')}<span>Режим диджея</span></label>
    ${D.on ? `<label class="dj-auto" title="Сам сводит треки в конце">${tg('dj.auto')}<span>Автомикс</span></label>` : ''}
    <button class="btn sm ghost" data-dj="resetall" title="Вернуть все настройки и ручки диджея по умолчанию">${ico('refresh')}Сбросить</button></div></div>`;
  if (!D.on) return `<div class="set-wrap dj-page">${head}<div class="dj-off">${ico('dj')}<b>Режим диджея выключен</b><span>Треки играют как обычно, без сведения, эффектов и ручек на деках. Эквалайзер в «Настройки → Звук» работает и без него.</span><button class="btn" data-dj="turnon">${ico('dj')}Включить</button></div></div>`;
  const tabs = `<div class="dj-tabs">${DJ_TABS.map(([k, i, n]) => `<button class="${P === k ? 'on' : ''}" data-djtab="${k}">${ico(i)}<span>${n}</span></button>`).join('')}</div>`;
  const warn = engine === 'yt' ? `<div class="dj-warn">${ico('alert')}Сейчас играет встроенный YouTube (режим «Видео» или запасной вариант) — деки, эффекты и сведение работают только для звука через Pulse. Переключись на «Песню» или «Визуал».</div>` : '';
  let body = '';
  if (P === 'deck') body = `<div class="dj-decks">${djDeckHtml(0)}
    <div class="dj-mixer">
      <button class="dj-mix" data-dj="mix" title="Свести со следующим треком сейчас (по долям)">${ico('dj')}<span>Свести</span></button>
      <div class="dj-xfp" id="djXfP"><i></i></div>
      <div class="dj-fx"><em>Эхо · ${F.beat} доли</em><input type="range" min="0" max="100" value="${F.echo}" data-fx="echo">${fxTo('eTo')}
      <div class="seg mini">${[[0.25, '¼'], [0.5, '½'], [0.75, '¾'], [1, '1'], [2, '2']].map(([v, n]) => `<button class="${F.beat === v ? 'on' : ''}" data-fxb="${v}">${n}</button>`).join('')}</div>
      <em>Хвост эха</em><input type="range" min="0" max="90" value="${F.fb}" data-fx="fb">
      <em>Реверб</em><input type="range" min="0" max="100" value="${F.rev}" data-fx="rev">${fxTo('rTo')}</div>
    </div>
  ${djDeckHtml(1)}</div>
  <div class="dj-xf"><span>1</span><input type="range" min="0" max="1000" value="${Math.round(dj.xf * 1000)}" id="djXf" data-xf="1" title="Кроссфейдер — двойной клик вернёт на деку в эфире"><span>2</span></div>
  <p class="dj-help">Как сводить вручную: загрузи трек во вторую деку → ▶ → SYNC → плавно веди кроссфейдер к ней. Когда дойдёшь до конца, она станет «в эфире».</p>
  ${djPickHtml(true)}`;
  if (P === 'tracks') body = djPickHtml(false);
  if (P === 'auto') body = `<section class="set-sec"><h3>${ico('sync')}Автомикс</h3>
      ${R2('Автомикс', 'Сам сводит треки в конце, как диджей', tg('dj.auto'))}
      ${R2('Длина перехода', 'В долях — переход всегда звучит «в квадрат»', seg('dj.unit', [['beats', 'Доли'], ['sec', 'Секунды']]))}
      ${D.unit === 'beats' ? R2('↳ Долей', '16 = 4 такта', seg('dj.beats', [[4, '4'], [8, '8'], [16, '16'], [32, '32'], [64, '64']])) : R2('↳ Секунд', '', seg('dj.fade', [[4, '4'], [8, '8'], [12, '12'], [16, '16'], [24, '24']]))}
      ${R2('Стиль перехода', 'Как уходит старый трек', seg('dj.style', [['smooth', 'Плавно'], ['bass', 'Бас-свап'], ['filter', 'Фильтр'], ['echo', 'Эхо'], ['brake', 'Тормоз'], ['cut', 'Резко']]))}
      ${R2('Пропускать тишину', 'Без пауз в начале и конце треков', tg('dj.trim'))}
    </section>
    <section class="set-sec"><h3>${ico('gauge')}Темп и доли</h3>
      ${R2('Бит-синхронизация', 'Подгоняет темп и фазу, вступает с сильной доли', tg('dj.beat'))}
      ${D.beat ? R2('↳ Начинать с фразы', 'Переход стартует на границе фразы', tg('dj.phrase')) + R2('↳ Диапазон темпа', 'Насколько можно ускорить или замедлить трек', seg('dj.range', [[4, '±4%'], [8, '±8%'], [12, '±12%'], [16, '±16%']])) + R2('↳ Возврат темпа', 'После перехода темп плавно возвращается к родному', tg('dj.glide')) : ''}
      ${R2('Сохранять тональность', 'При смене темпа голос не «плывёт»', tg('dj.keylock'))}
      ${R2('Кривая кроссфейдера', '', seg('dj.curve', [['smooth', 'Плавная'], ['linear', 'Линейная'], ['sharp', 'Скретч']]))}
    </section>`;
  if (P === 'eq') body = `<section class="set-sec"><h3>${ico('tune')}Мастер-ручки</h3>
      <div class="dj-knobs">
        ${[['Низ', 0], ['Середина', 1], ['Верх', 2]].map(([nm, i]) => `<label class="dj-k"><em>${nm}</em><input type="range" min="-30" max="6" step="1" value="${D.iso[i]}" data-rg="dj.iso.${i}"><span data-rv="dj.iso.${i}">${D.iso[i]}dB</span></label>`).join('')}
        <label class="dj-k wide"><em>Фильтр · ← низкие | высокие →</em><input type="range" min="-100" max="100" step="1" value="${D.filter}" data-rg="dj.filter"><span data-rv="dj.filter">${D.filter}%</span></label>
        <label class="dj-k wide"><em>Общий темп</em><input type="range" min="0.8" max="1.2" step="0.01" value="${s.audio.speed}" data-rg="audio.speed"><span data-rv="audio.speed">${s.audio.speed}×</span></label>
      </div>
      <div class="opt-row"><button class="btn sm" data-dj="reset">${ico('undo')}Сбросить ручки</button></div></section>
    <section class="set-sec"><h3>${ico('eq')}Эквалайзер ${tg('audio.eqOn')}</h3><canvas class="dj-spec" id="djSpec"></canvas>${eqBlockHtml()}</section>`;
  if (P === 'midi') body = typeof midiHtml === 'function' ? midiHtml() : '';
  return `<div class="set-wrap dj-page">${head}${tabs}${warn}${body}</div>`;
}
const seg0 = (k, opts) => `<div class="seg mini">${opts.map(([v, n]) => `<button class="${String(dj.fx[k]) === v ? 'on' : ''}" data-fxt="${k}" data-v="${v}">${n}</button>`).join('')}</div>`;
PAGES.dj = { sync: () => djHtml() };
const djRender = () => { if (route().r !== 'dj' || !$('page')) return; if (document.activeElement && document.activeElement.id === 'djQ') return; if (document.activeElement && document.activeElement.matches && document.activeElement.matches('.dj-page input[type=range]') && djDragging) return; const y = $('view').scrollTop; $('page').innerHTML = djHtml(); $('view').scrollTop = y; [0, 1].forEach((i) => { const cv = $('ddw' + i); if (cv) try { djWave(i, cv, djAnOf(i), decks[i]); } catch {} }); };
let djDragging = false;
document.addEventListener('pointerdown', (e) => { if (e.target.matches && e.target.matches('.dj-page input[type=range]')) djDragging = true; }, true);
document.addEventListener('pointerup', () => { if (djDragging) { djDragging = false; } }, true);
async function djSearch(q) {
  dj.q = q; if (!q.trim()) return; const qi = $('djQ'); if (qi) qi.blur(); if (!online()) return toast('Нет интернета');
  dj.res = 'load'; djRender();
  try { const sh = await pulse.ytm.search(q, 'songs'); const out = []; (Array.isArray(sh) ? sh : []).forEach((s) => (s.items || []).forEach((x) => x.kind === 'song' && out.push(x))); dj.res = out.slice(0, 40); }
  catch { dj.res = []; }
  djRender();
}
function djPickAct(a, o, to) {
  const q = lib.queue, t = o.t, inQ = o.q != null && q.tracks[o.q] && q.tracks[o.q].id === t.id;
  if (a === 'rm') { if (inQ && o.q !== q.idx) { q.tracks.splice(o.q, 1); if (o.q < q.idx) q.idx--; if (dj.load && dj.load.i > o.q) dj.load.i--; renderQueue(); save(); dj.next = null; dj.plan = null; } return; }
  if (a === 'next') { if (inQ) { if (o.q !== q.idx + 1) { q.tracks.splice(o.q, 1); if (o.q < q.idx) q.idx--; q.tracks.splice(q.idx + 1, 0, t); renderQueue(); save(); } toast('Сыграет следующим', 'queue'); } else playNextUp(t); dj.next = null; dj.prepId = null; dj.plan = null; return; }
  if (a === 'end') { if (inQ) { q.tracks.splice(o.q, 1); if (o.q < q.idx) q.idx--; q.tracks.push(t); renderQueue(); save(); toast('Перенесён в конец', 'queue'); } else playNextUp(t, true); return; }
  if (a === 'deck') {
    let i = inQ ? o.q : q.tracks.findIndex((x, k) => k > q.idx && x.id === t.id);
    if (i < 0) { if (!q.tracks.length) return setQueue([t], 0, t.title); const c = { ...t }; delete c.auto; q.tracks.splice(q.idx + 1, 0, c); i = q.idx + 1; renderQueue(); save(); }
    dj.target = null; if (lib.djPage === 'tracks') lib.djPage = 'deck';
    djLoad(i, to);
  }
}
async function djListAct(a, x) {
  let tracks = x.p ? x.p.tracks : null;
  if (!tracks || (!tracks.length && x.p && x.p.browseId)) { const id = x.b || x.p.browseId; if (!online()) return toast('Нет интернета'); toast('Загружаю плейлист…', 'list'); const d = await pulse.ytm.browse(id).catch(() => null); if (!d || d.error) return toast('Не удалось открыть'); tracks = d.tracks || []; }
  if (!tracks.length) return toast('Плейлист пуст');
  if (a === 'play') return playList(tracks, 0, x.name);
  if (a === 'shuf') return shuffleList(tracks, x.name);
  const q = lib.queue; if (!q.tracks.length) return playList(tracks, 0, x.name);
  q.tracks.push(...tracks.map(slim)); renderQueue(); save(); toast(`Добавлено: ${tracks.length}`, 'queue');
}
function djResetKnobs() { djK.forEach((k, j) => { Object.assign(k, { low: 0, mid: 0, high: 0, filter: 0, vol: 100, pitch: 0 }); djApplyDeck(j); }); Object.assign(dj.fx, { echo: 0, rev: 0, fb: 45, beat: 0.75, eTo: 'both', rTo: 'both' }); dj.loops = [null, null]; dj.rates = [1, 1]; djApplySends(); [0, 1].forEach(djSetRate); if (actx && deckNodes.length) djSetXf(djA() ? 1 : 0, 0.02); }
function djOff() { djFinish(true); clearInterval(dj.rateT); djResetKnobs(); dj.plan = null; dj.next = null; }
document.addEventListener('click', (e) => {
  const el = e.target.closest('.dj-page [data-dj],.dj-page [data-set],.dj-page [data-tg],.dj-page [data-eqp],.dj-page [data-pk],.dj-page [data-pkt],.dj-page [data-pl],.dj-page [data-fxt],.dj-page [data-fxb],.dj-page [data-djtab]'); if (!el) return;
  const d = el.dataset, i = +d.d;
  if (d.djtab) { lib.djPage = d.djtab; save(); $('view').scrollTop = 0; }
  if (d.tg === 'dj.on') setTimeout(() => { if (!S().dj.on) { djOff(); toast('Режим диджея выключен', 'dj'); } else toast('Режим диджея включён', 'dj'); }, 0);
  if (d.dj === 'turnon') { S().dj.on = true; save(); }
  if (d.dj === 'resetall') { if (!confirm('Сбросить все настройки диджея и ручки?')) return; const on = S().dj.on; S().dj = JSON.parse(JSON.stringify(DEF_SETTINGS.dj)); S().dj.on = on; S().audio.speed = 1; djOff(); applyEq(); applySpeed(); save(); toast('Настройки диджея сброшены', 'refresh'); }
  if (d.dj === 'mix') djStart(true);
  if (d.dj === 'play') djPlay(i);
  if (d.dj === 'cue') djCue(i);
  if (d.dj === 'sync') djSync(i);
  if (d.dj === 'brake') djBrake(i);
  if (d.dj === 'nudge') djNudge(i, +d.v);
  if (d.dj === 'loadnext') djLoadNext();
  if (d.dj === 'pick') { dj.target = i; dj.tab = dj.tab || 'queue'; lib.djPage = 'tracks'; $('view').scrollTop = 0; }
  if (d.dj === 'untarget') dj.target = null;
  if (d.dj === 'loop') djLoopToggle(i, +d.v);
  if (d.dj === 'hot') djHot(i, +d.v, e.shiftKey);
  if (d.dj === 'reset') { const D = S().dj; D.iso = [0, 0, 0]; D.filter = 0; S().audio.speed = 1; djResetKnobs(); applySettings(); save(); }
  if (d.pkt) { dj.tab = d.pkt; }
  if (d.pk) { const o = got(d.k); if (o) djPickAct(d.pk, o, d.to != null ? +d.to : dj.target); }
  if (d.pl) { const o = got(d.k); if (o) djListAct(d.pl, o); }
  if (d.fxt) { dj.fx[d.fxt] = d.v; djApplySends(); }
  if (d.fxb) { dj.fx.beat = +d.fxb; djApplySends(); }
  setTimeout(djRender, d.tg || d.set ? 230 : 0);
}, true);
document.addEventListener('contextmenu', (e) => { const el = e.target.closest('.dj-page [data-dj="hot"]'); if (!el) return; e.preventDefault(); djHot(+el.dataset.d, +el.dataset.v, true); });
document.addEventListener('submit', (e) => { if (!e.target.closest('[data-pkf]')) return; e.preventDefault(); djSearch($('djQ').value); });
document.addEventListener('input', (e) => {
  const el = e.target; if (!el.closest || !el.closest('.dj-page')) return; const d = el.dataset;
  if (d.dk) { const [i, f] = d.dk.split('.'); djSetK(+i, f, +el.value); const l = document.querySelector(`[data-dkv="${d.dk}"]`); if (l) l.textContent = el.value + (l.textContent.match(/[%a-zа-я]+$/i) || [''])[0]; }
  if (d.xf) djX(0, +el.value / 1000);
  if (d.fx) { dj.fx[d.fx] = +el.value; djApplySends(); }
});
document.addEventListener('dblclick', (e) => {
  const el = e.target.closest('.dj-page input[type=range]'); if (!el) return; const d = el.dataset;
  if (d.dk) { const [i, f] = d.dk.split('.'); djSetK(+i, f, f === 'vol' ? 100 : 0); djRender(); }
  if (d.xf) { djSetXf(djA() ? 1 : 0, 0.05); djRender(); }
});
document.addEventListener('pointerdown', (e) => {
  const cv = e.target.closest('.dj-page canvas[data-seek]'); if (!cv) return; const i = +cv.dataset.seek, a = decks[i]; if (!a.src || !isFinite(a.duration)) return;
  const r = cv.getBoundingClientRect(), f = (e.clientX - r.left) / r.width; if (a === audio) E.seek(f * a.duration); else a.currentTime = f * a.duration;
});
// мини-волна трека по энергии из анализа
function djWave(i, cv, an, a) {
  const r = cv.getBoundingClientRect(), W = Math.round(r.width), H = Math.round(r.height); if (!W) return;
  if (cv.width !== W) { cv.width = W; cv.height = H; }
  const c = cv.getContext('2d'), d = a.duration, t = djTrackOf(i); c.clearRect(0, 0, W, H); if (!t || !d || !isFinite(d)) return;
  const key = t.id + ':' + W; let img = dj.wf[i];
  if ((!img || img.key !== key) && an && an.energy) {
    const o = document.createElement('canvas'); o.width = W; o.height = H; const x = o.getContext('2d'), a1 = getComputedStyle(document.documentElement).getPropertyValue('--a1') || '255,255,255';
    for (let px = 0; px < W; px++) { const e = an.energy((px / W) * d), h = Math.max(1, e * H * 0.92); x.fillStyle = `rgba(${a1},${0.35 + e * 0.5})`; x.fillRect(px, (H - h) / 2, 1, h); }
    img = dj.wf[i] = { key, o };
  }
  if (img && img.key === key) c.drawImage(img.o, 0, 0); else { c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(0, H / 2 - 1, W, 2); }
  const L = dj.loops[i]; if (L) { c.fillStyle = 'rgba(255,200,0,.22)'; c.fillRect((L.a / d) * W, 0, ((L.b - L.a) / d) * W, H); }
  const cues = (lib.cues && lib.cues[t.id]) || []; cues.forEach((x, n) => { if (x == null) return; c.fillStyle = ['#ff4d6d', '#4dd2ff', '#ffd24d', '#7dff8a'][n]; c.fillRect((x / d) * W - 1, 0, 2, H); });
  if (dj.plan && a === audio) { c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect((dj.plan.at / d) * W, H - 4, Math.max(2, (dj.plan.X / d) * W), 4); }
  const p = (a.currentTime / d) * W; c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(0, 0, p, H); c.fillStyle = '#fff'; c.fillRect(p - 1, 0, 2, H);
}
let djLast = 0, djTrack = null, djLoadSeen = null;
// строка «время / BPM / доли» деки. Раньше при каждом нажатии (плей/пауза) страница пересобиралась с пустой строкой,
// и цифры таймлайна мигали, а высота блока прыгала на пару пикселей. Теперь строка строится сразу и всегда одной высоты.
const djMetaPrev = ['', ''];
function djMetaHtml(i) {
  const a = decks[i]; if (!a) return ''; const an = djAnOf(i), d = a.duration, on = a.src && isFinite(d);
  if (!on) return '<span class="dd-time">&nbsp;</span>';
  const b = djBpm(an, a), r = djRateOf(a), T = an ? tempoOf(an, a.currentTime) : null, pos = T ? Math.floor(((T.pos % 4) + 4) % 4) : -1;
  return `<span class="dd-time">${fmt(a.currentTime)} / −${fmt(Math.max(0, d - a.currentTime))}</span>${b ? `<span class="bpm">${b} BPM</span>` : '<span>темп…</span>'}${Math.abs(r - 1) > 0.001 ? `<span>${r > 1 ? '+' : ''}${(r * 100 - 100).toFixed(1)}%</span>` : ''}${T ? `<span class="beat4 ${a.paused ? 'idle' : ''}">${[0, 1, 2, 3].map((k) => `<i class="${!a.paused && pos === k ? 'on' : ''}"></i>`).join('')}</span>` : ''}`;
}
let djA1 = '255,255,255', djA1At = 0;
const djAccent = () => { const n = performance.now(); if (n - djA1At > 1000) { djA1At = n; djA1 = getComputedStyle(document.documentElement).getPropertyValue('--a1') || '255,255,255'; } return djA1; };
const djEqBuf = { M: 120, fr: null, mag: null, ph: null, tot: null, key: '' };
function djFrame() {
  if (route().r !== 'dj') return;
  const now = performance.now();
  if (curTrack() !== djTrack || (dj.load && dj.load.t.id) !== djLoadSeen) { djTrack = curTrack(); djLoadSeen = dj.load && dj.load.t.id; setTimeout(djRender, 0); }
  // кроссфейдер во время автомикса едет сам
  if (dj.from && dj.X) { const p = Math.min(1, (now - dj.t0) / (dj.X * 1000)); dj.xf = dj.xfTo ? dj.xfFrom + (1 - dj.xfFrom) * p : dj.xfFrom * (1 - p); const xs = $('djXf'); if (xs && document.activeElement !== xs) xs.value = Math.round(dj.xf * 1000); }
  [0, 1].forEach((i) => { const cv = $('ddw' + i); if (cv) djWave(i, cv, djAnOf(i), decks[i]); });
  if (now - djLast > 200) {
    djLast = now;
    [0, 1].forEach((i) => {
      const m = $('ddm' + i); if (!m) return; const h = djMetaHtml(i);
      if (h !== djMetaPrev[i] || m.innerHTML === '') { djMetaPrev[i] = h; m.innerHTML = h; }
    });
    const xp = $('djXfP'); if (xp) xp.querySelector('i').style.width = dj.from ? Math.min(100, ((now - dj.t0) / (dj.X * 1000)) * 100) + '%' : '0';
  }
  const cv = $('djSpec'); if (!cv) return;
  const r = cv.getBoundingClientRect(), W = r.width, H = r.height; if (!W) return;
  if (cv.width !== Math.round(W)) { cv.width = Math.round(W); cv.height = Math.round(H); }
  const c = cv.getContext('2d'); c.clearRect(0, 0, W, H);
  const fx = (f) => (Math.log(f / 20) / Math.log(20000 / 20)) * W;
  if (analyser && freq) {
    if (!playing || engine !== 'audio') freq.fill(0); else analyser.getByteFrequencyData(freq);
    const hz = actx.sampleRate / analyser.fftSize, N = 96, a1 = djAccent();
    for (let i = 0; i < N; i++) {
      const f0 = 20 * Math.pow(1000, i / N), f1 = 20 * Math.pow(1000, (i + 1) / N); let m = 0;
      for (let k = Math.floor(f0 / hz); k <= Math.ceil(f1 / hz) && k < freq.length; k++) m = Math.max(m, freq[k]);
      const h = (m / 255) * H * 0.9, x = (i / N) * W; c.fillStyle = `rgba(${a1},${0.25 + (m / 255) * 0.5})`; c.fillRect(x, H - h, W / N - 2, h);
    }
  }
  if (eqNodes) {
    // АЧХ эквалайзера пересчитываем только когда меняются ручки, а не каждый кадр
    const B = djEqBuf, M = B.M; if (!B.fr) { B.fr = new Float32Array(M); B.mag = new Float32Array(M); B.ph = new Float32Array(M); B.tot = new Float32Array(M); for (let i = 0; i < M; i++) B.fr[i] = 20 * Math.pow(1000, i / (M - 1)); }
    const nodes = [...eqNodes, ...isoNodes], key = nodes.map((b) => b.gain.value.toFixed(1)).join(',');
    if (key !== B.key) { B.key = key; B.tot.fill(0); nodes.forEach((b) => { b.getFrequencyResponse(B.fr, B.mag, B.ph); for (let i = 0; i < M; i++) B.tot[i] += 20 * Math.log10(B.mag[i] || 1e-6); }); }
    const fr = B.fr, tot = B.tot;
    c.beginPath(); for (let i = 0; i < M; i++) { const y = H / 2 - (tot[i] / 30) * (H / 2); i ? c.lineTo(fx(fr[i]), y) : c.moveTo(fx(fr[i]), y); }
    c.strokeStyle = '#fff'; c.lineWidth = 2; c.shadowColor = 'rgba(255,255,255,.6)'; c.shadowBlur = 8; c.stroke(); c.shadowBlur = 0;
  }
  c.strokeStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.moveTo(0, H / 2); c.lineTo(W, H / 2); c.stroke();
}
// внешнее управление (MIDI, горячие клавиши, плагины)
const DJ = { play: djPlay, cue: djCue, sync: djSync, brake: (i) => djBrake(i), loop: djLoopToggle, hot: djHot, nudge: djNudge, setK: djSetK, xf: (v) => djX(0, v), mix: () => djStart(true), loadNext: djLoadNext, fx: (k, v) => { dj.fx[k] = v; djApplySends(); }, k: djK, state: dj };
// 1.9.4: режим диджея включается и в настройках; выключенный — прячет свой пункт и кнопку
{ const base = settingChanged; settingChanged = function (p) {
  const r = base.apply(this, arguments);
  if (p === 'dj.on') { document.body.classList.toggle('no-dj', !S().dj.on); if (!S().dj.on) { try { djOff(); } catch {} } }
  if ((p === 'dj.on' || p === 'dj.unit') && route().r === 'settings' && typeof rerenderSettings === 'function') rerenderSettings();
  return r; }; }
document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('[data-dj="turnon"]')) setTimeout(() => document.body.classList.toggle('no-dj', !S().dj.on), 0); });
