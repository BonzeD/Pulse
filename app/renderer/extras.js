'use strict';
// Pulse 1.9 — Discord Rich Presence, музыкальные обои, конфиги, менеджер аккаунтов, расширенный виджет и предпросмотр настроек.
// Всё лёгкое: ничего не рисуется и не отправляется, пока функция выключена или её не видно.

// ---------- общие помощники ----------
const xBtn = (act, icon, text, cls = '') => `<button class="btn sm ${cls}" data-sact="cx:x.${act}">${icon ? ico(icon) : ''}${text}</button>`;
const xTxt = (path, ph, w = 220) => `<input class="field xin" style="width:${w}px" data-txt="${path}" value="${esc(getP(path) || '')}" placeholder="${esc(ph)}" spellcheck="false">`;
const fmtDate = (t) => { try { return new Date(t).toLocaleString(PulseI18n.locale(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
const deepAssign = (dst, src) => { for (const k in src) { if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && dst[k] && typeof dst[k] === 'object') deepAssign(dst[k], src[k]); else dst[k] = JSON.parse(JSON.stringify(src[k])); } return dst; };
const visible = (el) => !!(el && el.isConnected && el.offsetParent !== null);

// пользовательские действия cx:x.* — маршрутизируем, не трогая customAct из custom.js
{ const base = customAct; customAct = function (a, el) { if (a.startsWith('x.')) return extraAct(a.slice(2), el); return base(a, el); }; }

// ---------- вкладки ----------
function extraTabs() { return [...(typeof editorTab === 'function' ? [editorTab()] : []), wallTab(), discordTab(), ...(typeof customizeTab === 'function' ? [customizeTab()] : []), cfgTab(), accTab(), ...(typeof clientTab === 'function' ? [clientTab()] : [])]; } // 2.0.2: вкладка «Клиент»
function extraChanged(path) {
  if (path !== 'cfg.autoSave') cfgAutoSave();
  if (path.startsWith('discord.')) { discordApply(); updPreview('pvDiscord', discordPreview); return true; }
  if (path.startsWith('wall.')) { const xy = { 'wall.infoPos': 'infoXY', 'wall.lyPos': 'lyXY', 'wall.clockPos': 'clockXY' }[path]; if (xy) S().wall[xy] = null; wallApply(path); updPreview('pvWallBox', () => `<div id="pvWallBox">${wallPreviewInner()}</div>`); return true; }
  // 1.9.2: настройки виджета — лёгкий путь. Раньше каждое движение ползунка шло в applySettings(): заново считалась палитра обложки,
  // дёргались zoom/whisper/closeMode по IPC, пересобирался эквалайзер — отсюда лаги редактора.
  if (path.startsWith('widget.')) { widgetCfg(); if (typeof wHistMark === 'function') wHistMark(); if (typeof pvWidgetSize === 'function') pvWidgetSize(); return true; }
  if (path.startsWith('studio.')) { if (typeof czStudioApply === 'function') czStudioApply(); if (typeof czDockSync === 'function') czDockSync(true); return true; }
  if (path.startsWith('layout.')) { if (typeof czApply === 'function') czApply(); return true; }
  if (path === 'app.keepFs' && !S().app.keepFs) { lib.fs = false; }
  return false;
}
function updPreview(id, fn) { const el = document.getElementById(id); if (el) { el.outerHTML = fn(); if (typeof edMarkAll === 'function') edMarkAll(); } }

// ================= МИНИ-ВИДЖЕТ =================
function widgetRows() {
  const w = S().widget;
  const corners = [['tl', '↖'], ['tc', '↑'], ['tr', '↗'], ['bl', '↙'], ['bc', '↓'], ['br', '↘']];
  return [
    grp('Вид'),
    R('Размер', 'Мини — одна строка, Стандарт — с кнопками, Большой — с караоке-текстом', seg('widget.size', [['mini', 'Мини'], ['standard', 'Стандарт'], ['large', 'Большой']]), 'размер виджет'),
    { raw: edBox('widget', widgetPreview(false)) },
    R('Масштаб', 'Весь виджет крупнее или мельче', rng('widget.scale', 70, 150, 5, '%'), 'масштаб виджет'),
    R('Цвет', 'По обложке — цвета берутся из текущего трека', seg('widget.accent', [['cover', 'По обложке'], ['custom', 'Свой']]) + (w.accent === 'custom' ? colr('widget.color') : ''), 'цвет виджет'),
    grp('Поведение'),
    R('Поверх всех окон', '', tg('widget.onTop')),
    R('Тихий режим для игр', 'Когда мышь не над виджетом, анимации встают на паузу, а время обновляется раз в секунду — меньше нагрузки, игры не подтормаживают', tg('widget.calm'), 'игры лаги фон виджет нагрузка'), // 2.0.12
    R('Скрывать при открытии плеера', 'Открыл Pulse — виджет пропадает сам', tg('widget.autoHide'), 'скрывать виджет'),
    R('Показывать при сворачивании', 'Свернул окно Pulse — появляется виджет', tg('widget.onMin'), 'свернуть виджет'),
    R('Приглушать на паузе', 'Виджет становится полупрозрачным, пока музыка стоит', tg('widget.hideIdle')),
    R('Закрепить на месте', 'Виджет нельзя случайно сдвинуть мышью', tg('widget.lock'), 'закрепить'),
    R('Переместить в угол', '', `<div class="seg">${corners.map(([c, n]) => `<button data-sact="cx:x.wsnap:${c}" title="В угол">${n}</button>`).join('')}</div>`, 'угол положение'),
    R('Показать / скрыть', 'Ctrl + Alt + W', `<button class="btn sm" data-sact="widget">${ico('widget')}Переключить</button>`)
  ];
}

// ================= ПРЕДПРОСМОТР ВИЗУАЛА И ТЕКСТА =================
let pvHover = null;
function vizPreviewRow() { return { raw: edBox('viz', `<div class="pv pv-viz"><canvas id="pvViz" data-ed="viz"></canvas><em id="pvVizCap">Предпросмотр · ${esc((Viz.STYLES.find((v) => v.id === lib.vizStyle) || {}).name || '')} · наведи на стиль, чтобы посмотреть</em></div>`) }; }
function lyPreviewRow(compact) {
  const words = ['Каждое', ' слово', ' загорается', ' в такт'];
  const h = `<div class="pv pv-ly ${compact ? 'sm' : ''}" id="pvLy" style="--beat:0;--wt:.18s"><div class="ly-line past" data-ed="rest">Предыдущая строка песни</div><div class="ly-line cur" data-ed="cur">${words.map((w) => `<span class="w">${w}</span>`).join('')}</div><div class="ly-line" data-ed="rest">Следующая строка</div><div class="ly-line far" data-ed="rest">И ещё одна, дальняя</div><em>Предпросмотр</em></div>`;
  return { raw: compact ? h : edBox('ly', h) };
}
document.addEventListener('mouseover', (e) => { const c = e.target.closest && e.target.closest('.vcard[data-v]'); const v = c ? c.dataset.v : null; if (v !== pvHover) { pvHover = v; const cap = $('pvVizCap'); if (cap) { const st = Viz.STYLES.find((x) => x.id === (v || lib.vizStyle)); cap.textContent = `Предпросмотр · ${st ? st.name : ''}${v ? '' : ' · наведи на стиль, чтобы посмотреть'}`; } } }, { passive: true });
// отдельные экземпляры движка для маленьких холстов — основной визуал не трогаем
const pvInst = {};
function pvDraw(id, opts) {
  const cv = document.getElementById(id); if (!visible(cv)) { if (pvInst[id]) { pvInst[id].v.destroy(); delete pvInst[id]; } return; }
  let p = pvInst[id]; if (!p || p.cv !== cv) { if (p) p.v.destroy(); p = pvInst[id] = { cv, v: makeViz({ ext: () => Viz.STYLES, maxDpr: 1 }), t: 0 }; p.v.init(cv); }
  const now = performance.now(); if (now - p.t < 33) return; p.t = now;
  if (basePal) p.v.setPalette(basePal);
  p.v.draw(Object.assign({ quality: 'high', sens: S().viz.sens / 100, playing: true, mode: 'visual', artRect: null }, opts));
}
let pvLyAt = 0, pvLyW = -1;
function pvFrame(now, f, wv, bt, tempo) {
  const T = tempo && tempo.conf ? tempo : { bpm: 112, pos: now / (60000 / 112), conf: 0.6 };
  if (document.getElementById('pvViz')) pvDraw('pvViz', { freq: playing ? f : null, wave: playing ? wv : null, beat: bt, style: pvHover || lib.vizStyle, tempo: T, fx: S().viz.fx, cover: coverImg });
  const W = S().wall;
  if (document.getElementById('pvWall')) pvDraw('pvWall', { freq: playing ? f : null, wave: playing ? wv : null, beat: bt, style: W.style === 'same' ? lib.vizStyle : W.style, tempo: T, fx: Object.assign({}, S().viz.fx, { glow: W.glow ? S().viz.fx.glow : 0, trails: 0 }), cover: coverImg });
  const ly = document.getElementById('pvLy');
  if (ly && now - pvLyAt > 420) { pvLyAt = now; const ws = ly.querySelectorAll('.ly-line.cur .w'); pvLyW = (pvLyW + 1) % (ws.length + 2); ws.forEach((s, k) => { s.classList.toggle('on', k <= pvLyW); s.classList.toggle('pop', k === pvLyW); }); }
}

// ================= DISCORD RICH PRESENCE =================
let dcStatus = { state: 'off', text: 'Выключено' }, dcKey = '', dcStart = 0, dcAt = 0, dcPausedAt = 0, dcWasPlaying = false;
if (pulse.discord) { pulse.discord.onStatus((s) => { dcStatus = s || dcStatus; const el = $('dcStatus'); if (el) el.outerHTML = dcStatusHtml(); if (s && s.state === 'ok') { dcKey = ''; discordTick(true); } }); pulse.discord.status().then((s) => s && (dcStatus = s)).catch(() => {}); }
const dcStatusHtml = () => `<span id="dcStatus" class="xst ${dcStatus.state}">${esc(window.PulseI18n ? PulseI18n.t(dcStatus.text || '') : (dcStatus.text || ''))}</span>`;
function discordTab() {
  const D = S().discord;
  return { id: 'discord', icon: 'discord', title: 'Discord RPC', rows: [
    R('Статус в Discord', 'Показывает в профиле Discord, что ты сейчас слушаешь. По умолчанию выключено', tg('discord.on'), 'discord дискорд rpc статус rich presence'),
    R('Подключение', 'Discord должен быть запущен на этом компьютере', dcStatusHtml()),
    { raw: edBox('discord', discordPreview()) },
    grp('Что показывать'),
    R('Название трека', '', tg('discord.title')),
    R('Исполнитель', '', tg('discord.artist')),
    R('Подпись обложки', 'По умолчанию — альбом. Можно скрыть отдельно от картинки; в Discord видна при наведении', tg('discord.album')),
    R('Обложка', 'Большая картинка трека', tg('discord.cover')),
    R('Время', 'Секунды и таймлайн трека', tg('discord.time'), 'время секунды таймлайн'),
    ...(D.time ? [R('↳ Как показывать время', 'Таймлайн — полоса прогресса с «прошло / всего»', seg('discord.timeMode', [['bar', 'Таймлайн'], ['elapsed', 'Прошло'], ['left', 'Осталось']]))] : []),
    R('Строка текста песни', 'Вместо исполнителя — текущая строка. Discord обновляет статус не чаще раза в 4 секунды', tg('discord.lyric'), 'текст строка'),
    R('Значок плей / пауза', 'Маленькая иконка у обложки. Загрузи в приложении Discord (Rich Presence → Art Assets) картинки с именами play и pause', tg('discord.small')),
    R('Кнопка «Слушать в YouTube Music»', 'Друзья смогут открыть трек одним кликом', tg('discord.buttons'), 'кнопка ссылка'),
    R('Кнопка «Исполнитель»', 'Ссылка на страницу исполнителя', tg('discord.btnArtist')),
    grp('Поведение'),
    R('Тип активности', '', seg('discord.type', [['listen', 'Слушает'], ['watch', 'Смотрит'], ['play', 'Играет']]), 'тип активности'),
    R('В списке участников', 'Что видно рядом с ником в списке участников сервера', seg('discord.display', [['name', 'Pulse'], ['state', 'Исполнитель'], ['details', 'Трек']])),
    R('На паузе', '', seg('discord.paused', [['show', 'Показывать «Пауза»'], ['clear', 'Убирать статус']])),
    R('Убрать статус после паузы', 'Через сколько минут паузы статус пропадёт (0 — никогда)', rng('discord.idle', 0, 60, 1, ' мин')),
    R('Не показывать видеоклипы', 'Только музыка, без роликов', tg('discord.hideVideo')),
    R('Приватный режим', 'Только «Слушает музыку» — без названия, обложки и ссылок', tg('discord.privacy'), 'приватность')
  ] };
}
function discordActivity(tt) {
  const D = S().discord, t = tt || curTrack(); if (!t || (D.hideVideo && t.video)) return null;
  const nowMs = Date.now();
  if (!playing) { if (D.paused === 'clear') return null; if (D.idle > 0 && dcPausedAt && nowMs - dcPausedAt > D.idle * 60000) return null; }
  const clip = (s, n = 128) => { s = String(s || '').trim(); if (s.length < 2) s = (s + '  ').slice(0, 2); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const priv = D.privacy, act = { type: D.type === 'watch' ? 3 : D.type === 'play' ? 0 : 2, instance: false };
  const alb = t.album && t.album.name ? t.album.name : '';
  const fill = (tpl, def) => String(tpl || def).replace(/\{title\}/g, t.title || '').replace(/\{artist\}/g, t.author || '').replace(/\{album\}/g, alb).replace(/\s*[·•|—-]\s*$/, '').trim();
  act.details = clip(priv || !D.title ? 'Слушает музыку' : fill(D.tpl1, '{title}') || t.title);
  const line = D.lyric && !priv && playing && lyState.id === t.id ? lyState.curText : '';
  const st = line ? '♪ ' + line : !priv && D.artist ? fill(D.tpl2, '{artist}') : '';
  if (!playing) act.state = clip('⏸ ' + (D.pauseText || 'Пауза') + (st && !line ? ' · ' + st : ''));
  else if (st) act.state = clip(st);
  const as = {};
  if (D.cover && !priv) { as.large_image = t.art ? sized(t.art, 512) : `https://i.ytimg.com/vi/${t.id}/hqdefault.jpg`; if (D.album) as.large_text = clip(fill(D.tplImg, '{album}') || t.title); }
  if (D.small) { as.small_image = playing ? 'play' : 'pause'; as.small_text = playing ? 'Играет в Pulse' : 'На паузе'; }
  if (Object.keys(as).length) act.assets = as;
  const dur = E.dur(), cur = E.time();
  if (D.time && playing && dur > 0 && !priv) {
    const start = nowMs - cur * 1000 / ((+S().audio.speed) || 1), end = start + dur * 1000 / ((+S().audio.speed) || 1);
    act.timestamps = D.timeMode === 'elapsed' ? { start: Math.round(start) } : D.timeMode === 'left' ? { end: Math.round(end) } : { start: Math.round(start), end: Math.round(end) };
  }
  const btn = [];
  // 2.0.2: у треков Apple Music / Spotify — ссылки на их сервис
  const sv = typeof isSvcId === 'function' && isSvcId(t.id);
  if (D.buttons && !priv) btn.push({ label: String(sv && (!D.btnLabel || D.btnLabel === 'Слушать в YouTube Music') ? 'Слушать в ' + CL_NAME[t.id.slice(0, 2)] : D.btnLabel || 'Слушать в YouTube Music').slice(0, 32), url: sv ? svcUrl(t.id) : `https://music.youtube.com/watch?v=${t.id}` });
  if (D.btnArtist && !priv && t.artistId) btn.push({ label: 'Исполнитель', url: isSvcId(t.artistId) ? svcUrl(t.artistId) : `https://music.youtube.com/channel/${t.artistId}` });
  if (D.btnCustom && !priv && /^https?:\/\/\S+\.\S+/.test(D.btnCustomUrl || '') && (D.btnCustomLabel || '').trim()) btn.push({ label: D.btnCustomLabel.trim().slice(0, 32), url: D.btnCustomUrl.trim() });
  if (btn.length) act.buttons = btn.slice(0, 2);
  act.status_display_type = { name: 0, state: 1, details: 2 }[D.display] || 0;
  return act;
}
function discordTick(force) {
  const D = S().discord; if (!D.on || !pulse.discord) return;
  if (playing) dcPausedAt = 0; else if (dcWasPlaying || !dcPausedAt) dcPausedAt = dcPausedAt || Date.now();
  dcWasPlaying = playing;
  const a = discordActivity();
  // ключ без отметок времени; перемотку ловим отдельно (старт сместился больше чем на 2.5 с)
  const st = a && a.timestamps ? a.timestamps.start || a.timestamps.end || 0 : 0;
  const key = JSON.stringify(a ? { ...a, timestamps: !!a.timestamps } : null), jumped = st && Math.abs(st - dcStart) > 2500;
  if (!force && key === dcKey && !jumped) return;
  dcKey = key; dcStart = st; pulse.discord.send ? pulse.discord.send(a) : pulse.discord.set(a);
}
function discordApply() { const D = S().discord; if (!pulse.discord) return; pulse.discord.config(!!D.on, ''); dcKey = ''; if (D.on) setTimeout(() => discordTick(true), 300); }
function discordPreview() {
  const D = S().discord, t = curTrack() || null, a = discordActivity() || (!t ? discordActivity({ id: 'demo', title: 'Название трека', author: 'Исполнитель', album: { name: 'Альбом' }, art: 'logo.png' }) : null);
  const title = t ? t.title : PulseI18n.t('Название трека'), head = { listen: 'Слушает', watch: 'Смотрит', play: 'Играет в' }[D.type] || 'Слушает';
  const off = !D.on;
  if (!a) return `<div class="pv pv-dc" id="pvDiscord"><div class="dc-card off">${ico('discord')}<span>${t ? 'Сейчас статус скрыт (пауза / видео / нет трека)' : 'Включи трек — здесь появится статус'}</span></div><em>Предпросмотр профиля Discord</em></div>`;
  const art = a.assets && a.assets.large_image ? (t ? artOf(t, 226) : 'logo.png') : '';
  const tm = a.timestamps ? (a.timestamps.start && a.timestamps.end ? `<div class="dc-bar" data-ed="time"><span>${fmt(E.time())}</span><div><i style="width:${E.dur() ? (E.time() / E.dur()) * 100 : 0}%"></i></div><span>${fmt(E.dur())}</span></div>` : `<div class="dc-t" data-ed="time">${a.timestamps.start ? fmt(E.time()) + ' прошло' : fmt(Math.max(0, E.dur() - E.time())) + ' осталось'}</div>`) : '';
  return `<div class="pv pv-dc ${off ? 'is-off' : ''}" id="pvDiscord"><div class="dc-card"><div class="dc-h" data-ed="head">${head} Pulse</div><div class="dc-b">${art ? `<div class="dc-art" data-ed="img" style="background-image:url('${esc(art)}')">${a.assets.small_image ? `<i>${ico(playing ? 'play' : 'pause')}</i>` : ''}</div>` : `<div class="dc-art none" data-ed="img">${ico('music')}</div>`}
    <div class="dc-i"><b data-ed="l1">${esc(a.details || '')}</b>${a.state ? `<span data-ed="l2">${esc(a.state)}</span>` : `<span data-ed="l2" class="dim">—</span>`}${a.assets && a.assets.large_text && D.album ? `<span class="dim" data-ed="album" title="Подпись обложки: в Discord видна при наведении">${esc(a.assets.large_text)}</span>` : ''}${tm}</div></div>
    ${a.buttons ? `<div class="dc-btns" data-ed="btns">${a.buttons.map((b) => `<span>${esc(b.label)}</span>`).join('')}</div>` : ''}</div><em>${off ? 'Статус выключен — так он будет выглядеть · ' : ''}Предпросмотр профиля Discord · подпись обложки показана строкой для редактирования · ${esc(title)}</em></div>`;
}

// ================= МУЗЫКАЛЬНЫЕ ОБОИ =================
let wallState = { on: false, busy: false, err: null, displays: null }, wallT = null, wallBuf = null, wallMetaAt = 0, wallMetaKey = '';
const WALL_FONTS = () => Object.entries(WallStyle.FONTS).map(([k, v]) => [k, v[0]]);
const WALL_CLOCK = [['thin', 'Тонкие'], ['bold', 'Жирные'], ['stack', 'Столбиком'], ['mini', 'Компактные'], ['neon', 'Неон'], ['analog', 'Со стрелками']];
const WALL_PLATE = [['none', 'Нет'], ['glass', 'Стекло'], ['dark', 'Тёмная'], ['accent', 'Цвет трека']];
const WALL_CARD = [['glass', 'Стекло'], ['solid', 'Плотная'], ['accent', 'Цвет трека'], ['minimal', 'Без подложки']];
const WALL_ART = [['square', 'Квадрат'], ['rounded', 'Скруглённая'], ['circle', 'Круг']];
const WALL_WEIGHT = [[400, 'Обычный'], [600, 'Средний'], [800, 'Жирный'], [900, 'Очень']];
function wallTab() {
  const W = S().wall;
  if (!wallState.displays && pulse.wall) pulse.wall.displays().then((d) => { wallState.displays = d || []; if (lib.setTab === 'wall') deferRerender(0); }).catch(() => {});
  const ds = (wallState.displays || [{ i: 0, name: '1: основной' }]).map((d) => [d.i, d.name]);
  const st = wallState.busy ? 'Включаю…' : wallState.err ? 'Не удалось встроить в рабочий стол: ' + wallState.err : wallState.on ? 'Работают — сверни окна и посмотри на рабочий стол' : 'Выключены';
  return { id: 'wall', icon: 'wallpaper', title: 'Музыкальные обои', rows: [
    R('Музыкальные обои', 'Визуализация становится обоями Windows — живёт под значками рабочего стола и двигается под музыку (как Wallpaper Engine). По умолчанию выключено', tg('wall.on'), 'обои рабочий стол wallpaper engine живые'),
    R('Состояние', '', `<span class="xst ${wallState.on ? 'ok' : wallState.err ? 'error' : 'off'}">${esc(st)}</span>`),
    { raw: edBox('wall', `<div id="pvWallBox">${wallPreviewInner()}</div>`) },
    grp('Управление с рабочего стола'),
    R('Переключать песни прямо на обоях', 'На карточке трека появятся кнопки ⏮ ⏯ ⏭ и ♥, а по полосе можно перематывать — кликай мышью прямо по рабочему столу. Работает там, где обои не закрыты окнами', tg('wall.controls'), 'кнопки управление переключение песни трек следующий пауза ползунок'),
    ...(W.controls ? [R('↳ Кнопка «Нравится»', 'Добавить трек в любимые прямо с рабочего стола', tg('wall.likeBtn'), 'лайк нравится'),
      ...(W.info ? [] : [R('↳ Карточка трека выключена', 'Кнопки живут на карточке — включи её ниже, иначе управлять будет нечем', tg('wall.info'))])] : []),
    grp('Картинка'),
    R('Стиль визуала', 'Можно выбрать отдельный, не как в плеере', sel('wall.style', [['same', 'Как в плеере'], ...Viz.STYLES.map((v) => [v.id, v.name])]), 'стиль обои'),
    R('Фон', '', seg('wall.bg', [['cover', 'Размытая обложка'], ['accent', 'Цвет трека'], ['dark', 'Тёмный'], ['black', 'Чёрный']])),
    R('Затемнение фона', '', rng('wall.dim', 0, 90, 5, '%')),
    R('Размер визуала', '', rng('wall.scale', 60, 160, 5, '%')),
    R('Камера', 'Визуал медленно плывёт, наклоняется и приближается — как пролёт камеры. Лучше всего с 3D-стилями: «3D-город», «Спираль 3D»', seg('wall.motion', [['off', 'Стоит'], ['drift', 'Дрейф'], ['orbit', 'Облёт'], ['dolly', 'Наезд']]), 'камера движение 3d'),
    R('↳ Скорость камеры', '', rng('wall.motionSpeed', 30, 300, 10, '%')),
    R('Свечение', 'Красивее, но чуть тяжелее для видеокарты', tg('wall.glow')),
    R('Частота кадров', '30 FPS почти не нагружает компьютер', seg('wall.fps', [[20, '20'], [30, '30'], [60, '60']])),
    R('Когда музыка не играет', '', seg('wall.idle', [['calm', 'Спокойная анимация'], ['freeze', 'Заморозить'], ['black', 'Тёмный экран']])),
    grp('Карточка трека'),
    R('Карточка трека', 'Обложка, название и исполнитель', tg('wall.info'), 'карточка трек'),
    ...(W.info ? [R('↳ Полоса прогресса', 'Видно, как движется трек: время и таймлайн', tg('wall.progress')),
      R('↳ Где карточка', 'Или перетащи её мышью в редакторе', seg('wall.infoPos', [['tl', '↖'], ['tr', '↗'], ['c', 'Центр'], ['bl', '↙'], ['br', '↘']])),
      R('↳ Размер карточки', '', rng('wall.infoSize', 60, 180, 5, '%')),
      R('↳ Стиль', '', seg('wall.cardStyle', WALL_CARD), 'стиль карточки'),
      R('↳ Плотность подложки', '', rng('wall.cardOp', 0, 90, 5, '%')),
      R('↳ Скругление', '', rng('wall.cardRadius', 0, 40, 2, 'px')),
      R('↳ Обложка', '', seg('wall.artShape', WALL_ART)),
      R('↳ Шрифт', '', sel('wall.cardFont', WALL_FONTS()), 'шрифт карточки')] : []),
    grp('Текст песни'),
    R('Строка текста песни', 'Караоке прямо на рабочем столе. Сама обходит карточку трека, чтобы не налезать', tg('wall.lyrics')),
    ...(W.lyrics ? [R('↳ Где строка', '', seg('wall.lyPos', [['top', 'Сверху'], ['middle', 'По центру'], ['bottom', 'Снизу']])),
      R('↳ Шрифт', '', sel('wall.lyFont', WALL_FONTS()), 'шрифт текста обои'),
      R('↳ Толщина', '', seg('wall.lyWeight', WALL_WEIGHT)),
      R('↳ Свечение цветом трека', '', tg('wall.lyGlow')),
      R('↳ Подложка под строкой', 'Тёмная полупрозрачная плашка — текст читается на любом фоне', tg('wall.lyPlate'))] : []),
    grp('Часы'),
    R('Часы и дата', '', tg('wall.clock'), 'часы дата время'),
    ...(W.clock ? [R('↳ Дизайн', '', seg('wall.clockStyle', WALL_CLOCK), 'дизайн часов стрелки неон'),
      R('↳ Шрифт', '', sel('wall.clockFont', WALL_FONTS()), 'шрифт часов'),
      R('↳ Секунды', '', tg('wall.clockSec')),
      R('↳ 12-часовой формат', 'AM / PM вместо 24 часов', tg('wall.clock12')),
      R('↳ Дата', 'День недели, число и месяц под временем', tg('wall.clockDate')),
      R('↳ Цвет', '', colA('wall.clockColor', '#ffffff')),
      R('↳ Подложка', '', seg('wall.clockPlate', WALL_PLATE)),
      ...(W.clockPlate && W.clockPlate !== 'none' ? [R('↳ Плотность подложки', '', rng('wall.clockPlateOp', 5, 90, 5, '%'))] : []),
      R('↳ Где часы', '', seg('wall.clockPos', [['top', 'Сверху'], ['bottom', 'Снизу']])),
      R('↳ Размер', '', rng('wall.clockSize', 50, 170, 5, '%'))] : []),
    grp('Экран'),
    R('Монитор', '', sel('wall.display', ds), 'монитор экран'),
    R('Если обои не появились', 'Нужна Windows 10/11. Помогает выключить и включить снова; родные обои вернутся сами после выключения', '')
  ] };
}
function wallPreviewInner() {
  const W = S().wall, t = curTrack(), pos = { tl: 'top:8%;left:5%', tr: 'top:8%;right:5%', c: 'top:50%;left:50%;transform:translate(-50%,-50%)', bl: 'bottom:12%;left:5%', br: 'bottom:12%;right:5%' }[W.infoPos] || 'bottom:12%;left:5%';
  const bg = W.bg === 'cover' && t ? `background-image:url('${esc(artOf(t, 226))}')` : W.bg === 'accent' ? 'background:radial-gradient(circle at 30% 30%,rgba(var(--a1),.55),rgba(var(--a2),.25) 50%,#050508)' : W.bg === 'black' ? 'background:#000' : 'background:#0b0a12';
  return `<div class="pv pv-wall"><div class="pvw-bg ${W.bg === 'cover' ? 'blur' : ''}" style="${bg}" data-ed="bg"></div><div class="pvw-dim" style="opacity:${W.dim / 100}"></div><canvas id="pvWall" data-ed="viz" style="transform:scale(${W.scale / 100})"></canvas>
    <div class="pvw-icons"><i></i><i></i><i></i></div>
    ${W.clock ? `<div class="pvw-clock ${W.clockPos === 'bottom' ? 'bot' : ''} ${WallStyle.clockClass(W)}" data-ed="clock" style="${W.clockXY ? '' : 'zoom:' + (W.clockSize || 100) / 100 + ';'}font-family:${esc(WallStyle.font(W.clockFont))};${W.clockColor ? 'color:' + esc(W.clockColor) + ';' : ''}background:${WallStyle.clockBg(W) || 'none'};${W.clockXY ? wallXYStyle('clock', W.clockXY, W) : ''}">${WallStyle.clockHtml(W, new Date())}</div>` : ''}
    ${W.info ? `<div class="pvw-card ${WallStyle.cardClass(W)}" data-ed="card" style="${W.infoXY ? wallXYStyle('card', W.infoXY, W) : pos + ';zoom:' + W.infoSize / 100};background:${WallStyle.cardBg(W)};border-radius:${Math.round((W.cardRadius ?? 26) * .46)}px;font-family:${esc(WallStyle.font(W.cardFont))}"><div class="pvw-art" style="background-image:url('${t ? esc(artOf(t, 120)) : ''}')"></div><div><b>${esc(t ? t.title : 'Название трека')}</b><span>${esc(t ? t.author : 'Исполнитель')}</span>${W.progress ? '<div class="pvw-prog"><i></i></div>' : ''}${W.controls ? `<div class="pvw-ctl" data-ed="ctl">${ico('prev')}<b>${ico(playing ? 'pause' : 'play')}</b>${ico('next')}${W.likeBtn !== false ? `<i class="pvw-like ${t && isLiked(t.id) ? 'on' : ''}">${ico(t && isLiked(t.id) ? 'heart-f' : 'heart')}</i>` : ''}</div>` : ''}</div></div>` : ''}
    ${W.lyrics ? `<div data-ed="ly" style="font-size:${14 * (W.lySize || 100) / 100}px;color:${W.lyColor || '#fff'};font-family:${esc(WallStyle.font(W.lyFont))};font-weight:${W.lyWeight || 800};${W.lyXY ? wallXYStyle('ly', W.lyXY, W) + ';white-space:nowrap' : ''}" class="pvw-ly ${W.lyPlate ? 'plate' : ''} ${W.lyGlow === false ? '' : 'glow'} ${W.lyXY ? 'free' : (W.lyPos || 'bottom') + ' ' + (W.info ? 'side-' + (/l$/.test(W.infoPos) ? 'l' : /r$/.test(W.infoPos) ? 'r' : 'c') + ' at-' + (W.infoPos === 'c' ? 'middle' : W.infoPos[0] === 't' ? 'top' : 'bottom') : '')}"><span>♪ строка песни на рабочем столе</span></div>` : ''}
    <div class="pvw-task"></div><i class="pvw-gx"></i><i class="pvw-gy"></i><em>Предпросмотр рабочего стола</em></div>`;
}
async function wallApply(path) {
  const W = S().wall; if (!pulse.wall) return;
  if (path === 'wall.controls' && W.on && wallState.on) await pulse.wall.enable({ display: +W.display || 0, controls: !!W.controls }).catch(() => {});
  if (path === 'wall.on' || path === 'wall.display' || path === 'boot') {
    if (W.on) {
      wallState.busy = true; wallState.err = null; if (path !== 'boot') deferRerender(0);
      const r = await pulse.wall.enable({ display: +W.display || 0, controls: !!W.controls }).catch((e) => ({ error: String(e) }));
      wallState.busy = false; wallState.on = !!(r && !r.error); wallState.err = r && r.error ? r.error : r && r.ok === false && r.error ? r.error : null;
      if (r && r.ok === false && !r.error) wallState.err = 'Windows не разрешила встроить окно под значки';
      if (wallState.on) wallStart(); else if (path !== 'boot') toast('Музыкальные обои: ' + (wallState.err || 'не удалось включить'), 'alert');
    } else { wallStop(); wallState.on = false; wallState.err = null; await pulse.wall.disable().catch(() => {}); }
    if (path !== 'boot') deferRerender(0);
  }
  wallMetaKey = ''; wallMeta(true);
}
function wallStart() {
  wallStop(); const fps = Math.max(10, Math.min(60, +S().wall.fps || 30));
  wallT = setInterval(wallTick, Math.round(1000 / fps));
}
function wallStop() { clearInterval(wallT); wallT = null; }
// спектр читаем напрямую из анализатора: обои должны жить, даже когда окно Pulse свёрнуто или в трее
function wallTick() {
  if (!S().wall.on) return wallStop();
  let f = null;
  if (engine === 'audio' && playing && analyser) { if (!wallBuf || wallBuf.length !== analyser.frequencyBinCount) wallBuf = new Uint8Array(analyser.frequencyBinCount); analyser.getByteFrequencyData(wallBuf); f = wallBuf; }
  const ht = E.time(), T = playing ? tempoAt(ht) : null;
  pulse.wall.frame({ f, p: playing, b: +beat || 0, t: T ? { bpm: T.bpm, pos: T.pos, conf: T.conf } : null, sr: actx ? actx.sampleRate : 48000, n: analyser ? analyser.frequencyBinCount : 1024 });
  if (performance.now() - wallMetaAt > 1000) wallMeta(false);
}
function wallMeta(force) {
  wallMetaAt = performance.now(); if (!pulse.wall || !S().wall.on) return;
  const t = curTrack(), W = S().wall, pal = basePal || ACCENTS.neon[1];
  const m = { cfg: { ...W, style: W.style === 'same' ? lib.vizStyle : W.style }, fx: S().viz.fx, sens: S().viz.sens, has: !!t, title: t ? t.title : '', author: t ? t.author : '', art: t ? artOf(t, 544) : '', playing, cur: E.time(), dur: E.dur(), line: lyState.id === (t && t.id) ? lyState.curText || '' : '', pal, liked: !!t && isLiked(t.id) };
  const key = JSON.stringify({ ...m, cur: 0 });
  if (!force && key === wallMetaKey && !playing) return; wallMetaKey = key;
  pulse.wall.meta(m);
}

// ================= КОНФИГИ =================
const CFG_PARTS = [['look', 'Внешний вид', ['look', 'ui']], ['ly', 'Текст', ['ly']], ['viz', 'Визуал', ['viz']], ['audio', 'Звук и EQ', ['audio']], ['dj', 'Диджей', ['dj']], ['widget', 'Виджет', ['widget']], ['wall', 'Обои', ['wall']], ['discord', 'Discord', ['discord']], ['perf', 'Производительность', ['perf']], ['layout', 'Кастомизация', ['layout']]];
const CFG_PRESETS = [
  ['eco', 'Слабый ПК', 'Максимум плавности: без свечения, размытия и тяжёлых эффектов', { perf: { mode: 'eco', fps: 30, dpr: 1 }, viz: { fx: { glow: 0, trails: 0, shake: 0, flash: 0, mirror: 'off', density: 60 } }, look: { ambient: false, react: false, beat: false, tint: 0 }, ly: { glow: false, blur: false, anim: 'none' }, ui: { glass: false, liquid: false } }],
  ['balance', 'Баланс', 'Красиво и без лагов — по умолчанию для большинства', { perf: { mode: 'auto', fps: 60, dpr: 1.5 }, viz: { fx: { glow: 70, trails: 0, shake: 0, flash: 0, density: 90 } }, look: { ambient: true, react: true, reactAmt: 40, beat: true, tint: 30 }, ly: { glow: true, blur: true, anim: 'pop' } }],
  ['party', 'Вечеринка', 'Яркий визуал, вспышки и тряска на басу', { perf: { mode: 'high', fps: 0, dpr: 2 }, viz: { react: 85, fx: { glow: 160, trails: 35, zoom: 70, shake: 35, flash: 50, hue: 120, density: 140, bass: 140 } }, look: { react: true, reactAmt: 90, beat: true, tint: 70 }, ly: { anim: 'glow', glow: true } }],
  ['minimal', 'Минимализм', 'Спокойно: без анимаций цвета и тряски', { viz: { fx: { glow: 40, trails: 0, zoom: 10, shake: 0, flash: 0, hue: 0 } }, look: { react: false, beat: false, tint: 10 }, ly: { anim: 'none', glow: false } }]
];
const cfgList = () => (lib.configs = lib.configs || []);
const cfgParts = () => (lib.cfgParts = lib.cfgParts || ['look', 'ly', 'viz', 'audio', 'widget', 'perf', 'layout']);
function cfgTab() {
  const L = cfgList(), parts = cfgParts();
  const chips = `<div class="chips">${CFG_PARTS.map(([k, n]) => `<button class="chip ${parts.includes(k) ? 'on' : ''}" data-sact="cx:x.cfgpart:${k}">${parts.includes(k) ? ico('check') : ''}${n}</button>`).join('')}</div>`;
  const list = L.length ? `<div class="cfg-list">${L.map((c, i) => `<div class="cfg-item ${lib.cfgActive === c.id ? 'on' : ''}"><div class="cfg-n"><b>${esc(c.name)}</b><span>${fmtDate(c.at)} · ${c.parts.map((p) => (CFG_PARTS.find((x) => x[0] === p) || [0, p])[1]).join(', ')}${i < 9 ? ` · Alt+${i + 1}` : ''}</span></div>
      <div class="cfg-b">${xBtn('cfgapply:' + c.id, 'check', lib.cfgActive === c.id ? 'Применён' : 'Применить', lib.cfgActive === c.id ? '' : 'acc')}<button class="ib sm" data-sact="cx:x.cfgupd:${c.id}" title="Перезаписать текущими настройками">${ico('save')}</button><button class="ib sm" data-sact="cx:x.cfgren:${c.id}" title="Переименовать">${ico('edit')}</button><button class="ib sm" data-sact="cx:x.cfgexp:${c.id}" title="В файл">${ico('download')}</button><button class="ib sm" data-sact="cx:x.cfgdel:${c.id}" title="Удалить">${ico('trash')}</button></div></div>`).join('')}</div>` : '<div class="cfg-empty">Пока нет своих конфигов — сохрани текущие настройки под любым именем</div>';
  return { id: 'cfg', icon: 'layers', title: 'Конфиги', rows: [
    R('Конфиги', 'Наборы настроек под разные случаи: «Игры», «Вечеринка», «Ночь». Переключаются в один клик или клавишами Alt + 1…9. Применяются разом, без лагов', '', 'конфиг профиль пресет'),
    grp('Сохранить текущие настройки'),
    { raw: `<div class="cfg-save"><input class="field xin" id="cfgName" placeholder="Название, например «Вечеринка»" spellcheck="false" maxlength="40">${xBtn('cfgsave', 'save', 'Сохранить', 'acc')}</div>` },
    R('Что входит в конфиг', '', '', 'разделы'), { raw: chips },
    grp('Мои конфиги'), { raw: list },
    R('Файл', 'Перенос конфигов на другой компьютер', `${xBtn('cfgimp', 'file', 'Импорт')}${L.length ? xBtn('cfgexpall', 'download', 'Экспорт всех') : ''}`),
    grp('Готовые'),
    { raw: `<div class="cfg-presets">${CFG_PRESETS.map(([k, n, d]) => `<button class="cfg-pre" data-sact="cx:x.cfgpre:${k}"><b>${n}</b><span>${d}</span></button>`).join('')}</div>` },
    R('Автосохранение в активный конфиг', 'Любые изменения сразу записываются в применённый конфиг', tg('cfg.autoSave'))
  ] };
}
function cfgSnapshot(parts) { const s = S(), data = {}; parts.forEach((p) => (CFG_PARTS.find((x) => x[0] === p) || [0, 0, []])[2].forEach((k) => (data[k] = JSON.parse(JSON.stringify(s[k]))))); return { data, vizStyle: parts.includes('viz') ? lib.vizStyle : undefined }; }
function cfgApplyData(c) {
  const s = S(); for (const k in c.data) s[k] = mergeDeep(DEF_SETTINGS[k], c.data[k]);
  if (c.vizStyle && Viz.STYLES.some((v) => v.id === c.vizStyle)) lib.vizStyle = c.vizStyle;
  if (!Array.isArray(s.audio.eq) || s.audio.eq.length !== 10) s.audio.eq = [...DEF_SETTINGS.audio.eq];
  applySettings(); applyCustom(); if (c.data.layout && typeof czApply === 'function') czApply(); if (c.data.discord) discordApply(); if (c.data.wall) wallApply('wall.on'); updateButtons(); save(); rerenderSettings();
}
function cfgApply(id) { const c = cfgList().find((x) => x.id === id); if (!c) return; cfgApplyData(c); lib.cfgActive = c.id; save(); rerenderSettings(); toast(`Конфиг «${c.name}» применён`, 'layers'); }
let cfgAutoT = 0;
function cfgAutoSave() { if (document.body.classList.contains('cz-edit')) return; if (!S().cfg.autoSave || !lib.cfgActive) return; clearTimeout(cfgAutoT); cfgAutoT = setTimeout(() => { const c = cfgList().find((x) => x.id === lib.cfgActive); if (c) { Object.assign(c, cfgSnapshot(c.parts), { at: Date.now() }); save(); } }, 1500); }
const xDownload = (name, obj) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); };
window.addEventListener('keydown', (e) => {
  if (!e.altKey || e.ctrlKey || e.shiftKey || !/^Digit[1-9]$/.test(e.code) || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  const c = cfgList()[+e.code.slice(5) - 1]; if (c) { e.preventDefault(); cfgApply(c.id); }
});

// ================= МЕНЕДЖЕР АККАУНТОВ =================
// 2.0.3: аккаунты разделены по сервисам — у YouTube Music, Apple Music и Spotify свои списки.
// Аватарка справа вверху показывает аккаунт сервиса, открытого сейчас (вкладка в боковом меню),
// в Настройки → Аккаунты — три отдельных раздела.
const ACC_S = ['yt', 'am', 'sp'];
const accmS = { yt: { active: null, list: [] }, am: { active: null, list: [] }, sp: { active: null, list: [] } }, accmAtS = { yt: 0, am: 0, sp: 0 };
let accm = accmS.yt; // старое имя (плагины) — список YouTube Music
const accSet = (s, r) => { if (r && !r.error) { accmS[s] = r; accmAtS[s] = performance.now(); if (s === 'yt') accm = r; } return accmS[s]; };
const accSvcName = (s) => ({ yt: 'YouTube Music', am: 'Apple Music', sp: 'Spotify' })[s] || 'YouTube Music';
const accSvcIco = (s) => ({ yt: 'ytm', am: 'apple', sp: 'spotify' })[s] || 'ytm';
const accUser = (s) => (s === 'yt' ? !!account : !!(typeof svcSt !== 'undefined' && svcSt[s] && svcSt[s].user));
function accCur(s) {
  if (s === 'yt') return account ? { name: account.name, photo: account.photo } : null;
  if (!accUser(s)) return null; const a = (accmS[s].list || []).find((x) => x.active);
  return { name: (a && a.name) || svcSt[s].name || accSvcName(s), photo: a && a.photo };
}
function accmRefresh(force, s) {
  if (!pulse.accounts) return Promise.resolve(accm);
  const list = s ? [s] : ACC_S;
  return Promise.all(list.map((k) => { if (!force && performance.now() - accmAtS[k] < 5000) return accmS[k]; accmAtS[k] = performance.now(); return pulse.accounts.list(k).then((r) => accSet(k, r)).catch(() => accmS[k]); })).then(() => accm);
}
const accAva = (a, cls = '') => a && a.photo ? `<img data-i18n-skip class="acc-av ${cls}" src="${esc(a.photo)}" referrerpolicy="no-referrer">` : `<span data-i18n-skip class="acc-av ava ${cls}">${esc(((a && a.name) || '?')[0].toUpperCase())}</span>`;
function accTab() {
  accmRefresh().then(() => { const k = JSON.stringify(accmS); if (k !== accTab.k) { accTab.k = k; if (lib.setTab === 'accounts' && route().r === 'settings') deferRerender(0); } });
  const grid = (s) => {
    const L = [...(accmS[s].list || [])].sort((x, y) => (y.active - x.active) || ((y.used || 0) - (x.used || 0)));
    const cards = L.map((a) => `<div class="acc-card ${a.active ? 'on' : ''}" ${a.active ? '' : `data-sact="cx:x.accsw:${s}|${a.id}" title="Переключиться на этот аккаунт"`}>
      ${accAva(a)}<b data-i18n-skip>${esc(a.name)}</b><span>${a.active ? '<i class="acc-dot"></i>Сейчас активен' : 'Был активен ' + fmtDate(a.used)}</span>
      <div class="acc-tools"><button class="ib sm" data-sact="cx:x.accren:${s}|${a.id}" title="Переименовать">${ico('edit')}</button><button class="ib sm" data-sact="cx:x.accdel:${s}|${a.id}" title="${a.active ? 'Выйти и убрать' : 'Убрать из списка'}">${ico('trash')}</button></div>
      ${a.active ? '' : `<em class="acc-go">${ico('swap')}Переключиться</em>`}</div>`).join('');
    const add = `<div class="acc-card add" data-sact="cx:x.accadd:${s}" title="Войти в ещё один аккаунт ${accSvcName(s)}"><span class="acc-av ava plus">${ico('plus')}</span><b>Добавить аккаунт</b><span>Текущий вход сохранится</span></div>`;
    const empty = !L.length && accUser(s) ? '<div class="cfg-empty">Текущий аккаунт появится здесь через пару секунд</div>' : '';
    return { raw: `${empty}<div class="acc-grid">${cards}${add}</div>` };
  };
  return { id: 'accounts', icon: 'users', title: 'Аккаунты', rows: [
    R('Менеджер аккаунтов', 'У каждого сервиса — свои аккаунты: переключение одним кликом по карточке, без повторного входа. Аватарка справа вверху показывает аккаунт сервиса, открытого сейчас. Вход хранится зашифрованным средствами Windows. Если вход в новый аккаунт отменить — вернётся прежний', '', 'аккаунт переключить несколько google spotify apple'),
    grp('YouTube Music'), grid('yt'),
    grp('Apple Music'), grid('am'),
    grp('Spotify'), grid('sp'),
    R('Быстрое переключение', 'Нажми на свою аватарку справа вверху — там аккаунты открытого сервиса', '')
  ] };
}
// после смены аккаунта — сбрасываем всё, что было взято из прежнего
function accAfter(s) {
  cache.clear();
  if (s === 'yt') { account = null; accLists = null; lib.accCache = null; save(); }
  else if (typeof svcLists !== 'undefined') { svcLists[s] = null; svcSt[s] = { user: false }; if (typeof svcListsSave === "function") svcListsSave(); }
}
async function accSwitch(id, s = 'yt') {
  const a = (accmS[s].list || []).find((x) => x.id === id); toast('Переключаю аккаунт…', 'swap');
  const r = await pulse.accounts.switchTo(id, s).catch((e) => ({ error: String(e) }));
  if (!r || r.error) return toast('Не удалось переключить: ' + (r ? r.error : 'нет ответа'), 'alert');
  accSet(s, r); accAfter(s);
  if (s === 'yt') await refreshAccount(); else { await svcRefresh(); if (typeof lyRecheckSvc === 'function') lyRecheckSvc(s); }
  renderAccBtn(); renderRoute(true); rerenderSettings();
  toast(`${accSvcName(s)}: ${(accCur(s) || a || {}).name || ''}`, s === 'yt' ? 'user' : accSvcIco(s));
}
let accAddWait = null;
async function accAdd(s = 'yt') {
  const had = accUser(s);
  const r = await pulse.accounts.addNew(s).catch(() => null); accSet(s, r);
  accAfter(s); renderAccBtn(); renderSide();
  if (s === 'yt') { accAddWait = had ? 'yt' : null; return openLogin(); }
  if (s === 'sp') { accAddWait = had ? 'sp' : null; return openLogin('sp'); }
  // Apple Music: встроенное окно входа; закрыли, не войдя, — возвращаем прежний аккаунт
  await svcLogin('am', true);
  if (!accUser('am') && had) accRestoreS('am');
}
async function accRestoreS(s) {
  if (accUser(s) || !pulse.accounts.restore) return;
  const r = await pulse.accounts.restore(s).catch(() => null); if (!r || r.error) return;
  accSet(s, r); if (!r.active) return;
  cache.clear();
  if (s === 'yt') await refreshAccount(); else await svcRefresh();
  renderAccBtn(); renderSide(); renderRoute(true); if (route().r === 'settings') rerenderSettings();
  const c = accCur(s); if (c) toast(`Вход отменён — вернул аккаунт ${c.name}`, 'user');
}
// 1.9.4: окно входа закрыли, не войдя, — возвращаем прежний аккаунт (раньше человек оставался разлогиненным)
new MutationObserver(() => {
  if (!accAddWait || $('modal').classList.contains('show')) return;
  const s = accAddWait; accAddWait = null;
  setTimeout(() => accRestoreS(s), s === 'yt' ? 400 : 1500);
}).observe($('modal'), { attributes: true, attributeFilter: ['class'] });
// после любого входа — запоминаем аккаунт в менеджере его сервиса
{ const base = refreshAccount; refreshAccount = async function (...a) { const r = await base.apply(this, a); if (account && pulse.accounts) pulse.accounts.snapshot('yt').then((x) => accSet('yt', x)).catch(() => {}); renderAccBtn(); if (account) { flushLikes(); likePullT('yt'); } return r; }; }
// 2.0.3: лайки с сервера подтягиваем не чаще раза в 10 минут на сервис
const likePullAt = {}; function likePullT(sv) { if (performance.now() - (likePullAt[sv] || -1e9) < 600e3) return; likePullAt[sv] = performance.now(); pullLikes(sv); }
// аватарка справа вверху — аккаунт сервиса, открытого сейчас
renderAccBtn = function () {
  const b = $('accBtn'); if (!b) return; const s = CL(), cur = accCur(s);
  b.classList.toggle('out', !cur); b.dataset.svc = s;
  b.innerHTML = cur ? (cur.photo ? `<img src="${esc(cur.photo)}" referrerpolicy="no-referrer" />` : `<span class="ava">${esc((cur.name || '?')[0].toUpperCase())}</span>`) : `${ico(s === 'yt' ? 'google' : accSvcIco(s))}<span>Войти</span>`;
  b.title = cur ? `${cur.name} — ${accSvcName(s)}` : `Войти в ${accSvcName(s)}`;
};
// меню аватарки: аккаунты открытого сервиса
function accPopClose() { const p = $('accPop'); if (p) { if (window.PulseMotion) PulseMotion.remove(p,'account'); else p.remove(); } }
const accLogin = (s) => (s === 'yt' ? openLogin() : svcLogin(s));
$('accBtn').onclick = async (e) => {
  e.stopPropagation(); if ($('accPop')) return accPopClose();
  const btn = e.currentTarget, s = CL(); await accmRefresh(true, s);
  const others = (accmS[s].list || []).filter((a) => !a.active), cur = accCur(s);
  if (!cur && !others.length) return accLogin(s);
  hideMenu();
  const cfgs = cfgList().slice(0, 4);
  window.PulseMotion?.flush('account');
  const p = document.createElement('div'); p.id = 'accPop'; p.className = 'acc-pop';
  p.innerHTML = `${cur ? `<div class="ap-me">${accAva(cur, 'big')}<div><b>${esc(cur.name)}</b><span><i class="acc-dot"></i>${accSvcName(s)} · активен</span></div></div>` : `<div class="ap-me out"><span class="acc-av ava big">?</span><div><b>Не выполнен вход</b><span>${accSvcName(s)}: выбери аккаунт или войди</span></div></div>`}
    ${others.length ? `<div class="ap-h">Переключиться</div>${others.map((a) => `<button class="ap-acc" data-ap="sw:${a.id}">${accAva(a)}<span><b data-i18n-skip>${esc(a.name)}</b><em>${fmtDate(a.used)}</em></span><i class="ap-del" data-ap="del:${a.id}" title="Убрать из списка">${ico('x')}</i></button>`).join('')}` : ''}
    <button class="ap-acc add" data-ap="add"><span class="acc-av ava plus">${ico('plus')}</span><span><b>Добавить аккаунт ${accSvcName(s)}</b><em>${cur ? 'Текущий вход сохранится' : 'Войти'}</em></span></button>
    ${cfgs.length ? `<div class="ap-h">Конфиги</div><div class="ap-cfg">${cfgs.map((c) => `<button class="chip ${lib.cfgActive === c.id ? 'on' : ''}" data-ap="cfg:${c.id}">${esc(c.name)}</button>`).join('')}</div>` : ''}
    <div class="ap-sep"></div>
    <button class="ap-it" data-ap="manage">${ico('users')}Управление аккаунтами</button>
    ${cur ? `<button class="ap-it" data-ap="refresh">${ico('refresh')}Обновить плейлисты</button>` : ''}
    <button class="ap-it" data-ap="settings">${ico('settings')}Настройки</button>
    ${cur ? `<button class="ap-it danger" data-ap="logout">${ico('logout')}Выйти из этого аккаунта</button>` : ''}`;
  document.body.appendChild(p);
  const b = btn.getBoundingClientRect();
  p.style.top = b.bottom + 8 + 'px'; p.style.left = Math.max(8, Math.min(b.right - p.offsetWidth, innerWidth - p.offsetWidth - 8)) + 'px';
  p.onclick = async (ev) => {
    const el = ev.target.closest('[data-ap]'); if (!el) return; ev.stopPropagation();
    const [cmd, arg] = el.dataset.ap.split(':'); accPopClose();
    if (cmd === 'del') { const a = (accmS[s].list || []).find((x) => x.id === arg); if (!a || !confirm(`Убрать «${a.name}» из списка? Чтобы вернуть — войти заново.`)) return; accSet(s, await pulse.accounts.remove(arg, s).catch(() => null)); toast('Аккаунт убран', 'trash'); if (route().r === 'settings') rerenderSettings(); return; }
    if (cmd === 'sw') return accSwitch(arg, s);
    if (cmd === 'add') return cur || others.length ? accAdd(s) : accLogin(s);
    if (cmd === 'cfg') return cfgApply(arg);
    if (cmd === 'manage') { lib.setTab = 'accounts'; if (document.body.classList.contains('pp-open')) closePP(); return go({ r: 'settings' }); }
    if (cmd === 'settings') return go({ r: 'settings' });
    if (cmd === 'refresh') return (s === 'yt' ? refreshAccount() : svcRefresh()).then(() => toast('Обновлено', 'refresh'));
    if (cmd === 'logout') {
      if (!confirm(`Выйти из аккаунта ${accSvcName(s)}? Он пропадёт из списка аккаунтов.`)) return;
      const id = accmS[s].active; if (id && pulse.accounts) accSet(s, await pulse.accounts.remove(id, s).catch(() => null));
      if (s === 'yt') { await pulse.account.logout(); account = null; accLists = null; lib.accCache = null; }
      else { await pulse.svc.logout(s).catch(() => {}); svcSt[s] = { user: false }; svcLists[s] = null; if (typeof svcListsSave === "function") svcListsSave(); }
      cache.clear(); renderAccBtn(); renderSide(); renderRoute(true); toast(`Вы вышли из ${accSvcName(s)}`, 'logout');
    }
  };
};
document.addEventListener('pointerdown', (e) => { const p = $('accPop'); if (p && !p.contains(e.target) && !e.target.closest('#accBtn')) accPopClose(); }, true);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') accPopClose(); });

// ================= ДЕЙСТВИЯ =================
async function extraAct(a, el) {
  const [cmd, arg] = [a.split(':')[0], a.split(':').slice(1).join(':')];
  if (cmd === 'wsnap') return pulse.widgetSnap && pulse.widgetSnap(arg);
  if (cmd === 'dcportal') return pulse.openUrl ? pulse.openUrl('https://discord.com/developers/applications') : window.open('https://discord.com/developers/applications');
  if (cmd === 'cfgpart') { const p = cfgParts(); lib.cfgParts = p.includes(arg) ? p.filter((x) => x !== arg) : p.concat(arg); save(); el.classList.toggle('on'); return deferRerender(120); }
  if (cmd === 'cfgsave') {
    const inp = $('cfgName'), name = ((inp && inp.value) || '').trim() || `Конфиг ${cfgList().length + 1}`, parts = cfgParts(); if (!parts.length) return toast('Выбери хотя бы один раздел', 'alert');
    const ex = cfgList().find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (ex && !confirm(`Конфиг «${ex.name}» уже есть. Перезаписать?`)) return;
    const c = Object.assign(ex || { id: 'c' + Date.now().toString(36) }, { name, parts: [...parts], at: Date.now() }, cfgSnapshot(parts));
    if (!ex) cfgList().push(c); lib.cfgActive = c.id; save(); rerenderSettings(); return toast(`Сохранено: «${name}»`, 'save');
  }
  if (cmd === 'cfgapply') return cfgApply(arg);
  if (cmd === 'cfgupd') { const c = cfgList().find((x) => x.id === arg); if (!c || !confirm(`Перезаписать «${c.name}» текущими настройками?`)) return; Object.assign(c, cfgSnapshot(c.parts), { at: Date.now() }); save(); rerenderSettings(); return toast('Конфиг обновлён', 'save'); }
  if (cmd === 'cfgren') { const c = cfgList().find((x) => x.id === arg); if (!c) return; const n = prompt('Новое название', c.name); if (n && n.trim()) { c.name = n.trim().slice(0, 40); save(); rerenderSettings(); } return; }
  if (cmd === 'cfgdel') { const c = cfgList().find((x) => x.id === arg); if (!c || !confirm(`Удалить конфиг «${c.name}»?`)) return; lib.configs = cfgList().filter((x) => x.id !== arg); if (lib.cfgActive === arg) lib.cfgActive = null; save(); return rerenderSettings(); }
  if (cmd === 'cfgexp') { const c = cfgList().find((x) => x.id === arg); if (c) xDownload(`pulse-config-${c.name.replace(/[^\wа-яё-]+/gi, '_')}.json`, { pulseConfigs: 1, configs: [c] }); return; }
  if (cmd === 'cfgexpall') return xDownload('pulse-configs.json', { pulseConfigs: 1, configs: cfgList() });
  if (cmd === 'cfgimp') {
    const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json';
    i.onchange = async () => { try { const d = JSON.parse(await i.files[0].text()); const arr = d.configs || (d.settings ? [{ name: 'Импорт', parts: CFG_PARTS.map((x) => x[0]), data: d.settings, vizStyle: d.vizStyle }] : null); if (!arr) throw new Error('не тот файл');
      arr.forEach((c) => cfgList().push({ id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: String(c.name || 'Импорт').slice(0, 40), parts: c.parts || Object.keys(c.data || {}), at: Date.now(), data: c.data || {}, vizStyle: c.vizStyle }));
      save(); rerenderSettings(); toast(`Импортировано конфигов: ${arr.length}`, 'check'); } catch (e) { toast('Не удалось прочитать файл: ' + e.message, 'alert'); } };
    return i.click();
  }
  if (cmd === 'cfgpre') { const p = CFG_PRESETS.find((x) => x[0] === arg); if (!p) return; deepAssign(S(), p[3]); lib.cfgActive = null; applySettings(); applyCustom(); save(); rerenderSettings(); return toast(`Готовый конфиг «${p[1]}» применён`, 'layers'); }
  // 2.0.3: arg = «сервис|id» (старый формат без сервиса — YouTube Music)
  const accArg = () => { const [x, y] = arg.includes('|') ? arg.split('|') : ['yt', arg]; return [ACC_S.includes(x) ? x : 'yt', y]; };
  if (cmd === 'accsw') { const [s, id] = accArg(); return accSwitch(id, s); }
  if (cmd === 'accadd') return accAdd(ACC_S.includes(arg) ? arg : 'yt');
  if (cmd === 'accren') { const [s, id] = accArg(); const a = (accmS[s].list || []).find((x) => x.id === id); const n = a && prompt('Как подписать аккаунт?', a.name); if (n && n.trim()) { accSet(s, await pulse.accounts.rename(id, n.trim(), s)); renderAccBtn(); rerenderSettings(); } return; }
  if (cmd === 'accdel') {
    const [s, id] = accArg(); const a = (accmS[s].list || []).find((x) => x.id === id); if (!a || !confirm(a.active ? `Выйти из «${a.name}» и убрать его из списка?` : `Убрать «${a.name}» из списка? Чтобы вернуть — войти заново.`)) return;
    accSet(s, await pulse.accounts.remove(id, s));
    if (a.active) { accAfter(s); if (s !== 'yt') svcSt[s] = { user: false }; renderAccBtn(); renderSide(); renderRoute(true); }
    return rerenderSettings();
  }
}

// ================= КАДР / ТАЙМЕРЫ =================
let dcTickAt = 0;
function extFrame(now, f, wv, bt, tempo, ht, hidden) {
  if (!hidden && route().r === 'settings' || (!hidden && (pops.ly || pops.viz))) pvFrame(now, f, wv, bt, tempo);
  if (now - dcTickAt > 1000) { dcTickAt = now; if (S().discord.on) { discordTick(false); const pv = document.getElementById('pvDiscord'); if (pv && !hidden && visible(pv)) updPreview('pvDiscord', discordPreview); } }
}

// ================= ЗАПУСК =================
PX.on('ready', () => {
  // полноэкранный режим: остаётся таким, каким был при закрытии
  if (S().app.keepFs !== false && lib.fs) pulse.win('fs-on');
  if (S().discord.on) discordApply();
  if (S().wall.on) wallApply('boot');
  accmRefresh(true);
});
pulse.onCommand((n) => { if (n === 'wallToggle') { S().wall.on = !S().wall.on; save(); wallApply('wall.on'); rerenderSettings(); toast(S().wall.on ? 'Музыкальные обои включены' : 'Музыкальные обои выключены', 'wallpaper'); } });
