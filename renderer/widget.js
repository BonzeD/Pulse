// 1.9.1: в настройках виджет показывается «вживую» во фрейме (?pv=1) — данные и правки приходят из окна Pulse
const PV = /[?&]pv=1/.test(location.search);
if (PV && window.parent !== window && window.parent.pvWidgetApi) window.pulse = window.parent.pvWidgetApi(window);
const $ = (id) => document.getElementById(id);
const fmt = (s) => { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let st = {}, last, lastId, cfg = { size: 'standard', lyrics: true, theme: 'glass' }, ly = null, li = -9, lw = -9;
const SIZES = ['mini', 'standard', 'large'];
pulse.onState((s) => { st = s; last = Date.now(); render(); });
// 1.9.2: одинаковый конфиг (палитра, повторные пуши) не пересобирает раскладку заново
let cfgKey = '';
if (pulse.onWidgetVisibility) pulse.onWidgetVisibility(v => { if(v) window.PulseMotion?.enter($('w')); else window.PulseMotion?.stop(); });
pulse.onWidgetConfig((c) => { const k = JSON.stringify(c); if (k === cfgKey) return; cfgKey = k; cfg = c; applyCfg(); });
if (pulse.onLyrics) pulse.onLyrics((l) => { ly = l && l.lines && l.lines.length ? l : null; li = lw = -9; frame(); });
function applyCfg() {
  // 1.9: больше настроек — что показывать, скругление, размытие, закрепление, бегущая строка
  const off = (k) => cfg[k] === false;
  document.body.className = (window.pvEdit ? 'edit ' : '') + `size-${cfg.size || 'standard'} theme-${cfg.theme || 'glass'}` + (cfg.lyrics === false ? ' nolyr' : '') + (st.playing ? ' playing' : '')
    + (off('cover') ? ' no-cover' : '') + (off('progress') ? ' no-prog' : '') + (off('time') ? ' no-time' : '') + (off('extra') ? ' no-extra' : '') + (off('vol') ? ' no-vol' : '') + (off('eq') ? ' no-eq' : '')
    + (cfg.motion === false ? ' no-anim' : '') + (cfg.lock ? ' locked' : '') + (cfg.marquee ? ' marquee' : '') + (cfg.hideIdle ? ' dim-idle' : '') + (cfg.align === 'center' ? ' al-center' : '');
  const r = document.documentElement.style;
  const safe=(v,f)=>/^#[0-9a-f]{6}$/i.test(v||'')?v:f;
  r.setProperty('--wp-panel',safe(cfg.appPanel,'#141418'));r.setProperty('--wp-bg',safe(cfg.appBg,'#09090c'));r.setProperty('--wp-text',safe(cfg.appText,'#ffffff'));
  r.setProperty('--r', (cfg.radius ?? 22) + 'px'); r.setProperty('--wblur', (cfg.blur ?? 34) + 'px');
  layout(r);
  if (cfg.accent) { r.setProperty('--ac', cfg.accent); r.setProperty('--ac2', cfg.accent2 || '#8b3dff'); r.setProperty('--ac3', cfg.accent3 || '#00e5ff'); }
  li = lw = -9; render(); marq();
}
// раскладка из редактора: порядок строк, сторона обложки, порядок и видимость кнопок, размеры и цвета элементов
const CTL_KEYS = ['like', 'dislike', 'shuffle', 'prev', 'play', 'next', 'repeat', 'vol'];
function layout(r) {
  const size = cfg.size || 'standard', right = cfg.coverSide === 'right', noC = cfg.cover === false, noL = cfg.lyrics === false;
  // 1.9.2: порядок не выбрасывается целиком, если в новой версии добавилась кнопка/строка — недостающие дописываются в конец
  const ok = (a, def) => { if (!Array.isArray(a)) return def; const r = a.filter((x, i) => def.includes(x) && a.indexOf(x) === i); def.forEach((x) => { if (!r.includes(x)) r.push(x); }); return r; };
  const pair = (a, b) => (noC ? b : right ? `${b} ${a}` : `${a} ${b}`);
  const cs = Math.max(0.6, Math.min(1.5, (cfg.coverSize || 100) / 100)); let t = '';
  if (size === 'mini') {
    const o = ok(cfg.rowsMini, ['info', 'ctl']); const ar = noC ? o : right ? [...o, 'cover'] : ['cover', ...o];
    t = `"${ar.join(' ')}" 1fr / ${ar.map((x) => (x === 'cover' ? Math.round(52 * cs) + 'px' : x === 'info' ? 'minmax(0,1fr)' : 'auto')).join(' ')}`;
  } else if (size === 'large') {
    const o = ok(cfg.rowsLarge, ['lyr', 'prog', 'ctl']).filter((x) => !(noL && x === 'lyr'));
    const hc = noL ? 140 : 76, head = noC ? '"info info"' : `"${pair('cover', 'info')}"`;
    t = `${head} ${noL ? '1fr' : Math.round(hc * cs) + 'px'} ${o.map((x) => `"${x} ${x}" ${x === 'lyr' ? '1fr' : 'auto'}`).join(' ')} / ${noC ? '1fr 1fr' : right ? `1fr ${Math.round(hc * cs)}px` : `${Math.round(hc * cs)}px 1fr`}`;
  } else {
    const o = ok(cfg.rowsStd, ['info', 'ctl', 'prog']);
    t = `${o.map((x) => `"${pair('cover', x)}" auto`).join(' ')} / ${noC ? '1fr' : right ? `minmax(0,1fr) ${Math.round((cfg.theme === 'neon' ? 108 : 80) * cs)}px` : `${Math.round((cfg.theme === 'neon' ? 108 : 80) * cs)}px minmax(0,1fr)`}`;
  }
  $('w').style.gridTemplate = t;
  // 2.0.4: «Не нравится» встаёт рядом с лайком (у старых раскладок кнопки ещё нет)
  const ord = ok(Array.isArray(cfg.ctlOrder) && !cfg.ctlOrder.includes('dislike') ? cfg.ctlOrder.flatMap((x) => (x === 'like' ? ['like', 'dislike'] : [x])) : cfg.ctlOrder, CTL_KEYS), hide = Array.isArray(cfg.hideBtns) ? cfg.hideBtns : [];
  document.querySelectorAll('.ctl [data-k]').forEach((b) => { b.style.order = ord.indexOf(b.dataset.k); b.classList.toggle('hid', hide.includes(b.dataset.k)); });
  const set = (k, v) => (v === '' || v == null ? r.removeProperty(k) : r.setProperty(k, v));
  set('--tS', (cfg.tSize || 100) / 100); set('--aS', (cfg.aSize || 100) / 100); set('--lS', (cfg.lSize || 100) / 100); set('--ctlS', (cfg.ctlScale || 100) / 100);
  set('--tC', cfg.tColor); set('--aC', cfg.aColor); set('--lC', cfg.lColor); set('--icC', cfg.iconColor); set('--plC', cfg.playColor); set('--pC', cfg.progColor); set('--bgC', cfg.bgColor);
  set('--tW', cfg.tWeight || 700); set('--pH', (cfg.progH || 4) + 'px'); set('--cs', cs);
  set('--wfont', { mono: 'Consolas,"Cascadia Mono",monospace', serif: 'Georgia,"Times New Roman",serif', rounded: '"Segoe UI Variable Display","Nunito","Segoe UI",sans-serif', wide: '"Bahnschrift","Segoe UI",sans-serif' }[cfg.font] || '');
  const b = document.body.classList;
  b.toggle('cv-right', right); b.toggle('shape-' + (cfg.coverShape || 'round'), true); ['square', 'round', 'circle'].forEach((x) => x !== (cfg.coverShape || 'round') && b.remove('shape-' + x));
  b.toggle('spin', !!cfg.coverSpin); b.toggle('no-border', cfg.border === false); b.toggle('no-shadow', cfg.shadow === false);
  ['white', 'grad', 'solid', 'ring', 'flat'].forEach((x) => b.toggle('play-' + x, (cfg.playStyle || 'white') === x)); // 2.0: новый стиль «Белая» по умолчанию
  b.toggle('pc-solid', !!cfg.progColor);
  if (PV) b.add('pv');
  // 1.9.3: каждый элемент можно сдвинуть, увеличить/уменьшить и скрыть отдельно (cfg.free[размер][элемент] = { x, y, s, h })
  const fr = curFree();
  for (const k in EL) { const el = document.querySelector(EL[k]); if (el) applyFree(el, fr[k]); }
  requestAnimationFrame(clampAll);
}
// элементы виджета, которые можно двигать по отдельности (и их «родительские» блоки)
const EL = { cover: '#cover', info: '.info', t: '#t', a: '#a', ll: '#ll', lyr: '#lyr', ctl: '.ctl', like: '#like', dislike: '#dislike', shuffle: '#shuffle', prev: '#prev', play: '#play', next: '#next', repeat: '#repeat', vol: '#vol', prog: '.prog', bar: '#bar', tc: '#tc', td: '#td' };
const BLK = { cover: '#cover', info: '.info', ctl: '.ctl', prog: '.prog', lyr: '.lyr' };
function curFree() {
  const s = cfg.size || 'standard', f = cfg.free && typeof cfg.free === 'object' ? cfg.free : {}, m = f[s] && typeof f[s] === 'object' ? { ...f[s] } : {};
  // старые сдвиги блоков (1.9.1 — плоские, 1.9.2 — по размерам)
  const a = cfg.off && typeof cfg.off === 'object' ? cfg.off : {}, o = Object.keys(BLK).some((k) => Array.isArray(a[k])) ? a : a[s] && typeof a[s] === 'object' ? a[s] : {};
  for (const k in o) if (Array.isArray(o[k]) && !m[k]) m[k] = { x: o[k][0], y: o[k][1] };
  return m;
}
// у .ctl есть CSS zoom (размер кнопок): сдвиг внутри него масштабируется — храним «экранные» px и делим на итоговый zoom
const zOf = (el) => el.currentCSSZoom || parseFloat(getComputedStyle(el).zoom) || 1;
function applyFree(el, v) {
  v = v || {}; const z = zOf(el), moved = !!(v.x || v.y), sc = v.s && v.s !== 100;
  el.style.translate = moved ? `${(v.x || 0) / z}px ${(v.y || 0) / z}px` : '';
  el.style.scale = sc ? String(v.s / 100) : '';
  el.style.zIndex = moved || sc ? 4 : '';
  el.classList.toggle('fh', !!v.h);
}
// допустимый сдвиг: элемент не может уехать за край виджета
function offLimits(el) {
  const prev = el.style.translate; el.style.translate = '';
  const W = $('w').getBoundingClientRect(), r = el.getBoundingClientRect(); el.style.translate = prev;
  const m = 2, mk = (lo, hi) => (lo > hi ? [0, 0] : [lo, hi]);
  return { x: mk(W.left + m - r.left, W.right - m - r.right), y: mk(W.top + m - r.top, W.bottom - m - r.bottom), cx: W.left + W.width / 2 - (r.left + r.width / 2), cy: W.top + W.height / 2 - (r.top + r.height / 2) };
}
const clampV = (v, [lo, hi]) => Math.max(Math.min(lo, 0), Math.min(Math.max(hi, 0), v));
function clampAll() { // после смены размера/масштаба сдвинутый элемент мягко возвращается в границы (только визуально)
  const fr = curFree();
  for (const k in fr) { const v = fr[k], el = document.querySelector(EL[k] || '#none'); if (!el || !v || !(v.x || v.y) || el.offsetParent === null) continue; const L = offLimits(el); applyFree(el, { ...v, x: clampV(v.x || 0, L.x), y: clampV(v.y || 0, L.y) }); }
}
function render() {
  document.body.classList.toggle('playing', !!st.playing);
  const nt = st.has ? st.title : 'Pulse'; if ($('t').textContent !== nt) { $('t').textContent = nt; marq(); }
  const mini = cfg.size === 'mini', lyr = cfg.lyrics !== false;
  $('a').textContent = st.has ? (mini && lyr && st.line ? `♪ ${st.line}` : st.author) : PulseI18n.t('Ничего не играет');
  $('a').classList.toggle('lyric', mini && lyr && !!st.line);
  $('ico').innerHTML = st.playing ? '<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>' : '<path d="M8 5v14l11-7z"/>';
  $('shuffle').classList.toggle('on', !!st.shuffle);
  $('repeat').classList.toggle('on', st.repeat && st.repeat !== 'off');
  $('repeat').classList.toggle('one', st.repeat === 'one');
  $('like').classList.toggle('on', !!st.liked);
  $('dislike').classList.toggle('on', !!st.disliked); // 2.0.4
  $('vfill').style.width = (st.volume ?? 80) + '%';
  if (!st.has) { lastId = null; $('cover').style.backgroundImage = ''; $('bg').style.backgroundImage = ''; }
  if (st.has && st.id && (st.id + '|' + (st.art || '')) !== lastId) {
    lastId = st.id + '|' + (st.art || '');
    const big = st.art || (st.offline ? `/offline/${st.id}.jpg` : `https://i.ytimg.com/vi/${st.id}/hqdefault.jpg`);
    $('cover').style.backgroundImage = `url("${big}")`;
    $('cover').style.backgroundSize = st.art ? 'cover' : 'auto 134%';
    $('bg').style.backgroundImage = `url("${big}")`;
  }
  if (!ly || ly.id !== st.id) { $('ll').textContent = st.line ? '♪ ' + st.line : ''; if (cfg.size === 'large') { $('lp').textContent = ''; $('ln').textContent = ''; $('lc').innerHTML = st.has ? `<span class="none">${st.line ? esc(st.line) : '♪'}</span>` : ''; } }
}
const now = () => (st.cur || 0) + (st.playing && last ? (Date.now() - last) / 1000 : 0);
function lineHtml(L, w) {
  if (!L) return '';
  if (L.gap) return '<span class="none">• • •</span>';
  if (!L.words || !L.words.length) return `<span class="${w >= 0 ? 'k' : ''}">${esc(L.text)}</span>`;
  return L.words.map((x, k) => `<span class="${k <= w ? 'k' : ''}">${esc(x.s)}</span>`).join('');
}
function frame() {
  if (!ly || ly.id !== st.id || cfg.lyrics === false) return;
  const t = now() - (st.off || 0), L = ly.lines;
  let i = -1; for (let k = 0; k < L.length; k++) { if (L[k].t <= t + 0.08) i = k; else break; }
  const cur = L[i]; let w = -1;
  if (cur && cur.words) for (let k = 0; k < cur.words.length; k++) if (cur.words[k].t <= t + 0.03) w = k;
  if (i === li && w === lw) return;
  li = i; lw = w;
  const txt = (x) => (x && !x.gap ? x.text : '');
  if (cfg.size === 'large') {
    $('lp').textContent = txt(L[i - 1]);
    $('lc').innerHTML = i < 0 ? `<span class="none">${esc(txt(L[0]) ? '♪' : '')}</span>` : lineHtml(cur, w);
    $('ln').textContent = txt(L[i + 1]) || (L[i + 1] && L[i + 2] ? txt(L[i + 2]) : '');
  } else $('ll').innerHTML = cur && !cur.gap ? '♪ ' + lineHtml(cur, w) : '';
}
const setTxt = (id, v) => { const e = $(id); if (e.textContent !== v) e.textContent = v; };
let lastW = '';
// 2.0.12: «тихий режим для игр». Виджет — прозрачное окно поверх всех окон: каждая его перерисовка заставляет Windows
// заново смешивать его с игрой. Когда мышь не над виджетом, анимации (эквалайзер, вращение, бегущая строка) на паузе,
// а полоска и время обновляются раз в секунду, а не 12 раз. Наведи мышь — всё оживает.
let calm = false, calmT = 0, calmN = 0;
const calmSet = (v) => { calm = !!v && cfg.calm !== false && !PV; document.documentElement.classList.toggle('calm', calm); };
const calmWake = (ms) => { calmSet(false); clearTimeout(calmT); calmT = setTimeout(() => calmSet(true), ms || 4000); };
document.addEventListener('pointermove', () => calmWake(4000), { passive: true });
document.addEventListener('pointerleave', () => calmWake(1200));
calmWake(6000);
setInterval(() => {
  if (document.hidden) return;
  if (calm && ++calmN % 12) { frame(); return; }
  const c = now(), w = st.dur ? Math.min(100, (c / st.dur) * 100).toFixed(2) + '%' : '0';
  if (w !== lastW) { lastW = w; $('fill').style.width = w; }
  setTxt('tc', fmt(c)); setTxt('td', st.dur ? fmt(st.dur) : '0:00');
  frame();
}, 80);
// бегущая строка для длинных названий
function marq() { const t = $('t'); t.classList.remove('run'); if (!cfg.marquee) return; requestAnimationFrame(() => { if (t.scrollWidth > t.clientWidth + 4) { t.style.setProperty('--mq', -(t.scrollWidth - t.clientWidth + 12) + 'px'); t.classList.add('run'); } }); }
$('play').onclick = () => pulse.command('toggle');
$('next').onclick = () => pulse.command('next');
$('prev').onclick = () => pulse.command('prev');
$('shuffle').onclick = () => pulse.command('shuffle');
$('repeat').onclick = () => pulse.command('repeat');
$('like').onclick = () => pulse.command('like');
$('dislike').onclick = () => pulse.command('dislike'); // 2.0.4: дизлайк — трек сразу пропускается
$('open').onclick = () => pulse.win('open');
$('edit').onclick = () => pulse.win('edit-widget');
$('hide').onclick = () => pulse.win('widget-hide');
$('size').onclick = () => { const n = SIZES[(SIZES.indexOf(cfg.size) + 1) % SIZES.length]; pulse.command('widgetSize', n); };
$('cover').ondblclick = () => pulse.win('open');
$('bar').onclick = (e) => { const r = $('bar').getBoundingClientRect(); pulse.command('seek', (e.clientX - r.left) / r.width); };
$('vbar').onclick = (e) => { const r = $('vbar').getBoundingClientRect(); const v = Math.round(((e.clientX - r.left) / r.width) * 100); st.volume = v; render(); pulse.command('volume', v); };
window.addEventListener('wheel', (e) => { const v = Math.max(0, Math.min(100, (st.volume ?? 80) + (e.deltaY < 0 ? 5 : -5))); st.volume = v; render(); pulse.command('volume', v); });
window.addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); pulse.command('toggle'); } if (e.code === 'ArrowRight') pulse.command('next'); if (e.code === 'ArrowLeft') pulse.command('prev'); });

// ---------- режим предпросмотра в настройках ----------
// 1.9.3: мышь обрабатывает окно Pulse (прозрачный слой поверх фрейма), фрейм только рисует и отвечает на вопросы.
// Раньше перетаскивание жило внутри фрейма и в Electron не срабатывало.
if (PV) {
  ['click', 'dblclick', 'wheel', 'keydown', 'pointerdown', 'mousedown'].forEach((ev) => document.addEventListener(ev, (e) => { e.preventDefault(); e.stopImmediatePropagation(); }, { capture: true, passive: false }));
  const q = (k) => (EL[k] ? document.querySelector(EL[k]) : null);
  const vis = (el) => el && el.offsetParent !== null && getComputedStyle(el).display !== 'none';
  window.pvApi = {
    hit(x, y) {
      let el = document.elementFromPoint(x, y);
      while (el && el !== document.body) { for (const k in EL) if (el.matches(EL[k])) return k; el = el.parentElement; }
      return 'bg';
    },
    get: (k) => ({ ...(curFree()[k] || {}) }),
    limits: (k) => { const el = q(k); return el && vis(el) ? offLimits(el) : null; },
    live(k, v) { const el = q(k); if (el) applyFree(el, { ...(curFree()[k] || {}), ...v }); },
    mark(sel, hov) {
      document.querySelectorAll('.ed-on,.ed-hov').forEach((x) => x.classList.remove('ed-on', 'ed-hov'));
      document.body.classList.toggle('ed-bg', sel === 'bg');
      const a = q(sel), b = hov && hov !== sel ? q(hov) : null; if (a) a.classList.add('ed-on'); if (b) b.classList.add('ed-hov');
    },
    guides(x, y) { document.body.classList.toggle('snap-c', !!x); document.body.classList.toggle('snap-m', !!y); },
    setEdit(on) { window.pvEdit = !!on; document.body.classList.toggle('edit', !!on); },
    shown: (k) => vis(q(k))
  };
}

window.addEventListener('pulse-language',()=>{ if(document.getElementById('a'))render(); });
