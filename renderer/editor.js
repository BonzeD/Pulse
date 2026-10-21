'use strict';
// Pulse 1.9.3 — Редактор: отдельная вкладка настроек (большой холст + панель свойств).
// В остальных вкладках — только живой предпросмотр и кнопка «Открыть в редакторе».
// Виджет: каждый элемент (обложка, название, исполнитель, каждая кнопка, полоса, время) двигается, масштабируется и скрывается отдельно.
// Мышь обрабатывает окно Pulse (прозрачный слой поверх фрейма) — фрейм только рисует. Раньше перетаскивание жило во фрейме и в Electron не работало.
// «Приложение» — правка живого окна (главная, обзор, библиотека, плеер внизу…), см. customize.js.

const edSel = {}, edSub = {};
let edFull = null; // оставлено для совместимости со старыми вызовами
window.edEscape = () => {};
const wSize = () => S().widget.size || 'standard';
const BTN_N = { like: 'Лайк', dislike: 'Не нравится', shuffle: 'Перемешать', prev: 'Назад', play: 'Play', next: 'Вперёд', repeat: 'Повтор', vol: 'Громкость' };
const EL_N = { cover: 'Обложка', info: 'Блок названия', t: 'Название', a: 'Исполнитель', ll: 'Строка песни', lyr: 'Текст песни', ctl: 'Блок кнопок', ...BTN_N, prog: 'Блок прогресса', bar: 'Полоса прогресса', tc: 'Время · прошло', td: 'Время · всего', bg: 'Фон и рамка', layout: 'Раскладка' };
const EL_PARENT = { t: 'info', a: 'info', ll: 'info', like: 'ctl', dislike: 'ctl', shuffle: 'ctl', prev: 'ctl', play: 'ctl', next: 'ctl', repeat: 'ctl', vol: 'ctl', bar: 'prog', tc: 'prog', td: 'prog' };
const EL_KEYS = ['cover', 'info', 't', 'a', 'll', 'lyr', 'ctl', 'like', 'dislike', 'shuffle', 'prev', 'play', 'next', 'repeat', 'vol', 'prog', 'bar', 'tc', 'td'];
const ROW_N = { info: 'Название', ctl: 'Кнопки', prog: 'Прогресс', lyr: 'Текст песни' };
// какие кнопки реально видны в текущем размере (← → перескакивают через скрытые)
function ctlShown() {
  const w = S().widget, sz = wSize(), hid = new Set(w.hideBtns || []), fr = wFree();
  return (k) => !hid.has(k) && !(fr[k] && fr[k].h) && !(sz === 'mini' && ['like', 'dislike', 'shuffle', 'repeat', 'vol'].includes(k)) && !(sz === 'standard' && k === 'shuffle')
    && !(w.extra === false && ['like', 'dislike', 'shuffle', 'repeat'].includes(k)) && !(w.vol === false && k === 'vol');
}
const rowShown = (k) => !(k === 'lyr' && S().widget.lyrics === false);

// ---------- поэлементные правки: widget.free[размер][элемент] = { x, y, s, h } ----------
function wFreeAll() {
  const w = S().widget; if (!w.free || typeof w.free !== 'object' || Array.isArray(w.free)) w.free = {};
  // миграция сдвигов блоков 1.9.1/1.9.2 (widget.off)
  const o = w.off && typeof w.off === 'object' ? w.off : {};
  const conv = (size, m) => { for (const b in m) if (Array.isArray(m[b])) { const f = (w.free[size] = w.free[size] || {}); if (!f[b]) f[b] = { x: m[b][0], y: m[b][1] }; } };
  if (['cover', 'info', 'ctl', 'prog', 'lyr'].some((b) => Array.isArray(o[b]))) conv(wSize(), o); else for (const s in o) if (o[s] && typeof o[s] === 'object') conv(s, o[s]);
  if (Object.keys(o).length) w.off = {};
  return w.free;
}
const wFree = () => { const a = wFreeAll(), s = wSize(); return a[s] && typeof a[s] === 'object' ? a[s] : (a[s] = {}); };
function setFree(k, patch, noPanel) {
  const all = wFreeAll(), s = wSize(), m = { ...(all[s] || {}) }, v = { ...(m[k] || {}), ...patch };
  if (!v.x) delete v.x; if (!v.y) delete v.y; if (!v.s || v.s === 100) delete v.s; if (!v.h) delete v.h;
  if (Object.keys(v).length) m[k] = v; else delete m[k];
  all[s] = m; settingChanged('widget.free'); save(); if (!noPanel) edPanelsSoon(60);
}
const clampR = (v, [lo, hi]) => Math.max(Math.min(lo, 0), Math.min(Math.max(hi, 0), v));
function freeRows(k) {
  const v = wFree()[k] || {}, moved = v.x || v.y, s = v.s || 100;
  return [
    R('Положение', moved ? `Сдвинуто на ${v.x || 0}, ${v.y || 0} px · стрелки — 1 px, Shift — 10 px` : 'Тяни мышью в предпросмотре или двигай стрелками', moved ? `<button class="btn sm ghost" data-sact="cx:edfree:pos:${k}">${ico('undo')}На место</button>` : '<span class="ed-auto">на месте</span>'),
    R('Размер элемента', 'Или колесо мыши над предпросмотром', `<div class="rng"><input type="range" min="40" max="250" step="5" value="${s}" data-free="${k}"><span data-freev="${k}">${s}%</span></div>`),
    R(v.h ? 'Элемент скрыт' : 'Видимость', v.h ? 'В виджете его не видно (в редакторе — полупрозрачный)' : '', `<button class="btn sm ${v.h ? 'acc' : ''}" data-sact="cx:edfree:hide:${k}">${ico('eye')}${v.h ? 'Показать' : 'Скрыть'}</button>`),
    ...(EL_PARENT[k] ? [R('Весь блок', `${EL_N[EL_PARENT[k]]} — двигать вместе с соседями`, `<button class="btn sm ghost" data-edpick="widget:${EL_PARENT[k]}">${ico('up')}Выбрать блок</button>`)] : [])
  ];
}

const xyRow = (key) => { const v = S().wall[key]; return v ? R('Своё место', 'Перетащено мышью · кнопки выше вернут обычное положение', `<button class="btn sm ghost" data-sact="cx:edxy:${key}">${ico('undo')}Сбросить</button>`) : null; };
const colA = (path, fb) => { const v = getP(path) || ''; return `<label class="colr ${v ? '' : 'auto'}" style="background:${esc(v || fb)}" title="Выбрать цвет"><input type="color" value="${esc(v || fb)}" data-col="${path}"></label>${v ? `<button class="btn sm ghost" data-sact="cx:edclr:${path}">Авто</button>` : '<span class="ed-auto">авто</span>'}`; };
const wRowsKey = () => ({ mini: 'rowsMini', large: 'rowsLarge' }[S().widget.size] || 'rowsStd');

const ED = {
  widget() {
    const w = S().widget, rk = wRowsKey(), rows = w[rk] || [], fr = wFree();
    const hidden = [...(w.hideBtns || []).map((k) => [k, 'edhide:' + k]), ...Object.keys(fr).filter((k) => fr[k] && fr[k].h).map((k) => [k, 'edfree:hide:' + k])];
    const hidHtml = hidden.length ? hidden.map(([k, a]) => `<button class="chip sm" data-sact="cx:${a}">${ico('eye')}${EL_N[k] || k}</button>`).join('') : '<span class="ed-auto">нет</span>';
    const T = {
      cover: [R('Показывать обложку', '', tg('widget.cover')), R('Ячейка обложки', 'Сколько места занимает в раскладке', rng('widget.coverSize', 60, 150, 5, '%')), R('Форма', '', seg('widget.coverShape', [['square', 'Квадрат'], ['round', 'Скруглённая'], ['circle', 'Круг']])), ...(w.coverShape === 'circle' ? [R('Вращать как пластинку', 'Пока играет музыка', tg('widget.coverSpin'))] : []), R('Сторона', '', seg('widget.coverSide', [['left', 'Слева'], ['right', 'Справа']])), R('Эквалайзер на обложке', '', tg('widget.eq'))],
      info: [R('Выравнивание', '', seg('widget.align', [['left', 'Слева'], ['center', 'По центру']])), R('Шрифт виджета', '', seg('widget.font', [['default', 'Обычный'], ['rounded', 'Мягкий'], ['wide', 'Широкий'], ['serif', 'С засечками'], ['mono', 'Моно']])), R('Бегущая строка', 'Длинное название плавно прокручивается', tg('widget.marquee'))],
      t: [R('Размер шрифта', '', rng('widget.tSize', 70, 170, 5, '%')), R('Цвет', '', colA('widget.tColor', '#f4f1ff')), R('Толщина', '', seg('widget.tWeight', [[500, 'Обычный'], [700, 'Жирный'], [900, 'Очень']])), R('Бегущая строка', '', tg('widget.marquee'))],
      a: [R('Размер шрифта', '', rng('widget.aSize', 70, 170, 5, '%')), R('Цвет', '', colA('widget.aColor', '#b8b0d6'))],
      ll: [R('Показывать текст', '', tg('widget.lyrics')), R('Размер шрифта', '', rng('widget.lSize', 70, 170, 5, '%')), R('Цвет спетых слов', '', colA('widget.lColor', '#ffffff'))],
      ctl: [R('Размер кнопок', '', rng('widget.ctlScale', 70, 150, 5, '%')), R('Цвет значков', '', colA('widget.iconColor', '#d6d0ee')), R('Лайк, перемешать, повтор', '', tg('widget.extra')), R('Громкость', '', tg('widget.vol')), R('Порядок кнопок', 'Выбери кнопку и жми ← → или просто перетащи её', `<button class="btn sm ghost" data-sact="cx:edmvreset:ctl">${ico('undo')}Как было</button>`)],
      play: [R('Стиль', '', seg('widget.playStyle', [['white', 'Белая'], ['grad', 'Градиент'], ['solid', 'Цвет'], ['ring', 'Контур'], ['flat', 'Плоская']])), R('Цвет', 'Авто — цвет обложки', colA('widget.playColor', '#ff2d95'))],
      prog: [R('Полоса прогресса', '', tg('widget.progress')), R('Время трека', '', tg('widget.time')), R('Толщина', '', rng('widget.progH', 2, 10, 1, 'px')), R('Цвет', 'Авто — градиент обложки', colA('widget.progColor', '#ff2d95'))],
      bar: [R('Толщина', '', rng('widget.progH', 2, 10, 1, 'px')), R('Цвет', 'Авто — градиент обложки', colA('widget.progColor', '#ff2d95'))],
      time: [R('Время трека', '', tg('widget.time'))]
    };
    T.lyr = T.ll;
    const btnRows = (k) => [R('Порядок', 'Поменять местами с соседней кнопкой', `<div class="seg"><button data-sact="cx:edmv:widget.ctlOrder:${k}:-1">← Левее</button><button data-sact="cx:edmv:widget.ctlOrder:${k}:1">Правее →</button></div>`), ...(k === 'play' ? T.play : [R('Цвет значков', 'Для всех кнопок', colA('widget.iconColor', '#d6d0ee'))])];
    const reg = {};
    EL_KEYS.forEach((k) => { reg[k] = { n: EL_N[k], rows: [...freeRows(k), grp('Оформление'), ...(BTN_N[k] ? btnRows(k) : T[k] || (k === 'tc' || k === 'td' ? T.time : []))] }; });
    reg.bg = { n: 'Фон и рамка', rows: [R('Стиль', '', seg('widget.theme', [['glass', 'Стекло'], ['clear', 'Прозрачный'], ['dark', 'Тёмный'], ['neon', 'Неон']])), R('Оттенок фона', '', colA('widget.bgColor', '#0e0b18')), R('Непрозрачность', '', rng('widget.opacity', 40, 100, 5, '%')), R('Размытие обложки', '', rng('widget.blur', 0, 60, 2, 'px')), R('Скругление углов', '', rng('widget.radius', 0, 30, 1, 'px')), R('Светящаяся рамка', '', tg('widget.border')), R('Тень', '', tg('widget.shadow'))] };
    reg.layout = { n: 'Раскладка', rows: [R('Порядок строк', 'Стрелки меняют строки местами', `<div class="ed-list">${rows.map((r) => `<div><span>${ROW_N[r] || r}</span><button class="ib sm" data-sact="cx:edmv:rows:${r}:-1" title="Выше">↑</button><button class="ib sm" data-sact="cx:edmv:rows:${r}:1" title="Ниже">↓</button></div>`).join('')}</div>`),
      R('Обложка', '', seg('widget.coverSide', [['left', 'Слева'], ['right', 'Справа']])),
      R('Скрытые элементы', 'Нажми, чтобы вернуть', `<div class="ed-chiprow">${hidHtml}</div>`),
      R('Сдвиги и размеры', `Всё, что двигали и масштабировали (размер «${{ mini: 'Мини', standard: 'Стандарт', large: 'Большой' }[wSize()]}»)`, Object.keys(fr).length ? `<button class="btn sm ghost" data-sact="cx:edfree:all">${ico('undo')}Всё на места</button>` : '<span class="ed-auto">нет</span>'),
      R('Сбросить вид виджета', 'Вернуть оформление по умолчанию (поведение не трогается) · Ctrl+Z — вернуть', `<button class="btn sm ghost" data-sact="cx:edreset:widget">${ico('refresh')}Сбросить</button>`)] };
    return reg;
  },

  wall() {
    const W = S().wall;
    return {
      card: { n: 'Карточка трека', rows: [R('Показывать', '', tg('wall.info')), R('Где', 'Или перетащи карточку мышью куда угодно', seg('wall.infoPos', [['tl', '↖'], ['tr', '↗'], ['c', 'Центр'], ['bl', '↙'], ['br', '↘']])), R('Размер', '', rng('wall.infoSize', 60, 180, 5, '%')),
        R('Стиль', '', seg('wall.cardStyle', WALL_CARD)), R('Плотность подложки', '', rng('wall.cardOp', 0, 90, 5, '%')), R('Скругление', '', rng('wall.cardRadius', 0, 40, 2, 'px')), R('Обложка', '', seg('wall.artShape', WALL_ART)), R('Шрифт', '', sel('wall.cardFont', WALL_FONTS())), R('Полоса прогресса', '', tg('wall.progress')), xyRow('infoXY')].filter(Boolean) },
      ctl: { n: 'Кнопки на обоях', rows: [R('Показывать', '', tg('wall.controls')), R('Переключение песен', 'Кнопки ⏮ ⏯ ⏭ и перемотка по полосе — клики прямо по рабочему столу', ''), R('Кнопка «Нравится»', '', tg('wall.likeBtn'))] },
      ly: { n: 'Строка текста', rows: [R('Показывать', '', tg('wall.lyrics')), R('Где', 'Или перетащи строку мышью куда угодно', seg('wall.lyPos', [['top', 'Сверху'], ['middle', 'По центру'], ['bottom', 'Снизу']])), R('Размер', '', rng('wall.lySize', 60, 180, 5, '%')),
        R('Шрифт', '', sel('wall.lyFont', WALL_FONTS())), R('Толщина', '', seg('wall.lyWeight', WALL_WEIGHT)), R('Цвет', '', colA('wall.lyColor', '#ffffff')), R('Свечение цветом трека', '', tg('wall.lyGlow')), R('Подложка под строкой', '', tg('wall.lyPlate')), xyRow('lyXY')].filter(Boolean) },
      clock: { n: 'Часы', rows: [R('Показывать', '', tg('wall.clock')), R('Где', 'Или перетащи часы мышью', seg('wall.clockPos', [['top', 'Сверху'], ['bottom', 'Снизу']])), R('Размер', '', rng('wall.clockSize', 50, 170, 5, '%')),
        R('Дизайн', '', seg('wall.clockStyle', WALL_CLOCK)), R('Шрифт', '', sel('wall.clockFont', WALL_FONTS())), R('Цвет', '', colA('wall.clockColor', '#ffffff')), R('Секунды', '', tg('wall.clockSec')), R('12-часовой формат', '', tg('wall.clock12')), R('Дата', '', tg('wall.clockDate')),
        R('Подложка', '', seg('wall.clockPlate', WALL_PLATE)), ...(W.clockPlate && W.clockPlate !== 'none' ? [R('Плотность подложки', '', rng('wall.clockPlateOp', 5, 90, 5, '%'))] : []), xyRow('clockXY')].filter(Boolean) },
      viz: { n: 'Визуал', rows: [R('Стиль', '', sel('wall.style', [['same', 'Как в плеере'], ...Viz.STYLES.map((v) => [v.id, v.name])])), R('Размер', '', rng('wall.scale', 60, 160, 5, '%')), R('Свечение', '', tg('wall.glow'))] },
      bg: { n: 'Фон', rows: [R('Фон', '', seg('wall.bg', [['cover', 'Обложка'], ['accent', 'Цвет трека'], ['dark', 'Тёмный'], ['black', 'Чёрный']])), R('Затемнение', '', rng('wall.dim', 0, 90, 5, '%'))] }
    };
  },
  discord() {
    const D = S().discord, tok = 'Можно вставлять {title} {artist} {album}';
    return {
      head: { n: 'Заголовок', rows: [R('Тип активности', '', seg('discord.type', [['listen', 'Слушает'], ['watch', 'Смотрит'], ['play', 'Играет']])), R('В списке участников', '', seg('discord.display', [['name', 'Pulse'], ['state', 'Исполнитель'], ['details', 'Трек']]))] },
      img: { n: 'Картинка', rows: [R('Обложка трека', '', tg('discord.cover')), R('Значок плей / пауза', '', tg('discord.small'))] },
      album: { n: 'Альбом / подпись обложки', rows: [R('Показывать подпись', 'Скрывается отдельно от обложки. В Discord видна при наведении на картинку; здесь показана строкой для редактирования', tg('discord.album')), R('Шаблон подписи', tok, xTxt('discord.tplImg', '{album}', 200))] },
      l1: { n: 'Первая строка', rows: [R('Показывать трек', 'Выключено — «Слушает музыку»', tg('discord.title')), R('Шаблон', tok, xTxt('discord.tpl1', '{title}', 200))] },
      l2: { n: 'Вторая строка', rows: [R('Показывать', '', tg('discord.artist')), R('Шаблон', tok, xTxt('discord.tpl2', '{artist}', 200)), R('Строка текста песни вместо неё', '', tg('discord.lyric')), R('Текст на паузе', '', xTxt('discord.pauseText', 'Пауза', 160))] },
      time: { n: 'Время', rows: [R('Показывать время', '', tg('discord.time')), R('Как', '', seg('discord.timeMode', [['bar', 'Таймлайн'], ['elapsed', 'Прошло'], ['left', 'Осталось']]))] },
      btns: { n: 'Кнопки', rows: [R('Кнопка трека', '', tg('discord.buttons')), R('↳ Подпись', 'До 32 символов', xTxt('discord.btnLabel', 'Слушать в YouTube Music', 200)), R('Кнопка «Исполнитель»', '', tg('discord.btnArtist')), R('Своя кнопка', 'Например, ссылка на твой канал', tg('discord.btnCustom')), ...(D.btnCustom ? [R('↳ Подпись', '', xTxt('discord.btnCustomLabel', 'Мой канал', 160)), R('↳ Ссылка', 'https://…', xTxt('discord.btnCustomUrl', 'https://', 220))] : [])] }
    };
  },
  ly() {
    return {
      cur: { n: 'Поющаяся строка', rows: [R('Размер', '', rng('ly.size', 70, 150, 5, '%')), R('Подсветка', '', seg('ly.mode', [['words', 'По словам'], ['lines', 'Строкой']])), R('Цвет', '', seg('ly.color', [['accent', 'Акцент'], ['white', 'Белый'], ['custom', 'Свой']]) + (S().ly.color === 'custom' ? colr('ly.colorC') : '')), R('Свечение', '', tg('ly.glow')), R('Жирность', '', seg('ly.weight', [[500, 'Обычный'], [700, 'Полужирный'], [800, 'Жирный'], [900, 'Очень']]))] },
      rest: { n: 'Остальные строки', rows: [R('Яркость', '', rng('ly.dimOp', 5, 80, 5, '%')), R('Размывать дальние', '', tg('ly.blur')), R('Межстрочный интервал', '', rng('ly.spacing', 100, 190, 5, '%')), R('Выравнивание', '', seg('ly.align', [['left', 'Слева'], ['center', 'По центру']]))] }
    };
  },
  viz() {
    return {
      viz: { n: 'Визуал', rows: [R('Чувствительность', '', rng('viz.sens', 30, 200, 5, '%')), R('Свечение', '', rng('viz.fx.glow', 0, 200, 10, '%')), R('Толщина линий', '', rng('viz.fx.thick', 40, 250, 10, '%')), R('Плотность', '', rng('viz.fx.density', 40, 200, 10, '%'))] }
    };
  },
  app() {
    return {
      top: { n: 'Верхняя панель', rows: [R('Стекло', 'Полупрозрачные панели с размытием', tg('ui.glass'))] },
      shape: { n: 'Форма', rows: [R('Скругление углов', '−1 — как задумано темой', rng('ui.radius', -1, 30, 1, 'px')), R('Размер текста', '', rng('ui.fontSize', 12, 18, 1, 'px'))] },
      side: { n: 'Боковая панель', rows: [R('Ширина', '', rng('ui.side', 180, 320, 10, 'px'))] },
      bar: { n: 'Плеер внизу', rows: [R('Высота', '', rng('ui.bar', 60, 96, 2, 'px'))] }
    };
  }
};
const ED_HINT = { widget: 'Кликни на любой элемент виджета · тяни мышью, чтобы передвинуть · колесо — размер', wall: 'Кликни на элемент · карточку, текст и часы тяни мышью куда угодно', discord: 'Кликни на строку, картинку или кнопку в карточке', ly: 'Кликни на строку в предпросмотре', viz: 'Кликни на визуал', app: 'Общие настройки оформления всего окна. Для перемещения элементов открой «Окно Pulse»' };
const wChips = () => { const sz = wSize(); return ['cover', 't', 'a', sz === 'large' ? 'lyr' : 'll', 'ctl', 'play', 'prog', 'bg', 'layout']; };

function edPanelHtml(scope) {
  let reg; try { reg = ED[scope](); } catch (e) { console.error(e); return ''; }
  const k = edSel[scope], e = k && reg[k];
  const keys = scope === 'widget' ? wChips() : Object.keys(reg);
  const chips = keys.filter((x) => reg[x]).map((x) => `<button class="${x === k || (scope === 'widget' && EL_PARENT[k] === x) ? 'on' : ''}" data-edpick="${scope}:${x}">${reg[x].n}</button>`).join('');
  const hist = scope === 'widget' ? `<div class="ed-hist"><button class="ib sm" data-sact="cx:edundo:1" title="Отменить (Ctrl+Z)" ${wHist.undo.length ? '' : 'disabled'}>${ico('undo')}</button><button class="ib sm ed-redo" data-sact="cx:edredo:1" title="Вернуть (Ctrl+Shift+Z)" ${wHist.redo.length ? '' : 'disabled'}>${ico('undo')}</button></div>` : '';
  return `<div class="ed-top">${ico('edit')}<b>${e ? esc(e.n) : 'Ничего не выбрано'}</b><span></span>${hist}${e ? `<button class="ib sm" data-edpick="${scope}:" title="Снять выбор">${ico('x')}</button>` : ''}</div>
    <div class="ed-chips">${chips}</div>${e ? `<div class="ed-rows">${e.rows.map(rowHtml).join('')}</div>` : `<div class="ed-empty">${esc(ED_HINT[scope] || '')}</div>`}`;
}
// в обычных вкладках — только предпросмотр; клик по нему или по кнопке открывает «Редактор»
const edBox = (scope, inner) => `<div class="ed ed-mini" data-ed-scope="${scope}"><div class="ed-preview-actions"><button class="btn sm ed-open" data-edgo="${scope}">${ico('edit')}Открыть в редакторе</button></div>${inner}</div>`;
const edPanelFor = (p, sc) => (p.classList.contains('czd-set') && window.czPartPanel ? czPartPanel(sc) : edPanelHtml(sc)); // в панели единого редактора — её разметка
function edPanels() { for (const sc in ED) { const p = document.getElementById('edp-' + sc); if (p) { p.innerHTML = edPanelFor(p, sc); if (window.czFolds) czFolds(p); } } edMarkAll(); }
let edPanelsT = 0;
const edPanelsSoon = (ms) => { clearTimeout(edPanelsT); edPanelsT = setTimeout(edPanels, ms); };
function edPick(scope, k) { edSel[scope] = k || null; edSub[scope] = null; const p = document.getElementById('edp-' + scope); if (p) { p.innerHTML = edPanelFor(p, scope); if (window.czFolds) czFolds(p); } edMark(scope); }
function edMark(scope) {
  const k = edSel[scope];
  if (scope === 'widget') return pvWidgetMark();
  document.querySelectorAll(`[data-ed-scope="${scope}"] [data-ed]`).forEach((el) => el.classList.toggle('ed-on', !!k && el.dataset.ed === k));
}
function edMarkAll() { for (const sc in ED) edMark(sc); }
window.pvEdPick = (scope, k) => edPick(scope, k);

// ---------- вкладка «Редактор» ----------
const ED_SCOPES = [['window', 'Всё окно', 'home'], ['widget', 'Мини-виджет', 'widget'], ['wall', 'Обои', 'wallpaper'], ['discord', 'Discord', 'discord'], ['ly', 'Текст песни', 'lyrics'], ['viz', 'Визуал', 'sparkle'], ['app', 'Оформление окна', 'palette']];
const ED_PV = {
  widget: () => widgetPreview(true),
  wall: () => `<div id="pvWallBox">${wallPreviewInner()}</div>`,
  discord: () => discordPreview(),
  ly: () => lyPreviewRow(true).raw.replace('pv-ly sm', 'pv-ly'),
  viz: () => `<div class="pv pv-viz"><canvas id="pvViz" data-ed="viz"></canvas><em id="pvVizCap">Предпросмотр визуала</em></div>`,
  app: () => appPreview()
};
const edScope = () => (ED_SCOPES.some((x) => x[0] === lib.edScope) ? lib.edScope : 'window');
// 2.0: вкладка «Редактор» — не отдельный редактор, а вход в единый редактор (customize.js): карточки всех частей Pulse
function editorTab() { return { id: 'editor', icon: 'edit', title: 'Редактор', full: true, launch: true, rows: [], html: () => (typeof czLauncher === 'function' ? czLauncher() : '') }; }
// любая кнопка «Открыть в редакторе» открывает единый редактор сразу на нужной части
window.openEditor = (sc) => {
  if (sc === 'liquid') sc = 'app'; if (sc === 'customize' || !sc) sc = 'window';
  if (typeof czPart === 'function') return czPart(sc);
  lib.edScope = sc; lib.setTab = 'editor'; save(); go({ r: 'settings' });
};
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && !e.altKey && !e.shiftKey && e.code === 'KeyE' && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) { e.preventDefault(); openEditor(); }
});

// клики редактора. Слушаем на window в фазе захвата: общий обработчик настроек (app.js) не должен обрабатывать их второй раз.
const edStop = (e) => { e.stopPropagation(); e.stopImmediatePropagation(); };
window.addEventListener('click', (e) => {
  const t = e.target; if (!t.closest) return;
  const go = t.closest('[data-edgo]');
  if (go) { edStop(e); openEditor(go.dataset.edgo); return; }
  const scb = t.closest('[data-edscope]');
  if (scb) { edStop(e); lib.edScope = scb.dataset.edscope; save(); rerenderSettings(); return; }
  const p = t.closest('[data-edpick]');
  if (p) { edStop(e); const [sc, k] = p.dataset.edpick.split(':'); edPick(sc, k && edSel[sc] === k && !p.closest('.ed-rows') ? null : k); return; }
  const el = t.closest('.ed [data-ed]');
  if (el && wDrag.moved) { edStop(e); e.preventDefault(); wDrag.moved = false; return; }
  if (el) { edStop(e); e.preventDefault(); const box = el.closest('[data-ed-scope]'), sc = box.dataset.edScope; if (box.classList.contains('ed-mini')) { edSel[sc] = el.dataset.ed; openEditor(sc); } else edPick(sc, el.dataset.ed); return; }
  const c = t.closest('.ed-panel [data-set], .ed-panel [data-tg]');
  if (c && c.closest('.set-wrap')) {
    edStop(e);
    if (c.dataset.tg) { const pth = c.dataset.tg, v = !getP(pth); setP(pth, v); document.querySelectorAll(`.toggle[data-tg="${pth}"],.set-cell[data-tg="${pth}"]`).forEach((x) => x.classList.toggle('on', v)); settingChanged(pth); edPanelsSoon(230); return; }
    const pth = c.dataset.set, cur = getP(pth); let v = c.dataset.v; if (typeof cur === 'number') v = +v; setP(pth, v);
    document.querySelectorAll(`[data-set="${pth}"]`).forEach((x) => x.classList.toggle('on', x.dataset.v === String(v))); settingChanged(pth); edPanelsSoon(120);
  }
}, true);
// ползунок «Размер элемента»
window.addEventListener('input', (e) => { const r = e.target; if (!r.dataset || !r.dataset.free) return; edStop(e); const k = r.dataset.free, v = +r.value; setFree(k, { s: v }, true); document.querySelectorAll(`[data-freev="${k}"]`).forEach((x) => (x.textContent = v + '%')); }, true);
window.addEventListener('change', (e) => { const r = e.target; if (r.dataset && r.dataset.free) { edStop(e); edPanelsSoon(30); } }, true);
// выпадающие списки в панели — без полной перерисовки
document.addEventListener('change', (e) => { const s = e.target; if (s.dataset && s.dataset.sel && s.closest('.ed-panel')) { e.stopImmediatePropagation(); const cur = getP(s.dataset.sel); setP(s.dataset.sel, typeof cur === 'number' ? +s.value : s.value); settingChanged(s.dataset.sel); } }, true);

// ---------- действия редактора ----------
{ const base = customAct; customAct = function (a, el) { if (/^ed[a-z]+:/.test(a)) return edAct(a); return base(a, el); }; }
const ED_RESET = { widget: ['coverSize', 'coverShape', 'coverSide', 'coverSpin', 'tSize', 'tColor', 'tWeight', 'aSize', 'aColor', 'lSize', 'lColor', 'ctlScale', 'iconColor', 'playStyle', 'playColor', 'progH', 'progColor', 'bgColor', 'border', 'shadow', 'font', 'ctlOrder', 'hideBtns', 'rowsStd', 'rowsLarge', 'rowsMini', 'radius', 'blur', 'opacity', 'theme', 'align', 'off', 'free'] };
function edAct(a) {
  const [cmd, ...rest] = a.split(':');
  if (cmd === 'edundo') return wHistGo(-1);
  if (cmd === 'edredo') return wHistGo(1);
  if (cmd === 'edfree') {
    const [op, k] = rest;
    if (op === 'pos') setFree(k, { x: 0, y: 0 });
    if (op === 'hide') { const v = wFree()[k] || {}; setFree(k, { h: !v.h }); }
    if (op === 'all') { wFreeAll()[wSize()] = {}; settingChanged('widget.free'); }
    save(); edPanels(); return;
  }
  if (cmd === 'edclr') { const pth = rest.join(':'); setP(pth, ''); settingChanged(pth); if (!pth.startsWith('widget.')) applySettings(); }
  if (cmd === 'edmv') {
    let [list, key, dir] = rest; if (list === 'rows') list = 'widget.' + wRowsKey();
    const L = [...(getP(list) || [])], i = L.indexOf(key), shown = list === 'widget.ctlOrder' ? ctlShown() : rowShown;
    let j = i + +dir; while (j >= 0 && j < L.length && !shown(L[j])) j += +dir;
    if (i < 0 || j < 0 || j >= L.length) return toast(+dir < 0 ? 'Уже первая' : 'Уже последняя', 'info');
    [L[i], L[j]] = [L[j], L[i]]; setP(list, L); settingChanged(list);
  }
  if (cmd === 'edmvreset') { S().widget.ctlOrder = [...DEF_SETTINGS.widget.ctlOrder]; settingChanged('widget.ctlOrder'); }
  if (cmd === 'edhide') { const w = S().widget, k = rest[0], h = new Set(w.hideBtns || []); h.has(k) ? h.delete(k) : h.add(k); w.hideBtns = [...h]; settingChanged('widget.hideBtns'); }
  if (cmd === 'edreset') { const sc = rest[0]; (ED_RESET[sc] || []).forEach((k) => (S()[sc][k] = JSON.parse(JSON.stringify(DEF_SETTINGS[sc][k])))); settingChanged(sc + '.reset'); if (sc !== 'widget') applySettings(); else rerenderSettings(); toast('Вид сброшен · Ctrl+Z — вернуть', 'refresh'); }
  if (cmd === 'edxy') { setP('wall.' + rest[0], null); settingChanged('wall.' + rest[0]); }
  save(); edPanels();
}

// ---------- отмена / возврат правок виджета (Ctrl+Z, Ctrl+Shift+Z / Ctrl+Y) ----------
const wHist = { undo: [], redo: [], base: null, t: 0, busy: false };
const wSnap = () => JSON.stringify(S().widget);
function wHistInit() { if (wHist.base == null && lib.settings) wHist.base = wSnap(); }
function wHistCommit() {
  clearTimeout(wHist.t); wHist.t = 0; if (wHist.base == null) return wHistInit();
  const cur = wSnap(); if (cur === wHist.base) return;
  wHist.undo.push(wHist.base); if (wHist.undo.length > 100) wHist.undo.shift(); wHist.redo = []; wHist.base = cur; edHistBtns();
}
window.wHistMark = () => { if (wHist.busy) return; wHistInit(); clearTimeout(wHist.t); wHist.t = setTimeout(wHistCommit, 350); };
function wHistGo(dir) {
  if (wHist.t) wHistCommit();
  const from = dir < 0 ? wHist.undo : wHist.redo, to = dir < 0 ? wHist.redo : wHist.undo;
  if (!from.length) return toast(dir < 0 ? 'Нечего отменять' : 'Нечего возвращать', 'info');
  to.push(wHist.base); wHist.base = from.pop();
  wHist.busy = true; lib.settings.widget = JSON.parse(wHist.base); settingChanged('widget.history'); wHist.busy = false;
  save(); rerenderSettings(); edPanels();
}
function edHistBtns() { document.querySelectorAll('[data-sact="cx:edundo:1"]').forEach((b) => (b.disabled = !wHist.undo.length)); document.querySelectorAll('[data-sact="cx:edredo:1"]').forEach((b) => (b.disabled = !wHist.redo.length)); }

// ---------- мини-виджет: настоящий виджет во фрейме + слой мыши поверх ----------
const WSZ = { mini: [320, 84], standard: [420, 156], large: [460, 300] };
const pvW = { win: null, st: null, ly: null, cfg: null, fs: null, fc: null, fl: null, raf: 0 };
const pvWAlive = () => { try { return !!(pvW.win && !pvW.win.closed && pvW.win.frameElement && pvW.win.frameElement.isConnected); } catch { return false; } };
const pvA = () => (pvWAlive() && pvW.win.pvApi) || null;
const pvIsEdit = () => !!document.querySelector('#pvWidget.pv-edit');
const pvDemo = () => ({ has: true, id: 'pv-demo', title: 'Название трека', author: 'Исполнитель', playing: true, cur: 62, dur: 204, line: 'Здесь будет строка песни', volume: 70, liked: true, repeat: 'all', shuffle: false, art: 'logo.png', square: true });
window.pvWidgetApi = (w) => {
  pvW.win = w; pvW.fs = pvW.fc = pvW.fl = null;
  setTimeout(() => { const A = pvA(); if (A) A.setEdit(pvIsEdit()); if (pvW.fc) pvW.fc(pvW.cfg || {}); if (pvW.fs) pvW.fs(pvW.st && pvW.st.has ? pvW.st : pvDemo()); if (pvW.fl && pvW.ly) pvW.fl(pvW.ly); pvWidgetSize(); pvWidgetMark(); }, 0);
  return { onState: (f) => (pvW.fs = f), onWidgetConfig: (f) => (pvW.fc = f), onLyrics: (f) => (pvW.fl = f), command() {}, win() {} };
};
window.pvWidgetPush = (o) => { pvW.st = o; if (pvW.fs && pvWAlive()) pvW.fs(o && o.has ? o : pvDemo()); };
window.pvWidgetLy = (l) => { pvW.ly = l; if (pvW.fl && pvWAlive()) pvW.fl(l); };
// правки сыпятся десятками в секунду — во фрейм уходит не чаще раза за кадр
window.pvWidgetCfgPush = (c) => {
  pvW.cfg = c; if (pvW.raf) return;
  pvW.raf = requestAnimationFrame(() => { pvW.raf = 0; if (pvW.fc && pvWAlive()) { pvW.fc(pvW.cfg); pvWidgetMark(); } pvWidgetSize(); });
};
const ovS = { d: null, hov: null };
function pvWidgetMark() { const A = pvA(); if (A) A.mark(edSel.widget, ovS.hov); }
function pvWk(edit = pvIsEdit()) {
  const w = S().widget, [W, H] = WSZ[w.size] || WSZ.standard;
  if (edit) { const c = document.querySelector('.edt-canvas'); const cw = c ? c.clientWidth - 160 : 640, ch = c ? Math.max(240, c.clientHeight - 160) : 400; return Math.max(0.6, Math.min(cw / W, ch / H, 2.2)); }
  return Math.max(0.7, Math.min(1.5, (w.scale || 100) / 100)) * (w.size === 'mini' ? 1.35 : 1.15);
}
addEventListener('resize', () => pvIsEdit() && pvWidgetSize());
function pvWidgetSize() {
  const f = document.getElementById('pvWFrame'), fr = document.getElementById('pvWIframe'); if (!f || !fr) return;
  const w = S().widget, [W, H] = WSZ[w.size] || WSZ.standard, k = pvWk();
  f.style.width = W * k + 'px'; f.style.height = H * k + 'px'; fr.style.width = W + 'px'; fr.style.height = H + 'px'; fr.style.transform = `scale(${k})`;
}
function widgetPreview(edit) {
  const w = S().widget, [W, H] = WSZ[w.size] || WSZ.standard, k = pvWk(!!edit);
  if (edit) requestAnimationFrame(() => requestAnimationFrame(pvWidgetSize)); // холст ещё не в DOM — подгоняем размер после вставки
  return `<div class="pv pv-widget ${edit ? 'pv-edit' : ''}" id="pvWidget"><div class="pvw-frame" id="pvWFrame" style="width:${W * k}px;height:${H * k}px"><iframe id="pvWIframe" src="widget.html?pv=1" scrolling="no" tabindex="-1" style="width:${W}px;height:${H}px;transform:scale(${k})"></iframe><div class="pvw-ov" id="pvWOv"></div></div><em>${edit ? 'Живой виджет' : `Живой предпросмотр${w.onTop ? ' · поверх окон' : ''}${w.lock ? ' · закреплён' : ''}`}</em></div>`;
}
function ovPt(e) { const ov = document.getElementById('pvWOv'), r = ov.getBoundingClientRect(), [W] = WSZ[S().widget.size] || WSZ.standard, k = r.width / W; return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k, k }; }
document.addEventListener('pointerdown', (e) => {
  const ov = e.target.closest && e.target.closest('#pvWOv'); if (!ov || e.button !== 0) return;
  e.preventDefault(); const A = pvA(); if (!A) return;
  const p = ovPt(e), key = A.hit(p.x, p.y);
  if (!pvIsEdit()) { edSel.widget = key === 'bg' ? null : key; openEditor('widget'); return; }
  if (edSel.widget !== key) edPick('widget', key);
  if (key === 'bg' || !A.shown(key)) return;
  const v = A.get(key), lim = A.limits(key); if (!lim) return;
  ovS.d = { key, x0: e.clientX, y0: e.clientY, k: p.k, sx: v.x || 0, sy: v.y || 0, lim, on: false, x: v.x || 0, y: v.y || 0 };
  try { ov.setPointerCapture(e.pointerId); } catch {}
});
document.addEventListener('pointermove', (e) => {
  const d = ovS.d, A = pvA(); if (!A) return;
  if (!d) {
    const ov = e.target.closest && e.target.closest('#pvWOv'), hov = ov && pvIsEdit() ? A.hit(ovPt(e).x, ovPt(e).y) : null;
    if (hov !== ovS.hov) { ovS.hov = hov === 'bg' ? null : hov; pvWidgetMark(); }
    return;
  }
  if (!d.on && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 3) return;
  d.on = true; document.body.classList.add('pvw-drag');
  let x = clampR(d.sx + (e.clientX - d.x0) / d.k, d.lim.x), y = clampR(d.sy + (e.clientY - d.y0) / d.k, d.lim.y);
  const s0 = Math.abs(x) < 4, sc = !s0 && Math.abs(x - d.lim.cx) < 4, m0 = Math.abs(y) < 4, mc = !m0 && Math.abs(y - d.lim.cy) < 4;
  if (s0) x = 0; else if (sc) x = d.lim.cx; if (m0) y = 0; else if (mc) y = d.lim.cy;
  d.x = Math.round(x); d.y = Math.round(y); A.live(d.key, { x: d.x, y: d.y }); A.guides(sc, mc);
});
const ovEnd = () => { const d = ovS.d; if (!d) return; ovS.d = null; document.body.classList.remove('pvw-drag'); const A = pvA(); if (A) A.guides(false, false); if (d.on) setFree(d.key, { x: d.x, y: d.y }); };
document.addEventListener('pointerup', ovEnd); document.addEventListener('pointercancel', ovEnd);
document.addEventListener('wheel', (e) => {
  const ov = e.target.closest && e.target.closest('#pvWOv'); if (!ov || !pvIsEdit()) return;
  const k = edSel.widget; if (!k || !EL_N[k] || k === 'bg' || k === 'layout') return;
  e.preventDefault(); const v = wFree()[k] || {}, s = Math.max(40, Math.min(250, (v.s || 100) + (e.deltaY < 0 ? 5 : -5)));
  setFree(k, { s }, true); document.querySelectorAll(`[data-free="${k}"]`).forEach((x) => (x.value = s)); document.querySelectorAll(`[data-freev="${k}"]`).forEach((x) => (x.textContent = s + '%'));
}, { passive: false });
// горячие клавиши редактора виджета
window.pvKey = (e) => {
  if (!pvIsEdit() || !pvWAlive()) return false;
  const c = e.code, mod = e.ctrlKey || e.metaKey;
  if (mod && !e.altKey && (c === 'KeyZ' || c === 'KeyY')) { wHistGo(c === 'KeyY' || e.shiftKey ? 1 : -1); return true; }
  const k = edSel.widget;
  if (!mod && k && EL_N[k] && k !== 'bg' && k !== 'layout') {
    if (/^Arrow/.test(c)) {
      const A = pvA(), lim = A && A.limits(k); if (!lim) return false;
      const st = e.shiftKey ? 10 : 1, d = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] }[c], v = A.get(k);
      setFree(k, { x: Math.round(clampR((v.x || 0) + d[0], lim.x)), y: Math.round(clampR((v.y || 0) + d[1], lim.y)) }); return true;
    }
    if (c === 'Delete') { const v = wFree()[k] || {}; setFree(k, { h: !v.h }); return true; }
    if (c === 'Escape') { edPick('widget', null); return true; }
  }
  return false;
};
document.addEventListener('keydown', (e) => { if (/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) return; if (window.pvKey(e)) { e.preventDefault(); e.stopPropagation(); } }, true);
PX.on('ready', () => { wFreeAll(); wHistInit(); widgetCfg(); });

// ---------- перерисовка настроек без перезагрузки живого виджета ----------
function syncAttrs(a, b) { [...a.attributes].forEach((x) => { if (!b.hasAttribute(x.name)) a.removeAttribute(x.name); }); [...b.attributes].forEach((x) => { if (a.getAttribute(x.name) !== x.value) a.setAttribute(x.name, x.value); }); }
window.keepAliveRender = (root, html) => {
  const old = root.querySelector('#pvWIframe');
  if (!old || !pvWAlive()) { root.innerHTML = html; return; }
  const tpl = document.createElement('div'); tpl.innerHTML = html;
  const nf = tpl.querySelector('#pvWIframe');
  if (!nf) { root.innerHTML = html; return; }
  const wasEdit = pvIsEdit();
  let K = old.parentElement, NK = nf.parentElement;
  syncAttrs(K, NK);
  // соседи фрейма внутри .pvw-frame (слой мыши) — тоже из нового HTML
  [...K.childNodes].forEach((n) => { if (n !== old) n.remove(); }); [...NK.childNodes].forEach((n) => { if (n !== nf) K.appendChild(n); });
  while (K !== root) {
    const P = K.parentElement, NP = NK.parentElement;
    if (!P || !NP || (P === root) !== (NP === tpl)) { root.innerHTML = html; return; }
    [...P.childNodes].forEach((n) => { if (n !== K) n.remove(); });
    const kids = [...NP.childNodes], i = kids.indexOf(NK);
    kids.slice(0, i).forEach((n) => P.insertBefore(n, K));
    kids.slice(i + 1).forEach((n) => P.appendChild(n));
    if (P !== root) syncAttrs(P, NP);
    K = P; NK = NP;
  }
  if (wasEdit !== pvIsEdit()) { const A = pvA(); if (A) A.setEdit(pvIsEdit()); }
  pvWidgetSize(); pvWidgetMark();
};

// ---------- обои: карточку, строку текста и часы можно тащить мышью куда угодно ----------
const WXY = { card: 'infoXY', ly: 'lyXY', clock: 'clockXY' };
const wDrag = { on: null, moved: false };
// стиль «свободного» положения: центр элемента в точке x,y (доли экрана)
function wallXYStyle(k, xy, W) {
  const sc = k === 'card' ? (W.infoSize || 100) / 100 : k === 'clock' ? (W.clockSize || 100) / 100 : 1;
  return `left:${(xy[0] * 100).toFixed(2)}%;top:${(xy[1] * 100).toFixed(2)}%;right:auto;bottom:auto;transform:translate(-50%,-50%) scale(${sc})`;
}
document.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || !e.target.closest) return; const el = e.target.closest('.ed-tab .pv-wall [data-ed]'); if (!el || !WXY[el.dataset.ed]) return;
  const box = el.closest('.pv-wall').getBoundingClientRect(), r = el.getBoundingClientRect();
  wDrag.on = { el, k: el.dataset.ed, box, gx: e.clientX - (r.left + r.width / 2), gy: e.clientY - (r.top + r.height / 2), x0: e.clientX, y0: e.clientY, xy: null };
  wDrag.moved = false; try { el.setPointerCapture(e.pointerId); } catch {}
  e.preventDefault();
}, true);
document.addEventListener('pointermove', (e) => {
  const d = wDrag.on; if (!d) return;
  if (!wDrag.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 5) return;
  wDrag.moved = true; d.el.classList.add('ed-drag', 'ed-on');
  let x = (e.clientX - d.gx - d.box.left) / d.box.width, y = (e.clientY - d.gy - d.box.top) / d.box.height;
  x = Math.max(0.03, Math.min(0.97, x)); y = Math.max(0.04, Math.min(0.94, y));
  const snapX = Math.abs(x - 0.5) < 0.025, snapY = Math.abs(y - 0.5) < 0.035; if (snapX) x = 0.5; if (snapY) y = 0.5;
  const pv = d.el.closest('.pv-wall'); pv.classList.toggle('snap-x', snapX); pv.classList.toggle('snap-y', snapY); pv.classList.add('ed-dragging');
  d.xy = [+x.toFixed(3), +y.toFixed(3)];
  d.el.className = d.el.className.replace(/\b(top|middle|bottom|bot|side-[lrc]|at-\w+)\b/g, '');
  d.el.style.cssText += ';' + wallXYStyle(d.k, d.xy, S().wall) + ';zoom:1;white-space:nowrap';
}, true);
document.addEventListener('pointerup', () => {
  const d = wDrag.on; if (!d) return; wDrag.on = null;
  const pv = d.el.closest('.pv-wall'); if (pv) pv.classList.remove('snap-x', 'snap-y', 'ed-dragging');
  d.el.classList.remove('ed-drag');
  if (!wDrag.moved || !d.xy) return;
  const p = 'wall.' + WXY[d.k]; setP(p, d.xy); edSel.wall = d.k; edSub.wall = null; settingChanged(p); save(); edPanels();
  setTimeout(() => (wDrag.moved = false), 60);
}, true);

// ---------- предпросмотр интерфейса (вкладка «Внешний вид») — живёт на тех же CSS-переменных, что и всё приложение ----------
// 1.9.4: предпросмотр — уменьшенная копия настоящего окна Pulse (верхняя панель, меню, главная, плеер), а не схема из полосок
function appPreview() {
  // 1.9.5: предпросмотр собирается из того же, что видно в окне: настоящие полки главной, обложки, плейлисты и трек
  const t = curTrack(), H = (S().ui.hide || {}), art = t ? `background-image:url('${esc(artOf(t, 120))}')` : '';
  const nav = [['home', 'Главная', 1], ['explore', 'Обзор'], ['library', 'Библиотека'], ['offline', 'Скачанное'], ['settings', 'Настройки']];
  const hc = cache.get('home'), hd = hc && hc.v, shelvesD = hd && Array.isArray(hd.shelves) ? hd.shelves.filter(Boolean) : [];
  const pick = (sh) => (Array.isArray(sh.items) ? sh.items : []).filter((x) => x && x.kind !== 'mood' && x.title);
  const sh1 = shelvesD.find((x) => pick(x).length >= 2), sh2 = shelvesD.find((x) => x !== sh1 && pick(x).length >= 2);
  const known = Object.values(lib.known || {}).filter((x) => x && x.id).slice(-8).reverse();
  const fake = (known.length ? known : (mine().tracks || [])).slice(0, 8).map((x) => ({ kind: 'song', id: x.id, title: x.title, author: x.author, art: x.art }));
  const cov = (it) => { if (it.kind === 'song' && it.video) return pimg(`https://i.ytimg.com/vi/${it.id}/mqdefault.jpg`); if (it.kind !== 'song' && !it.art) return ''; return artOf(it, 226); };
  const card = (it) => { const u = cov(it); return `<div class="pa2-card"><div class="pa2-cov ${it.round || it.kind === 'artist' ? 'round' : ''}" ${u ? `style="background-image:url('${esc(u)}')"` : ''}></div><b>${esc(it.title)}</b><span>${esc(it.kind === 'song' ? it.author || '' : it.sub || '')}</span></div>`; };
  const row = (sh, list) => { const L = (sh ? pick(sh) : list).slice(0, 5); return L.length ? `<div class="pa2-sh"><h5>${esc(sh ? sh.title || '' : 'Недавно слушали')}</h5><div class="pa2-cards">${L.map(card).join('')}</div></div>` : ''; };
  const ph = `<div class="pa2-sh"><h5>Подборки для тебя</h5><div class="pa2-cards">${'<div class="pa2-card"><div class="pa2-cov"></div><b>&nbsp;</b><span>&nbsp;</span></div>'.repeat(5)}</div></div>`;
  const body = (sh1 ? row(sh1) : fake.length ? row(null, fake) : ph) + (sh2 ? row(sh2) : '');
  const chips = ((hd && hd.chips) || []).slice(0, 5).map((c) => c.title);
  const pls = (lib.playlists || []).filter((x) => x.id !== MINE).slice(0, 3).map((x) => x.name);
  const greet = account && typeof account.name === 'string' && account.name.trim() ? `<div class="pa2-greet">Привет, ${esc(account.name.trim().split(/\s+/)[0])}</div>` : '';
  const amb = t && document.body.classList.contains('amb-all');
  return `<div class="pv pv-app pv-app2" id="pvApp"><div class="pa2">
    ${amb ? `<div class="pa2-amb" style="${art}"></div>` : ''}
    <div class="pa2-top" data-ed="top"><span class="pa2-logo"><i></i>Pulse</span><span class="pa2-q">${ico('search')}Поиск песен, альбомов, исполнителей</span><span class="pa2-tr"><em ${account && account.photo ? `style="background-image:url('${esc(account.photo)}')"` : ''}>${account && account.photo ? '' : ico('user')}</em></span></div>
    <div class="pa2-side" data-ed="side">${nav.map(([i, n, on]) => `<span class="${on ? 'on' : ''}">${ico(i)}${n}</span>`).join('')}<hr><span class="pa2-new">${ico('plus')}Новый плейлист</span><span class="pa2-pl">${ico('heart-f')}Понравившиеся</span>${pls.map((n) => `<span class="pa2-pl dim">${esc(n)}</span>`).join('')}</div>
    <div class="pa2-main" data-ed="shape">${greet}${chips.length ? `<div class="pa2-chips">${chips.map((c, i) => `<i>${esc(c)}</i>`).join('')}</div>` : ''}${body}</div>
    <div class="pa2-bar" data-ed="bar"><span class="pa2-c">${ico('prev')}<b>${ico(playing ? 'pause' : 'play')}</b>${ico('next')}</span><span class="pa2-time">${H.time ? '' : !t ? '0:00 / 0:00' : `${fmt(E.time ? E.time() : 0)} / ${fmt((E.dur && E.dur()) || t.dur || 0)}`}</span>
      <span class="pa2-now">${t ? `<i style="${art}"></i><span><b>${esc(t.title)}</b><em>${esc(t.author || '')}</em></span>${H.like ? '' : ico(isLiked(t.id) ? 'heart-f' : 'heart')}` : `<i></i><span><b>Ничего не играет</b><em>Найди песню в поиске</em></span>${ico('heart')}`}</span>
      <span class="pa2-r">${H.vol ? '' : ico('volume')}${H.shuffle ? '' : ico('shuffle')}${H.repeat ? '' : ico('repeat')}</span><i class="pa2-prog"><i style="width:${t && t.dur && E.time ? Math.min(100, (E.time() / t.dur) * 100).toFixed(1) : 0}%"></i></i></div>
  </div><em>Предпросмотр интерфейса</em></div>`;
}

// 1.9.1: из-за сломанных ползунков эквалайзер мог «уехать» в +12 на всех полосах — звук хрипел. Возвращаем ровно.
(() => { try { const a = S().audio; if (Array.isArray(a.eq) && a.eq.length && a.eq.filter((x) => x >= 10).length >= a.eq.length - 1) { a.eq = a.eq.map(() => 0); a.preamp = 0; a.preset = 'flat'; save(); settingChanged('audio.eq'); } } catch {} })();

// ---------- 1.9.2: перерисовка настроек без перезагрузки живого виджета ----------
// Раньше любой тумблер/сегмент вызывал полную пересборку вкладки: iframe с виджетом создавался заново и моргал,
// а выделение элемента пропадало. Теперь фрейм остаётся на месте, меняется всё вокруг него.
function syncAttrs(a, b) { [...a.attributes].forEach((x) => { if (!b.hasAttribute(x.name)) a.removeAttribute(x.name); }); [...b.attributes].forEach((x) => { if (a.getAttribute(x.name) !== x.value) a.setAttribute(x.name, x.value); }); }
window.keepAliveRender = (root, html) => {
  const old = root.querySelector('#pvWIframe');
  if (!old || !pvWAlive()) { root.innerHTML = html; return; }
  const tpl = document.createElement('div'); tpl.innerHTML = html;
  const nf = tpl.querySelector('#pvWIframe');
  if (!nf) { root.innerHTML = html; return; }
  let K = old.parentElement, NK = nf.parentElement; // .pvw-frame
  syncAttrs(K, NK);
  while (K !== root) {
    const P = K.parentElement, NP = NK.parentElement;
    if (!P || !NP || (P === root) !== (NP === tpl)) { root.innerHTML = html; return; }
    [...P.childNodes].forEach((n) => { if (n !== K) n.remove(); });
    const kids = [...NP.childNodes], i = kids.indexOf(NK);
    kids.slice(0, i).forEach((n) => P.insertBefore(n, K));
    kids.slice(i + 1).forEach((n) => P.appendChild(n));
    if (P !== root) syncAttrs(P, NP);
    K = P; NK = NP;
  }
  pvWidgetSize(); pvWidgetMark();
};
