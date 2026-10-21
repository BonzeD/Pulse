const { app, BrowserWindow, ipcMain, Tray, Menu, globalShortcut, nativeImage, screen, session, shell, clipboard } = require('electron');
const crypto = require('crypto');
const http = require('http');
const fs = require('fs');
const path = require('path');
const safety = require('./core-safety');
const nativeDialogs=require('./native-dialogs').create(require('electron').dialog,()=>readStore().library?.settings?.app?.language||'en');
const spicyProject = require('./spicy-project');
const { createMediaBridge } = require('./media-session');
let mediaBridge = null;
const yt = require('./ytlist');
const off = require('./offline');
let mediaCatalog;
function media() {
  if (!mediaCatalog) mediaCatalog = require('./local-library').createLocalLibrary({
    userData: app.getPath('userData'),
    getKnown: id => readStore().library?.known?.[id],
    resolveDownloaded: id => { const v=vidOf(id),row=off.offlineCatalog()[v];if(!v||!row)return null;const root=path.join(app.getPath('userData'),'offline');return {file:safety.childFile(root,row.file),videoCandidates:row.videoCandidates.map(f=>safety.childFile(root,f)).filter(Boolean),cover:path.join(root,v+'.jpg')}; },
    imageToJpeg: bytes => { if (!bytes) throw Error('Изображение слишком большое'); const image=nativeImage.createFromBuffer(bytes); if(image.isEmpty()) throw Error('Не удалось прочитать изображение'); const size=image.getSize(); if(size.width*size.height>40000000)throw Error('Слишком большое разрешение обложки'); return image.resize({width:Math.min(size.width,1600),quality:'best'}).toJPEG(90); },
    notify: progress => { if(win&&!win.isDestroyed())win.webContents.send('media:progress',progress); },
  });
  return mediaCatalog;
}
const lyr = require('./lyrics'); // 2.0: тексты песен
const acc = require('./account');
const ytm = require('./ytm');
const discord = require('./discord');
const wallpaper = require('./wallpaper-host');
const svc = require('./services'); // 2.0.2: Apple Music и Spotify как клиенты
ytm.setApi((ep, body, q) => acc.api(ep, body, q));
svc.setYtm(ytm);
// 2.0.2: текущий клиент ('yt' | 'am' | 'sp') — задаёт renderer; запросы с id «am:…»/«sp:…» всегда идут в свой сервис
let client = 'yt';

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }
// Installer command is deliberately argument-only: no paths, scripts or renderer IPC.
if (process.argv.includes('--quit-for-update')) { app.quit(); process.exit(0); }
// 2.0.4: во время выхода окна уничтожаются, а запоздавшие события/таймеры ещё могут к ним обратиться.
// Такая ошибка безвредна — не показываем окно «A JavaScript error occurred in the main process».
process.on('uncaughtException', (err) => {
  if (err && /Object has been destroyed/.test(err.message || '')) { console.warn('[pulse] ignored:', err.message); return; }
  try { nativeDialogs.showErrorBox('Pulse — ошибка', String((err && err.stack) || err)); } catch {}
});

// ---------- 1.9.6: полный сброс ----------
// Выполняется при следующем запуске, до того как Chromium откроет свои базы (Local Storage, кэш) — иначе на Windows
// файлы заняты и «старые настройки» возвращались. Режим 'settings' — всё оформление и раскладка, библиотека и вход
// остаются; 'all' — как после чистой установки (по желанию — без удаления скачанных треков и модели распознавания).
// В library.json это поля самих данных — всё остальное (settings, конфиги, раскладка, стиль визуала, режимы) — настройки
const LIB_DATA = ['queue', 'playlists', 'lyrics', 'offsets', 'stretch', 'known', 'ytc', 'accCache', 'accInfo', 'cues', 'lyV', 'syncAt', 'loginMode', 'lastQ', 'volume', 'shuffle', 'repeat', 'autoplay', 'autoDl'];
const RESET_MARK = () => path.join(app.getPath('userData'), 'reset.pending');
const rmrf = (p) => { try { fs.rmSync(p, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 }); } catch (e) { console.error('reset rm', p, e.message); } };
function runPendingReset() {
  const ud = app.getPath('userData'), mk = RESET_MARK(); if (!fs.existsSync(mk)) return;
  let o = {}; try { o = JSON.parse(fs.readFileSync(mk, 'utf8')) || {}; } catch {}
  const lf = path.join(ud, 'library.json');
  if (o.mode === 'all') {
    const keep = new Set(['reset.pending']); if (o.keepDownloads !== false) { keep.add('offline'); keep.add('bin'); keep.add('models'); keep.add('local-media'); keep.add('media-library.json'); keep.add('media-library.json.bak'); }
    for (const f of fs.readdirSync(ud)) if (!keep.has(f)) rmrf(path.join(ud, f));
    // скачанные треки остаются — сохраняем только их список, чтобы они снова появились в «Скачанном»
    if (o.keepDownloads !== false && o.known) try { fs.writeFileSync(lf, JSON.stringify({ library: { known: o.known } })); } catch {}
  } else {
    let st = {}; try { st = JSON.parse(fs.readFileSync(lf, 'utf8')) || {}; } catch {}
    const lib = st.library || {}, kept = {}; LIB_DATA.forEach((k) => { if (k in lib) kept[k] = lib[k]; });
    try { safety.atomicJSON(lf, { library: kept }); rmrf(lf + '.bak'); } catch {}
    ['glass.json', 'Local Storage', 'Session Storage', 'IndexedDB', 'Cache', 'Code Cache', 'GPUCache', 'DawnCache', 'DawnGraphiteCache', 'DawnWebGPUCache', 'Shared Dictionary', 'blob_storage'].forEach((f) => rmrf(path.join(ud, f)));
  }
  rmrf(mk);
}
try { runPendingReset(); } catch (e) { console.error('reset', e); }
let resetting = false;

// Чистый Chrome UA — YouTube лучше работает без "Electron" в строке
app.userAgentFallback = app.userAgentFallback.replace(/\s?Electron\/[\d.]+/, '').replace(/\s?pulse-player\/[\d.]+/, '');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// 2.0.5: рисование на видеокарте. Растеризация текста/canvas на GPU и zero-copy заметно поднимают FPS текста и визуала;
// ignore-gpu-blocklist включает ускорение и на старых видеокартах из чёрного списка Chromium.
// Если на каком-то ПК появятся артефакты — запустить с переменной PULSE_SAFE_GPU=1.
if (!process.env.PULSE_SAFE_GPU) {
  app.commandLine.appendSwitch('ignore-gpu-blocklist');
  app.commandLine.appendSwitch('enable-gpu-rasterization');
  app.commandLine.appendSwitch('enable-zero-copy');
  // 2.0.6: на ноутбуках с двумя видеокартами — рисовать на мощной (дискретной), а не на встроенной
  app.commandLine.appendSwitch('force_high_performance_gpu');
}

const ROOT = path.join(__dirname, 'renderer');
const ICON = path.join(__dirname, 'build', 'icon.png');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.jpg': 'image/jpeg' };
let pendingFs = false, manualWidget = false;
let win, widget, tray, port, quitting = false, lastState = null, lastLyrics = null, closeMode = 'widget';

const storeFile = () => path.join(app.getPath('userData'), 'library.json');
const readStore = () => safety.readJSON(storeFile(), {}, true);
const writeStore = (d) => { try { safety.atomicJSON(storeFile(), d, true); } catch (e) { console.error(e); } };

// Кэш обложек на диске: всё, что хоть раз показывалось, доступно без интернета
const imgDir = () => { const d = path.join(app.getPath('userData'), 'imgcache'); fs.mkdirSync(d, { recursive: true }); return d; };
const serveImg = require('./image-cache').create(imgDir);

function trimImgCache(maxMB = 400) {
  try {
    const d = imgDir(); const files = fs.readdirSync(d).map((n) => { const st = fs.statSync(path.join(d, n)); return { n, s: st.size, t: st.atimeMs || st.mtimeMs }; }).sort((a, b) => b.t - a.t);
    let tot = 0; for (const f of files) { tot += f.s; if (tot > maxMB * 1e6) try { fs.unlinkSync(path.join(d, f.n)); } catch {} }
  } catch {}
}
// Плагины: userData/plugins/*.js — визуализации, кнопки, настройки (см. PLUGINS.md)
const plugDir = () => { const d = path.join(app.getPath('userData'), 'plugins'); fs.mkdirSync(d, { recursive: true }); return d; };
function servePlugin(res, rel) {
  const d = plugDir(), f = safety.childFile(d, rel);
  if (!f) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (err, data) => { if (err) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(data); });
}
function listPlugins() {
  const d = plugDir();
  try {
    const ex = path.join(d, 'example-visual.js.off');
    if (!fs.existsSync(ex)) fs.copyFileSync(path.join(__dirname, 'renderer', 'plugin-example.js'), ex);
  } catch {}
  return fs.readdirSync(d).filter((n) => /\.js$/i.test(n)).sort();
}

// Локальный http-сервер: YouTube-плеер не работает со страниц file://
function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const hosts = ['127.0.0.1', 'widget.localhost', 'wall.localhost'].map(h => h + ':' + port);
      if (!hosts.includes(req.headers.host) || req.headers['sec-fetch-site'] === 'cross-site') { res.writeHead(403); return res.end(); }
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
      let p; try { p = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
      if (p === '/img') return serveImg(req, res);
      if (p.startsWith('/plugins/')) return servePlugin(res, p.slice(9));
      if (p.startsWith('/stream/')) { // 2.0.2: трек Apple Music / Spotify звучит из найденной записи YouTube Music
        const id = p.slice(8);
        if (!svc.isSvc(id)) return off.proxyStream(req, res, id);
        return svc.ytFor(id).then((v) => off.proxyStream(req, res, v)).catch((e) => { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(String(e.message || e)); });
      }
      if (p.startsWith('/media/')) { const m=/^\/media\/([^/]+)\/(audio|cover|video|video-compat)$/.exec(p); if(!m){res.writeHead(404);return res.end();} try{return media().serve(req,res,m[1],m[2]);}catch{res.writeHead(404);return res.end();} }
      if (p.startsWith('/offline/')) return off.serveOffline(req, res, p.slice(9));
      if (p === '/') p = '/index.html';
      const f = safety.childFile(ROOT, p);
      if (!f) { res.writeHead(403); return res.end(); }
      fs.readFile(f, (err, data) => {
        if (err) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    const tryPort = (p) => {
      server.removeAllListeners('error');
      server.once('error', (e) => { if (e.code === 'EADDRINUSE' && p < 47931) tryPort(p + 1); else reject(e); });
      server.listen(p, '127.0.0.1', () => { port = p; resolve(); });
    };
    tryPort(47831);
  });
}

// 1.9.1: «Прозрачный» Liquid Glass — настоящее прозрачное окно (включается при запуске, т.к. Windows не умеет менять это на лету)
const glassFile = () => path.join(app.getPath('userData'), 'glass.json');
let glassClear = false; // 1.9.1: Liquid Glass убран — окно всегда обычное
let clearMaxPrev = null;
function createMain() {
  win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 980, minHeight: 640,
    frame: false, backgroundColor: glassClear ? '#00000000' : '#07060b', transparent: glassClear, icon: ICON, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), backgroundThrottling: false, contextIsolation: true }
  });
  safety.lockNavigation(win.webContents, u => safety.appURL(u, port));
  win.loadURL(`http://127.0.0.1:${port}/index.html`);
  win.once('ready-to-show', () => { win.show(); if (pendingFs) { win.setFullScreen(true); pendingFs = false; } });
  // 1.9: открыл плеер — виджет прячется сам (если включено «Скрывать при открытии плеера»)
  const autoHideWidget = () => { if (quitting) return; if (widget && !widget.isDestroyed() && widget.isVisible() && wcfg.autoHide !== false && !manualWidget) widget.hide(); };
  win.on('show', autoHideWidget); win.on('restore', autoHideWidget);
  win.on('focus', () => { if (quitting || win.isDestroyed()) return; if (widget && !widget.isDestroyed() && widget.isVisible() && wcfg.autoHide !== false && !manualWidget && win.isVisible() && !win.isMinimized()) widget.hide(); });
  win.on('minimize', () => { if (wcfg.onMin) { manualWidget = false; showWidget(); } });
  // 2.0.12: фон. Окно с backgroundThrottling:false браузер считает видимым всегда — даже закрытое в трей/виджет оно
  // рисовало анимации и визуал 60 раз в секунду, отнимая видеокарту и процессор у игр. Теперь при скрытии окно
  // получает сигнал «спрятано» (останавливает свои циклы и анимации), а его процесс и процесс графики — пониженный
  // приоритет Windows: игра получает ресурсы первой. Звук идёт отдельным потоком с повышенным приоритетом и не страдает.
  const bgMode = (hidden) => {
    if (quitting || !win || win.isDestroyed()) return;
    if (bgMode.v === hidden) return; bgMode.v = hidden;
    try { win.webContents.send('cmd', 'winHidden', hidden); } catch {}
    const P = require('os').constants.priority, pr = hidden ? P.PRIORITY_BELOW_NORMAL : P.PRIORITY_NORMAL;
    try { require('os').setPriority(win.webContents.getOSProcessId(), pr); } catch {}
    try { for (const m of app.getAppMetrics()) if (m.type === 'GPU') require('os').setPriority(m.pid, pr); } catch {}
  };
  const bgCheck = () => setTimeout(() => { if (!win || win.isDestroyed()) return; bgMode(!win.isVisible() || win.isMinimized()); }, 50);
  win.on('hide', bgCheck); win.on('minimize', bgCheck); win.on('show', bgCheck); win.on('restore', bgCheck);
  win.on('close', (e) => {
    if (quitting) return;
    if (closeMode === 'quit') { quitting = true; return app.quit(); }
    e.preventDefault(); win.hide(); manualWidget = false; if (closeMode !== 'tray') showWidget();
  });
  // Полноэкранный режим: встроенный YouTube больше не захватывает весь экран — вместо этого
  // включается полноэкранный режим самого Pulse, где меню, панель и кнопка выхода всегда доступны.
  const sendFs = () => { try { win.webContents.send('win:fs', win.isFullScreen()); } catch {} };
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/i.test(url) && !/^https?:\/\/127\.0\.0\.1/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('enter-html-full-screen', () => {
    win.webContents.executeJavaScript('document.fullscreenElement && document.exitFullscreen().catch(()=>{})', true).catch(() => {});
    setTimeout(() => { win.setFullScreen(true); sendFs(); }, 60);
  });
  win.webContents.on('leave-html-full-screen', sendFs);
  win.on('enter-full-screen', sendFs); win.on('leave-full-screen', sendFs);
  win.webContents.on('before-input-event', (e, inp) => {
    if (inp.type !== 'keyDown') return;
    if (inp.key === 'F11') { e.preventDefault(); win.setFullScreen(!win.isFullScreen()); sendFs(); }
    else if (inp.key === 'Escape' && win.isFullScreen()) { e.preventDefault(); cmd('escape'); }
  });
  // боковые кнопки мыши «назад / вперёд»
  win.on('app-command', (_e, c) => { if (c === 'browser-backward') cmd('navBack'); if (c === 'browser-forward') cmd('navFwd'); });
  win.on('maximize', () => win.webContents.send('win:maximized', true));
  win.on('unmaximize', () => win.webContents.send('win:maximized', false));
}

const WSIZES = { mini: [320, 84], standard: [420, 156], large: [460, 300] };
let wcfg = { size: 'standard', opacity: 1, lyrics: true, onTop: true, theme: 'glass', accent: '', scale: 100, autoHide: true };
const wsize = () => { const [w, h] = WSIZES[wcfg.size] || WSIZES.standard, k = Math.max(0.7, Math.min(1.5, (+wcfg.scale || 100) / 100)); return [Math.round(w * k), Math.round(h * k)]; };
function applyWidgetCfg(c) {
  wcfg = Object.assign({}, wcfg, c || {});
  if (!widget) return;
  const [W, H] = wsize();
  // 1.9.2: окно трогаем только когда реально поменялись масштаб/прозрачность/«поверх окон» — каждый такой вызов перерисовывает окно
  const zf = Math.max(0.7, Math.min(1.5, (+wcfg.scale || 100) / 100)), op = Math.max(0.3, Math.min(1, +wcfg.opacity || 1)), top = !!wcfg.onTop;
  if (applyWidgetCfg.zf !== zf) { applyWidgetCfg.zf = zf; try { widget.webContents.setZoomFactor(zf); } catch {} }
  const [ow, oh] = widget.getSize();
  const [x, y] = widget.getPosition();
  if (ow !== W || oh !== H) {
    // держим правый нижний угол на месте — виджет растёт вверх/влево
    const wa = screen.getDisplayMatching(widget.getBounds()).workArea;
    let nx = x + ow - W, ny = y + oh - H;
    nx = Math.max(wa.x, Math.min(nx, wa.x + wa.width - W)); ny = Math.max(wa.y, Math.min(ny, wa.y + wa.height - H));
    widget.setBounds({ x: nx, y: ny, width: W, height: H });
  }
  if (applyWidgetCfg.op !== op) { applyWidgetCfg.op = op; widget.setOpacity(op); }
  if (applyWidgetCfg.top !== top) { applyWidgetCfg.top = top; widget.setAlwaysOnTop(top, 'floating'); }
  widget.webContents.send('wcfg', wcfg);
}
// запись настроек виджета на диск — не чаще раза в 600 мс (раньше синхронная запись файла на каждую правку)
let wcfgSaveT = null;
const saveWidgetCfgSoon = () => { clearTimeout(wcfgSaveT); wcfgSaveT = setTimeout(() => { const st = readStore(); st.widgetCfg = wcfg; writeStore(st); }, 600); };

function createWidget() {
  const s = readStore();
  if (s.widgetCfg) wcfg = Object.assign(wcfg, s.widgetCfg);
  const wa = screen.getPrimaryDisplay().workArea;
  const [W, H] = wsize();
  let pos = s.widgetPos || { x: wa.x + wa.width - W - 24, y: wa.y + wa.height - H - 24 };
  const vis = screen.getAllDisplays().some((d) => pos.x >= d.workArea.x - 50 && pos.x < d.workArea.x + d.workArea.width - 50 && pos.y >= d.workArea.y - 20 && pos.y < d.workArea.y + d.workArea.height - 40);
  if (!vis) pos = { x: wa.x + wa.width - W - 24, y: wa.y + wa.height - H - 24 };
  widget = new BrowserWindow({
    width: W, height: H, x: pos.x, y: pos.y, frame: false, transparent: true, resizable: false, maximizable: false, minimizable: false, fullscreenable: false,
    alwaysOnTop: true, skipTaskbar: true, show: false, hasShadow: false, icon: ICON,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), backgroundThrottling: false, contextIsolation: true }
  });
  widget.setAlwaysOnTop(!!wcfg.onTop, 'floating');
  widget.setOpacity(Math.max(0.3, Math.min(1, +wcfg.opacity || 1)));
  // 1.9.4: свой хост — у Chromium зум общий на хост, и масштаб виджета сбрасывал «Размер интерфейса» главного окна
  safety.lockNavigation(widget.webContents, u => safety.appURL(u, port, 'widget.localhost', '/widget.html'));
  widget.loadURL(`http://widget.localhost:${port}/widget.html`);
  widget.webContents.on('did-finish-load', () => { applyWidgetCfg.zf = Math.max(0.7, Math.min(1.5, (+wcfg.scale || 100) / 100)); try { widget.webContents.setZoomFactor(Math.max(0.7, Math.min(1.5, (+wcfg.scale || 100) / 100))); } catch {} widget.webContents.send('wcfg', wcfg); lastState && widget.webContents.send('state', lastState); lastLyrics && widget.webContents.send('lyrics', lastLyrics); });
  for (const event of ['show','hide']) widget.on(event, () => { if (widget && !widget.isDestroyed()) widget.webContents.send('widget-visible', event === 'show'); });
  widget.on('moved', () => { const [x, y] = widget.getPosition(); const st = readStore(); st.widgetPos = { x, y }; writeStore(st); });
  widget.on('close', (e) => { if (!quitting) { e.preventDefault(); widget.hide(); } });
  // 2.0.4: при выходе виджет закрывается раньше главного окна — обнуляем ссылку, чтобы события/IPC не трогали уничтоженное окно
  widget.on('closed', () => { widget = null; });
}

const showWidget = () => { if (widget && !widget.isVisible()) widget.showInactive(); };
const toggleWidget = () => { if (!widget) return; if (widget.isVisible()) { if (widget && !widget.isDestroyed()) widget.hide(); manualWidget = false; } else { manualWidget = true; widget.showInactive(); } };
// виджет в угол экрана
function snapWidget(corner) {
  if (!widget) return; const [W, H] = widget.getSize(), wa = screen.getDisplayMatching(widget.getBounds()).workArea, m = 16;
  const x = /l$/.test(corner) ? wa.x + m : /c$/.test(corner) ? Math.round(wa.x + (wa.width - W) / 2) : wa.x + wa.width - W - m, y = /^t/.test(corner) ? wa.y + m : wa.y + wa.height - H - m;
  widget.setPosition(x, y); const st = readStore(); st.widgetPos = { x, y }; writeStore(st);
}
const showMain = () => { if (!win || win.isDestroyed()) return; win.show(); win.focus(); };
const cmd = (name, arg) => { if (!win || win.isDestroyed()) return; if (['volume','seek'].includes(name) && !Number.isFinite(arg)) return; win.webContents.send('cmd', name, arg); };

function createTray() {
  tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 }));
  tray.setToolTip('Pulse');
  const menu = Menu.buildFromTemplate([
    { label: 'Открыть Pulse', click: showMain },
    { label: 'Виджет вкл/выкл', click: toggleWidget },
    { label: 'Музыкальные обои вкл/выкл', click: () => cmd('wallToggle') },
    { type: 'separator' },
    { label: 'Play / Pause', click: () => cmd('toggle') },
    { label: 'Следующий', click: () => cmd('next') },
    { label: 'Предыдущий', click: () => cmd('prev') },
    { label: 'Моя волна', click: () => cmd('wave') }, // 2.0.4
    { type: 'separator' },
    { label: 'Выход', click: () => { quitting = true; app.quit(); } }
  ]);
  tray.setContextMenu(menu);
  tray.__pulseMenu = menu;
  tray.on('click', showMain);
}

function registerMediaKeys() {
  if (mediaBridge?.ready) return;
  for (const [key, action] of [['MediaPlayPause','toggle'],['MediaNextTrack','next'],['MediaPreviousTrack','prev']])
    if (!globalShortcut.isRegistered(key)) globalShortcut.register(key, () => cmd(action));
}
app.setAppUserModelId('com.scada.pulse');
app.on('second-instance', (_event, argv) => {
  if (argv.includes('--quit-for-update')) { quitting = true; app.quit(); return; }
  if (win && !win.isDestroyed()) showMain();
});

app.whenReady().then(async () => {
  // 2.0.2: распознавание текста (Whisper) убрано — скачанные модели нейросети (до 760 МБ) больше не нужны
  setTimeout(() => { try { fs.rmSync(path.join(app.getPath('userData'), 'models'), { recursive: true, force: true }); } catch {} }, 15000);
  // запрет «настоящего» полноэкранного режима для встроенного YouTube (иначе из него не выйти)
  session.defaultSession.setPermissionRequestHandler((_wc, perm, cb, d) => {
    cb(perm === 'fullscreen' && !!win && _wc === win.webContents && safety.appURL((d && (d.requestingUrl || d.securityOrigin)) || '', port));
  });
  session.defaultSession.setPermissionCheckHandler((_wc, perm, origin) => perm === 'fullscreen' && !!win && _wc === win.webContents && origin === `http://127.0.0.1:${port}`);
  await startServer();
  wallpaper.setup({ port, preload: path.join(__dirname, 'preload.js') });
  discord.onStatus((st) => { try { win && win.webContents.send('discord:status', st); } catch {} });
  setTimeout(() => trimImgCache(), 15000);
  acc.loggedIn().then((ok) => ok && acc.writeCookieFile()).catch(() => {});
  createMain();
  createWidget();
  createTray();
  // 1.0.0: true SMTC session for Windhawk/Windows, independent of YouTube's iframe.
  const mediaExe = path.join(app.isPackaged ? process.resourcesPath : __dirname + '/resources', 'media-bridge', 'PulseMediaBridge.exe');
  mediaBridge = createMediaBridge({ executable: mediaExe, origin: `http://127.0.0.1:${port}`,
    onCommand: (name, value) => cmd(name, value),
    onStatus: st => {
      console.log('[media-session]', st.state, st.detail);
      try { const log = path.join(app.getPath('userData'), 'media-session.log'); if (fs.existsSync(log) && fs.statSync(log).size > 262144) fs.renameSync(log, log + '.old'); fs.appendFileSync(log, `${new Date().toISOString()} ${st.state} ${st.detail}\n`); } catch {}
      // Do not run a global key toggle AND an SMTC action for the same press.
      if (st.state === 'ready') for (const key of ['MediaPlayPause','MediaNextTrack','MediaPreviousTrack']) globalShortcut.unregister(key);
      else if (!quitting) registerMediaKeys();
    }
  });
  mediaBridge.start();
  registerMediaKeys();
  globalShortcut.register('Control+Alt+W', toggleWidget);
}).catch(e => { nativeDialogs.showErrorBox('Pulse — запуск', String(e.message || e)); app.quit(); });

app.on('before-quit', () => { quitting = true; mediaBridge?.destroy(); try { svc.flush(); } catch {} if (wcfgSaveT && !resetting) { clearTimeout(wcfgSaveT); wcfgSaveT = null; const st = readStore(); st.widgetCfg = wcfg; writeStore(st); } try { discord.destroy(); } catch {} try { wallpaper.destroy(); } catch {} });
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => {});

// 1.0.1: main-frame identity AND exact origin; remote frames cannot use privileged IPC.
function ipcAllowed(e, channel, args) {
  if (!e.senderFrame || e.senderFrame !== e.sender.mainFrame) return false;
  const url = e.senderFrame.url;
  if (win && !win.isDestroyed() && e.sender === win.webContents && safety.appURL(url, port)) return true;
  if (widget && !widget.isDestroyed() && e.sender === widget.webContents && safety.appURL(url, port, 'widget.localhost', '/widget.html')) {
    if (channel === 'win') return ['open', 'edit-widget', 'widget-hide'].includes(args[0]);
    if (channel === 'cmd') return ['toggle','next','prev','shuffle','repeat','like','dislike','widgetSize','seek','volume'].includes(args[0]);
  }
  return channel === 'wall:act' && wallpaper.isSender(e.sender) && safety.appURL(url, port, 'wall.localhost', '/wallpaper.html');
}
function ipcHandle(channel, fn) { ipcMain.handle(channel, (e, ...args) => { if (!ipcAllowed(e, channel, args)) throw new Error('Untrusted IPC sender'); return fn(e, ...args); }); }
function ipcOn(channel, fn) { ipcMain.on(channel, (e, ...args) => { if (ipcAllowed(e, channel, args)) return fn(e, ...args); if (channel === 'store:flush') e.returnValue = false; }); }

// ---------- IPC ----------
ipcHandle('clipboard:write', (_e, text) => {
  if(typeof text!=='string'||!text.trim()||Buffer.byteLength(text,'utf8')>1024*1024)return {error:'Некорректный текст для копирования'};
  try { clipboard.writeText(text); return {ok:true}; } catch { return {error:'Системный буфер обмена недоступен'}; }
});
ipcHandle('store:get', () => readStore().library || null);
function saveLibrary(lib) { if (resetting || !lib || typeof lib !== 'object' || Array.isArray(lib)) return false; const s = readStore(); s.library = lib; safety.atomicJSON(storeFile(), s, true); return true; }
ipcOn('store:set', (_e, lib) => { try { saveLibrary(lib); } catch(e) { console.error('library save', e); } });
ipcOn('store:flush', (e, lib) => { try { e.returnValue = saveLibrary(lib); } catch { e.returnValue = false; } });
ipcHandle('app:reset', (_e, o) => {
  o = o && typeof o === 'object' ? o : { mode: o };
  const mode = o.mode === 'all' ? 'all' : 'settings';
  let known = null; if (mode === 'all' && o.keepDownloads !== false) { const lib = readStore().library || {}; const offIds = (() => { try { return Object.keys(off.listOffline() || {}); } catch { return []; } })(); known = {}; for (const id of offIds) if (lib.known && lib.known[id]) known[id] = lib.known[id]; }
  try { fs.writeFileSync(RESET_MARK(), JSON.stringify({ mode, keepDownloads: o.keepDownloads !== false, known, at: Date.now() })); } catch (e) { return { error: e.message }; }
  resetting = true; quitting = true; clearTimeout(wcfgSaveT); wcfgSaveT = null;
  setTimeout(() => { try { discord.destroy(); } catch {} try { wallpaper.destroy(); } catch {} app.relaunch(); app.exit(0); }, 150);
  return { ok: true };
});

// Local music: OS dialogs are the only source of import/cover/export paths.
const mediaSafe = fn => async (...a) => { try { return await fn(...a); } catch(e) { return {error:String(e.message||e)}; } };
ipcHandle('media:list',mediaSafe(()=>media().list()));
ipcHandle('media:import',mediaSafe(async()=>{const r=await nativeDialogs.showOpenDialog(win,{title:'Добавить локальные треки',properties:['openFile','multiSelections'],filters:[{name:'Аудио и видео',extensions:require('./local-library').EXT}]});return r.canceled?{canceled:true}:media().importFiles(r.filePaths);}));
ipcHandle('media:playback',mediaSafe(async(_e,id,convert)=>{if(typeof id==='string'&&!id.startsWith('local-'))await off.repairVideo(vidOf(id));return media().playback(id,convert===true);}));
ipcHandle('media:inspect',mediaSafe((_e,id,known)=>media().inspect(id,known)));
ipcHandle('media:cover',mediaSafe(async()=>{const r=await nativeDialogs.showOpenDialog(win,{title:'Выбрать обложку',properties:['openFile'],filters:[{name:'Изображения',extensions:['jpg','jpeg','png','webp']}]});return r.canceled?{canceled:true}:media().pickCover(r.filePaths[0]);}));
ipcHandle('media:update',mediaSafe((_e,id,fields,cover)=>media().update(id,fields,cover)));
ipcHandle('media:reset',mediaSafe((_e,id)=>media().reset(id)));
ipcHandle('media:remove',mediaSafe((_e,id)=>media().remove(id)));
ipcHandle('media:export',mediaSafe(async(_e,id,format,fields,cover)=>{const f=require('./media-tools').EXPORTS[format];if(!f)throw Error('Неподдерживаемый формат');const data=await media().inspect(id);const name=(fields?require('./local-library').normalize(fields):data.fields).title.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/,'').slice(0,110)||'Track';const r=await nativeDialogs.showSaveDialog(win,{title:'Сохранить отредактированный трек',defaultPath:path.join(app.getPath('music'),name+'.'+f.ext),filters:[{name:f.label,extensions:[f.ext]}],properties:['showOverwriteConfirmation','createDirectory']});if(r.canceled)return {canceled:true};const dest=r.filePath.toLowerCase().endsWith('.'+f.ext)?r.filePath:r.filePath+'.'+f.ext;return media().exportFile(id,format,dest,fields,cover);}));

ipcHandle('yt:meta', async (_e, url) => {
  try {
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`);
    if (!r.ok) return null;
    const j = await r.json();
    return { title: j.title, author: j.author_name };
  } catch { return null; }
});

ipcHandle('yt:playlist', async (_e, listId) => { try { return await yt.fetchPlaylist(listId); } catch (e) { console.error(e); return null; } });

// 2.0.2: скачивание трека сервиса = скачивание его записи YouTube; события дублируются для id сервиса
off.setNotifier((ev) => { if (!win) return; win.webContents.send('dl', ev); for (const a of svc.aliasesOf(ev.id)) win.webContents.send('dl', { ...ev, id: a, vid: ev.id }); });
const vidOf = (id) => (svc.isSvc(id) ? svc.cachedYt(id) : id);
ipcHandle('dl:list', () => { const m = off.offlineCatalog(); const o = {}; for (const id in m) { o[id] = { file: m[id].file, audioFile:m[id].audioFile||null, videoFile:m[id].videoFile||null, hasVideo:!!m[id].videoFile, kind: off.thumbKind(id) }; for (const a of svc.aliasesOf(id)) o[a] = { ...o[id], vid: id }; } return {...o,...media().list().offline}; });
ipcOn('dl:start', (_e, items) => items.forEach(async (it) => {
  const id = typeof it === 'string' ? it : it.id, art = typeof it === 'string' ? null : it.art;
  if (!svc.isSvc(id)) return off.enqueue(id, art, it?.video===true);
  try { off.enqueue(await svc.ytFor(id), art, it?.video===true); } catch (e) { win && win.webContents.send('dl', { id, status: 'error', error: String(e.message || e) }); }
}));
ipcOn('dl:cancel', (_e, id) => { const v = vidOf(id); if (v) off.cancel(v); else win && win.webContents.send('dl', { id, status: 'none' }); });
ipcHandle('dl:remove', async (_e, id) => { if(typeof id==='string'&&id.startsWith('local-')){await media().remove(id);return true;} const v = vidOf(id); if (v) { off.cancel(v); off.remove(v); } return true; });
ipcHandle('yt:prefetch', async (_e, id) => { try { return off.prefetch(svc.isSvc(id) ? await svc.ytFor(id) : id); } catch { return null; } });
ipcHandle('yt:resolve', async (_e, id) => { try { const v = svc.isSvc(id) ? await svc.ytFor(id) : id; await off.resolveStream(v); return { ok: true, vid: v }; } catch (e) { return { ok: false, error: String(e.message || e) }; } });
ipcHandle('yt:search', async (_e, q) => { try { return await yt.search(q); } catch (e) { console.error(e); return null; } });
ipcHandle('yt:mix', async (_e, v, list) => { try { return await yt.fetchMix(v, list); } catch (e) { console.error(e); return null; } });
ipcHandle('yt:video', (_e, id) => yt.videoInfo(id));
const safe = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { console.error(e); return { error: String(e.message || e) }; } };
ipcHandle('acc:login', safe((_e, mode) => acc.login(win, mode)));
ipcHandle('acc:browsers', () => { try { return acc.findBrowsers().map((b) => ({ id: b.id, name: b.name, def: !!b.def })); } catch { return []; } });
// 2.0.2: site 'sp' — тот же вход через настоящий браузер, но для Spotify
const spSink = (site) => (site === 'sp' ? (cs) => svc.spImport(cs) : null);
ipcHandle('acc:viaBrowser', safe((_e, b, site) => acc.loginViaBrowser(b, site, spSink(site))));
ipcHandle('acc:cancelExt', safe(() => acc.cancelViaBrowser()));
ipcHandle('acc:logout', safe(() => acc.logout()));
ipcHandle('acc:info', safe(() => acc.accountInfo()));
ipcHandle('acc:playlists', safe(() => acc.libraryPlaylists()));
ipcHandle('acc:tracks', safe((_e, id) => acc.playlistTracks(id)));
// 2.0.2: источник текста — q.src: 'auto' (все источники) | 'yt' | 'am' | 'sp'. Выбранный сервис — первым, базы — запасной путь
const LY_RANK = { word: 0, line: 1, plain: 2, instrumental: 3 };
ipcHandle('lyrics:get', async (_e, q) => {
  const mode = ['yt', 'am', 'sp', 'lr', 'spicy'].includes(q && q.src) ? q.src : 'auto';
  const db = () => lyr.getLyrics(q).catch((e) => { console.error(e); return null; });
  const fromSvc = () => svc.lyricsFor(q, mode === 'spicy' ? 'auto' : mode, { bgVox: !(q && q.bgVox === false) }).catch((e) => { console.error(e); return null; });
  let r;
  // Spicy Lyrics uses the project credential in the main process; fallback sources remain available.
  if (mode === 'spicy' || (mode === 'auto' && q && q.useSpicy === true)) {
    const s = await spicyGet(q).catch((e) => { console.error(e); return null; });
    const rec = s && s.body ? spicyToRec(s.body, s.spDur) : null;
    if (rec && rec.kind !== 'plain') return { ...rec, srcMode: mode };
    if (rec) r = rec; // только текст без таймингов — оставим на случай, если у других баз ничего нет
  }
  const spPlain = r; r = null;
  // 2.0.4: выбран «Spicy Lyrics», но там песни нет — берём из обычных баз и честно пишем, что это запасной вариант
  if (mode === 'spicy') { if (!spPlain) { r = await (async () => { const [a, b] = await Promise.all([fromSvc(), db()]); return !a ? b : !b ? a : (LY_RANK[b.kind] ?? 9) < (LY_RANK[a.kind] ?? 9) ? b : a; })(); if (r) r.fallback = true; } }
  // 2.0.4-fix: «LRCLIB» — раньше такого режима не было, и выбор ничего не менял. Теперь берём текст из LRCLIB, а если там нет — из других баз
  else if (mode === 'lr') { r = await lyr.getLyrics({ ...q, prefer: 'lrclib' }).catch(() => null); if (r && r.provider !== 'lrclib') r.fallback = true; }
  else if (mode !== 'auto') { r = await fromSvc(); if (!r) { r = await db(); if (r) r.fallback = true; } }
  else {
    const [a, b] = await Promise.all([fromSvc(), db()]);
    // сервис выигрывает при равной синхронизации — его тексты сделаны под эту запись
    r = !a ? b : !b ? a : (LY_RANK[b.kind] ?? 9) < (LY_RANK[a.kind] ?? 9) ? b : a;
  }
  if (!r || (!r.synced && !r.plain && !r.instrumental)) r = spPlain || r;
  if (r) r.srcMode = mode;
  return r;
});
ipcHandle('acc:browser', safe((_e, b, site) => acc.loginFromBrowser(b, site, spSink(site))));
ipcHandle('ytm:feed', safe((_e, id, params) => (client !== 'yt' ? svc.feed(client, id, params) : ytm.feed(id, params))));
ipcHandle('ytm:browse', safe((_e, id, params) => (svc.isSvc(id) ? svc.browse(id) : ytm.browse(id, params))));
ipcHandle('ytm:search', safe((_e, q, f) => (client !== 'yt' ? svc.search(client, q, f) : ytm.search(q, f))));
ipcHandle('ytm:suggest', safe((_e, q) => (client !== 'yt' ? svc.suggest(client, q) : ytm.suggest(q))));
ipcHandle('ytm:next', safe((_e, v, list) => (svc.isSvc(v) || svc.isSvc(list) ? svc.next(v, list) : ytm.next(v, list))));
ipcHandle('ytm:related', safe((_e, id) => (svc.isSvc(id) ? svc.related(id) : ytm.related(id))));
ipcHandle('ytm:lyrics', safe((_e, id) => ytm.ytLyrics(id)));
ipcHandle('ytm:like', safe((_e, id, on) => (svc.isSvc(id) ? svc.like(id, on) : ytm.like(id, on))));
ipcHandle('ytm:dislike', safe((_e, id, on) => (svc.isSvc(id) ? svc.dislike(id, on) : ytm.dislike(id, on)))); // 2.0.4: «Не нравится»
// 2.0.2: клиенты Apple Music / Spotify
ipcHandle('cl:set', (_e, c, o) => { client = ['am', 'sp'].includes(c) ? c : 'yt'; if (o && 'amSf' in o) svc.setAppleRegion(o.amSf); return client; });
ipcHandle('svc:login', safe((_e, s) => svc.login(win, s)));
ipcHandle('svc:logout', safe((_e, s) => svc.logout(s)));
ipcHandle('svc:status', safe(() => svc.status()));
ipcHandle('svc:playlists', safe((_e, s) => svc.playlists(s)));
ipcHandle('svc:playlist-art', safe((_e, id) => svc.playlistArtwork(id)));
ipcHandle('svc:link', (_e, id) => svc.link(id));
ipcHandle('ytm:subscribe', safe((_e, id, on) => ytm.subscribe(id, on)));
ipcHandle('ytm:addTo', safe((_e, ids) => ytm.addToOptions(ids)));
ipcHandle('ytm:plCreate', safe((_e, title, desc, privacy, ids) => ytm.createPlaylist(title, desc, privacy, ids)));
ipcHandle('ytm:plAdd', safe((_e, pid, ids) => ytm.addToPlaylist(pid, ids)));
ipcHandle('ytm:plRemove', safe((_e, pid, items) => ytm.removeFromPlaylist(pid, items)));
ipcHandle('ytm:plDelete', safe((_e, pid) => ytm.deletePlaylist(pid)));
ipcHandle('ytm:plRename', safe((_e, pid, name) => ytm.renamePlaylist(pid, name)));
ipcHandle('lyrics:search', safe((_e, q) => lyr.searchLyrics(q)));
// Spicy Lyrics: official developer API, authenticated with the Pulse project credential.
// Внутренний API расширения сторонним клиентам запрещён, поэтому его не трогаем.
const spicyCache = new Map();
const spNorm = (s) => String(s || '').toLowerCase().replace(/\(.*?\)|\[.*?\]|feat\.?.*$|ft\..*$/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
async function spicyFindId(t) {
  const raw = String((t && t.id) || '');
  if (/^sp:[A-Za-z0-9]{22}$/.test(raw)) return { id: raw.slice(3), dur: +t.dur || 0 };
  const artist = ((t.artists || [])[0] || {}).name || (t.artists || [])[0] || String(t.author || '').split(',')[0];
  const title = String(t.title || '').trim(); if (!title) return null;
  const r = await svc.search('sp', `${title} ${typeof artist === 'string' ? artist : ''}`.trim(), 'songs');
  const items = ((r && r[0] && r[0].items) || []).filter((x) => x && /^sp:[A-Za-z0-9]{22}$/.test(x.id)).slice(0, 10);
  const nt = spNorm(title), na = spNorm(artist), dur = +t.dur || +t.duration || 0;
  let best = null, bs = -1;
  for (const x of items) {
    const xt = spNorm(x.title), xa = spNorm(x.author);
    let s = xt === nt ? 4 : xt.includes(nt) || nt.includes(xt) ? 2 : 0;
    if (na && (xa.includes(na) || na.includes(xa.split(' ')[0] || '-'))) s += 2;
    if (dur && x.dur) s += Math.abs(dur - x.dur) <= 3 ? 2 : Math.abs(dur - x.dur) <= 10 ? 1 : -1;
    if (s > bs) { bs = s; best = x; }
  }
  return best && bs >= 3 ? { id: best.id.slice(3), dur: +best.dur || 0 } : null;
}
async function spicyGet(t) {
  const ck = JSON.stringify([t && t.id, t && t.title, t && t.author, t && t.dur]);
  if (spicyCache.has(ck)) return spicyCache.get(ck);
  const hit = await spicyFindId(t || {}); if (!hit) return { error: 'notfound' }; const spId = hit.id, spDur = hit.dur;
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 12000);
  let res; try { res = await spicyProject.requestLyrics(spId, { signal: ctl.signal }); } finally { clearTimeout(to); }
  if (res.status === 401 || res.status === 403) return { error: 'badkey', status: res.status };
  if (res.status === 429) return { error: 'limit', status: 429 };
  if (res.status === 404) { const o = { error: 'notfound', status: 404, spId }; spicyCache.set(ck, o); return o; }
  if (!res.ok) return { error: 'http', status: res.status };
  const j = await res.json().catch(() => null);
  const body = j && (j.Body || j.body || (j.Type ? j : null));
  if (!body || !body.Type) { const o = { error: 'notfound', spId }; spicyCache.set(ck, o); return o; }
  const o = { body, spId, spDur }; spicyCache.set(ck, o); if (spicyCache.size > 200) spicyCache.delete(spicyCache.keys().next().value);
  return o;
}
ipcHandle('spicy:lyrics', safe((_e, t) => spicyGet(t)));
// подпись по правилам Spicy Lyrics API: всегда провайдер, а у community-синхронизаций — ещё кто загрузил и кто сделал
function spicyCredit(b) {
  const src = String(b.source || ''), A = b.UploadAttribution || {};
  if (src === 'spicy_lyrics' || (!src && (A.Uploader || A.Maker))) {
    const u = A.Uploader && A.Uploader.username, m = A.Maker && A.Maker.username;
    return 'Spicy Lyrics' + (u ? ' · загрузил ' + u : '') + (m ? ', синхр. ' + m : '');
  }
  const prov = { apple_music: 'Apple Music', spotify: 'Spotify', musixmatch: 'Musixmatch' }[src] || src || 'Spicy Lyrics';
  return prov + ' (через Spicy Lyrics)';
}
// ответ Spicy → «расширенный» LRC Pulse: [строка]<начало>слово<конец> …; слоги одного слова склеиваются
function spicyToRec(b, spDur) {
  const T = (x) => { x = Math.max(0, +x || 0); const m = Math.floor(x / 60), s = x - m * 60; return String(m).padStart(2, '0') + ':' + s.toFixed(2).padStart(5, '0'); };
  const base = { provider: 'spicy', source: spicyCredit(b), spicy: { source: b.source || '', attr: b.UploadAttribution || null }, ...(spDur ? { srcDur: spDur } : {}) };
  if (b.Type === 'Static') { const plain = (b.Lines || []).map((l) => l.Text || '').join('\n').trim(); return plain ? { ...base, kind: 'plain', plain } : null; }
  let mx = 0; for (const c of b.Content || []) { mx = Math.max(mx, +c.EndTime || 0, +((c.Lead || {}).EndTime) || 0); }
  const k = mx > 3000 ? 1000 : 1;
  const words = (syl) => { const out = []; let cur = null; // слово хранит свои слоги: [текст, начало, конец]
    for (const s of syl || []) { const tx = String(s.Text || ''); if (!tx) continue;
      if (!cur) cur = { t: +s.StartTime / k, e: +s.EndTime / k, s: '', y: [] };
      cur.s += tx; cur.e = +s.EndTime / k; cur.y.push([tx, +s.StartTime / k, +s.EndTime / k]);
      if (!s.IsPartOfWord) { out.push(cur); cur = null; } }
    if (cur) out.push(cur); return out.map((w) => ({ ...w, s: w.s.trim() })).filter((w) => w.s); };
  const lines = [];
  for (const c of b.Content || []) {
    if (b.Type === 'Line') { if (c.Text) lines.push({ t: +c.StartTime / k, e: +c.EndTime / k, text: String(c.Text).trim(), v2: !!c.OppositeAligned }); continue; }
    const L = c.Lead || {}; const ws = words(L.Syllables); if (!ws.length) continue;
    const bg = (c.Background || []).map((x) => words(x.Syllables)).filter((x) => x.length).flat();
    if (bg.length) { bg[0].s = '(' + bg[0].s.replace(/^\(/, ''); bg[bg.length - 1].s = bg[bg.length - 1].s.replace(/\)$/, '') + ')'; }
    lines.push({ t: ws[0].t, e: Math.max(ws[ws.length - 1].e, ...bg.map((w) => w.e)), ws: [...ws, ...bg], nb: ws.length, v2: !!c.OppositeAligned });
  }
  lines.sort((x, y) => x.t - y.t); if (!lines.length) return null;
  const out = [];
  lines.forEach((L, i) => {
    out.push('[' + T(L.t) + ']' + (L.ws ? L.ws.map((w) => '<' + T(w.t) + '>' + w.s + '<' + T(w.e) + '>').join(' ') : L.text));
    const nx = lines[i + 1]; if (!nx || nx.t - L.e > 0.6) out.push('[' + T(L.e) + ']');
  });
  // spx — точные данные Spicy для рендерера: [начало, конец, второй голос, [[слово, начало, конец, слоги]…], сколько слов у основного голоса]
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const spx = b.Type === 'Line' ? null : lines.map((L) => [r3(L.t), r3(L.e), L.v2 ? 1 : 0, L.ws.map((w) => [w.s, r3(w.t), r3(w.e), w.y && w.y.length > 1 ? w.y.map((y) => [y[0], r3(y[1]), r3(y[2])]) : 0]), L.nb]);
  return { ...base, kind: b.Type === 'Line' ? 'line' : 'word', synced: out.join('\n'), ...(spx ? { spx } : {}), ...(lines.some((l) => l.v2) ? { fx: { duet: lines.filter((l) => l.v2).map((l) => Math.round(l.t * 100) / 100) } } : {}) };
}
ipcHandle('plugins:list', () => { try { return listPlugins(); } catch { return []; } });
ipcOn('plugins:open', () => shell.openPath(plugDir()));
ipcOn('widget:cfg', (_e, c) => { applyWidgetCfg(c); saveWidgetCfgSoon(); });
ipcOn('app:closeMode', (_e, m) => { closeMode = m || 'widget'; });
ipcHandle('app:version', () => app.getVersion());

// ---------- 1.9: Liquid Glass, обои, Discord, аккаунты ----------
ipcOn('win:material', (_e, m) => {
  if (!win) return; const on = m && m !== 'none';
  try {
    if (m === 'clear' && !glassClear) { win.setBackgroundColor('#00000000'); if (win.setBackgroundMaterial) win.setBackgroundMaterial('acrylic'); return; } // до перезапуска — акрил, а не белый фон
    if (on) { win.setBackgroundColor('#00000000'); if (win.setBackgroundMaterial) win.setBackgroundMaterial(m === 'clear' ? 'none' : m); }
    else { if (win.setBackgroundMaterial) win.setBackgroundMaterial('none'); win.setBackgroundColor(glassClear ? '#00000000' : '#07060b'); }
  } catch (e) { console.error('material', e); }
});
ipcHandle('win:glassMode', (_e, clear) => { clear = !!clear; try { fs.writeFileSync(glassFile(), JSON.stringify({ clear })); } catch {} return { restart: clear !== glassClear, active: glassClear }; });
ipcOn('app:relaunch', () => { quitting = true; app.relaunch(); app.quit(); });
ipcHandle('win:materialOk', () => process.platform === 'win32' && typeof (win && win.setBackgroundMaterial) === 'function' && (() => { const v = require('os').release().split('.'); return +v[0] >= 10 && +v[2] >= 22621; })());
ipcHandle('wall:enable', safe((_e, c) => wallpaper.enable(c)));
ipcHandle('wall:disable', safe(() => wallpaper.disable()));
ipcHandle('wall:displays', () => { try { return wallpaper.displays(); } catch { return []; } });
ipcOn('wall:frame', (_e, d) => wallpaper.send('wall:frame', d));
ipcOn('wall:meta', (_e, d) => wallpaper.send('wall:meta', d));
ipcOn('wall:act', (_e, n, a) => { if (['toggle', 'next', 'prev', 'seek', 'like'].includes(n)) cmd(n, n === 'seek' ? Math.max(0, Math.min(1, +a || 0)) : a); });
ipcOn('discord:cfg', (_e, on, id) => discord.configure(on, id));
ipcOn('discord:set', (_e, act) => discord.set(act));
ipcHandle('discord:status', () => discord.status());
// 2.0.3: у каждого сервиса свой менеджер аккаунтов (s = 'yt' | 'sp' | 'am'; без s — YouTube Music, как раньше)
const isS = (s) => s === 'sp' || s === 'am';
ipcHandle('accm:list', safe((_e, s) => (isS(s) ? svc.svcAcc.list(s) : acc.accList())));
ipcHandle('accm:snapshot', safe((_e, s) => (isS(s) ? svc.svcAcc.snapshot(s) : acc.accSnapshot())));
ipcHandle('accm:switch', safe((_e, id, s) => (isS(s) ? svc.svcAcc.switchTo(s, id) : acc.accSwitch(id))));
ipcHandle('accm:add', safe((_e, s) => (isS(s) ? svc.svcAcc.addNew(s) : acc.accAddNew())));
ipcHandle('accm:restore', safe((_e, s) => (isS(s) ? svc.svcAcc.restore(s) : acc.accRestore())));
ipcHandle('accm:remove', safe((_e, id, s) => (isS(s) ? svc.svcAcc.remove(s, id) : acc.accRemove(id))));
ipcHandle('accm:rename', safe((_e, id, n, s) => (isS(s) ? svc.svcAcc.rename(s, id, n) : acc.accRename(id, n))));
ipcOn('widget:snap', (_e, c) => snapWidget(c));
ipcOn('app:openUrl', (_e, u) => { if (/^https:\/\//.test(u)) shell.openExternal(u); });

ipcOn('state', (_e, st) => {
  if (!st || typeof st !== 'object') return;
  lastState = st;
  if (quitting) return;
  mediaBridge?.update(st);
  if (widget && !widget.isDestroyed()) widget.webContents.send('state', st);
  if (tray && st.title) tray.setToolTip(`Pulse — ${st.title}`.slice(0, 120));
});
ipcOn('lyrics', (_e, l) => { lastLyrics = l; if (!quitting && widget && !widget.isDestroyed()) widget.webContents.send('lyrics', l); });
ipcOn('cmd', (_e, name, arg) => cmd(name, arg));
ipcOn('win', (_e, action) => {
  if (!win || win.isDestroyed()) return;
  if (action === 'min') win.minimize();
  if (action === 'max') { if (win.isFullScreen()) return;
    if (glassClear) { // у прозрачного окна системное «развернуть» работает плохо — разворачиваем сами на рабочую область
      const wa = screen.getDisplayMatching(win.getBounds()).workArea;
      if (clearMaxPrev) { win.setBounds(clearMaxPrev); clearMaxPrev = null; win.webContents.send('win:maximized', false); }
      else { clearMaxPrev = win.getBounds(); win.setBounds(wa); win.webContents.send('win:maximized', true); }
      return; }
    win.isMaximized() ? win.unmaximize() : win.maximize(); }
  if (action === 'close') win.close();
  if (action === 'widget') toggleWidget();
  if (action === 'widget-hide') { if (widget && !widget.isDestroyed()) widget.hide(); manualWidget = false; }
  if (action === 'open') showMain();
  if (action === 'edit-widget') { showMain(); win.webContents.send('cmd', 'editor', 'widget'); }
  if (action === 'quit') { quitting = true; app.quit(); }
  if (action === 'fs') { win.setFullScreen(!win.isFullScreen()); win.webContents.send('win:fs', win.isFullScreen()); }
  if (action === 'fs-off') { win.setFullScreen(false); win.webContents.send('win:fs', false); }
  if (action === 'fs-on') { if (!win.isVisible()) pendingFs = true; else win.setFullScreen(true); win.webContents.send('win:fs', true); }
});

// 1.0.0: read-only tap of the embedded player's own audio, main-window callers only.
ipcHandle('visualizer:tap', (event, options) => require('./visualizer-tap').configureTap(win, event, options));

// 1.0.0: localized native tray captions.
require('./native-locale')({ app, ipcMain, Menu, getTray: () => tray, readStore });
