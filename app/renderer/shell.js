'use strict';
// 2.0.10: новый интерфейс — каркас «Панели», командная палитра (Ctrl+K), простые/все настройки, готовые виды текста,
// «Все настройки…» во всплывашках и карточка «Продолжить» на Главной. Все механики прежние — меняется только то, как они показаны.

// ---------- каркас: «Панели» (новый) или «Классический» ----------
const DS = { moved: false, advOpen: {}, pal: null };
function dsShellApply() {
  const U = S().ui || {}, b = document.body, panels = U.shell !== 'classic';
  b.classList.toggle('ds-panels', panels); b.classList.toggle('bar-all', !!U.barAll);
  // в «Панелях» «Перемешать» и «Повтор» встают по бокам от ▶, а время — под кнопки, к полосе перемотки (id и обработчики те же)
  const L = document.querySelector('.bar-l'), Rr = document.querySelector('.bar-r'), bar = $('bar'), tm = document.querySelector('.bar .time');
  if (!L || !Rr || !bar) return;
  if (panels && !DS.moved) {
    L.insertBefore($('btnShuffle'), $('btnPrev')); L.appendChild($('btnRepeat')); if (tm) bar.appendChild(tm); DS.moved = true;
  } else if (!panels && DS.moved) {
    Rr.insertBefore($('btnRepeat'), $('btnPP')); Rr.insertBefore($('btnShuffle'), $('btnPP')); if (tm) L.appendChild(tm); DS.moved = false;
  }
}
{ const base = applyCustom; applyCustom = function () { const r = base.apply(this, arguments); try { dsShellApply(); } catch (e) { console.error(e); } return r; }; }

// подсказка «Ctrl K» в поиске
{ const f = $('gsearch'); if (f && !f.querySelector('.ds-kbd')) { const k = document.createElement('span'); k.className = 'ds-kbd'; k.textContent = 'Ctrl K'; k.title = 'Командная палитра: разделы, действия и настройки'; k.onclick = (e) => { e.preventDefault(); e.stopPropagation(); dsPalOpen(); }; f.insertBefore(k, $('gqClear')); } }

// ---------- командная палитра ----------
const dsNorm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/<[^>]+>/g, ' ');
function dsPalItems(q) {
  const out = [], add = (g, icon, t, sub, run, k) => out.push({ g, icon, t, sub: sub || '', run, k: dsNorm(t + ' ' + (sub || '') + ' ' + (k || '')) });
  const t = typeof curTrack === 'function' ? curTrack() : null;
  [['home', 'home', 'Главная'], ['wave', 'wave2', 'Моя волна'], ['explore', 'explore', 'Обзор'], ['library', 'library', 'Библиотека'], ['dj', 'dj', 'Диджей'], ['downloads', 'offline', 'Скачанное'], ['settings', 'settings', 'Настройки']]
    .forEach(([r, i, n]) => add('Разделы', i, n, '', () => go({ r }), 'раздел страница перейти'));
  const A = [
    ['play', playing ? 'Пауза' : 'Играть', 'Пробел', () => toggle(), 'плей пауза воспроизведение'],
    ['next', 'Следующий трек', 'Ctrl + →', () => next(), 'дальше вперед'],
    ['prev', 'Предыдущий трек', 'Ctrl + ←', () => prev(), 'назад'],
    ['shuffle', 'Перемешать', '', () => toggleShuffle(), 'случайно шафл'],
    ['repeat', 'Повтор', '', () => cycleRepeat(), 'повторять'],
    ['heart', 'Нравится', '', () => t && toggleLike(t), 'лайк сердце'],
    ['dislike', 'Не нравится', 'X', () => t && typeof toggleDislike === 'function' && toggleDislike(t), 'дизлайк'],
    ['download', 'Скачать текущий трек', '', () => t && download([t]), 'офлайн'],
    ['wave2', 'Моя волна — запустить / пауза', 'W', () => typeof waveToggle === 'function' && waveToggle(), 'волна поток'],
    ['up', 'Открыть плеер', '', () => openPP(), 'страница плеера'],
    ['lyrics', 'Текст песни', 'L', () => { openPP(); setTab('lyrics'); }, 'слова лирика'],
    ['sparkle', 'Визуал', 'V', () => { openPP(); setMode('visual'); }, 'визуализация визуализатор'],
    ['video', 'Видео', '', () => { openPP(); setMode('video'); }, 'клип'],
    ['expand', 'Только текст', 'T', () => typeof lyStageOpen === 'function' && lyStageOpen(true), 'весь экран текст'],
    ['expand', 'Во весь экран', 'F', () => pulse.win('fs'), 'полный экран'],
    ['tune', 'Корректор текста', '', () => typeof openFix === 'function' && openFix(), 'сдвиг тайминг правка текста'],
    ['widget', 'Мини-виджет', '', () => pulse.win('widget'), 'виджет маленькое окно'],
    ['plus', 'Новый плейлист', '', () => $('btnNewPl').click(), 'создать плейлист'],
    ['edit', 'Редактор окна', 'Ctrl + Shift + E', () => typeof czEdit === 'function' && czEdit(['home', 'explore', 'library'].includes(route().r) ? route().r : 'home'), 'кастомизация раскладка'],
    ['menu', 'Свернуть / развернуть меню слева', '', () => $('btnNav').click(), 'боковая панель мини']
  ];
  if (typeof window.dsExtraActions === "function") try { A.push(...window.dsExtraActions()); } catch (e) {} // 2.0.12: действия из других модулей (припевы, кабина)
  A.forEach(([i, n, sub, run, k]) => add('Действия', i, n, sub, run, k));
  (lib.playlists || []).filter((p) => p.id !== MINE).forEach((p) => add('Плейлисты', 'list', p.name, (p.tracks || []).length + ' тр. · на устройстве', () => go({ r: 'local', id: p.id }), 'плейлист'));
  (typeof accLists !== 'undefined' && accLists || []).forEach((p) => add('Плейлисты', 'list', p.name, p.sub || 'Плейлист', () => goBrowse(p.browseId || 'VL' + p.listId), 'плейлист'));
  try {
    for (const tb of allTabs()) {
      add('Настройки', tb.icon || 'settings', tb.title, 'Раздел настроек', () => dsOpenSetting(tb.id), 'настройки ' + (tb.desc || ''));
      for (const r of tb.rows || []) { if (!r || r.h || r.raw != null || !r.t) continue; const nm = String(r.t).replace(/^↳ /, ''); add('Настройки', tb.icon || 'settings', nm, tb.title, () => dsOpenSetting(tb.id, nm), (r.s || '') + ' ' + (r.k || '')); }
    }
  } catch (e) { console.error(e); }
  q = dsNorm(q).trim(); if (!q) return out.filter((x) => x.g !== 'Настройки').slice(0, 40);
  const W = q.split(/\s+/); const hits = out.filter((x) => W.every((w) => x.k.includes(w)));
  // группы не перемешиваются; внутри группы выше то, что начинается с запроса
  const G = ['Разделы', 'Действия', 'Плейлисты', 'Настройки'], sc = (x) => (dsNorm(x.t).startsWith(q) ? 0 : 1);
  hits.sort((a, b) => G.indexOf(a.g) - G.indexOf(b.g) || sc(a) - sc(b));
  hits.unshift({ g: 'Поиск музыки', icon: 'search', t: `Искать «${q}»`, sub: 'Enter — песни, альбомы, исполнители', run: () => doSearch(q) });
  return hits.slice(0, 60);
}
function dsOpenSetting(tab, title) {
  closePP(); lib.setTab = tab; setQ = ''; if (route().r !== 'settings') go({ r: 'settings' }); else rerenderSettings();
  if (!title) return;
  let n = 0; const find = () => {
    const rows = [...document.querySelectorAll('#setBody .set-row')], el = rows.find((x) => { const b = x.querySelector('.set-l b'); return b && b.textContent.trim() === title; });
    if (!el) { if (++n < 30) setTimeout(find, 60); return; } const adv = el.closest('details.set-adv'); if (adv && !adv.open) adv.open = true;
    const cell = el.closest('.set-cell') || el; cell.scrollIntoView({ block: 'center', behavior: animOn() ? 'smooth' : 'auto' });
    cell.classList.remove('jump-hl'); void cell.offsetWidth; cell.classList.add('jump-hl'); setTimeout(() => cell.classList.remove('jump-hl'), 1600);
  }; setTimeout(find, 60);
}
function dsPalOpen() {
  if (DS.pal) return DS.pal.querySelector('input').focus();
  const el = document.createElement('div'); el.className = 'ds-pal'; el.innerHTML = `<div class="ds-pal-box" role="dialog" aria-label="Командная палитра"><label class="ds-pal-q">${ico('search')}<input placeholder="Раздел, действие или настройка…" spellcheck="false" aria-label="Что сделать"><span class="ds-kbd">Esc</span></label><div class="ds-pal-l" role="listbox"></div><div class="ds-pal-f"><span>↑↓ выбрать</span><span>Enter открыть</span><span>Esc закрыть</span></div></div>`;
  document.body.appendChild(el); DS.pal = el; let sel = 0, items = [];
  const inp = el.querySelector('input'), list = el.querySelector('.ds-pal-l');
  const draw = () => {
    items = dsPalItems(inp.value); sel = Math.min(sel, Math.max(0, items.length - 1)); let g = '', h = '';
    items.forEach((x, i) => { if (x.g !== g) { g = x.g; h += `<div class="ds-pal-g">${esc(g)}</div>`; } h += `<div class="ds-pal-i ${i === sel ? 'on' : ''}" data-i="${i}" role="option">${ico(x.icon)}<b>${esc(x.t)}</b><span>${esc(x.sub)}</span></div>`; });
    list.innerHTML = h || '<div class="ds-pal-e">Ничего не нашлось</div>';
    const on = list.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest' });
  };
  const run = (i) => { const x = items[i]; dsPalClose(); if (x) try { x.run(); } catch (e) { console.error(e); } };
  inp.oninput = () => { sel = 0; draw(); };
  inp.onkeydown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % Math.max(1, items.length); draw(); }
    else if (e.key === 'Enter') { e.preventDefault(); run(sel); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); dsPalClose(); }
    e.stopPropagation();
  };
  list.onmousemove = (e) => { const it = e.target.closest('.ds-pal-i'); if (it && +it.dataset.i !== sel) { sel = +it.dataset.i; list.querySelectorAll('.ds-pal-i').forEach((x) => x.classList.toggle('on', +x.dataset.i === sel)); } };
  list.onclick = (e) => { const it = e.target.closest('.ds-pal-i'); if (it) run(+it.dataset.i); };
  el.onmousedown = (e) => { if (e.target === el) dsPalClose(); };
  draw(); requestAnimationFrame(() => { el.classList.add('show'); inp.focus(); });
}
function dsPalClose() { const el = DS.pal; if (!el) return; DS.pal = null; el.classList.remove('show'); setTimeout(() => el.remove(), animOn() ? 160 : 0); }
window.addEventListener('keydown', (e) => {
  if(e.target.closest?.('.media-dialog'))return;
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.code === 'KeyK') { e.preventDefault(); e.stopImmediatePropagation(); DS.pal ? dsPalClose() : dsPalOpen(); return; }
  if (DS.pal && e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); dsPalClose(); }
}, true);
window.dsPalOpen = dsPalOpen;

// ---------- настройки: «Простые / Все», редкое — в свёрнутом «Дополнительно» ----------
const DS_MAIN_ROWS = 6; // сколько строк видно сразу в простом режиме (целыми группами)
{ const base = setBodyHtml; setBodyHtml = function () {
  const html = base.apply(this, arguments);
  if ((S().ui || {}).setMode === 'all' || (setQ || '').trim()) return html;
  const tpl = document.createElement('template'); tpl.innerHTML = html;
  const grid = tpl.content.querySelector('.set-tab:not(.set-full):not(.set-launch) > .set-grid'); if (!grid) return html;
  const cards = [...grid.children].filter((x) => x.classList.contains('set-card')); if (cards.length < 3) return html;
  let n = 0, k = 0; for (; k < cards.length; k++) { n += cards[k].querySelectorAll('.set-row').length; if (n >= DS_MAIN_ROWS) { k++; break; } }
  const rest = cards.slice(k); if (!rest.length) return html;
  const tab = lib.setTab || '', d = document.createElement('details'); d.className = 'set-adv'; if (DS.advOpen[tab]) d.open = true;
  d.innerHTML = `<summary>${ico('down')}<b>Дополнительно</b><span>${rest.map((c) => (c.querySelector('.set-ct') || {}).textContent || '').filter(Boolean).join(' · ')}</span></summary><div class="set-grid"></div>`;
  rest.forEach((c) => d.lastElementChild.appendChild(c)); grid.after(d);
  return tpl.innerHTML;
}; }
document.addEventListener('toggle', (e) => { if (e.target.classList && e.target.classList.contains('set-adv')) DS.advOpen[lib.setTab || ''] = e.target.open; }, true);
// переход по чипам групп открывает «Дополнительно», если группа спрятана там
document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-jump]'); if (!b) return; const el = document.getElementById(b.dataset.jump); const d = el && el.closest('details.set-adv'); if (d && !d.open) d.open = true; }, true);
// переключатель режима — под поиском настроек
{ const base = settingsHtml; settingsHtml = function () {
  const h = base.apply(this, arguments), m = (S().ui || {}).setMode === 'all' ? 'all' : 'simple';
  const sw = `<div class="ds-setmode" title="Простые — сначала главное, редкое свёрнуто в «Дополнительно». Все — всё сразу">${seg('ui.setMode', [['simple', 'Простые'], ['all', 'Все настройки']])}</div>`;
  return h.replace('</label>', '</label>' + sw);
}; }

// ---------- готовые виды текста ----------
const DS_LY_PRESETS = [
  ['classic', 'Классика', 'Слова по одному, лёгкий прыжок и свечение', { 'spicy.style': false, 'ly.mode': 'words', 'ly.anim': 'pop', 'ly.glow': true, 'ly.blur': true, 'ly.align': 'left', 'ly.size': 100, 'ly.color': 'accent' }],
  ['spicy', 'Spicy', 'Слоги заливаются, дальние строки размыты', { 'spicy.style': true, 'ly.mode': 'words', 'ly.glow': true, 'ly.blur': true }],
  ['karaoke', 'Караоке', 'Крупно по центру, слова растут', { 'spicy.style': false, 'ly.mode': 'words', 'ly.anim': 'grow', 'ly.glow': true, 'ly.blur': false, 'ly.align': 'center', 'ly.size': 115, 'ly.color': 'accent' }],
  ['min', 'Минимум', 'Строкой, без анимаций и свечения', { 'spicy.style': false, 'ly.mode': 'lines', 'ly.anim': 'none', 'ly.glow': false, 'ly.blur': false, 'ly.size': 95, 'ly.color': 'white' }]
];
const dsLyCur = () => { const P = DS_LY_PRESETS.find(([, , , v]) => Object.entries(v).every(([p, x]) => getP(p) === x)); return P ? P[0] : ''; };
function dsLyPresetRow() {
  const c = dsLyCur();
  return R('Готовый вид текста', 'Выставляет набор настроек разом — потом всё можно подкрутить ниже', `<div class="seg">${DS_LY_PRESETS.map(([id, n, d]) => `<button class="${c === id ? 'on' : ''}" data-dslp="${id}" title="${esc(d)}">${n}</button>`).join('')}</div>`, 'пресет готовый вид классика spicy караоке минимум');
}
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('[data-dslp]'); if (!b) return; e.stopPropagation();
  const P = DS_LY_PRESETS.find((x) => x[0] === b.dataset.dslp); if (!P) return;
  for (const [p, v] of Object.entries(P[3])) { if (getP(p) === v) continue; setP(p, v); try { settingChanged(p); } catch (err) { console.error(err); } }
  b.parentElement.querySelectorAll('[data-dslp]').forEach((x) => x.classList.toggle('on', x === b)); save(); deferRerender(120); toast('Вид текста: ' + P[1], 'lyrics');
});
{ const base = allTabs; allTabs = function () {
  const T = base.apply(this, arguments), ly = T.find((t) => t.id === 'ly');
  if (ly && !ly._ds) { ly.rows = [grp('Готовый вид'), dsLyPresetRow(), ...ly.rows]; ly._ds = 1; }
  const ui = T.find((t) => t.id === 'ui');
  if (ui && !ui._ds) { ui._ds = 1; ui.rows = [grp('Каркас окна'),
    R('Вид окна', 'Панели — меню, страница и плеер лежат отдельными скруглёнными панелями, управление по центру внизу. Классический — как в Pulse до 2.0.10', seg('ui.shell', [['panels', 'Панели'], ['classic', 'Классический']]), 'каркас панели классический вид окна'),
    R('Все кнопки на панели плеера', 'Выключено — «Скачать» и «Не нравится» живут в меню «⋯», кнопка диджея видна, только когда он включён', tg('ui.barAll'), 'кнопки плеер скачать дизлайк диджей'),
    R('Настройки', 'Простые — сначала главное, редкое свёрнуто в «Дополнительно»', seg('ui.setMode', [['simple', 'Простые'], ['all', 'Все сразу']]), 'простые все настройки дополнительно'), ...ui.rows]; }
  return T;
}; }

// ---------- всплывашки: «Все настройки…» внизу; в «Виде текста» — готовые виды ----------
const DS_POP_TAB = { ly: 'ly', viz: 'viz', lys: 'ly', wave: 'wave', mr: 'ly' };
{ const base = popHtml; popHtml = function (title, rows, tab) {
  if (tab === 'ly') rows = [dsLyPresetRow(), ...rows];
  const h = base.call(this, title, rows, tab), to = DS_POP_TAB[tab] || (allTabs().some((t) => t.id === tab) ? tab : '');
  return to ? h.replace(/<\/div><\/div>$/, `</div><div class="pop-f"><button class="btn sm ghost" data-dsset="${esc(to)}">${ico('settings')}Все настройки…</button></div></div>`) : h;
}; }
document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-dsset]'); if (!b) return; e.stopPropagation(); if (typeof closeLyPop === 'function') closeLyPop(); if (typeof lyStageOpen === 'function' && document.body.classList.contains('ly-stage')) lyStageOpen(false); dsOpenSetting(b.dataset.dsset); });

// ---------- Главная: одна большая карточка «Продолжить» + «Моя волна», дальше полки ----------
function dsHeroHtml() {
  const t = typeof curTrack === 'function' ? curTrack() : null;
  const now = t ? `<div class="dh-card dh-now" data-dsh="pp" style="--dh-art:url('${esc(artOf(t, 544))}')"><div class="dh-art"></div><div class="dh-tx"><span class="dh-k">${playing ? 'Сейчас играет' : 'Продолжить'}</span><b>${esc(t.title)}</b><span>${esc(t.author || (t.artists || []).map((a) => a.name).join(', '))}</span></div><button class="dh-play" data-dsh="play" title="${playing ? 'Пауза' : 'Слушать'}">${ico(playing ? 'pause' : 'play')}</button></div>` : '';
  const wave = `<div class="dh-card dh-wave" data-dsh="wavepage"><div class="dh-tx"><span class="dh-k">${ico('wave2')}Моя волна</span><b>Бесконечный поток под твой вкус</b><span>Лайки и «Не нравится» учат её</span></div><button class="dh-play" data-dsh="wave" title="Запустить волну">${ico('play')}</button></div>`;
  return `<div class="ds-hero ${t ? '' : 'one'}">${now}${wave}</div>`;
}
{ const P = PAGES.home, base = P.load; P.load = async function (r) { const h = await base.apply(this, arguments); return (r && r.params ? '' : dsHeroHtml()) + h; }; }
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('[data-dsh]'); if (!b) return; e.stopPropagation();
  const a = b.dataset.dsh;
  if (a === 'play') toggle(); else if (a === 'pp') openPP(); else if (a === 'wave') { if (typeof waveToggle === 'function') waveToggle(); } else if (a === 'wavepage') go({ r: 'wave' });
});
// карточка «Продолжить» следит за треком и паузой без перерисовки страницы
function dsHeroSync() { const h = document.querySelector('.ds-hero'); if (!h || route().r !== 'home') return; const t = curTrack(), sig = (t && t.id) + '|' + playing; if (h._sig === sig) return; h._sig = sig; const tmp = document.createElement('div'); tmp.innerHTML = dsHeroHtml(); const n = tmp.firstElementChild; n._sig = sig; h.replaceWith(n); }
PX.on('track', dsHeroSync); PX.on('page', () => setTimeout(dsHeroSync, 0));
{ const base = updateButtons; updateButtons = function () { const r = base.apply(this, arguments); try { dsHeroSync(); } catch (e) {} return r; }; }

try { dsShellApply(); } catch (e) { console.error(e); }
