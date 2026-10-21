// 2.0.12: «Припевы» — то, чего давно просят у Spotify и YouTube Music, но никто не делает.
//  • Pulse сам находит припевы трека и подсвечивает их на полосе перемотки;
//  • клавиша C (или кнопка на панели) — сразу к следующему припеву;
//  • «Только припевы» — быстрый просмотр плейлиста: каждый трек начинается с припева и после него переключается дальше.
// Как ищем: по синхронному тексту — блоки из 2+ строк подряд, которые повторяются в песне; это и есть припев.
// Нет текста или повторов — по анализу громкости трека: самые плотные и громкие отрезки от 12 с (обычно это припевы и дропы).
(() => {
  const C = () => S().chorus || (S().chorus = { marks: true, key: true, only: false });
  const CH = { id: null, segs: [], src: '', ly: null, an: null, key: '', onlyDone: null, onlyAt: 0, armed: null };
  const norm = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const lineText = (l) => l.text || (l.words || []).map((w) => w.s).join(' ');
  // время в тексте → время трека (сдвиг текста и темп учитываются, как в lyricsFrame)
  const toAudio = (t) => t * (stretchK() || 1) + offset();

  // ---------- по тексту ----------
  function fromLyrics(lines) {
    const L = (lines || []).filter((l) => !l.gap).map((l, i, a) => ({ t: l.t, end: a[i + 1] ? a[i + 1].t : l.t + 4, s: norm(lineText(l)) })).filter((x) => x.s.length > 1);
    const n = L.length; if (n < 6) return null;
    const cnt = new Map(); L.forEach((x) => cnt.set(x.s, (cnt.get(x.s) || 0) + 1));
    // блоки подряд идущих повторяющихся строк
    const blocks = []; let cur = null;
    for (let i = 0; i < n; i++) {
      const rep = cnt.get(L[i].s) >= 2;
      if (rep && cur && L[i].t - L[i - 1].end < 6) cur.b = i;
      else if (rep) { cur = { a: i, b: i }; blocks.push(cur); }
      else cur = null;
    }
    const big = blocks.filter((b) => b.b - b.a >= 1).map((b) => ({ ...b, set: new Set(L.slice(b.a, b.b + 1).map((x) => x.s)), t: L[b.a].t, end: L[b.b].end }));
    if (big.length < 2) return null;
    // группируем похожие блоки (одни и те же строки) и выбираем группу с наибольшим «весом»: повторов × длина
    const sim = (x, y) => { let k = 0; x.set.forEach((s) => y.set.has(s) && k++); return k / Math.min(x.set.size, y.set.size); };
    const groups = [];
    for (const b of big) { const g = groups.find((g) => sim(g[0], b) >= 0.5); g ? g.push(b) : groups.push([b]); }
    const score = (g) => g.length * g.reduce((s, b) => s + (b.end - b.t), 0) / g.length;
    const best = groups.filter((g) => g.length >= 2).sort((a, b) => score(b) - score(a))[0];
    if (!best) return null;
    return best.map((b) => ({ t: b.t, end: Math.min(b.end, b.t + 45), ly: true })).filter((s) => s.end - s.t >= 6);
  }
  // ---------- по громкости (если нет текста) ----------
  function fromEnergy(an, dur) {
    if (!an || !an.energy || !(dur > 40)) return null;
    const st = 0.5, N = Math.floor(dur / st), e = new Float32Array(N);
    for (let i = 0; i < N; i++) e[i] = an.energy(i * st);
    const w = 16, sm = new Float32Array(N); let acc = 0; // скользящее среднее 8 с
    for (let i = 0; i < N; i++) { acc += e[i]; if (i >= w) acc -= e[i - w]; sm[i] = acc / Math.min(i + 1, w); }
    const sorted = Array.from(sm).sort((a, b) => a - b), thr = sorted[Math.floor(N * 0.72)];
    const out = []; let a = -1;
    for (let i = 0; i <= N; i++) {
      const on = i < N && sm[i] >= thr && i * st > 12;
      if (on && a < 0) a = i; else if (!on && a >= 0) { const t0 = Math.max(0, (a - w / 2) * st), t1 = (i - w / 2) * st; if (t1 - t0 >= 12) out.push({ t: t0, end: Math.min(t1, t0 + 45), en: true }); a = -1; }
    }
    return out.length ? out.slice(0, 4) : null;
  }
  // текущие отрезки — в секундах трека
  function segs() { return CH.segs.map((s) => (s.ly ? { a: toAudio(s.t), b: toAudio(s.end) } : { a: s.t, b: s.end })); }
  window.chorusSegs = segs;

  function recompute() {
    const t = curTrack(); const id = t && t.id;
    if (id !== CH.id) { CH.id = id; CH.segs = []; CH.src = ''; CH.ly = null; CH.an = null; CH.onlyDone = null; CH.armed = null; CH.onlyAt = performance.now(); }
    if (!id) return draw();
    const lines = lyState.id === id && lyState.kind === 'synced' ? lyState.lines : null;
    if (lines && lines !== CH.ly) { CH.ly = lines; const r = fromLyrics(lines); if (r) { CH.segs = r; CH.src = 'ly'; } }
    if (CH.src !== 'ly' && beatState.an && beatState.an !== CH.an) { CH.an = beatState.an; const r = fromEnergy(beatState.an, beatState.an.dur || E.dur()); if (r) { CH.segs = r; CH.src = 'en'; } }
    draw();
  }

  // ---------- метки на полосе перемотки и кнопка ----------
  const seek = $('seek'); let marks = null, btn = null;
  if (seek) { marks = document.createElement('div'); marks.className = 'ch-marks'; marks.id = 'chMarks'; seek.insertBefore(marks, seek.firstChild); }
  { const nx = $('btnNext'); if (nx) { btn = document.createElement('button'); btn.className = 'ib sm ch-btn'; btn.id = 'btnChorus'; btn.title = 'К припеву (C) · правый клик — «Только припевы»'; btn.innerHTML = '<svg class="i"><use href="#i-chorus"/></svg>'; nx.after(btn); } }
  function draw() {
    const d = E.dur(), sg = d > 0 ? segs() : [], on = C().marks !== false;
    const key = (on ? 1 : 0) + '|' + d.toFixed(0) + '|' + sg.map((s) => s.a.toFixed(1) + '-' + s.b.toFixed(1)).join(',') + '|' + C().only;
    if (key === CH.key) return; CH.key = key;
    if (marks) marks.innerHTML = on && d > 0 ? sg.map((s) => `<i style="left:${Math.max(0, s.a / d * 100).toFixed(2)}%;width:${Math.max(0.4, (s.b - s.a) / d * 100).toFixed(2)}%" title="Припев"></i>`).join('') : '';
    if (btn) { btn.classList.toggle('has', sg.length > 0); btn.classList.toggle('on', !!C().only); }
    document.body.classList.toggle('ch-only', !!C().only);
  }

  // ---------- действия ----------
  function jump() {
    recompute(); const sg = segs(), now = E.time();
    if (!sg.length) return toast(lyState.kind === 'synced' ? 'Припев не нашёл: в тексте нет повторяющихся частей' : 'Припев появится, когда Pulse разберёт трек (текст или анализ звука)', 'chorus');
    const nx = sg.find((s) => s.a > now + 1.5) || sg[0];
    E.seek(Math.max(0, nx.a - 0.4)); toast(sg.length > 1 ? `Припев ${sg.indexOf(nx) + 1} из ${sg.length}` : 'Припев', 'chorus');
  }
  function only(v) {
    C().only = v == null ? !C().only : !!v; save(); CH.key = ''; CH.onlyDone = null; CH.armed = null; CH.onlyAt = performance.now(); draw();
    toast(C().only ? 'Только припевы: каждый трек — с припева и сразу дальше' : 'Только припевы выключено', 'chorus');
    if (C().only) tick(true);
  }
  window.chorusJump = jump; window.chorusOnly = only;
  if (btn) { btn.onclick = (e) => (e.shiftKey ? only() : jump()); btn.oncontextmenu = (e) => { e.preventDefault(); only(); }; }
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyC' || e.ctrlKey || e.altKey || e.metaKey || C().key === false) return;
    const tg = e.target, tn = tg && tg.tagName; if (tn === 'INPUT' || tn === 'TEXTAREA' || tn === 'SELECT' || (tg && tg.isContentEditable)) return;
    e.preventDefault(); e.shiftKey ? only() : jump();
  });

  // «Только припевы»: старт с первого припева, после его конца — следующий трек.
  // Если припев так и не нашёлся за 9 с — играем 30 с с трети трека
  function tick(force) {
    if (!C().only || !playing) return;
    const t = curTrack(); if (!t) return; const now = E.time(), d = E.dur(); const sg = segs();
    if (CH.armed !== t.id) {
      if (sg.length) { CH.armed = t.id; const s = sg[0]; CH.onlyDone = { a: s.a, b: s.b }; if (now < s.a - 2 || now > s.b) E.seek(Math.max(0, s.a - 0.4)); }
      else if (performance.now() - CH.onlyAt > 9000 && d > 60) { CH.armed = t.id; const a = d * 0.33; CH.onlyDone = { a, b: a + 30 }; if (now < a - 2) E.seek(a); }
      return;
    }
    if (CH.onlyDone && now > CH.onlyDone.b + 0.8 && !force) { CH.onlyDone = null; next(); }
  }
  PX.on && PX.on('track', () => setTimeout(recompute, 0));
  PX.on && PX.on('lyrics', () => setTimeout(recompute, 0));
  setInterval(() => { if (window.pulseWinHidden && !C().only) return; recompute(); tick(false); }, 500);
  // для Ctrl+K
  const prevX = window.dsExtraActions;
  window.dsExtraActions = () => [...(prevX ? prevX() : []),
    ['chorus', 'К припеву', 'C', () => jump(), 'припев chorus перемотать'],
    ['chorus', C().only ? 'Только припевы — выключить' : 'Только припевы — быстрый просмотр плейлиста', 'Shift + C', () => only(), 'припев превью быстро пролистать']];
  window.chorusRows = () => [
    grp('Припевы'),
    R('Метки припевов на полосе', 'Pulse сам находит припевы — по повторам в тексте песни или по громкости трека — и подсвечивает их на полосе перемотки', tg('chorus.marks'), 'припев метки полоса'),
    R('Клавиша C — к припеву', 'Shift + C — «Только припевы». Кнопка-волна на панели делает то же самое (правый клик — «Только припевы»)', tg('chorus.key'), 'припев клавиша c'),
    R('Только припевы', 'Быстрый просмотр плейлиста или волны: каждый трек начинается с припева и после него переключается на следующий', tg('chorus.only'), 'припев превью быстро только'),
  ];
  { const base = settingChanged; settingChanged = function (p) { const r = base.apply(this, arguments); if (/^chorus\./.test(p)) { CH.key = ''; CH.armed = null; CH.onlyAt = performance.now(); draw(); } return r; }; }
})();
