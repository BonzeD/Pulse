// Pulse AutoSync: привязка обычного текста к песне по анализу звука
// 1) декодируем трек, 2) выделяем полосу голоса (300–3400 Гц) и бас, 3) ищем онсеты (атаки слогов) и BPM,
// 4) находим участки, где звучит голос, 5) раскладываем строки по слогам на эти участки,
// 6) притягиваем начала строк и слов к ближайшим онсетам, 7) оцениваем «темп» (спокойно / драйв).
const AutoSync = (() => {
  const VOW = /[aeiouyаеёиоуыэюяіїєáéíóúàèìòùäöüœæ]+/gi;
  const syl = (w) => Math.max(1, (w.toLowerCase().match(VOW) || []).length);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const cache = new Map();

  async function render(audio, sr, build) {
    const len = Math.ceil(audio.duration * sr);
    const ctx = new OfflineAudioContext(1, len, sr);
    const src = ctx.createBufferSource(); src.buffer = audio;
    let node = src; for (const f of build(ctx)) { node.connect(f); node = f; }
    node.connect(ctx.destination); src.start();
    return (await ctx.startRendering()).getChannelData(0);
  }
  const biq = (ctx, type, f, q = 0.707) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  function frames(x, hop) { const n = Math.floor(x.length / hop), out = new Float32Array(n); for (let i = 0; i < n; i++) { let s = 0; for (let j = i * hop, e = j + hop; j < e; j++) s += x[j] * x[j]; out[i] = Math.sqrt(s / hop); } return out; }
  function smooth(a, w) { const o = new Float32Array(a.length); let s = 0; for (let i = 0; i < a.length; i++) { s += a[i]; if (i >= w) s -= a[i - w]; o[i] = s / Math.min(i + 1, w); } const r = new Float32Array(a.length), h = w >> 1; for (let i = 0; i < a.length; i++) r[i] = o[Math.min(a.length - 1, i + h)]; return r; }
  function pct(a, p) { const s = Array.from(a).sort((x, y) => x - y); return s[Math.floor(clamp(p, 0, 1) * (s.length - 1))] || 0; }

  const bufs = new Map();
  function decode(url) { // общий декодер (кэш на 2 трека)
    if (bufs.has(url)) return bufs.get(url);
    const p = (async () => { const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status); return new OfflineAudioContext(1, 1, 22050).decodeAudioData(await r.arrayBuffer()); })();
    bufs.set(url, p); p.catch(() => bufs.delete(url));
    while (bufs.size > 2) bufs.delete(bufs.keys().next().value);
    return p;
  }
  // 16 кГц моно WAV для распознавания голоса (whisper), полоса голоса 100–7000 Гц
  function toWav(x) {
    let peak = 0; for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]));
    const g = peak > 0 ? 0.95 / peak : 1;
    const buf = new ArrayBuffer(44 + x.length * 2), v = new DataView(buf);
    const W = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    W(0, 'RIFF'); v.setUint32(4, 36 + x.length * 2, true); W(8, 'WAVE'); W(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 16000, true); v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); W(36, 'data'); v.setUint32(40, x.length * 2, true);
    for (let i = 0; i < x.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, x[i] * g)) * 32767, true);
    return buf;
  }
  let worker = null;
  function vocalFocus(L, R) {
    return new Promise((res) => {
      try { worker = worker || new Worker('vocal-worker.js'); } catch { return res(null); }
      const done = (e) => { worker.removeEventListener('message', done); clearTimeout(to); res(e && e.data && e.data.out ? e.data.out : null); };
      const to = setTimeout(() => done(null), 60000);
      worker.addEventListener('message', done);
      worker.postMessage({ L, R, sr: 16000 });
    });
  }
  // 16 кГц WAV для распознавания голоса: wav — очищенный голос (центр панорамы + AGC), raw — обычная смесь 100–7000 Гц
  async function wav16k(url) {
    const audio = await decode(url);
    const len = Math.ceil(audio.duration * 16000), ctx = new OfflineAudioContext(Math.min(2, audio.numberOfChannels), len, 16000);
    const src = ctx.createBufferSource(); src.buffer = audio; const hp = biq(ctx, 'highpass', 90), lp = biq(ctx, 'lowpass', 7500);
    src.connect(hp); hp.connect(lp); lp.connect(ctx.destination); src.start();
    const r = await ctx.startRendering(), L = r.getChannelData(0), R = r.numberOfChannels > 1 ? r.getChannelData(1) : null;
    const mix = new Float32Array(L.length); for (let i = 0; i < L.length; i++) mix[i] = R ? (L[i] + R[i]) / 2 : L[i];
    const raw = toWav(mix);
    const foc = await vocalFocus(L.slice(), R ? R.slice() : undefined);
    return { wav: foc ? toWav(foc) : raw, raw: foc ? raw : null, dur: audio.duration };
  }
  async function analyze(url) {
    if (cache.has(url)) return cache.get(url);
    const p = (async () => {
      const audio = await decode(url);
      const sr = 11025, hop = 256, fps = sr / hop;
      const [full, voc, bass] = await Promise.all([
        render(audio, sr, () => []),
        render(audio, sr, (c) => [biq(c, 'highpass', 300), biq(c, 'lowpass', 3400), biq(c, 'peaking', 1500, 0.8)]),
        render(audio, sr, (c) => [biq(c, 'lowpass', 150)])
      ]);
      const F = frames(full, hop), V = frames(voc, hop), B = frames(bass, hop);
      const lg = (a) => a.map((v) => Math.log1p(v * 60));
      const LV = lg(V), LB = lg(B), LF = lg(F);
      const od = new Float32Array(LV.length), bd = new Float32Array(LB.length);
      for (let i = 1; i < LV.length; i++) { od[i] = Math.max(0, LV[i] - LV[i - 1]); bd[i] = Math.max(0, LB[i] - LB[i - 1]) + 0.5 * Math.max(0, LF[i] - LF[i - 1]); }
      // онсеты голоса: адаптивный порог
      const m = smooth(od, Math.round(fps)), onsets = []; const minGap = Math.round(0.1 * fps);
      let last = -1e9;
      for (let i = 1; i < od.length - 1; i++) if (od[i] > m[i] * 1.5 + 0.01 && od[i] >= od[i - 1] && od[i] >= od[i + 1] && i - last > minGap) { onsets.push(i / fps); last = i; }
      // BPM: автокорреляция огибающей атак баса
      let best = 0, bpm = 100;
      for (let b = 60; b <= 190; b += 0.5) {
        const lag = (60 / b) * fps, L = Math.floor(lag); const fr = lag - L; let s = 0;
        for (let i = 0; i + L + 1 < bd.length; i += 2) s += bd[i] * (bd[i + L] * (1 - fr) + bd[i + L + 1] * fr);
        s *= Math.exp(-0.5 * Math.pow(Math.log2(b / 110) / 0.9, 2));
        if (s > best) { best = s; bpm = b; }
      }
      // где звучит голос: уровень полосы голоса + плотность онсетов + доля голоса в спектре
      const lvl = smooth(V, Math.round(0.6 * fps)), ratio = smooth(V.map((v, i) => v / (F[i] + 1e-6)), Math.round(1.2 * fps));
      const hi = pct(lvl, 0.95) || 1, rMed = pct(ratio, 0.5);
      const dens = new Float32Array(V.length); for (const t of onsets) { const c = Math.round(t * fps); for (let k = Math.max(0, c - fps); k < Math.min(dens.length, c + fps); k++) dens[k] += 0.5; }
      const act = new Uint8Array(V.length);
      for (let i = 0; i < V.length; i++) act[i] = (lvl[i] / hi > 0.22 && (ratio[i] > rMed * 0.85 || dens[i] > 2.5)) ? 1 : 0;
      let segs = []; let s0 = -1;
      for (let i = 0; i <= act.length; i++) { if (act[i] && s0 < 0) s0 = i; if ((!act[i] || i === act.length) && s0 >= 0) { segs.push({ s: s0 / fps, e: i / fps }); s0 = -1; } }
      segs = segs.reduce((a, g) => { const p = a[a.length - 1]; if (p && g.s - p.e < 1.4) p.e = g.e; else a.push({ ...g }); return a; }, []).filter((g) => g.e - g.s > 1.2);
      if (!segs.length) segs = [{ s: Math.min(10, audio.duration * 0.08), e: audio.duration * 0.94 }];
      const energy = smooth(LF, Math.round(1.5 * fps)); const eHi = pct(energy, 0.97) || 1;
      // удары (бочка/атаки баса) и сетка долей по BPM — для визуализации «в темп»
      const bm = smooth(bd, Math.round(0.5 * fps)); const kicks = []; let lk = -1e9; const kGap = Math.round((60 / bpm / 2.2) * fps);
      let kMax = 0; for (let i = 0; i < bd.length; i++) kMax = Math.max(kMax, bd[i]);
      for (let i = 1; i < bd.length - 1; i++) if (bd[i] > bm[i] * 1.6 + kMax * 0.04 && bd[i] >= bd[i - 1] && bd[i] >= bd[i + 1] && i - lk > kGap) { kicks.push({ t: i / fps, s: Math.min(1, bd[i] / (kMax * 0.5)) }); lk = i; }
      // сетка долей: динамическое программирование (Эллис) — доли следуют за реальным, «плавающим» темпом,
      // а не за идеальной линейкой, которая к середине трека уезжала от ударов
      const per = (60 / bpm) * fps, n = bd.length;
      let mu = 0; for (let i = 0; i < n; i++) mu += bd[i]; mu /= n || 1; let sd = 0; for (let i = 0; i < n; i++) sd += (bd[i] - mu) ** 2; sd = Math.sqrt(sd / (n || 1)) || 1;
      const O = new Float32Array(n); for (let i = 0; i < n; i++) O[i] = bd[i] / sd;
      const sc = new Float32Array(n), bk = new Int32Array(n).fill(-1), tight = 80, lo0 = Math.round(per * 0.5), hi0 = Math.round(per * 2);
      for (let i = 0; i < n; i++) {
        let best = -1e9, bi = -1;
        for (let j = Math.max(0, i - hi0); j <= i - lo0; j++) { const c = sc[j] - tight * Math.pow(Math.log((i - j) / per), 2); if (c > best) { best = c; bi = j; } }
        sc[i] = O[i] + (bi >= 0 ? Math.max(0, best) : 0); bk[i] = best > 0 ? bi : -1;
      }
      let end = n - 1, bs = -1e9; for (let i = Math.max(0, n - Math.round(per * 2)); i < n; i++) if (sc[i] > bs) { bs = sc[i]; end = i; }
      const bi = []; for (let i = end; i >= 0; i = bk[i]) { bi.push(i); if (bk[i] < 0) break; } bi.reverse();
      // до первой найденной доли и после последней — продолжаем ровной линейкой
      while (bi.length && bi[0] - per > 0) bi.unshift(bi[0] - per);
      const sub = (i) => { const k = Math.round(i); if (k <= 0 || k >= n - 1) return i; const a = O[k - 1], b = O[k], c = O[k + 1], dd = a - 2 * b + c; return dd < 0 ? k + clamp((0.5 * (a - c)) / dd, -0.5, 0.5) : i; };
      let grid = bi.map((i) => sub(i) / fps);
      if (grid.length < 8) { grid = []; let bestPh = 0, bestS = -1; for (let ph = 0; ph < per; ph += 0.5) { let s2 = 0; for (let x = ph; x < n; x += per) s2 += bd[Math.round(x)] || 0; if (s2 > bestS) { bestS = s2; bestPh = ph; } } for (let x = bestPh; x < n; x += per) grid.push(x / fps); }
      const ivs = []; for (let i = 1; i < grid.length; i++) ivs.push(grid[i] - grid[i - 1]); ivs.sort((a, b) => a - b);
      if (ivs.length > 8) {
        const med = ivs[ivs.length >> 1];
        if (med > 0.25 && med < 1.2) {
          // точный темп: прямая через все доли (наклон = период), выбросы отбрасываем
          // сетка — подряд идущие доли, поэтому наклон прямой «номер доли → время» и есть точный период
          let P = med, A = grid[0], use = grid.map(() => true);
          for (let it = 0; it < 3; it++) { let sx = 0, sy = 0, sxx = 0, sxy = 0, m = 0; grid.forEach((t, k) => { if (!use[k]) return; sx += k; sy += t; sxx += k * k; sxy += k * t; m++; }); const d = m * sxx - sx * sx; if (m < 8 || d <= 0) break; const sl = (m * sxy - sx * sy) / d; if (Math.abs(sl - med) > med * 0.08) break; P = sl; A = (sy - sl * sx) / m; grid.forEach((t, k) => (use[k] = Math.abs(t - (A + k * P)) < P * 0.25)); }
          bpm = Math.round((60 / P) * 100) / 100;
        }
      }
      // сильная доля такта: та из четырёх фаз, где бас бьёт сильнее всего
      const bassOn = (t) => { const k = Math.round(t * fps); let m = 0; for (let j = k - 1; j <= k + 1; j++) m = Math.max(m, Math.max(0, (LB[j] || 0) - (LB[j - 1] || 0))); return m; };
      const ph4 = [0, 0, 0, 0]; grid.forEach((t, i) => (ph4[i % 4] += bassOn(t)));
      const down = ph4.indexOf(Math.max(...ph4));
      return { dur: audio.duration, bpm, onsets, segs, fps, kicks, grid, down, energy: (t) => clamp(energy[Math.min(energy.length - 1, Math.max(0, Math.round(t * fps)))] / eHi, 0, 1) };
    })();
    cache.set(url, p); p.catch(() => cache.delete(url));
    return p;
  }

  function parsePlain(text) {
    const stanzas = []; let cur = [];
    for (const raw of text.split(/\r?\n/)) {
      const t = raw.trim();
      if (!t) { if (cur.length) stanzas.push(cur), (cur = []); continue; }
      if (/^\[.*\]$|^\(.*\)$/.test(t) && t.length < 40) { if (cur.length) stanzas.push(cur), (cur = []); continue; } // [Припев] и т.п.
      const words = t.split(/(\s+)/).reduce((a, p) => { if (/^\s+$/.test(p) && a.length) a[a.length - 1] += p; else if (p) a.push(p); return a; }, []);
      cur.push({ text: t, words, syl: words.reduce((s, w) => s + syl(w), 0) });
    }
    if (cur.length) stanzas.push(cur);
    return stanzas;
  }

  // карта «доля текста → время» только по участкам с голосом
  function timeline(segs) {
    const total = segs.reduce((s, g) => s + g.e - g.s, 0);
    return { total, at: (f) => { let x = clamp(f, 0, 1) * total; for (const g of segs) { const d = g.e - g.s; if (x <= d) return g.s + x; x -= d; } return segs[segs.length - 1].e; } };
  }
  const nearest = (arr, t, tol) => { let lo = 0, hi = arr.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < t) lo = m + 1; else hi = m; } let b = null; for (const i of [lo - 1, lo]) if (arr[i] != null && Math.abs(arr[i] - t) <= tol && (b == null || Math.abs(arr[i] - t) < Math.abs(b - t))) b = arr[i]; return b; };

  function align(text, an, dur) {
    const stanzas = parsePlain(text); if (!stanzas.length) return null;
    dur = (an && an.dur) || dur || 180;
    const segs = an ? an.segs : [{ s: Math.min(12, dur * 0.07), e: dur * 0.94 }];
    const onsets = an ? an.onsets : [];
    const TL = timeline(segs);
    const BREAK = 3; // «вес» паузы между куплетами в слогах
    const allSyl = stanzas.reduce((s, st) => s + st.reduce((a, l) => a + l.syl + 1, 0), 0) + BREAK * (stanzas.length - 1);
    let acc = 0; const out = [];
    const sps = allSyl / TL.total;
    stanzas.forEach((st, si) => {
      // старт куплета: притягиваем к началу ближайшего участка с голосом
      let st0 = TL.at(acc / allSyl);
      const snap = segs.map((g) => g.s).reduce((b, s) => (Math.abs(s - st0) < Math.abs(b - st0) ? s : b), Infinity);
      const stDur = (st.reduce((a, l) => a + l.syl + 1, 0) / allSyl) * TL.total;
      if (Math.abs(snap - st0) < Math.max(2.5, stDur * 0.3) && (!out.length || snap > out[out.length - 1].t + 1)) st0 = snap;
      const stSyl = st.reduce((a, l) => a + l.syl + 1, 0);
      const stEnd = TL.at((acc + stSyl) / allSyl);
      if (si > 0 && out.length) { const prevEnd = out[out.length - 1].end; if (st0 - prevEnd > 4) out.push({ t: prevEnd, gap: st0 - prevEnd }); }
      let a2 = 0;
      st.forEach((l) => {
        let t0 = st0 + ((stEnd - st0) * a2) / stSyl; let t1 = st0 + ((stEnd - st0) * (a2 + l.syl + 1)) / stSyl;
        const sn = nearest(onsets, t0, 0.35); if (sn != null && (!out.length || sn > out[out.length - 1].t + 0.3)) t0 = sn;
        const lineOn = onsets.filter((o) => o >= t0 - 0.02 && o < t1);
        const sing = Math.min(t1 - t0, l.syl * (0.18 + 0.5 / Math.max(1, sps)) + 0.6);
        let k = 0; const words = l.words.map((w) => {
          const frac = k / l.syl; k += syl(w);
          let wt = t0 + sing * frac;
          if (lineOn.length >= l.syl * 0.6) { const oi = Math.min(lineOn.length - 1, Math.round(frac * lineOn.length)); if (Math.abs(lineOn[oi] - wt) < 0.6) wt = lineOn[oi]; }
          return { t: wt, s: w };
        });
        for (let i = 1; i < words.length; i++) if (words[i].t <= words[i - 1].t) words[i].t = words[i - 1].t + 0.05;
        out.push({ t: t0, end: t0 + sing, text: l.text, words, energy: an ? an.energy(t0 + sing / 2) : 0.5 });
        a2 += l.syl + 1;
      });
      acc += stSyl + BREAK;
    });
    if (out.length && out[0].t > 5) out.unshift({ t: 0, gap: out[0].t });
    return { lines: out, meta: metaOf(an, sps) };
  }

  function metaOf(an, sps) {
    const bpm = an ? an.bpm : null;
    const pace = clamp((bpm ? ((bpm - 75) / 90) * 0.55 : 0.25) + ((sps - 2.2) / 3.5) * 0.45, 0, 1);
    return { bpm, sps, pace, label: pace < 0.36 ? 'спокойно' : pace < 0.68 ? 'ровно' : 'драйв' };
  }
  // для синхронного LRC: темп по плотности слов + BPM (если есть анализ)
  function paceForSynced(lines, an) {
    const L = lines.filter((l) => !l.gap && l.words); if (L.length < 2) return metaOf(an, 2.5);
    let syls = 0, time = 0;
    for (let i = 0; i < L.length - 1; i++) { const d = L[i + 1].t - L[i].t; if (d > 0 && d < 10) { syls += L[i].words.reduce((s, w) => s + syl(w.s), 0); time += d; } }
    if (an) L.forEach((l) => (l.energy = an.energy(l.t + 1)));
    return metaOf(an, time ? syls / time : 2.5);
  }
  return { analyze, align, paceForSynced, syl, wav16k, decode };
})();
