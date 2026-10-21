// Pulse 2.0.5 — караоке-движок по мотивам Spicy Lyrics (github.com/Spikerko/spicy-lyrics, механика анимации).
// Spring — порт spr (Fraktality, MIT), как и в Spicy Lyrics.
//
// Почему раньше слова «пролетали» или пропускались:
//  1) анимировалось только одно «текущее» слово: если за кадр начиналось два слова, промежуточное просто вспыхивало без заливки;
//  2) у короткого слова (30–80 мс) заливка физически не успевала — следующее слово сбрасывало её и класс pop;
//  3) CSS-переходы цвета (--wt до 0,6 с) отставали от реального времени и «догоняли» уже спетое слово;
//  4) часы текста каждый кадр тянулись к «застывшему» audio.currentTime — время шло ступеньками.
// Теперь: состояние КАЖДОГО слова активной строки (не спето / поётся / спето) считается из времени каждый кадр,
// у слова есть минимальная видимая длительность, движение идёт через пружины (без CSS-переходов),
// длинные слова раскладываются по буквам с «волной» вокруг поющейся буквы, а стили пишутся только при реальном изменении.
(() => {
  'use strict';
  // ---------- пружина (spr) ----------
  const TAU = Math.PI * 2;
  class Spring {
    constructor(p, f, d) { this.p = p; this.g = p; this.v = 0; this.f = f; this.d = d; }
    step(dt) {
      const d = this.d, f = this.f * TAU, g = this.g; let p = this.p, v = this.v;
      if (d === 1) { const q = Math.exp(-f * dt), w = dt * q, o = p - g; p = o * (q + w * f) + v * w + g; v = v * (q - w * f) - o * (w * f * f); }
      else if (d < 1) {
        const q = Math.exp(-d * f * dt), c = Math.sqrt(1 - d * d), i = Math.cos(dt * f * c), j = Math.sin(dt * f * c);
        const z = j / c, y = j / (f * c), o = p - g;
        p = (o * (i + z * d) + v * y) * q + g; v = (v * (i - z * d) - o * (z * f)) * q;
      } else {
        const c = Math.sqrt(d * d - 1), r1 = -f * (d + c), r2 = -f * (d - c), e1 = Math.exp(r1 * dt), e2 = Math.exp(r2 * dt), o = p - g;
        const c2 = (v - o * r1) / (2 * f * c), c1 = e1 * (o - c2); p = c1 + c2 * e2 + g; v = c1 * r1 + c2 * e2 * r2;
      }
      this.p = p; this.v = v; return p;
    }
    rest() { const o = this.p - this.g; return this.v * this.v < 1e-4 && o * o < 1e-7; }
    set(g, snap) { this.g = g; if (snap) { this.p = g; this.v = 0; } }
  }
  // ---------- кривые: натуральный кубический сплайн по опорным точкам (как cubic-spline в Spicy) ----------
  function spline(pts) {
    const n = pts.length, x = pts.map((p) => p[0]), y = pts.map((p) => p[1]), h = [], a = [], l = [1], mu = [0], z = [0], c = new Array(n).fill(0), b = [], dd = [];
    for (let i = 0; i < n - 1; i++) h[i] = x[i + 1] - x[i];
    for (let i = 1; i < n - 1; i++) a[i] = (3 / h[i]) * (y[i + 1] - y[i]) - (3 / h[i - 1]) * (y[i] - y[i - 1]);
    for (let i = 1; i < n - 1; i++) { l[i] = 2 * (x[i + 1] - x[i - 1]) - h[i - 1] * mu[i - 1]; mu[i] = h[i] / l[i]; z[i] = (a[i] - h[i - 1] * z[i - 1]) / l[i]; }
    for (let j = n - 2; j >= 0; j--) { c[j] = z[j] - mu[j] * c[j + 1]; b[j] = (y[j + 1] - y[j]) / h[j] - (h[j] * (c[j + 1] + 2 * c[j])) / 3; dd[j] = (c[j + 1] - c[j]) / (3 * h[j]); }
    // таблица на 256 точек — в кадре только чтение из массива
    const T = new Float32Array(257);
    for (let k = 0; k <= 256; k++) { const t = k / 256; let i = 0; while (i < n - 2 && t > x[i + 1]) i++; const s = t - x[i]; T[k] = y[i] + b[i] * s + c[i] * s * s + dd[i] * s * s * s; }
    return (t) => { t = t <= 0 ? 0 : t >= 1 ? 1 : t; const f = t * 256, i = f | 0; return i >= 256 ? T[256] : T[i] + (T[i + 1] - T[i]) * (f - i); };
  }
  const SC = spline([[0, 0.95], [0.7, 1.05], [1, 1]]);            // масштаб слова
  const SCL = spline([[0, 0.95], [0.7, 1.175], [1, 1]]);          // масштаб буквы
  const YO = spline([[0, 0.01], [0.9, -1 / 60], [1, 0]]);         // подъём слова (в em)
  const YOL = spline([[0, 0.01], [0.9, -1 / 56], [1, 0]]);        // подъём буквы
  const GL = spline([[0, 0], [0.15, 1], [0.6, 1], [1, 0]]);       // свечение
  const easeSinOut = (t) => Math.sin((t * Math.PI) / 2);
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const prog = (T, a, b) => (T <= a ? 0 : T >= b ? 1 : (T - a) / (b - a));
  // частоты/затухания пружин — из Spicy Lyrics
  const FQ = { s: 0.88, sd: 0.64, y: 1.45, yd: 0.4, g: 1.18, gd: 0.56 };
  const MIN_VIS = 0.16;     // минимальная видимая длительность слова: даже «проглоченное» слово успевает зажечься
  const LETTER_MIN = 1.0;   // слово дольше 1 с и не длиннее 12 букв — анимируем по буквам (правило Spicy)
  const LETTER_MAX = 12;

  // ---------- кэш записи стилей: пишем только то, что заметно изменилось ----------
  function put(st, el, key, val, num, eps) {
    const c = st.c || (st.c = {}); const prev = c[key];
    if (prev !== undefined && Math.abs(prev - num) <= eps) return;
    c[key] = num; el.style.setProperty(key, val);
  }
  function putTf(st, el, y, s) {
    const c = st.c || (st.c = {});
    if (c.ty !== undefined && Math.abs(c.ty - y) < 0.0004 && Math.abs(c.ts - s) < 0.0008) return;
    c.ty = y; c.ts = s; el.style.transform = `translate3d(0,${y.toFixed(4)}em,0) scale(${s.toFixed(4)})`;
  }
  function clearSt(el) { el.style.removeProperty('transform'); el.style.removeProperty('--kg'); el.style.removeProperty('--kb'); el.style.removeProperty('--ko'); }

  // слоги слова (из Spicy Lyrics) → куски текста с временем; текст кусков должен в точности собрать слово
  function sylUnits(w, core) {
    const y = w && w.syl; if (!y || y.length < 2) return null;
    const U = y.map((x) => ({ s: String(x.s || ''), t: +x.t, e: +x.e })).filter((u) => u.s);
    if (U.length < 2) return null;
    let j = U.map((u) => u.s).join('');
    if (core.startsWith('(') && !j.startsWith('(')) { U[0].s = '(' + U[0].s; j = '(' + j; }
    if (core.endsWith(')') && !j.endsWith(')')) { U[U.length - 1].s += ')'; j += ')'; }
    if (j !== core) { const lead = j.length - j.trimStart().length; U[0].s = U[0].s.slice(lead); U[U.length - 1].s = U[U.length - 1].s.trimEnd(); if (U.map((u) => u.s).join('') !== core) return null; }
    return U;
  }
  const K = { on: false, line: null, settle: [], last: 0, amp: 1, yAmp: 1, gAmp: 1, letters: true, springs: true, fill: true };
  const isRtl = (s) => /[\u0590-\u08FF]/.test(s);

  // настройка под стиль анимации и темп песни
  function cfg() {
    const Y = (typeof S === 'function' && S().ly) || {}, P = (typeof S === 'function' && S().perf) || {};
    const anim = Y.anim || 'pop', pace = (typeof lyState !== 'undefined' && lyState.pace) || 'mid';
    const pk = pace === 'calm' ? 0.65 : pace === 'hype' ? 1.25 : 1;
    K.amp = (anim === 'grow' ? 1.6 : anim === 'glow' ? 0.5 : anim === 'wave' ? 0.8 : 1) * pk;
    K.yAmp = (anim === 'wave' ? 2.2 : anim === 'grow' ? 0.4 : anim === 'glow' ? 0.5 : 1) * pk;
    K.gAmp = anim === 'glow' ? 1.6 : 1;
    K.move = anim !== 'none';
    K.fill = Y.fill !== false;
    K.glow = Y.glow !== false;
    K.letters = P.mode !== 'eco' && K.move && K.fill;
    K.springs = P.mode !== 'eco';
    // 2.0.4: вид Spicy Lyrics — те же кривые и пружины без поправок на стиль и темп, слово всегда заливается
    if (document.body.classList.contains('spicy-ly')) { K.amp = 1; K.yAmp = 1; K.gAmp = 1; K.move = true; K.fill = true; K.glow = true; K.letters = P.mode !== 'eco'; }
  }

  // строка стала текущей: собираем модель слов (тайминги + элементы + пружины)
  function line(L, el, lines, i) {
    if (K.line) { K.settle.push(K.line); if (K.settle.length > 3) finish(K.settle.shift()); }
    K.line = null; cfg();
    if (!L || L.gap || !el || !L.words || !L.words.length) return;
    // 2.0.4: построчные тайминги + стиль Spicy — строка заливается целиком сверху вниз (spicy.js), по словам не анимируем
    if (document.body.classList.contains('spicy-ly') && typeof spLineOnly === 'function' && spLineOnly(L)) return;
    const spans = el.querySelectorAll('.w'); if (spans.length !== L.words.length) return;
    const nextLine = lines[i + 1], W = [];
    for (let k = 0; k < L.words.length; k++) {
      const w = L.words[k], nx = L.words[k + 1] || nextLine;
      let e = w.e != null && w.e > w.t ? w.e : Math.min(nx ? nx.t : w.t + 1.2, w.t + 2.5);
      if (e <= w.t) e = w.t + 0.05;
      const dur = e - w.t, sp = spans[k];
      const m = { el: sp, t: w.t, e, ve: w.t + Math.max(dur, MIN_VIS), st: {}, lt: null,
        s: new Spring(1, FQ.s, FQ.sd), y: new Spring(0, FQ.y, FQ.yd), g: new Spring(0, FQ.g, FQ.gd) };
      // длинное слово — по буквам: каждая буква получает свой отрезок времени
      const txt = sp.textContent, core = txt.replace(/\s+$/, ''), chars = [...core];
      // 2.0.4: Spicy Lyrics — у слова есть настоящие слоги со своим временем: каждый слог заливается в своё время,
      // а длинный слог (≥ 1 с, до 12 букв) — ещё и по буквам, как в Spicy
      const units = K.fill && K.move && !isRtl(core) ? sylUnits(w, core) : null;
      if (units) {
        const tail = txt.slice(core.length); sp.textContent = '';
        m.lt = [];
        for (const u of units) {
          const ch = [...u.s], long = K.letters && u.e - u.t >= LETTER_MIN && ch.length > 1 && ch.length <= LETTER_MAX, parts = long ? ch : [u.s], ld = (Math.max(u.t + 0.2, u.e - 0.15) - u.t) / parts.length;
          parts.forEach((txt2, j) => { const el2 = document.createElement('span'); el2.className = 'lt'; el2.textContent = txt2; sp.appendChild(el2);
            m.lt.push({ el: el2, t: long ? u.t + j * ld : u.t, e: long ? u.t + (j + 1) * ld : Math.max(u.e, u.t + 0.05), st: {}, s: new Spring(1, FQ.s, FQ.sd), y: new Spring(0, FQ.y, FQ.yd), g: new Spring(0, FQ.g, FQ.gd) }); });
        }
        if (tail) sp.appendChild(document.createTextNode(tail));
        sp.classList.add('lg'); W.push(m); continue;
      }
      if (K.letters && dur >= LETTER_MIN && chars.length > 1 && chars.length <= LETTER_MAX && !isRtl(core)) {
        const tail = txt.slice(core.length);
        sp.textContent = '';
        const end = Math.max(w.t + 0.3, e - 0.25), ld = (end - w.t) / chars.length;
        m.lt = chars.map((ch, j) => { const s = document.createElement('span'); s.className = 'lt'; s.textContent = ch; sp.appendChild(s);
          return { el: s, t: w.t + j * ld, e: w.t + (j + 1) * ld, st: {}, s: new Spring(1, FQ.s, FQ.sd), y: new Spring(0, FQ.y, FQ.yd), g: new Spring(0, FQ.g, FQ.gd) }; });
        if (tail) sp.appendChild(document.createTextNode(tail));
        sp.classList.add('lg');
      } else if (sp.classList.contains('lg')) { sp.textContent = txt; sp.classList.remove('lg'); }
      W.push(m);
    }
    K.line = { el, W, at: performance.now() };
  }

  // один кадр: T — время песни (уже со сдвигом и темпом), как в lyricsFrame
  function frame(T) {
    const now = performance.now(); let dt = (now - (K.last || now)) / 1000; K.last = now; dt = dt > 0.1 ? 0.1 : dt < 0 ? 0 : dt;
    const Ln = K.line;
    if (Ln) for (let k = 0; k < Ln.W.length; k++) word(Ln.W[k], T, dt);
    for (let j = K.settle.length - 1; j >= 0; j--) if (settle(K.settle[j], dt)) { finish(K.settle[j]); K.settle.splice(j, 1); }
  }
  function word(m, T, dt) {
    // NotSung / Active / Sung по видимому отрезку слова (не короче MIN_VIS)
    const p = prog(T, m.t, m.ve), state = T < m.t ? 0 : p >= 1 ? 2 : 1;
    let ts, ty, tg, gp;
    if (!K.move) { ts = 1; ty = 0; }
    else if (state === 1) { ts = 1 + (SC(p) - 1) * K.amp; ty = YO(p) * K.yAmp; }
    else if (state === 0) { ts = 1 + (SC(0) - 1) * K.amp; ty = YO(0) * K.yAmp; }
    else { ts = 1; ty = 0; }
    tg = state === 1 ? GL(p) * K.gAmp : 0;
    gp = !K.fill ? (state ? 100 : -20) : state === 0 ? -20 : state === 2 ? 100 : -20 + 120 * p;
    let s, y, g;
    if (K.springs) { m.s.set(ts); m.y.set(ty); m.g.set(tg); s = m.s.step(dt); y = m.y.step(dt); g = m.g.step(dt); }
    else { s = ts; y = ty; g = tg; }
    if (K.move) putTf(m.st, m.el, y, s);
    if (m.lt) { letters(m, T, dt, state); return; }
    put(m.st, m.el, '--kg', gp.toFixed(1) + '%', gp, 0.15);
    if (K.glow) { const gg = g < 0 ? 0 : g; put(m.st, m.el, '--kb', (0.08 + 0.12 * gg).toFixed(3) + 'em', gg, 0.02); put(m.st, m.el, '--ko', (gg * 0.42).toFixed(3), gg, 0.02); }
  }
  // буквы: поющаяся буква подпрыгивает сильнее, соседи — по крутому спаду (как в Spicy)
  function letters(m, T, dt, wstate) {
    const A = m.lt; let ai = -1, ap = 0;
    if (wstate === 1) for (let i = 0; i < A.length; i++) if (T >= A[i].t && T < A[i].e) { ai = i; ap = (T - A[i].t) / (A[i].e - A[i].t); break; }
    const r0s = 1 + (SCL(0) - 1) * K.amp, r0y = YOL(0) * K.yAmp;
    for (let k = 0; k < A.length; k++) {
      const q = A[k], ls = T < q.t ? 0 : T >= q.e ? 2 : 1;
      let ts = r0s, ty = r0y, tg = 0;
      if (wstate === 2) { ts = 1; ty = 0; tg = 0; }
      else if (ai >= 0) {
        const d = Math.abs(k - ai), fo = 1 / (1 + Math.pow(d, 2.8)), gfo = 1 / (1 + d * 0.9);
        const bs = 1 + (SCL(ap) - 1) * K.amp, by = YOL(ap) * K.yAmp, bg = GL(ap) * K.gAmp;
        ts = r0s + (bs - r0s) * fo; ty = r0y + (by - r0y) * fo; tg = bg * gfo;
        if (ls === 0) { ts = r0s; ty = r0y; tg = 0; }
      } else if (ls === 2) tg = GL(0.2);
      let gp = ls === 0 ? -20 : ls === 2 ? 100 : k === ai ? -20 + 120 * easeSinOut(ap) : -20;
      if (wstate === 2) gp = 100;
      let s, y, g;
      if (K.springs) { q.s.set(ts); q.y.set(ty); q.g.set(tg); s = q.s.step(dt); y = q.y.step(dt); g = q.g.step(dt); }
      else { s = ts; y = ty; g = tg; }
      if (K.move) putTf(q.st, q.el, y * 2, s);
      put(q.st, q.el, '--kg', gp.toFixed(1) + '%', gp, 0.15);
      if (K.glow) { const gg = g < 0 ? 0 : g; put(q.st, q.el, '--kb', (0.08 + 0.3 * gg).toFixed(3) + 'em', gg, 0.02); put(q.st, q.el, '--ko', (gg * 0.5).toFixed(3), gg, 0.02); }
    }
  }
  // строка ушла: пружины мягко возвращают слова в покой, потом инлайн-стили снимаются
  function settle(Ln, dt) {
    let done = performance.now() - Ln.at > 4000;
    if (!done) {
      done = true;
      for (const m of Ln.W) {
        for (const q of m.lt ? [m, ...m.lt] : [m]) {
          if (!K.springs) continue;
          q.s.set(1); q.y.set(0); q.g.set(0);
          const s = q.s.step(dt), y = q.y.step(dt); q.g.step(dt);
          if (K.move) putTf(q.st, q.el, q === m ? y : y * 2, s);
          if (!q.s.rest() || !q.y.rest()) done = false;
        }
      }
    }
    return done;
  }
  function finish(Ln) { for (const m of Ln.W) { clearSt(m.el); m.st.c = null; if (m.lt) for (const q of m.lt) { clearSt(q.el); q.st.c = null; } } }
  function reset() { if (K.line) finish(K.line); K.settle.forEach(finish); K.settle = []; K.line = null; }

  window.Kara = { line, frame, reset, cfg, Spring, spline, get active() { return !!K.line; } };
})();
