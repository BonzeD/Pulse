// 1.9.4 — «Только текст»: полноэкранная сцена с текстом песни и обложкой, без панелей.
// Стили: «Классика» (строки по центру), «Кинетика» (слова появляются по одному и собираются в строки,
// последнее спетое — крупнее и светится), «Столбик» (каждое слово — своей строкой, как в клипах-лирик-видео).
// Опции: шрифт, размер, анимация появления слов, регистр, отражение в воде с рябью, пылинки, раскладка, обложка.
const LYS_FONT = { serif: '"Playfair Display", Georgia, "Times New Roman", serif', sans: '"Segoe UI", Arial, sans-serif', display: 'Impact, "Arial Narrow", "Segoe UI Black", sans-serif', mono: 'Consolas, "Courier New", monospace', app: 'var(--font, "Segoe UI"), sans-serif' };
const LYS_VIS = [['classic', 'Классика'], ['kinetic', 'Кинетика'], ['stack', 'Столбик'], ['immersion', 'Погружение']];
const lys = { on: false, line: -9, word: -1, raf: 0, parts: [], hideT: 0 };
const lyY = () => S().ly;
// DOM is immutable within a lyric block. Cache references, never query it per frame.
const lysNodeCache = new WeakMap();
function lysNodes(blk) {
  let n = lysNodeCache.get(blk); if (n) return n;
  const words = [...blk.querySelectorAll('.lw')], rows = [...blk.querySelectorAll('.lr')];
  n = { words, rows, byIndex: new Map(words.map((e,i)=>[e.dataset.k === undefined ? i : +e.dataset.k,e])), bg: new Map() };
  lysNodeCache.set(blk,n); return n;
}
function lysInvalidateFit() { if (!lys.on) return; lys.fitRevision = (lys.fitRevision || 0) + 1; lysSync(true); }
window.addEventListener('resize', lysInvalidateFit);
document.fonts?.addEventListener('loadingdone', lysInvalidateFit);
function lysHtml() {
  return `<div class="lys-bg" id="lysBg"></div><canvas class="lys-pt" id="lysPt"></canvas>
  <svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <filter id="lysRipple" x="-25%" y="-80%" width="150%" height="260%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.008 0.1" numOctaves="1" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="12" id="lysDisp" xChannelSelector="R" yChannelSelector="G"/></filter>
  <filter id="lysWaterA" x="-25%" y="-80%" width="150%" height="260%" color-interpolation-filters="sRGB"><feTurbulence id="lysWaNoise" type="fractalNoise" baseFrequency="0.0022 0.12" numOctaves="2" seed="7" result="n"/><feColorMatrix in="n" type="matrix" values="1 0 0 0 0  0 0 0 0 .5  0 0 0 0 0  0 0 0 0 1" result="m"/><feDisplacementMap in="SourceGraphic" in2="m" scale="14" xChannelSelector="R" yChannelSelector="G" id="lysWaDisp"/><feGaussianBlur stdDeviation="0.25 0.7"/></filter>
  <filter id="lysWaterB" x="-25%" y="-80%" width="150%" height="260%" color-interpolation-filters="sRGB"><feTurbulence id="lysWbNoise" type="fractalNoise" baseFrequency="0.0016 0.07" numOctaves="2" seed="11" result="n"/><feColorMatrix in="n" type="matrix" values="1 0 0 0 0  0 0 0 0 .5  0 0 0 0 0  0 0 0 0 1" result="m"/><feDisplacementMap in="SourceGraphic" in2="m" scale="24" xChannelSelector="R" yChannelSelector="G" id="lysWbDisp"/><feGaussianBlur stdDeviation="0.7 1.8"/></filter>
  </defs></svg>
  <div class="lys-wrap" id="lysWrap">
    <div class="lys-text"><div class="lys-main" id="lysMain"></div><div class="lys-water" id="lysWater"><div class="lys-refl" id="lysRefl" aria-hidden="true"></div><div class="lys-refl lys-refl2" id="lysRefl2" aria-hidden="true"></div><i class="lys-wl"></i><i class="lys-glint"></i><i class="lys-tint"></i></div></div>
    <div class="lys-cover" id="lysCover"><div class="lys-art" id="lysArt"></div><div class="lys-meta"><b id="lysT"></b><span id="lysA"></span></div></div>
  </div>
  <div class="lys-ui">
    <div class="lys-seg">${LYS_VIS.map(([v, n]) => `<button data-lys="vis:${v}">${n}</button>`).join('')}</div>
    <label class="lys-scene-control">Мир<select data-scene="world" aria-label="Мир погружения"><option value="orbit">Орбитальная станция</option><option value="ocean">Чёрное море</option></select></label>
    <label class="lys-scene-control">Графика<select data-scene="quality" aria-label="Качество сцены"><option value="auto">Авто</option><option value="balanced">Баланс</option><option value="high">Кино</option><option value="eco">Экономия</option></select></label>
    <button class="lys-b" data-lys="refl" title="Отражение в воде">${ico('wave')}</button>
    <button class="lys-b" data-lys="pt" title="Пылинки">${ico('sparkle')}</button>
    <button class="lys-b" data-lys="cfg" title="Настройки вида">${ico('tune')}</button>
    <button class="lys-b" data-lys="close" title="Выйти (Esc или T)">${ico('x')}</button>
  </div>
  <div class="lys-prog"><i id="lysProg"></i></div>`;
}
// 2.0.4-fix: цвета градиента текста — пресеты от обложки, случайный и свой
const LYS_GRAD = [['cover', 'Обложка'], ['shade', 'Оттенки'], ['cover3', 'Три цвета'], ['contrast', 'Контраст'], ['random', 'Случайный'], ['custom', 'Свой']];
function lysGradRand(Y) {
  const t = typeof curTrack === 'function' && curTrack(); let h = 2166136261; for (const ch of String((t && t.id) || 'x') + '|' + (Y.kGradSeed || 0)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const r = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) / 4294967296);
  const h1 = Math.round(r() * 360), h2 = Math.round(h1 + 60 + r() * 140) % 360, h3 = Math.round(h2 + 40 + r() * 80) % 360;
  return [`hsl(${h1} 85% 68%)`, `hsl(${h2} 85% 66%)`, `hsl(${h3} 80% 70%)`];
}
function lysGradApply(st, Y) {
  if (!st) return; const m = Y.kGrad || 'cover', a = (i) => `rgb(var(--a${i}))`;
  const g = m === 'shade' ? [`color-mix(in srgb,${a(1)} 45%,#fff)`, a(1), `color-mix(in srgb,${a(1)} 70%,#000)`]
    : m === 'cover3' ? [a(1), a(2), a(3)]
    : m === 'contrast' ? [a(1), `hsl(from ${a(1)} calc(h + 180) s l)`, `hsl(from ${a(1)} calc(h + 180) s l)`]
    : m === 'random' ? lysGradRand(Y)
    : m === 'custom' ? [Y.kGradC1 || '#ffd36e', Y.kGradC2 || '#ff5fa2', Y.kGradC2 || '#ff5fa2']
    : [a(1), a(2), a(2)];
  g.forEach((c, i) => st.style.setProperty(`--lg${i + 1}`, c));
}
function lysApply() {
  lys.fitRevision = (lys.fitRevision || 0) + 1;
  const st = $('lyStage'); if (!st) return; const Y = lyY();
  st.dataset.vis = Y.vis || 'classic'; st.dataset.anim = Y.kAnim || 'rise'; st.dataset.layout = Y.kLayout || 'left'; st.dataset.cover = Y.kCover || 'right';
  st.classList.toggle('refl', Y.kRefl !== false); st.classList.toggle('upper', (Y.kCase || 'upper') === 'upper'); st.classList.toggle('pt', Y.kParticles !== false);
  st.style.setProperty('--lysFont', LYS_FONT[Y.kFont] || LYS_FONT.serif); st.style.setProperty('--lysK', ((+Y.kSize || 100) / 100).toFixed(2));
  const d = document.getElementById('lysDisp'); if (d) d.setAttribute('scale', String(Math.round((+Y.kRipple || 0) * 0.32)));
  // 2.0.3: настраиваемые эффекты
  st.dataset.col = Y.kColor || 'white'; st.dataset.glowc = Y.kGlowCol || 'accent'; st.dataset.pt = Y.kPtType || 'dust'; lysGradApply(st, Y);
  st.classList.toggle('chroma', !!Y.kChroma); st.classList.toggle('outline', !!Y.kOutline);
  st.style.setProperty('--lysGlow', ((Y.kGlow ?? 100) / 100).toFixed(2)); st.style.setProperty('--lysDim', ((Y.kBgDim ?? 65) / 100).toFixed(2));
  const rf = document.getElementById('lysRefl');
  // 2.0.7: реалистичность отражения — простое / обычное (как было) / ультра / глитч.
  // 2.0.4-fix: прежнее «ультра» (полосы, разрывы) стало «Глитч», а «Ультра» — спокойная водная гладь: плавные широкие волны, глубина
  const rq = lysReflQ(), rf2 = document.getElementById('lysRefl2'); st.dataset.refq = rq;
  if (rf) {
    const blN = (Y.kReflBlur ?? 12) / 10, op = (Y.kReflOp ?? 32) / 100, rip = +Y.kRipple || 0;
    rf.style.opacity = op.toFixed(2);
    if (rq === 'simple') { rf.style.filter = blN > 0 ? `blur(${(blN * 0.6).toFixed(1)}px)` : 'none'; rf.classList.remove('wave'); }
    else if (rq === 'ultra') { rf.style.filter = rip > 0 ? `url(#lysWaterA) blur(${(blN * 0.3).toFixed(2)}px)` : `blur(${(blN * 0.3).toFixed(2)}px)`; rf.classList.toggle('wave', rip > 0); rf.style.opacity = Math.min(0.8, op * 1.2).toFixed(2); }
    else if (rq === 'glitch') { rf.style.filter = rip > 0 ? `url(#lysWaterA) blur(${(blN * 0.25).toFixed(2)}px)` : `blur(${(blN * 0.25).toFixed(2)}px)`; rf.classList.toggle('wave', rip > 0); rf.style.opacity = Math.min(0.85, op * 1.25).toFixed(2); }
    else { rf.style.filter = rip > 0 ? `url(#lysRipple) blur(${blN.toFixed(1)}px)` : `blur(${blN.toFixed(1)}px)`; rf.classList.toggle('wave', rip > 0); }
  }
  if (rf2) {
    const blN = (Y.kReflBlur ?? 12) / 10, rip = +Y.kRipple || 0;
    const two = rq === 'ultra' || rq === 'glitch';
    rf2.style.filter = two && rip > 0 ? `url(#lysWaterB) blur(${(blN * 0.6 + 0.4).toFixed(1)}px)` : 'none';
    rf2.style.opacity = two ? Math.min(0.32, ((Y.kReflOp ?? 32) / 100) * 0.38).toFixed(2) : '0';
    rf2.classList.toggle('wave', two && rip > 0);
    if (!two) rf2.textContent = '';
  }
  lys.wa = 0; lys.wb = 0; lys.wq = '';
  lys.parts = [];
  st.querySelectorAll('[data-lys^="vis:"]').forEach((b) => b.classList.toggle('on', b.dataset.lys === 'vis:' + (Y.vis || 'classic')));
  st.querySelector('[data-lys="refl"]').classList.toggle('on', Y.kRefl !== false); st.querySelector('[data-lys="pt"]').classList.toggle('on', Y.kParticles !== false);
  const immersion = st.dataset.vis === 'immersion';
  st.querySelector('[data-scene="world"]').value = ['ocean'].includes(Y.kWorld) ? Y.kWorld : 'orbit';
  st.querySelector('[data-scene="quality"]').value = ['auto','balanced','high','eco'].includes(Y.kSceneQuality) ? Y.kSceneQuality : 'auto';
  if (immersion) window.PulseImmersion?.attach(st); else window.PulseImmersion?.detach();
  lysMeta(); lys.line = -9; if (!immersion) lysSync(true);
}
function lysMeta() {
  const t = typeof curTrack === 'function' && curTrack(); const a = $('lysArt'); if (!a) return;
  const u = t ? artOf(t, 720) : ''; a.style.backgroundImage = u ? `url('${u}')` : ''; const bg = $('lysBg'); bg.style.backgroundImage = u ? `url('${u}')` : ''; bg.classList.remove('pre');
  // 2.0.3: фон размываем один раз в маленькую картинку — CSS blur(60px) на весь экран с «наездом» пересчитывался каждый кадр
  if (u && typeof blurImage === 'function') { const want = u; blurImage(u, { w: 384, blur: 60, sat: 1.3, bright: 0.32 }).then((d) => { if (d && lys.on && bg.isConnected && lys.bgU === want) { bg.style.backgroundImage = `url('${d}')`; bg.classList.add('pre'); } }); }
  lys.bgU = u;
  $('lysT').textContent = t ? t.title || '' : 'Ничего не играет'; $('lysA').textContent = t ? (t.artists || []).map((x) => x.name || x).join(', ') || t.author || '' : '';
}
function lyStageOpen(v, idle) {
  v = v == null ? !lys.on : !!v; if (v === lys.on) return; lys.on = v; lys.idle = v && !!idle;
  let st = $('lyStage');
  if (v) {
    window.PulseMotion?.flush('stage');
    if (!st) { st = document.createElement('div'); st.id = 'lyStage'; st.className = 'lys'; st.innerHTML = lysHtml(); document.body.appendChild(st); st.addEventListener('click', lysClick); st.addEventListener('pointermove', lysWake); st.addEventListener('change', lysSceneChange); st.addEventListener('focusin', () => { st.classList.add('ui'); clearTimeout(lys.hideT); }); st.addEventListener('focusout', lysWake); }
    st.classList.toggle('idle', lys.idle); lys.idleAt = performance.now();
    document.body.classList.add('lyonly'); lysApply(); if (!lys.idle) lysWake(); lys.raf = requestAnimationFrame(lysLoop);
    lys.fitObserver?.disconnect(); lys.fitObserver = new ResizeObserver(lysInvalidateFit); lys.fitObserver.observe($('lysMain'));
    if (lyY().vis !== 'immersion' && !lyState.lines && !lys.idle) toast('Для этой песни пока нет текста — покажу обложку', 'lyrics');
  } else { window.PulseImmersion?.detach(); clearTimeout(lys.hideT); document.body.classList.remove('lyonly'); cancelAnimationFrame(lys.raf); lys.raf = 0; lys.fitObserver?.disconnect(); lys.reflectionObserver?.disconnect(); lys.live = null; if (st) { if (window.PulseMotion) PulseMotion.remove(st,'stage'); else st.remove(); } lys.parts = []; lys.idle = false; }
}
window.lyStageOpen = lyStageOpen;
function lysWake() { const st = $('lyStage'); if (!st || lys.idle) return; st.classList.add('ui'); clearTimeout(lys.hideT); lys.hideT = setTimeout(() => st.classList.remove('ui'), 2200); }
function lysSceneChange(e) {
  const kind = e.target.dataset.scene; if (!kind) return;
  if (kind === 'world') lyY().kWorld = ['ocean'].includes(e.target.value) ? e.target.value : 'orbit';
  if (kind === 'quality') lyY().kSceneQuality = e.target.value;
  save(); window.PulseImmersion?.configure(); lysWake();
}
function lysClick(e) {
  const b = e.target.closest('[data-lys]'); if (!b) return; e.stopPropagation();
  const [k, v] = b.dataset.lys.split(':'), Y = lyY();
  if (k === 'close') return lyStageOpen(false);
  if (k === 'vis') Y.vis = v;
  if (k === 'refl') Y.kRefl = Y.kRefl === false;
  if (k === 'pt') Y.kParticles = Y.kParticles === false;
  if (k === 'cfg') { lyStageOpen(false); lib.setTab = 'ly'; if (document.body.classList.contains('pp-open')) closePP(); go({ r: 'settings' }); setTimeout(() => { const h = document.getElementById('lysCfg'); if (h) h.scrollIntoView({ block: 'start' }); }, 300); return; }
  save(); lysApply();
}
// разбивка слов на строки для «Кинетики»: ~14–18 символов в строке
function lysRows(words, max) {
  const rows = []; let cur = [], len = 0;
  words.forEach((w, k) => { const n = String(w.s).trim().length; if (cur.length && len + n > max) { rows.push(cur); cur = []; len = 0; } cur.push(k); len += n + 1; });
  if (cur.length) rows.push(cur); return rows;
}
const lysW = (s) => esc(String(s).trim());
// 1.9.7: html блока строки — общий для сцены и для предпросмотра в настройках
function lysBlockHtml(lines, i, vis, Y) {
  const L = lines[i];
  if (!lines.length) return '<div class="lys-blk lys-none-b"><div class="lys-none">♪</div></div>';
  if (!L || L.gap) return `<div class="lys-blk lys-gap"><i></i><i></i><i></i></div>`;
  if (L.endCredits) return `<div class="lys-blk lys-credits"><small>Конец текста</small><p data-i18n-skip>${esc(L.text||'')}</p></div>`;
  const words = L.words && L.words.length ? L.words : [{ t: L.t, s: L.text || '' }];
  if (vis === 'classic') {
    const prev = lines.slice(0, i).reverse().find((x) => !x.gap), next = lines.slice(i + 1).find((x) => !x.gap);
    const txt = (x) => esc(x.text || (x.words || []).map((q) => q.s).join(' '));
    return `<div class="lys-blk lys-cl">${prev ? `<div class="lys-pv">${txt(prev)}</div>` : ''}<div class="lys-cur">${words.map((q) => `<span class="lw">${lysW(q.s)}</span>`).join(' ')}</div>${next ? `<div class="lys-nx">${txt(next)}</div>` : ''}</div>`;
  }
  // 2.0.4: бэк-вокал Spicy (слова с номера L.nb) — своими строками и мельче, не «плакатом»
  const nb = L.nb && L.nb < words.length ? L.nb : words.length, mx = Math.max(9, Math.round(15 / (+Y.kSize || 100) * 100));
  const rows = vis === 'stack' ? words.map((_, k) => [k]) : [...lysRows(words.slice(0, nb), mx), ...lysRows(words.slice(nb), mx).map((r) => r.map((k) => k + nb))];
  return `<div class="lys-blk lys-kin ${vis === 'stack' ? 'lys-stk' : ''}">${rows.map((r) => `<div class="lr${r[0] >= nb ? ' lbg' : ''}"><span class="lri">${r.map((k, j) => `<span class="lw" data-k="${k}" style="--d:${(j * 0.015).toFixed(3)}s">${lysW(words[k].s)}</span>`).join(' ')}</span></div>`).join('')}</div>`;
}
// ключ строки: тот же текст в том же стиле = тот же блок (раньше блок пересобирался при любом сбросе индекса —
// уже спетые слова заново «влетали» из размытия, а старая копия таяла поверх: двоение и каша)
function lysKey(lines, i, vis) {
  const L = lines[i]; if (!lines.length) return vis + '|none'; if (!L || L.gap) return vis + '|gap|' + i;
  return vis + '|' + (L.endCredits?'credits|':'') + (L.text || (L.words || []).map((q) => q.s).join(' '));
}
function lysPutBlock(m, h, key, vis, w, fit) {
  const old = m.querySelectorAll('.lys-blk:not(.out)'); old.forEach((o) => { o.classList.add('out'); setTimeout(() => o.remove(), 500); });
  m.insertAdjacentHTML('beforeend', h);
  const blk = m.lastElementChild; blk.dataset.vis = vis; blk.dataset.key = key;
  if (vis !== 'classic' && fit) lysFit(blk);
  // классы ставим кадром позже — тогда появление каждого слова анимируется
  // 2.0.3: отражение — живой «близнец» блока: создаётся вместе с ним (ещё без подсвеченных слов) и получает те же классы
  // в тот же кадр, поэтому слова в воде появляются и гаснут синхронно с текстом, а не заранее
  if (m.id === 'lysMain') lysReflPut(blk);
  requestAnimationFrame(() => { if (blk.isConnected) lysMarkAll(blk, w, vis); });
  return blk;
}
function lysRender(i, w) {
  const m = $('lysMain'); if (!m) return; const Y = lyY(), vis = Y.vis || 'classic', lines = lyState.lines || [];
  const key = lysKey(lines, i, vis), live = m.querySelector('.lys-blk:not(.out)');
  if (live && live.dataset.key === key) { lys.live = live; lys.line = i; if(vis !== 'classic' && Y.kFit !== false && (live._fitRevision !== lys.fitRevision || live._fitVW !== innerWidth || live._fitVH !== innerHeight)){lysFit(live);const rows=lysNodes(live).rows;for(const tw of [live._twin,live._twin2])if(tw)lysNodes(tw).rows.forEach((r,k)=>r.style.fontSize=rows[k].style.fontSize);} lysMarkAll(live, w, vis); lys.word = w; return; }
  lys.line = i; lys.live = lysPutBlock(m, lysBlockHtml(lines, i, vis, Y), key, vis, w, Y.kFit !== false);
  lys.line = i; lys.word = w;
}
// строки «Кинетики» подгоняются под общую ширину — получается плакат, как в лирик-видео: короткие слова крупнее
function lysFit(blk) {
  const rows = lysNodes(blk).rows; if (!rows.length) return;
  blk._fitRevision = lys.fitRevision; blk._fitVW = innerWidth; blk._fitVH = innerHeight;
  const W = blk.clientWidth || 600, scale = (+lyY().kSize || 100) / 100;
  const stack = blk.classList.contains('lys-stk');
  const sizes = rows.map(r => {
    const inner = r.firstElementChild, font = parseFloat(getComputedStyle(r).fontSize) || 64*scale;
    const width = inner.offsetWidth || 1;
    return Math.max(12, Math.min(118.4*scale, font * W * (stack ? .62 : .92) / width));
  });
  // 1.0.0: short windows and many words must not put sung text above the viewport.
  const available = Math.max(100, blk.parentElement.getBoundingClientRect().bottom - 78);
  const total = sizes.reduce((a,b) => a+b*1.08,0), shrink = Math.min(1,available/Math.max(1,total));
  rows.forEach((r,i)=>{r.style.fontSize = (sizes[i] * shrink * (r.classList.contains('lbg') ? .5 : 1)).toFixed(2)+'px';});
}
function lysMark(blk, w, vis) {
  if (vis === 'classic') { blk.querySelectorAll('.lys-cur .lw').forEach((e, k) => { e.classList.toggle('on', k <= w); e.classList.toggle('hot', k === w); }); return; }
  const L0 = (lyState.lines || [])[lys.line], nb = L0 && L0.nb; // 2.0.4: бэк-вокал Spicy — по своему времени (lysBgMark)
  blk.querySelectorAll('.lw').forEach((e) => { const k = +e.dataset.k; if (nb && k >= nb) return; e.classList.toggle('in', k <= w); e.classList.toggle('hot', k === w); });
  blk.querySelectorAll('.lr').forEach((r, k) => { r.classList.toggle('shown', !!r.querySelector('.lw.in')); if (vis === 'stack') r.classList.toggle('gone', w >= 0 && k < w - 3); });
}
// 2.0.4: бэк-вокал Spicy Lyrics (слова после основного голоса, L.nb) в «Кинетике»/«Столбике» появляется по своему времени,
// а не по номеру текущего слова основного голоса (иначе он не показывался вовсе)
function lysBgMark() {
  const L = (lyState.lines || [])[lys.line]; if (!L || !L.nb || !L.words) return;
  const blk = lys.live; if (!blk?.isConnected || !blk.classList.contains('lys-kin')) return;
  const T = (heard(S().ly.lag || 0) - offset()) / stretchK();
  for (const b of [blk, blk._twin, blk._twin2]) {
    if (!b?.isConnected) continue; const n = lysNodes(b);
    for (let k=L.nb;k<L.words.length;k++) {
      const on = T >= L.words[k].t; if(n.bg.get(k)===on)continue; n.bg.set(k,on);
      const e=n.byIndex.get(k); if(!e)continue; e.classList.toggle('in',on);
      const row=e.closest('.lr'); if(row)row.classList.toggle('shown',!!row.querySelector('.lw.in'));
    }
  }
}
function lysMarkAll(blk, w, vis) { lysMark(blk, w, vis); for (const tw of [blk._twin, blk._twin2]) if (tw && tw.isConnected) lysMark(tw, w, vis); }
function lysReflPut(blk) {
  const rf = $('lysRefl'); if (!rf) return;
  rf.querySelectorAll('.lys-blk:not(.out)').forEach((o) => { o.classList.add('out'); setTimeout(() => o.remove(), 500); });
  if (lyY().kRefl === false) return;
  const tw = blk.cloneNode(true); tw.removeAttribute('id'); tw.classList.remove('out'); tw.setAttribute('aria-hidden', 'true');
  rf.appendChild(tw); blk._twin = tw;
  // 1.0.0: padding gives displacement room without clipping first/last glyphs.
  let fitWidth = blk.clientWidth, fitViewport = innerHeight;
  const sizeReflection = () => {
    if (!blk.isConnected || blk.classList.contains('out')) return;
    if ((blk.clientWidth !== fitWidth || innerHeight !== fitViewport) && lyY().kFit !== false && !blk.classList.contains('lys-cl')) {
      fitWidth = blk.clientWidth; fitViewport = innerHeight; lysFit(blk);
      const rows = blk.querySelectorAll('.lr');
      for (const twin of [blk._twin,blk._twin2]) if (twin) twin.querySelectorAll('.lr').forEach((r,i)=>r.style.fontSize=rows[i].style.fontSize);
    }
    const height = Math.ceil(blk.offsetHeight || blk.scrollHeight || 200); $('lysWater').style.setProperty('--reflection-source-height', (height + 64) + 'px');
  };
  if (lys.reflectionObserver) lys.reflectionObserver.disconnect();
  lys.reflectionObserver = new ResizeObserver(sizeReflection); lys.reflectionObserver.observe(blk); sizeReflection();
  // 2.0.7: «ультра» — второй, дальний слой воды: сильнее размыт и сильнее колышется
  const rf2 = $('lysRefl2'); if (!rf2) return;
  rf2.querySelectorAll('.lys-blk:not(.out)').forEach((o) => { o.classList.add('out'); setTimeout(() => o.remove(), 500); });
  if (lysReflQ() !== 'ultra' && lysReflQ() !== 'glitch') return;
  const t2 = tw.cloneNode(true); rf2.appendChild(t2); blk._twin2 = t2;
}
const lysReflQ = () => { const q = lyY().kReflQ; return q === 'simple' || q === 'ultra' || q === 'glitch' ? q : 'normal'; };
function lysSync(force) {
  if (!lys.on) return; const i = lyState.cur, w = lyState.word;
  if (i === -2 && !force) return; // -2 = «пересчитай строку» на один кадр, это не новая строка
  // 1.9.7: в «Кинетике»/«Столбике» новая строка пустая, пока не спето первое слово — держим предыдущую, без чёрного экрана
  const vis = lyY().vis || 'classic', lines = lyState.lines || [], L = lines[i];
  if (!force && vis !== 'classic' && w < 0 && L && !L.gap && lys.line >= 0 && i === lys.line + 1 && lines[lys.line] && !lines[lys.line].gap) {
    const fw = L.words && L.words[0]; if (fw && fw.t - L.t < 4) return;
  }
  if (force || i !== lys.line || w !== lys.word || lys.lines !== lines) { lys.lines = lyState.lines; lysRender(i, w); }
}
// вызывается из lyricsFrame (app.js) при смене строки и слова
function lyKinWord() { if (lys.on) lysSync(); }
function lyKinLine() { if (lys.on) { lysMeta(); lysSync(); } }
const WHITE = [1, 1, 1];
// 2.0.7: «ультра»-вода живёт: волны бегут к зрителю (сдвиг шума), рябь усиливается на басах, линия воды вспыхивает на ударах.
// Сам фильтр (шум + смещение + размытие) считает видеокарта; JS меняет только два числа и не чаще 30 раз в секунду.
function lysWaterFrame(Y, bass, now) {
  const rq = lysReflQ(); if (Y.kRefl === false || (rq !== 'ultra' && rq !== 'glitch')) return;
  const rip = Math.max(0, Math.min(100, +Y.kRipple || 0));
  const still = !rip || document.body.classList.contains('no-anim') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (now - (lys.wAt || 0) < 66 && !still) return; lys.wAt = now;
  // 1.0.0: bounded noise evolution; never offset the noise out of the filter rectangle.
  const t = still ? 0 : now / 1000, strength = still ? 0 : rip / 50, glitch = rq === 'glitch';
  const set = (id, attr, value) => { const e = $(id); if (e && e.getAttribute(attr) !== value) e.setAttribute(attr, value); };
  set('lysWaNoise', 'baseFrequency', `${(0.0022 + Math.sin(t*.42)*.00035).toFixed(5)} ${(0.12 + Math.sin(t*.63)*.014).toFixed(4)}`);
  set('lysWbNoise', 'baseFrequency', `${(0.0016 + Math.sin(t*.31)*.0002).toFixed(5)} ${(0.07 + Math.sin(t*.48)*.009).toFixed(4)}`);
  set('lysWaDisp', 'scale', ((glitch ? 23 : 14) * strength * (1 + bass*.22)).toFixed(1));
  set('lysWbDisp', 'scale', ((glitch ? 34 : 24) * strength).toFixed(1));
}
function lysLoop(now) {
  if (window.PulsePrism?.active()) { lys.raf = 0; return; }
  if (!lys.on) return; lys.raf = requestAnimationFrame(lysLoop);
  if (window.PulseImmersion?.active()) return;
  lysBgMark();
  if (lys.line !== lyState.cur || lys.word !== lyState.word || lys.lines !== lyState.lines) lysSync(); // 2.0.4-fix: заменили текст — перерисовать, даже если номер строки тот же
  const Y = lyY(), d = E.dur(), c = E.time(), pr = $('lysProg'); if (pr) pr.style.transform = `scaleX(${d ? Math.min(1, c / d).toFixed(4) : 0})`; // 2.0.3: transform вместо width — без пересчёта раскладки
  const bass = Math.min(1, (beatState.bass || 0) * 1.4);
  // 2.0.3: пульс и тряска текста на басах — только transform одного элемента (дёшево, без перерисовки)
  const mn = $('lysMain'), kb = (+Y.kBeat || 0) / 100, ks = (+Y.kShake || 0) / 100;
  if (mn && (kb || ks || lys.tf)) {
    lys.bs = Math.max(bass, (lys.bs || 0) * 0.9); const sc = 1 + lys.bs * lys.bs * 0.06 * kb;
    const sh = ks && lys.bs > 0.55 ? (lys.bs - 0.55) * 18 * ks : 0, sx = sh ? (Math.random() - 0.5) * sh : 0, sy = sh ? (Math.random() - 0.5) * sh : 0;
    const tf = `translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px) scale(${sc.toFixed(4)})`;
    if (tf !== lys.tf) { lys.tf = tf; mn.style.transform = tf; const rf = $('lysRefl'); if (rf && rf.firstElementChild) rf.style.translate = `${sx.toFixed(1)}px 0`; const r2 = $('lysRefl2'); if (r2 && r2.firstElementChild) r2.style.translate = `${(sx * 0.6).toFixed(1)}px 0`; }
  }
  lysWaterFrame(Y, bass, now);
  const cv = $('lysPt'); if (!cv || Y.kParticles === false) return;
  const W = innerWidth, H = innerHeight, dpr = Math.min(1.5, devicePixelRatio || 1);
  const frame = PulseParticleCanvas.frame(cv, S().perf.gpu !== false, W, H, dpr);
  const R = frame.renderer, g = frame.context;
  if (!R && !g) return; if (g) { g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H); }
  // 2.0.3: цвет акцента читаем раз в секунду (раньше getComputedStyle — каждый кадр); виды частиц и плотность — в настройках
  if (!lys.colAt || now - lys.colAt > 1000) { lys.colAt = now; lys.col = getComputedStyle(document.documentElement).getPropertyValue('--a1').trim() || '255,255,255'; }
  const col = lys.col, type = Y.kPtType || 'dust', N = Math.round(90 * Math.max(0.2, Math.min(2.5, (+Y.kPtDens || 100) / 100)));
  if (lys.parts.length > N) lys.parts.length = N;
  for (let k = lys.parts.length; k < N; k++) lys.parts.push({ x: Math.random() * W, y: Math.random() * H, r: 0.4 + Math.random() * 1.8, v: 0.1 + Math.random() * 0.45, a: Math.random() * 6.28, o: 0.2 + Math.random() * 0.6 });
  const pb = R ? R.buf(lys.parts.length * 11) : null; let pn = 0;
  if (R && lys.colS !== col) { lys.colS = col; lys.colN = col.split(',').map((x) => { const v = parseFloat(x); return (isNaN(v) ? 255 : v) / 255; }); }
  const cursor = window.PulsePointer?.position();
  for (const p of lys.parts) {
    if (cursor) {
      const dx=p.x-(cursor.x+1)*W/2, dy=p.y-(cursor.y+1)*H/2, dist=Math.hypot(dx,dy);
      if (dist>1 && dist<130) { const force=(1-dist/130)*1.8;p.x+=dx/dist*force;p.y+=dy/dist*force; }
    }
    if (type === 'snow') { p.y += p.v * 1.6 * (1 + bass); p.a += 0.012; p.x += Math.sin(p.a) * 0.6; if (p.y > H + 10) { p.y = -10; p.x = Math.random() * W; } }
    else if (type === 'stars') { p.a += 0.03 + p.v * 0.05; }
    else if (type === 'bubbles') { p.y -= p.v * 1.3 * (1 + bass * 2); p.a += 0.02; p.x += Math.sin(p.a) * 0.5; if (p.y < -20) { p.y = H + 20; p.x = Math.random() * W; } }
    else { p.y -= p.v * (1 + bass * 2.5); p.a += 0.01; p.x += Math.sin(p.a) * 0.25; if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; } }
    const o = type === 'stars' ? p.o * (0.35 + 0.65 * Math.abs(Math.sin(p.a))) * (0.7 + bass * 0.3) : p.o * (0.55 + bass * 0.45);
    if (R) {
      const bub = type === 'bubbles', c = (bub ? p.r > 1.4 : p.r > 1.6) ? lys.colN : WHITE, r = bub ? p.r * 3.2 * (1 + bass * 0.5) : p.r * (type === 'snow' ? 1.6 : 1) * (1 + bass * 0.8);
      const j=pn*11;pb[j]=p.x;pb[j+1]=p.y;pb[j+2]=0;pb[j+3]=r;pb[j+4]=0;pb[j+5]=c[0];pb[j+6]=c[1];pb[j+7]=c[2];pb[j+8]=bub?o*.8:o;pb[j+9]=0;pb[j+10]=bub?1:0;pn++;continue;
    }
    g.beginPath();
    if (type === 'bubbles') { g.arc(p.x, p.y, p.r * 3.2 * (1 + bass * 0.5), 0, 6.283); g.strokeStyle = `rgba(${p.r > 1.4 ? col : '255,255,255'},${(o * 0.8).toFixed(2)})`; g.lineWidth = 1; g.stroke(); continue; }
    g.arc(p.x, p.y, p.r * (type === 'snow' ? 1.6 : 1) * (1 + bass * 0.8), 0, 6.283); g.fillStyle = `rgba(${p.r > 1.6 ? col : '255,255,255'},${o.toFixed(2)})`; g.fill();
  }
  if (R) { R.camera({ screen: true }); R.draw('pt', pb, pn); }
}
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && e.target.type !== 'range') return;
  if (document.body.classList.contains('cz-edit')) return;
  if (e.code === 'KeyT') { e.preventDefault(); return lyStageOpen(); }
  if (lys.on && e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); lyStageOpen(false); }
}, true);
// 1.9.7: событие 'track' приходит и без смены песни (старт после буферизации и т.п.) — сбрасываем строку только при новой песне
PX.on && PX.on('track', (t) => { const id = t && t.id; if (lys.on) { lysMeta(); if (lyY().kGrad === 'random') lysGradApply($('lyStage'), lyY()); if (id !== lys.tid) lys.line = -9; } lys.tid = id; });
// строки настроек (вкладка «Текст песен»)
function lyStageRows() {
  return [
    grp('Режим «Только текст»'),
    { raw: `<div class="opt-row" id="lysCfg"><button class="btn sm" data-sact="lys:open">${ico('lyrics')}Открыть «Только текст» (T)</button></div>` },
    { raw: lysPvHtml() },
    R('Панель плеера внизу', 'Всегда — кнопки плеера видны · Прятать сама — уходит, когда мышь не двигается · Нет — только текст', seg('ly.kBar', [['on', 'Всегда'], ['auto', 'Прятать сама'], ['off', 'Нет']]), 'панель плеер низ кнопки управление'), // 2.0.7
    R('Стиль', 'Классика — строки по центру · Кинетика — слова появляются по одному и складываются в строки · Столбик — каждое слово своей строкой, как в лирик-видео', seg('ly.vis', LYS_VIS), 'только текст кинетика стиль'),
    R('Шрифт', '', seg('ly.kFont', [['serif', 'С засечками'], ['sans', 'Обычный'], ['display', 'Плакатный'], ['mono', 'Моно'], ['app', 'Как в Pulse']]), 'шрифт только текст'),
    R('Размер', '', rng('ly.kSize', 60, 160, 5, '%')),
    R('Появление слов', '', seg('ly.kAnim', [['rise', 'Снизу'], ['blur', 'Из размытия'], ['pop', 'Пружина'], ['type', 'Печать'], ['drop', 'Сверху'], ['flip', 'Переворот'], ['slide', 'Сбоку'], ['zoom', 'Из глубины']])),
    grp('Эффекты текста'),
    R('Цвет текста', 'Градиент — цвета обложки переливаются по словам', seg('ly.kColor', [['white', 'Белый'], ['accent', 'Цвет обложки'], ['gradient', 'Градиент']]), 'цвет текста градиент'),
    ...((lyY().kColor || 'white') === 'gradient' ? [R('↳ Цвета градиента', 'Обложка — два цвета обложки · Оттенки — светлый и тёмный тон главного цвета (для одноцветных обложек) · Три цвета · Контраст — цвет обложки и противоположный · Случайный — свой для каждой песни · Свой — выбери два цвета', seg('ly.kGrad', LYS_GRAD), 'градиент цвета пресет случайный'),
      ...(lyY().kGrad === 'random' ? [R('↳ Другой случайный', '', `<button class="btn sm" data-sact="lys:reroll">${ico('shuffle')}Перемешать</button>`)] : []),
      ...(lyY().kGrad === 'custom' ? [R('↳ Свои цвета', 'Слева → справа', colr('ly.kGradC1') + colr('ly.kGradC2'))] : [])] : []), // 2.0.4-fix
    R('Свечение слова', 'Светится только само поющееся слово — по контуру букв, без «пятна» вокруг. 0 — без свечения', rng('ly.kGlow', 0, 200, 10, '%'), 'свечение glow'),
    R('↳ Цвет свечения', '', seg('ly.kGlowCol', [['accent', 'Цвет обложки'], ['white', 'Белый']])),
    R('Пульс на басах', 'Текст чуть увеличивается в такт басу', rng('ly.kBeat', 0, 100, 5, '%'), 'пульс бас бит'),
    R('Тряска на ударах', 'Текст вздрагивает на сильных ударах', rng('ly.kShake', 0, 100, 5, '%'), 'тряска удар'),
    R('Хроматический сдвиг', 'Поющееся слово с красно-голубым «разъездом» каналов, как в клипах', tg('ly.kChroma'), 'хроматический глитч rgb'),
    R('Контур у неспетых слов', 'В «Классике» ещё не спетые слова — только обводкой', tg('ly.kOutline'), 'контур обводка'),
    grp('Фон и отражение'),
    R('Затемнение фона', '', rng('ly.kBgDim', 0, 100, 5, '%'), 'фон затемнение виньетка'),
    R('Регистр', '', seg('ly.kCase', [['upper', 'ЗАГЛАВНЫЕ'], ['normal', 'Как в тексте']])),
    R('Раскладка', '', seg('ly.kLayout', [['left', 'Слева'], ['center', 'По центру']])),
    R('Обложка', '', seg('ly.kCover', [['right', 'Справа'], ['left', 'Слева'], ['none', 'Нет']])),
    R('Отражение в воде', 'Текст и обложка отражаются внизу, как в воде', tg('ly.kRefl')),
    R('↳ Реалистичность', 'Простое — чистое зеркало, почти без нагрузки · Обычное — как раньше · Ультра — текучая рябь из прежнего Глитча, без разрывов текста · Глитч — более сильное искажение той же воды', seg('ly.kReflQ', [['simple', 'Простое'], ['normal', 'Обычное'], ['ultra', 'Ультра'], ['glitch', 'Глитч']]), 'отражение реалистичность вода ультра'), // 2.0.7
    R('↳ Рябь', '', rng('ly.kRipple', 0, 100, 5, '%')),
    R('↳ Яркость отражения', '', rng('ly.kReflOp', 10, 70, 2, '%')),
    R('↳ Размытие отражения', '', rng('ly.kReflBlur', 0, 60, 2, '')),
    R('Частицы', 'Плывут по экрану и вздрагивают на басах', tg('ly.kParticles'), 'частицы пылинки снег звёзды'),
    ...(lyY().kParticles !== false ? [R('↳ Вид', '', seg('ly.kPtType', [['dust', 'Пылинки'], ['snow', 'Снег'], ['stars', 'Звёзды'], ['bubbles', 'Пузырьки']])), R('↳ Количество', '', rng('ly.kPtDens', 20, 250, 10, '%'))] : []),
    R('Строки-плакат', 'В «Кинетике» и «Столбике» строки подгоняются под одну ширину — короткие слова крупнее, как в лирик-видео', tg('ly.kFit'), 'плакат ширина'),
    R('Экран ожидания', 'Как в Spotify: в полноэкранном плеере, если не трогать мышь, остаются только текст и обложка. Любое движение — назад', tg('ly.idleFs'), 'ожидание spotify простой мышь полный экран'),
    ...(lyY().idleFs !== false ? [R('↳ Через', '', rng('ly.idleSec', 3, 30, 1, ' с'))] : [])
  ];
}
document.addEventListener('click', (e) => { const r = e.target.closest && e.target.closest('[data-sact="lys:reroll"]'); if (r) { e.stopPropagation(); e.preventDefault(); const Y = lyY(); Y.kGradSeed = (Y.kGradSeed || 0) + 1; save(); if (lys.on) lysApply(); const pv = document.getElementById('lysPv'); if (pv) lysPvApply(pv); return; } }, true);
document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-sact="lys:open"],#btnLyOnly,#btnLyOnly2'); if (b) { e.stopPropagation(); e.preventDefault(); lyStageOpen(true); } }, true);
{ const base = settingChanged; settingChanged = function (p) { const r = base.apply(this, arguments); if (/^ly\.(vis|k[A-Z])/.test(p) && lys.on) lysApply(); return r; }; }

// ---------- 1.9.5: экран ожидания как в Spotify ----------
// Полноэкранный плеер + музыка играет + мышь не двигается N секунд → плавно остаются только текст и обложка.
// Любое движение мыши, клик или клавиша — возвращают обычный плеер.
const lysIdle = { t: 0, x: -1, y: -1 };
function lysIdleOk() {
  const Y = lyY(), B = document.body.classList;
  return !window.PulseImmersion?.active() && Y.idleFs !== false && B.contains('fs') && B.contains('pp-open') && playing && !lys.on && !B.contains('cz-edit') && !document.querySelector('.modal.show,.menu.show,.pop-panel.on,#accPop,.media-dialog[open]') && document.visibilityState === 'visible';
}
function lysIdleArm() { clearTimeout(lysIdle.t); lysIdle.t = setTimeout(() => { if (lysIdleOk()) lyStageOpen(true, true); else lysIdleArm(); }, Math.max(3, +lyY().idleSec || 8) * 1000); }
function lysIdleWake(e) {
  if (e && e.type === 'pointermove') { if (Math.abs(e.screenX - lysIdle.x) + Math.abs(e.screenY - lysIdle.y) < 6) return; lysIdle.x = e.screenX; lysIdle.y = e.screenY; }
  if (lys.on && lys.idle && performance.now() - (lys.idleAt || 0) > 400) { lyStageOpen(false); if (typeof poke === 'function') poke(); if (e && e.type !== 'pointermove' && e.type !== 'wheel') { e.preventDefault && e.preventDefault(); e.stopImmediatePropagation && e.stopImmediatePropagation(); } }
  lysIdleArm();
}
['pointermove', 'pointerdown', 'wheel', 'keydown'].forEach((t) => window.addEventListener(t, lysIdleWake, { capture: true, passive: t === 'pointermove' || t === 'wheel' }));
lysIdleArm();

// ---------- 1.9.7: живой предпросмотр «Только текст» прямо в настройках ----------
// Маленькая копия сцены: тот же стиль, шрифт, размер, появление слов, регистр, раскладка и обложка, что выбраны ниже.
// Слова «поются» сами по кругу (строки текущей песни, если они есть). Клик — открыть полноэкранный режим.
const LYS_PV_SAMPLE = ['Каждое слово загорается в такт', 'Строки собираются как в клипе', 'Выбери стиль и посмотри сразу'];
const lysPv = { i: 0, w: -1, pause: 0, at: 0, lines: null, sig: '' };
function lysPvHtml() {
  return `<div class="lys lys-pv" id="lysPv" title="Открыть «Только текст» (T)" data-sact="lys:open"><div class="lys-bg" id="lysPvBg"></div>
  <div class="lys-wrap"><div class="lys-text"><div class="lys-main" id="lysPvMain"></div></div>
  <div class="lys-cover"><div class="lys-art" id="lysPvArt"></div><div class="lys-meta"><b id="lysPvT"></b><span id="lysPvA"></span></div></div></div>
  <em class="lys-pv-cap">Предпросмотр</em></div>`;
}
function lysPvLines() {
  const src = (lyState.lines || []).filter((l) => !l.gap && (l.text || (l.words || []).length) && String(l.text || '').length < 60).slice(0, 6);
  const list = src.length >= 2 ? src.map((l) => l.text || l.words.map((q) => q.s).join(' ')) : LYS_PV_SAMPLE;
  return list.map((tx) => { const ws = String(tx).split(/\s+/).filter(Boolean); return { t: 0, text: ws.join(' '), words: ws.map((q) => ({ t: 0, s: q })) }; });
}
function lysPvApply(st) {
  const Y = lyY(), t = typeof curTrack === 'function' && curTrack();
  st.dataset.vis = Y.vis || 'classic'; st.dataset.anim = Y.kAnim || 'rise'; st.dataset.layout = Y.kLayout || 'left'; st.dataset.cover = Y.kCover || 'right';
  st.classList.toggle('refl', false); st.classList.toggle('upper', (Y.kCase || 'upper') === 'upper');
  st.dataset.col = Y.kColor || 'white'; lysGradApply(st, Y); st.dataset.glowc = Y.kGlowCol || 'accent'; st.classList.toggle('chroma', !!Y.kChroma); st.classList.toggle('outline', !!Y.kOutline); st.style.setProperty('--lysGlow', ((Y.kGlow ?? 100) / 100).toFixed(2)); // 2.0.3
  st.style.setProperty('--lysFont', LYS_FONT[Y.kFont] || LYS_FONT.serif); st.style.setProperty('--lysK', (((+Y.kSize || 100) / 100) * 0.42).toFixed(3));
  const u = t ? artOf(t, 300) : ''; const a = document.getElementById('lysPvArt'), bg = document.getElementById('lysPvBg');
  if (a) a.style.backgroundImage = u ? `url('${u}')` : ''; if (bg) bg.style.backgroundImage = u ? `url('${u}')` : '';
  const tt = document.getElementById('lysPvT'), aa = document.getElementById('lysPvA');
  if (tt) tt.textContent = t ? t.title || '' : 'Название песни'; if (aa) aa.textContent = t ? (t.artists || []).map((x) => x.name || x).join(', ') || t.author || '' : 'Исполнитель';
  return [Y.vis, Y.kAnim, Y.kFont, Y.kSize, Y.kCase, Y.kLayout, Y.kCover, Y.kFit, Y.kColor, t && t.id].join('|');
}
function lysPvTick() {
  if(window.PulseImmersion?.active())return;
  const st = document.getElementById('lysPv'); if (!st || !st.isConnected || document.hidden) { lysPv.sig = ''; return; }
  const m = document.getElementById('lysPvMain'); if (!m) return;
  const sig = lysPvApply(st), Y = lyY(), vis = Y.vis || 'classic';
  if (sig !== lysPv.sig || !lysPv.lines) { lysPv.sig = sig; lysPv.lines = lysPvLines(); lysPv.i = 0; lysPv.w = -1; lysPv.pause = 0; m.innerHTML = ''; }
  const lines = lysPv.lines, L = lines[lysPv.i];
  if (lysPv.w >= L.words.length - 1) { if (++lysPv.pause < 3) return; lysPv.pause = 0; lysPv.i = (lysPv.i + 1) % lines.length; lysPv.w = -1; }
  else lysPv.w++;
  const key = lysKey(lines, lysPv.i, vis), live = m.querySelector('.lys-blk:not(.out)');
  if (live && live.dataset.key === key) lysMark(live, lysPv.w, vis);
  else lysPutBlock(m, lysBlockHtml(lines, lysPv.i, vis, Y), key, vis, lysPv.w, Y.kFit !== false);
}
setInterval(lysPvTick, 380);

// 2.0.12: окно спрятано (трей / виджет) — сцена «Только текст» не рисуется; app.js → setWinHidden запустит её снова
{ const base = lysLoop; lysLoop = function (t) { if (window.pulseWinHidden) { lys.raf = 0; return; } return base(t); }; }
