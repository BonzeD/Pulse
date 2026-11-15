/* Pulse Atlas 3 — «Космос». Плейлисты — звёзды, жанры — созвездия.
   Всё небо рисуется на одном canvas: каждая точка проходит через warp(), поэтому «волна»
   искажает сцену целиком, как воду. Воспроизведение целиком делегируется плееру Pulse. */
(() => {
  'use strict';
  const M = PulseAtlasModel;
  const RU = () => /^(ru|uk|be|kk)/.test(String(S().app?.language || 'ru'));
  const T = (a, b) => (RU() ? a : b);
  const E = (x) => esc(String(x ?? ''));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2));
  const calm = () => document.body.classList.contains('no-anim') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const backOut = (t) => { t = clamp(t, 0, 1); const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return ((h >>> 0) % 10000) / 10000; };
  const plural = (n, a, b, c) => (n % 100 >= 11 && n % 100 <= 14 ? c : n % 10 === 1 ? a : n % 10 >= 2 && n % 10 <= 4 ? b : c);
  const cnt = (n) => (RU() ? `${n} ${plural(n, 'песня', 'песни', 'песен')}` : `${n} ${n === 1 ? 'song' : 'songs'}`);
  const cntStars = (n) => (RU() ? `${n} ${plural(n, 'звезда', 'звезды', 'звёзд')}` : `${n} ${n === 1 ? 'star' : 'stars'}`);
  const fmtD = (s) => { s = Math.max(0, Math.floor(s || 0)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`; };
  const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '') || e.target?.isContentEditable;

  // ---------- иконки Атласа (свои, чтобы не зависеть от набора приложения) ----------
  const P = {
    plus: 'M12 5v14M5 12h14', minus: 'M5 12h14', x: 'M6 6l12 12M18 6 6 18', play: 'M8 5.5v13l10.5-6.5z', check: 'M5 12.5l4.2 4.2L19 7',
    star: 'M12 3l2.4 6.3L21 9.8l-5.1 4.3L17.6 21 12 17.3 6.4 21l1.7-6.9L3 9.8l6.6-.5z', spark: 'M12 2v6M12 16v6M2 12h6M16 12h6M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3',
    link: 'M5 18 10 9l5 6 4-9M5 18a1.6 1.6 0 1 0 0 .01M10 9a1.6 1.6 0 1 0 0 .01M15 15a1.6 1.6 0 1 0 0 .01M19 6a1.6 1.6 0 1 0 0 .01',
    list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01', shuffle: 'M3 7h4l10 10h4M17 4l4 3-4 3M3 17h4l3-3M14 10l3-3h4M17 14l4 3-4 3',
    edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4', trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6', undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
    fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5', refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7', music: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
    search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5', open: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6', wand: 'M4 20 15 9M14 4v2M19 9h2M17.5 5.5 19 4M10 4l.7 1.6L12.3 6l-1.6.7L10 8.3l-.7-1.6L7.7 6l1.6-.7z',
    rotate: 'M20 12a8 8 0 1 1-3-6.2M20 4v5h-5', move: 'M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3',
    eq: 'M6 18V10M10 18V6M14 18v-8M18 18V8', disc: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'
  };
  Object.assign(P, {
    prev: 'M6 5v14M19 5.5v13L9 12z', next: 'M18 5v14M5 5.5v13L15 12z', pause: 'M7.5 5h3.2v14H7.5zM13.3 5h3.2v14h-3.2z',
    heart: 'M12 20s-7.2-4.5-8.7-9.1A4.7 4.7 0 0 1 12 6.4a4.7 4.7 0 0 1 8.7 4.5C19.2 15.5 12 20 12 20z',
    dislike: 'M15 4H7.6a2 2 0 0 0-2 1.7l-1.3 7A2 2 0 0 0 6.3 15H10v4a2 2 0 0 0 2 2l3-7zM15 4h3a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-3',
    repeat: 'M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4',
    vol: 'M4 9.5v5h3.5L12 18.5v-13L7.5 9.5zM15.5 9a4.2 4.2 0 0 1 0 6M18.2 6.5a8 8 0 0 1 0 11', mute: 'M4 9.5v5h3.5L12 18.5v-13L7.5 9.5zM16 9.5l5 5M21 9.5l-5 5',
    expand: 'M14 4h6v6M20 4l-6 6M10 20H4v-6M4 20l6-6', more: 'M5 12h.01M12 12h.01M19 12h.01'
  });
  const I = (k, cls = '') => `<svg class="ai ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${P[k]}"/></svg>`;

  // ---------- данные ----------
  function db() {
    const c = lib.atlasCosmos;
    if (!c || c.version !== M.VERSION) {
      if (c && (c.stars?.length || c.groups?.length)) lib.atlasCosmosLegacy = JSON.parse(JSON.stringify(c));
      lib.atlasCosmos = M.migrate(c); save();
    }
    return lib.atlasCosmos;
  }
  const star = (k) => db().stars.find((s) => s.id === k);
  const group = (k) => db().groups.find((g) => g.id === k);
  const groupOf = (k) => db().groups.find((g) => g.members.includes(k));
  const localPl = (s) => s && s.kind === 'playlist' && (lib.playlists || []).find((p) => p.id === s.source);
  const tracks = (s) => { if (!s) return []; if (s.kind === 'likes' && typeof mine === 'function') { try { const m = mine(); if (m && Array.isArray(m.tracks) && m.tracks.length) return m.tracks.filter((t) => t && t.id); } catch {} } const p = localPl(s); return (p && Array.isArray(p.tracks) ? p.tracks : s.tracks || []).filter((t) => t && t.id); };
  const name = (s) => s?.alias || localPl(s)?.name || s?.name || T('Без названия', 'Untitled');
  const isSong = (s) => tracks(s).length === 1;
  const groupTracks = (g) => g.members.reduce((n, id) => n + tracks(star(id)).length, 0);
  const hueOf = (g) => (g ? g.hue ?? 212 : 212);

  function playlists() {
    const local = (lib.playlists || []).filter((p) => p.id !== MINE).map((p) => ({ id: p.id, name: p.name, tracks: p.tracks || [], type: 'local' }));
    if (typeof mine === 'function') { const m = mine(); if (m.tracks.length) local.unshift({ id: MINE, name: m.name, tracks: m.tracks, type: 'likes' }); }
    let remote = [];
    try {
      const c = CL();
      remote = c === 'yt' ? (accLists || []).map((p) => ({ id: p.browseId || 'VL' + p.listId, name: p.name, type: 'remote', sub: p.sub }))
        : c === 'am' || c === 'sp' ? ((svcLists && svcLists[c]) || []).map((p) => ({ id: p.browseId, name: p.title, type: 'remote', sub: p.sub })) : [];
    } catch { remote = []; }
    return [...local, ...remote.filter((p) => p.id && p.name && !local.some((x) => x.id === p.id))];
  }
  async function loadPlaylist(p) {
    if (p.type !== 'remote') return p.tracks || [];
    let data = typeof cachedPage === 'function' ? cachedPage(p.id) : null;
    if (online()) try { data = await ytm('browse', p.id); } catch (err) { if (!data) throw err; }
    if (!data || !Array.isArray(data.tracks)) throw Error(T('Не удалось загрузить песни. Проверь сеть и вход в сервис.', 'Could not load songs. Check your connection and sign-in.'));
    return data.tracks;
  }
  function pool() {
    const all = [...Object.keys(lib.likes || {}).filter((k) => lib.likes[k]).map((k) => lib.known?.[k]), ...(lib.playlists || []).flatMap((p) => p.tracks || []),
      ...(window.MediaLibrary?.tracks?.() || []), ...(lib.queue?.tracks || [])];
    return [...new Map(all.filter((t) => t?.id && t?.title).map((t) => [t.id, t])).values()].slice(0, 1500);
  }
  const cover = (t, n = 80, cls = '') => {
    const src = t ? artOf(t, n) : '';
    return `<span class="atl-cv ${cls} noimg"><i>${I('music')}</i>${src ? `<img src="${E(src)}" alt="" loading="lazy" style="opacity:0" ${IMG_ERR}>` : ''}</span>`;
  };

  // ---------- воспроизведение ----------
  function playingStar() {
    const q = lib.queue, src = q && q.src; if (!src) return '';
    if (Array.isArray(src.atlasRanges)) { const r = src.atlasRanges.find((r) => q.idx >= r[1] && q.idx < r[2]); if (r) return r[0]; }
    return src.atlasStar || '';
  }
  const isPlaying = () => document.body.classList.contains('playing');
  function play(s, i = 0) {
    const ts = tracks(s); if (!ts.length) return toast(T('В этой звезде пока нет песен', 'This star has no songs yet'));
    playList(ts,i,name(s),{atlasStar:s.id});
    ignite(s.id);
  }
  function shuffleStar(s) { const ts = tracks(s); if (!ts.length) return; if (typeof shuffleList === 'function') shuffleList(ts, name(s), { atlasStar: s.id }); else play(s, Math.floor(Math.random() * ts.length)); ignite(s.id); }
  function playGroup(g) {
    const ts = [], ranges = [];
    for (const id of g.members) { const t = tracks(star(id)); if (!t.length) continue; ranges.push([id, ts.length, ts.length + t.length]); ts.push(...t); }
    if (!ts.length) return toast(T('В созвездии нет песен', 'No songs in this constellation'));
    playList(ts, 0, g.name, { atlasStar: ranges[0][0], atlasGroup: g.id, atlasRanges: ranges });
    ignite(ranges[0][0]);
  }

  // ---------- состояние сцены ----------
  const st = {
    el: null, cv: null, ctx: null, W: 1, H: 1, dpr: 1, raf: 0, t: 0, last: 0, intro: 0, ro: null,
    mode: '', focus: '', hover: '', hoverG: '', panel: '', panelArg: null, home: null,
    pick: [], pickT: {}, edit: '', link: '', undo: [], placeAt: null,
    down: null, drag: null, vel: { x: 0, y: 0 }, mouse: { x: -1e4, y: -1e4, in: false },
    waves: [], meteors: [], nextMeteor: 0, fx: [], rings: [], vis: {}, off: {}, gn: {}, edgeT: {}, shake: {},
    scr: {}, bg: [], neb: [], beatS: 0, beatHi: false, lastRing: 0, lastBeatAt: 0, extBeat: 0, pendingBirth: new Set(), tipFor: '', toolsT: 0
  };
  const cam = { x: 0, y: 0, z: 1 }, camT = { x: 0, y: 0, z: 1 };
  const ZMIN = 0.3, ZMAX = 3.4;

  function vis(id) {
    let v = st.vis[id];
    if (!v) { const s = star(id); v = st.vis[id] = { hov: 0, heat: 0, pick: 0, born: -1e9, ph: hash(id) * 6.283, dx: s ? s.x : 0, dy: s ? s.y : 0, ign: -1e9, pulse: 0 }; }
    return v;
  }
  const offOf = (k) => (st.off[k] = st.off[k] || { x: 0, y: 0, vx: 0, vy: 0 });
  // мировая позиция звезды с учётом «разлёта» созвездий, сглаживания и лёгкого дыхания
  function wpos(s) {
    const v = vis(s.id), g = groupOf(s.id), o = offOf(g ? 'g:' + g.id : 's:' + s.id), b = calm() ? 0 : 1.6;
    return { x: v.dx + o.x + Math.sin(st.t / 1900 + v.ph) * b, y: v.dy + o.y + Math.cos(st.t / 2300 + v.ph * 1.3) * b };
  }
  const sx = (x) => (x - cam.x) * cam.z + st.W / 2, sy = (y) => (y - cam.y) * cam.z + st.H / 2;
  const toWorld = (x, y, c = cam) => ({ x: (x - st.W / 2) / c.z + c.x, y: (y - st.H / 2) / c.z + c.y });
  const panelW = () => (st.panel && st.el ? Math.min(st.el.querySelector('#atlPanel')?.offsetWidth || 0, st.W * 0.6) : 0);

  // ---------- волна: смещение каждой точки от расходящегося кольца ----------
  let WX = 0, WY = 0;
  function warp(x, y) {
    let dx = 0, dy = 0;
    for (const w of st.waves) {
      const age = (st.t - w.t0) / 1000; if (age < 0 || age > w.dur) continue;
      const ox = x - w.ox, oy = y - w.oy, r = Math.hypot(ox, oy) + 1e-3, d = r - age * w.speed, f = Math.pow(1 - age / w.dur, 2);
      const disp = w.A * f * Math.exp(-(d * d) / (2 * w.sig * w.sig)) * Math.sin(d * 0.05);
      dx += (ox / r) * disp; dy += (oy / r) * disp;
    }
    WX = x + dx; WY = y + dy;
  }
  function wave(wx, wy, A = 16, delay = 0) {
    if (calm()) return;
    st.waves.push({ wx, wy, t0: st.t + delay, A, dur: 1.75, speed: 820, sig: 95, ox: 0, oy: 0 });
    st.el?.classList.remove('rippling'); void st.el?.offsetWidth; st.el?.classList.add('rippling');
  }

  // ---------- спрайты свечения ----------
  const SPR = {};
  function sprite(k, r, g, b) {
    if (SPR[k]) return SPR[k];
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, `rgba(${r},${g},${b},1)`); gr.addColorStop(0.12, `rgba(${r},${g},${b},.55)`); gr.addColorStop(0.35, `rgba(${r},${g},${b},.16)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128); return (SPR[k] = c);
  }
  const BLUE = [150, 196, 255], RED = [255, 66, 88];
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

  function seedBackground() {
    const rnd = (() => { let s = 1337; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9) >>> 0) / 4294967296; })();
    st.bg = [];
    const layers = [[0.06, 520, 0.5], [0.16, 260, 0.9], [0.34, 110, 1.35]];
    for (const [d, n, sz] of layers) for (let i = 0; i < n; i++) {
      const warm = rnd();
      st.bg.push({ u: rnd(), v: rnd(), d, r: sz * (0.4 + rnd() * 0.8), a: 0.25 + rnd() * 0.6, ph: rnd() * 6.28, sp: 0.4 + rnd() * 1.8, c: warm > 0.92 ? '255,226,196' : warm > 0.8 ? '200,214,255' : '235,240,255', late: rnd() });
    }
    for (let i = 0; i < 360; i++) { const u = rnd(), g = (rnd() + rnd() + rnd() - 1.5) * 0.075; st.bg.push({ u, v: ((u * 0.55 + 0.22 + g) % 1 + 1) % 1, d: 0.03, r: 0.3 + rnd() * 0.45, a: 0.1 + rnd() * 0.32, ph: rnd() * 6.28, sp: 0.3 + rnd(), c: rnd() > 0.7 ? '214,204,255' : '230,236,255', late: rnd() }); }
    st.neb = [{ u: 0.22, v: 0.3, r: 0.75, c: '40,60,150' }, { u: 0.78, v: 0.66, r: 0.65, c: '90,40,140' }, { u: 0.55, v: 0.1, r: 0.5, c: '20,90,130' }];
  }

  // ---------- рендер ----------
  function frame(ts) {
    st.raf = 0;
    if (!st.el || !st.el.isConnected) return unmount();
    const dt = Math.min(0.05, st.last ? (ts - st.last) / 1000 : 0.016); st.last = ts; st.t = ts;
    step(dt); draw(dt);
    st.raf = requestAnimationFrame(frame);
  }
  function step(dt) {
    const c = db();
    // камера: инерция панорамы и мягкое приближение к цели
    if (!st.drag && (Math.abs(st.vel.x) + Math.abs(st.vel.y) > 0.5)) { camT.x += st.vel.x * dt; camT.y += st.vel.y * dt; const f = Math.exp(-dt * 4.2); st.vel.x *= f; st.vel.y *= f; }
    if (st.fly) {
      // перелёт: плавный ease-in-out, зум в логарифмах и лёгкое «отдаление» на дальних перелётах
      const f = st.fly, p = clamp((st.t - f.t0) / f.dur, 0, 1), e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      const lz = Math.log(f.from.z) + (Math.log(camT.z) - Math.log(f.from.z)) * e;
      const far = (Math.hypot(camT.x - f.from.x, camT.y - f.from.y) * Math.min(f.from.z, camT.z)) / Math.max(st.W, st.H);
      const bump = clamp((far - 0.3) * 0.45, 0, 0.4) * Math.sin(Math.PI * p);
      cam.z = Math.exp(lz) * (1 - bump); cam.x = f.from.x + (camT.x - f.from.x) * e; cam.y = f.from.y + (camT.y - f.from.y) * e;
      if (p >= 1) { st.fly = null; Object.assign(cam, camT); }
    } else {
      const k = 1 - Math.exp(-dt * (calm() ? 18 : 7));
      cam.z += (camT.z - cam.z) * k;
      if (st.zoomA) {
        // точка под курсором остаётся под курсором всё время, пока идёт зум
        const a = st.zoomA; cam.x = a.wx - (a.mx - st.W / 2) / cam.z; cam.y = a.wy - (a.my - st.H / 2) / cam.z;
        if (Math.abs(camT.z - cam.z) < 1e-3) { cam.z = camT.z; cam.x = camT.x; cam.y = camT.y; st.zoomA = null; }
      } else { cam.x += (camT.x - cam.x) * k; cam.y += (camT.y - cam.y) * k; }
    }
    // бит плеера (глобальная beat из app.js) + запасной метроном, если анализ спит
    const b = Math.max(typeof beat === 'number' ? beat * 0.8 : 0, onset(dt), st.extBeat || 0); st.extBeat *= Math.exp(-dt * 8);
    st.beatS = Math.max(b, st.beatS * Math.exp(-dt * 6.5));
    const ps = isPlaying() ? playingStar() : '';
    if (ps && star(ps) && !calm()) {
      if (b > 0.5 && !st.beatHi && st.t - st.lastRing > 260) { st.beatHi = true; st.lastRing = st.lastBeatAt = st.t; ring(ps, 1); const g = groupOf(ps); if (g) for (const m of g.members) if (m !== ps) ring(m, 0.4); }
      if (b < 0.3) st.beatHi = false;
      if (st.t - st.lastBeatAt > 2600 && st.t - st.lastRing > 900) { st.lastRing = st.t; ring(ps, 0.75); }
    }
    // разлёт созвездий от звезды в фокусе — пружина с лёгким перелётом
    const f = st.focus && star(st.focus), fg = f && groupOf(f.id), keys = new Set();
    const push = (k2, cx, cy, mul) => {
      keys.add(k2); const o = offOf(k2); let tx = 0, ty = 0;
      if (f) { const dx = cx - f.x, dy = cy - f.y, d = Math.hypot(dx, dy) || 1, m = mul * 150 * clamp(800 / (d + 260), 0.45, 1.7); tx = (dx / d) * m; ty = (dy / d) * m; }
      if (calm()) { o.x = tx; o.y = ty; o.vx = o.vy = 0; return; }
      o.vx += ((tx - o.x) * 46 - o.vx * 9.5) * dt; o.vy += ((ty - o.y) * 46 - o.vy * 9.5) * dt; o.x += o.vx * dt; o.y += o.vy * dt;
    };
    for (const g of c.groups) { if (fg && g.id === fg.id) { push('g:' + g.id, 0, 0, 0); offOf('g:' + g.id).x *= 1; continue; } const ctr = M.center(c.stars, g.members); push('g:' + g.id, ctr.x, ctr.y, 1); }
    for (const s of c.stars) if (!groupOf(s.id)) push('s:' + s.id, s.x, s.y, s.id === st.focus ? 0 : 0.65);
    if (fg) { const o = offOf('g:' + fg.id); o.vx += (-o.x * 46 - o.vx * 9.5) * dt; o.vy += (-o.y * 46 - o.vy * 9.5) * dt; }
    // визуальные состояния звёзд
    const kk = (r) => 1 - Math.exp(-dt * r), sg = ps && groupOf(ps);
    for (const s of c.stars) {
      const v = vis(s.id), dragging = st.drag && st.drag.ids && st.drag.ids.includes(s.id);
      const pk = dragging || calm() ? 1 : kk(13); v.dx += (s.x - v.dx) * pk; v.dy += (s.y - v.dy) * pk;
      const hot = s.id === ps ? 1 : 0;
      v.heat += (hot - v.heat) * kk(hot ? 3.2 : 2.2);
      v.hov += ((st.hover === s.id || st.focus === s.id || st.link === s.id ? 1 : 0) - v.hov) * kk(10);
      v.pick += ((st.mode === 'create' && st.pick.includes(s.id) ? 1 : 0) - v.pick) * kk(12);
      const tp = s.id === ps ? 1 : sg && sg.members.includes(s.id) ? 0.38 : 0;
      v.pulse += (tp - v.pulse) * kk(4);
    }
    for (const g of c.groups) {
      const on = st.hoverG === g.id || (st.flashG && st.flashG.id === g.id && st.t < st.flashG.until) || st.edit === g.id || (fg && fg.id === g.id) || (st.panel === 'group' && st.panelArg === g.id) ? 1 : 0;
      st.gn[g.id] = (st.gn[g.id] || 0) + (on - (st.gn[g.id] || 0)) * kk(on ? 7 : 5);
    }
    st.waves = st.waves.filter((w) => st.t - w.t0 < w.dur * 1000);
    st.rings = st.rings.filter((r) => st.t - r.t0 < 1500);
    st.fx = st.fx.filter((x) => st.t - x.t0 < (x.life || 1400));
    // падающие звёзды
    if (!calm() && st.t > st.nextMeteor) {
      if (st.nextMeteor) { const a = 0.35 + Math.random() * 0.5, sp = 900 + Math.random() * 500; st.meteors.push({ x: Math.random() * SK.W * 0.9, y: Math.random() * SK.H * 0.4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t0: st.t, life: 700 + Math.random() * 500 }); }
      st.nextMeteor = st.t + 4500 + Math.random() * 9000;
    }
    st.meteors = st.meteors.filter((m) => st.t - m.t0 < m.life);
    for (const w of st.waves) { w.ox = sx(w.wx); w.oy = sy(w.wy); }
  }
  const ring = (id, s) => st.rings.push({ id, t0: st.t, s });
  function ignite(id) { vis(id).ign = st.t; const s = star(id); if (s) { const p = wpos(s); wave(p.x, p.y, 7); } }

  // ---------- Космос на всё окно ----------
  // Фон рисуется на отдельном холсте под всем интерфейсом: звёзды, туманности, метеоры и кометы живут
  // в координатах окна и спокойно пролетают под боковой панелью и плеером — никакого «залетела в Атлас и пропала».
  const SK = { cv: null, x: null, W: 1, H: 1, dpr: 1, ox: 0, oy: 0, mx: -1e4, my: -1e4, lean: { x: 0, y: 0 }, comets: [], dust: [], nextComet: 0, last: 0 };
  function skyResize() {
    if (!SK.cv) return; SK.dpr = Math.min(2, window.devicePixelRatio || 1); SK.W = Math.max(1, innerWidth); SK.H = Math.max(1, innerHeight);
    SK.cv.width = Math.round(SK.W * SK.dpr); SK.cv.height = Math.round(SK.H * SK.dpr);
  }
  function skyEl() {
    if (SK.cv && SK.cv.isConnected) return SK.cv;
    const c = SK.cv || document.createElement('canvas'); c.id = 'atlSky'; c.className = 'atl-sky'; c.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(c, document.body.firstChild); SK.cv = c; SK.x = c.getContext('2d'); skyResize(); return c;
  }
  function skyOn(on) {
    if (on) {
      skyEl(); SK.comets = []; SK.dust = []; SK.pc = null; SK.nextComet = performance.now() + 2600 + Math.random() * 2600;
      requestAnimationFrame(() => { if (st.el) document.body.classList.add('atlas-sky'); });
    } else document.body.classList.remove('atlas-sky');
  }
  addEventListener('resize', () => { if (SK.cv) skyResize(); });
  addEventListener('pointermove', (e) => { SK.mx = e.clientX; SK.my = e.clientY; }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => { SK.mx = SK.my = -1e4; });
  try { if (typeof PX !== 'undefined' && PX.on) PX.on('page', () => { if (document.body.dataset.page !== 'atlas') document.body.classList.remove('atlas-sky'); }); } catch {}

  function spawnComet() {
    const W = SK.W, H = SK.H, side = Math.random();
    let x0, y0, ang;
    if (side < 0.45) { x0 = -70; y0 = H * (0.08 + Math.random() * 0.5); ang = -0.12 + Math.random() * 0.45; }
    else if (side < 0.9) { x0 = W * (0.05 + Math.random() * 0.6); y0 = -70; ang = 0.55 + Math.random() * 0.6; }
    else { x0 = W + 70; y0 = H * (0.1 + Math.random() * 0.4); ang = Math.PI - 0.1 - Math.random() * 0.4; }
    const sp = 120 + Math.random() * 110, warm = Math.random() < 0.35;
    SK.comets.push({ x: x0, y: y0, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, curve: (Math.random() - 0.5) * 0.08, t0: st.t, trail: [], c: warm ? [255, 196, 222] : [164, 206, 255], hit: new Set(), dead: false });
  }

  function drawSky(intro) {
    skyEl();
    const x = SK.x, W = SK.W, H = SK.H, t = st.t, z = cam.z, dt = Math.min(0.05, Math.max(0, (t - (SK.last || t)) / 1000)); SK.last = t;
    if (st.el) { const r = st.el.getBoundingClientRect(); SK.ox = r.left; SK.oy = r.top; }
    const cx = SK.ox + st.W / 2, cy = SK.oy + st.H / 2, still = calm();
    // лёгкий параллакс за курсором — как будто чуть наклоняешь голову
    const hasM = SK.mx > -1e3 && !still, lx = hasM ? SK.mx / W - 0.5 : 0, ly = hasM ? SK.my / H - 0.5 : 0, kl = 1 - Math.exp(-dt * 2.2);
    SK.lean.x += (lx - SK.lean.x) * kl; SK.lean.y += (ly - SK.lean.y) * kl;
    // кометы не приклеены к экрану: камера двигается — они уплывают вместе с небом (глубина CD)
    const CD = 0.55, czl = (zz) => 1 + (zz - 1) * CD * 0.6;
    if (SK.pc) {
      const sc = czl(z) / czl(SK.pc.z), dx = -(cam.x - SK.pc.x) * z * CD - (SK.lean.x - SK.pc.lx) * CD * 110, dy = -(cam.y - SK.pc.y) * z * CD - (SK.lean.y - SK.pc.ly) * CD * 110;
      if (Math.abs(sc - 1) > 1e-6 || Math.abs(dx) > 1e-3 || Math.abs(dy) > 1e-3) {
        const mv = (o) => { o.x = cx + (o.x - cx) * sc + dx; o.y = cy + (o.y - cy) * sc + dy; };
        for (const c of SK.comets) { mv(c); for (const p of c.trail) mv(p); }
        for (const d of SK.dust) mv(d);
        for (const m of st.meteors) mv(m);
      }
    }
    SK.pc = { x: cam.x, y: cam.y, z, lx: SK.lean.x, ly: SK.lean.y };
    x.setTransform(SK.dpr, 0, 0, SK.dpr, 0, 0); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
    x.fillStyle = '#010104'; x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = 'lighter';
    // туманности: почти незаметны, чуть дышат в такт
    const TW = Math.max(W, H) * 1.6, TH = TW * 0.75, nb = 0.07 + st.beatS * 0.025;
    for (const n of st.neb) {
      const px = ((n.u * TW - cam.x * 0.04 - SK.lean.x * 40) % TW + TW) % TW - (TW - W) / 2, py = ((n.v * TH - cam.y * 0.04 - SK.lean.y * 40) % TH + TH) % TH - (TH - H) / 2;
      const r = n.r * Math.max(W, H) * (0.9 + 0.1 * Math.sin(t / 7000 + n.u * 9));
      const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, `rgba(${n.c},${nb * intro})`); g.addColorStop(1, `rgba(${n.c},0)`); x.fillStyle = g; x.fillRect(0, 0, W, H);
    }
    // свет от курсора
    if (hasM) { const g = x.createRadialGradient(SK.mx, SK.my, 0, SK.mx, SK.my, 240); g.addColorStop(0, 'rgba(130,160,255,.05)'); g.addColorStop(1, 'rgba(130,160,255,0)'); x.fillStyle = g; x.fillRect(SK.mx - 240, SK.my - 240, 480, 480); }
    // фоновые звёзды (3 слоя + Млечный путь). При входе — прыжок в гиперпространство.
    const tw = Math.max(W, H) * 1.3, th = tw, hyp = still ? 0 : 1 - ease(clamp((t - st.intro) / 1250, 0, 1));
    for (const p of st.bg) {
      const zl = 1 + (z - 1) * p.d * 0.6;
      let px = ((p.u * tw - cam.x * p.d * z - SK.lean.x * p.d * 110) % tw + tw) % tw - (tw - W) / 2, py = ((p.v * th - cam.y * p.d * z - SK.lean.y * p.d * 110) % th + th) % th - (th - H) / 2;
      px = cx + (px - cx) * zl; py = cy + (py - cy) * zl;
      if (px < -4 || py < -4 || px > W + 4 || py > H + 4) continue;
      const born = hyp > 0.02 ? 1 : clamp((intro - p.late * 0.7) / 0.3, 0, 1); if (!born) continue;
      let a = p.a * (0.55 + 0.45 * Math.sin(t / 1000 * p.sp + p.ph)) * born * (1 + st.beatS * p.d * 1.6);
      if (hasM) { const dm = Math.hypot(px - SK.mx, py - SK.my); if (dm < 170) a += Math.pow(1 - dm / 170, 2) * 0.55; }
      a = Math.min(1, a);
      warp(px - SK.ox, py - SK.oy); const X = WX + SK.ox, Y = WY + SK.oy, r = p.r * (0.8 + 0.2 * zl);
      if (hyp > 0.02) {
        const dx = X - cx, dy = Y - cy, L = hyp * hyp * Math.hypot(dx, dy) * (0.25 + p.d * 2.2) + 0.5, an = Math.atan2(dy, dx);
        x.strokeStyle = `rgba(${p.c},${Math.min(1, a * (1 + hyp))})`; x.lineWidth = Math.max(0.7, r * 1.1);
        x.beginPath(); x.moveTo(X, Y); x.lineTo(X - Math.cos(an) * L, Y - Math.sin(an) * L); x.stroke();
      } else {
        x.fillStyle = `rgba(${p.c},${a})`;
        if (r < 0.9) x.fillRect(X, Y, r * 1.6, r * 1.6); else { x.beginPath(); x.arc(X, Y, r, 0, 6.283); x.fill(); }
      }
    }
    // метеоры — в координатах окна, пролетают через всё
    x.lineCap = 'round';
    for (const m of st.meteors) {
      const a = (t - m.t0) / m.life, hx = m.x + m.vx * a * m.life / 1000, hy = m.y + m.vy * a * m.life / 1000, len = 0.16;
      const g = x.createLinearGradient(hx, hy, hx - m.vx * len, hy - m.vy * len), al = Math.sin(a * Math.PI);
      g.addColorStop(0, `rgba(230,240,255,${0.9 * al})`); g.addColorStop(1, 'rgba(160,190,255,0)');
      x.strokeStyle = g; x.lineWidth = 1.4; x.beginPath(); x.moveTo(hx, hy); x.lineTo(hx - m.vx * len, hy - m.vy * len); x.stroke();
    }
    // кометы: медленно пересекают всё окно, теряют искры и будят звёзды Атласа, мимо которых пролетают
    if (!still && t > SK.nextComet) { spawnComet(); SK.nextComet = t + 16000 + Math.random() * 20000; }
    for (const c of SK.comets) {
      if (!c.dead) {
        const cs = Math.cos(c.curve * dt), sn = Math.sin(c.curve * dt), vx = c.vx * cs - c.vy * sn; c.vy = c.vx * sn + c.vy * cs; c.vx = vx;
        c.x += c.vx * dt; c.y += c.vy * dt; c.trail.unshift({ x: c.x, y: c.y }); if (c.trail.length > 90) c.trail.pop();
        if (Math.random() < 0.75) SK.dust.push({ x: c.x, y: c.y, vx: -c.vx * 0.06 + (Math.random() - 0.5) * 26, vy: -c.vy * 0.06 + (Math.random() - 0.5) * 26, t0: t, life: 1300 + Math.random() * 1600, r: 0.5 + Math.random() * 1.1, c: c.c });
        if (c.x < -160 || c.y < -160 || c.x > W + 160 || c.y > H + 160) c.dead = t > c.t0 + 1500;
        for (const id in st.scr) { if (c.hit.has(id)) continue; const q = st.scr[id]; if (Math.hypot(q.x + SK.ox - c.x, q.y + SK.oy - c.y) < 46) { c.hit.add(id); vis(id).ign = t; } }
      } else c.trail.pop();
      const tr = c.trail; if (tr.length < 2) continue;
      for (let i = 1; i < tr.length; i++) {
        const f = 1 - i / tr.length; x.strokeStyle = `rgba(${c.c[0]},${c.c[1]},${c.c[2]},${0.42 * f * f})`; x.lineWidth = 0.6 + 3.6 * f * f;
        x.beginPath(); x.moveTo(tr[i - 1].x, tr[i - 1].y); x.lineTo(tr[i].x, tr[i].y); x.stroke();
      }
      if (!c.dead) {
        const sp = sprite('cmt' + c.c.join(), c.c[0], c.c[1], c.c[2]), hs = (46 + Math.sin(t / 180) * 4) * Math.sqrt(czl(z));
        x.globalAlpha = 0.9; x.drawImage(sp, c.x - hs / 2, c.y - hs / 2, hs, hs); x.globalAlpha = 1;
        x.fillStyle = 'rgba(255,255,255,.95)'; x.beginPath(); x.arc(c.x, c.y, 1.8, 0, 6.283); x.fill();
      }
    }
    SK.comets = SK.comets.filter((c) => !(c.dead && c.trail.length < 2));
    SK.dust = SK.dust.filter((d) => t - d.t0 < d.life); if (SK.dust.length > 500) SK.dust.splice(0, SK.dust.length - 500);
    for (const d of SK.dust) {
      const k = (t - d.t0) / d.life; d.x += d.vx * dt; d.y += d.vy * dt; d.vx *= 1 - dt * 0.6; d.vy *= 1 - dt * 0.6;
      x.fillStyle = `rgba(${d.c[0]},${d.c[1]},${d.c[2]},${(1 - k) * (0.5 + 0.5 * Math.sin(t / 90 + d.t0)) * 0.8})`;
      x.fillRect(d.x, d.y, d.r * 1.5, d.r * 1.5);
    }
    x.globalCompositeOperation = 'source-over';
  }

  function draw() {
    const x = st.ctx, W = st.W, H = st.H, t = st.t, c = db(), z = cam.z;
    x.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
    x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
    x.clearRect(0, 0, W, H);
    const intro = calm() ? 1 : ease((t - st.intro) / 2200);
    drawSky(intro);
    x.globalCompositeOperation = 'lighter';
    // экранные позиции пользовательских звёзд
    const ps = isPlaying() ? playingStar() : '', srcStar = playingStar();
    st.scr = {};
    for (const s of c.stars) {
      const p = wpos(s), n = tracks(s).length, v = vis(s.id), X = sx(p.x), Y = sy(p.y);
      warp(X, Y);
      const base = (2.6 + Math.log2(1 + n) * 1.05) * Math.sqrt(z);
      const bornA = (t - v.born) / 1000, bs = (bornA < 1.4 ? backOut(clamp((bornA - 0.45) / 0.8, 0, 1)) : 1) * (calm() ? 1 : backOut(clamp((t - st.intro - 250 - v.ph * 90) / 700, 0, 1)));
      const pulseA = calm() ? 0 : v.pulse * (ps ? 1 : 0.15) * (Math.pow(st.beatS, 0.85) * 0.8 + 0.18 * (0.5 + 0.5 * Math.sin(t / 1000 * 4.4 + v.ph)));
      st.scr[s.id] = { x: WX, y: WY, rx: X, ry: Y, r: base * (1 + v.hov * 0.35) * bs * (1 + pulseA), base, bs, v, n, pulse: pulseA };
    }
    // созвездия: туманность, контур, линии
    for (const g of c.groups) {
      const pts = g.members.map((m) => st.scr[m]).filter(Boolean); if (pts.length < 2) continue;
      const hue = hueOf(g), a = st.gn[g.id] || 0, playingHere = ps && g.members.includes(ps);
      const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length, cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      const rad = Math.max(...pts.map((p) => Math.hypot(p.x - cx, p.y - cy))) + 90 * Math.sqrt(z);
      const ng = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
      const na = (0.05 + a * 0.07 + (playingHere ? 0.05 + st.beatS * 0.05 : 0)) * intro;
      ng.addColorStop(0, `hsla(${hue},80%,55%,${na})`); ng.addColorStop(1, `hsla(${hue},80%,40%,0)`);
      x.fillStyle = ng; x.beginPath(); x.arc(cx, cy, rad, 0, 6.283); x.fill();
      if (a > 0.02 && pts.length >= 3) {
        const h = M.hull(pts).map((p) => { const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy) || 1; return { x: p.x + (dx / d) * 30, y: p.y + (dy / d) * 30 }; });
        x.save(); x.setLineDash([3, 7]); x.lineDashOffset = -t / 40; x.strokeStyle = `hsla(${hue},90%,80%,${0.22 * a})`; x.lineWidth = 1; x.lineJoin = 'round';
        x.beginPath(); h.forEach((p, i) => (i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y))); x.closePath(); x.stroke(); x.restore();
      }
      g.edges.forEach(([ea, eb], i) => {
        const A = st.scr[ea], B = st.scr[eb]; if (!A || !B) return;
        const ek = M.key(ea, eb), et = st.edgeT[ek], prog = et ? ease((t - et) / 700) : 1;
        const sh = st.shake[ek] && t - st.shake[ek] < 600 ? (t - st.shake[ek]) / 600 : 0;
        const bornA = Math.min(A.bs, B.bs);
        line(x, A, B, prog * bornA, hue, a, playingHere, sh, i);
      });
    }
    // распадающиеся линии и прочие эффекты
    for (const f of st.fx) {
      const a = (t - f.t0) / (f.life || 1400);
      if (f.type === 'edgeOut') { const A = st.scr[f.a], B = st.scr[f.b]; if (!A || !B) continue; x.strokeStyle = `hsla(${f.hue},90%,75%,${0.6 * (1 - a)})`; x.lineWidth = 1.2; x.setLineDash([2, 6 + a * 30]); x.beginPath(); x.moveTo(A.x, A.y); x.lineTo(B.x, B.y); x.stroke(); x.setLineDash([]); }
      if (f.type === 'burst') for (const q of f.parts) { const d = ease(a) * q.d, al = 1 - a; warp(sx(f.x) + Math.cos(q.a) * d * z, sy(f.y) + Math.sin(q.a) * d * z); x.fillStyle = `rgba(${f.rgb},${al})`; x.beginPath(); x.arc(WX, WY, q.r * (1 - a * 0.6), 0, 6.283); x.fill(); }
    }
    // предпросмотр создания созвездия
    if (st.mode === 'create') {
      x.save(); x.setLineDash([5, 6]); x.lineDashOffset = -t / 30; x.lineWidth = 1.3;
      for (let i = 1; i < st.pick.length; i++) {
        const A = st.scr[st.pick[i - 1]], B = st.scr[st.pick[i]]; if (!A || !B) continue; const pr = ease((t - (st.pickT[st.pick[i]] || 0)) / 450);
        x.strokeStyle = 'rgba(190,225,255,.75)'; x.beginPath(); x.moveTo(A.x, A.y); x.lineTo(A.x + (B.x - A.x) * pr, A.y + (B.y - A.y) * pr); x.stroke();
      }
      const L = st.scr[st.pick[st.pick.length - 1]];
      if (L && st.mouse.in) { x.strokeStyle = 'rgba(190,225,255,.3)'; x.beginPath(); x.moveTo(L.x, L.y); x.lineTo(st.mouse.x, st.mouse.y); x.stroke(); }
      x.restore();
    }
    if (st.mode === 'edit' && st.link && st.scr[st.link] && st.mouse.in) {
      const L = st.scr[st.link]; x.save(); x.setLineDash([4, 6]); x.lineDashOffset = -t / 25; x.strokeStyle = `hsla(${hueOf(group(st.edit))},95%,80%,.6)`; x.beginPath(); x.moveTo(L.x, L.y); x.lineTo(st.mouse.x, st.mouse.y); x.stroke(); x.restore();
    }
    // видимые гребни волн
    for (const w of st.waves) {
      const age = (t - w.t0) / 1000; if (age < 0) continue; const r = age * w.speed, al = Math.pow(1 - age / w.dur, 2) * (w.A / 16);
      for (const [dr, aa] of [[0, 0.16], [-55, 0.07], [-120, 0.04]]) { if (r + dr <= 0) continue; x.strokeStyle = `rgba(170,210,255,${aa * al})`; x.lineWidth = 2; x.beginPath(); x.arc(w.ox, w.oy, r + dr, 0, 6.283); x.stroke(); }
    }
    // звёзды
    for (const s of c.stars) drawStar(x, s, st.scr[s.id], s.id === srcStar, ps);
    // кольца бита
    for (const r of st.rings) {
      const p = st.scr[r.id]; if (!p) continue; const a = (t - r.t0) / 1500, red = vis(r.id).heat;
      const col = mix(BLUE, RED, red);
      x.strokeStyle = `rgba(${col},${(1 - a) * 0.55 * r.s})`; x.lineWidth = 1.6 * (1 - a) + 0.3; x.beginPath(); x.arc(p.x, p.y, p.r + ease(a) * 70 * r.s * Math.sqrt(z), 0, 6.283); x.stroke();
    }
    // подписи созвездий
    x.globalCompositeOperation = 'source-over';
    for (const g of c.groups) {
      const a = st.gn[g.id] || 0; if (a < 0.02) continue;
      const pts = g.members.map((m) => st.scr[m]).filter(Boolean); if (!pts.length) continue;
      const top = Math.min(...pts.map((p) => p.y)) - 44, cx = (Math.min(...pts.map((p) => p.x)) + Math.max(...pts.map((p) => p.x))) / 2, hue = hueOf(g);
      x.save(); x.textAlign = 'center'; x.textBaseline = 'middle';
      const lsp = 5 + (1 - a) * 16; x.font = "600 15px 'Segoe UI', system-ui, sans-serif"; if ('letterSpacing' in x) x.letterSpacing = lsp + 'px';
      x.shadowColor = `hsla(${hue},100%,60%,${0.8 * a})`; x.shadowBlur = 18; x.fillStyle = `hsla(${hue},100%,88%,${a})`;
      x.fillText(String(g.name).toUpperCase(), cx + lsp / 2, top - (1 - a) * 8); x.shadowBlur = 0;
      const wl = (x.measureText(String(g.name).toUpperCase()).width / 2 + 18) * ease(a);
      x.strokeStyle = `hsla(${hue},90%,80%,${0.45 * a})`; x.lineWidth = 1; x.beginPath(); x.moveTo(cx - wl, top + 14); x.lineTo(cx + wl, top + 14); x.stroke();
      for (const sgn of [-1, 1]) { x.save(); x.translate(cx + sgn * wl, top + 14); x.rotate(Math.PI / 4); x.fillStyle = `hsla(${hue},90%,85%,${a})`; x.fillRect(-2.2, -2.2, 4.4, 4.4); x.restore(); }
      if ('letterSpacing' in x) x.letterSpacing = '1px'; x.font = "11px 'Segoe UI', system-ui, sans-serif"; x.fillStyle = `hsla(${hue},40%,85%,${0.6 * a})`;
      x.fillText(`${cntStars(g.members.length)} · ${cnt(groupTracks(g))}`, cx, top + 28); x.restore();
    }
    // подписи звёзд: на наведении, при большом приближении и в режимах редактора
    const zoomA = clamp((z - 1.45) / 0.5, 0, 1), modeA = st.mode ? 0.85 : 0;
    x.save(); x.textAlign = 'center'; x.font = "500 12px 'Segoe UI', system-ui, sans-serif";
    for (const s of c.stars) {
      const p = st.scr[s.id]; const a = Math.max(zoomA * 0.7, modeA, p.v.hov) * p.bs; if (a < 0.03) continue;
      x.fillStyle = `rgba(225,236,255,${a * 0.9})`; x.fillText(name(s), p.x, p.y + p.r + 16 + (1 - a) * 6);
    }
    x.restore();
    if (st.mode === 'edit') drawHandles(x);
    // наползающая виньетка и первое проявление
    const vg = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)'); x.fillStyle = vg; x.fillRect(0, 0, W, H);
    placeTip(); placeUi(); placeMini(); syncMini();
  }

  function line(x, A, B, prog, hue, a, playingHere, shake, i) {
    const t = st.t, dx = B.rx - A.rx, dy = B.ry - A.ry, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    const g0 = A.r + 5, g1 = Math.max(g0, (L - B.r - 5)), N = st.waves.length ? 16 : 1, end = g0 + (g1 - g0) * prog;
    if (end <= g0) return;
    const pts = [];
    for (let k = 0; k <= N; k++) {
      const d = g0 + ((end - g0) * k) / N, wob = shake ? Math.sin(k * 2.2 + t / 30) * 4 * (1 - shake) : 0;
      warp(A.rx + ux * d - uy * wob, A.ry + uy * d + ux * wob); pts.push([WX, WY]);
    }
    const path = () => { x.beginPath(); pts.forEach((p, k) => (k ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); };
    const col = shake ? `255,110,120` : null, base = 0.3 + a * 0.5 + (playingHere ? 0.15 : 0);
    path(); x.lineCap = 'round'; x.strokeStyle = col ? `rgba(${col},${0.25 * (1 - shake)})` : `hsla(${hue},90%,70%,${0.07 + a * 0.1})`; x.lineWidth = 6; x.stroke();
    path(); x.strokeStyle = col ? `rgba(${col},${0.9 * (1 - shake) + 0.2})` : `hsla(${hue},85%,82%,${base})`; x.lineWidth = 1.1 + a * 0.5; x.stroke();
    // бегущие огоньки: по звучащему созвездию течёт энергия, по наведённому — искра
    if (!calm() && prog >= 1 && (playingHere || a > 0.3)) {
      const n = playingHere ? 2 : 1;
      for (let j = 0; j < n; j++) {
        const u = ((t / (playingHere ? 1700 : 2600) + i * 0.37 + j / n) % 1), q = pts[Math.min(pts.length - 1, Math.floor(u * (pts.length - 1)))], qx = N > 1 ? q[0] : pts[0][0] + (pts[1][0] - pts[0][0]) * u, qy = N > 1 ? q[1] : pts[0][1] + (pts[1][1] - pts[0][1]) * u;
        const sz = (playingHere ? 10 + st.beatS * 10 : 8) * Math.sin(u * Math.PI);
        x.globalAlpha = 0.9 * Math.sin(u * Math.PI); x.drawImage(sprite('h' + hue, ...hslRgb(hue)), qx - sz, qy - sz, sz * 2, sz * 2); x.globalAlpha = 1;
      }
    }
  }
  function hslRgb(h) { const s = 0.85, l = 0.72, k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return [f(0), f(8), f(4)].map((v) => Math.round(v * 255)); }

  function drawStar(x, s, p, isSrc, ps) {
    if (!p) return;
    const t = st.t, v = p.v, r = p.r, born = (t - v.born) / 1000;
    // рождение: частицы стягиваются в точку, вспышка, расходящееся кольцо
    if (born >= 0 && born < 1.6 && !calm()) {
      if (born < 0.5) for (let i = 0; i < 26; i++) { const a = i * 2.4 + v.ph, d = (1 - ease(born / 0.5)) * (60 + (i % 5) * 16), al = ease(born / 0.5); x.fillStyle = `rgba(200,225,255,${al * 0.8})`; x.beginPath(); x.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 1.3, 0, 6.283); x.fill(); }
      if (born > 0.45) { const a = (born - 0.45) / 1.15; x.strokeStyle = `rgba(200,228,255,${(1 - a) * 0.7})`; x.lineWidth = 2 * (1 - a) + 0.4; x.beginPath(); x.arc(p.x, p.y, 4 + ease(a) * 90, 0, 6.283); x.stroke();
        x.globalAlpha = Math.max(0, 1 - a * 1.6); x.drawImage(sprite('w', 235, 245, 255), p.x - 60, p.y - 60, 120, 120); x.globalAlpha = 1; }
    }
    if (p.bs <= 0.001) return;
    const heat = v.heat, col = mix(BLUE, RED, heat), tw = calm() ? 1 : 0.85 + 0.15 * Math.sin(t / 1000 * (1.2 + v.ph * 0.2) + v.ph);
    const ign = (t - v.ign) / 1000, flare = ign >= 0 && ign < 1 ? Math.sin(ign * Math.PI) * 0.8 : 0;
    const halo = r * (5.5 + v.hov * 2 + p.pulse * 6 + flare * 4) * tw;
    if (heat < 0.99) { x.globalAlpha = (0.85 + v.hov * 0.15) * (1 - heat); x.drawImage(sprite('b', ...BLUE), p.x - halo, p.y - halo, halo * 2, halo * 2); }
    if (heat > 0.01) { x.globalAlpha = heat; x.drawImage(sprite('r', ...RED), p.x - halo * 1.15, p.y - halo * 1.15, halo * 2.3, halo * 2.3); }
    x.globalAlpha = 1;
    // лучи-дифракция — медленно вращаются, вытягиваются на наведении и на бите
    const rl = r * (3.2 + v.hov * 3 + p.pulse * 5 + flare * 4) * tw, rot = v.ph + t / 9000;
    x.save(); x.translate(p.x, p.y); x.rotate(rot);
    for (let k = 0; k < 4; k++) {
      x.rotate(Math.PI / 2); const L = k % 2 ? rl : rl * 0.7, g = x.createLinearGradient(0, 0, L, 0);
      g.addColorStop(0, `rgba(${col},${0.55 + v.hov * 0.3})`); g.addColorStop(1, `rgba(${col},0)`); x.fillStyle = g;
      x.beginPath(); x.moveTo(0, -0.8); x.lineTo(L, 0); x.lineTo(0, 0.8); x.fill();
    }
    x.restore();
    // ядро
    const core = mix([235, 244, 255], [255, 205, 210], heat);
    x.fillStyle = `rgb(${core})`; x.beginPath(); x.arc(p.x, p.y, r, 0, 6.283); x.fill();
    x.fillStyle = `rgba(${col},.55)`; x.beginPath(); x.arc(p.x, p.y, r * 1.6, 0, 6.283); x.globalAlpha = 0.35; x.fill(); x.globalAlpha = 1;
    // звезда-песня: вокруг неё кружит маленький спутник
    if (p.n === 1) {
      const or = r * 3 + 6, oa = t / 1300 + v.ph;
      x.strokeStyle = `rgba(${col},${0.18 + v.hov * 0.25})`; x.lineWidth = 0.8; x.beginPath(); x.ellipse(p.x, p.y, or, or * 0.42, -0.4, 0, 6.283); x.stroke();
      const ox = Math.cos(oa) * or, oy = Math.sin(oa) * or * 0.42, c = Math.cos(-0.4), sn = Math.sin(-0.4);
      x.fillStyle = `rgba(${col},.95)`; x.beginPath(); x.arc(p.x + ox * c - oy * sn, p.y + ox * sn + oy * c, 1.6, 0, 6.283); x.fill();
    }
    // орбита наведения / выбора
    const sel = Math.max(v.hov * 0.8, v.pick, st.link === s.id ? 1 : 0);
    if (sel > 0.02) {
      x.save(); x.translate(p.x, p.y); x.rotate(t / 1800); x.setLineDash([2, 5]); x.strokeStyle = v.pick > 0.02 || st.link === s.id ? `rgba(200,235,255,${sel})` : `rgba(${col},${sel * 0.7})`;
      x.lineWidth = 1.2; x.beginPath(); x.arc(0, 0, r * 2.4 + 8 + (1 - sel) * 10, 0, 6.283); x.stroke(); x.restore();
    }
    if (st.mode === 'create' && v.pick > 0.02) {
      const i = st.pick.indexOf(s.id); if (i >= 0) { x.save(); x.globalAlpha = v.pick; x.fillStyle = 'rgba(14,22,40,.9)'; x.strokeStyle = 'rgba(190,225,255,.8)'; x.beginPath(); x.arc(p.x + r * 2.4 + 10, p.y - r * 2.4 - 8, 9, 0, 6.283); x.fill(); x.stroke();
        x.fillStyle = '#e6f3ff'; x.font = "700 10px 'Segoe UI', sans-serif"; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(i + 1), p.x + r * 2.4 + 10, p.y - r * 2.4 - 8); x.restore(); }
    }
    const sk = st.shake['s:' + s.id]; if (sk && st.t - sk < 600) { const a = (st.t - sk) / 600; x.strokeStyle = `rgba(255,110,120,${1 - a})`; x.lineWidth = 2; x.beginPath(); x.arc(p.x + Math.sin(a * 40) * 4 * (1 - a), p.y, r * 2.6 + 6, 0, 6.283); x.stroke(); }
  }

  // ---------- редактор созвездия: ручки на холсте ----------
  function handles() {
    const g = group(st.edit); if (!g) return null;
    const pts = g.members.map((m) => st.scr[m]).filter(Boolean); if (!pts.length) return null;
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length, cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const R = Math.max(...pts.map((p) => Math.hypot(p.x - cx, p.y - cy))) + 46, ka = (st.knob ?? -Math.PI / 2);
    return { g, cx, cy, R, kx: cx + Math.cos(ka) * R, ky: cy + Math.sin(ka) * R, ka };
  }
  function drawHandles(x) {
    const h = handles(); if (!h) return; const hue = hueOf(h.g), t = st.t, hot = st.handleHover;
    const born = ease((t - (st.editT || 0)) / 600);
    x.save(); x.strokeStyle = `hsla(${hue},90%,80%,${(hot === 'scale' ? 0.55 : 0.28) * born})`; x.lineWidth = hot === 'scale' ? 2 : 1; x.setLineDash([6, 8]); x.lineDashOffset = t / 60;
    x.beginPath(); x.arc(h.cx, h.cy, h.R * born, 0, 6.283); x.stroke(); x.setLineDash([]);
    // деления шкалы поворота
    for (let i = 0; i < 24; i++) { const a = (i / 24) * 6.283 + (st.knob ?? 0), r1 = h.R * born + 4, r2 = r1 + (i % 6 ? 4 : 9); x.strokeStyle = `hsla(${hue},90%,80%,${0.25 * born})`; x.beginPath(); x.moveTo(h.cx + Math.cos(a) * r1, h.cy + Math.sin(a) * r1); x.lineTo(h.cx + Math.cos(a) * r2, h.cy + Math.sin(a) * r2); x.stroke(); }
    // ручка поворота
    const kr = (hot === 'rot' ? 10 : 8) * born; x.fillStyle = `hsla(${hue},95%,75%,.25)`; x.beginPath(); x.arc(h.kx, h.ky, kr + 6 + Math.sin(t / 300) * 1.5, 0, 6.283); x.fill();
    x.fillStyle = `hsl(${hue},95%,82%)`; x.beginPath(); x.arc(h.kx, h.ky, kr, 0, 6.283); x.fill();
    x.strokeStyle = 'rgba(10,14,30,.8)'; x.lineWidth = 1.6; x.beginPath(); x.arc(h.kx, h.ky, kr * 0.5, -2.4, 1.2); x.stroke();
    // ручка перемещения в центре
    const mr = (hot === 'move' ? 15 : 12) * born; x.strokeStyle = `hsla(${hue},95%,85%,${hot === 'move' ? 0.95 : 0.6})`; x.lineWidth = 1.4;
    x.beginPath(); x.arc(h.cx, h.cy, mr, 0, 6.283); x.stroke();
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + t / 2400; x.beginPath(); x.moveTo(h.cx + Math.cos(a) * mr * 0.35, h.cy + Math.sin(a) * mr * 0.35); x.lineTo(h.cx + Math.cos(a) * mr * 0.85, h.cy + Math.sin(a) * mr * 0.85); x.stroke(); }
    x.restore();
  }
  function hitHandle(mx, my) {
    if (st.mode !== 'edit') return '';
    const h = handles(); if (!h) return '';
    if (Math.hypot(mx - h.kx, my - h.ky) < 16) return 'rot';
    if (Math.hypot(mx - h.cx, my - h.cy) < 17) return 'move';
    if (Math.abs(Math.hypot(mx - h.cx, my - h.cy) - h.R) < 8) return 'scale';
    return '';
  }

  // ---------- попадания ----------
  function hitStar(mx, my) {
    let best = '', bd = 1e9;
    for (const [id, p] of Object.entries(st.scr)) { const d = Math.hypot(mx - p.x, my - p.y), lim = Math.max(15, p.r * 2.6); if (d < lim && d < bd) { bd = d; best = id; } }
    return best;
  }
  function hitGroup(mx, my) {
    const q = { x: mx, y: my };
    for (const g of db().groups.slice().reverse()) {
      const pts = g.members.map((m) => st.scr[m]).filter(Boolean); if (pts.length < 2) continue;
      for (const [a, b] of g.edges) { const A = st.scr[a], B = st.scr[b]; if (A && B && M.segDist(q, A, B) < 13) return g.id; }
      if (pts.length >= 3) {
        const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length, cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
        const h = M.hull(pts).map((p) => { const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy) || 1; return { x: p.x + (dx / d) * 30, y: p.y + (dy / d) * 30 }; });
        if (M.inHull(q, h)) return g.id;
      }
    }
    return '';
  }

  // ---------- HTML-слой ----------
  function shell() {
    return `<section id="atlas" class="atl" data-mode="" aria-label="${E(T('Атлас — космос твоей музыки', 'Atlas — your music universe'))}">
      <canvas id="atlCanvas" class="atl-canvas" tabindex="0" aria-label="${E(T('Звёздное небо', 'Star map'))}"></canvas>
      <header class="atl-top">
        <div class="atl-brand"><span class="atl-glyph">${I('spark')}</span><div><b>${T('Атлас', 'Atlas')}</b><small id="atlStat"></small></div></div>
        <div class="atl-tools">
          <button class="atl-btn pri" data-atl="add">${I('plus')}<span>${T('Звезда', 'Star')}</span></button>
          <button class="atl-btn" data-atl="create">${I('link')}<span>${T('Созвездие', 'Constellation')}</span></button>
          <button class="atl-btn" data-atl="nav">${I('list')}<span>${T('Навигатор', 'Navigator')}</span></button>
        </div>
      </header>
      <div class="atl-empty" id="atlEmpty" hidden>
        <div class="atl-orbit"><i></i><i></i><i></i><b></b></div>
        <h2>${T('Космос пуст', 'Space is empty')}</h2>
        <p>${T('Добавь плейлист или подборку песен — она зажжётся первой звездой.', 'Add a playlist or a set of songs — it will light up as your first star.')}</p>
        <button class="atl-btn pri big" data-atl="add">${I('spark')}<span>${T('Зажечь первую звезду', 'Light the first star')}</span></button>
      </div>
      <div class="atl-tip" id="atlTip" role="tooltip"></div>
      <div class="atl-mini" id="atlMini" aria-live="polite"></div>
      <div class="atl-banner" id="atlBanner"></div>
      <aside class="atl-panel" id="atlPanel" aria-live="polite"></aside>
      <div class="atl-menu" id="atlMenu" role="menu"></div>
      <footer class="atl-foot">
        <div class="atl-hint" id="atlHint"></div>
        <div class="atl-zoom"><button class="atl-ib" data-atl="zout" title="${E(T('Отдалить', 'Zoom out'))}">${I('minus')}</button><span id="atlZoom">100%</span><button class="atl-ib" data-atl="zin" title="${E(T('Приблизить', 'Zoom in'))}">${I('plus')}</button><button class="atl-ib" data-atl="fit" title="${E(T('Показать всё (F)', 'Fit all (F)'))}">${I('fit')}</button></div>
      </footer>
    </section>`;
  }
  const $a = (id) => st.el && st.el.querySelector('#' + id);

  function setHint() {
    const h = $a('atlHint'); if (!h) return;
    const txt = st.mode === 'create' ? T('Кликай по звёздам по порядку — линии протянутся сами · Esc — отмена', 'Click stars in order — lines draw themselves · Esc to cancel')
      : st.mode === 'edit' ? T('Тяни звёзды — форма · центр — положение · ручка — поворот · кольцо — размер · две звезды подряд — связь', 'Drag stars — shape · centre — position · knob — rotation · ring — size · click two stars — link')
        : T('Колесо — масштаб · тяни пустоту — полёт · двойной клик — звезда здесь · ПКМ — меню', 'Wheel — zoom · drag space — fly · double-click — star here · right-click — menu');
    if (h.dataset.txt === txt) return; h.dataset.txt = txt;
    h.classList.remove('in'); void h.offsetWidth; h.textContent = txt; h.classList.add('in');
  }
  function setStat() {
    const c = db(), el = $a('atlStat'); if (!el) return;
    const txt = c.stars.length ? `${cntStars(c.stars.length)} · ${RU() ? `${c.groups.length} ${plural(c.groups.length, 'созвездие', 'созвездия', 'созвездий')}` : `${c.groups.length} constellation${c.groups.length === 1 ? '' : 's'}`}` : T('пустой космос', 'empty space');
    if (el.textContent !== txt) { el.classList.remove('tick'); void el.offsetWidth; el.textContent = txt; el.classList.add('tick'); }
    const em = $a('atlEmpty'); if (em) { const show = !c.stars.length && !st.panel; if (show && em.hidden) { em.hidden = false; em.classList.remove('out'); } else if (!show && !em.hidden && !em.classList.contains('out')) { em.classList.add('out'); setTimeout(() => { if (em.classList.contains('out')) em.hidden = true; }, 500); } }
    st.el.dataset.mode = st.mode; st.el.classList.toggle('has-stars', !!c.stars.length);
    st.el.querySelectorAll('[data-atl="create"]').forEach((b) => { b.disabled = c.stars.filter((s) => !groupOf(s.id)).length < 2 && st.mode !== 'create'; b.classList.toggle('on', st.mode === 'create'); });
    st.el.querySelectorAll('[data-atl="nav"]').forEach((b) => b.classList.toggle('on', st.panel === 'nav'));
    st.el.querySelectorAll('[data-atl="add"]').forEach((b) => b.classList.toggle('on', st.panel === 'add'));
  }
  function placeUi() { const z = $a('atlZoom'); if (z) { const v = Math.round(cam.z * 100) + '%'; if (z.textContent !== v) z.textContent = v; } }

  // подсказка при наведении: название листа + песни (или одна песня)
  function tipHtml(s) {
    const ts = tracks(s), g = groupOf(s.id), now = playingStar() === s.id;
    const chip = g ? `<span class="atl-chip" style="--h:${hueOf(g)}">${I('link')}${E(g.name)}</span>` : '';
    if (ts.length === 1) {
      const t = ts[0];
      return `<div class="atl-tip-song">${cover(t, 160, 'lg')}<div><small>${now ? T('сейчас играет', 'now playing') : T('звезда-песня', 'song star')}</small><b>${E(t.title)}</b><span>${E(t.author || '')}</span><em>${fmtD(t.dur)}</em>${chip}</div></div>`;
    }
    const shown = ts.slice(0, 6), more = ts.length - shown.length, dur = ts.reduce((a, t) => a + (t.dur || 0), 0);
    return `<div class="atl-tip-head"><b>${E(name(s))}</b><small>${ts.length ? cnt(ts.length) : T('пока пусто', 'empty for now')}${dur ? ' · ' + fmtD(dur) : ''}${now ? ' · ' + T('звучит', 'playing') : ''}</small>${chip}</div>
      <ol class="atl-tip-list">${shown.map((t, i) => `<li style="--i:${i}">${cover(t, 60)}<span><b>${E(t.title)}</b><small>${E(t.author || '')}</small></span></li>`).join('')}</ol>${more > 0 ? `<div class="atl-tip-more">${T('и ещё', 'and')} ${cnt(more)}</div>` : ''}`;
  }
  function updateTip() {
    const tip = $a('atlTip'); if (!tip) return;
    const id = !st.drag && !st.menu && st.hover && st.hover !== st.focus && st.mode !== 'edit' ? st.hover : '';
    if (id === st.tipFor) return; st.tipFor = id;
    if (!id) { tip.classList.remove('on'); return; }
    tip.innerHTML = tipHtml(star(id)); tip.classList.remove('on'); void tip.offsetWidth; tip.classList.add('on');
  }
  function placeTip() {
    const tip = $a('atlTip'); if (!tip || !st.tipFor) return; const p = st.scr[st.tipFor]; if (!p) return;
    const w = tip.offsetWidth, h = tip.offsetHeight; let x = p.x + p.r * 2.4 + 18, y = p.y - 24;
    if (x + w > st.W - 12) x = p.x - p.r * 2.4 - 18 - w; y = clamp(y, 64, st.H - h - 70);
    tip.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`; tip.dataset.side = x < p.x ? 'l' : 'r';
  }

  // ---------- панели ----------
  function openPanel(kind, arg, html) {
    const el = $a('atlPanel'); if (!el) return;
    const swap = !!st.panel && el.classList.contains('on');
    st.panel = kind; st.panelArg = arg; el.dataset.kind = kind;
    el.innerHTML = `<div class="atl-pin ${swap ? 'swap' : ''}">${html}</div>`;
    if (!swap) { el.classList.remove('on'); void el.offsetWidth; }
    el.classList.add('on'); setStat(); updateTip();
  }
  function closePanel() {
    const el = $a('atlPanel'); const was = st.panel; st.panel = ''; st.panelArg = null;
    if (el) { el.classList.remove('on'); setTimeout(() => { if (!st.panel && el) el.innerHTML = ''; }, 420); }
    if (was === 'edit' && st.mode === 'edit') exitEdit(true);
    setStat();
  }
  const head = (title, sub, extra = '') => `<header class="atl-ph"><div><small>${sub}</small><h2>${title}</h2></div>${extra}<button class="atl-ib x" data-atl="close" title="${E(T('Закрыть (Esc)', 'Close (Esc)'))}">${I('x')}</button></header>`;

  function starPanel(s) {
    const ts = tracks(s), g = groupOf(s.id), cur = curT(), now = playingStar() === s.id, dur = ts.reduce((a, t) => a + (t.dur || 0), 0);
    if (ts.length === 1) return songPanel(s);
    const chip = g ? `<button class="atl-chip" data-atl="group" data-g="${E(g.id)}" style="--h:${hueOf(g)}">${I('link')}${E(g.name)}</button>` : '';
    const rows = ts.map((t, i) => `<li class="atl-row ${now && cur && cur.id === t.id ? 'now' : ''}" style="--i:${Math.min(i, 24)}" data-atl="playAt" data-i="${i}" data-tid="${E(t.id)}">
      <span class="atl-n"><em>${i + 1}</em><span class="atl-eq"><i></i><i></i><i></i></span>${I('play', 'pl')}</span>${cover(t, 60)}<span class="atl-tt"><b>${E(t.title)}</b><small>${E(t.author || '')}</small></span>
      <span class="atl-d">${fmtD(t.dur)}</span>${s.kind === 'list' && ts.length > 1 ? `<button class="atl-ib sm" data-atl="dropTrack" data-i="${i}" title="${E(T('Убрать из звезды', 'Remove from star'))}">${I('x')}</button>` : ''}</li>`).join('');
    return head(E(name(s)), `${s.kind === 'playlist' || s.kind === 'remote' ? T('плейлист', 'playlist') : T('подборка', 'collection')} · ${cnt(ts.length)}${dur ? ' · ' + fmtD(dur) : ''}`) +
      `<div class="atl-hero">${mosaic(ts)}<div class="atl-acts">
        <button class="atl-btn pri" data-atl="playStar">${I('play')}<span>${T('Играть', 'Play')}</span></button>
        <button class="atl-btn" data-atl="shuffleStar">${I('shuffle')}<span>${T('Вперемешку', 'Shuffle')}</span></button>
        <button class="atl-ib" data-atl="rename" title="${E(T('Переименовать', 'Rename'))}">${I('edit')}</button>
        ${s.kind === 'remote' ? `<button class="atl-ib" data-atl="reload" title="${E(T('Обновить песни', 'Refresh songs'))}">${I('refresh')}</button>` : ''}
        <button class="atl-ib danger" data-atl="delStar" title="${E(T('Погасить звезду', 'Remove star'))}">${I('trash')}</button></div>${chip}</div>
      ${ts.length ? `<ol class="atl-rows">${rows}</ol>` : `<div class="atl-void">${T('В этом плейлисте пока нет песен', 'No songs in this playlist yet')}</div>`}`;
  }
  function mosaic(ts) {
    const a = ts.slice(0, 4);
    return `<div class="atl-mosaic n${Math.min(4, a.length) || 1}">${a.length ? a.map((t) => cover(t, 200)).join('') : cover(null)}<span class="atl-gleam"></span></div>`;
  }
  // «страница музыки» — звезда с одной песней открывает сразу её
  function songPanel(s) {
    const t = tracks(s)[0], g = groupOf(s.id), cur = curT(), now = playingStar() === s.id && cur && cur.id === t.id;
    return `<button class="atl-ib x float" data-atl="close" title="${E(T('Закрыть (Esc)', 'Close (Esc)'))}">${I('x')}</button>
      <div class="atl-song ${now ? 'now' : ''}">
        <div class="atl-disc"><span class="atl-aura"></span>${cover(t, 600, 'xl')}</div>
        <small class="atl-k">${now ? T('сейчас играет', 'now playing') : T('звезда-песня', 'song star')}</small>
        <h2>${E(t.title)}</h2><p>${E(t.author || '')}${t.album?.name || typeof t.album === 'string' ? ' · ' + E(t.album.name || t.album) : ''}</p>
        <div class="atl-meta"><span>${I('disc')}${fmtD(t.dur)}</span>${s.name && s.name !== t.title ? `<span>${I('star')}${E(name(s))}</span>` : ''}</div>
        ${g ? `<button class="atl-chip" data-atl="group" data-g="${E(g.id)}" style="--h:${hueOf(g)}">${I('link')}${E(g.name)}</button>` : ''}
        <div class="atl-acts c">
          <button class="atl-btn pri big" data-atl="playStar">${I('play')}<span>${now ? T('Сначала', 'Restart') : T('Играть', 'Play')}</span></button>
          <button class="atl-btn" data-atl="openPlayer">${I('open')}<span>${T('Экран плеера', 'Player')}</span></button>
        </div>
        <div class="atl-acts c"><button class="atl-ib" data-atl="songMenu" title="${E(T('Действия с песней', 'Song actions'))}">${I('list')}</button><button class="atl-ib" data-atl="rename" title="${E(T('Переименовать звезду', 'Rename star'))}">${I('edit')}</button><button class="atl-ib danger" data-atl="delStar" title="${E(T('Погасить звезду', 'Remove star'))}">${I('trash')}</button></div>
      </div>`;
  }
  const curT = () => { const q = lib.queue; return q && q.tracks && q.tracks[q.idx]; };

  function groupPanel(g) {
    const hue = hueOf(g);
    const items = g.members.map((id, i) => { const s = star(id); if (!s) return ''; const ts = tracks(s); return `<li class="atl-row" style="--i:${i}" data-atl="focus" data-s="${E(id)}"><span class="atl-dot ${playingStar() === id ? 'hot' : ''}"></span>${cover(ts[0], 60)}<span class="atl-tt"><b>${E(name(s))}</b><small>${ts.length === 1 ? E(ts[0].author || T('песня', 'song')) : cnt(ts.length)}</small></span></li>`; }).join('');
    return `<div class="atl-gh" style="--h:${hue}">` + head(E(g.name), `${T('созвездие', 'constellation')} · ${cntStars(g.members.length)} · ${cnt(groupTracks(g))}`) + `</div>
      <div class="atl-acts pad"><button class="atl-btn pri" data-atl="playGroup" data-g="${E(g.id)}">${I('play')}<span>${T('Играть созвездие', 'Play constellation')}</span></button><button class="atl-btn" data-atl="edit" data-g="${E(g.id)}">${I('wand')}<span>${T('Настроить', 'Shape')}</span></button></div>
      <ol class="atl-rows">${items}</ol>`;
  }

  function navPanel() {
    const c = db(), free = c.stars.filter((s) => !groupOf(s.id));
    const gs = c.groups.map((g, i) => `<li class="atl-row" style="--i:${i};--h:${hueOf(g)}" data-atl="group" data-g="${E(g.id)}"><span class="atl-gdot"></span><span class="atl-tt"><b>${E(g.name)}</b><small>${cntStars(g.members.length)} · ${cnt(groupTracks(g))}</small></span><button class="atl-ib sm" data-atl="edit" data-g="${E(g.id)}" title="${E(T('Настроить', 'Shape'))}">${I('wand')}</button></li>`).join('');
    const fs = free.map((s, i) => { const ts = tracks(s); return `<li class="atl-row" style="--i:${c.groups.length + i}" data-atl="focus" data-s="${E(s.id)}"><span class="atl-dot ${playingStar() === s.id ? 'hot' : ''}"></span>${cover(ts[0], 60)}<span class="atl-tt"><b>${E(name(s))}</b><small>${ts.length === 1 ? E(ts[0].author || '') : cnt(ts.length)}</small></span></li>`; }).join('');
    return head(T('Навигатор', 'Navigator'), T('всё твоё небо', 'your whole sky')) +
      `<div class="atl-acts pad"><button class="atl-btn" data-atl="fit">${I('fit')}<span>${T('Обзор всего', 'See everything')}</span></button></div>
      ${gs ? `<h3>${T('Созвездия', 'Constellations')}</h3><ol class="atl-rows">${gs}</ol>` : ''}
      ${fs ? `<h3>${T('Одиночные звёзды', 'Lone stars')}</h3><ol class="atl-rows">${fs}</ol>` : ''}
      ${!gs && !fs ? `<div class="atl-void">${T('Здесь появятся твои звёзды и созвездия', 'Your stars and constellations will appear here')}</div>` : ''}`;
  }

  // добавление звезды: плейлист или своя подборка песен
  const addSt = { tab: 'pl', q: '', sel: [], nm: '', mode: 'one' };
  function addPanel() {
    const c = db(), tab = addSt.tab;
    let body = '';
    if (tab === 'pl') {
      const pls = playlists();
      body = seg() + (pls.length ? `<ol class="atl-rows">${pls.map((p, i) => { const on = c.stars.find((s) => s.source === p.id); return `<li class="atl-row ${on ? 'has' : ''}" style="--i:${Math.min(i, 24)}" data-atl="${on && addSt.mode === 'one' ? 'focus' : 'addPl'}" data-pl="${E(p.id)}" ${on ? `data-s="${E(on.id)}"` : ''}>
        ${cover(p.tracks?.[0], 60)}<span class="atl-tt"><b>${E(p.name)}</b><small>${p.type === 'remote' ? E(p.sub || T('из аккаунта', 'from your account')) : cnt((p.tracks || []).length)}</small></span>
        <span class="atl-tag">${on ? I('star') + T('на небе', 'in sky') : I('plus')}</span><span class="atl-spin"></span></li>`; }).join('')}</ol>`
        : `<div class="atl-void">${T('Плейлистов пока нет — собери свою подборку на вкладке «Песни»', 'No playlists yet — build your own set on the Songs tab')}</div>`);
    } else {
      const q = addSt.q.trim().toLowerCase(), all = pool(), list = (q ? all.filter((t) => (t.title + ' ' + (t.author || '')).toLowerCase().includes(q)) : all).slice(0, 120);
      body = seg() + `<label class="atl-search">${I('search')}<input id="atlQ" value="${E(addSt.q)}" placeholder="${E(T('Найти среди своих песен', 'Search your songs'))}" autocomplete="off"></label>
        <ol class="atl-rows pick" id="atlPool">${poolRows(list)}</ol>
        <div class="atl-dock ${addSt.sel.length ? 'on' : ''}"><input id="atlNm" value="${E(addSt.nm)}" placeholder="${E(T('Название звезды', 'Star name'))}" maxlength="60"><button class="atl-btn pri" data-atl="addSel">${I('spark')}<span>${T('Зажечь', 'Ignite')} <b id="atlSelN">${addSt.sel.length}</b></span></button></div>`;
    }
    return head(T('Новая звезда', 'New star'), st.placeAt ? T('зажжётся там, где ты кликнул', 'will appear where you clicked') : T('плейлист или своя подборка', 'a playlist or your own set')) +
      `<div class="atl-tabs" data-tab="${tab}"><button data-atl="tab" data-tab="pl" class="${tab === 'pl' ? 'on' : ''}">${I('list')}${T('Плейлисты', 'Playlists')}</button><button data-atl="tab" data-tab="songs" class="${tab === 'songs' ? 'on' : ''}">${I('music')}${T('Песни', 'Songs')}</button><i></i></div>${body}`;
  }
  const poolRows = (list) => (list.length ? list.map((t, i) => `<li class="atl-row ${addSt.sel.includes(t.id) ? 'sel' : ''}" style="--i:${Math.min(i, 24)}" data-atl="toggleSel" data-tid="${E(t.id)}"><span class="atl-check">${I('check')}</span>${cover(t, 60)}<span class="atl-tt"><b>${E(t.title)}</b><small>${E(t.author || '')}</small></span><span class="atl-d">${fmtD(t.dur)}</span></li>`).join('')
    : `<div class="atl-void">${T('Ничего не нашлось. Лайкни песни или добавь локальные — они появятся здесь.', 'Nothing found. Like songs or add local files and they will appear here.')}</div>`);

  // редактор созвездия
  function editPanel(g) {
    const hue = hueOf(g);
    const edges = g.edges.map(([a, b], i) => { const br = M.isBridge(g, a, b); return `<li class="atl-edge ${br ? 'lock' : ''}" style="--i:${i}" data-ea="${E(a)}" data-eb="${E(b)}"><span>${E(name(star(a)))}</span><i></i><span>${E(name(star(b)))}</span>
      <button class="atl-ib sm" data-atl="cut" data-ea="${E(a)}" data-eb="${E(b)}" ${br ? 'aria-disabled="true"' : ''} title="${E(br ? T('Мост: без этой линии созвездие распадётся', 'Bridge: removing it would split the constellation') : T('Убрать связь', 'Remove link'))}">${I('x')}</button></li>`; }).join('');
    const mem = g.members.map((id, i) => {
      const s = star(id); if (!s) return '';
      const can = M.removeMember({ members: [...g.members], edges: g.edges.map((e) => [...e]) }, id);
      return `<li class="atl-row ${st.link === id ? 'sel' : ''}" style="--i:${i}" data-atl="pickLink" data-s="${E(id)}"><span class="atl-dot ${playingStar() === id ? 'hot' : ''}"></span>${cover(tracks(s)[0], 60)}<span class="atl-tt"><b>${E(name(s))}</b><small>${cnt(tracks(s).length)}</small></span>
        <button class="atl-ib sm" data-atl="dropMember" data-s="${E(id)}" ${can ? '' : 'aria-disabled="true"'} title="${E(can ? T('Убрать из созвездия', 'Remove from constellation') : T('Эта звезда держит созвездие вместе', 'This star holds the constellation together'))}">${I('x')}</button></li>`;
    }).join('');
    const sw = M.HUES.map((h, i) => `<button class="atl-sw ${h === hue ? 'on' : ''}" style="--h:${h};--i:${i}" data-atl="hue" data-h="${h}" aria-label="${h}"></button>`).join('');
    return `<div class="atl-gh" style="--h:${hue}">` + head(T('Настройка созвездия', 'Shape constellation'), E(g.name)) + `</div>
      <div class="atl-form">
        <label class="atl-field"><span>${T('Название', 'Name')}</span><input id="atlGName" value="${E(g.name)}" maxlength="40" autocomplete="off"></label>
        <div class="atl-field"><span>${T('Цвет линий и туманности', 'Colour')}</span><div class="atl-sws">${sw}</div></div>
        <label class="atl-field"><span>${T('Поворот', 'Rotate')} <em id="atlRotV">0°</em></span><input type="range" class="atl-range" id="atlRot" min="-180" max="180" step="1" value="0"></label>
        <label class="atl-field"><span>${T('Размер', 'Size')} <em id="atlScV">100%</em></span><input type="range" class="atl-range" id="atlSc" min="40" max="250" step="1" value="100"></label>
        <div class="atl-acts"><button class="atl-btn" data-atl="tidy">${I('wand')}<span>${T('Аккуратные связи', 'Tidy links')}</span></button><button class="atl-btn" data-atl="undo" ${st.undo.length ? '' : 'disabled'}>${I('undo')}<span>${T('Отменить', 'Undo')}</span></button></div>
      </div>
      <h3>${T('Связи', 'Links')}<small>${T('кликни две звезды на небе — соединить или разъединить', 'click two stars in the sky to link or unlink')}</small></h3>
      <ol class="atl-edges">${edges}</ol>
      <h3>${T('Звёзды', 'Stars')}<small>${T('кликни одиночную звезду на небе — она присоединится', 'click a lone star in the sky to add it')}</small></h3>
      <ol class="atl-rows">${mem}</ol>
      <div class="atl-acts pad end"><button class="atl-btn danger" data-atl="dissolve">${I('trash')}<span>${T('Распустить', 'Dissolve')}</span></button><button class="atl-btn pri" data-atl="done">${I('check')}<span>${T('Готово', 'Done')}</span></button></div>`;
  }

  function panelHtml(kind, arg) {
    if (kind === 'star') { const s = star(arg); return s ? starPanel(s) : null; }
    if (kind === 'group') { const g = group(arg); return g ? groupPanel(g) : null; }
    if (kind === 'edit') { const g = group(arg); return g ? editPanel(g) : null; }
    if (kind === 'nav') return navPanel();
    if (kind === 'add') return addPanel();
    return null;
  }
  function show(kind, arg) { const h = panelHtml(kind, arg); if (h != null) openPanel(kind, arg, h); }
  // перерисовка без анимации входа (смена данных внутри открытой панели)
  function repaint() {
    const el = $a('atlPanel'); if (!el || !st.panel) return;
    const html = panelHtml(st.panel, st.panelArg); if (html == null) return closeAny();
    const pin = el.querySelector('.atl-pin'), sc = pin ? pin.scrollTop : 0, fid = document.activeElement?.id, val = document.activeElement?.value;
    el.innerHTML = `<div class="atl-pin still">${html}</div>`; el.querySelector('.atl-pin').scrollTop = sc;
    if (fid && el.querySelector('#' + fid)) { const f = el.querySelector('#' + fid); f.focus(); if (val != null && 'value' in f) { f.value = val; try { f.setSelectionRange(val.length, val.length); } catch {} } }
  }

  function banner() {
    const b = $a('atlBanner'); if (!b) return;
    if (st.mode !== 'create') { b.classList.remove('on'); return; }
    if (!b.classList.contains('on')) {
      b.innerHTML = `<span class="atl-bn-ic">${I('link')}</span><div class="atl-bn-tx"><b>${T('Новое созвездие', 'New constellation')}</b><small id="atlPickN"></small></div>
        <input id="atlCName" placeholder="${E(T('Название, например HARD METAL', 'Name, e.g. HARD METAL'))}" maxlength="40" autocomplete="off">
        <button class="atl-btn" data-atl="cancelCreate"><span>${T('Отмена', 'Cancel')}</span></button><button class="atl-btn pri" data-atl="makeGroup" id="atlMake">${I('check')}<span>${T('Создать', 'Create')}</span></button>`;
      b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
    }
    const n = st.pick.length, pn = b.querySelector('#atlPickN');
    pn.textContent = n ? (n < 2 ? T('ещё хотя бы одну звезду', 'pick at least one more star') : `${T('выбрано', 'selected')}: ${cntStars(n)}`) : T('кликай по одиночным звёздам по порядку', 'click lone stars in order');
    pn.classList.remove('tick'); void pn.offsetWidth; pn.classList.add('tick');
    b.querySelector('#atlMake').disabled = n < 2;
  }

  function menu(items, mx, my) {
    const m = $a('atlMenu'); if (!m) return; st.menu = true; st._items = items;
    m.innerHTML = items.map((it, i) => (it === '-' ? '<hr>' : `<button role="menuitem" style="--i:${i}" class="${it.danger ? 'danger' : ''}" data-mi="${i}">${I(it.icon)}<span>${E(it.label)}</span></button>`)).join('');
    m.classList.remove('on'); m.style.transform = 'translate(-9999px,0)'; void m.offsetWidth;
    const x = clamp(mx, 8, st.W - m.offsetWidth - 8), y = clamp(my, 8, st.H - m.offsetHeight - 8);
    m.style.transform = `translate(${x}px,${y}px)`; m.style.transformOrigin = `${mx - x}px ${my - y}px`; m.classList.add('on'); updateTip();
  }
  function closeMenu() { const m = $a('atlMenu'); if (m) m.classList.remove('on'); st.menu = false; updateTip(); }
  function starMenu(s, mx, my) {
    const g = groupOf(s.id);
    menu([{ icon: 'open', label: T('Открыть', 'Open'), run: () => focusStar(s.id) }, { icon: 'play', label: T('Играть', 'Play'), run: () => play(s) }, { icon: 'shuffle', label: T('Вперемешку', 'Shuffle'), run: () => shuffleStar(s) }, '-',
      { icon: 'edit', label: T('Переименовать', 'Rename'), run: () => { focusStar(s.id); setTimeout(rename, 80); } },
      g ? { icon: 'wand', label: T('Настроить созвездие', 'Shape constellation'), run: () => enterEdit(g.id) } : { icon: 'link', label: T('Начать созвездие с неё', 'Start a constellation here'), run: () => { enterCreate(); togglePick(s.id); } }, '-',
      { icon: 'trash', label: T('Погасить звезду', 'Remove star'), danger: true, run: () => delStar(s.id) }], mx, my);
  }
  function groupMenu(g, mx, my) {
    menu([{ icon: 'play', label: T('Играть созвездие', 'Play constellation'), run: () => playGroup(g) }, { icon: 'list', label: T('Открыть', 'Open'), run: () => openGroup(g.id) },
      { icon: 'wand', label: T('Настроить форму и связи', 'Shape and links'), run: () => enterEdit(g.id) }, '-', { icon: 'trash', label: T('Распустить', 'Dissolve'), danger: true, run: () => dissolve(g) }], mx, my);
  }
  function spaceMenu(w, mx, my) {
    const free = db().stars.filter((s) => !groupOf(s.id)).length;
    menu([{ icon: 'spark', label: T('Зажечь звезду здесь', 'Light a star here'), run: () => { st.placeAt = w; show('add'); } },
      ...(free >= 2 ? [{ icon: 'link', label: T('Создать созвездие', 'Create constellation'), run: enterCreate }] : []),
      { icon: 'fit', label: T('Обзор всего неба', 'See the whole sky'), run: fitAll }], mx, my);
  }

  // ---------- изменения неба ----------
  function burst(wx, wy, rgb, n = 30) { if (calm()) return; const parts = []; for (let i = 0; i < n; i++) parts.push({ a: Math.random() * 6.283, d: 30 + Math.random() * 110, r: 0.8 + Math.random() * 1.8 }); st.fx.push({ type: 'burst', x: wx, y: wy, rgb, parts, t0: st.t, life: 1100 }); }
  const shakeStar = (id) => { st.shake['s:' + id] = st.t; };
  function spawnAt() {
    const c = db();
    if (st.placeAt) { const p = st.placeAt; st.placeAt = null; return M.freeSpot(c.stars, p, 70); }
    const off = st.panel ? panelW() / 2 / camT.z : 0;
    return M.freeSpot(c.stars, { x: camT.x - off + (Math.random() - 0.5) * 220 / camT.z, y: camT.y + (Math.random() - 0.5) * 160 / camT.z }, 120);
  }
  function createStar(data, at, quiet) {
    const c = db(), p = at || spawnAt();
    const s = { id: uid(), kind: data.kind, source: data.source || null, name: String(data.name || '').slice(0, 80), tracks: (data.tracks || []).filter((t) => t && t.id).slice(0, 500).map((t) => slim(t)), x: Math.round(p.x), y: Math.round(p.y), born: Date.now() };
    c.stars.push(s); save();
    const v = vis(s.id); v.dx = s.x; v.dy = s.y;
    if (st.el && st.raf) { v.born = st.t; if (!quiet) wave(s.x, s.y, 9, 480); } else st.pendingBirth.add(s.id);
    setStat(); return s;
  }
  function delStar(id) {
    const c = db(), s = star(id); if (!s) return;
    const g = groupOf(id);
    if (g) {
      if (!M.removeMember({ members: [...g.members], edges: g.edges.map((e) => [...e]) }, id)) { shakeStar(id); return toast(T('Эта звезда держит созвездие вместе — сначала соедини её соседей между собой', 'This star holds the constellation together — link its neighbours first')); }
      M.removeMember(g, id); if (g.members.length < 2) dissolve(g, true);
    }
    const p = wpos(s); burst(p.x, p.y, '170,205,255', 40); wave(p.x, p.y, 6);
    if (st.focus === id) unfocus(true);
    c.stars.splice(c.stars.indexOf(s), 1); delete st.vis[id]; save();
    if (st.panel === 'star' && st.panelArg === id) closeAny(); else repaint();
    setStat(); st.hover = ''; updateTip();
  }
  function dissolve(g, quiet) {
    const c = db(); if (!c.groups.includes(g)) return;
    for (const [a, b] of g.edges) st.fx.push({ type: 'edgeOut', a, b, hue: hueOf(g), t0: st.t, life: 1000 });
    const ctr = M.center(c.stars, g.members); if (!quiet) { burst(ctr.x, ctr.y, '200,190,255', 24); wave(ctr.x, ctr.y, 6); }
    c.groups.splice(c.groups.indexOf(g), 1); delete st.off['g:' + g.id]; save();
    if (st.edit === g.id) { st.mode = ''; st.edit = ''; closePanel(); setHint(); }
    if (st.panel === 'group' && st.panelArg === g.id) closePanel();
    if (!quiet) toast(T(`Созвездие «${g.name}» распущено — звёзды остались на небе`, `“${g.name}” dissolved — its stars stay in the sky`));
    setStat(); repaint();
  }
  function rename() {
    const s = star(st.mini || st.panelArg); const h = st.mini ? $a('atlMini')?.querySelector('.am-t') : $a('atlPanel')?.querySelector('.atl-ph h2, .atl-song h2'); if (!s || !h) return;
    h.contentEditable = 'true'; h.classList.add('editing'); h.textContent = name(s); h.focus();
    const r = document.createRange(); r.selectNodeContents(h); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    const done = (ok) => { h.contentEditable = 'false'; h.classList.remove('editing'); const v = h.textContent.trim().slice(0, 80); if (ok && v) { s.alias = v; save(); } if (st.mini) refreshMini(); else repaint(); };
    h.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); h.onblur = null; done(true); } if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); h.onblur = null; done(false); } };
    h.onblur = () => done(true);
  }

  // ---------- камера и фокус ----------
  // Собственный детектор ударов для Атласа. Бит плеера считается по байтовому спектру, который упирается в потолок
  // (−30 дБ): на громких треках бас всё время = 255, перепада нет — и звёзды замирали. Здесь берём float-дБ без потолка
  // и сравниваем с скользящей нормой трека: удар = насколько сильнее обычного, а не насколько громко. От громкости не зависит.
  const OB = { buf: null, prev: null, slow: null, dev: 3, fl: 0, fdev: 1, lvl: 0 };
  function onset(dt) {
    let an = null; try { an = typeof analyser !== 'undefined' ? analyser : null; } catch {}
    if (!an || !isPlaying() || calm()) { OB.lvl *= Math.exp(-dt * 6); return OB.lvl; }
    const n = an.frequencyBinCount; if (!OB.buf || OB.buf.length !== n) { OB.buf = new Float32Array(n); OB.prev = new Float32Array(n).fill(-140); }
    try { an.getFloatFrequencyData(OB.buf); } catch { return OB.lvl; }
    const hz = an.context.sampleRate / an.fftSize, lo = Math.max(1, Math.floor(35 / hz)), hi = Math.min(n - 1, Math.ceil(160 / hz));
    let pw = 0, flux = 0, k = 0;
    for (let i = lo; i <= hi; i++) { const db = Math.max(-140, OB.buf[i]); if (!Number.isFinite(db)) continue; pw += Math.pow(10, db / 10); const d = db - OB.prev[i]; if (d > 0) flux += d; OB.prev[i] = db; k++; }
    if (!k) return OB.lvl;
    const L = 10 * Math.log10(pw / k + 1e-14); flux /= k;
    if (L < -95) { OB.lvl *= Math.exp(-dt * 6); return OB.lvl; } // тишина / пауза между треками
    if (OB.slow == null) { OB.slow = L; OB.fl = flux; }
    const ks = 1 - Math.exp(-dt / 1.4);
    const z = (L - OB.slow) / Math.max(1.2, OB.dev), zf = (flux - OB.fl) / Math.max(0.5, OB.fdev);
    OB.dev += (Math.abs(L - OB.slow) - OB.dev) * ks; OB.slow += (L - OB.slow) * ks;
    OB.fdev += (Math.abs(flux - OB.fl) - OB.fdev) * ks; OB.fl += (flux - OB.fl) * ks;
    const hit = clamp((Math.max(z, zf * 0.9) - 0.8) / 1.7, 0, 1);
    OB.lvl = hit > OB.lvl ? hit : OB.lvl * Math.exp(-dt * 7);
    return OB.lvl;
  }
  function zoomAt(mx, my, f) {
    if (st.fly) { st.fly = null; Object.assign(camT, cam); }
    const w = toWorld(mx, my, cam), nz = clamp(camT.z * f, ZMIN, ZMAX);
    camT.z = nz; camT.x = w.x - (mx - st.W / 2) / nz; camT.y = w.y - (my - st.H / 2) / nz; st.vel = { x: 0, y: 0 };
    st.zoomA = { mx, my, wx: w.x, wy: w.y };
  }
  function flight() {
    st.zoomA = null; st.vel = { x: 0, y: 0 };
    if (calm() || !st.raf) { st.fly = null; return; }
    const far = (Math.hypot(camT.x - cam.x, camT.y - cam.y) * Math.min(cam.z, camT.z)) / Math.max(st.W, st.H), dz = Math.abs(Math.log(camT.z / cam.z));
    st.fly = { from: { ...cam }, t0: st.t, dur: clamp(620 + far * 420 + dz * 260, 620, 1400) };
  }
  function fitIds(ids) {
    const ps = db().stars.filter((s) => ids.includes(s.id)); if (!ps.length) { Object.assign(camT, { x: 0, y: 0, z: 1 }); flight(); return; }
    const xs = ps.map((s) => s.x), ys = ps.map((s) => s.y), pw = panelW();
    const w = Math.max(...xs) - Math.min(...xs) || 1, h = Math.max(...ys) - Math.min(...ys) || 1;
    const z = clamp(Math.min((st.W - pw - 220) / w, (st.H - 260) / h), 0.35, 2.2);
    camT.z = z; camT.x = (Math.max(...xs) + Math.min(...xs)) / 2 + pw / 2 / z; camT.y = (Math.max(...ys) + Math.min(...ys)) / 2; st.vel = { x: 0, y: 0 }; flight();
  }
  function fitAll() { if (st.focus) { st.focus = ''; if (st.panel === 'star') closePanel(); } st.home = null; fitIds(db().stars.map((s) => s.id)); }
  function focusStar(id) {
    const s = star(id); if (!s) return;
    if (st.mode) { if (st.mode === 'create') exitCreate(); else exitEdit(); }
    if (!st.home) st.home = { ...camT };
    st.focus = id;
    const solo = tracks(s).length === 1;
    if (solo) { if (st.panel) closePanel(); openMini(id); } else { closeMini(); show('star', id); }
    const base = st.home ? st.home.z : camT.z, z = clamp(Math.max(base * 1.3, 1.9), 1, 2.6), p = wpos(s);
    const off = solo ? (st.W > 760 ? 200 : 0) : panelW() / 2;
    camT.z = z; camT.x = p.x + off / z; camT.y = p.y; flight();
    wave(p.x, p.y, 17); wave(p.x, p.y, 7, 240); vis(id).ign = st.t;
  }
  function unfocus(quiet) {
    const s = star(st.focus); st.focus = ''; closeMini();
    if (st.home) { Object.assign(camT, st.home); st.home = null; flight(); }
    if (s && !quiet) { const p = wpos(s); wave(p.x, p.y, 7); }
    if (st.panel === 'star') closePanel();
  }
  function openGroup(gid) {
    const g = group(gid); if (!g) return; if (st.mode) { if (st.mode === 'create') exitCreate(); else exitEdit(); }
    st.focus = ''; if (!st.home) st.home = { ...camT }; show('group', gid); fitIds(g.members);
    const c = M.center(db().stars, g.members); wave(c.x, c.y, 9);
  }
  function closeAny() {
    if (st.mode === 'edit') return exitEdit();
    if (st.focus) return unfocus();
    closePanel(); if (st.home) { Object.assign(camT, st.home); st.home = null; flight(); }
  }
  function flyTo(s) { if (!s) return; const z = Math.max(camT.z, 1); camT.z = z; camT.x = s.x + (st.panel ? panelW() / 2 / z : 0); camT.y = s.y; flight(); }

  // ---------- мини-виджет звезды-песни ----------
  const pop = (b) => { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); };
  function miniCur(s) { const t = s && tracks(s)[0], c = curT(); return !!(t && c && c.id === t.id); }
  function miniHtml(s) {
    const t = tracks(s)[0]; if (!t) return '';
    const tb = (k, ic, tt, cls = '') => `<button class="am-ib ${cls}" data-atl="${k}" title="${E(tt)}">${ic}</button>`;
    return `<div class="am-card"><span class="am-glow"></span><span class="am-sheen"></span>
      <div class="am-top" style="--i:0">${tb('openPlayer', I('expand'), T('Экран плеера', 'Player screen'))}${tb('rename', I('edit'), T('Переименовать звезду', 'Rename star'))}${tb('close', I('x'), T('Закрыть (Esc)', 'Close (Esc)'))}</div>
      <div class="am-row">
        <div class="am-art" style="--i:1">${cover(t, 300, 'am-cv')}<span class="am-eq"><i></i><i></i><i></i></span></div>
        <div class="am-main">
          <b class="am-t" style="--i:2" title="${E(name(s))}">${E(name(s))}</b><small class="am-a" style="--i:3">${E(t.author || '')}</small>
          <div class="am-ctl" style="--i:4">
            ${tb('mLike', I('heart'), T('Нравится', 'Like'), 'am-like')}${tb('mDis', I('dislike'), T('Не нравится', 'Dislike'), 'am-dis')}
            ${tb('mPrev', I('prev', 'fill'), T('Назад', 'Previous'))}
            <button class="am-play" data-atl="mPlay" title="${E(T('Играть / пауза', 'Play / pause'))}"><span class="am-ring"></span>${I('play', 'fill am-ip')}${I('pause', 'fill am-ipa')}</button>
            ${tb('mNext', I('next', 'fill'), T('Дальше', 'Next'))}${tb('mRep', I('repeat') + '<em>1</em>', T('Повтор', 'Repeat'), 'am-rep')}
            <span class="am-vol">${tb('mMute', I('vol', 'am-iv') + I('mute', 'am-im'), T('Звук', 'Volume'), 'am-mute')}<input type="range" class="am-vr" id="atlMVol" min="0" max="100" step="1" aria-label="${E(T('Громкость', 'Volume'))}"></span>
          </div>
        </div>
      </div>
      <div class="am-seek" style="--i:5"><em id="atlMCur">0:00</em><div class="am-bar" id="atlMBar"><span><i></i></span><b></b></div><em id="atlMDur">${fmtD(t.dur)}</em></div>
    </div>`;
  }
  function openMini(id) {
    const el = $a('atlMini'), s = star(id); if (!el || !s) return;
    st.mini = id; st.miniSig = ''; el.innerHTML = miniHtml(s);
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
    placeMini(true); syncMini(true);
  }
  function refreshMini() { const el = $a('atlMini'), s = star(st.mini); if (!el || !s) return; el.innerHTML = miniHtml(s); el.classList.add('still'); st.miniSig = ''; syncMini(true); setTimeout(() => el.classList.remove('still'), 50); }
  function closeMini() {
    if (!st.mini) return; st.mini = ''; const el = $a('atlMini'); if (!el) return;
    el.classList.remove('on'); setTimeout(() => { if (!st.mini) el.innerHTML = ''; }, 380);
  }
  function placeMini(snap) {
    if (!st.mini) return; if (st.focus !== st.mini || !star(st.mini)) return closeMini();
    const el = $a('atlMini'), p = st.scr[st.mini]; if (!el || !p) return;
    const w = el.offsetWidth || 390, h = el.offsetHeight || 150, gap = p.r * 2.2 + 30;
    let x = p.x + gap, side = 'r'; if (x + w > st.W - 14) { x = p.x - gap - w; side = 'l'; }
    const y = clamp(p.y - h / 2, 70, Math.max(70, st.H - h - 76));
    // виджет не дёргается за камерой, а мягко догоняет звезду (пружинка с затуханием)
    const now = performance.now(), flip = el.dataset.side !== side; let P = st.miniP;
    if (snap || flip || !P || now - P.t > 300 || calm()) P = st.miniP = { x, y, vx: 0, vy: 0, t: now };
    else {
      const dt = Math.min(0.05, (now - P.t) / 1000), K = 170, D = 2 * Math.sqrt(K) * 0.92;
      P.vx += ((x - P.x) * K - P.vx * D) * dt; P.vy += ((y - P.y) * K - P.vy * D) * dt;
      P.x += P.vx * dt; P.y += P.vy * dt; P.t = now;
      if (Math.abs(x - P.x) < 0.05 && Math.abs(P.vx) < 0.05) P.x = x; if (Math.abs(y - P.y) < 0.05 && Math.abs(P.vy) < 0.05) P.y = y;
    }
    el.style.transform = `translate3d(${P.x.toFixed(2)}px,${P.y.toFixed(2)}px,0)`;
    if (flip) el.dataset.side = side;
    el.style.setProperty('--ay', Math.round(clamp(p.y - P.y, 18, h - 18)) + 'px');
  }
  function syncMini(force) {
    const el = $a('atlMini'), s = star(st.mini); if (!el || !s || !el.firstElementChild) return;
    const t = tracks(s)[0], on = miniCur(s), pl = on && isPlaying(), c = on ? curT() : null;
    const d = (c && c.dur) || t.dur || 0, tm = on && typeof heard === 'function' ? heard() : 0, drag = on && st.seekF != null;
    const f = drag ? st.seekF : d ? clamp(tm / d, 0, 1) : 0;
    const bar = el.querySelector('.am-bar'); if (bar) bar.style.setProperty('--f', f.toFixed(4));
    const cs = fmtD(drag ? f * d : tm), liked = typeof isLiked === 'function' && isLiked(t.id), dis = !!(lib.dislikes && lib.dislikes[t.id]);
    const sig = [on, pl, liked, dis, lib.repeat, lib.volume, cs, d].join('|'); if (!force && sig === st.miniSig) return; st.miniSig = sig;
    el.classList.toggle('cur', on); el.classList.toggle('playing', pl);
    el.querySelector('.am-like')?.classList.toggle('on', liked); el.querySelector('.am-dis')?.classList.toggle('on', dis);
    const rp = el.querySelector('.am-rep'); if (rp) { rp.classList.toggle('on', lib.repeat && lib.repeat !== 'off'); rp.classList.toggle('one', lib.repeat === 'one'); }
    const v = +lib.volume || 0, vr = $a('atlMVol'); if (vr && document.activeElement !== vr) vr.value = v; if (vr) vr.style.setProperty('--v', v + '%');
    el.querySelector('.am-mute')?.classList.toggle('muted', v === 0);
    const a = $a('atlMCur'), b = $a('atlMDur'); if (a) a.textContent = cs; if (b) b.textContent = fmtD(d);
  }
  document.addEventListener('input', (e) => { if (e.target?.id === 'atlMVol' && typeof setVolume === 'function') { setVolume(+e.target.value); syncMini(true); } });
  document.addEventListener('pointerdown', (e) => {
    const bar = e.target.closest?.('#atlMBar'); if (!bar) return; const s = star(st.mini); if (!s) return;
    e.preventDefault(); e.stopPropagation(); if (!miniCur(s)) { play(s); return; }
    const r = bar.getBoundingClientRect(), at = (ev) => { st.seekF = clamp((ev.clientX - r.left) / r.width, 0, 1); syncMini(true); };
    const up = (ev) => { at(ev); if (typeof seekFrac === 'function') seekFrac(st.seekF); st.seekF = null; bar.classList.remove('drag'); removeEventListener('pointermove', at); removeEventListener('pointerup', up); };
    bar.classList.add('drag'); at(e); addEventListener('pointermove', at); addEventListener('pointerup', up);
  }, true);

  // ---------- отправка списка: одной звездой, звездой на песню или созвездием ----------
  const MAXSPLIT = 60;
  function seg() {
    const m = addSt.mode, hint = { one: T('Весь список станет одной звездой с песнями внутри', 'The whole list becomes one star with its songs inside'), each: T(`Каждая песня зажжётся своей звездой (до ${MAXSPLIT})`, `Every song lights its own star (up to ${MAXSPLIT})`), cons: T('Песни станут звёздами и сразу соединятся в созвездие', 'Songs become stars joined into a constellation') }[m];
    const o = [['one', 'star', T('Одной звездой', 'One star')], ['each', 'spark', T('По песням', 'Per song')], ['cons', 'link', T('Созвездием', 'Constellation')]];
    return `<div class="atl-seg" data-m="${m}">${o.map(([k, ic, l], i) => `<button data-atl="mode" data-m="${k}" class="${m === k ? 'on' : ''}" style="--i:${i}">${I(ic)}<span>${l}</span></button>`).join('')}<i></i></div><p class="atl-seg-hint" key="${m}">${hint}</p>`;
  }
  function send(data, mode) {
    const ts = (data.tracks || []).filter((t) => t && t.id);
    if (mode === 'one' || mode == null || ts.length < 2) {
      const d = ts.length === 1 && mode && mode !== 'one' ? { kind: 'list', name: ts[0].title, tracks: ts } : data;
      return [createStar(d).id];
    }
    const list = ts.slice(0, MAXSPLIT); if (ts.length > MAXSPLIT) toast(T(`Зажглись первые ${MAXSPLIT} песен — так небо не превратится в кашу`, `Lit the first ${MAXSPLIT} songs to keep the sky readable`));
    const c = db(), base = spawnAt(), ids = [], live = st.el && st.raf;
    list.forEach((t, i) => {
      const a = i * 2.39996 + hash(data.name || 'x') * 6.283, r = 78 * Math.sqrt(i + 0.7);
      const want = { x: base.x + Math.cos(a) * r * 1.2, y: base.y + Math.sin(a) * r * 0.8 };
      const s = createStar({ kind: 'list', name: t.title, tracks: [t] }, M.freeSpot(c.stars, want, 62), true);
      ids.push(s.id); if (live) vis(s.id).born = st.t + i * 65;
    });
    if (mode === 'cons') {
      const used = new Set(c.groups.map((g) => g.hue)), hue = M.HUES.find((h) => !used.has(h)) ?? M.HUES[c.groups.length % M.HUES.length];
      const g = { id: uid(), name: String(data.name || T('Созвездие', 'Constellation')).slice(0, 40), members: [...ids], edges: M.tree(c.stars, ids), hue };
      c.groups.push(g); g.edges.forEach((e, i) => (st.edgeT[M.key(e[0], e[1])] = st.t + 500 + list.length * 40 + i * 110));
      st.flashG = { id: g.id, until: st.t + 3200 + g.edges.length * 110 };
    }
    if (live) { wave(base.x, base.y, 12, 520); wave(base.x, base.y, 6, 260); }
    save(); setStat(); return ids;
  }
  function landOn(ids) { if (ids.length === 1) return flyTo(star(ids[0])); st.home = null; fitIds(ids); }

  // кнопка «В Атлас» на странице плейлиста или альбома
  function listDialog(L) {
    const ts = ((L && L.tracks) || []).filter((t) => t && t.id); if (!ts.length) return toast(T('В этом списке нет песен', 'This list has no songs'));
    const src = (L.src && L.src.id) || L.ytPl || null, nm = L.name || T('Плейлист', 'Playlist');
    st.dlgList = { name: nm, source: src, tracks: ts.map((t) => slim(t)) };
    const cap = Math.min(ts.length, MAXSPLIT), more = ts.length > MAXSPLIT ? ` · ${T('первые', 'first')} ${cap}` : '', on = src && db().stars.some((s) => s.source === src);
    const o = (i, k, ic, b, sm) => `<button class="atl-dlg-o" style="--i:${i}" data-atl-list-send="${k}">${I(ic)}<span><b>${b}</b><small>${sm}</small></span></button>`;
    modal(`<div class="atl-dlg"><h3>${I('spark')}${T('Отправить в космос', 'Send to space')}</h3><p>${E(nm)} · ${cnt(ts.length)}</p>
      ${o(0, 'one', 'star', T('Одной звездой', 'As one star'), on ? T('этот список уже горит на небе — появится ещё одна звезда', 'already in the sky — this adds another star') : T('весь список — одна звезда, песни внутри', 'the whole list as one star with its songs'))}
      ${o(1, 'each', 'spark', T('Каждая песня — своя звезда', 'A star for every song'), cntStars(cap) + more)}
      ${o(2, 'cons', 'link', T('Созвездие из песен', 'A constellation of songs'), `${cntStars(cap)} ${T('соединятся в', 'joined as')} «${E(nm)}»${more}`)}</div>`);
  }
  document.addEventListener('click', (e) => {
    const open = e.target.closest?.('[data-atl-list]');
    if (open) { e.preventDefault(); e.stopPropagation(); const L = typeof got === 'function' ? got(open.dataset.atlList) : null; return listDialog(L); }
    const b = e.target.closest?.('[data-atl-list-send]'); if (!b || !st.dlgList) return;
    const L = st.dlgList, p = L.source ? playlists().find((x) => x.id === L.source) : null;
    const kind = p ? (p.type === 'local' ? 'playlist' : p.type === 'likes' ? 'likes' : 'remote') : 'list';
    const ids = send({ kind, source: L.source, name: L.name, tracks: L.tracks }, b.dataset.atlListSend);
    st.dlgList = null; if (typeof closeModal === 'function') closeModal();
    toast(ids.length > 1 ? T(`Зажглось ${cntStars(ids.length)} в Атласе`, `${cntStars(ids.length)} lit up in Atlas`) : T('Звезда зажглась в Атласе', 'A star lit up in Atlas'));
    if (st.el && st.raf) landOn(ids); else { st.pendingFit = ids; if (typeof go === 'function') go({ r: 'atlas' }); }
  }, true);
  let decoQ = 0;
  function decoratePages() {
    const view = document.getElementById('view'); if (!view) return;
    view.querySelectorAll('.hb [data-play]:not([data-atl-x])').forEach((pb) => {
      pb.dataset.atlX = '1'; const L = typeof got === 'function' ? got(pb.dataset.play) : null;
      if (!L || !Array.isArray(L.tracks) || !L.tracks.length || pb.parentElement.querySelector('[data-atl-list]')) return;
      const b = document.createElement('button'); b.className = 'btn atl-send-btn'; b.dataset.atlList = pb.dataset.play; b.title = T('Отправить список в Атлас', 'Send this list to Atlas');
      b.innerHTML = `${typeof ico === 'function' ? ico('sparkle') : ''}<span data-i18n-skip="true">${T('В Атлас', 'To Atlas')}</span>`;
      (pb.parentElement.querySelector('[data-shuf]') || pb).after(b);
    });
  }
  try { new MutationObserver(() => { if (!decoQ) decoQ = requestAnimationFrame(() => { decoQ = 0; decoratePages(); }); }).observe(document.getElementById('view') || document.body, { childList: true, subtree: true }); } catch {}

  // ---------- создание созвездия ----------
  function enterCreate() {
    if (st.mode === 'edit') exitEdit(); if (st.focus) unfocus(true); closePanel();
    st.mode = 'create'; st.pick = []; banner(); setHint(); setStat();
  }
  function exitCreate() { st.mode = ''; st.pick = []; banner(); setHint(); setStat(); }
  function togglePick(id) {
    const g = groupOf(id);
    if (g) { shakeStar(id); return toast(T(`Эта звезда уже в созвездии «${g.name}»`, `This star already belongs to “${g.name}”`)); }
    const i = st.pick.indexOf(id);
    if (i >= 0) st.pick.splice(i, 1); else { st.pick.push(id); st.pickT[id] = st.t; vis(id).ign = st.t; }
    banner();
  }
  function makeGroup() {
    const b = $a('atlBanner');
    if (st.pick.length < 2) { b?.classList.remove('nope'); void b?.offsetWidth; b?.classList.add('nope'); return; }
    const c = db(), nm = ($a('atlCName')?.value || '').trim() || `${T('Созвездие', 'Constellation')} ${c.groups.length + 1}`;
    const used = new Set(c.groups.map((g) => g.hue)), hue = M.HUES.find((h) => !used.has(h)) ?? M.HUES[c.groups.length % M.HUES.length];
    const g = { id: uid(), name: nm.slice(0, 40), members: [...st.pick], edges: M.chain(st.pick), hue };
    c.groups.push(g); g.edges.forEach((e, i) => (st.edgeT[M.key(e[0], e[1])] = st.t + i * 180)); save();
    const ctr = M.center(c.stars, g.members); wave(ctr.x, ctr.y, 11, g.edges.length * 180);
    st.flashG = { id: g.id, until: st.t + 2600 + g.edges.length * 180 };
    exitCreate(); toast(T(`Родилось созвездие «${g.name}»`, `Constellation “${g.name}” is born`));
  }

  // ---------- редактор ----------
  function enterEdit(gid) {
    const g = group(gid); if (!g) return;
    if (st.mode === 'create') exitCreate(); st.focus = '';
    if (!st.home) st.home = { ...camT };
    st.mode = 'edit'; st.edit = gid; st.link = ''; st.undo = []; st.knob = -Math.PI / 2; st.editT = st.t;
    show('edit', gid); fitIds(g.members); setHint(); setStat();
  }
  function exitEdit(fromClose) {
    st.mode = ''; st.edit = ''; st.link = ''; st.undo = []; st.slide = null; setHint(); setStat();
    if (!fromClose) closePanel();
    if (st.home) { Object.assign(camT, st.home); st.home = null; flight(); }
  }
  function pushUndo() {
    const g = group(st.edit); if (!g) return;
    st.undo.push(JSON.stringify({ name: g.name, hue: g.hue, members: g.members, edges: g.edges, pos: db().stars.map((s) => [s.id, s.x, s.y]) }));
    if (st.undo.length > 50) st.undo.shift();
  }
  function undo() {
    const g = group(st.edit), raw = st.undo.pop(); if (!g || !raw) return;
    const u = JSON.parse(raw); Object.assign(g, { name: u.name, hue: u.hue, members: u.members, edges: u.edges });
    for (const [id, x, y] of u.pos) { const s = star(id); if (s) { s.x = x; s.y = y; } }
    save(); repaint();
  }
  function nearestMember(g, id) {
    const s = star(id); let best = g.members[0], bd = 1e18;
    for (const m of g.members) { const o = star(m); const d = (o.x - s.x) ** 2 + (o.y - s.y) ** 2; if (d < bd) { bd = d; best = m; } }
    return best;
  }
  // Если линия — «мост», её всё равно убираем, а две половинки сцепляем ближайшей другой парой звёзд,
  // чтобы у каждой звезды осталась хотя бы одна связь и созвездие не распалось.
  function rewire(g, a, b) {
    const same = (e) => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a), rest = g.edges.filter((e) => !same(e));
    const adj = {}; for (const m of g.members) adj[m] = []; for (const [p, q] of rest) { if (adj[p]) adj[p].push(q); if (adj[q]) adj[q].push(p); }
    const A = new Set([a]), qu = [a]; while (qu.length) { const n = qu.pop(); for (const o of adj[n] || []) if (!A.has(o)) { A.add(o); qu.push(o); } }
    const B = g.members.filter((m) => !A.has(m)); if (!B.length) { g.edges = rest; return []; }
    let best = null, bd = Infinity;
    for (const p of A) for (const q of B) {
      if (same([p, q])) continue; const s1 = star(p), s2 = star(q); if (!s1 || !s2) continue;
      const d = (s1.x - s2.x) ** 2 + (s1.y - s2.y) ** 2; if (d < bd) { bd = d; best = [p, q]; }
    }
    if (!best) return null; g.edges = [...rest, best]; return best;
  }
  function toggleLink(g, a, b) {
    pushUndo(); let r = M.toggleEdge(g, a, b), re = null; const k = M.key(a, b);
    if (r === 'blocked' && M.hasEdge(g, a, b)) { re = rewire(g, a, b); if (re) r = 'removed'; }
    if (r === 'added') st.edgeT[k] = st.t;
    else if (r === 'removed') {
      st.fx.push({ type: 'edgeOut', a, b, hue: hueOf(g), t0: st.t, life: 900 });
      if (re && re.length) { st.edgeT[M.key(re[0], re[1])] = st.t; vis(re[0]).ign = st.t; vis(re[1]).ign = st.t; toast(T('Линия убрана — части созвездия сцеплены ближайшей связью (Ctrl+Z — вернуть)', 'Link removed — the parts were rejoined by the nearest link (Ctrl+Z to undo)')); }
    }
    else { st.undo.pop(); st.shake[k] = st.t; shakeStar(a); shakeStar(b); toast(T('У этих двух звёзд это единственная связь — её нельзя убрать', 'This is the only link these stars have — it cannot be removed')); }
    if (r !== 'blocked') save(); return r;
  }
  function linkClick(id) {
    const g = group(st.edit); if (!g) return; const og = groupOf(id);
    if (og && og.id !== g.id) { shakeStar(id); return toast(T(`Эта звезда уже в «${og.name}»`, `This star belongs to “${og.name}”`)); }
    if (!og) { pushUndo(); const to = st.link && g.members.includes(st.link) ? st.link : nearestMember(g, id); M.addMember(g, id, to); st.edgeT[M.key(to, id)] = st.t; vis(id).ign = st.t; st.link = id; save(); return repaint(); }
    if (!st.link || st.link === id) { st.link = st.link === id ? '' : id; return repaint(); }
    const r = toggleLink(g, st.link, id); st.link = r === 'added' ? id : r === 'removed' ? '' : st.link; repaint();
  }
  function dropMember(id) {
    const g = group(st.edit); if (!g) return;
    if (!M.removeMember({ members: [...g.members], edges: g.edges.map((e) => [...e]) }, id)) { shakeStar(id); return toast(T('Эта звезда держит созвездие вместе — сначала соедини её соседей', 'This star holds the constellation together — link its neighbours first')); }
    pushUndo(); for (const e of g.edges.filter((e) => e.includes(id))) st.fx.push({ type: 'edgeOut', a: e[0], b: e[1], hue: hueOf(g), t0: st.t, life: 900 });
    M.removeMember(g, id); if (st.link === id) st.link = '';
    if (g.members.length < 2) return dissolve(g);
    save(); repaint();
  }
  function slider(kind, val, release) {
    const g = group(st.edit); if (!g) return; const c = db();
    if (!st.slide) { pushUndo(); st.slide = { pos: c.stars.filter((s) => g.members.includes(s.id)).map((s) => [s, s.x, s.y]), knob: st.knob ?? -Math.PI / 2 }; st.slide.c = M.center(c.stars, g.members); }
    for (const [s, x, y] of st.slide.pos) { s.x = x; s.y = y; }
    if (kind === 'rot') { M.rotate(c.stars, g.members, val, st.slide.c); st.knob = st.slide.knob + (val * Math.PI) / 180; }
    else M.scale(c.stars, g.members, val / 100, st.slide.c);
    if (release) { st.slide = null; save(); }
  }
  function tidy() {
    const g = group(st.edit); if (!g) return; pushUndo();
    const old = new Set(g.edges.map((e) => M.key(e[0], e[1]))); g.edges = M.tree(db().stars, g.members);
    g.edges.forEach((e, i) => { const k = M.key(e[0], e[1]); if (!old.has(k)) st.edgeT[k] = st.t + i * 90; old.delete(k); });
    for (const k of old) { const [a, b] = k.split('|'); st.fx.push({ type: 'edgeOut', a, b, hue: hueOf(g), t0: st.t, life: 900 }); }
    save(); repaint();
  }

  // ---------- добавление из панели ----------
  async function addPl(id, row) {
    const p = playlists().find((x) => x.id === id); if (!p) return;
    row?.classList.add('busy');
    try {
      const ts = await loadPlaylist(p);
      if (p.type === 'remote' && !ts.length) throw Error(T('В этом плейлисте нет песен', 'This playlist has no songs'));
      const ids = send({ kind: p.type === 'local' ? 'playlist' : p.type === 'likes' ? 'likes' : 'remote', source: p.id, name: p.name, tracks: ts }, addSt.mode);
      closePanel(); landOn(ids);
    } catch (err) { row?.classList.remove('busy'); row?.classList.add('fail'); toast(err.message || String(err)); }
  }
  function addSel() {
    const byId = new Map(pool().map((t) => [t.id, t])), ts = addSt.sel.map((id) => byId.get(id)).filter(Boolean);
    if (!ts.length) return;
    const nm = (addSt.nm || '').trim() || (ts.length === 1 ? ts[0].title : T('Моя подборка', 'My collection'));
    const ids = send({ kind: 'list', name: nm, tracks: ts }, addSt.mode); addSt.sel = []; addSt.nm = ''; closePanel(); landOn(ids);
  }
  // из контекстного меню песни в любом месте Pulse
  function trackDialog(t) {
    if (!t || !t.id) return; t = slim(t); st.dlgTrack = t;
    const c = db(), lists = c.stars.filter((s) => s.kind === 'list' && !tracks(s).some((x) => x.id === t.id));
    modal(`<div class="atl-dlg"><h3>${I('spark')}${T('В Атлас', 'To Atlas')}</h3><p>${E(t.title)}${t.author ? ' — ' + E(t.author) : ''}</p>
      <button class="atl-dlg-o" style="--i:0" data-atl-send="new">${I('star')}<span><b>${T('Новая звезда-песня', 'New song star')}</b><small>${T('одиночная звезда с этой песней', 'a lone star with this song')}</small></span></button>
      ${lists.map((s, i) => `<button class="atl-dlg-o" style="--i:${i + 1}" data-atl-send="into" data-s="${E(s.id)}">${I('plus')}<span><b>${T('Добавить в', 'Add to')} «${E(name(s))}»</b><small>${cnt(tracks(s).length)}</small></span></button>`).join('')}
      ${c.groups.map((g, i) => `<button class="atl-dlg-o" style="--i:${i + lists.length + 1};--h:${hueOf(g)}" data-atl-send="group" data-g="${E(g.id)}">${I('link')}<span><b>${T('Новая звезда в', 'New star in')} «${E(g.name)}»</b><small>${cntStars(g.members.length)}</small></span></button>`).join('')}</div>`);
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest?.('[data-atl-send]'); if (!b || !st.dlgTrack) return;
    const t = st.dlgTrack, k = b.dataset.atlSend; let s = null;
    if (k === 'new') s = createStar({ kind: 'list', name: t.title, tracks: [t] });
    else if (k === 'into') { s = star(b.dataset.s); if (s) { s.tracks = [...(s.tracks || []), t]; vis(s.id).ign = st.t; save(); } }
    else if (k === 'group') {
      const g = group(b.dataset.g);
      if (g) { const ctr = M.center(db().stars, g.members); s = createStar({ kind: 'list', name: t.title, tracks: [t] }, M.freeSpot(db().stars, { x: ctr.x + 90, y: ctr.y - 70 }, 90)); const near = nearestMember(g, s.id); M.addMember(g, s.id, near); st.edgeT[M.key(near, s.id)] = st.t + 900; save(); }
    }
    st.dlgTrack = null; closeModal();
    if (s) { toast(T('Звезда зажглась в Атласе', 'A star lit up in Atlas')); if (st.el) flyTo(s); setStat(); repaint(); }
  });

  // ---------- указатель ----------
  const local = (e) => { const r = st.cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  function onDown(e) {
    if (e.button !== 0) return; const { x, y } = local(e); closeMenu();
    try { st.cv.setPointerCapture(e.pointerId); } catch {}
    st.vel = { x: 0, y: 0 }; if (st.fly) { st.fly = null; Object.assign(camT, cam); } if (st.zoomA) { st.zoomA = null; Object.assign(camT, cam); }
    const hh = hitHandle(x, y), hs = hh ? '' : hitStar(x, y), hg = hh || hs || st.mode ? '' : hitGroup(x, y);
    st.down = { x, y, hh, hs, hg, moved: false, lx: x, ly: y, lt: performance.now() };
  }
  function beginDrag(d) {
    const c = db(), w = toWorld(d.x, d.y), g = group(st.edit);
    if (d.hh && g) {
      pushUndo(); const ctr = M.center(c.stars, g.members);
      st.drag = { kind: d.hh === 'move' ? 'gmove' : d.hh, ids: [...g.members], lw: w, c: ctr, a0: Math.atan2(w.y - ctr.y, w.x - ctr.x), r0: Math.hypot(w.x - ctr.x, w.y - ctr.y) || 1 };
    } else if (d.hs && st.mode !== 'create') {
      const og = groupOf(d.hs);
      if (st.mode === 'edit' && og && og.id !== st.edit) st.drag = { kind: 'pan' };
      else { if (st.mode === 'edit') pushUndo(); st.drag = { kind: 'star', ids: [d.hs], lw: w }; }
    } else if (d.hg) st.drag = { kind: 'gmove', ids: [...group(d.hg).members], lw: w };
    else st.drag = { kind: 'pan' };
    st.el.classList.add('dragging'); updateTip();
  }
  function dragTo(d, x, y) {
    const dr = st.drag, c = db(); if (!dr) return;
    if (dr.kind === 'pan') {
      const now = performance.now(), dt = Math.max(8, now - d.lt) / 1000, dx = (x - d.lx) / cam.z, dy = (y - d.ly) / cam.z;
      camT.x -= dx; camT.y -= dy; cam.x -= dx; cam.y -= dy;
      st.vel = { x: st.vel.x * 0.6 + (-dx / dt) * 0.4, y: st.vel.y * 0.6 + (-dy / dt) * 0.4 }; d.lx = x; d.ly = y; d.lt = now; return;
    }
    const w = toWorld(x, y);
    if (dr.kind === 'star' || dr.kind === 'gmove') { M.move(c.stars, dr.ids, w.x - dr.lw.x, w.y - dr.lw.y); dr.lw = w; }
    else if (dr.kind === 'rot') { const a = Math.atan2(w.y - dr.c.y, w.x - dr.c.x); M.rotate(c.stars, dr.ids, ((a - dr.a0) * 180) / Math.PI, dr.c); st.knob = (st.knob ?? -Math.PI / 2) + (a - dr.a0); dr.a0 = a; }
    else if (dr.kind === 'scale') { const r = Math.max(10, Math.hypot(w.x - dr.c.x, w.y - dr.c.y)); M.scale(c.stars, dr.ids, r / dr.r0, dr.c); dr.r0 = r; }
  }
  function onMove(e) {
    const { x, y } = local(e); st.mouse = { x, y, in: true }; const d = st.down;
    if (d) { if (!d.moved && Math.hypot(x - d.x, y - d.y) > 4) { d.moved = true; beginDrag(d); } if (d.moved) dragTo(d, x, y); return; }
    const hh = hitHandle(x, y); st.handleHover = hh;
    const hs = hh ? '' : hitStar(x, y), hg = hs ? groupOf(hs)?.id || '' : hh ? '' : hitGroup(x, y);
    if (hs !== st.hover) { st.hover = hs; updateTip(); }
    st.hoverG = hg;
    st.cv.style.cursor = hh === 'rot' || hh === 'scale' ? 'grab' : hh === 'move' ? 'move' : hs ? 'pointer' : hg ? 'grab' : st.mode === 'create' ? 'crosshair' : 'default';
  }
  function onUp(e) {
    const d = st.down; st.down = null; st.el.classList.remove('dragging');
    if (d && d.moved) { const k = st.drag?.kind; if (k === 'pan') { if (performance.now() - d.lt > 90) st.vel = { x: 0, y: 0 }; const sp = Math.hypot(st.vel.x, st.vel.y), mx = 2400 / cam.z; if (sp > mx) { st.vel.x *= mx / sp; st.vel.y *= mx / sp; } } st.drag = null; if (k && k !== 'pan') { save(); if (st.mode === 'edit') repaint(); } updateTip(); return; }
    st.drag = null; if (!d) return;
    if (d.hs) { if (st.mode === 'create') togglePick(d.hs); else if (st.mode === 'edit') linkClick(d.hs); else if (st.focus === d.hs) unfocus(); else focusStar(d.hs); return; }
    if (d.hh) return;
    if (d.hg) return openGroup(d.hg);
    if (st.mode === 'edit') { if (st.link) { st.link = ''; repaint(); } return; }
    if (st.mode === '' && (st.focus || st.panel)) closeAny();
  }
  function onDbl(e) {
    if (st.mode) return; const { x, y } = local(e); if (hitStar(x, y) || hitGroup(x, y)) return;
    st.placeAt = toWorld(x, y, camT); wave(st.placeAt.x, st.placeAt.y, 8); show('add');
  }
  function onCtx(e) {
    e.preventDefault(); const { x, y } = local(e); const r = st.el.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    const hs = hitStar(x, y); if (hs) return starMenu(star(hs), mx, my);
    const hg = hitGroup(x, y); if (hg) return groupMenu(group(hg), mx, my);
    spaceMenu(toWorld(x, y, camT), mx, my);
  }
  function onWheel(e) { e.preventDefault(); const { x, y } = local(e); zoomAt(x, y, Math.exp(-clamp(e.deltaY, -240, 240) * 0.0016)); }

  // ---------- кнопки панелей ----------
  function act(e) {
    const mi = e.target.closest('[data-mi]'); if (mi && st.menu) { const it = st._items[+mi.dataset.mi]; closeMenu(); it?.run?.(); return; }
    const b = e.target.closest('[data-atl]'); if (!b || !st.el.contains(b) || b.disabled) return;
    const k = b.dataset.atl, s = star(b.closest('#atlMini') ? st.mini : st.panelArg), g = group(b.dataset.g || st.edit);
    switch (k) {
      case 'add': if (st.mode) { if (st.mode === 'create') exitCreate(); else exitEdit(); } if (st.panel === 'add') return closeAny(); st.focus = ''; return show('add');
      case 'create': return st.mode === 'create' ? exitCreate() : enterCreate();
      case 'nav': if (st.panel === 'nav') return closeAny(); if (st.mode === 'edit') exitEdit(); st.focus = ''; return show('nav');
      case 'close': return closeAny();
      case 'mode': addSt.mode = b.dataset.m || 'one'; return repaint();
      case 'mPlay': if (!s) return; pop(b); if (miniCur(s)) { if (typeof toggle === 'function') toggle(); } else play(s); return syncMini(true);
      case 'mPrev': if (!s) return; pop(b); if (miniCur(s) && typeof prev === 'function') prev(); else play(s); return syncMini(true);
      case 'mNext': if (!s) return; pop(b); if (miniCur(s) && typeof next === 'function') next(); else play(s); return syncMini(true);
      case 'mLike': { const t = s && tracks(s)[0]; pop(b); if (t && typeof toggleLike === 'function') toggleLike(t); return syncMini(true); }
      case 'mDis': { const t = s && tracks(s)[0]; pop(b); if (t && typeof toggleDislike === 'function') toggleDislike(t); return syncMini(true); }
      case 'mRep': pop(b); if (typeof cycleRepeat === 'function') cycleRepeat(); return syncMini(true);
      case 'mMute': if (typeof setVolume !== 'function') return; pop(b); if (lib.volume > 0) { st.preMute = lib.volume; setVolume(0); } else setVolume(st.preMute || 60); return syncMini(true);
      case 'zin': return zoomAt(st.W / 2, st.H / 2, 1.35);
      case 'zout': return zoomAt(st.W / 2, st.H / 2, 1 / 1.35);
      case 'fit': return fitAll();
      case 'playStar': return s && play(s);
      case 'shuffleStar': return s && shuffleStar(s);
      case 'playAt': return s && play(s, +b.dataset.i);
      case 'openPlayer': if (s && playingStar() !== s.id) play(s); return setTimeout(() => typeof openPP === 'function' && openPP(), 60);
      case 'songMenu': { const t = tracks(s)[0], r = b.getBoundingClientRect(); return t && typeof trackMenu === 'function' && trackMenu(t, r.left, r.bottom + 4, {}); }
      case 'rename': return rename();
      case 'reload': if (!s) return; b.classList.add('spin'); return loadPlaylist({ id: s.source, type: 'remote' }).then((ts) => { s.tracks = ts.map((t) => slim(t)); save(); vis(s.id).ign = st.t; repaint(); toast(T('Песни обновлены', 'Songs refreshed')); }).catch((err) => { b.classList.remove('spin'); toast(err.message || String(err)); });
      case 'delStar': return s && delStar(s.id);
      case 'dropTrack': { e.stopPropagation(); if (!s || (s.tracks || []).length < 2) return; const row = b.closest('.atl-row'); row?.classList.add('leaving'); return setTimeout(() => { s.tracks.splice(+b.dataset.i, 1); save(); repaint(); }, 260); }
      case 'group': return b.dataset.g && openGroup(b.dataset.g);
      case 'playGroup': return g && playGroup(g);
      case 'edit': e.stopPropagation(); return g && enterEdit(g.id);
      case 'focus': { const id = b.dataset.s; const ss = star(id); if (!ss) return; if (st.panel === 'add' || st.panel === 'nav' || st.panel === 'group') { st.home = st.home || { ...camT }; } return focusStar(id); }
      case 'tab': addSt.tab = b.dataset.tab; return repaint();
      case 'addPl': return addPl(b.dataset.pl, b);
      case 'toggleSel': { const id = b.dataset.tid, i = addSt.sel.indexOf(id); if (i >= 0) addSt.sel.splice(i, 1); else addSt.sel.push(id); b.classList.toggle('sel', i < 0); const n = $a('atlSelN'); if (n) { n.textContent = addSt.sel.length; n.classList.remove('tick'); void n.offsetWidth; n.classList.add('tick'); } $a('atlPanel').querySelector('.atl-dock')?.classList.toggle('on', addSt.sel.length > 0); return; }
      case 'addSel': return addSel();
      case 'cut': { e.stopPropagation(); if (!g) return; toggleLink(g, b.dataset.ea, b.dataset.eb); return repaint(); }
      case 'pickLink': return linkClick(b.dataset.s);
      case 'dropMember': e.stopPropagation(); return dropMember(b.dataset.s);
      case 'hue': if (!g) return; pushUndo(); g.hue = +b.dataset.h; save(); return repaint();
      case 'tidy': return tidy();
      case 'undo': return undo();
      case 'dissolve': return g && dissolve(g);
      case 'done': return exitEdit();
      case 'cancelCreate': return exitCreate();
      case 'makeGroup': return makeGroup();
    }
  }
  function onInput(e) {
    const id = e.target.id, g = group(st.edit);
    if (id === 'atlQ') { addSt.q = e.target.value; const q = addSt.q.trim().toLowerCase(), all = pool(); const list = (q ? all.filter((t) => (t.title + ' ' + (t.author || '')).toLowerCase().includes(q)) : all).slice(0, 120); const p = $a('atlPool'); if (p) p.innerHTML = poolRows(list); }
    if (id === 'atlNm') addSt.nm = e.target.value;
    if (id === 'atlGName' && g) { g.name = e.target.value.slice(0, 40) || g.name; save(); const sub = $a('atlPanel')?.querySelector('.atl-ph small'); if (sub) sub.textContent = g.name; }
    if (id === 'atlRot') { slider('rot', +e.target.value, false); $a('atlRotV').textContent = e.target.value + '°'; }
    if (id === 'atlSc') { slider('sc', +e.target.value, false); $a('atlScV').textContent = e.target.value + '%'; }
  }
  function onChange(e) {
    const id = e.target.id;
    if (id === 'atlRot' || id === 'atlSc') {
      slider(id === 'atlRot' ? 'rot' : 'sc', +e.target.value, true);
      // ползунок пружиной возвращается в ноль: каждое движение — относительное
      const el = e.target, from = +el.value, to = id === 'atlRot' ? 0 : 100, t0 = performance.now();
      const tick = (now) => { const a = ease((now - t0) / 380); el.value = from + (to - from) * a; const lab = $a(id === 'atlRot' ? 'atlRotV' : 'atlScV'); if (lab) lab.textContent = Math.round(+el.value) + (id === 'atlRot' ? '°' : '%'); if (a < 1 && el.isConnected) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      const u = $a('atlPanel')?.querySelector('[data-atl="undo"]'); if (u) u.disabled = !st.undo.length;
    }
  }
  function onKeyInEl(e) {
    if (e.target.id === 'atlCName' && e.key === 'Enter') { e.preventDefault(); makeGroup(); }
    if (e.target.id === 'atlNm' && e.key === 'Enter') { e.preventDefault(); addSel(); }
    if (e.target.id === 'atlGName' && e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
  }
  function onRowCtx(e) {
    const row = e.target.closest('.atl-row[data-tid]'); if (!row || !st.el.contains(row) || typeof trackMenu !== 'function') return;
    const s = star(st.panelArg), t = (st.panel === 'star' ? tracks(s) : pool()).find((x) => x.id === row.dataset.tid); if (!t) return;
    e.preventDefault(); e.stopPropagation(); trackMenu(t, e.clientX, e.clientY, {});
  }
  // волна от нажатия на кнопку — у каждой кнопки свой маленький отклик
  function onPress(e) {
    const b = e.target.closest('.atl-btn,.atl-ib,.atl-row,.atl-chip,.atl-sw,.atl-tabs button'); if (!b) return;
    const r = b.getBoundingClientRect(); b.style.setProperty('--rx', e.clientX - r.left + 'px'); b.style.setProperty('--ry', e.clientY - r.top + 'px');
    b.classList.remove('rip'); void b.offsetWidth; b.classList.add('rip');
  }

  // ---------- жизненный цикл ----------
  function resize() {
    if (!st.el) return; const r = st.el.getBoundingClientRect();
    st.W = Math.max(1, r.width); st.H = Math.max(1, r.height); st.dpr = Math.min(2, window.devicePixelRatio || 1);
    st.cv.width = Math.round(st.W * st.dpr); st.cv.height = Math.round(st.H * st.dpr);
  }
  let everMounted = false;
  function mount() {
    const el = document.getElementById('atlas'); if (!el) return;
    if (st.el === el && st.raf) return;
    st.el = el; st.cv = el.querySelector('#atlCanvas'); st.ctx = st.cv.getContext('2d'); skyOn(true);
    if (!st.bg.length) seedBackground();
    st.intro = performance.now(); st.t = st.intro; st.last = 0;
    Object.assign(st, { panel: '', panelArg: null, mode: '', focus: '', hover: '', hoverG: '', tipFor: '', home: null, menu: false, link: '', edit: '', pick: [], waves: [], fx: [] });
    resize(); st.ro?.disconnect(); st.ro = new ResizeObserver(resize); st.ro.observe(el);
    if (!el.dataset.bound) {
      el.dataset.bound = '1';
      st.cv.addEventListener('pointerdown', onDown); st.cv.addEventListener('pointermove', onMove); st.cv.addEventListener('pointerup', onUp); st.cv.addEventListener('pointercancel', onUp);
      st.cv.addEventListener('pointerleave', () => { st.mouse.in = false; if (!st.down) { st.hover = ''; st.hoverG = ''; updateTip(); } });
      st.cv.addEventListener('dblclick', onDbl); st.cv.addEventListener('contextmenu', onCtx); st.cv.addEventListener('wheel', onWheel, { passive: false });
      el.addEventListener('click', act); el.addEventListener('input', onInput); el.addEventListener('change', onChange); el.addEventListener('keydown', onKeyInEl);
      el.addEventListener('contextmenu', onRowCtx); el.addEventListener('pointerdown', onPress, true);
    }
    for (const s of db().stars) { const v = vis(s.id); v.dx = s.x; v.dy = s.y; }
    for (const id of st.pendingBirth) vis(id).born = st.intro + 700; st.pendingBirth.clear();
    if (!everMounted) { everMounted = true; fitIds(db().stars.map((s) => s.id)); if (!db().stars.length) Object.assign(camT, { x: 0, y: 0, z: 1 }); }
    if (st.pendingFit) { const ids = st.pendingFit.filter((id) => star(id)); st.pendingFit = null; everMounted = true; st.home = null; if (st.panel) closePanel(); if (ids.length) fitIds(ids); }
    Object.assign(cam, { x: camT.x, y: camT.y, z: camT.z * (calm() ? 1 : 0.82) }); st.fly = null; st.zoomA = null;
    setHint(); setStat(); banner();
    if (!st.raf) st.raf = requestAnimationFrame(frame);
  }
  function unmount() {
    if (st.raf) cancelAnimationFrame(st.raf); st.raf = 0; st.ro?.disconnect(); st.ro = null; st.el = null; skyOn(false);
  }
  function refresh() { if (!st.el) return; setStat(); repaint(); }
  function snapshot() {
    const c = db();
    return { stars: c.stars.length, groups: c.groups.length, mode: st.mode, focus: st.focus, panel: st.panel, hover: st.hover, hoverGroup: st.hoverG, playing: playingStar(), camera: { ...cam }, target: { ...camT }, screen: Object.fromEntries(Object.entries(st.scr).map(([k, p]) => [k, { x: Math.round(p.x), y: Math.round(p.y), r: +p.r.toFixed(1) }])) };
  }

  document.addEventListener('keydown', (e) => {
    if (!st.el || !st.el.isConnected || document.body.dataset.page !== 'atlas' || typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector('#modalBox.on, .modal.on, body.modal-open')) return;
    if (e.key === 'Escape') { if (st.menu) closeMenu(); else if (st.mode === 'create') exitCreate(); else if (st.mode || st.panel || st.focus) closeAny(); else return; e.preventDefault(); e.stopPropagation(); }
    else if (e.code === 'KeyF') { fitAll(); e.preventDefault(); }
    else if (e.key === '+' || e.key === '=') { zoomAt(st.W / 2, st.H / 2, 1.3); e.preventDefault(); }
    else if (e.key === '-' || e.key === '_') { zoomAt(st.W / 2, st.H / 2, 1 / 1.3); e.preventDefault(); }
  }, true);
  addEventListener('pulse-window-visibility', () => { if (st.el && !st.raf && !window.pulseWinHidden) { st.last = 0; st.raf = requestAnimationFrame(frame); } });

  // Sidebar entry: «Атлас» right after «Библиотека» (clicks are routed by the app's global [data-go] handler).
  function navLink() {
    const side = document.getElementById('side'); if (!side) return null;
    let a = side.querySelector('[data-go="atlas"]');
    if (!a) {
      a = document.createElement('a'); a.className = 'nv'; a.dataset.go = 'atlas'; a.tabIndex = 0; a.setAttribute('role', 'button');
      a.innerHTML = `${typeof ico === 'function' ? ico('sparkle') : ''}<span data-i18n-skip="true"></span>`;
      a.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && typeof go === 'function') { e.preventDefault(); go({ r: 'atlas' }); } });
      const lib = side.querySelector('[data-go="library"]'); if (lib) lib.after(a); else side.appendChild(a);
    }
    a.querySelector('span').textContent = T('Атлас', 'Atlas');
    return a;
  }
  navLink();
  PX.on('page', () => navLink());
  PAGES.atlas = { sync: shell };
  PX.on('page', (r) => { if ((r && r.r) === 'atlas' || route().r === 'atlas') requestAnimationFrame(mount); else unmount(); });
  PX.on('track', () => { if (st.el && (st.panel === 'star' || st.panel === 'group' || st.panel === 'nav')) repaint(); });
  PX.trackMenu.push((t) => ['sparkle', T('Добавить в Атлас…', 'Add to Atlas…'), () => trackDialog(t)]);
  window.PulseAtlas = { trackDialog, listDialog, beat: (v) => { st.extBeat = Math.max(st.extBeat, +v || 0); }, refresh, snapshot };
})();
