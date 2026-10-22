const { atomicJSON } = require('./core-safety');
const catalogLocale = require('./catalog-locale');
// Аккаунт Google / YouTube Music: вход, библиотека, cookies для yt-dlp
const { BrowserWindow, BaseWindow, WebContentsView, ipcMain, session, app, dialog } = require('electron');
const crypto = require('crypto'); const fs = require('fs'); const path = require('path');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';
const PART = 'persist:ytm'; const ORIGIN = 'https://music.youtube.com';
const ses = () => session.fromPartition(PART);
const cookieFile = () => path.join(app.getPath('userData'), 'cookies.txt');
const txt = (o) => (o ? o.simpleText || (o.runs || []).map((r) => r.text).join('') : '');
const dur = (t) => (t || '').split(':').reduce((a, x) => a * 60 + (+x || 0), 0);

async function ytCookies() { return (await ses().cookies.get({})).filter((c) => /youtube\.com$|google\.com$/.test(c.domain.replace(/^\./, ''))); }
async function loggedIn() { return (await ytCookies()).some((c) => /youtube\.com/.test(c.domain) && (c.name === 'SAPISID' || c.name === '__Secure-3PAPISID')); }

async function writeCookieFile() {
  const cs = await ytCookies(); if (!cs.length) return null;
  const lines = ['# Netscape HTTP Cookie File'];
  for (const c of cs) {
    const dom = c.domain.startsWith('.') || !c.hostOnly ? (c.domain.startsWith('.') ? c.domain : '.' + c.domain) : c.domain;
    lines.push([dom, dom.startsWith('.') ? 'TRUE' : 'FALSE', c.path || '/', c.secure ? 'TRUE' : 'FALSE', Math.floor(c.expirationDate || Date.now() / 1000 + 3e7), c.name, c.value].join('\t'));
  }
  fs.writeFileSync(cookieFile(), lines.join('\n') + '\n'); return cookieFile();
}
const cookieArgs = () => (fs.existsSync(cookieFile()) ? ['--cookies', cookieFile()] : []);

const FF_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0';
// Google блокирует вход из «встроенных браузеров» (Electron) по признакам Chromium.
// Притворяемся обычным Firefox: UA, без client hints, без navigator.userAgentData / window.chrome.
const SPOOF = `(() => { try {
  const def = (o, k, v) => { try { Object.defineProperty(o, k, { get: () => v, configurable: true }); } catch {} };
  def(Navigator.prototype, 'userAgentData', undefined); def(Navigator.prototype, 'vendor', '');
  def(Navigator.prototype, 'webdriver', false); def(Navigator.prototype, 'oscpu', 'Windows NT 10.0; Win64; x64');
  def(Navigator.prototype, 'buildID', '20181001000000'); def(Navigator.prototype, 'productSub', '20100101');
  try { delete window.chrome; } catch {} def(window, 'chrome', undefined);
} catch {} })();`;
const START = 'https://accounts.google.com/ServiceLogin?service=youtube&hl=ru&passive=true&continue=' + encodeURIComponent('https://www.youtube.com/signin?action_handle_signin=true&app=desktop&hl=ru&next=' + encodeURIComponent(ORIGIN + '/'));
const REJECT = /accounts\.google\.com\/(v3\/)?signin\/rejected|\/signin\/v2\/deniedsigninrejected|CookieMismatch/i;
const CHROME_UA = () => `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${(process.versions.chrome || '138.0.0.0').split('.')[0]}.0.0.0 Safari/537.36`;
// 2.0.2: тот же вход через настоящий браузер — и для Spotify (Google во встроенном окне пишет «браузер небезопасен»)
const SITES = {
  yt: { start: START, dom: /(^|\.)youtube\.com$|(^|\.)google\.com$/, ok: (cs) => cs.some((c) => /youtube\.com$/.test(c.domain) && (c.name === 'SAPISID' || c.name === '__Secure-3PAPISID')) },
  sp: { start: 'https://accounts.spotify.com/ru/login?continue=' + encodeURIComponent('https://open.spotify.com/'), dom: /(^|\.)spotify\.com$/, ok: (cs) => cs.some((c) => c.name === 'sp_dc' && c.value) },
};
const siteOf = (s) => SITES[s] || SITES.yt;
let loginWin = null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Вход через НАСТОЯЩИЙ браузер (Edge / Chrome / Brave / Яндекс / Firefox) ----------
// 1.9.6: Google писал «Этот браузер или приложение небезопасны», потому что браузер запускался
// с отладочным портом (это для Google признак автоматизации). Теперь вход идёт в обычном окне
// без каких-либо подмен и подключений: человек входит, закрывает окно, и только после этого
// Pulse открывает тот же профиль невидимо и забирает cookies YouTube.
function findBrowsers() {
  const out = [], env = process.env;
  if (process.platform === 'win32') {
    const roots = [env.ProgramFiles, env['ProgramFiles(x86)'], env.LOCALAPPDATA, env.ProgramW6432].filter(Boolean);
    const C = [['edge', 'Microsoft Edge', 'Microsoft\\Edge\\Application\\msedge.exe'], ['chrome', 'Google Chrome', 'Google\\Chrome\\Application\\chrome.exe'],
      ['firefox', 'Firefox', 'Mozilla Firefox\\firefox.exe'], ['brave', 'Brave', 'BraveSoftware\\Brave-Browser\\Application\\brave.exe'], ['yandex', 'Яндекс Браузер', 'Yandex\\YandexBrowser\\Application\\browser.exe'],
      ['vivaldi', 'Vivaldi', 'Vivaldi\\Application\\vivaldi.exe'], ['chromium', 'Chromium', 'Chromium\\Application\\chrome.exe'],
      ['opera', 'Opera', 'Programs\\Opera\\opera.exe'], ['operagx', 'Opera GX', 'Programs\\Opera GX\\opera.exe']]; // 2.0.2: Opera
    for (const [id, name, rel] of C) { const f = roots.map((r) => path.join(r, rel)).find((x) => { try { return fs.existsSync(x); } catch { return false; } }); if (f) out.push({ id, name, exe: f }); }
  } else {
    const C = [['chrome', 'Google Chrome', ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']], ['edge', 'Microsoft Edge', ['/usr/bin/microsoft-edge', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge']],
      ['firefox', 'Firefox', ['/usr/bin/firefox', '/Applications/Firefox.app/Contents/MacOS/firefox']], ['brave', 'Brave', ['/usr/bin/brave-browser', '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser']], ['chromium', 'Chromium', ['/usr/bin/chromium', '/usr/bin/chromium-browser']]];
    for (const [id, name, fl] of C) { const f = fl.find((x) => fs.existsSync(x)); if (f) out.push({ id, name, exe: f }); }
  }
  // 2.0.2: браузер по умолчанию — первым (в нём и откроется вход)
  const d = defaultBrowserId(); const i = out.findIndex((b) => b.id === d);
  if (i >= 0) { out[i].def = true; out.unshift(...out.splice(i, 1)); }
  return out;
}
let defBr;
function defaultBrowserId() {
  if (defBr !== undefined) return defBr; defBr = null;
  try {
    if (process.platform === 'win32') {
      const r = require('child_process').execFileSync('reg', ['query', 'HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice', '/v', 'ProgId'], { encoding: 'utf8', windowsHide: true, timeout: 3000 });
      const id = ((r.match(/ProgId\s+REG_SZ\s+(\S+)/i) || [])[1] || '').toLowerCase();
      const M = [[/^msedge/, 'edge'], [/^chrome/, 'chrome'], [/^firefox/, 'firefox'], [/^brave/, 'brave'], [/^yandex/, 'yandex'], [/^vivaldi/, 'vivaldi'], [/^chromium/, 'chromium'], [/operagx/, 'operagx'], [/^opera/, 'opera']];
      defBr = (M.find(([re]) => re.test(id)) || [])[1] || null;
    } else if (process.platform === 'linux') {
      const r = require('child_process').execFileSync('xdg-settings', ['get', 'default-web-browser'], { encoding: 'utf8', timeout: 3000 }).toLowerCase();
      defBr = /firefox/.test(r) ? 'firefox' : /chrom(e|ium)/.test(r) ? (/chromium/.test(r) ? 'chromium' : 'chrome') : /brave/.test(r) ? 'brave' : /edge/.test(r) ? 'edge' : null;
    }
  } catch {}
  return defBr;
}
let extLogin = null, extProc = null, extCancel = false;
const yt = (cs) => (cs || []).filter((c) => /(^|\.)youtube\.com$|(^|\.)google\.com$/.test(String(c.domain).replace(/^\./, '')));
// профиль занят (браузер ещё открыт)?
function profBusy(prof) {
  return ['lockfile', 'SingletonLock', 'parent.lock', 'lock'].some((f) => {
    const p = path.join(prof, f);
    try { fs.lstatSync(p); } catch { return false; }
    // 2.0.2: SingletonLock Chromium (ссылка «хост-pid») остаётся после аварийного закрытия — смотрим, жив ли процесс
    if (f === 'SingletonLock') { try { const pid = +String(fs.readlinkSync(p)).split('-').pop(); if (pid > 0) { try { process.kill(pid, 0); return true; } catch { return false; } } } catch {} }
    return true;
  });
}
function profBusyWin(prof) {
  // на Windows lockfile Chromium/Firefox остаётся открытым эксклюзивно, пока браузер жив
  for (const f of ['lockfile', 'parent.lock']) { const p = path.join(prof, f); if (!fs.existsSync(p)) continue; try { fs.unlinkSync(p); } catch { return true; } }
  return false;
}
const busy = (prof) => (process.platform === 'win32' ? profBusyWin(prof) : profBusy(prof));
// невидимо открыть профиль и прочитать cookies (браузер сам их расшифрует)
async function readChromiumCookies(b, prof, site = 'yt') {
  const { spawn } = require('child_process');
  const portFile = path.join(prof, 'DevToolsActivePort');
  for (const extra of [['--headless=new'], ['--window-position=-32000,-32000', '--window-size=200,200', '--start-minimized']]) {
    try { fs.unlinkSync(portFile); } catch {}
    const proc = spawn(b.exe, [`--user-data-dir=${prof}`, ...extra, '--remote-debugging-port=0', '--remote-allow-origins=*', '--no-first-run', '--no-default-browser-check', '--disable-sync', '--disable-extensions', 'about:blank'], { stdio: 'ignore', windowsHide: true });
    proc.on('error', () => {});
    try {
      let port = 0; for (let i = 0; i < 60 && !port; i++) { await sleep(250); try { port = +fs.readFileSync(portFile, 'utf8').split(/\r?\n/)[0]; } catch {} }
      if (!port) continue;
      let wsUrl = null; for (let i = 0; i < 20 && !wsUrl; i++) { try { wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl; } catch { await sleep(300); } }
      if (!wsUrl) continue;
      const cs = await new Promise((res) => {
        const ws = new WebSocket(wsUrl); const t = setTimeout(() => { try { ws.close(); } catch {} res(null); }, 8000);
        ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'Storage.getCookies', params: {} }));
        ws.onmessage = (m) => { try { const j = JSON.parse(m.data); if (j.id === 1) { clearTimeout(t); try { ws.send(JSON.stringify({ id: 2, method: 'Browser.close' })); } catch {} setTimeout(() => { try { ws.close(); } catch {} }, 300); res((j.result && j.result.cookies) || []); } } catch {} };
        ws.onerror = () => { clearTimeout(t); res(null); };
      });
      if (cs) return cs.filter((c) => siteOf(site).dom.test(String(c.domain).replace(/^\./, '')));
    } finally { setTimeout(() => { try { proc.kill(); } catch {} }, 1500); }
  }
  throw new Error(`Не удалось прочитать вход из ${b.name}`);
}
async function importCdpCookies(all, s = ses()) {
  for (const c of all) {
    const host = String(c.domain).replace(/^\./, '');
    const ss = { None: 'no_restriction', Lax: 'lax', Strict: 'strict' }[c.sameSite] || 'unspecified';
    try { await s.cookies.set({ url: `https://${host}${c.path || '/'}`, domain: c.domain, path: c.path || '/', secure: !!c.secure, httpOnly: !!c.httpOnly, sameSite: ss, name: c.name, value: c.value, expirationDate: c.expires > 0 ? c.expires : Math.floor(Date.now() / 1000) + 3e7 }); } catch {}
  }
}
// site: 'yt' | 'sp'; sink(cookies) — куда положить вход другого сервиса (для Spotify — его сессия в services.js)
function loginViaBrowser(which, site = 'yt', sink = null) {
  if (extLogin) return extLogin;
  const S = siteOf(site), START = S.start;
  extCancel = false;
  extLogin = (async () => {
    const list = findBrowsers(); const b = list.find((x) => x.id === which) || list[0];
    if (!b) throw new Error('Не нашёл установленный браузер (Edge, Chrome, Firefox, Brave, Яндекс)');
    // 2.0.2: Firefox — вход в ТВОЁМ обычном профиле (раньше открывался новый пустой пользователь)
    if (b.id === 'firefox') { const r = await ffLogin(b, S, START, sink); if (r !== undefined) return r; }
    const prof = path.join(app.getPath('userData'), 'login-profile', b.id); fs.mkdirSync(prof, { recursive: true });
    if (busy(prof)) throw new Error(`Окно входа ${b.name} уже открыто — войди в нём и закрой его`);
    const { spawn } = require('child_process');
    const ff = b.id === 'firefox';
    const args = ff ? ['-profile', prof, '-no-remote', '-new-instance', START]
      : [`--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check', '--disable-sync', '--disable-background-mode', '--window-size=560,820', '--new-window', START];
    const t0 = Date.now(); let exited = false;
    const proc = spawn(b.exe, args, { stdio: 'ignore', windowsHide: false }); extProc = proc;
    proc.on('error', () => { exited = true; }); proc.on('exit', () => { exited = true; });
    // ждём, пока человек войдёт и закроет окно (до 20 минут)
    await sleep(3000);
    while (!extCancel && Date.now() - t0 < 20 * 60e3) {
      if (exited && !busy(prof)) break;
      await sleep(1000);
    }
    extProc = null;
    if (extCancel) { try { proc.kill(); } catch {} return false; }
    await sleep(800);
    if (sink) { // 2.0.2: Spotify и другие сервисы
      const cs = ff ? parseCookieText(await ytdlpCookieText(`firefox:${prof}`)) : await readChromiumCookies(b, prof, site);
      const mine = cs.filter((c) => S.dom.test(String(c.domain).replace(/^\./, '')));
      return S.ok(mine) ? sink(mine) : false;
    }
    const cs = ff ? null : await readChromiumCookies(b, prof);
    if (cs && !S.ok(cs)) return false;
    return keepPrev(async () => {
      if (ff) { if (!(await ytdlpCookies(`firefox:${prof}`))) return false; }
      else { await ses().clearStorageData({ storages: ['cookies'] }).catch(() => {}); await importCdpCookies(cs); }
      return verifyLogin();
    });
  })().finally(() => { extLogin = null; extProc = null; });
  return extLogin;
}
// ---------- 2.0.2: Firefox — обычный профиль пользователя ----------
// Firefox хранит cookies без шифрования (cookies.sqlite), их можно читать, пока он открыт. Поэтому Firefox
// открывается как обычно (новая вкладка, твой профиль, твои вкладки и входы), а Pulse каждые пару секунд
// смотрит, появился ли вход. Если ты уже вошёл в сервис в Firefox — вход подхватывается сразу.
function ffRoots() {
  const h = require('os').homedir(), env = process.env;
  if (process.platform === 'win32') return [path.join(env.APPDATA || path.join(h, 'AppData', 'Roaming'), 'Mozilla', 'Firefox')];
  if (process.platform === 'darwin') return [path.join(h, 'Library', 'Application Support', 'Firefox')];
  return [path.join(h, '.mozilla', 'firefox'), path.join(h, 'snap', 'firefox', 'common', '.mozilla', 'firefox'), path.join(h, '.var', 'app', 'org.mozilla.firefox', '.mozilla', 'firefox')];
}
// профили Firefox; первым — тот, которым пользуются сейчас (свежее всего менялись cookies)
function ffProfiles() {
  const out = new Set();
  for (const root of ffRoots()) {
    let ini = ''; try { ini = fs.readFileSync(path.join(root, 'profiles.ini'), 'utf8'); } catch { continue; }
    for (const sec of ini.split(/^\[/m)) {
      const p = (sec.match(/^Path=(.+)$/m) || [])[1]; if (!p) continue;
      const rel = !/^IsRelative=0/m.test(sec);
      out.add(rel ? path.join(root, p.trim()) : p.trim());
    }
  }
  const mt = (d) => { let t = 0; for (const f of ['cookies.sqlite', 'cookies.sqlite-wal']) { try { t = Math.max(t, fs.statSync(path.join(d, f)).mtimeMs); } catch {} } return t; };
  return [...out].filter((d) => fs.existsSync(path.join(d, 'cookies.sqlite'))).sort((a, b) => mt(b) - mt(a));
}
async function ffReadCookies(dir, domRe) {
  const tmp = fs.mkdtempSync(path.join(app.getPath('temp'), 'pulse-ff-'));
  try {
    for (const f of ['cookies.sqlite', 'cookies.sqlite-wal']) { try { fs.copyFileSync(path.join(dir, f), path.join(tmp, f)); } catch (e) { if (f === 'cookies.sqlite') throw e; } }
    let rows;
    try {
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(path.join(tmp, 'cookies.sqlite'));
      try { rows = db.prepare('SELECT host, path, isSecure, isHttpOnly, name, value, expiry, sameSite FROM moz_cookies').all(); } finally { db.close(); }
    } catch { // запасной путь — yt-dlp
      return parseCookieText(await ytdlpCookieText(`firefox:${dir}`)).filter((c) => domRe.test(String(c.domain).replace(/^\./, '')));
    }
    const SS = ['None', 'Lax', 'Strict'];
    return rows.filter((r) => domRe.test(String(r.host).replace(/^\./, ''))).map((r) => {
      let exp = Number(r.expiry) || 0; if (exp > 1e11) exp = Math.floor(exp / 1000); // новые Firefox хранят миллисекунды
      return { domain: r.host, path: r.path || '/', secure: !!r.isSecure, httpOnly: !!r.isHttpOnly, name: r.name, value: r.value || '', expires: exp, sameSite: SS[r.sameSite] };
    });
  } finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {} }
}
// undefined — профилей Firefox нет (тогда старый путь); true/false — результат
async function ffLogin(b, S, START, sink) {
  const profs = ffProfiles(); if (!profs.length) return undefined;
  const key = (cs) => cs.filter((c) => /^(sp_dc|SAPISID|__Secure-3PAPISID)$/.test(c.name)).map((c) => c.value).sort().join('|');
  const tried = new Set();
  const apply = async (cs) => {
    if (sink) return sink(cs);
    return keepPrev(async () => { await ses().clearStorageData({ storages: ['cookies'] }).catch(() => {}); await importCdpCookies(cs); return verifyLogin(); });
  };
  const check = async () => {
    for (const d of profs.slice(0, 4)) {
      const cs = await ffReadCookies(d, S.dom).catch(() => []);
      if (!S.ok(cs)) continue; const k = key(cs); if (tried.has(k)) continue; tried.add(k);
      if (await apply(cs)) return true;
    }
    return false;
  };
  if (await check()) return true; // уже вошёл в Firefox — открывать ничего не нужно
  const { spawn } = require('child_process');
  try { const p = spawn(b.exe, [START], { stdio: 'ignore', detached: true, windowsHide: false }); p.on('error', () => {}); p.unref(); } catch {}
  const t0 = Date.now();
  while (!extCancel && Date.now() - t0 < 20 * 60e3) { await sleep(2500); if (extCancel) break; if (await check()) return true; }
  return false;
}
function cancelViaBrowser() { extCancel = true; try { if (extProc) extProc.kill(); } catch {} return true; }
// вход засчитывается, только если YouTube реально узнал аккаунт (иначе — неполные cookies, «Аккаунт Google»)
async function verifyLogin() {
  const info = await accountInfo(true);
  if (!info) { await dropSession(); return false; }
  await writeCookieFile(); return true;
}
async function dropSession() { try { await ses().clearStorageData({ storages: ['cookies'] }); } catch {} try { fs.unlinkSync(cookieFile()); } catch {} }

// Окно входа: сверху своя панель (назад / вперёд / обновить / заново, адрес и загрузка), снизу — страница Google.
// mode 'chrome' — честный Chromium без подмен (так Google реже ругается), 'firefox' — старая маскировка.
function login(parent, mode = 'chrome') {
  if (loginWin && !loginWin.isDestroyed()) { loginWin.focus(); return loginWin.__p; }
  let resolveP; const P = new Promise((r) => (resolveP = r));
  (async () => {
    const s = ses(), FF = mode === 'firefox', LUA = FF ? FF_UA : CHROME_UA();
    s.setUserAgent(LUA, 'ru-RU,ru,en-US,en');
    s.webRequest.onBeforeSendHeaders((d, cb) => {
      const h = d.requestHeaders;
      if (FF) for (const k of Object.keys(h)) if (/^sec-ch-ua/i.test(k)) delete h[k];
      if (/google\.|gstatic\.|youtube\./.test(d.url)) h['User-Agent'] = LUA;
      cb({ requestHeaders: h });
    });
    const BAR = 50;
    const w = new BaseWindow({ width: 520, height: 780, minWidth: 380, minHeight: 520, parent, title: 'Вход в аккаунт Google', backgroundColor: '#1b1b1d', autoHideMenuBar: true, icon: path.join(__dirname, 'build', 'icon.png') });
    loginWin = w; w.__p = P;
    const bar = new WebContentsView({ webPreferences: { preload: path.join(__dirname, 'login-preload.js'), contextIsolation: true, sandbox: true } });
    const view = new WebContentsView({ webPreferences: { partition: PART, contextIsolation: true, sandbox: true } });
    view.setBackgroundColor('#ffffff'); bar.setBackgroundColor('#1b1b1d');
    w.contentView.addChildView(view); w.contentView.addChildView(bar);
    const layout = () => { if (w.isDestroyed()) return; const b = w.getContentBounds(); bar.setBounds({ x: 0, y: 0, width: b.width, height: BAR }); view.setBounds({ x: 0, y: BAR, width: b.width, height: Math.max(0, b.height - BAR) }); };
    layout(); w.on('resize', layout); w.on('maximize', layout); w.on('unmaximize', layout);
    bar.webContents.loadFile(path.join(__dirname, 'renderer', 'login-bar.html'));
    const wc = view.webContents; let err = null;
    const H = () => wc.navigationHistory;
    const send = () => { try { if (bar.webContents.isDestroyed() || wc.isDestroyed()) return; bar.webContents.send('lb:state', { url: wc.getURL(), title: wc.getTitle(), loading: wc.isLoading(), back: H().canGoBack(), fwd: H().canGoForward(), err }); } catch {} };
    ['did-start-loading', 'did-stop-loading', 'did-navigate', 'did-navigate-in-page', 'page-title-updated', 'dom-ready'].forEach((ev) => wc.on(ev, () => { if (ev === 'did-start-loading') err = null; send(); }));
    bar.webContents.on('did-finish-load', send);
    wc.on('did-fail-load', (_e, code, desc, _u, isMain) => { if (!isMain || code === -3) return; err = desc || 'ошибка ' + code; send(); });
    const goBack = () => { if (H().canGoBack()) H().goBack(); };
    const cmd = (e, c) => {
      if (e.sender !== bar.webContents) return;
      if (c === 'back') goBack(); if (c === 'fwd' && H().canGoForward()) H().goForward();
      if (c === 'reload') { err = null; wc.getURL() ? wc.reload() : wc.loadURL(START); }
      if (c === 'stop') wc.stop(); if (c === 'home') { err = null; wc.loadURL(START); }
    };
    ipcMain.on('lb:cmd', cmd);
    // кнопки мыши «назад/вперёд», Alt+стрелки, Backspace вне полей ввода, F5
    w.on('app-command', (_e, c) => { if (c === 'browser-backward') goBack(); if (c === 'browser-forward' && H().canGoForward()) H().goForward(); });
    wc.on('before-input-event', (e, i) => {
      if (i.type !== 'keyDown') return;
      if ((i.alt && i.key === 'ArrowLeft') || i.key === 'BrowserBack') { goBack(); e.preventDefault(); }
      if ((i.alt && i.key === 'ArrowRight') && H().canGoForward()) { H().goForward(); e.preventDefault(); }
      if (i.key === 'F5') { wc.reload(); e.preventDefault(); }
    });
    await Promise.race([wc.loadURL('about:blank').catch(() => {}), new Promise((r) => setTimeout(r, 2000))]);
    wc.setUserAgent(LUA);
    if (FF) {
      const cdp = (m, p) => Promise.race([wc.debugger.sendCommand(m, p), new Promise((_, rej) => setTimeout(() => rej(new Error('cdp timeout ' + m)), 2500))]);
      try { wc.debugger.attach('1.3'); await cdp('Page.enable').catch(() => {}); await cdp('Page.addScriptToEvaluateOnNewDocument', { source: SPOOF }); await cdp('Emulation.setUserAgentOverride', { userAgent: FF_UA, acceptLanguage: 'ru-RU,ru', platform: 'Win32' }).catch(() => {}); } catch (e) { console.error('cdp', e); }
    }
    // всплывающие окна Google (выбор аккаунта, «Другие способы входа») открываем в этом же окне — «назад» вернёт обратно
    wc.setWindowOpenHandler(({ url }) => { wc.loadURL(url); return { action: 'deny' }; });
    wc.loadURL(START).then(() => { try { wc.navigationHistory.clear(); send(); } catch {} }).catch((e) => console.error('login load', e && e.message)); send();
    // если страница так и не начала грузиться — пробуем ещё раз
    setTimeout(() => { try { if (!wc.isDestroyed() && (!wc.getURL() || wc.getURL() === 'about:blank')) wc.loadURL(START); } catch {} }, 6000);
    let done = false, rejected = false;
    const finish = async () => {
      if (done) return; done = true; clearInterval(iv); ipcMain.removeListener('lb:cmd', cmd);
      s.webRequest.onBeforeSendHeaders(null); s.setUserAgent(UA);
      const ok = (await loggedIn()) && (await verifyLogin());
      try { if (!w.isDestroyed()) w.close(); } catch {}
      try { wc.close(); bar.webContents.close(); } catch {}
      loginWin = null; resolveP(ok ? true : rejected ? { rejected: true, mode } : false);
    };
    // Google ответил «браузер небезопасен» — закрываем окно, Pulse сам предложит вход через настоящий браузер
    const iv = setInterval(async () => { const u = wc.isDestroyed() ? '' : wc.getURL(); if (REJECT.test(u)) { rejected = true; return finish(); } if (/^https:\/\/(music|www)\.youtube\.com/.test(u) && (await loggedIn())) finish(); }, 800);
    w.on('closed', finish);
  })().catch((e) => { console.error('login', e); loginWin = null; resolveP(false); });
  return P;
}

// Вход «из браузера»: yt-dlp достаёт cookies из Firefox/Chrome/Edge… и мы кладём их в сессию
// spec — «firefox», «chrome» или «firefox:путь_к_профилю». Возвращает число импортированных cookies.
async function ytdlpCookies(spec) {
  const text = await ytdlpCookieText(spec);
  // 1.9.6: старые cookies не смешиваем с новыми — из-за этой каши и появлялся «Аккаунт Google», который нельзя удалить
  await ses().clearStorageData({ storages: ['cookies'] }).catch(() => {});
  return importCookieText(text);
}
// 2.0.2: текст cookies.txt из браузера (yt-dlp отдаёт все cookies браузера, а не только YouTube)
async function ytdlpCookieText(spec) {
  const off = require('./offline'); const { spawn } = require('child_process');
  const name = String(spec).split(':')[0];
  const exe = await off.ytdlpPath(); const tmp = path.join(app.getPath('temp'), `pulse-ck-${Date.now()}.txt`);
  const log = await new Promise((res) => {
    let err = '';
    const p = spawn(exe, ['--cookies-from-browser', spec, '--cookies', tmp, '--skip-download', '--flat-playlist', '--playlist-items', '1', '--no-warnings', '--ignore-errors', 'https://www.youtube.com/@YouTube'], { windowsHide: true, env: require('./ytd-runtime').environment() });
    p.stderr.on('data', (d) => (err += d)); p.stdout.on('data', () => {});
    const t = setTimeout(() => p.kill(), 60000);
    p.on('close', () => { clearTimeout(t); res(err); }); p.on('error', (e) => { clearTimeout(t); res(String(e)); });
  });
  if (!fs.existsSync(tmp)) {
    if (/could not find|not find .* cookies database/i.test(log)) throw new Error(`Не нашёл браузер ${name} или его профиль`);
    if (/DPAPI|decrypt|App-Bound|v20/i.test(log)) throw new Error(`${name} шифрует cookies (защита Chrome 127+). Используй «Войти через Google» или Firefox`);
    if (/locked|Could not copy|database is locked/i.test(log)) throw new Error(`Закрой ${name} полностью и попробуй снова`);
    throw new Error((log.split('\n').filter((l) => /ERROR/.test(l))[0] || 'Не удалось прочитать cookies').replace(/^ERROR:\s*/, '').slice(0, 200));
  }
  const text = fs.readFileSync(tmp, 'utf8'); try { fs.unlinkSync(tmp); } catch {}
  return text;
}
// cookies.txt → [{ domain, path, secure, httpOnly, name, value, expires }]
function parseCookieText(text) {
  const out = [];
  for (const l of String(text || '').split(/\r?\n/)) {
    const line = l.replace(/^#HttpOnly_/, ''); if (!line || line.startsWith('#')) continue;
    const [domain, , p, secure, exp, name, value] = line.split('\t'); if (!name || !domain) continue;
    out.push({ domain, path: p || '/', secure: secure === 'TRUE' || /^__Secure|^__Host/.test(name), httpOnly: l.startsWith('#HttpOnly_'), name, value: value || '', expires: +exp || 0 });
  }
  return out;
}
// откат: если новый вход не удался — возвращаем то, что было до него
async function keepPrev(fn) {
  const prev = await ytCookies().catch(() => []);
  let ok = false;
  try { ok = await fn(); } finally {
    if (!ok) { await dropSession(); await applyCookies(prev); if (await loggedIn()) await writeCookieFile().catch(() => {}); }
  }
  return ok;
}
async function loginFromBrowser(browser, site = 'yt', sink = null) {
  if (sink) { // 2.0.2: Spotify — готовый вход из браузера
    const S = siteOf(site), cs = parseCookieText(await ytdlpCookieText(browser)).filter((c) => S.dom.test(c.domain.replace(/^\./, '')));
    if (!S.ok(cs)) throw new Error(cs.length ? `В ${browser} вход в Spotify устарел — открой open.spotify.com в этом браузере, войди и попробуй снова` : `В ${browser} нет входа в Spotify`);
    if (!(await sink(cs))) throw new Error('Spotify не принял вход — войди заново в браузере');
    return true;
  }
  let n = 0;
  const ok = await keepPrev(async () => { n = await ytdlpCookies(browser); return n ? verifyLogin() : false; });
  if (!ok) throw new Error(n ? `В ${browser} вход в YouTube устарел или неполный — открой music.youtube.com в этом браузере, войди и попробуй снова` : `В ${browser} нет входа в YouTube`);
  return true;
}
async function importCookieText(text) {
  let n = 0;
  for (const l of text.split(/\r?\n/)) {
    const line = l.replace(/^#HttpOnly_/, ''); if (!line || line.startsWith('#')) continue;
    const [domain, , p, secure, exp, name, value] = line.split('\t'); if (!name || !/youtube\.com|google\.com/.test(domain)) continue;
    const host = domain.replace(/^\./, '');
    try { await ses().cookies.set({ url: `https://${host}${p || '/'}`, domain, path: p || '/', secure: secure === 'TRUE' || /^__Secure|^__Host/.test(name), httpOnly: l.startsWith('#HttpOnly_'), name, value: value || '', expirationDate: +exp > 0 ? +exp : Math.floor(Date.now() / 1000) + 3e7 }); n++; } catch {}
  }
  return n;
}
// 1.9.6: «Файл cookies.txt» и «Вставить Cookie вручную» убраны

async function logout() { await ses().clearStorageData(); try { fs.unlinkSync(cookieFile()); } catch {} return true; }

async function headers() {
  const cs = await ytCookies(); const yc = cs.filter((c) => /youtube\.com/.test(c.domain));
  const sap = (yc.find((c) => c.name === 'SAPISID') || yc.find((c) => c.name === '__Secure-3PAPISID') || {}).value;
  const ts = Math.floor(Date.now() / 1000);
  const h = { 'Content-Type': 'application/json', 'User-Agent': UA, Origin: ORIGIN, Referer: ORIGIN + '/', 'X-Origin': ORIGIN, 'X-Goog-AuthUser': '0', 'Accept-Language': catalogLocale.current().accept };
  if (yc.length) h.Cookie = yc.map((c) => `${c.name}=${c.value}`).join('; ');
  if (sap) h.Authorization = `SAPISIDHASH ${ts}_${crypto.createHash('sha1').update(`${ts} ${sap} ${ORIGIN}`).digest('hex')}`;
  return h;
}
const CTX = { client: { clientName: 'WEB_REMIX', clientVersion: '1.20250101.01.00', hl: 'ru', gl: 'RU' } };
async function api(endpoint, body, query = '') {
  const r = await fetch(`${ORIGIN}/youtubei/v1/${endpoint}?prettyPrint=false${query}`, { method: 'POST', headers: await headers(), body: JSON.stringify({ ...body, context: { ...(body?.context || CTX), client: { ...(body?.context?.client || CTX.client), hl: catalogLocale.current().language } } }) });
  if (!r.ok) throw new Error(`YouTube Music API ${r.status}`);
  return r.json();
}

function bigArt(thumbs) { const t = (thumbs || []).slice(-1)[0]; return t ? t.url.replace(/=w\d+-h\d+.*$/, '=w544-h544-l90-rj').replace(/=s\d+.*$/, '=s544') : null; }
function parseTracks(json, out, conts) {
  (function w(n) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(w);
    if (n.musicResponsiveListItemRenderer) {
      const v = n.musicResponsiveListItemRenderer;
      const id = (v.playlistItemData && v.playlistItemData.videoId) || (JSON.stringify(v.overlay || {}).match(/"videoId":"([\w-]{11})"/) || [])[1];
      const cols = (v.flexColumns || []).map((c) => ((c.musicResponsiveListItemFlexColumnRenderer || {}).text || {}).runs || []);
      const fixed = (v.fixedColumns || []).map((c) => txt(((c.musicResponsiveListItemFixedColumnRenderer || {}).text)));
      const title = (cols[0] || []).map((x) => x.text).join('');
      const parts = (cols[1] || []).map((x) => x.text); const dot = parts.indexOf(' • ');
      const author = (dot >= 0 ? parts.slice(0, dot) : parts).join('');
      const d = fixed.find((x) => /^\d+(:\d+)+$/.test(x)) || parts.filter((x) => /^\d+(:\d+)+$/.test(x)).pop();
      const art = bigArt((((v.thumbnail || {}).musicThumbnailRenderer || {}).thumbnail || {}).thumbnails);
      if (id && title) out.push({ id, title, author, dur: dur(d), art, loaded: true });
      return;
    }
    if (n.continuationItemRenderer) { const t = JSON.stringify(n.continuationItemRenderer).match(/"token":"([^"]+)"/); if (t) conts.push({ token: t[1] }); return; }
    if (n.nextContinuationData && n.nextContinuationData.continuation) { conts.push({ ctoken: n.nextContinuationData.continuation }); return; }
    for (const k in n) w(n[k]);
  })(json);
}

async function playlistTracks(browseId) {
  if (!browseId.startsWith('VL')) browseId = 'VL' + browseId;
  const first = await api('browse', { browseId });
  const out = [], conts = []; parseTracks(first.contents, out, conts);
  let title = null;
  (function w(n) { if (title || !n || typeof n !== 'object') return; for (const k in n) { if (/^music\w*HeaderRenderer$/.test(k) && n[k].title) { title = txt(n[k].title); return; } w(n[k]); } })({ h: first.header, c: first.contents });
  const used = new Set(); let g = 0;
  while (conts.length && g++ < 100) {
    const c = conts.shift(); const key = c.token || c.ctoken; if (used.has(key)) continue; used.add(key);
    const j = c.token ? await api('browse', { continuation: c.token }) : await api('browse', {}, `&ctoken=${encodeURIComponent(c.ctoken)}&continuation=${encodeURIComponent(c.ctoken)}&type=next`);
    parseTracks(j.onResponseReceivedActions || j.continuationContents, out, conts);
  }
  const seen = new Set();
  return { title, tracks: out.filter((t) => !seen.has(t.id) && seen.add(t.id)) };
}

async function libraryPlaylists() {
  const j = await api('browse', { browseId: 'FEmusic_liked_playlists' });
  const out = [];
  (function w(n) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(w);
    if (n.musicTwoRowItemRenderer) {
      const v = n.musicTwoRowItemRenderer;
      const id = (((v.navigationEndpoint || {}).browseEndpoint || {}).browseId) || '';
      if (id.startsWith('VL')) out.push({ browseId: id, listId: id.slice(2), name: txt(v.title), sub: txt(v.subtitle), art: bigArt((((v.thumbnailRenderer || {}).musicThumbnailRenderer || {}).thumbnail || {}).thumbnails) });
      return;
    }
    for (const k in n) w(n[k]);
  })(j.contents);
  if (!out.some((p) => p.listId === 'LM')) out.unshift({ browseId: 'VLLM', listId: 'LM', name: 'Понравившиеся', sub: 'Автоплейлист', art: null });
  return out;
}

// 1.9.6: если YouTube не узнал аккаунт (нет блока активного аккаунта) — входа НЕТ.
// Раньше в этом случае показывался «Аккаунт Google» без имени, который постоянно возвращался.
async function accountInfo(strict) {
  if (!(await loggedIn())) return null;
  let j;
  try { j = await api('account/account_menu', {}); } catch (e) {
    if (strict) return null;
    // нет сети — показываем последний известный настоящий аккаунт
    const d = accRead(), a = d.list.find((x) => x.id === d.active); return a ? { name: a.name, photo: a.photo || null } : null;
  }
  const s = JSON.stringify(j);
  const name = (s.match(/"accountName":\{"runs":\[\{"text":"([^"]+)"/) || [])[1];
  const photo = (s.match(/"accountPhoto":\{"thumbnails":\[\{"url":"([^"]+)"/) || [])[1] || null;
  if (!name && !/activeAccountHeaderRenderer/.test(s)) { await dropSession(); return null; } // cookies битые/неполные — чистим
  return { name: name || 'Аккаунт YouTube', photo };
}


// ---------- менеджер аккаунтов: несколько входов, переключение в один клик ----------
// Каждый аккаунт = снимок cookies YouTube/Google. Хранится в userData/accounts.json, зашифрованным средствами ОС (safeStorage), если доступно.
const { safeStorage } = require('electron');
const accFile = () => path.join(app.getPath('userData'), 'accounts.json');
function accRead() {
  try {
    const raw = JSON.parse(fs.readFileSync(accFile(), 'utf8'));
    (raw.list || []).forEach((a) => { if (a.enc && safeStorage.isEncryptionAvailable()) { try { a.cookies = JSON.parse(safeStorage.decryptString(Buffer.from(a.enc, 'base64'))); } catch { a.cookies = []; } } });
    // 1.9.6: «Аккаунт Google» без имени и фото — это не аккаунт, а битые cookies. Убираем навсегда.
    const list = (raw.list || []).filter((a) => a.custom || a.photo || (a.name && a.name !== 'Аккаунт Google'));
    const d = { active: list.some((a) => a.id === raw.active) ? raw.active : null, list };
    if (list.length !== (raw.list || []).length) accWrite(d);
    return d;
  } catch { return { active: null, list: [] }; }
}
function accWrite(d) {
  const enc = safeStorage.isEncryptionAvailable();
  const out = { active: d.active, list: d.list.map((a) => { const o = { id: a.id, name: a.name, photo: a.photo || null, added: a.added, used: a.used, custom: !!a.custom }; if (enc) o.enc = safeStorage.encryptString(JSON.stringify(a.cookies || [])).toString('base64'); else o.cookies = a.cookies || []; return o; }) };
  try { atomicJSON(accFile(), out); } catch (e) { console.error(e); }
}
const accId = (cs) => { const c = cs.find((x) => x.name === 'SAPISID') || cs.find((x) => x.name === '__Secure-3PAPISID') || cs.find((x) => x.name === 'SID'); return c ? crypto.createHash('sha1').update(c.name + c.value).digest('hex').slice(0, 12) : null; };
const pub = (d) => ({ active: d.active, list: d.list.map((a) => ({ id: a.id, name: a.name, photo: a.photo, used: a.used, active: a.id === d.active })) });
// запомнить текущий вход (вызывается после входа и при открытии менеджера)
async function accSnapshot() {
  const d = accRead(); if (!(await loggedIn())) return pub(d);
  const cs = await ytCookies(), id = accId(cs); if (!id) return pub(d);
  const info = await accountInfo(true).catch(() => null);
  if (!info) return pub(accRead()); // YouTube не узнал вход — в список не добавляем
  // 1.9.5: «Аккаунт Google» = имя не удалось получить. Раньше из-за этого плодились копии, которые после удаления возвращались
  const known = true;
  let a = d.list.find((x) => x.id === id);
  if (!a && known) a = d.list.find((x) => x.name === info.name || (info.photo && x.photo === info.photo));
  if (!a) a = d.list.find((x) => x.id === d.active);
  if (!a && !known) a = d.list.find((x) => x.name === 'Аккаунт Google');
  if (!a) { a = { id, added: Date.now() }; d.list.push(a); }
  a.id = id; a.cookies = cs; a.used = Date.now();
  if (known) { a.name = a.custom ? a.name : info.name; a.photo = info.photo; }
  a.name = a.name || 'Аккаунт Google';
  // склеиваем дубликаты того же человека
  d.list = d.list.filter((x) => x === a || !(x.id === id || (known && (x.name === info.name || (info.photo && x.photo === info.photo))) || (known && x.name === 'Аккаунт Google' && !x.photo && x.cookies && accId(x.cookies) === id)));
  d.active = a.id; accWrite(d); return pub(d);
}
async function applyCookies(cs) {
  for (const c of cs || []) {
    const host = c.domain.replace(/^\./, '');
    const o = { url: `https://${host}${c.path || '/'}`, path: c.path || '/', secure: !!c.secure, httpOnly: !!c.httpOnly, name: c.name, value: c.value };
    if (!c.hostOnly) o.domain = c.domain; if (c.expirationDate) o.expirationDate = c.expirationDate; if (c.sameSite && c.sameSite !== 'unspecified') o.sameSite = c.sameSite;
    try { await ses().cookies.set(o); } catch {}
  }
}
async function accSwitch(id) {
  await accSnapshot().catch(() => {});
  const d = accRead(), a = d.list.find((x) => x.id === id); if (!a) throw new Error('Аккаунт не найден');
  await ses().clearStorageData({ storages: ['cookies'] });
  await applyCookies(a.cookies);
  if (!(await loggedIn()) || !(await accountInfo(true))) throw new Error('Вход в этот аккаунт устарел — войди заново');
  d.active = a.id; a.used = Date.now(); accWrite(d); await writeCookieFile().catch(() => {});
  return pub(d);
}
// «Добавить аккаунт»: текущий запоминаем и выходим, чтобы можно было войти в другой
let accPrev = null;
async function accAddNew() { await accSnapshot().catch(() => {}); accPrev = accRead().active; await ses().clearStorageData(); try { fs.unlinkSync(cookieFile()); } catch {} const d = accRead(); d.active = null; accWrite(d); return pub(d); }
// 1.9.4: вход в новый аккаунт отменили — возвращаем прежний, а не оставляем человека разлогиненным
async function accRestore() {
  if (await loggedIn()) { accPrev = null; return accSnapshot(); }
  const id = accPrev; accPrev = null; if (!id) return pub(accRead());
  try { return await accSwitch(id); } catch { return pub(accRead()); }
}
async function accRemove(id) {
  const d = accRead(); const was = d.active === id; d.list = d.list.filter((x) => x.id !== id);
  if (was) { d.active = null; await ses().clearStorageData(); try { fs.unlinkSync(cookieFile()); } catch {} }
  accWrite(d); return pub(d);
}
async function accRename(id, name) { const d = accRead(), a = d.list.find((x) => x.id === id); if (a && name) { a.name = String(name).slice(0, 60); a.custom = true; accWrite(d); } return pub(d); }
const accList = () => pub(accRead());
module.exports = { importCdpCookies, accSnapshot, accSwitch, accAddNew, accRestore, accRemove, accRename, accList, findBrowsers, loginViaBrowser, cancelViaBrowser, login, loginFromBrowser, logout, loggedIn, accountInfo, libraryPlaylists, playlistTracks, cookieArgs, writeCookieFile, api, parseTracks };
