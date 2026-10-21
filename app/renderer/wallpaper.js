'use strict';
// Музыкальные обои: получает спектр и данные трека из основного окна, рисует визуал на рабочем столе.
const $ = (id) => document.getElementById(id);
const fmt = (s) => { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
let fr = { f: null, p: false, b: 0, t: null, sr: 48000 }, frAt = 0, meta = { cfg: {} }, metaAt = 0, lastArt = '', last = 0, beat = 0, bass = 0, img = null;
Viz.init($('cv'));
pulse.wall.onFrame((d) => { fr = d; frAt = performance.now(); });
pulse.wall.onMeta((m) => { meta = m || meta; metaAt = performance.now(); applyMeta(); });
function applyMeta() {
  const c = meta.cfg || {}, r = document.documentElement.style;
  if (meta.pal) { Viz.setPalette(meta.pal); meta.pal.forEach((p, i) => r.setProperty(`--a${i + 1}`, p.map((x) => x | 0).join(','))); }
  const bg = $('bg');
  bg.classList.toggle('blur', c.bg === 'cover');
  if (c.bg === 'cover' && meta.art) { if (meta.art !== lastArt) { lastArt = meta.art; bg.style.background = ''; bg.style.backgroundImage = `url("${meta.art}")`; bg.style.backgroundSize = 'cover'; bg.style.backgroundPosition = 'center'; } }
  else { lastArt = ''; bg.style.backgroundImage = ''; bg.style.background = c.bg === 'accent' ? 'radial-gradient(circle at 30% 30%,rgba(var(--a1),.5),rgba(var(--a2),.22) 45%,#050508 80%)' : c.bg === 'black' ? '#000' : 'radial-gradient(circle at 50% 40%,#15121f,#050408 75%)'; }
  $('dim').style.opacity = ((c.dim ?? 35) / 100).toFixed(2);
  $('cv').style.transform = `scale(${(c.scale || 100) / 100})`; camBase = (c.scale || 100) / 100;
  const card = $('card'); card.className = `card ${c.infoPos || 'bl'} ${c.info && meta.has ? '' : 'hide'} ${c.controls ? 'ctl-on' : ''}`;
  const ip = meta.playing ? '<path d="M6 5h4v14H6zm8 0h4v14h-4z"/>' : '<path d="M8 5v14l11-7z"/>'; if ($('icoPlay').innerHTML !== ip) $('icoPlay').innerHTML = ip; const xyS = (el, xy, sc) => { if (xy) { el.style.left = xy[0] * 100 + '%'; el.style.top = xy[1] * 100 + '%'; el.style.right = el.style.bottom = 'auto'; el.style.transform = `translate(-50%,-50%) scale(${sc})`; el.style.zoom = ''; } else { el.style.left = el.style.top = el.style.right = el.style.bottom = el.style.transform = ''; } };
  // 1.9.1: карточку и часы можно перетащить мышью в редакторе — тогда они стоят в своей точке
  if (c.infoXY) { card.className = card.className.replace(/\b(tl|tr|bl|br|c)\b/, 'free'); xyS(card, c.infoXY, ((c.infoSize || 100) / 100).toFixed(2)); } else { xyS(card, null); card.style.zoom = ((c.infoSize || 100) / 100).toFixed(2); }
  $('prog').style.display = c.progress === false ? 'none' : '';
  if ($('t').textContent !== meta.title) $('t').textContent = meta.title || '';
  if ($('a').textContent !== meta.author) $('a').textContent = meta.author || '';
  const ab = meta.art ? `url("${meta.art}")` : ''; if ($('art').style.backgroundImage !== ab) $('art').style.backgroundImage = ab;
  const ly = $('ly'); ly.classList.toggle('hide', !c.lyrics || !meta.line); if (meta.line && ly.textContent !== meta.line) { ly.textContent = ''; const sp = document.createElement('span'); sp.textContent = meta.line; ly.appendChild(sp); }
  $('clock').classList.toggle('hide', !c.clock); $('clock').classList.toggle('bot', c.clockPos === 'bottom'); if (c.clockXY) xyS($('clock'), c.clockXY, ((c.clockSize || 100) / 100).toFixed(2)); else { xyS($('clock'), null); $('clock').style.zoom = ((c.clockSize || 100) / 100).toFixed(2); }
  // 2.0: стиль карточки, скругление, форма обложки, шрифты, часы, подложки
  card.classList.add(...WallStyle.cardClass(c).split(' '));
  card.style.background = WallStyle.cardBg(c); card.style.borderRadius = (c.cardRadius ?? 26) + 'px'; card.style.fontFamily = WallStyle.font(c.cardFont);
  $('bLike').style.display = c.likeBtn === false ? 'none' : ''; $('bLike').classList.toggle('on', !!meta.liked);
  const lh = meta.liked ? WallStyle.HEART : WallStyle.HEART_O; if ($('icoLike').innerHTML !== lh) $('icoLike').innerHTML = lh;
  const ck = $('clock'); ck.classList.remove(...[...ck.classList].filter((x) => /^(cs|pl)-/.test(x))); ck.classList.add(...WallStyle.clockClass(c).split(' '));
  ck.style.fontFamily = WallStyle.font(c.clockFont); ck.style.color = c.clockColor || ''; ck.style.background = WallStyle.clockBg(c); clock(true);
  ly.style.fontFamily = WallStyle.font(c.lyFont); ly.style.fontWeight = c.lyWeight || 800;
  ly.style.fontSize = `calc(clamp(22px,2.6vw,44px) * ${((c.lySize || 100) / 100).toFixed(2)})`; ly.style.color = c.lyColor || '';
  ly.classList.toggle('plate', !!c.lyPlate); ly.classList.toggle('noglow', c.lyGlow === false);
  layoutLy(); avoidClock();
}
// строка текста не налезает на карточку трека: сдвигается вбок или под/над карточку
function layoutLy() {
  const c = meta.cfg || {}, ly = $('ly'), card = $('card'), W = innerWidth, H = innerHeight;
  ly.className = `ly ${c.lyPos || 'bottom'} ${ly.classList.contains('hide') ? 'hide' : ''} ${c.lyPlate ? 'plate' : ''} ${c.lyGlow === false ? 'noglow' : ''}`;
  ly.style.left = ly.style.right = ly.style.top = ly.style.bottom = ly.style.transform = ''; ly.style.textAlign = '';
  ly.style.whiteSpace = ly.style.maxWidth = '';
  if (c.lyXY) { ly.style.left = c.lyXY[0] * 100 + '%'; ly.style.top = c.lyXY[1] * 100 + '%'; ly.style.right = ly.style.bottom = 'auto'; ly.style.transform = 'translate(-50%,-50%)'; ly.style.maxWidth = '90vw'; ly.style.width = 'max-content'; return; }
  ly.style.width = '';
  if (ly.classList.contains('hide') || card.classList.contains('hide')) return;
  const a = card.getBoundingClientRect(), b = ly.getBoundingClientRect(), gap = Math.max(24, W * 0.025);
  if (b.bottom < a.top - 8 || b.top > a.bottom + 8) return avoidClock();
  if ((c.infoPos || 'bl') === 'c') { if (a.bottom + gap + b.height < H * 0.95) { ly.style.top = a.bottom + gap + 'px'; ly.style.bottom = 'auto'; ly.style.transform = 'none'; } else { ly.style.top = 'auto'; ly.style.bottom = H - a.top + gap + 'px'; ly.style.transform = 'none'; } return; }
  if (a.left + a.width / 2 < W / 2) { ly.style.left = a.right + gap + 'px'; ly.style.right = W * 0.04 + 'px'; ly.style.textAlign = 'left'; }
  else { ly.style.right = W - a.left + gap + 'px'; ly.style.left = W * 0.04 + 'px'; ly.style.textAlign = 'right'; }
}
// 2.0: высокие часы (столбиком, со стрелками, с подложкой) тоже не перекрывают строку
function avoidClock() {
  const ly = $('ly'), ck = $('clock'); if (ly.classList.contains('hide') || ck.classList.contains('hide') || (meta.cfg || {}).lyXY) return;
  const a = ck.getBoundingClientRect(), b = ly.getBoundingClientRect(), gap = 18; if (b.bottom < a.top - 4 || b.top > a.bottom + 4) return;
  if (a.top > innerHeight / 2) { ly.style.top = 'auto'; ly.style.bottom = innerHeight - a.top + gap + 'px'; ly.style.transform = 'none'; } else { ly.style.bottom = 'auto'; ly.style.top = a.bottom + gap + 'px'; ly.style.transform = 'none'; }
}
addEventListener('resize', layoutLy);
// клики по рабочему столу: Pulse ловит их в основном процессе и присылает сюда координаты
let hovEl = null;
pulse.wall.onPointer && pulse.wall.onPointer((p) => {
  const c = meta.cfg || {};
  const el = p.t === 'L' || !c.controls || !c.info ? null : document.elementFromPoint(p.x, p.y);
  const act = el && el.closest('[data-act]');
  if (act !== hovEl) { if (hovEl) hovEl.classList.remove('hov'); hovEl = act; if (act) act.classList.add('hov'); }
  if (p.t !== 'C' || !act) return;
  act.classList.add('press'); setTimeout(() => act.classList.remove('press'), 140);
  const n = act.dataset.act;
  if (n === 'seek') { const r = act.getBoundingClientRect(); pulse.wall.act('seek', (p.x - r.left) / r.width); }
  else { pulse.wall.act(n); if (n === 'toggle') { meta.playing = !meta.playing; applyMeta(); } if (n === 'like') { meta.liked = !meta.liked; applyMeta(); } }
});
let clockHtml = '';
function clock() { const h = WallStyle.clockHtml(meta.cfg || {}, new Date()); if (h !== clockHtml) { clockHtml = h; $('clock').innerHTML = h; } }
setInterval(clock, 1000); clock();
// прогресс трека: экстраполируем между сообщениями — полоса движется плавно
setInterval(() => {
  if (!meta.has) return; const cur = Math.min(meta.dur || 0, (meta.cur || 0) + (meta.playing ? (performance.now() - metaAt) / 1000 : 0));
  $('fill').style.width = meta.dur ? (cur / meta.dur) * 100 + '%' : '0'; const a = fmt(cur), b = fmt(meta.dur); if ($('tc').textContent !== a) $('tc').textContent = a; if ($('td').textContent !== b) $('td').textContent = b;
}, 250);
// 1.9.4: «Камера» — визуал медленно плывёт, наклоняется и приближается (как пролёт камеры)
let camBase = 1, camT = 0, camLast = 0;
function camera(now, c) {
  const m = c.motion || 'off', cv = $('cv'); if (m === 'off') { if (camLast) { cv.style.transform = `scale(${camBase})`; camLast = 0; } return; }
  const dt = camLast ? Math.min(0.1, (now - camLast) / 1000) : 0; camLast = now; camT += dt * ((+c.motionSpeed || 100) / 100) * (1 + beat * 0.6);
  const t = camT, b = camBase, k = beat * 0.02;
  if (m === 'drift') cv.style.transform = `translate(${(Math.sin(t * 0.11) * 2.2).toFixed(2)}%,${(Math.cos(t * 0.083) * 1.6).toFixed(2)}%) scale(${(b * (1.07 + Math.sin(t * 0.05) * 0.03 + k)).toFixed(4)}) rotate(${(Math.sin(t * 0.04) * 1.2).toFixed(2)}deg)`;
  else if (m === 'orbit') cv.style.transform = `perspective(1100px) rotateX(${(14 + Math.sin(t * 0.07) * 9).toFixed(2)}deg) rotateY(${(Math.sin(t * 0.05) * 16).toFixed(2)}deg) scale(${(b * (1.18 + k)).toFixed(4)})`;
  else if (m === 'dolly') cv.style.transform = `scale(${(b * (1.1 + Math.sin(t * 0.09) * 0.1 + k * 2)).toFixed(4)}) rotate(${(Math.sin(t * 0.03) * 3).toFixed(2)}deg)`;
}
function loop(now) {
  requestAnimationFrame(loop);
  const c = meta.cfg || {}, fps = Math.max(10, Math.min(60, +c.fps || 30));
  if (now - last < 1000 / fps - 2) return; last = now;
  const live = fr.p && now - frAt < 1500, idle = c.idle || 'calm';
  if (!live && idle === 'freeze') return;
  if (!live && idle === 'black') { Viz.draw({ mode: 'video' }); return; }
  // бит из баса (основное окно может быть свёрнуто — считаем сами)
  if (fr.f) { const hz = (fr.sr || 48000) / 2 / fr.f.length; let b = 0, n = 0; for (let i = Math.max(1, Math.floor(40 / hz)); i <= Math.ceil(150 / hz); i++) { b += fr.f[i]; n++; } b = b / (n * 255); if (b - bass > 0.07) beat = Math.max(beat, Math.min(1, b * 1.15)); bass = b * 0.35 + bass * 0.65; }
  beat = Math.max(beat * 0.9, live ? fr.b * 0.8 : 0);
  const T = fr.t && live ? { bpm: fr.t.bpm, pos: fr.t.pos + (now - frAt) / 1000 * (fr.t.bpm / 60), conf: fr.t.conf } : { bpm: 80, pos: now / 750, conf: 0 };
  const fx = Object.assign({}, meta.fx || {}, c.glow === false ? { glow: 0 } : {}, { trails: 0, mirror: (meta.fx && meta.fx.mirror) || 'off' });
  camera(now, c);
  try { Viz.draw({ quality: 'auto', sens: (meta.sens || 100) / 100, freq: live ? fr.f : null, beat, playing: live || idle === 'calm', mode: 'visual', style: c.style, artRect: null, tempo: T, sr: fr.sr, fx }); } catch (e) { console.error(e); }
}
requestAnimationFrame(loop);
