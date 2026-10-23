'use strict';
// Pulse 1.8 — гибкая кастомизация: интерфейс, текст, эффекты визуала, всплывающие панели «под рукой»
const FONTS = [['default', 'Segoe UI (стандарт)'], ['Bahnschrift, "Segoe UI", sans-serif', 'Bahnschrift'], ['Arial, sans-serif', 'Arial'], ['Verdana, sans-serif', 'Verdana'], ['Tahoma, sans-serif', 'Tahoma'],
  ['"Trebuchet MS", sans-serif', 'Trebuchet MS'], ['Georgia, serif', 'Georgia'], ['"Times New Roman", serif', 'Times New Roman'], ['Consolas, "Courier New", monospace', 'Consolas'],
  ['"Comic Sans MS", cursive', 'Comic Sans'], ['Impact, sans-serif', 'Impact'], ['"Segoe Print", cursive', 'Segoe Print'], ['"Segoe Script", cursive', 'Segoe Script']];
const DEF_FONT = '"Segoe UI Variable","Segoe UI",Roboto,"Noto Sans",Arial,sans-serif';
const HIDE = [['like', 'Лайк'], ['dislike', 'Не нравится'], ['dl', 'Скачать'], ['more', '«Ещё»'], ['time', 'Время трека'], ['dj', 'Кнопка диджея'], ['vol', 'Ползунок громкости'], ['shuffle', 'Перемешать'], ['repeat', 'Повтор']];
const cssPlaceholder = () => {
  const lang = window.PulseI18n ? PulseI18n.language() : 'en';
  return lang === 'ja'
    ? '/* 例 */\n.ly-line { letter-spacing: .02em }\n.bar { border-top: 1px solid rgba(var(--a1), .5) }'
    : lang === 'uk'
      ? '/* приклад */\n.ly-line { letter-spacing: .02em }\n.bar { border-top: 1px solid rgba(var(--a1), .5) }'
      : lang === 'en'
        ? '/* example */\n.ly-line { letter-spacing: .02em }\n.bar { border-top: 1px solid rgba(var(--a1), .5) }'
        : '/* пример */\n.ly-line { letter-spacing: .02em }\n.bar { border-top: 1px solid rgba(var(--a1), .5) }';
};

function vizFxRows() {
  return [
    {raw:'<p class="fx-scope-note">Параметры применяются ко всем стилям. Пульс обложки виден только в стилях с обложкой.</p>'},
    R('Свечение', 'Неоновый ореол вокруг линий', rng('viz.fx.glow', 0, 200, 10, '%'), 'эффект свечение glow'),
    R('Шлейф', 'Движение оставляет след', rng('viz.fx.trails', 0, 90, 5, '%'), 'эффект шлейф след'),
    R('Зум на бит', 'Картинка «вдыхает» на каждой доле', rng('viz.fx.zoom', 0, 100, 5, '%'), 'эффект зум'),
    R('Тряска на басу', '', rng('viz.fx.shake', 0, 100, 5, '%'), 'эффект тряска'),
    R('Вспышка на сильной доле', '', rng('viz.fx.flash', 0, 100, 5, '%'), 'эффект вспышка'),
    R('Зеркало', '', seg('viz.fx.mirror', [['off', 'Нет'], ['h', '↔'], ['v', '↕'], ['quad', '4 части']]), 'эффект зеркало'),
    R('Перелив цвета', 'Цвета бегут по кругу', rng('viz.fx.hue', 0, 300, 10, '%'), 'эффект цвет перелив'),
    R('Толщина линий', '', rng('viz.fx.thick', 30, 300, 10, '%'), 'толщина'),
    R('Плотность', 'Сколько частиц, звёзд и полос', rng('viz.fx.density', 25, 200, 5, '%'), 'плотность частицы'),
    R('Усиление баса', '', rng('viz.fx.bass', 50, 200, 10, '%'), 'бас'),
    R('Пульс обложки', 'Насколько обложка качается в такт', rng('viz.fx.coverPulse', 0, 250, 10, '%'), 'обложка пульс'),
    R('Затемнение фона', 'Глубже фон — ярче визуал', rng('viz.fx.bgDim', 0, 90, 5, '%'), 'фон затемнение')
  ];
}
function lyLookRows() {
  return [
    R('Шрифт текста', '', sel('ly.font', FONTS), 'шрифт текст'),
    R('Жирность', '', seg('ly.weight', [[500, 'Обычный'], [700, 'Полужирный'], [800, 'Жирный'], [900, 'Очень']]), 'жирность'),
    R('Цвет поющейся строки', '', seg('ly.color', [['accent', 'Акцент'], ['white', 'Белый'], ['custom', 'Свой']]) + (S().ly.color === 'custom' ? colr('ly.colorC') : ''), 'цвет текста'),
    R('Яркость остальных строк', '', rng('ly.dimOp', 5, 80, 5, '%')),
    R('Межстрочный интервал', '', rng('ly.spacing', 100, 190, 5, '%'), 'интервал'),
    R('Анимация слов', '', seg('ly.anim', [['pop', 'Прыжок'], ['grow', 'Рост'], ['glow', 'Свечение'], ['wave', 'Волна'], ['none', 'Без']]), 'анимация слов'),
    R('Заливка слова', 'Слово закрашивается слева направо, пока его поют — как в караоке', tg('ly.fill'), 'заливка караоке')];
}
function surfaceRows() {
  return [R('Материал панелей и кнопок', 'Меню, панели и кнопки. Переключается сразу, без перезапуска.', `<select class="sel surface-options" data-sel="ui.surfaceMaterial" aria-label="Материал панелей и кнопок">${[['blur','Обычное стекло'],['liquid','Liquid Glass']].map(([v,n])=>`<option value="${v}" ${(S().ui.surfaceMaterial||'blur')===v?'selected':''}>${n}</option>`).join('')}</select>`, 'стекло liquid glass blur прозрачность материал'), ...(S().ui.surfaceMaterial === 'liquid' && window.PulseGlassControls ? [{raw:PulseGlassControls.html(),kw:'liquid glass эффекты пресеты стекло'}] : [])];
}
function uiTab() {
  const s = S(), U = s.ui;
  const hide = `<div class="chips hide-chips">${HIDE.map(([k, n]) => `<button class="chip ${U.hide[k] ? 'on' : ''}" data-tg="ui.hide.${k}">${U.hide[k] ? ico('x') : ico('check')}${esc(n)}</button>`).join('')}</div>`;
  const themes = PULSE_THEME_NAMES;
  return { id: 'ui', icon: 'widget', title: 'Интерфейс', rows: [
    R('Готовые темы', 'Быстрый старт — потом можно подправить всё ниже', `<div class="chips">${themes.map(([k, n]) => `<button class="chip" data-sact="cx:theme:${k}">${n}</button>`).join('')}</div>`, 'тема пресет'),
    grp('Шрифт'),
    R('Шрифт интерфейса', '', sel('ui.font', FONTS), 'шрифт'),
    R('Размер шрифта', '', rng('ui.fontSize', 12, 18, 1, 'px'), 'шрифт размер'),
    grp('Форма и цвета'),
    R('Скругление углов', '', seg('ui.radius', [[-1, 'Как было'], [0, 'Острые'], [6, 'Чуть'], [12, 'Мягкие'], [22, 'Круглые']]), 'углы скругление'),
    R('Цвет фона', '', colr('ui.bg'), 'фон цвет'),
    R('Цвет нижней панели', '', colr('ui.panel'), 'панель цвет'),
    R('Цвет текста', '', colr('ui.txt'), 'текст цвет'),
    ...surfaceRows(),
    R('Стеклянные панели', 'Полупрозрачные верх, низ и меню — сквозь них видно фон обложки', tg('ui.glass'), 'стекло прозрачность'),
    R('Прозрачность стекла', '', rng('ui.glassOp', 10, 95, 5, '%')),
    grp('Размеры'),
    R('Ширина боковой панели', '', rng('ui.side', 180, 340, 10, 'px'), 'ширина меню'),
    R('Высота нижней панели', '', rng('ui.bar', 60, 100, 2, 'px'), 'высота панели'),
    grp('Что показывать'),
    R('Кнопки и элементы', 'Нажми, чтобы скрыть или вернуть', '', 'скрыть кнопки'), { raw: hide },
    grp('Для продвинутых'),
    R('Свой CSS', 'Меняй вообще что угодно: любой элемент, цвет, размер. Применяется сразу после «Применить»', `<button class="btn sm" data-sact="cx:css">${ico('check')}Применить</button>`, 'css стиль'),
    { raw: `<textarea class="field css-box" id="cssBox" spellcheck="false" placeholder="${esc(cssPlaceholder())}">${esc(U.css || '')}</textarea>` },
    R('Сбросить оформление', 'Только этот раздел', `<button class="btn sm" data-sact="cx:resetui">${ico('refresh')}Сбросить</button>`)] };
}
const PULSE_THEME_NAMES = [['default', 'Неон'], ['oled', 'OLED-чёрный'], ['glass', 'Стекло'], ['soft', 'Мягкий'], ['retro', 'Ретро-терминал'], ['studio', 'Студия']];
const THEMES = {
  default: { ui: { font: 'default', radius: -1, bg: '#030303', panel: '#212121', txt: '#ffffff', glass: false }, look: { ambAll: true, tint: 35 } },
  oled: { ui: { font: 'default', radius: 6, bg: '#000000', panel: '#000000', txt: '#ffffff', glass: false }, look: { ambAll: false, tint: 10 } },
  glass: { ui: { font: 'default', radius: 16, bg: '#05040a', panel: '#141220', txt: '#ffffff', glass: true, glassOp: 55 }, look: { ambAll: true, ambAllOp: 70, tint: 50 } },
  soft: { ui: { font: 'Bahnschrift, "Segoe UI", sans-serif', radius: 18, bg: '#100d17', panel: '#1b1726', txt: '#f3eefe', glass: false }, look: { ambAll: true, tint: 40 } },
  retro: { ui: { font: 'Consolas, "Courier New", monospace', radius: 0, bg: '#020a04', panel: '#06140a', txt: '#b8ffcf', glass: false }, look: { accent: 'acid', ambAll: false, tint: 25 } },
  studio: { ui: { font: 'Tahoma, sans-serif', radius: 4, bg: '#0d0f12', panel: '#16191e', txt: '#e8edf2', glass: false }, look: { accent: 'ocean', ambAll: false, tint: 15 } }
};
function customAct(a, el) {
  const s = S();
  if (a.startsWith('theme:')) { const T = THEMES[a.slice(6)]; if (!T) return; s.look.theme = a.slice(6); s.ui.liquid = false; Object.assign(s.ui, T.ui); Object.assign(s.look, T.look); applySettings(); save(); rerenderSettings(); toast('Тема применена', 'palette'); }
  if (a === 'relaunch') { if (pulse.relaunch) pulse.relaunch(); return; }
  if (a === 'css') { const v = ($('cssBox') || {}).value || ''; s.ui.css = v; applyCustom(); save(); toast('CSS применён', 'check'); }
  if (a.startsWith('popreset:')) {
    const D = DEF_SETTINGS, cp = (o) => JSON.parse(JSON.stringify(o));
    if (a === 'popreset:viz') { s.viz.fx = cp(D.viz.fx); ['sens', 'react', 'lag'].forEach((k) => (s.viz[k] = D.viz[k])); }
    if (a === 'popreset:ly') ['size', 'align', 'mode', 'glow', 'blur', 'font', 'weight', 'color', 'colorC', 'dimOp', 'spacing', 'speed', 'anim', 'lag'].forEach((k) => (s.ly[k] = cp(D.ly[k])));
    applySettings(); applyCustom(); save(); rerenderSettings(); toast('Сброшено', 'refresh'); return;
  }
  if (a === 'resetui') { s.ui = JSON.parse(JSON.stringify(DEF_SETTINGS.ui)); applySettings(); save(); rerenderSettings(); }
}
let glassNeedRestart = false; // 1.9.1: Liquid Glass убран
function applyCustom() {
  const s = S(), U = s.ui, Y = s.ly, L = s.look, V = s.viz, r = document.documentElement.style, b = document.body;
  r.setProperty('--uiFont', U.font === 'default' ? DEF_FONT : U.font); r.setProperty('--uiFs', (U.fontSize || 14) + 'px');
  b.classList.toggle('c-radius', U.radius >= 0); r.setProperty('--r', Math.max(0, U.radius) + 'px');
  const bg = hex2rgb(U.bg || '#030303'), pn = hex2rgb(U.panel || '#212121'), lq = false, lo = Math.max(0, Math.min(0.95, (U.liquidOp ?? 35) / 100));
  r.setProperty('--bg', lq ? `rgba(${bg.join(',')},${lo})` : U.bg || '#030303'); r.setProperty('--barBg', lq ? `rgba(${pn.join(',')},${Math.min(0.95, lo + 0.25)})` : U.panel || '#212121'); r.setProperty('--txt', U.txt || '#fff');
  b.classList.toggle('liquid', lq); r.setProperty('--lqOp', lo.toFixed(2));
  const mat = lq ? U.liquidMat || 'acrylic' : 'none'; if (applyCustom.mat !== mat && pulse.material) { applyCustom.mat = mat; pulse.material(mat); }
  if (pulse.glassMode && applyCustom.clear !== (mat === 'clear')) { applyCustom.clear = mat === 'clear'; pulse.glassMode(applyCustom.clear).then((x) => { const need = !!(x && x.restart && applyCustom.clear); if (glassNeedRestart !== need) { glassNeedRestart = need; if (typeof rerenderSettings === 'function' && $('setBody')) deferRerender(0); } }).catch(() => {}); }
  b.classList.toggle('lq-clear', lq && mat === 'clear'); b.dataset.lqMat = lq ? mat : ''; r.setProperty('--bgRGB', bg.join(',')); r.setProperty('--panRGB', pn.join(','));
  r.setProperty('--side', (U.side || 240) + 'px'); r.setProperty('--bar', (U.bar || 72) + 'px');
  r.setProperty('--pside', U.side || 240); r.setProperty('--pbar', U.bar || 72); r.setProperty('--pfs', ((U.fontSize || 14) / 14).toFixed(3)); r.setProperty('--prad', Math.max(0, U.radius)); // для предпросмотра «Внешний вид»
  b.classList.toggle('glass', !!U.glass); r.setProperty('--glassOp', ((U.glassOp ?? 60) / 100).toFixed(2));
  if (window.PulseGlass) PulseGlass.apply(U); else b.dataset.surfaceMaterial = U.surfaceMaterial === 'liquid' ? 'liquid' : 'blur';
  for (const [k] of HIDE) b.classList.toggle('hide-' + k, !!(U.hide && U.hide[k]));
  const uc = $('userCss'); if (uc && uc.textContent !== (U.css || '')) uc.textContent = U.css || '';
  // текст
  r.setProperty('--lyFont', Y.font === 'default' ? 'inherit' : Y.font); r.setProperty('--lyW', Y.weight || 800); r.setProperty('--lyDim', ((Y.dimOp ?? 28) / 100).toFixed(2));
  r.setProperty('--lyLH', ((Y.spacing ?? 128) / 100).toFixed(2)); r.setProperty('--lt', (Y.speed ?? 70) * 10 + 'ms'); r.setProperty('--visS', ((Y.visSize ?? 100) / 100).toFixed(2));
  const lc = Y.color === 'white' ? '255,255,255' : Y.color === 'custom' ? hex2rgb(Y.colorC || '#ffffff').join(',') : null;
  b.classList.toggle('ly-colored', !!lc); if (lc) r.setProperty('--lyC', lc); b.dataset.lyanim = Y.anim || 'pop';
  // фон и свечение
  b.classList.toggle('amb-all', !!L.ambAll && !!L.ambient); r.setProperty('--ambAllOp', ((L.ambAllOp ?? 45) / 100).toFixed(2)); r.setProperty('--tint', ((L.tint ?? 35) / 100).toFixed(2));
  r.setProperty('--artK', ((L.artSize ?? 100) / 100).toFixed(2)); r.setProperty('--coverK', (((V.fx && V.fx.coverPulse) ?? 100) / 100).toFixed(2)); r.setProperty('--vizDim', (((V.fx && V.fx.bgDim) ?? 0) / 100).toFixed(2));
  window.PulseBackground?.apply();
  if (typeof analyser !== 'undefined' && analyser) analyser.smoothingTimeConstant = Math.max(0, Math.min(0.9, (V.smooth ?? 30) / 100));
  if (Viz.setReact) Viz.setReact((V.react ?? 60) / 100);
}
// ---------- экспорт / импорт ----------
function exportSettings() {
  const settings = JSON.parse(JSON.stringify(S()));
  // Public presets must never contain the user's Spicy Lyrics API key or track cues.
  if(settings.spicy)settings.spicy.key='';
  const data = { pulse: 1, settings, vizStyle: lib.vizStyle, mode: lib.mode, tab: lib.tab, mini: !!lib.mini };
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
  a.download = 'pulse-settings.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); toast('Настройки сохранены в файл', 'save');
}
function importSettings() {
  const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json';
  i.onchange = async () => { try { const d = JSON.parse(await i.files[0].text()); if (!d.settings) throw new Error('не тот файл'); lib.settings = mergeDeep(DEF_SETTINGS, d.settings); if (Viz.STYLES.some(v=>v.id===d.vizStyle)) lib.vizStyle = d.vizStyle; if (d.midi) lib.midi = d.midi; if(['cover','video','visual'].includes(d.mode))lib.mode=d.mode; if(['next','lyrics','related'].includes(d.tab))lib.tab=d.tab; if(typeof d.mini==='boolean')lib.mini=d.mini; document.body.classList.toggle('mini',!!lib.mini); applySettings(); if(typeof czApply==='function')czApply(); if(typeof discordApply==='function')discordApply(); if(typeof wallApply==='function')wallApply('wall.on'); updateButtons(); save(); rerenderSettings(); toast('Настройки загружены', 'check'); } catch (e) { toast('Не удалось прочитать файл: ' + e.message, 'alert'); } };
  i.click();
}
// ---------- всплывающие панели рядом с текстом и визуалом ----------
const pops = { ly: false, viz: false };
function popHtml(title, rows, tab) {
  return `<div class="set-wrap pop-in"><div class="pop-h"><b>${title}</b><button class="ib sm" data-sact="cx:popreset:${tab}" title="Сбросить эти настройки">${ico('refresh')}</button><button class="ib sm" data-popx>${ico('x')}</button></div><div class="pop-b">${rows.map(rowHtml).join('')}</div></div>`;
}
function renderLyPop() {
  const el = $('lyPop'); const y = el.querySelector('.pop-b') ? el.querySelector('.pop-b').scrollTop : 0;
  el.innerHTML = popHtml('Вид текста', [...(typeof lyPreviewRow === 'function' ? [lyPreviewRow(true)] : []), R('Размер', '', rng('ly.size', 70, 150, 5, '%')), R('Выравнивание', '', seg('ly.align', [['left', 'Слева'], ['center', 'По центру']])), R('Подсветка', '', seg('ly.mode', [['words', 'По словам'], ['lines', 'Строкой']])),
    R('Свечение', '', tg('ly.glow')), R('Размывать дальние', '', tg('ly.blur')), lineFxRow(), ...lyLookRows(), R('Скорость прокрутки', '', rng('ly.speed', 15, 150, 5, '')), R('Сдвиг всего текста', '', rng('ly.lag', -500, 800, 20, 'ms'))], 'ly');
  const b = el.querySelector('.pop-b'); if (b) b.scrollTop = y;
}
function renderVizPop() {
  const el = $('vizPop'); const y = el.querySelector('.pop-b') ? el.querySelector('.pop-b').scrollTop : 0;
  el.innerHTML = popHtml('Эффекты визуала', [R('Текст на фоне визуала', 'Строка песни поверх визуализации', tg('ly.visLine'), 'текст строка'), ...(S().ly.visLine ? [R('↳ Размер строки', '', rng('ly.visSize', 60, 170, 5, '%'))] : []), lineFxRow(), R('Чувствительность', '', rng('viz.sens', 50, 200, 10, '%')), R('Отзывчивость', '', rng('viz.react', 0, 100, 5, '%')), R('Сдвиг', '', rng('viz.lag', -200, 400, 10, 'ms')), ...vizFxRows()], 'viz');
  const b = el.querySelector('.pop-b'); if (b) b.scrollTop = y;
}
function rerenderPops() { if (pops.ly) renderLyPop(); if (pops.viz) renderVizPop(); }
function closeLyPop() { pops.ly = pops.viz = false; for(const id of ['lyPop','vizPop'])PulseMotion.panel($(id),false,{clear:true}); }
const closeOthers = () => { hideMenu(); if (typeof fixOpen !== 'undefined' && fixOpen && typeof closeFix === 'function') closeFix(); };
$('lyLookBtn').onclick = (e) => { e.stopPropagation(); const on = !pops.ly; closeLyPop(); closeOthers(); pops.ly = on; if (on) { renderLyPop(); PulseMotion.panel($('lyPop'),true); fitPop($('lyPop')); } };
$('vizFx').onclick = (e) => { e.stopPropagation(); const on = !pops.viz; closeLyPop(); closeOthers(); pops.viz = on; if (on) { renderVizPop(); PulseMotion.panel($('vizPop'),true); fitPop($('vizPop')); } };
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-popx]')) { closeLyPop(); return; }
  if ((pops.ly || pops.viz) && !e.target.closest('.pop-panel,#lyLookBtn,#vizFx')) closeLyPop();
});
['lyPop', 'vizPop'].forEach((id) => ['click', 'mousedown', 'dblclick'].forEach((ev) => $(id).addEventListener(ev, (e) => { if (ev === 'click' && e.target.closest('[data-popx]')) { e.stopPropagation(); closeLyPop(); return; } if (ev === 'mousedown' && !e.target.closest('#menu')) hideMenu(); e.stopPropagation(); })));
// ---------- прокрутка текста колесом и мышью ----------
(() => {
  const box = $('lyScroll');
  box.addEventListener('wheel', (e) => { if (!lyState.lines || !$('lyInner')) return; e.preventDefault(); lyManual(e.deltaY * (e.deltaMode === 1 ? 32 : 1)); }, { passive: false });
  let d = null;
  box.addEventListener('pointerdown', (e) => { if (e.button !== 0 || !lyState.lines) return; d = { y: e.clientY, last: e.clientY, moved: false, id: e.pointerId }; });
  window.addEventListener('pointermove', (e) => { if (!d) return; if (!d.moved && Math.abs(e.clientY - d.y) > 5) { d.moved = true; lyState.drag = true; try { box.setPointerCapture(d.id); } catch {} } if (d.moved) { lyManual(d.last - e.clientY); d.last = e.clientY; } });
  window.addEventListener('pointerup', () => { if (!d) return; if (d.moved) { lyState.dragged = true; setTimeout(() => (lyState.dragged = false), 60); if (lyState.manual) lyState.manual.until = performance.now() + (S().ly.backDelay ?? 4) * 1000; } lyState.drag = false; d = null; });
  $('lyBack').onclick = (e) => { e.stopPropagation(); lyResume(); lyState.cur = -2; lyricsFrame(heard(S().ly.lag || 0)); };
})();

// превью стекла: схематичное окно поверх «рабочего стола»
function liquidPreview() {
  const U = S().ui, op = (U.liquidOp ?? 35) / 100, m = U.liquidMat || 'acrylic', blur = m === 'acrylic' ? 10 : m === 'clear' ? 0 : 4;
  return edBox('liquid', `<div class="pv pv-liquid"><div class="pv-desk"><i></i><i></i><i></i><b>Рабочий стол</b></div><div class="pv-win" data-ed="win" style="background:rgba(${hex2rgb(U.bg || '#06050c').join(',')},${op});backdrop-filter:blur(${blur}px) saturate(${m === 'mica' ? 1.8 : 1.3})"><div class="pv-top"></div><div class="pv-body"><span></span><span></span><span></span></div><div class="pv-bar"></div></div><em>Предпросмотр</em></div>`);
}
