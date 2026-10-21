'use strict';
// Корректор текста: сдвиг, темп (slowed / sped up), запись таймингов по нажатию, правка и поиск текста
const lrcT = (s) => { s = Math.max(0, s); const m = Math.floor(s / 60), x = s - m * 60; return `[${String(m).padStart(2, '0')}:${x.toFixed(2).padStart(5, '0')}]`; };
let fixSearchRevision = 0;
const fixDrafts = new Map();
function curLyr() { return lyState.id ? lib.lyrics[lyState.id] : null; }
function openFix(tab) {
  const t = curTrack(); if (!t) return toast('Сначала включи песню');
  if (!document.body.classList.contains('pp-open')) openPP();
  if (lib.tab !== 'lyrics') setTab('lyrics');
  if (typeof closeLyPop === 'function') closeLyPop(); hideMenu();
  fixOpen = true; if (tab) fix.tab = tab; $('lyFix').classList.add('on'); $('lyFixBtn').classList.add('on'); $('lyFixBtn').setAttribute('aria-expanded', 'true'); renderFix(); $('lyFix').querySelector('[data-fx="close"]')?.focus();
}
function closeFix() { ++fixSearchRevision; fix.busy = false; if (fix.tap) fix.tap = null; fixOpen = false; $('lyFix').classList.remove('on'); $('lyFixBtn').classList.remove('on'); $('lyFixBtn').setAttribute('aria-expanded', 'false'); $('lyFixBtn').focus(); }
// текущий текст в виде LRC (что видно на экране, с учётом сдвига и темпа)
function currentLRC(applyTiming) {
  const k = applyTiming ? stretchK() : 1, o = applyTiming ? offset() : 0;
  // 2.0: настоящие пословные тайминги (из базы или по голосу) сохраняются тегами <мм:сс.сс>
  const wt = (x) => lrcT(x * k + o).replace('[', '<').replace(']', '>');
  return (lyState.lines || []).filter((l) => !l.gap && l.text).map((l) => lrcT(l.t * k + o) + (l.words && l.words.length && !l.est ? l.words.map((w, i) => wt(w.t) + w.s + (w.e != null && (!l.words[i + 1] || l.words[i + 1].t - w.e > 0.04) ? wt(w.e) : '')).join(' ') : l.text)).join('\n');
}
function plainOf(L) { if (!L) return ''; if (L.plain) return L.plain; return (lyState.lines || []).filter((l) => !l.gap && l.text).map((l) => l.text).join('\n'); }
// 2.0.4-fix: запрос для поиска — только «Название - Автор», без «[OFFICIAL AUDIO]», имени автора в названии и подзаголовков
function lyQueryOf(t) {
  const a = String(t.author || '').replace(/VEVO$|\s*-\s*Topic$|Official$/i, '').split(/,|&| x | feat/i)[0].trim();
  let s = String(t.title || '').replace(/\[[^\]]*\]|\([^)]*\)|【[^】]*】/g, ' ')
    .replace(/\b(official|music|video|lyric[s]?|audio|visualizer|mv|hd|4k|клип|премьера)\b/gi, ' ')
    .replace(/\s*(feat\.?|ft\.?|prod\.?)\s.*$/i, '').replace(/[|｜].*$/, '').replace(/["“”«»]/g, '').replace(/\s+/g, ' ').trim();
  const n = (x) => x.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  if (a && s.toLowerCase().startsWith(a.toLowerCase())) s = s.slice(a.length).replace(/^\s*[-–—:|]?\s*/, '');
  const parts = s.split(/\s+[-–—]\s+/).map((x) => x.trim()).filter(Boolean);
  let art = a;
  if (parts.length > 1) { if (!a && parts.length === 2) { art = parts[0]; s = parts[1]; } else { const ap = parts.find((x) => a && n(x) === n(a)); if (ap) art = ap; s = parts.find((x) => !a || n(x) !== n(a)) || parts[0]; } }
  s = s.replace(/\s*[-–—]\s*$/, '').trim();
  return art ? `${s} - ${art}` : s;
}
function renderFix() {
  if (!fixOpen) return; const box = $('lyFix'), t = curTrack(); if (!t) return closeFix();
  const active = document.activeElement, editing = active && box.contains(active) && /INPUT|TEXTAREA/.test(active.tagName);
  const caret = editing ? { id: active.id, start: active.selectionStart, end: active.selectionEnd, direction: active.selectionDirection } : null;
  const oldScroll = box.querySelector('.fx-body')?.scrollTop || 0;
  if (box.dataset.track === t.id) {
    if ($('fxText')) fixDrafts.set(t.id, $('fxText').value);
    if ($('fxQ')) fix.q = $('fxQ').value;
  }
  box.dataset.track = t.id;
  const L = lib.lyrics[t.id] || {}, k = stretchK(), o = offset(), tab = fix.tab;
  const tabs = [['time', 'gauge', 'Время'], ['tap', 'tap', 'Запись'], ['text', 'edit', 'Текст'], ['find', 'search', 'Найти']];
  let body = '';
  if (fix.tap) body = tapHtml();
  else if (tab === 'time') {
    const autoK = L.stretch || (L.srcDur && t.dur ? t.dur / L.srcDur : 1);
    body = `<div class="fx-sec"><b>${ico('gauge')}Сдвиг текста</b><span>Если слова идут раньше или позже голоса</span>
      <div class="fx-row"><button class="ly-btn" data-fx="off:-1">−1 с</button><button class="ly-btn" data-fx="off:-0.1">−0.1</button><span class="fx-val">${o > 0 ? '+' : ''}${o.toFixed(1)} с</span><button class="ly-btn" data-fx="off:0.1">+0.1</button><button class="ly-btn" data-fx="off:1">+1 с</button><button class="ly-btn" data-fx="off0" title="Сбросить сдвиг">${ico('undo')}</button></div>
      <button class="btn sm" data-fx="nowline">${ico('tap')}Следующая строка началась сейчас</button></div>
    <div class="fx-sec"><b>${ico('speed')}Темп текста</b><span>Для slowed / sped up / nightcore: растягивает или сжимает тайминги${L.srcDur ? `. В базе ${fmt(L.srcDur)}, трек ${fmt(t.dur || E.dur())}` : ''}</span>
      <div class="fx-row"><input type="range" min="0.6" max="1.6" step="0.005" value="${k}" data-fxr="k"><span class="fx-val" id="fxK">×${k.toFixed(3)}</span></div>
      <div class="fx-row"><button class="ly-btn" data-fx="k:1">1×</button>${Math.abs(autoK - 1) > 0.01 ? `<button class="ly-btn" data-fx="k:${autoK.toFixed(4)}">Авто ×${autoK.toFixed(2)}</button>` : ''}<button class="ly-btn" data-fx="k:0.8">×0.80</button><button class="ly-btn" data-fx="k:1.15">×1.15</button><button class="ly-btn" data-fx="k:1.25">×1.25</button></div></div>
    <div class="fx-sec"><b>${ico('tap')}Своя синхронизация</b><span>Самый точный способ — отметить начало каждой строки нажатием</span>
      <div class="fx-row"><button class="btn sm" data-fx="tab:tap">${ico('tap')}Записать вручную</button></div></div>
    <div class="fx-sec"><div class="fx-row"><button class="btn sm" data-fx="resetall">${ico('refresh')}Сбросить все правки трека</button></div></div>`;
  } else if (tab === 'tap') {
    const n = tapSource().length;
    body = `<div class="fx-sec"><b>${ico('tap')}Запись по нажатию</b><span>Самый точный способ. Включи запись и нажимай <kbd>Пробел</kbd> или <kbd>Enter</kbd> в момент, когда начинается каждая строка. <kbd>Backspace</kbd> — отменить последнюю, <kbd>Esc</kbd> — выйти. Результат сохранится и будет работать офлайн.</span>
      ${n ? `<div class="fx-row"><button class="btn sm acc" data-fx="tap:0">${ico('rec')}С начала трека</button><button class="btn sm" data-fx="tap:cur">${ico('play')}С текущего места</button></div><span>Строк для записи: ${n}</span>`
        : `<div class="fx-row"><span>Сначала добавь текст во вкладке «Текст» или найди его</span><button class="btn sm" data-fx="tab:text">${ico('edit')}Текст</button></div>`}</div>`;
  } else if (tab === 'text') {
    const val = fixDrafts.has(t.id) ? fixDrafts.get(t.id) : L.user ? L.user : L.synced || L.ws ? currentLRC(true) : plainOf(L);
    body = `<div class="fx-sec"><b>${ico('edit')}Свой текст</b><span>Вставь обычный текст — Pulse сам расставит его по голосу и ритму. Или LRC со временем <code>[01:23.45]строка</code> — тогда тайминги возьмутся как есть.</span>
      <textarea class="field fx-ta" id="fxText" spellcheck="false" placeholder="Текст песни…">${esc(val)}</textarea>
      <div class="fx-row"><button class="btn sm acc" data-fx="savetext">${ico('check')}Сохранить</button><button class="btn sm" data-fx="copylrc">${ico('link')}Копировать LRC</button>${L.user ? `<button class="btn sm" data-fx="dropuser">${ico('trash')}Убрать свою синхронизацию</button>` : ''}</div></div>`;
  } else if (tab === 'find') {
    const q = fix.q ?? lyQueryOf(t);
    const ver = /slowed|sped\s*up|speed\s*up|nightcore|reverb|замедл|ускор/i.test(t.title + ' ' + (t.author || ''));
    if (fix.fit == null) fix.fit = ver;
    const res = fix.res;
    body = `<div class="fx-sec"><b>${ico('search')}Найти текст в базе LRCLIB</b>
      <form class="fx-row" id="fxFind"><input class="inp" id="fxQ" value="${esc(q)}" placeholder="Название - Автор"><button class="btn sm acc" type="submit">${ico('search')}Найти</button></form>
      <label class="fx-chk"><div class="toggle ${fix.fit ? 'on' : ''}" data-fx="fit"></div><span>Подогнать темп под длительность трека (slowed / sped up)</span></label></div>
      <div class="fx-res">${fix.busy ? loadingHtml : !res ? '' : !res.length ? '<div class="fx-empty">Ничего не нашлось — попробуй другое написание</div>' : res.map((r, i) => {
        const d = r.dur && t.dur ? r.dur - t.dur : 0;
        return `<button class="fx-item" data-fx="pick:${i}"><div><b>${esc(r.track)}</b><span>${r.src ? esc(r.src) + ' · ' : ''}${esc(r.artist)}${r.album ? ' · ' + esc(r.album) : ''}</span></div><em>${r.dur ? fmt(r.dur) : ''}${d && Math.abs(d) > 2 ? ` <i class="${Math.abs(d) > 8 ? 'bad' : ''}">${d > 0 ? '+' : ''}${Math.round(d)}с</i>` : ''}</em><u class="${r.synced ? 'sy' : r.instrumental ? 'in' : ''}">${r.words ? 'по словам' : r.synced ? 'по строкам' : r.instrumental ? 'инстр.' : 'текст'}</u></button>`;
      }).join('')}</div>`;
    if (!res && !fix.busy) { const id = t.id; setTimeout(() => { if (fixOpen && fix.tab === 'find' && curTrack()?.id === id && !fix.busy && !fix.res) findLyrics(q); }, 0); }
  }
  box.innerHTML = `<div class="fx-head"><b>${ico('tune')}Корректор текста</b><button class="ib sm" data-fx="close" title="Закрыть">${ico('x')}</button></div>
    ${fix.tap ? '' : `<div class="seg fx-tabs">${tabs.map(([id, i, n]) => `<button class="${tab === id ? 'on' : ''}" data-fx="tab:${id}">${ico(i)}${n}</button>`).join('')}</div>`}
    <div class="fx-body">${body}</div>`;
  box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Корректор текста');
  box.querySelector('.fx-body').scrollTop = oldScroll;
  if (caret) { const field = $(caret.id); if (field && box.contains(field)) { field.focus({ preventScroll: true }); if (caret.start != null) field.setSelectionRange(caret.start, caret.end, caret.direction); } }
}
async function findLyrics(q) {
  const t = curTrack(); if (!t) return;
  const revision = ++fixSearchRevision, id = t.id;
  fix.q = q;
  if (!online()) { fix.busy = false; fix.res = []; return renderFix(); }
  fix.busy = true; renderFix();
  const r = await Promise.resolve().then(() => pulse.lyricsSearch(q ? { q, title: t.title, author: t.author } : { title: t.title, author: t.author })).catch(() => null);
  // A slow response for another song/query must never replace the current draft or result.
  if (revision !== fixSearchRevision || curTrack()?.id !== id || !fixOpen) return;
  fix.busy = false;
  fix.res = Array.isArray(r) ? r.sort((a, b) => (b.words ? 2 : b.synced ? 1 : 0) - (a.words ? 2 : a.synced ? 1 : 0) || Math.abs((a.dur || 0) - (t.dur || 0)) - Math.abs((b.dur || 0) - (t.dur || 0))) : [];
  if (fix.tab === 'find') renderFix();
}
function pickLyrics(r) {
  const t = curTrack(); if (!t || !r) return;
  const L = lib.lyrics[t.id] = {};
  if (r.instrumental && !r.synced && !r.plain) L.instrumental = true;
  if (r.synced) L.synced = r.synced; else if (r.plain) L.plain = r.plain;
  L.source = `${r.src ? r.src + ' · ' : ''}${r.artist} — ${r.track}`; L.srcDur = r.dur || 0; L.picked = true; L.v = LY_V; L.provider = r.provider || null; // 2.0
  const k = r.dur && t.dur ? t.dur / r.dur : 1;
  if (fix.fit && Math.abs(k - 1) > 0.02 && k > 0.6 && k < 1.7) L.stretch = Math.round(k * 1000) / 1000;
  delete lib.stretch[t.id]; delete lib.offsets[t.id]; lyLast = null; save();
  loadLyricsFor(t);
  fix.tab = 'time'; renderFix(); toast('Текст заменён', 'lyrics');
}
// ---------- запись по нажатию ----------
function tapSource() {
  const fromLines = (lyState.lines || []).filter((l) => !l.gap && l.text).map((l) => l.text);
  if (fromLines.length) return fromLines;
  const L = curLyr(); return L && L.plain ? L.plain.split(/\r?\n/).map((s) => s.trim()).filter((s) => s && !/^\[.*\]$/.test(s)) : [];
}
function tapStart(fromCur) {
  const lines = tapSource(); if (!lines.length) return toast('Нет текста для записи');
  fix.tap = { lines, i: 0, times: [] };
  if (!fromCur) E.seek(0); if (!playing) E.play();
  renderFix();
}
function tapHtml() {
  const T = fix.tap, L = T.lines, i = T.i;
  return `<div class="tap"><div class="tap-pr"><i style="width:${(i / L.length) * 100}%"></i></div><div class="tap-n">${i} / ${L.length} · ${fmt(E.time())}</div>
    <div class="tap-l prev">${esc(L[i - 1] || '')}</div><div class="tap-l cur">${esc(L[i] || 'Готово!')}</div><div class="tap-l next">${esc(L[i + 1] || '')}</div>
    <button class="tap-btn" data-fx="hit">${ico('tap')}<span>Нажми, когда начнётся строка<em>Пробел / Enter</em></span></button>
    <div class="fx-row"><button class="btn sm" data-fx="undo">${ico('undo')}Назад</button><button class="btn sm acc" data-fx="tapsave">${ico('check')}Сохранить</button><button class="btn sm" data-fx="tapcancel">${ico('x')}Отмена</button></div></div>`;
}
function tapHit() { const T = fix.tap; if (!T || T.i >= T.lines.length) return; T.times[T.i++] = heard(S().ly.lag || 0); if (T.i >= T.lines.length) return tapSave(); renderFix(); }
function tapUndo() { const T = fix.tap; if (!T || !T.i) return; T.i--; const back = T.times[T.i]; T.times.length = T.i; E.seek(Math.max(0, back - 2.5)); renderFix(); }
function tapSave() {
  const T = fix.tap, t = curTrack(); if (!T || !t) return; if (!T.times.length) { fix.tap = null; return renderFix(); }
  const L = lib.lyrics[t.id] = lib.lyrics[t.id] || {};
  const out = T.times.map((tm, k) => lrcT(tm) + T.lines[k]);
  // не отмеченные строки — после последней, равномерно по ~3 с (можно дописать позже)
  let last = T.times[T.times.length - 1]; for (let k = T.times.length; k < T.lines.length; k++) { last += 3; out.push(lrcT(last) + T.lines[k]); }
  L.user = out.join('\n'); L.userAt = Date.now(); delete lib.offsets[t.id]; delete lib.stretch[t.id]; lyLast = null; save();
  fix.tap = null; fix.tab = 'time'; loadLyricsFor(t); renderFix(); toast('Синхронизация сохранена — работает и офлайн', 'check');
}
function tapFrame() { const T = fix.tap; if (!T) return; const n = $('lyFix').querySelector('.tap-n'); if (n) n.textContent = `${T.i} / ${T.lines.length} · ${fmt(E.time())}`; }
// ---------- события ----------
$('lyFixBtn').onclick = (e) => { e.stopPropagation(); fixOpen ? closeFix() : openFix(); };
$('lyFix').addEventListener('click', (e) => {
  e.stopPropagation(); const el = e.target.closest('[data-fx]'); if (!el) return;
  const [a, v] = el.dataset.fx.split(':'), t = curTrack(); if (!t) return;
  const L = lib.lyrics[t.id] || (lib.lyrics[t.id] = {});
  if (a === 'close') return closeFix();
  if (a === 'tab') { if ($('fxText')) fixDrafts.set(t.id, $('fxText').value); fix.tab = v; if (v === 'find') fix.res = null; return renderFix(); }
  if (a === 'off') { shiftOffset(+v); return renderFix(); }
  if (a === 'off0') { delete lib.offsets[t.id]; delete L.autoOff; updateOffset(); save(); lyReRefine(); lyState.cur = -2; sendState(); return renderFix(); }
  if (a === 'nowline') { const i = Math.min((lyState.lines || []).length - 1, lyState.cur + 1); let j = i; while (lyState.lines && lyState.lines[j] && lyState.lines[j].gap) j++; if (j >= 0) tapSync(j); return renderFix(); }
  if (a === 'k') { const k = +v; if (Math.abs(k - 1) < 0.001 && !(L.stretch && lyFromDb())) delete lib.stretch[t.id]; else lib.stretch[t.id] = k; lyReRefine(); lyState.cur = -2; save(); return renderFix(); }
  if (a === 'resetall') { if (!confirm('Сбросить сдвиг, темп, свой текст и синхронизацию для этого трека?')) return; delete lib.offsets[t.id]; delete lib.stretch[t.id]; delete lib.lyrics[t.id]; save(); updateOffset(); loadLyricsFor(t); return renderFix(); }
  if (a === 'tap') return tapStart(v === 'cur');
  if (a === 'hit') return tapHit();
  if (a === 'undo') return tapUndo();
  if (a === 'tapsave') return tapSave();
  if (a === 'tapcancel') { fix.tap = null; return renderFix(); }
  if (a === 'savetext') {
    const txt = $('fxText').value.replace(/\r/g, '').trim(); if (!txt) return toast('Текст пустой');
    const drop = ['ws', 'auto', 'none', 'instrumental', 'wsFail', 'mismatch', 'recheck'];
    if (/^\s*\[\d+:\d+(?:\.\d+)?\]/m.test(txt)) { drop.forEach((k) => delete L[k]); L.user = txt; L.userAt = Date.now(); delete lib.offsets[t.id]; delete lib.stretch[t.id]; }
    else { drop.concat(['synced', 'user', 'userAt', 'stretch', 'srcDur']).forEach((k) => delete L[k]); L.plain = txt; L.source = 'Свой текст'; }
    lyLast = null; save(); updateOffset(); loadLyricsFor(t);
    toast('Текст сохранён', 'check'); fix.tab = 'time'; return renderFix();
  }
  if (a === 'dropuser') { delete L.user; delete L.userAt; lyLast = null; save(); loadLyricsFor(t); return renderFix(); }
  if (a === 'copylrc') return copyText(L.user || currentLRC(true), 'LRC скопирован');
  if (a === 'fit') { fix.fit = !fix.fit; return renderFix(); }
  if (a === 'pick') return pickLyrics(fix.res && fix.res[+v]);
});
$('lyFix').addEventListener('submit', (e) => { e.preventDefault(); findLyrics($('fxQ').value.trim()); });
$('lyFix').addEventListener('input', (e) => {
  if (e.target.id === 'fxText') { const t = curTrack(); if (t) fixDrafts.set(t.id, e.target.value); return; }
  if (e.target.id === 'fxQ') { fix.q = e.target.value; return; }
  if (e.target.dataset.fxr !== 'k') return; const t = curTrack(); if (!t) return;
  const k = +e.target.value; lib.stretch[t.id] = k; $('fxK').textContent = '×' + k.toFixed(3); clearTimeout(fix.rrT); fix.rrT = setTimeout(lyReRefine, 250); lyLast = null; sendLyrics(); lyState.cur = -2; save();
});
document.addEventListener('keydown', (e) => {
  if (fixOpen && e.code === 'Escape' && !fix.tap) { e.preventDefault(); e.stopImmediatePropagation(); closeFix(); return; }
  if (!fix.tap) return; if (/INPUT|TEXTAREA/.test(e.target.tagName)) return;
  if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); e.stopPropagation(); tapHit(); }
  else if (e.code === 'Backspace') { e.preventDefault(); e.stopPropagation(); tapUndo(); }
  else if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); fix.tap = null; renderFix(); }
}, true);
PX.on('track', () => { ++fixSearchRevision; fix.busy = false; fix.res = null; fix.q = null; fix.fit = null; if (fixOpen) { if (fix.tap) fix.tap = null; renderFix(); } }); // 2.0.4-fix: запрос сбрасывается при смене трека, даже если корректор закрыт
