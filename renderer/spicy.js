'use strict';
// 2.0.4: режим «Spicy Lyrics» для «Только текст». Своя реализация в стиле расширения Spicy Lyrics
// (github.com/Spikerko/spicy-lyrics, AGPL-3.0): слоги заливаются градиентом, активный слог чуть растёт и светится,
// дальние строки размыты, фон — медленно вращающаяся размытая обложка.
// Текст: официальный developer API с ключом проекта Pulse; обычные источники остаются запасными.
const spS = () => S().spicy;
const SP = { on: false, idle: false, raf: 0, lines: null, src: '', tid: null, from: null, els: [], cur: -1, act: [], manual: 0, scroll: 0, req: 0, srcLines: null, err: '' };
const spClamp = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const spEase = (x) => 1 - Math.pow(1 - x, 3);
// 2.0.4: у строки только построчное время (слова Pulse лишь оценил) — заливаем строку целиком, как Spicy для Line-синхронизации
// 2.0.9: «Импровизация» — строки только с таймингом строк снова разбиваются на угаданные слова (как в 2.0.1–2.0.3), по выбору пользователя
function spImprov(L) { return !!(L && (S().ly || {}).lineFx === 'improv' && L.words && L.words.length > 1 && !L.words[0].line); }
function spLineOnly(L) { return !!(L && !L.gap && !L.user && (L.est || lyState.kind === 'synced' || lyState.kind === 'auto') && !spImprov(L)); }
window.spImprov = spImprov;
window.spLineOnly = spLineOnly;
// конец строки: начало следующей (у построчного LRC нет своего конца; оценка Pulse короче и заливка «убегала» вперёд), не дольше 10 с
const spLineEnd = (L, nx) => { const e = L.end || (L.words && L.words.length ? L.words[L.words.length - 1].e : 0) || L.t + 4; return Math.max(L.t + 0.6, nx ? Math.min(nx.t, L.t + 10) : e); };
// прогресс строки 0…1 → градиент под углом 160° (сверху вниз с уклоном вправо)
const spLp = (L, nx, T) => spClamp((T - L.t) / Math.max(0.3, spLineEnd(L, nx) - L.t));
// один большой косой градиент на весь блок строки: каждое слово показывает «свой кусок» (размер и сдвиг фона = размер блока
// и место слова в нём). background-clip:text у родителя не работает, если у слов свои слои (анимации, will-change)
function spLnPrep(box, spans) {
  if (!box || !spans.length) return; const n = (box._lnN = (box._lnN || 0) + 1);
  const W = box.offsetWidth, H = box.offsetHeight, key = W + 'x' + H + '|' + spans.length;
  if (box._lnK === key && n % 20) return; box._lnK = key;
  if (W && H) box.style.setProperty('--bw', W + 'px'), box.style.setProperty('--bh', H + 'px');
  for (const sp of spans) {
    let x = 0, y = 0, e = sp; while (e && e !== box) { x += e.offsetLeft; y += e.offsetTop; const op = e.offsetParent; if (!op || !box.contains(op) && op !== box) { const a = sp.getBoundingClientRect(), b = box.getBoundingClientRect(); x = a.left - b.left; y = a.top - b.top; break; } e = op; }
    const k = Math.round(x) + ',' + Math.round(y); if (sp._lnXY !== k) { sp._lnXY = k; sp.style.setProperty('--bx', -Math.round(x) + 'px'); sp.style.setProperty('--by', -Math.round(y) + 'px'); }
  }
}
function spLnClear(box) { if (!box) return; box.classList.remove('lnfill'); ['--lp', '--bw', '--bh'].forEach((v) => box.style.removeProperty(v)); box._lnK = null; box.querySelectorAll('.w,.lw').forEach((sp) => { sp.style.removeProperty('--bx'); sp.style.removeProperty('--by'); sp._lnXY = null; }); }

// ---------- данные ----------
function spFromApi(b) {
  if (!b || !b.Type) return null;
  if (b.Type === 'Static') return { stat: true, lines: (b.Lines || []).map((l) => ({ text: l.Text || '' })).filter((l) => l.text.trim()) };
  let mx = 0; const scan = (o) => { if (o && +o.EndTime > mx) mx = +o.EndTime; }; (b.Content || []).forEach((c) => { scan(c); scan(c.Lead); });
  const k = mx > 3000 ? 1000 : 1; // секунды; на всякий случай понимаем и миллисекунды
  const syl = (arr) => (arr || []).map((s) => ({ t: +s.StartTime / k, e: +s.EndTime / k, s: String(s.Text || ''), part: !!s.IsPartOfWord })).filter((s) => s.s);
  const out = [];
  for (const c of b.Content || []) {
    if (b.Type === 'Line') { if (!c.Text) continue; const t = +c.StartTime / k, e = +c.EndTime / k; out.push({ t, end: e, words: [{ t, e, s: c.Text, line: true }], opp: !!c.OppositeAligned }); continue; }
    const L = c.Lead || c; const w = syl(L.Syllables); if (!w.length) continue;
    const bg = (c.Background || []).map((x) => syl(x.Syllables)).filter((x) => x.length);
    const t = Math.min(w[0].t, ...bg.map((x) => x[0].t)), end = Math.max(w[w.length - 1].e, ...bg.map((x) => x[x.length - 1].e));
    out.push({ t, end, words: w, bg, opp: !!c.OppositeAligned });
  }
  out.sort((a, b2) => a.t - b2.t);
  return out.length ? { lines: out, attr: b.source || '' } : null;
}
function spFromPulse(lines) {
  if (!lines) return null;
  const src = lines.filter((l) => !l.gap && (l.text || (l.words && l.words.length)));
  const out = src.map((L, i) => {
    const nx = src[i + 1] ? src[i + 1].t : L.t + 5;
    const all = (L.words && L.words.length ? L.words : [{ t: L.t, e: Math.min(nx, L.t + 4), s: L.text }]).map((w, j, a) => ({ ...w, e: w.e != null ? w.e : a[j + 1] ? a[j + 1].t : Math.min(nx, w.t + 0.6) }));
    // 2.0.4: слова из Spicy Lyrics раскладываем обратно на слоги, бэк-вокал — отдельной строкой
    const expand = (ws) => ws.flatMap((w) => (w.syl && w.syl.length > 1 ? w.syl.map((y, k) => ({ t: y.t, e: y.e, s: y.s, part: k < w.syl.length - 1 })) : [{ t: w.t, e: w.e, s: w.s, part: false }]));
    if (spLineOnly(L)) { const e = spLineEnd(L, src[i + 1]); return { t: L.t, end: e, words: [{ t: L.t, e, s: L.text || all.map((w) => w.s).join(' '), line: true }], bg: [], opp: !!(L.v2 || (typeof lyDuet === 'function' && lyDuet(L))) }; }
    const ws = expand(all.filter((w) => !w.bg)), bg = all.some((w) => w.bg) ? [expand(all.filter((w) => w.bg))] : [];
    if (!ws.length) return null;
    return { t: L.t, end: Math.max(L.end || 0, ws[ws.length - 1].e, L.t + 0.5), words: ws, bg, opp: !!(L.v2 || (typeof lyDuet === 'function' && lyDuet(L))) };
  }).filter(Boolean);
  return out.length ? { lines: out } : null;
}
async function spLoad() {
  const t = curTrack(); SP.tid = t ? t.id : null; SP.err = ''; const my = ++SP.req;
  if (t && pulse.spicy) {
    spPaint(null, 'Загружаю текст из Spicy Lyrics…');
    let r = null; try { r = await pulse.spicy.lyrics({ id: t.id, title: t.title, author: t.author, artists: (t.artists || []).map((a) => a.name || a), dur: t.dur || t.duration || 0 }); } catch (e) { r = { error: String(e.message || e) }; }
    if (my !== SP.req || !SP.on) return;
    const d = r && r.body ? spFromApi(r.body) : null;
    if (d) { SP.from = 'api'; SP.body = r.body; SP.srcLines = null; return spPaint(d); }
    SP.err = r && r.error === 'badkey' ? 'Spicy Lyrics временно недоступен: ошибка авторизации проекта' : r && r.error === 'limit' ? 'Spicy Lyrics: лимит запросов, попробуй чуть позже' : '';
  }
  SP.from = 'pulse'; SP.srcLines = lyState.lines; spPaint(spFromPulse(lyState.lines), lyState.lines ? '' : 'Для этой песни пока нет текста');
}

// ---------- разметка ----------
function spHtml() {
  return `<div class="spc-bg"><i></i><i></i><i></i></div><div class="spc-main"><div class="spc-side"><div class="spc-art"></div><b class="spc-t"></b><span class="spc-a"></span></div>
  <div class="spc-ly"><div class="spc-in"></div></div></div><div class="spc-foot"><span class="spc-attr"></span></div>
  <button class="spc-x" title="Закрыть (Esc)">✕</button>`;
}
function spWordsHtml(ws, li, cls) {
  if (ws.length === 1 && ws[0].line) return `<div class="${cls} spc-s ln" data-l="${li}">${esc(ws[0].s)}</div>`; // 2.0.4: построчная строка — один блок с косым градиентом
  // слоги одного слова держим вместе (spc-w), чтобы перенос строки не рвал слово
  let h = '', wd = '';
  ws.forEach((w, j) => { wd += `<span class="spc-s${w.line ? ' ln' : ''}" data-l="${li}">${esc(w.s)}</span>`; if (!w.part || j === ws.length - 1) { h += (w.line ? wd : `<span class="spc-w">${wd}</span>`) + (j === ws.length - 1 ? '' : ' '); wd = ''; } });
  return `<div class="${cls}">${h}</div>`;
}
function spPaint(d, msg) {
  const box = document.querySelector('#spicy .spc-in'); if (!box) return;
  SP.lines = d && d.lines; SP.stat = !!(d && d.stat); SP.cur = -1; SP.act = []; SP.manual = 0; SP.scroll = 0;
  const st = $('spicy'); st.classList.toggle('stat', SP.stat);
  if (!SP.lines || !SP.lines.length) { box.innerHTML = `<div class="spc-msg">${esc(SP.err || msg || 'Нет текста')}</div>`; SP.els = []; spAttr(); return; }
  box.innerHTML = SP.lines.map((L, i) => SP.stat ? `<div class="spc-l" data-i="${i}"><div class="spc-lead">${esc(L.text)}</div></div>`
    : `<div class="spc-l${L.opp ? ' opp' : ''}" data-i="${i}">${spWordsHtml(L.words, i, 'spc-lead')}${(L.bg || []).map((b) => spWordsHtml(b, i, 'spc-bgv')).join('')}</div>`).join('');
  SP.els = [...box.children].map((el, i) => ({ el, syl: [...el.querySelectorAll('.spc-s')], data: SP.lines[i] && [...(SP.lines[i].words || []), ...((SP.lines[i].bg || []).flat())] }));
  box.style.transform = 'translateY(0)'; spAttr(); spMeta();
}
// подпись по правилам Spicy Lyrics API: провайдер всегда, у community-синхронизаций — ещё загрузивший и автор синхронизации (со ссылками)
function spCreditHtml(b) {
  const src = String((b && b.source) || ''), A = (b && b.UploadAttribution) || {};
  const who = (x) => (x && x.username ? (x.url ? `<a data-spurl="${esc(x.url)}">${esc(x.username)}</a>` : esc(x.username)) : '');
  if (src === 'spicy_lyrics' || (!src && (A.Uploader || A.Maker))) { const u = who(A.Uploader), m = who(A.Maker); return 'Текст: Spicy Lyrics' + (u ? ' · загрузил ' + u : '') + (m ? ', синхронизировал ' + m : ''); }
  return 'Текст: ' + esc({ apple_music: 'Apple Music', spotify: 'Spotify', musixmatch: 'Musixmatch' }[src] || src || 'Spicy Lyrics') + ' (через Spicy Lyrics)';
}
function spAttr() { const a = document.querySelector('#spicy .spc-attr'); if (!a) return; a.innerHTML = SP.from === 'api' ? spCreditHtml(SP.body) : SP.lines ? 'Текст Pulse · вид в стиле Spicy Lyrics' : ''; }
function spMeta() {
  const st = $('spicy'); if (!st) return; const t = curTrack(); const u = t ? artOf(t, 720) : '';
  st.querySelector('.spc-art').style.backgroundImage = u ? `url('${u}')` : '';
  st.querySelector('.spc-t').textContent = t ? t.title || '' : 'Ничего не играет';
  st.querySelector('.spc-a').textContent = t ? (t.artists || []).map((x) => x.name || x).join(', ') || t.author || '' : '';
  const bgs = st.querySelectorAll('.spc-bg i'); SP.bgU = u;
  const set = (v) => bgs.forEach((i) => (i.style.backgroundImage = v ? `url('${v}')` : ''));
  if (spS().bg === false || !u) { set(''); return; }
  set(u);
  if (typeof blurImage === 'function') blurImage(u, { w: 256, blur: 24, sat: 2.2, bright: 0.7 }).then((d) => { if (d && SP.on && SP.bgU === u) set(d); }).catch(() => {});
}

// ---------- анимация ----------
function spNow() {
  // сдвиг и темп из корректора действуют и на текст Spicy (звук может быть из другой записи, чем текст)
  return (lySmooth(heard(S().ly.lag || 0)) - offset()) / stretchK();
}
function spFrame() {
  if (!SP.on) return; SP.raf = requestAnimationFrame(spFrame);
  if (SP.from === 'pulse' && lyState.lines !== SP.srcLines) { SP.srcLines = lyState.lines; spPaint(spFromPulse(lyState.lines), lyState.lines ? '' : 'Для этой песни пока нет текста'); }
  if (!SP.lines || SP.stat) return;
  const now = spNow(), L = SP.lines;
  // активные строки (у Spicy строки могут перекрываться — дуэты, бэк-вокал)
  const act = []; for (let i = 0; i < L.length; i++) { if (L[i].t > now + 0.05) break; if (now < L[i].end + 0.05) act.push(i); }
  let focus = act.length ? act[0] : -1; if (focus < 0) { for (let i = L.length - 1; i >= 0; i--) if (L[i].t <= now) { focus = i; break; } }
  if (focus !== SP.cur || act.join() !== SP.act.join()) spLines(focus, act);
  const calm = document.body.classList.contains('no-anim');
  for (const i of SP.act) spSyl(i, now, calm);
  if (SP.fade) { for (const i of SP.fade) spSyl(i, now, calm); if (SP.fade.every((i) => now > L[i].end + 0.5)) SP.fade = null; }
}
function spSyl(i, now, calm) {
  const E2 = SP.els[i]; if (!E2) return;
  for (let k = 0; k < E2.syl.length; k++) {
    const w = E2.data[k], el = E2.syl[k]; if (!w) continue;
    const p = spClamp((now - w.t) / Math.max(0.05, w.e - w.t)), q = spClamp((now - w.e) / 0.45);
    const gp = -20 + 120 * p; let sc = 1, y = 0, gl = 0;
    if (!calm) {
      if (p <= 0) { sc = 0.96; y = 0.02; }
      else if (p < 1) { const a = spEase(p); sc = 0.96 + (w.line ? 0.03 : 0.09) * a; y = 0.02 - 0.06 * a; gl = p < 0.15 ? p / 0.15 : p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4; }
      else { const a = spEase(q); sc = (w.line ? 0.99 : 1.05) - (w.line ? -0.01 : 0.05) * a; y = -0.04 * (1 - a); gl = 0; }
    }
    const key = (gp | 0) + '|' + Math.round(sc * 500) + '|' + Math.round(y * 500) + '|' + Math.round(gl * 20);
    if (el._k === key) continue; el._k = key;
    el.style.setProperty('--gp', gp.toFixed(1) + '%');
    el.style.transform = calm ? '' : `translateY(${y.toFixed(3)}em) scale(${sc.toFixed(3)})`;
    el.style.setProperty('--gl', (gl * (w.line ? 0.5 : 1)).toFixed(2));
  }
}
function spLines(focus, act) {
  const prevAct = SP.act; SP.cur = focus; SP.act = act;
  const gone = prevAct.filter((i) => !act.includes(i)); if (gone.length) SP.fade = [...new Set([...(SP.fade || []), ...gone])];
  const blur = spS().blur !== false;
  SP.els.forEach((E2, i) => {
    const on = act.includes(i), past = !on && SP.lines[i].end < spNow(), d = focus < 0 ? i + 1 : Math.abs(i - focus);
    E2.el.classList.toggle('act', on); E2.el.classList.toggle('past', past); E2.el.classList.toggle('fut', !on && !past);
    E2.el.style.setProperty('--bl', blur && !on && SP.manual < performance.now() ? Math.min(5, d * 0.9).toFixed(1) + 'px' : '0px');
    if (!on && !(SP.fade || []).includes(i)) for (const s of E2.syl) { if (s._k !== (past ? 'P' : 'F')) { s._k = past ? 'P' : 'F'; s.style.transform = ''; s.style.setProperty('--gp', past ? '100%' : '-20%'); s.style.setProperty('--gl', '0'); } }
  });
  if (SP.manual < performance.now()) spScroll(focus);
}
function spScroll(i) {
  const ly = document.querySelector('#spicy .spc-ly'), box = document.querySelector('#spicy .spc-in'); if (!ly || !box) return;
  const el = SP.els[Math.max(0, i)] && SP.els[Math.max(0, i)].el; if (!el) return;
  SP.scroll = Math.max(0, el.offsetTop - ly.clientHeight * 0.32);
  box.style.transform = `translateY(${-SP.scroll}px)`;
}

// ---------- открыть / закрыть ----------
function spicyOpen(v, idle) {
  v = v == null ? !SP.on : !!v; if (v === SP.on) return; SP.on = v; SP.idle = v && !!idle;
  let st = $('spicy');
  if (v) {
    if (!st) { st = document.createElement('div'); st.id = 'spicy'; st.innerHTML = spHtml(); document.body.appendChild(st); }
    st.classList.toggle('idle', SP.idle); st.classList.toggle('nobg', spS().bg === false); SP.at = performance.now();
    document.body.classList.add('lyonly', 'spicy-on'); requestAnimationFrame(() => st.classList.add('show'));
    spMeta(); spLoad(); SP.raf = requestAnimationFrame(spFrame);
  } else {
    cancelAnimationFrame(SP.raf); SP.req++; document.body.classList.remove('lyonly', 'spicy-on');
    if (st) { st.classList.remove('show'); setTimeout(() => { if (!SP.on && st.isConnected) st.remove(); }, 260); }
    SP.lines = null; SP.els = []; SP.idle = false;
  }
}
window.spicyOpen = spicyOpen;
// «Только текст» (кнопки, клавиша T, автозапуск при простое) открывает Spicy-вид, когда он включён в настройках
if (typeof lyStageOpen === 'function') { const base = lyStageOpen; window.lyStageOpen = function (v, idle) { if (spS().on || SP.on) { if (spS().on) return spicyOpen(v, idle); if (v !== true) return spicyOpen(false); } const r = base(v, idle); spStageKick(); return r; }; }

document.addEventListener('click', (e) => {
  const st = $('spicy'); if (!st || !SP.on || !st.contains(e.target)) return;
  if (e.target.closest('.spc-x')) return spicyOpen(false);
  const l = e.target.closest('.spc-l'); if (l && SP.lines && !SP.stat) { const L = SP.lines[+l.dataset.i]; if (L) { const t = L.t * stretchK() + offset(); E.seek(Math.max(0, t - 0.05)); SP.manual = 0; SP.cur = -9; } }
});
document.addEventListener('wheel', (e) => {
  if (!SP.on || !e.target.closest || !e.target.closest('#spicy .spc-ly')) return;
  const box = document.querySelector('#spicy .spc-in'); if (!box) return;
  SP.manual = performance.now() + 3500; SP.scroll = Math.max(0, SP.scroll + e.deltaY); box.style.transform = `translateY(${-SP.scroll}px)`;
  SP.els.forEach((E2) => E2.el.style.setProperty('--bl', '0px'));
  clearTimeout(SP.mt); SP.mt = setTimeout(() => { SP.manual = 0; SP.cur = -9; }, 3600);
}, { passive: true });
document.addEventListener('keydown', (e) => { if (SP.on && e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); spicyOpen(false); } }, true);
// выход из «простоя» — любое движение мыши или клавиша
['pointermove', 'keydown', 'wheel', 'pointerdown'].forEach((ev) => document.addEventListener(ev, (e) => { if (SP.on && SP.idle && performance.now() - (SP.at || 0) > 400) { spicyOpen(false); if (typeof poke === 'function') poke(); } }, true));
PX.on && PX.on('track', (t) => { if (SP.on && (!t || t.id !== SP.tid)) { spMeta(); spLoad(); } });

// ---------- вид Spicy Lyrics для всего текста Pulse ----------
// Слова текущей строки рисует karaoke.js (те же кривые и пружины, что в Spicy); здесь — строки, проигрыши и фон плеера.
const SPL = { cur: -9, blurred: [], gapEl: null, bgU: null };
function spLookOn() { return !!(spS() && spS().style); }
function spApplyLook() {
  const on = spLookOn(), B = document.body;
  B.classList.toggle('spicy-ly', on); B.classList.toggle('spicy-blur', on && spS().blur !== false);
  B.classList.toggle('spicy-stage', spStageFx()); // 2.0.4: эффекты Spicy в обычном «Только текст»
  if (typeof Kara !== 'undefined' && Kara.cfg) Kara.cfg();
  SPL.cur = -9; if (!on) spClearLines();
  spPpBg();
}
function spClearLines() { for (const el of SPL.blurred) el.style.removeProperty('--sd'); SPL.blurred = []; if (SPL.lnEl) { spLnClear(SPL.lnEl); SPL.lnEl = null; } if (SPL.gapEl) { SPL.gapEl.style.removeProperty('--gs'); SPL.gapEl.querySelectorAll('i').forEach((d) => d.style.removeProperty('--dp')); SPL.gapEl = null; } }
// живой фон страницы плеера: три слоя размытой обложки медленно вращаются (как в Spicy Lyrics)
function spPpBg() {
  const pp = $('pp'); if (!pp) return;
  const on = spLookOn() && spS().ppBg !== false; let el = $('ppSpBg');
  document.body.classList.toggle('spicy-ppbg', on);
  if (!on) { if (el) el.remove(); SPL.bgU = null; return; }
  if (!el) { el = document.createElement('div'); el.id = 'ppSpBg'; el.className = 'spc-ppbg'; el.innerHTML = '<i></i><i></i><i></i>'; const b = $('ppBg'); b ? b.after(el) : pp.prepend(el); }
  const t = curTrack(), u = t ? artOf(t, 300) : ''; if (u === SPL.bgU) return; SPL.bgU = u;
  const set = (v) => el.querySelectorAll('i').forEach((i) => (i.style.backgroundImage = v ? `url('${v}')` : ''));
  if (!u) return set('');
  if (typeof blurImage === 'function') blurImage(u, { w: 256, blur: 24, sat: 2.2, bright: 0.7 }).then((d) => { if (SPL.bgU === u) set(d || u); }).catch(() => set(u)); else set(u);
}
function spLineFrame(t) {
  const lines = lyState.lines, inner = $('lyInner'); if (!lines || !inner) return;
  const i = lyState.cur, kids = inner.children;
  if (i !== SPL.cur) {
    SPL.cur = i; for (const el of SPL.blurred) el.style.removeProperty('--sd'); SPL.blurred = [];
    // размытие по расстоянию до текущей строки (у Spicy — у каждой строки своё)
    if (spS().blur !== false) for (let k = Math.max(0, i - 12); k <= Math.min(kids.length - 1, i + 12); k++) { if (k === i) continue; const el = kids[k]; el.style.setProperty('--sd', Math.min(4.5, Math.abs(k - i) * 0.85).toFixed(2) + 'px'); SPL.blurred.push(el); }
    if (SPL.gapEl) { SPL.gapEl.style.removeProperty('--gs'); SPL.gapEl.querySelectorAll('i').forEach((d) => d.style.removeProperty('--dp')); SPL.gapEl = null; }
    if (lines[i] && lines[i].gap && kids[i]) SPL.gapEl = kids[i];
  }
  // построчные тайминги: текущая строка заливается целиком, косым градиентом сверху вниз
  const Lc = lines[i], ec = kids[i];
  if (SPL.lnEl && SPL.lnEl !== ec) { spLnClear(SPL.lnEl); SPL.lnEl = null; }
  if (ec && spLineOnly(Lc)) {
    if (!ec.classList.contains('lnfill')) { ec.classList.add('lnfill'); SPL.lnEl = ec; }
    spLnPrep(ec, ec._lnS || (ec._lnS = [...ec.querySelectorAll('.w')]));
    const lp = spLp(Lc, lines[i + 1], (t - offset()) / stretchK()).toFixed(3); if (ec._lp !== lp) { ec._lp = lp; ec.style.setProperty('--lp', lp); }
  }
  // проигрыш: три точки по очереди наполняются, группа «дышит», в конце сжимается и уходит
  const g = SPL.gapEl, L = lines[i];
  if (g && L && L.gap) {
    const tt = (t - offset()) / stretchK(), p = spClamp((tt - L.t) / L.gap), now = performance.now() / 1000;
    const dots = g.querySelectorAll('i'); dots.forEach((d, k) => d.style.setProperty('--dp', spClamp(p * 3.3 - k).toFixed(3)));
    const out = p > 0.88 ? spEase((p - 0.88) / 0.12) : 0, inn = spEase(spClamp(p / 0.08));
    g.style.setProperty('--gs', ((0.8 + 0.2 * inn + Math.sin(now * 2.6) * 0.05 * (1 - out)) * (1 - 0.35 * out)).toFixed(3));
    g.style.setProperty('--go', (inn * (1 - out)).toFixed(3));
  }
}
if (typeof lyricsFrame === 'function') { const base = lyricsFrame; window.lyricsFrame = function (t) { const r = base(t); if (spLookOn()) spLineFrame(t); return r; }; }
{ const base = applySettings; window.applySettings = function () { const r = base.apply(this, arguments); spApplyLook(); return r; }; }
PX.on && PX.on('track', () => { if (spLookOn()) setTimeout(spPpBg, 50); });
document.addEventListener('click', (e) => { const a = e.target.closest && e.target.closest('[data-spurl]'); if (a) { e.preventDefault(); e.stopPropagation(); if (pulse.openUrl) pulse.openUrl(a.dataset.spurl); } }, true);

// ---------- настройки ----------
// 2.0.4: блок «Spicy Lyrics» живёт во вкладке «Текст песен» (раньше была отдельная вкладка)
function spicyRows() {
  const P = spS();
  return [
    grp('Spicy Lyrics — вид'),
    R('Стиль Spicy Lyrics для всего текста', 'Текст в плеере: слоги заливаются белым, светятся и подпрыгивают (длинные — по буквам), дальние строки размыты, в проигрышах «дышат» точки', tg('spicy.style'), 'spicy lyrics стиль текст караоке'),
    ...(P.style ? [R('↳ Живой фон в плеере', 'Размытая обложка медленно вращается за текстом', tg('spicy.ppBg'), 'spicy фон')] : []),
    R('«Только текст» в виде Spicy', 'Кнопка «Только текст» и клавиша T открывают полноэкранный Spicy-вид: обложка слева, текст справа, клик по строке — перемотка', tg('spicy.on'), 'spicy только текст полный экран'),
    ...(P.on ? [R('↳ Живой фон', '', tg('spicy.bg'), 'spicy фон')] : [R('↳ Эффекты Spicy в обычном «Только текст»', 'Сам «Только текст» остаётся прежним (фон, обложка, вода, частицы), а текст заливается по слогам, подпрыгивает и светится как в Spicy', tg('spicy.stage'), 'spicy только текст эффекты механика')]),
    ...(P.on || P.style ? [R('↳ Размывать дальние строки', '', tg('spicy.blur'), 'spicy размытие')] : []),
    grp('Spicy Lyrics — текст из их базы'),
    R('↳ Брать текст из Spicy Lyrics для всех песен', 'Когда источник текста — «Все источники», Spicy спрашивается первым. Можно выбрать и только «Spicy Lyrics» в списке источников выше. Если песни там нет — Pulse ищет в своих базах', tg('spicy.src'), 'spicy источник текста'),
    { raw: `<div class="set-row"><div class="set-l"><span>Вид и механика сделаны по мотивам открытого расширения <b>Spicy Lyrics</b> от Spikerko (AGPL-3.0). Внутренний API расширения сторонним приложениям закрыт, поэтому текст из их базы — только через официальный API с ключом проекта Pulse.</span></div><div class="set-c"><button class="btn sm" data-sact="lys:open">Открыть «Только текст»</button></div></div>` },
  ];
}
function spicyChanged(path) {
  if (!path.startsWith('spicy.')) return false;
  if (path === 'spicy.on') { if (!spS().on && SP.on) spicyOpen(false); }
  if (/^spicy\.(style|ppBg|blur|stage|on)$/.test(path)) { spApplyLook(); if (typeof lyReRender === 'function') lyReRender(); }
  if (/^spicy\.(on|style|src|stage)$/.test(path) && route().r === 'settings') rerenderSettings();
  if (path === 'spicy.src') { if (SP.on) spLoad(); const t = curTrack(); if (t && spicyKeyOn() && lyState.id === t.id) { const L = lib.lyrics[t.id]; if (L && !L.user && !L.picked && L.provider !== 'spicy') { L.spTried = false; loadLyricsFor(t); } } }
  if (SP.on && path === 'spicy.bg') { $('spicy').classList.toggle('nobg', spS().bg === false); spMeta(); }
  if (SP.on && path === 'spicy.blur') SP.cur = -9;
  return true;
}
{ const base = settingChanged; settingChanged = function (p) { if (spicyChanged(p)) { save(); return; } return base.apply(this, arguments); }; }

// ---------- 2.0.4: эффекты и механика Spicy для текста обычного «Только текст» ----------
// Только сам текст (и его отражение — это тот же текст): заливка слова по слогам, подъём, масштаб и свечение по кривым Spicy.
// Фон, обложка, частицы и вода — без изменений.
const SPT = { raf: 0, blk: null, map: null };
const spCurve = typeof Kara !== 'undefined' && Kara.spline ? { SC: Kara.spline([[0, 0.95], [0.7, 1.05], [1, 1]]), YO: Kara.spline([[0, 0.01], [0.9, -1 / 60], [1, 0]]), GL: Kara.spline([[0, 0], [0.15, 1], [0.6, 1], [1, 0]]) } : null;
// 2.0.4: работает сам по себе — даже если стиль Spicy для панели текста выключен; не нужен, когда включён полноэкранный Spicy-вид
const spStageFx = () => spS().stage !== false && !spS().on;
function spStageOn() { return spStageFx() && typeof lys !== 'undefined' && lys.on && !SP.on; }
function spStageKick() { if (spStageOn() && !SPT.raf) SPT.raf = requestAnimationFrame(spStageFrame); if (!spStageOn()) spStageClear(); }
function spStageClear() { if (SPT.raf) cancelAnimationFrame(SPT.raf); SPT.raf = 0; SPT.blk = null; SPT.map = null; }
// доля заливки слова: по настоящим слогам (Spicy Lyrics) — сколько букв уже спето, иначе равномерно по времени слова
function spWordProg(w, e, T) {
  if (T <= w.t) return 0; if (T >= e) return 1;
  const y = w.syl; if (!y || y.length < 2) return (T - w.t) / Math.max(0.05, e - w.t);
  let tot = 0; for (const q of y) tot += q.s.length || 1; let done = 0;
  for (const q of y) { const n = q.s.length || 1; if (T >= q.e) { done += n; continue; } if (T > q.t) done += n * ((T - q.t) / Math.max(0.03, q.e - q.t)); break; }
  return Math.min(1, done / tot);
}
function spStageFrame() {
  SPT.raf = 0; if (!spStageOn()) return spStageClear(); SPT.raf = requestAnimationFrame(spStageFrame);
  const m = $('lysMain'); const blk = m && m.querySelector('.lys-blk:not(.out)'); if (!blk || !spCurve) return;
  const lines = lyState.lines || [], L = lines[lys.line]; if (!L || L.gap || !L.words || !L.words.length) return;
  const vis = blk.dataset.vis || 'classic';
  if (spLineOnly(L)) { // построчные тайминги — весь блок заливается косым градиентом сверху вниз
    const T0 = (lySmooth(heard(S().ly.lag || 0)) - offset()) / stretchK(), lp = spLp(L, lines[lys.line + 1], T0).toFixed(3);
    for (const b of [blk, blk._twin, blk._twin2]) if (b) {
      if (!b.classList.contains('lnfill')) b.classList.add('lnfill'); if (b._lp !== lp) { b._lp = lp; b.style.setProperty('--lp', lp); }
      const box = vis === 'classic' ? b.querySelector('.lys-cur') : b; if (box) spLnPrep(box, box._lnS || (box._lnS = [...box.querySelectorAll('.lw')]));
    }
    SPT.blk = null; return;
  }
  if (SPT.blk !== blk) { // новый блок: собрать слова основного текста и их «близнецов» в отражении
    SPT.blk = blk; const pick = (b) => (b ? [...b.querySelectorAll(vis === 'classic' ? '.lys-cur .lw' : '.lw[data-k]')] : []);
    const a = pick(blk), t1 = pick(blk._twin), t2 = pick(blk._twin2);
    SPT.map = a.map((el, j) => ({ els: [el, t1[j], t2[j]].filter(Boolean), k: vis === 'classic' ? j : +el.dataset.k, c: '' }));
  }
  const T = (lySmooth(heard(S().ly.lag || 0)) - offset()) / stretchK(), calm = document.body.classList.contains('no-anim');
  for (const it of SPT.map) {
    const w = L.words[it.k]; if (!w) continue;
    const nx = L.words[it.k + 1] || lines[lys.line + 1], e = w.e != null && w.e > w.t ? w.e : Math.min(nx ? nx.t : w.t + 1.2, w.t + 2.5);
    const ve = w.t + Math.max(e - w.t, 0.16), p = T <= w.t ? 0 : T >= ve ? 1 : (T - w.t) / (ve - w.t);
    const st = T < w.t ? 0 : p >= 1 ? 2 : 1, fp = spWordProg(w, e, T);
    const gp = st === 0 ? -20 : st === 2 ? 100 : -20 + 120 * fp;
    const sc = calm || st === 2 ? 1 : spCurve.SC(st === 0 ? 0 : p), y = calm || st === 2 ? 0 : spCurve.YO(st === 0 ? 0 : p), g = st === 1 ? spCurve.GL(p) : 0;
    const key = Math.round(gp) + '|' + Math.round(sc * 400) + '|' + Math.round(y * 2000) + '|' + Math.round(g * 25);
    if (key === it.c) continue; it.c = key;
    for (const el of it.els) { const s2 = el.style; s2.setProperty('--kg', gp.toFixed(1) + '%'); s2.setProperty('--ss', sc.toFixed(4)); s2.setProperty('--sy', (y * 2).toFixed(4) + 'em'); s2.setProperty('--kb', (0.08 + 0.14 * g).toFixed(3) + 'em'); s2.setProperty('--ko', (g * 0.55).toFixed(3)); }
  }
}
{ const base = spApplyLook; spApplyLook = function () { const r = base.apply(this, arguments); spStageKick(); return r; }; }
