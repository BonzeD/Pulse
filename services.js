const { atomicJSON } = require('./core-safety');
'use strict';
// 2.0.2: Pulse как клиент Apple Music и Spotify (каталог, поиск, медиатека, «Нравится»)
// и тексты песен прямо из Apple Music / Spotify / YouTube Music — с таймингами слов, бэк-вокалом и дуэтами.
// Звук: Apple Music и Spotify отдают аудио только своим плеерам (защита DRM), поэтому каждый трек
// сопоставляется с той же записью в YouTube Music (сначала по ISRC, затем по названию, исполнителю и длительности)
// и звучит оттуда. Всё остальное — каталог, обложки, плейлисты, медиатека, тексты — берётся из выбранного сервиса.
const fs = require('fs');
const path = require('path');
let electron = null; try { electron = require('electron'); } catch {}
const app = electron && electron.app;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';
const SP_PART = 'persist:spotify', AM_PART = 'persist:apple';
let ytm = null; // модуль ytm.js — задаётся из main.js
const setYtm = (m) => (ytm = m);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ses = (p) => (electron && electron.session ? electron.session.fromPartition(p) : null);
const isSvc = (id) => /^(am|sp):/.test(String(id || ''));
const svcOf = (id) => (String(id || '').startsWith('am:') ? 'am' : String(id || '').startsWith('sp:') ? 'sp' : 'yt');

async function get(url, opt = {}, partition) {
  const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), opt.timeout || 15000);
  try {
    const s = partition && ses(partition); const f = s && typeof s.fetch === 'function' ? s.fetch.bind(s) : fetch;
    return await f(url, { ...(s ? { credentials: 'include' } : {}), ...opt, headers: { 'User-Agent': UA, 'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8', ...(opt.headers || {}) }, signal: ac.signal });
  } finally { clearTimeout(tm); }
}

// ---------- постоянный кэш: сопоставления с YouTube, данные треков, ключ Apple ----------
const dataFile = () => (app ? path.join(app.getPath('userData'), 'services.json') : path.join(__dirname, '.services-test.json'));
let store = null, saveT = null;
function db() {
  if (store) return store;
  try { store = JSON.parse(fs.readFileSync(dataFile(), 'utf8')) || {}; } catch { store = {}; }
  for (const k of ['match', 'meta', 'alias']) store[k] = store[k] && typeof store[k] === 'object' ? store[k] : {};
  delete store.amDev; // 2.0.2: ключ Apple больше не храним на диске — берём свежий при запуске
  return store;
}
const trim = (o, n) => { const k = Object.keys(o); if (k.length > n) k.slice(0, k.length - n).forEach((x) => delete o[x]); };
function saveSoon() {
  clearTimeout(saveT);
  saveT = setTimeout(() => { const d = db(); trim(d.match, 30000); trim(d.meta, 30000); try { atomicJSON(dataFile(), d); } catch (e) { console.error('services save', e.message); } }, 1500);
}
function flush() { if (saveT) { clearTimeout(saveT); saveT = null; try { atomicJSON(dataFile(), db()); } catch {} } }
// запоминаем всё, что показали: по этим данным трек потом сопоставляется с YouTube и ищется текст
function remember(t) { if (t && t.kind === 'song' && isSvc(t.id)) { const d = db(); const o = d.meta[t.id]; d.meta[t.id] = { title: t.title, author: t.author, dur: t.dur || 0, isrc: t.isrc || (o && o.isrc) || null, art: t.art || null }; saveSoon(); } return t; }

// 2.0.2: ссылка на трек/альбом/плейлист Apple Music или Spotify, вставленная в поиск, открывается сразу
function parseLink(raw) {
  const s = String(raw || '').trim();
  let m = s.match(/^spotify:(track|album|playlist):([A-Za-z0-9]{22})$/);
  if (m) return { svc: 'spotify', kind: m[1], id: m[2] };
  let u; try { u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s); } catch { return null; }
  const host = u.hostname.replace(/^www\./, '').toLowerCase();
  if (host === 'open.spotify.com' || host === 'play.spotify.com') {
    m = u.pathname.match(/^\/(?:intl-[\w-]+\/)?(?:embed\/)?(track|album|playlist)\/([A-Za-z0-9]{22})/);
    if (m) return { svc: 'spotify', kind: m[1], id: m[2] };
    if (/^\/(?:intl-[\w-]+\/)?(artist|show|episode|user|collection)/.test(u.pathname)) return { svc: 'spotify', unsupported: true };
    return null;
  }
  if (host === 'spotify.link' || host === 'spoti.fi') return { svc: 'spotify', short: true, url: u.href };
  if (host === 'music.apple.com' || host === 'itunes.apple.com' || host === 'geo.music.apple.com' || host === 'embed.music.apple.com') {
    const p = u.pathname.split('/').filter(Boolean); const sf = /^[a-z]{2}$/i.test(p[0] || '') ? p.shift().toLowerCase() : 'us';
    const kind = p[0]; const last = p[p.length - 1] || '';
    const songI = u.searchParams.get('i');
    if (kind === 'album' && songI && /^\d+$/.test(songI)) return { svc: 'apple', kind: 'track', id: songI, sf };
    if (kind === 'album') { const id = (last.match(/^(?:id)?(\d+)$/) || [])[1]; return id ? { svc: 'apple', kind: 'album', id, sf } : null; }
    if (kind === 'song') { const id = (last.match(/^(?:id)?(\d+)$/) || [])[1]; return id ? { svc: 'apple', kind: 'track', id, sf } : null; }
    if (kind === 'playlist') { const id = (last.match(/^(pl\.[\w-]+)$/) || [])[1]; return id ? { svc: 'apple', kind: 'playlist', id, sf } : null; }
    if (kind === 'library' && p[1] === 'playlist' && /^p\.[\w-]+$/.test(last)) return { svc: 'apple', kind: 'libplaylist', id: last, sf };
    if (['artist', 'station', 'curator', 'music-video', 'room'].includes(kind)) return { svc: 'apple', unsupported: true };
    return null;
  }
  return null;
}
const isLink = (s) => { const p = parseLink(s); return !!p; };

// ---------- нормализация и сравнение ----------
function norm(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ё/g, 'е')
    .replace(/[’'`´]/g, '').replace(/&/g, ' and ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
// «(feat. X)», «- Remastered 2011», «[Live]» — убираем из названия для сравнения
function baseTitle(s) {
  return String(s || '').replace(/\s*[([](?:feat|ft|with|prod|from|remaster|remastered|explicit|clean|radio edit|bonus|deluxe|live|mono|stereo|\d{4})[^)\]]*[)\]]/gi, '')
    .replace(/\s+-\s+(?:\d{4}\s+)?(?:remaster(?:ed)?|radio edit|single version|mono|stereo|explicit|clean)\b.*$/i, '').replace(/\s+(?:feat|ft)\.?\s.+$/i, '').trim();
}
const toks = (s) => norm(s).split(' ').filter(Boolean);
function sim(a, b) { // доля общих слов (симметрично) 0..1
  const A = toks(a), B = toks(b); if (!A.length || !B.length) return 0;
  const sb = new Set(B); let n = 0; for (const x of A) if (sb.has(x)) n++;
  const sa = new Set(A); let k = 0; for (const x of B) if (sa.has(x)) k++;
  return Math.min(1, (n / A.length + k / B.length) / 2);
}
const splitArtists = (s) => String(s || '').split(/\s*(?:,|&|\bx\b|×|\bfeat\.?|\bft\.?|\band\b|\bwith\b|;|\/)\s*/i).map(norm).filter(Boolean);
function artistSim(a, b) {
  const A = splitArtists(a), B = splitArtists(b); if (!A.length || !B.length) return 0;
  if (A.some((x) => B.some((y) => x === y || (x.length > 3 && y.length > 3 && (x.includes(y) || y.includes(x)))))) return 1;
  return sim(A.join(' '), B.join(' '));
}
const VERSION = /\b(live|remix|acoustic|instrumental|karaoke|cover|sped up|slowed|nightcore|8d|reverb|demo)\b/;
function scoreCand(src, c) {
  if (!c || c.kind !== 'song' || !c.id) return 0;
  const ts = Math.max(sim(baseTitle(src.title), baseTitle(c.title)), sim(src.title, c.title));
  if (ts < 0.34) return 0;
  const as = artistSim(src.author, c.author) || (c.video && splitArtists(src.author).some((a) => norm(c.title).includes(a)) ? 0.7 : 0);
  let ds = 0.5; if (src.dur && c.dur) { const d = Math.abs(src.dur - c.dur); ds = d <= 2 ? 1 : d <= 6 ? 0.8 : d <= 15 ? 0.45 : d <= 40 ? 0.1 : -1.2; }
  const vs = VERSION.test(norm(src.title)) === VERSION.test(norm(c.title + ' ' + c.author)) ? 0 : -0.3;
  return ts * 0.45 + as * 0.3 + ds * 0.25 + vs + (c.video ? -0.03 : 0);
}
const songsOf = (shelves) => (Array.isArray(shelves) ? shelves : []).flatMap((s) => (s && s.items) || []).filter((x) => x && x.kind === 'song' && x.id);
async function ytSearch(q, filter) { // null — сеть/лимит (промах не запоминаем), [] — честно пусто
  for (let a = 0; a < 2; a++) { try { return songsOf(await ytm.search(q, filter)); } catch { if (a === 0) await sleep(1200); } }
  return null;
}
const matchP = new Map();
async function matchOne(src) {
  const key = src.key, d = db(), hit = d.match[key];
  if (hit && hit.id) return hit;
  if (hit && hit.miss && Date.now() - hit.miss < 6 * 3600e3) return null;
  if (matchP.has(key)) return matchP.get(key);
  const p = (async () => {
    let best = null, bs = 0, failed = false;
    const consider = (list) => { if (!list) { failed = true; return; } for (const c of list.slice(0, 8)) { const s = scoreCand(src, c); if (s > bs) { bs = s; best = c; } } };
    if (src.isrc) { const r = await ytSearch(src.isrc, 'songs'); if (r) consider(r.slice(0, 3)); }
    if (bs < 0.8) consider(await ytSearch(`${src.author} ${src.title}`, 'songs'));
    if (bs < 0.62) consider(await ytSearch(`${baseTitle(src.title)} ${splitArtists(src.author)[0] || ''}`, 'songs'));
    if (bs < 0.55) consider(await ytSearch(`${src.author} ${baseTitle(src.title)}`, 'videos'));
    if (!best || bs < 0.5) { if (!failed) { d.match[key] = { miss: Date.now() }; saveSoon(); } return null; }
    const out = { id: best.id, dur: best.dur || 0, score: +bs.toFixed(2) };
    delete d.match[key]; d.match[key] = out; saveSoon(); return out;
  })().finally(() => matchP.delete(key));
  matchP.set(key, p); return p;
}
// трек сервиса → id видео YouTube (для звука, скачивания и текста YouTube Music)
async function ytFor(id) {
  if (!isSvc(id)) return id;
  const meta = await trackMeta(id);
  if (svcOf(id) === 'sp' && !meta.isrc && !cachedYt(id)) { const isrc = await spIsrc(id.slice(3)); if (isrc) { meta.isrc = isrc; saveSoon(); } } // 2.0.2: ISRC — для точного совпадения
  const m = await matchOne({ key: id, ...meta });
  if (!m) throw new Error('Этого трека нет в YouTube Music — звук взять неоткуда');
  const a = db().alias; (a[m.id] = a[m.id] || []).includes(id) || a[m.id].push(id); saveSoon();
  return m.id;
}
const cachedYt = (id) => { const h = db().match[id]; return h && h.id ? h.id : null; };
const aliasesOf = (vid) => db().alias[vid] || [];
async function trackMeta(id) {
  const m = db().meta[id]; if (m && m.title) return m;
  const t = svcOf(id) === 'am' ? await amSongById(id.slice(3)) : await spTrackById(id.slice(3));
  if (!t) throw new Error('Трек не найден в каталоге');
  remember(t); return db().meta[id];
}

// ======================= Spotify =======================
// токен веб-плеера: open.spotify.com в скрытом окне (с сессией входа, если она есть) — берём заголовок Authorization
let spTok = null, spTokP = null;
function spTokDrop() { spTok = null; try { if (db().spTok) { delete db().spTok; saveSoon(); } } catch {} } // 2.0.4: вход/выход/смена аккаунта — забываем и сохранённый токен
const spHeaders = (tok) => ({ Authorization: 'Bearer ' + tok.access, ...(tok.client ? { 'client-token': tok.client } : {}), 'app-platform': 'WebPlayer', Origin: 'https://open.spotify.com', Referer: 'https://open.spotify.com/', Accept: 'application/json' });
async function spLoggedIn() { const s = ses(SP_PART); if (!s) return false; try { return (await s.cookies.get({ name: 'sp_dc' })).some((c) => c.value); } catch { return false; } }
async function spToken(force) {
  if (!force && spTok && spTok.exp > Date.now() + 60e3) return spTok;
  if (spTokP) return spTokP;
  // 2.0.4: токен (живёт ~50 мин) сохраняется зашифрованным — после перезапуска Spotify открывается сразу, без скрытого окна
  if (!force && !spTok) { const t = spTokLoad(); if (t) { spTok = t; return t; } }
  spTokP = (async () => { const user = await spLoggedIn(); const got = await spCapture(); if (got) { got.user = user; spTok = got; spTokSave(got); } return got; })().finally(() => { spTokP = null; });
  return spTokP;
}
function spTokLoad() {
  try { const e = electron && electron.safeStorage, o = db().spTok; if (!o || !e || !e.isEncryptionAvailable()) return null;
    const t = JSON.parse(e.decryptString(Buffer.from(o, 'base64'))); return t && t.access && t.exp > Date.now() + 5 * 60e3 ? t : null; } catch { return null; }
}
function spTokSave(t) {
  try { const e = electron && electron.safeStorage; if (!e || !e.isEncryptionAvailable()) return; db().spTok = e.encryptString(JSON.stringify(t)).toString('base64'); saveSoon(); } catch {}
}
async function spCapture() {
  if (!electron || !electron.BrowserWindow) return null;
  const { BrowserWindow } = electron; const s = ses(SP_PART);
  let got = null, w = null;
  s.webRequest.onBeforeSendHeaders({ urls: ['https://*.spotify.com/*'] }, (d, cb) => {
    try {
      let auth = null, client = null; for (const k in d.requestHeaders) { const lk = k.toLowerCase(); if (lk === 'authorization') auth = d.requestHeaders[k]; if (lk === 'client-token') client = d.requestHeaders[k]; }
      if (auth && /^Bearer\s+\S{40,}/.test(auth) && /api-partner|spclient|api\.spotify\.com/.test(d.url)) { const a = auth.replace(/^Bearer\s+/, ''); if (!got || client) got = { access: a, client: client || (got && got.client) || null, exp: Date.now() + 50 * 60e3 }; }
    } catch {}
    cb({ requestHeaders: d.requestHeaders });
  });
  try {
    w = new BrowserWindow({ show: false, width: 1000, height: 700, webPreferences: { partition: SP_PART, contextIsolation: true, sandbox: true, backgroundThrottling: false } });
    w.webContents.setAudioMuted(true);
    w.loadURL('https://open.spotify.com/', { userAgent: UA }).catch(() => {});
    for (let t = 0; t < 60 && !(got && got.client); t++) { await sleep(500); if (got && t > 8) break; if (!got && t === 24) w.webContents.reload(); } // страница «зависла» — одна перезагрузка
  } finally {
    try { s.webRequest.onBeforeSendHeaders(null); } catch {}
    try { if (w && !w.isDestroyed()) w.destroy(); } catch {}
  }
  return got;
}
async function spApi(url, { method = 'GET', body, retry = true, user = false, wait = true } = {}) {
  const tok = await spToken(); if (!tok) throw new Error('Spotify не отвечает — проверь интернет');
  if (user && !tok.user) throw new Error('Войди в Spotify (Настройки → Клиент)');
  if (!/^https:/.test(url)) url = 'https://api.spotify.com/v1' + url;
  const r = await get(url, { method, headers: { ...spHeaders(tok), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 401 && retry) { spTokDrop(); await spToken(true); return spApi(url, { method, body, retry: false, user }); }
  // 2.0.4: wait:false — при лимите (429) не ждём до 8 с, а сразу сдаёмся (для второстепенных полок главной)
  if (r.status === 429 && retry && wait) { await sleep(Math.min(8000, (+r.headers.get('retry-after') || 2) * 1000)); return spApi(url, { method, body, retry: false, user }); }
  if (!r.ok) { const e = new Error(`Spotify ${r.status}`); e.status = r.status; throw e; }
  return r.status === 204 ? null : r.json().catch(() => null);
}
const spMarket = () => (spTok && spTok.user ? 'market=from_token' : '');
const qs = (u, extra) => (extra ? u + (u.includes('?') ? '&' : '?') + extra : u);
const spImg = (imgs, min = 300) => { const a = (imgs || []).filter(Boolean).sort((x, y) => (x.width || 0) - (y.width || 0)); return ((a.find((i) => (i.width || 0) >= min) || a[a.length - 1]) || {}).url || null; };
function spSong(t, album) {
  if (!t || !t.id || t.type === 'episode' || t.is_local) return null;
  const al = t.album || album || {};
  return remember({ kind: 'song', id: 'sp:' + t.id, title: t.name || '', author: (t.artists || []).map((a) => a.name).join(', '), dur: Math.round((t.duration_ms || 0) / 1000),
    art: spImg(al.images, 300) || (album && album.art) || null, album: al.id ? { name: al.name, id: 'sp:album:' + al.id } : null,
    artistId: t.artists && t.artists[0] && t.artists[0].id ? 'sp:artist:' + t.artists[0].id : null, isrc: (t.external_ids || {}).isrc || null, loaded: true, svc: 'sp', broken: t.is_playable === false });
}
const spCard = (x, kind) => (!x || !x.id ? null : kind === 'artist'
  ? { kind: 'artist', browseId: 'sp:artist:' + x.id, title: x.name, sub: 'Исполнитель', art: spImg(x.images, 300), round: true }
  : kind === 'album'
    ? { kind: 'album', browseId: 'sp:album:' + x.id, title: x.name, sub: [({ single: 'Сингл', compilation: 'Сборник' })[x.album_type] || 'Альбом', (x.artists || []).map((a) => a.name).join(', '), (x.release_date || '').slice(0, 4)].filter(Boolean).join(' • '), art: spImg(x.images, 300) }
    : { kind: 'playlist', browseId: 'sp:playlist:' + x.id, title: x.name, sub: [x.owner && x.owner.display_name, x.tracks && x.tracks.total ? `${x.tracks.total} тр.` : ''].filter(Boolean).join(' • '), art: spImg(x.images, 300) });
async function spPaged(url, pick, cap = 3000, user = false) {
  const out = [];
  for (let g = 0; url && out.length < cap && g < 60; g++) { const j = await spApi(url, { user }); if (!j) break; const page = j.items ? j : (j.tracks || j.albums || j.artists || j); (page.items || []).forEach((x) => { const v = pick(x); if (v) out.push(v); }); url = page.next; }
  return out;
}
// 2.0.2: каталог Spotify — через внутренний GraphQL веб-плеера (pathfinder). Открытый Web API для анонимного токена
// почти всегда отвечает 429 (лимит общий на всех), а pathfinder — тот же путь, которым пользуется сам open.spotify.com.
// Хэши запросов меняются с обновлениями веб-плеера: при ошибке «PersistedQueryNotFound» берём свежие из его скриптов.
const SP_H0 = { libraryV3: '390c78e5b951029bad359785e69b07b536a509c581cbcd0aded5e5067f187455', fetchLibraryTracks: '087278b20b743578a6262c2b0b4bcd20d879c503cc359a2285baf083ef944240', profileAttributes: '08ffb4730af3746e04a8301396f20875dbbce10c75243803091a9274eacc8ac0', searchDesktop: 'eef7cc54888d91bdd6802623477873caa3948ae173a0c34fd86827b267e94c03', searchTracks: 'b02683192a98dde7966b5e6655a79eeb62713eab703eda9902c932818dd52751', searchAlbums: '202cb3305e31e5a0767ba7925f28bd728cf8f8b0217e6da43909056071cd70e9', searchArtists: '7bf95d754fdbe32c8b161fbbe54d1ae50974900df4dce4c8f1afcbcad153224d', searchPlaylists: 'd520014e748f9ea44f7707d8df1819867ac1205e8b7f3e28f22fe5fc858921b1', searchSuggestions: 'f244254b94c0e824d458ac216e0f8406a73f2f69a9ff52831a2f78fa774ff6ce', getAlbum: '6a74b456cd1735c9193d9e8ec8cc5184cad7ce13572210315229db3975964361', queryArtistOverview: '9f8134ef565e78621f1e1793555bd6633c5ac144ae0f89604ed3ae3f80b3c8e6', fetchPlaylist: '8964e8eafb21aa992a7d951d256d83285c04be2105d209262901de70cb97584a', getTrack: 'a8ef9e9f02b836feb0da3003c31dbb30decc6f4b473ef89ca88c882386d668de', home: '5fb7da7a03ee2776c0670856609cb85a189a3cecc36cc160b91cde79063b9cf1', browseAll: 'dbd8b55e09a58afc52eab438bc228ba28fd72ac2f2148c6c26354980e4579001', browsePage: 'f5c4e6d668f5716464a231c1cc8b22c1cbf6ad68b09929fd7de813a30581298b', internalLinkRecommenderTrack: 'c77098ee9d6ee8ad3eb844938722db60570d040b49f41f5ec6e7be9160a7c86b' };
const spH = (op) => ((db().spH || {}).h || {})[op] || SP_H0[op];
let spHP = null;
async function spRefreshHashes(op) {
  if (spHP) return spHP;
  spHP = (async () => {
    const d = db(); if (d.spH && Date.now() - d.spH.at < 3600e3 && (!op || (d.spH.h || {})[op])) return false; // не чаще раза в час (2.0.4: если нужного запроса нет в кэше — обновляем)
    const html = await (await get('https://open.spotify.com/', { headers: { Accept: 'text/html' } })).text();
    const main = (html.match(/https:\/\/open\.spotifycdn\.com\/cdn\/build\/web-player\/web-player\.[0-9a-f]+\.js/) || [])[0]; if (!main) return false;
    const base = main.replace(/[^/]+$/, ''); const js = await (await get(main)).text();
    const h = {}; const grab = (s) => { for (const m of s.matchAll(/"([A-Za-z]+)","(?:query|mutation)","([0-9a-f]{64})"/g)) h[m[1]] = m[2]; };
    grab(js);
    const names = {}; for (const m of js.matchAll(/(\d+):"((?:xpui-routes|browse|home)[\w-]*)"/g)) names[m[1]] = m[2];
    const files = []; for (const m of js.matchAll(/(\d+):"([0-9a-f]{8})"/g)) if (names[m[1]]) files.push(base + names[m[1]] + '.' + m[2] + '.js');
    await Promise.all([...new Set(files)].slice(0, 120).map((u) => get(u).then((r) => (r.ok ? r.text() : '')).then(grab).catch(() => {})));
    if (!Object.keys(h).length) return false;
    d.spH = { at: Date.now(), h }; saveSoon(); return true;
  })().catch(() => false).finally(() => { spHP = null; });
  return spHP;
}
async function spGql(op, variables, retry = true) {
  const tok = await spToken(); if (!tok) throw new Error('Spotify не отвечает — проверь интернет');
  const r = await get('https://api-partner.spotify.com/pathfinder/v2/query', { method: 'POST', headers: { ...spHeaders(tok), 'Content-Type': 'application/json;charset=UTF-8' }, body: JSON.stringify({ variables, operationName: op, extensions: { persistedQuery: { version: 1, sha256Hash: spH(op) } } }) });
  if (r.status === 401 && retry) { spTokDrop(); await spToken(true); return spGql(op, variables, false); }
  if (r.status === 429 && retry) { await sleep(2500); return spGql(op, variables, false); }
  const j = await r.json().catch(() => null);
  const err = j && j.errors && j.errors[0] && j.errors[0].message;
  if ((r.status === 412 || (err && /persisted ?query/i.test(err))) && retry && (await spRefreshHashes(op))) return spGql(op, variables, false); // устаревший хэш
  if (!r.ok || !j || (!j.data && err)) { const e = new Error(`Spotify ${r.status}${err ? ': ' + err.slice(0, 80) : ''}`); e.status = r.status; throw e; }
  return j.data;
}
const uriId = (u) => String(u || '').split(':').pop();
const gImg = (src, min = 300) => { const a = ((src && src.sources) || src || []).filter((x) => x && x.url).sort((x, y) => (x.width || 0) - (y.width || 0)); return ((a.find((i) => (i.width || 0) >= min) || a[a.length - 1]) || {}).url || null; };
const gTxt = (t) => (t && (t.transformedLabel || t.translatedBaseText || t.text)) || (typeof t === 'string' ? t : '');
const gArtists = (d) => [...(((d.artists || d.firstArtist || {}).items) || []), ...(((d.otherArtists || {}).items) || [])];
// трек из GraphQL → общий формат Pulse
function gSong(d, ctx = {}) {
  if (!d || (d.__typename && d.__typename !== 'Track')) return null;
  const id = d.id || uriId(d.uri); if (!/^[A-Za-z0-9]{22}$/.test(id)) return null;
  const ar = gArtists(d), al = d.albumOfTrack || {};
  return remember({ kind: 'song', id: 'sp:' + id, title: d.name || '', author: ar.map((a) => (a.profile || {}).name).filter(Boolean).join(', ') || ctx.author || '',
    dur: Math.round((((d.duration || d.trackDuration) || {}).totalMilliseconds || 0) / 1000), art: gImg(al.coverArt, 300) || ctx.art || null,
    album: al.uri || ctx.albumId ? { name: al.name || ctx.album || '', id: 'sp:album:' + uriId(al.uri || ctx.albumId) } : null,
    artistId: ar[0] && ar[0].uri ? 'sp:artist:' + uriId(ar[0].uri) : null, isrc: null, loaded: true, svc: 'sp', broken: !!(d.playability && d.playability.playable === false) });
}
const ALB_T = { SINGLE: 'Сингл', EP: 'EP', COMPILATION: 'Сборник', ALBUM: 'Альбом' };
const gYear = (dt) => (dt ? String(dt.year || (dt.isoString || '').slice(0, 4) || '') : '');
// карточка (исполнитель / альбом / плейлист) из GraphQL
function gCard(w) {
  const d = w && (w.data || w); if (!d) return null; const t = d.__typename;
  if (t === 'Track') return gSong(d);
  if (t === 'Artist') return { kind: 'artist', browseId: 'sp:artist:' + uriId(d.uri || d.id), title: (d.profile || {}).name || '', sub: 'Исполнитель', art: gImg(d.visuals && d.visuals.avatarImage, 300), round: true };
  if (t === 'Album' || t === 'PreRelease') return { kind: 'album', browseId: 'sp:album:' + uriId(d.uri || d.id), title: d.name || '', sub: [ALB_T[d.type] || 'Альбом', gArtists(d).map((a) => (a.profile || {}).name).filter(Boolean).join(', '), gYear(d.date)].filter(Boolean).join(' • '), art: gImg(d.coverArt, 300) };
  if (t === 'Playlist') { const img = (((d.images || {}).items) || [])[0]; return { kind: 'playlist', browseId: 'sp:playlist:' + uriId(d.uri), title: d.name || '', sub: ((d.ownerV2 || {}).data || {}).name || String(d.description || '').replace(/<[^>]+>/g, '').slice(0, 60) || 'Плейлист', art: img ? gImg(img, 300) : null }; }
  return null;
}
const gItems = (arr, pick = (x) => x) => (arr || []).map((x) => gCard(pick(x))).filter(Boolean);
// ISRC Spotify отдаёт только в метаданных трека (spclient) — по нему точнее находится звук в YouTube Music
const B62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const spGid = (id) => { let n = 0n; for (const c of id) n = n * 62n + BigInt(B62.indexOf(c)); return n.toString(16).padStart(32, '0'); };
async function spIsrc(id) {
  try { const tok = await spToken(); const r = await get(`https://spclient.wg.spotify.com/metadata/4/track/${spGid(id)}${tok.user ? '?market=from_token' : ''}`, { headers: spHeaders(tok) }); if (!r.ok) return null; const j = await r.json(); const x = (j.external_id || []).find((e) => e.type === 'isrc'); return x ? x.id : null; } catch { return null; }
}
async function spTrackById(id) {
  try { const d = await spGql('getTrack', { uri: 'spotify:track:' + id }); const t = gSong(d && d.trackUnion); if (t) { t.isrc = await spIsrc(id); remember(t); } return t; } catch { return null; }
}
const SP_TOP = '37i9dQZEVXbMDoHDwVN2tF'; // Top 50 — Global
const WEB = 'INTEGRATION_WEB_PLAYER';
const gSections = (secs) => ((secs && secs.items) || []).map((s) => {
  const items = gItems((s.sectionItems || {}).items, (x) => x.content); const title = gTxt((s.data || {}).title);
  return items.length ? { title, items, ...(items.every((x) => x.kind === 'song') ? { list: true } : {}) } : null;
}).filter(Boolean);
const gMoods = (secs) => ((secs && secs.items) || []).flatMap((s) => ((s.sectionItems || {}).items || []).map((x) => {
  const c = (((x.content || {}).data || {}).data || {}).cardRepresentation; if (!c || !/^spotify:page:/.test(x.uri || '')) return null;
  return { kind: 'mood', browseId: 'sp:page:' + uriId(x.uri), title: gTxt(c.title), color: (c.backgroundColor || {}).hex || '#1db954' };
})).filter(Boolean);
async function spBrowseAll() { return (await spGql('browseAll', { pagePagination: { offset: 0, limit: 10 }, sectionPagination: { offset: 0, limit: 99 }, browseEndUserIntegration: WEB })).browseStart; }
async function spFeed(id) {
  const user = (await spToken()) && spTok.user;
  const sh = [], add = (title, items, extra = {}) => { items = (items || []).filter(Boolean); if (items.length) sh.push({ title, items, ...extra }); };
  const safe = (p) => p.catch((e) => { console.error('spotify', e.message); return null; });
  const tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'UTC'; } })();
  if (id === 'FEmusic_home') {
    const [rec, pls, home] = await Promise.all([
      user ? safe(spApi('/me/player/recently-played?limit=30', { user: true, wait: false })) : null,
      user ? safe(spLibPlaylists(30)) : null, // 2.0.4: плейлисты — через GraphQL веб-плеера (Web API часто отвечает 429 и тормозил главную)
      safe(spGql('home', { timeZone: tz, sp_t: '', facet: '', sectionItemsLimit: 12, homeEndUserIntegration: WEB }))]);
    if (rec) { const seen = new Set(); add('Недавно слушал', (rec.items || []).map((x) => spSong(x.track)).filter((t) => t && !seen.has(t.id) && seen.add(t.id)).slice(0, 12), { list: true }); }
    if (pls) add('Твои плейлисты', pls);
    if (home) gSections(((home.home || {}).sectionContainer || {}).sections).forEach((s) => sh.push(s));
    if (!sh.length) throw new Error('Spotify не ответил');
    return { shelves: sh, chips: [] };
  }
  if (id === 'FEmusic_explore' || id === 'FEmusic_moods_and_genres') {
    const b = await spBrowseAll(); const moods = gMoods(b && b.sections);
    if (id === 'FEmusic_explore') { const t = await safe(spBrowse('sp:playlist:' + SP_TOP)); if (t) add('Top 50 — мир', t.tracks.slice(0, 12), { list: true }); add('Жанры и настроения', moods); return { shelves: sh, chips: [] }; }
    add('', moods); return { title: 'Жанры и настроения', shelves: sh, chips: [] };
  }
  if (id === 'FEmusic_new_releases' || id === 'FEmusic_charts') {
    const b = await spBrowseAll(); const moods = gMoods(b && b.sections);
    const re = id === 'FEmusic_charts' ? /chart|чарт|хит-парад/i : /new releases|новые релизы|новинки/i;
    const pg = moods.find((m) => re.test(m.title));
    if (id === 'FEmusic_charts') { const t = await safe(spBrowse('sp:playlist:' + SP_TOP)); if (t) add('Top 50 — мир', t.tracks, { list: true }); }
    if (pg) { const p = await safe(spBrowse(pg.browseId)); if (p) p.shelves.forEach((s) => sh.push(s)); }
    return { title: id === 'FEmusic_charts' ? 'Хит-парады' : 'Новинки', shelves: sh, chips: [] };
  }
  if (id === 'FEmusic_liked_albums') { add('', await spPaged('/me/albums?limit=50', (x) => spCard(x.album, 'album'), 500, true), { grid: true }); return { shelves: sh, chips: [] }; }
  if (id === 'FEmusic_library_corpus_track_artists') { const j = await spApi('/me/following?type=artist&limit=50', { user: true }); add('', (((j || {}).artists || {}).items || []).map((a) => spCard(a, 'artist')), { grid: true }); return { shelves: sh, chips: [] }; }
  return { shelves: [], chips: [] };
}
async function spPlaylistTracks(id, cap = 1000) {
  let out = [], meta = null;
  for (let off = 0; off < cap; off += 100) {
    const p = (await spGql('fetchPlaylist', { uri: 'spotify:playlist:' + id, offset: off, limit: 100, enableWatchFeedEntrypoint: false, includeEpisodeContentRatingsV2: false })).playlistV2;
    if (!p || p.__typename === 'NotFound' || !p.content) { if (!meta) throw new Error('Плейлист не найден в Spotify'); break; }
    if (!meta) meta = p;
    const items = p.content.items || []; out = out.concat(items.map((x) => gSong(((x.itemV2 || {}).data)))); 
    if (items.length < 100 || out.length >= (p.content.totalCount || 0)) break;
  }
  return { meta, tracks: out.filter(Boolean) };
}
async function spBrowse(bid) {
  const [, kind, id] = bid.split(':');
  if (kind === 'album') {
    const a = (await spGql('getAlbum', { uri: 'spotify:album:' + id, locale: '', offset: 0, limit: 300 })).albumUnion;
    if (!a || a.__typename !== 'Album') throw new Error('Альбом не найден в Spotify');
    const art = gImg(a.coverArt, 300), ctx = { art, album: a.name, albumId: a.uri };
    const tracks = (((a.tracksV2 || {}).items) || []).map((x) => gSong(x.track, ctx)).filter(Boolean);
    return { type: 'album', browseId: bid, header: { title: a.name, sub: [ALB_T[a.type] || 'Альбом', gYear(a.date), a.label].filter(Boolean).join(' • '), art: gImg(a.coverArt, 640), artists: gArtists(a).map((x) => ({ name: (x.profile || {}).name, id: 'sp:artist:' + uriId(x.uri) })) }, tracks, shelves: (() => { const more = gItems(((((a.moreAlbumsByArtist || {}).items || [])[0] || {}).discography || {}).popularReleasesAlbums && a.moreAlbumsByArtist.items[0].discography.popularReleasesAlbums.items); return more.length ? [{ title: 'Ещё от исполнителя', items: more }] : []; })() };
  }
  if (kind === 'playlist') {
    const { meta: p, tracks } = await spPlaylistTracks(id);
    const img = (((p.images || {}).items) || [])[0];
    return { type: 'playlist', browseId: bid, header: { title: p.name, sub: [((p.ownerV2 || {}).data || {}).name, p.followers ? `${(+p.followers).toLocaleString('ru-RU')} подписчиков` : ''].filter(Boolean).join(' • '), desc: String(p.description || '').replace(/<[^>]+>/g, ''), art: img ? gImg(img, 640) : tracks[0] && tracks[0].art }, tracks, shelves: [] };
  }
  if (kind === 'artist') {
    const a = (await spGql('queryArtistOverview', { uri: 'spotify:artist:' + id, locale: '', preReleaseV2: false })).artistUnion;
    if (!a || a.__typename !== 'Artist') throw new Error('Исполнитель не найден в Spotify');
    const dg = a.discography || {}, shelves = [];
    const top = (((dg.topTracks || {}).items) || []).map((x) => gSong(x.track, { author: (a.profile || {}).name })).filter(Boolean); if (top.length) shelves.push({ title: 'Популярные треки', items: top, list: true });
    const rel = (k) => gItems(((dg[k] || {}).items || []).map((x) => (((x.releases || {}).items) || [])[0]).filter(Boolean).map((r) => ({ ...r, __typename: 'Album' })));
    for (const [k, t] of [['albums', 'Альбомы'], ['singles', 'Синглы и EP'], ['compilations', 'Сборники']]) { const it = rel(k); if (it.length) shelves.push({ title: t, items: it }); }
    const pls = gItems((((a.profile || {}).playlistsV2 || {}).items) || []); if (pls.length) shelves.push({ title: 'Плейлисты', items: pls });
    const ra = gItems(((((a.relatedContent || {}).relatedArtists) || {}).items || []).map((x) => ({ ...x, __typename: 'Artist' }))); if (ra.length) shelves.push({ title: 'Похожие исполнители', items: ra });
    const st = a.stats || {};
    return { type: 'artist', browseId: bid, header: { title: (a.profile || {}).name, art: gImg(a.headerImage && a.headerImage.data, 900) || gImg(a.visuals && a.visuals.avatarImage, 640), sub: [st.monthlyListeners ? `${(+st.monthlyListeners).toLocaleString('ru-RU')} слушателей в месяц` : '', st.followers ? `${(+st.followers).toLocaleString('ru-RU')} подписчиков` : ''].filter(Boolean).join(' • '), desc: String(((a.profile || {}).biography || {}).text || '').replace(/<[^>]+>/g, ''), radio: 'sp:radio:' + id, round: true }, shelves };
  }
  if (kind === 'page') {
    const b = (await spGql('browsePage', { uri: 'spotify:page:' + id, pagePagination: { offset: 0, limit: 10 }, sectionPagination: { offset: 0, limit: 20 }, browseEndUserIntegration: WEB })).browse;
    const shelves = gSections(b && b.sections); const sub = gMoods(b && b.sections); if (sub.length) shelves.push({ title: 'Ещё', items: sub });
    return { type: 'page', browseId: bid, header: { title: gTxt(b && b.header && b.header.title) || 'Подборки' }, shelves };
  }
  if (kind === 'liked') {
    const tracks = await spLikedTracks();
    return { type: 'playlist', browseId: bid, header: { title: 'Любимые треки', sub: 'Spotify' }, tracks, shelves: [] };
  }
  throw new Error('Неизвестная страница Spotify');
}
const SV = { offset: 0, numberOfTopResults: 5, includeAudiobooks: false, includeArtistHasConcertsField: false, includePreReleases: false, includeAlbumPreReleases: false, includeAuthors: false, includeEpisodeContentRatingsV2: false };
async function spSearch(q, f) {
  if (f) {
    const op = { songs: 'searchTracks', videos: 'searchTracks', albums: 'searchAlbums', artists: 'searchArtists', playlists: 'searchPlaylists' }[f] || 'searchTracks';
    const s = (await spGql(op, { searchTerm: q, ...SV, limit: 40 })).searchV2 || {};
    const items = op === 'searchTracks' ? (((s.tracksV2 || {}).items) || []).map((x) => gSong(((x.item || {}).data))).filter(Boolean)
      : gItems(((s.albumsV2 || s.artists || s.playlists || {}).items) || []);
    return [{ title: '', items, list: op === 'searchTracks' }];
  }
  const s = (await spGql('searchDesktop', { searchTerm: q, ...SV, limit: 10, isPrefix: null, sectionFilters: ['GENERIC'] })).searchV2 || {};
  const songs = (((s.tracksV2 || {}).items) || []).map((x) => gSong(((x.item || {}).data))).filter(Boolean);
  const artists = gItems(((s.artists || {}).items) || []), albums = gItems(((s.albumsV2 || {}).items) || []), pls = gItems(((s.playlists || {}).items) || []);
  const sh = [];
  const top = gCard((((((s.topResultsV2 || {}).itemsV2) || [])[0]) || {}).item);
  if (top) sh.push({ title: 'Лучший результат', items: [top], top: true });
  if (songs.length) sh.push({ title: 'Треки', items: songs, list: true });
  const mixed = [...artists, ...albums, ...pls]; if (mixed.length) sh.push({ title: 'Результаты', items: mixed, list: true, mixed: true });
  return sh;
}
async function spSuggest(q) {
  const s = await spGql('searchSuggestions', { query: q, limit: 8, numberOfTopResults: 5, offset: 0, includeAuthors: false, includeAudiobooks: false }).catch(() => null);
  const out = ((((s && s.searchV2) || {}).topResultsV2 || {}).itemsV2 || []).map((x) => { const d = (x.item || {}).data || {}; return d.text || d.name || (d.profile || {}).name; }).filter(Boolean);
  return [...new Set(out)].slice(0, 8);
}
// «радио» — как в самом Spotify: плейлист-микс по треку или исполнителю (inspiredby-mix); запасной путь — рекомендации к треку
async function spNext(tid, list) {
  const seedUri = list && list.startsWith('sp:radio:') ? 'spotify:artist:' + list.slice(9) : tid ? 'spotify:track:' + tid.slice(3) : null;
  let tracks = [];
  if (seedUri) {
    try {
      const tok = await spToken(); const r = await get(`https://spclient.wg.spotify.com/inspiredby-mix/v2/seed_to_playlist/${seedUri}?response-format=json`, { headers: spHeaders(tok) });
      const j = r.ok ? await r.json() : null; const pl = j && j.mediaItems && j.mediaItems[0] && uriId(j.mediaItems[0].uri);
      if (pl) tracks = (await spPlaylistTracks(pl, 100)).tracks;
    } catch (e) { console.error('spotify radio', e.message); }
    if (tracks.length < 5 && tid) { const d = await spGql('internalLinkRecommenderTrack', { uri: seedUri, limit: 30 }).catch(() => null); tracks = tracks.concat(((((d || {}).seoRecommendedTrack || {}).items) || []).map((x) => gSong(x.data)).filter(Boolean)); }
  }
  const first = tid ? (tracks.find((t) => t.id === tid) || await spTrackById(tid.slice(3))) : null;
  const seen = new Set(first ? [first.id] : []);
  return { tracks: [first, ...tracks].filter((t, i) => t && (i === 0 || (!seen.has(t.id) && seen.add(t.id)))), related: tid ? 'sp:rel:' + tid.slice(3) : null, lyricsId: null };
}
// треки исполнителя вперемешку с треками похожих
function mixRadio(own, others) {
  const out = []; own = own.slice(); const pools = others.map((x) => x.slice());
  for (let i = 0; out.length < 40 && (own.length || pools.some((p) => p.length)); i++) { if (own.length && i % 2 === 0) out.push(own.shift()); else { const p = pools[i % (pools.length || 1)]; if (p && p.length) out.push(p.shift()); else if (own.length) out.push(own.shift()); } }
  return out;
}
async function spLike(id, on) { await spApi(`/me/tracks?ids=${id.slice(3)}`, { method: on ? 'PUT' : 'DELETE', user: true }); return true; }
// 2.0.4: медиатека Spotify — тем же запросом, что и боковая панель open.spotify.com (libraryV3). Раньше плейлисты брались
// из открытого Web API (/me/playlists): он часто отвечает 429, приложение ждало до 8 с на каждую страницу и в итоге
// показывало пустой список. Web API остался запасным вариантом.
async function spLibPlaylists(cap = 1000) {
  const out = [], seen = new Set();
  try {
    for (let off = 0; off < cap; off += 50) {
      const d = await spGql('libraryV3', { filters: ['Playlists'], order: null, textFilter: '', features: ['LIKED_SONGS', 'YOUR_EPISODES_V2', 'PRERELEASES', 'PRERELEASES_V2', 'EVENTS'],
        limit: 50, offset: off, flatten: true, expandedFolders: [], folderUri: null, includeFoldersWhenFlattening: true });
      const L = d && d.me && d.me.libraryV3; if (!L || !Array.isArray(L.items)) break;
      for (const x of L.items) { const it = (x && x.item && (x.item.data || x.item)) || {}; if (it.__typename !== 'Playlist') continue; const c = gCard(it); if (c && !seen.has(c.browseId)) { seen.add(c.browseId); out.push(c); } }
      if (L.items.length < 50 || off + 50 >= (L.totalCount || 0)) break;
    }
  } catch (e) { console.error('spotify libraryV3', e.message); }
  if (out.length) return out.slice(0, cap);
  return spPaged(`/me/playlists?limit=${Math.min(50, cap)}`, (p) => spCard(p, 'playlist'), cap, true);
}
async function spLikedTracks() {
  let out = [];
  try {
    for (let off = 0; off < 5000; off += 50) {
      const d = await spGql('fetchLibraryTracks', { offset: off, limit: 50 });
      const T = d && d.me && d.me.library && d.me.library.tracks; if (!T || !Array.isArray(T.items)) break;
      out = out.concat(T.items.map((x) => gSong(((x && x.track) || {}).data)).filter(Boolean));
      if (T.items.length < 50 || out.length >= (T.totalCount || (T.pagingInfo || {}).total || Infinity)) break;
    }
  } catch (e) { console.error('spotify fetchLibraryTracks', e.message); }
  if (out.length) return out;
  return spPaged('/me/tracks?limit=50', (x) => spSong(x.track), 5000, true);
}
async function spPlaylists() {
  const out = [{ kind: 'playlist', browseId: 'sp:liked', title: 'Любимые треки', sub: 'Spotify', art: null, icon: 'heart' }];
  (await spLibPlaylists()).forEach((p) => out.push(p));
  return out;
}

// ======================= Apple Music =======================
let amDev = null, amDevP = null;
function jwtExp(t) { try { return (JSON.parse(Buffer.from(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()).exp || 0) * 1000; } catch { return 0; } }
async function amDevToken(force) {
  if (!force && amDev && jwtExp(amDev) > Date.now() + 3600e3) return amDev;
  if (amDevP) return amDevP;
  amDevP = (async () => {
    const h = await (await get('https://music.apple.com/us/browse', { headers: { Accept: 'text/html' } })).text();
    const js = [...new Set(h.match(/\/assets\/index[^"'\s]*\.js/g) || [])];
    for (const p of js) {
      const s = await (await get('https://music.apple.com' + p)).text();
      const ok = (s.match(/eyJ[\w-]{20,}\.[\w-]{20,}\.[\w-]{20,}/g) || []).find((t) => jwtExp(t) > Date.now());
      if (ok) return (amDev = ok);
    }
    throw new Error('Apple Music не отвечает — проверь интернет');
  })().finally(() => { amDevP = null; });
  return amDevP;
}
async function amUserToken() { const s = ses(AM_PART); if (!s) return null; try { const c = (await s.cookies.get({ name: 'media-user-token' })).find((x) => x.value); return c ? c.value : null; } catch { return null; } }
async function amApi(pathq, { user = false, retry = true, method = 'GET', body } = {}) {
  const dev = await amDevToken();
  const h = { Authorization: 'Bearer ' + dev, Origin: 'https://music.apple.com', Referer: 'https://music.apple.com/', Accept: 'application/json' };
  if (user) { const mut = await amUserToken(); if (!mut) { const e = new Error('Войди в Apple Music (Настройки → Клиент)'); e.status = 401; throw e; } h['Media-User-Token'] = mut; }
  if (body) h['Content-Type'] = 'application/json';
  const url = /^https:/.test(pathq) ? pathq : 'https://amp-api.music.apple.com' + pathq;
  const r = await get(url, { method, headers: h, body: body ? JSON.stringify(body) : undefined }, user ? AM_PART : null);
  if (r.status === 401 && retry && !user) { amDev = null; await amDevToken(true); return amApi(pathq, { user, retry: false, method, body }); }
  if (r.status === 404) return null;
  if (!r.ok && r.status !== 202 && r.status !== 204) { const e = new Error(`Apple Music ${r.status}`); e.status = r.status; throw e; }
  return r.status === 204 || r.status === 202 ? {} : r.json().catch(() => ({}));
}
let amSfUser = null, amSfPref = 'auto';
function setAppleRegion(sf) { amSfPref = /^[a-z]{2}$/.test(sf || '') ? sf : 'auto'; }
async function amSf() {
  if (amSfPref !== 'auto') return amSfPref;
  if (amSfUser) return amSfUser;
  if (await amUserToken()) { try { const j = await amApi('/v1/me/storefront', { user: true }); amSfUser = (j && j.data && j.data[0] && j.data[0].id) || null; } catch {} if (amSfUser) return amSfUser; }
  const cc = String((app && app.getLocaleCountryCode && app.getLocaleCountryCode()) || '').toLowerCase();
  return /^[a-z]{2}$/.test(cc) ? cc : 'us';
}
function amArt(a, n = 544) {
  const raw=typeof a==='string'?a:a?.url; if(typeof raw!=='string'||!raw)return null;
  const size=String(Math.max(32,Math.min(4096,Math.round(+n||544))));
  const url=raw.replace(/\{w\}/g,size).replace(/\{h\}/g,size).replace(/\{f\}/g,'jpg').replace(/\{c\}/g,'bb');
  try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&(u.hostname==='mzstatic.com'||u.hostname.endsWith('.mzstatic.com'))&&!/[{}]/.test(url)?url:null;}catch{return null;}
}
// Library artwork has priority over catalog artwork. No track art masquerading as a custom cover.
function amPlaylistArt(x,n=900){return amArt(x?.attributes?.artwork,n)||((x?.relationships?.catalog?.data||[]).map(c=>amArt(c?.attributes?.artwork,n)).find(Boolean))||null;}
async function playlistArtwork(bid){
  const match=/^am:(lib|playlist):([A-Za-z0-9._-]{1,160})$/.exec(String(bid||''));if(!match)throw Error('Invalid Apple playlist ID');
  const library=match[1]==='lib',id=encodeURIComponent(match[2]);
  const j=await amApi(library?`/v1/me/library/playlists/${id}?include=catalog`:`/v1/catalog/${await amSf()}/playlists/${id}`,{user:library});
  const x=j?.data?.[0];return {art:amPlaylistArt(x),source:x?.attributes?.artwork?'library':'catalog'};
}
const amCatId = (x) => { const a = (x && x.attributes) || {}; const pp = a.playParams || {}; return pp.catalogId || (pp.kind === 'song' && !/^i\./.test(pp.id || '') ? pp.id : null) || (/^\d+$/.test(x.id) ? x.id : null); };
function amSong(x, ctx = {}) {
  if (!x || !/songs|library-songs/.test(x.type || '')) return null;
  const a = x.attributes || {}, cid = amCatId(x); if (!cid) return null;
  const al = ((x.relationships || {}).albums || {}).data, ar = ((x.relationships || {}).artists || {}).data;
  const alId = (al && al[0] && al[0].id) || ctx.albumId || ((String(a.url || '').match(/\/album\/[^/]+\/(\d+)/) || [])[1]);
  return remember({ kind: 'song', id: 'am:' + cid, title: a.name || '', author: a.artistName || '', dur: Math.round((a.durationInMillis || 0) / 1000), art: amArt(a.artwork, 544) || ctx.art || null,
    album: a.albumName ? { name: a.albumName, id: alId ? 'am:album:' + alId : null } : null, artistId: ar && ar[0] ? 'am:artist:' + ar[0].id : ctx.artistId || null, isrc: a.isrc || null,
    loaded: true, svc: 'am', broken: !a.playParams && x.type === 'songs' });
}
function amCard(x) {
  if (!x || !x.id) return null; const a = x.attributes || {};
  if (/artists/.test(x.type)) return { kind: 'artist', browseId: 'am:artist:' + x.id, title: a.name, sub: (a.genreNames || []).slice(0, 2).join(', ') || 'Исполнитель', art: amArt(a.artwork, 300), round: true };
  if (/albums/.test(x.type)) { const lib = x.type === 'library-albums', cid = lib ? ((a.playParams || {}).catalogId) : x.id; return { kind: 'album', browseId: cid ? 'am:album:' + cid : 'am:libalbum:' + x.id, title: a.name, sub: [a.isSingle ? 'Сингл' : 'Альбом', a.artistName, (a.releaseDate || '').slice(0, 4)].filter(Boolean).join(' • '), art: amArt(a.artwork, 300) }; }
  if (/playlists/.test(x.type)) return { kind: 'playlist', browseId: (x.type === 'library-playlists' ? 'am:lib:' : 'am:playlist:') + x.id, title: a.name, sub: a.curatorName || (x.type === 'library-playlists' ? 'Моя медиатека' : 'Apple Music'), art: amPlaylistArt(x, 300) };
  if (/stations/.test(x.type)) return null;
  return null;
}
const amItem = (x) => amSong(x) || amCard(x);
async function amSongById(cid) { const sf = await amSf(); const j = await amApi(`/v1/catalog/${sf}/songs/${cid}?include=artists,albums`); return amSong(j && j.data && j.data[0]); }
async function amPaged(first, user, map, cap = 5000) {
  const out = []; let next = first;
  for (let g = 0; next && out.length < cap && g < 80; g++) {
    const j = await amApi(next, { user }); if (!j) break;
    (j.data || []).forEach((x) => { const v = map(x); if (v) out.push(v); });
    next = j.next ? (j.next.includes('limit=') ? j.next : j.next + (j.next.includes('?') ? '&' : '?') + 'limit=100') : null;
  }
  return out;
}
async function amFeed(id) {
  const sf = await amSf(), user = !!(await amUserToken());
  const sh = [], add = (title, items, extra = {}) => { items = (items || []).filter(Boolean); if (items.length) sh.push({ title, items, ...extra }); };
  const charts = async (genre, limit = 24) => { const j = await amApi(`/v1/catalog/${sf}/charts?types=songs,albums,playlists&limit=${limit}${genre ? '&genre=' + genre : ''}`); const r = (j && j.results) || {}; return { songs: ((r.songs || [])[0] || {}).data || [], albums: ((r.albums || [])[0] || {}).data || [], playlists: ((r.playlists || [])[0] || {}).data || [] }; };
  if (id === 'FEmusic_home') {
    const [rec, recent, ch] = await Promise.all([user ? amApi('/v1/me/recommendations?limit=12&extend=editorialArtwork', { user: true }).catch(() => null) : null,
      user ? amApi('/v1/me/recent/played?limit=20', { user: true }).catch(() => null) : null, charts().catch(() => null)]);
    if (recent) add('Недавно слушал', (recent.data || []).map(amCard));
    for (const r of (rec && rec.data) || []) {
      const t = (((r.attributes || {}).title) || {}).stringForDisplay || ''; const items = (((r.relationships || {}).contents || {}).data || []).map(amItem);
      add(t.replace(/<[^>]+>/g, ''), items, items.every((x) => x && x.kind === 'song') ? { list: true } : {});
    }
    if (ch) { add('Топ песен', ch.songs.slice(0, 12).map((x) => amSong(x)), { list: true }); add('Популярные альбомы', ch.albums.map(amCard)); add('Популярные плейлисты', ch.playlists.map(amCard)); }
    return { shelves: sh, chips: [] };
  }
  if (id === 'FEmusic_explore' || id === 'FEmusic_charts' || id === 'FEmusic_new_releases') {
    const ch = await charts(null, id === 'FEmusic_explore' ? 24 : 50);
    if (id !== 'FEmusic_new_releases') add('Топ песен', ch.songs.map((x) => amSong(x)).slice(0, id === 'FEmusic_charts' ? 50 : 12), { list: true });
    add('Популярные альбомы', ch.albums.map(amCard), id === 'FEmusic_new_releases' ? { grid: true } : {});
    if (id !== 'FEmusic_new_releases') add('Популярные плейлисты', ch.playlists.map(amCard));
    if (id === 'FEmusic_explore') { const g = await amApi(`/v1/catalog/${sf}/genres?limit=40`).catch(() => null); add('Жанры', ((g && g.data) || []).filter((x) => x.id !== '34').map((x) => ({ kind: 'mood', browseId: 'am:genre:' + x.id, title: (x.attributes || {}).name, color: '#fa2d48' }))); }
    return { title: { FEmusic_charts: 'Хит-парады', FEmusic_new_releases: 'Новинки' }[id] || '', shelves: sh, chips: [] };
  }
  if (id === 'FEmusic_moods_and_genres') { const g = await amApi(`/v1/catalog/${sf}/genres?limit=60`); add('', ((g && g.data) || []).filter((x) => x.id !== '34').map((x) => ({ kind: 'mood', browseId: 'am:genre:' + x.id, title: (x.attributes || {}).name, color: '#fa2d48' }))); return { title: 'Жанры', shelves: sh, chips: [] }; }
  if (id === 'FEmusic_liked_albums') { add('', await amPaged('/v1/me/library/albums?limit=100', true, amCard, 1000), { grid: true }); return { shelves: sh, chips: [] }; }
  if (id === 'FEmusic_library_corpus_track_artists') { add('', await amPaged('/v1/me/library/artists?limit=100&include=catalog', true, (x) => { const c = ((x.relationships || {}).catalog || {}).data; return c && c[0] ? amCard(c[0]) : null; }, 1000), { grid: true }); return { shelves: sh, chips: [] }; }
  return { shelves: [], chips: [] };
}
async function amBrowse(bid) {
  const sf = await amSf(); const [, kind, ...rest] = bid.split(':'); const id = rest.join(':');
  if (kind === 'album' || kind === 'libalbum') {
    const lib = kind === 'libalbum';
    const j = await amApi(lib ? `/v1/me/library/albums/${id}?include=tracks` : `/v1/catalog/${sf}/albums/${id}?include=artists`, { user: lib }); const x = j && j.data && j.data[0]; if (!x) throw new Error('Альбом не найден в Apple Music');
    const a = x.attributes || {}, art = amArt(a.artwork, 544), arts = (((x.relationships || {}).artists || {}).data || []);
    const ctx = { art, albumId: lib ? null : id, artistId: arts[0] ? 'am:artist:' + arts[0].id : null };
    const rel = (x.relationships || {}).tracks || {}; let tracks = (rel.data || []).map((t) => amSong(t, ctx));
    if (rel.next) tracks = tracks.concat(await amPaged(rel.next, lib, (t) => amSong(t, ctx)));
    return { type: 'album', browseId: bid, header: { title: a.name, sub: [a.isSingle ? 'Сингл' : 'Альбом', (a.releaseDate || '').slice(0, 4), a.recordLabel].filter(Boolean).join(' • '), desc: ((a.editorialNotes || {}).standard || '').replace(/<[^>]+>/g, ''), art: amArt(a.artwork, 900), artists: arts.length ? arts.map((r) => ({ name: (r.attributes || {}).name || a.artistName, id: 'am:artist:' + r.id })) : [{ name: a.artistName }] }, tracks: tracks.filter(Boolean), shelves: [] };
  }
  if (kind === 'playlist' || kind === 'lib') {
    const lib = kind === 'lib';
    const j = await amApi(lib ? `/v1/me/library/playlists/${id}?include=catalog` : `/v1/catalog/${sf}/playlists/${id}`, { user: lib }); const x = j && j.data && j.data[0]; if (!x) throw new Error('Плейлист не найден в Apple Music');
    const a = x.attributes || {};
    const tracks = await amPaged(lib ? `/v1/me/library/playlists/${id}/tracks?limit=100` : `/v1/catalog/${sf}/playlists/${id}/tracks?limit=100`, lib, (t) => amSong(t));
    return { type: 'playlist', browseId: bid, header: { title: a.name, sub: a.curatorName || (lib ? 'Моя медиатека' : 'Apple Music'), desc: ((a.description || {}).standard || '').replace(/<[^>]+>/g, ''), art: amPlaylistArt(x, 900) || (!lib && tracks[0] && tracks[0].art) || null }, tracks, shelves: [] };
  }
  if (kind === 'artist') {
    const j = await amApi(`/v1/catalog/${sf}/artists/${id}?views=top-songs,full-albums,singles,latest-release,similar-artists,appears-on-albums&extend=artistBio,editorialArtwork`);
    const x = j && j.data && j.data[0]; if (!x) throw new Error('Исполнитель не найден в Apple Music');
    const a = x.attributes || {}, v = x.views || {}, data = (k) => ((v[k] || {}).data || []);
    const ctx = { artistId: bid };
    const shelves = [];
    const top = data('top-songs').map((s) => amSong(s, ctx)).filter(Boolean); if (top.length) shelves.push({ title: 'Популярные треки', items: top, list: true });
    for (const [k, t] of [['latest-release', 'Последний релиз'], ['full-albums', 'Альбомы'], ['singles', 'Синглы и EP'], ['appears-on-albums', 'Участие'], ['similar-artists', 'Похожие исполнители']]) { const it = data(k).map(amCard).filter(Boolean); if (it.length) shelves.push({ title: t, items: it }); }
    return { type: 'artist', browseId: bid, header: { title: a.name, art: amArt((a.editorialArtwork || {}).centeredFullscreenBackground || a.artwork, 900) || amArt(a.artwork, 900), sub: (a.genreNames || []).join(', '), desc: String(a.artistBio || '').replace(/<[^>]+>/g, ''), radio: 'am:radio:' + id, round: true }, shelves };
  }
  if (kind === 'genre') {
    const [ch, g] = await Promise.all([amApi(`/v1/catalog/${sf}/charts?types=songs,albums,playlists&limit=30&genre=${id}`), amApi(`/v1/catalog/${sf}/genres/${id}`).catch(() => null)]);
    const r = (ch && ch.results) || {}, d = (k) => ((r[k] || [])[0] || {}).data || [];
    const shelves = [];
    const s = d('songs').map((x) => amSong(x)).filter(Boolean); if (s.length) shelves.push({ title: 'Топ песен', items: s, list: true });
    const al = d('albums').map(amCard).filter(Boolean); if (al.length) shelves.push({ title: 'Альбомы', items: al });
    const pl = d('playlists').map(amCard).filter(Boolean); if (pl.length) shelves.push({ title: 'Плейлисты', items: pl });
    return { type: 'page', browseId: bid, header: { title: (g && g.data && g.data[0] && g.data[0].attributes.name) || 'Жанр' }, shelves };
  }
  if (kind === 'liked') {
    const tracks = await amPaged('/v1/me/library/songs?limit=100&sort=-dateAdded&include=catalog', true, (x) => { const c = ((x.relationships || {}).catalog || {}).data; return amSong((c && c[0]) || x); }, 10000);
    return { type: 'playlist', browseId: bid, header: { title: 'Песни в медиатеке', sub: 'Apple Music' }, tracks, shelves: [] };
  }
  throw new Error('Неизвестная страница Apple Music');
}
async function amSearch(q, f) {
  const sf = await amSf();
  const types = !f ? 'songs,albums,artists,playlists' : ({ songs: 'songs', videos: 'songs', albums: 'albums', artists: 'artists', playlists: 'playlists' })[f] || 'songs';
  const j = await amApi(`/v1/catalog/${sf}/search?term=${encodeURIComponent(q)}&types=${types}&limit=${f ? 25 : 15}${f ? '' : '&with=topResults'}&include[songs]=artists`);
  const r = (j && j.results) || {}, d = (k) => ((r[k] || {}).data || []);
  const songs = d('songs').map((x) => amSong(x)).filter(Boolean);
  const cards = [...d('artists'), ...d('albums'), ...d('playlists')].map(amCard).filter(Boolean);
  if (f) return [{ title: '', items: [...songs, ...cards], list: !!songs.length }];
  const sh = []; const top = d('top').map(amItem).find(Boolean);
  if (top) sh.push({ title: 'Лучший результат', items: [top], top: true });
  if (songs.length) sh.push({ title: 'Треки', items: songs, list: true });
  if (cards.length) sh.push({ title: 'Результаты', items: cards, list: true, mixed: true });
  return sh;
}
async function amSuggest(q) {
  const sf = await amSf();
  const j = await amApi(`/v1/catalog/${sf}/search/suggestions?term=${encodeURIComponent(q)}&kinds=terms&limit=8`).catch(() => null);
  return (((j && j.results) || {}).suggestions || []).map((s) => s.displayTerm || s.searchTerm).filter(Boolean).slice(0, 8);
}
async function amNext(tid, list) {
  const sf = await amSf(); let artistId = null, first = null;
  if (list && list.startsWith('am:radio:')) artistId = list.slice(9);
  else if (tid) { const j = await amApi(`/v1/catalog/${sf}/songs/${tid.slice(3)}?include=artists`).catch(() => null); const x = j && j.data && j.data[0]; first = amSong(x); const ar = x && ((x.relationships || {}).artists || {}).data; artistId = ar && ar[0] && ar[0].id; }
  let tracks = [];
  if (artistId) {
    const j = await amApi(`/v1/catalog/${sf}/artists/${artistId}?views=top-songs,similar-artists`).catch(() => null); const v = (j && j.data && j.data[0] && j.data[0].views) || {};
    const own = ((v['top-songs'] || {}).data || []).map((s) => amSong(s)).filter(Boolean);
    const sim = ((v['similar-artists'] || {}).data || []).slice(0, 5);
    const others = await Promise.all(sim.map((a) => amApi(`/v1/catalog/${sf}/artists/${a.id}?views=top-songs`).then((r) => (((r.data[0].views || {})['top-songs'] || {}).data || []).slice(0, 4).map((s) => amSong(s)).filter(Boolean)).catch(() => [])));
    tracks = mixRadio(own, others);
  }
  const seen = new Set(first ? [first.id] : []);
  return { tracks: [first, ...tracks].filter((t, i) => t && (i === 0 || (!seen.has(t.id) && seen.add(t.id)))), related: tid ? 'am:rel:' + tid.slice(3) : null, lyricsId: null };
}
async function amLike(id, on) {
  const cid = id.slice(3);
  if (on) { await amApi(`/v1/me/library?ids[songs]=${cid}`, { user: true, method: 'POST' }); await amApi(`/v1/me/ratings/songs/${cid}`, { user: true, method: 'PUT', body: { type: 'rating', attributes: { value: 1 } } }).catch(() => {}); }
  else await amApi(`/v1/me/ratings/songs/${cid}`, { user: true, method: 'DELETE' }).catch(() => {});
  return true;
}
// 2.0.4: «Не нравится» — Apple Music: оценка −1 (как «Предлагать меньше похожего» в приложении); Spotify открытого дизлайка
// не имеет — Pulse запоминает дизлайк у себя (волна учитывает его так же)
async function amDislike(id, on) {
  const cid = id.slice(3);
  if (on) await amApi(`/v1/me/ratings/songs/${cid}`, { user: true, method: 'PUT', body: { type: 'rating', attributes: { value: -1 } } });
  else await amApi(`/v1/me/ratings/songs/${cid}`, { user: true, method: 'DELETE' }).catch(() => {});
  return true;
}
async function spDislike() { return { local: true }; }
async function amPlaylists() {
  const out = [{ kind: 'playlist', browseId: 'am:liked', title: 'Песни в медиатеке', sub: 'Apple Music', art: null, icon: 'heart' }];
  (await amPaged('/v1/me/library/playlists?limit=100&include=catalog', true, amCard, 1000)).forEach((p) => out.push(p));
  return out;
}

// ======================= общий интерфейс клиента =======================
const C = { am: { feed: amFeed, browse: amBrowse, search: amSearch, suggest: amSuggest, next: amNext, like: amLike, dislike: amDislike, playlists: amPlaylists },
  sp: { feed: spFeed, browse: spBrowse, search: spSearch, suggest: spSuggest, next: spNext, like: spLike, dislike: spDislike, playlists: spPlaylists } };
const cl = (s) => { if (!C[s]) throw new Error('Неизвестный клиент'); return C[s]; };
const feed = (s, id, params) => cl(s).feed(id, params);
const browse = (bid) => cl(svcOf(bid)).browse(bid);
const search = (s, q, f) => cl(s).search(q, f);
const suggest = (s, q) => cl(s).suggest(q);
const next = (tid, list) => cl(svcOf(tid || list)).next(tid, list);
const like = (id, on) => cl(svcOf(id)).like(id, on);
const dislike = (id, on) => cl(svcOf(id)).dislike(id, on); // 2.0.4
const playlists = (s) => cl(s).playlists();
// «Похожие» во вкладке плеера: рекомендации трека
async function related(rid) {
  const s = svcOf(rid), tid = s + ':' + rid.split(':')[2];
  if (s === 'sp') { const d = await spGql('internalLinkRecommenderTrack', { uri: 'spotify:track:' + rid.split(':')[2], limit: 30 }).catch(() => null); const items = ((((d || {}).seoRecommendedTrack || {}).items) || []).map((x) => gSong(x.data)).filter(Boolean); if (items.length) return [{ title: 'Похожие треки', items, list: true }]; }
  const r = await next(tid); const items = r.tracks.slice(1, 21);
  return items.length ? [{ title: 'Похожие треки', items, list: true }] : [];
}
function link(id) {
  const [s, k, ...r] = String(id).split(':'); const x = r.join(':');
  if (s === 'sp') return k && r.length ? `https://open.spotify.com/${k}/${x}` : `https://open.spotify.com/track/${k}`;
  if (s === 'am') return k && r.length ? (k === 'lib' ? 'https://music.apple.com/library/playlist/' + x : `https://music.apple.com/${amSfPref !== 'auto' ? amSfPref : amSfUser || 'us'}/${k === 'artist' ? 'artist' : k === 'playlist' ? 'playlist' : 'album'}/${x}`) : `https://music.apple.com/${amSfPref !== 'auto' ? amSfPref : amSfUser || 'us'}/song/${k}`;
  return null;
}

// 2.0.2: ссылка Apple Music / Spotify в поиске — сразу открываем трек, альбом или плейлист
async function searchLink(q) {
  const p = parseLink(q); if (!p || p.unsupported || !p.kind) return null;
  if (p.kind === 'track') { const t = p.svc === 'spotify' ? await spTrackById(p.id) : await amSongById(p.id).catch(() => null); return t ? [{ title: 'По ссылке', items: [t], list: true }] : []; }
  const kind = p.kind === 'album' ? 'album' : 'playlist';
  const bid = p.svc === 'spotify' ? `sp:${p.kind}:${p.id}` : p.kind === 'album' ? 'am:album:' + p.id : p.kind === 'playlist' ? 'am:playlist:' + p.id : 'am:lib:' + p.id;
  const b = await browse(bid).catch(() => null); const h = (b && b.header) || {};
  return [{ title: 'По ссылке', items: [{ kind, browseId: bid, title: h.title || (kind === 'album' ? 'Альбом' : 'Плейлист'), sub: h.sub || (p.svc === 'spotify' ? 'Spotify' : 'Apple Music'), art: h.art || null }] }];
}

// ======================= тексты песен из сервисов =======================
// 2.0.2: формат записи — как у lyrics.js (REC_V = 2): { v, kind: 'word'|'line'|'plain', provider, source, synced|plain, srcDur, fx? }
// fx — эффекты, которые сервис отдаёт вместе с текстом: duet (время начала строк второго голоса), colors (цвета Spotify), credits (авторы)
const lyr = require('./lyrics');
const toLRC = lyr._t.toLRC, piecesToWords = lyr._t.piecesToWords;
function ttmlTime(s) {
  s = String(s || '').trim(); if (!s) return NaN;
  if (/^[\d.]+s$/.test(s)) return parseFloat(s);
  if (/^[\d.]+ms$/.test(s)) return parseFloat(s) / 1000;
  return s.split(':').map(Number).reduce((a, x) => a * 60 + x, 0);
}
const unesc = (s) => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&');
// куски <span begin end>текст</span> → слова (слоги одного слова склеиваются, как в lyrics.js)
function spansToWords(html) {
  const pieces = []; const re = /<span\b([^>]*)>([^<]*)<\/span>(\s*)/g; let m;
  while ((m = re.exec(html))) { const b = ttmlTime((m[1].match(/\bbegin="([^"]+)"/) || [])[1]); if (!isFinite(b)) continue; const e = ttmlTime((m[1].match(/\bend="([^"]+)"/) || [])[1]); pieces.push({ t: b, e: isFinite(e) ? e : undefined, s: unesc(m[2]) + (m[3] ? ' ' : '') }); }
  return piecesToWords(pieces, true);
}
// 2.0.2: TTML Apple Music → расширенный LRC. Бэк-вокал (x-bg) остаётся в строке в скобках, дуэт (второй голос) — отдельной отметкой
function ttmlParse(ttml, { bgVox = true } = {}) {
  const src = String(ttml || '');
  const credits = [...src.matchAll(/<songwriter>([^<]+)<\/songwriter>/g)].map((m) => unesc(m[1]).trim()).filter(Boolean);
  const body = (src.match(/<body\b[\s\S]*<\/body>/) || [src])[0]
    .replace(/<span[^>]*ttm:role="x-(?:translation|roman)[^"]*"[^>]*>[\s\S]*?<\/span>/g, '');
  const lines = [], duet = []; let word = false, firstAgent = null;
  for (const m of body.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/g)) {
    const beg = ttmlTime((m[1].match(/\bbegin="([^"]+)"/) || [])[1]); if (!isFinite(beg)) continue;
    const end = ttmlTime((m[1].match(/\bend="([^"]+)"/) || [])[1]);
    const agent = (m[1].match(/ttm:agent="([^"]+)"/) || [])[1] || null;
    if (agent && !firstAgent && agent !== 'v1000') firstAgent = agent;
    let inner = m[2];
    // бэк-вокал: <span ttm:role="x-bg"> … </span> — вложенные span, поэтому вырезаем вручную по глубине
    const bgs = [];
    for (let i = inner.search(/<span[^>]*ttm:role="x-bg"[^>]*>/); i >= 0; i = inner.search(/<span[^>]*ttm:role="x-bg"[^>]*>/)) {
      let depth = 0, j = i; const tag = /<\/?span\b[^>]*>/g; tag.lastIndex = i; let t;
      while ((t = tag.exec(inner))) { depth += t[0][1] === '/' ? -1 : 1; if (depth === 0) { j = tag.lastIndex; break; } }
      if (j === i) j = inner.length;
      const open = inner.slice(i).match(/^<span[^>]*>/)[0];
      bgs.push(inner.slice(i + open.length, j - 7)); inner = inner.slice(0, i) + ' ' + inner.slice(j);
    }
    let words = spansToWords(inner);
    if (words.length) word = true;
    if (bgVox) for (const b of bgs) {
      const bw = spansToWords(b); if (!bw.length) continue;
      if (!/^[([]/.test(bw[0].s)) bw[0].s = '(' + bw[0].s;
      if (!/[)\]]$/.test(bw[bw.length - 1].s)) bw[bw.length - 1].s += ')';
      // вставляем по времени; тайминги основного голоса не трогаем — бэк-вокал подстраиваем, чтобы слова шли по порядку
      const at = words.findIndex((w) => w.t > bw[0].t); const k = at < 0 ? words.length : at;
      const lo = k > 0 ? words[k - 1].t : beg, hi = k < words.length ? words[k].t : Infinity;
      bw.forEach((w) => { w.t = Math.min(hi, Math.max(lo, w.t)); if (w.e != null) w.e = Math.max(w.t, Math.min(hi, w.e)); });
      words.splice(k, 0, ...bw);
    }
    const text = words.length ? null : unesc(inner.replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
    if (!words.length && !text) continue;
    if (agent && firstAgent && agent !== firstAgent && agent !== 'v1000') duet.push(Math.round(beg * 100) / 100);
    lines.push({ t: beg, end: isFinite(end) ? end : null, words: words.length ? words : null, text: text || '' });
  }
  if (!lines.length) return null;
  // пауза больше 4 с между строками — пустая строка (проигрыш)
  const out = [];
  lines.forEach((l, i) => { out.push(l); const nx = lines[i + 1]; if (nx && l.end && nx.t - l.end > 4) out.push({ t: l.end, text: '' }); });
  return { lrc: toLRC(out), word, duet, credits };
}
const svcName = { am: 'Apple Music', sp: 'Spotify', ytm: 'YouTube Music' };
const pack = (provider, t, o) => ({ v: lyr.REC_V, provider, source: `${svcName[provider]}${o.via ? ' · ' + o.via : ''} · ${t.author} — ${t.title}`, srcDur: t.dur || 0, ...o.rec });
// трек сервиса для текста: свой id (если трек оттуда) или поиск по названию, исполнителю и длительности
async function findIn(svc, q) {
  if (svcOf(q.id) === svc) { const m = db().meta[q.id]; return { id: q.id.slice(3), dur: (m && m.dur) || q.dur, art: (m && m.art) || q.art, exact: true }; }
  const sh = await (svc === 'am' ? amSearch(`${baseTitle(q.title)} ${splitArtists(q.author)[0] || ''}`, 'songs') : spSearch(`${baseTitle(q.title)} ${splitArtists(q.author)[0] || ''}`, 'songs')).catch(() => null);
  let best = null, bs = 0;
  // 2.0.2: тексты с таймингами чужой версии (radio edit, другой мастер) уезжают — длительность должна совпадать почти точно,
  // из равных по названию берём самую близкую по длительности
  for (const c of songsOf(sh).slice(0, 10)) {
    const dd = q.dur && c.dur ? Math.abs(c.dur - q.dur) : 0; if (dd > 3) continue;
    const s = scoreCand(q, c) - dd * 0.01; if (s > bs) { bs = s; best = c; }
  }
  return bs >= 0.68 ? { id: best.id.slice(3), dur: best.dur, art: best.art } : null;
}
async function appleLyrics(q, opt) {
  if (!(await amUserToken())) return null; // тексты Apple Music отдаются только подписчикам
  const f = await findIn('am', q); if (!f) return null;
  const sf = await amSf(); let ttml = null;
  for (const rel of ['syncedLyrics', 'lyrics']) {
    const j = await amApi(`/v1/catalog/${sf}/songs/${f.id}/${rel}?l=ru-RU&extend=ttmlLocalizations`, { user: true }).catch(() => null);
    const a = j && j.data && j.data[0] && j.data[0].attributes; ttml = a && (a.ttml || a.ttmlLocalizations); if (ttml) break;
  }
  if (!ttml) return null;
  const meta = { ...q, dur: f.dur || q.dur };
  if (/itunes:timing="None"/.test(ttml) || !/<p\b[^>]*\bbegin="/.test(ttml)) {
    const plain = unesc(ttml.replace(/<head[\s\S]*?<\/head>/, '').replace(/<\/p>/g, '\n').replace(/<\/div>/g, '\n').replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '')).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    return plain ? pack('am', meta, { rec: { kind: 'plain', plain } }) : null;
  }
  const r = ttmlParse(ttml, opt); if (!r) return null;
  const fx = {}; if (r.duet.length) fx.duet = r.duet; if (r.credits.length) fx.credits = r.credits;
  return pack('am', meta, { rec: { kind: r.word ? 'word' : 'line', synced: r.lrc, ...(Object.keys(fx).length ? { fx } : {}) } });
}
const argb = (n) => (n == null ? null : '#' + ((Number(n) >>> 0) & 0xffffff).toString(16).padStart(6, '0'));
// 2.0.2: исправлена синхронизация текстов Spotify.
// Запрос — как у веб-плеера Spotify (/color-lyrics/v2/track/<id>/image/<обложка>), без обложки — старый адрес.
// Время строки — startTimeMs; конец строки — начало следующей (так считает и сам Spotify): endTimeMs у Spotify почти всегда «0».
// Строки «♪» — проигрыши. Слоги (SYLLABLE_SYNCED) — по numChars в UTF-16, как в Spotify.
// Тайминги Spotify относятся к его записи — если звук трека Spotify взят из клипа с интро, текст сдвигается
// на разницу длительностей, а при большом расхождении текст не берётся.
const spImgUrl = (art) => { const a = String(art || ''); let d = a; try { d = decodeURIComponent(a); } catch {} const m = a.match(/https?:\/\/i\.scdn\.co\/image\/[0-9a-f]+/i) || d.match(/https?:\/\/i\.scdn\.co\/image\/[0-9a-f]+/i); return m ? m[0] : null; };
async function spotifyLyrics(q, force) {
  if (!force && !(await spLoggedIn())) return null; // без входа Spotify тексты не отдаёт
  const f = await findIn('sp', q); if (!f) return null;
  const tok = await spToken(); if (!tok) return null;
  const img = spImgUrl(f.art || q.art);
  const urls = [img && `https://spclient.wg.spotify.com/color-lyrics/v2/track/${f.id}/image/${encodeURIComponent(img)}?format=json&vocalRemoval=false${tok.user ? '&market=from_token' : ''}`,
    `https://spclient.wg.spotify.com/color-lyrics/v2/track/${f.id}?format=json&vocalRemoval=false${tok.user ? '&market=from_token' : ''}`].filter(Boolean);
  let j = null;
  for (const u of urls) {
    const r = await get(u, { headers: spHeaders(tok) }).catch(() => null); if (!r) continue;
    if (r.status === 401) { spTokDrop(); return null; }
    if (r.status === 404) return null; // у трека нет текста
    if (r.ok) { j = await r.json().catch(() => null); if (j) break; }
  }
  const L = j && j.lyrics; if (!L) return null;
  if (L.capStatus === 'CAPPED' && (!Array.isArray(L.lines) || L.lines.length <= (L.previewLines || []).length)) return null; // бесплатный аккаунт: только превью — берём текст из других баз
  const raw = (Array.isArray(L.lines) ? L.lines : []).map((l) => ({ ms: Number(l.startTimeMs) || 0, end: Number(l.endTimeMs) || 0, words: String(l.words == null ? '' : l.words), syl: Array.isArray(l.syllables) ? l.syllables : [] }));
  if (!raw.length) return null;
  const meta = { ...q, dur: f.dur || q.dur }, via = L.providerDisplayName || '';
  const fx = {}; if (j.colors) fx.colors = { bg: argb(j.colors.background), text: argb(j.colors.text), hi: argb(j.colors.highlightText) };
  const extra = fx.colors ? { fx } : {};
  const isBreak = (w) => !w.trim() || /^[\s♪♫…·.]+$/.test(w);
  if (L.syncType === 'UNSYNCED' || !raw.some((l) => l.ms > 0)) return pack('sp', meta, { via, rec: { kind: 'plain', plain: raw.map((l) => (isBreak(l.words) ? '' : l.words.trim())).join('\n').replace(/\n{3,}/g, '\n\n').trim(), ...extra } });
  // сдвиг под длину записи, из которой реально звучит трек (для треков Spotify — найденная запись YouTube Music)
  let shift = 0;
  const audioDur = svcOf(q.id) === 'sp' ? ((db().match[q.id] || {}).dur || 0) : q.dur || 0;
  if (audioDur && f.dur) { const d = audioDur - f.dur; if (Math.abs(d) > 20) return null; if (d > 3) shift = d; } // звук из клипа: лишнее время — интро в начале
  raw.sort((a, b) => a.ms - b.ms);
  let word = false;
  const lines = [];
  raw.forEach((l, i) => {
    const t = l.ms / 1000 + shift; const nx = raw[i + 1]; const nextT = nx ? nx.ms / 1000 + shift : null;
    if (isBreak(l.words)) { lines.push({ t, text: '' }); return; }
    const txt = l.words.trim();
    if (l.syl.length) { // по слогам: начало слога и число символов (UTF-16)
      const pieces = []; let pos = 0; const str = l.words;
      l.syl.forEach((sy, k) => { const n = Number(sy.numChars) || 0; const piece = str.slice(pos, pos + n); pos += n; const tail = k === l.syl.length - 1 ? str.slice(pos) : ''; pieces.push({ t: (Number(sy.startTimeMs ?? sy.startMs) || l.ms) / 1000 + shift, e: Number(sy.endTimeMs) ? Number(sy.endTimeMs) / 1000 + shift : undefined, s: piece + tail }); });
      const words = piecesToWords(pieces, true);
      if (words.length) {
        word = true; const last = words[words.length - 1];
        if (last.e == null) last.e = l.end ? l.end / 1000 + shift : nextT != null ? Math.min(nextT, last.t + 1.5) : last.t + 1.2;
        lines.push({ t, words, text: txt }); return;
      }
    }
    lines.push({ t, text: txt });
    // длинный проигрыш после строки (а «♪» Spotify не поставил) — пауза, чтобы строка не «висела»
    if (l.end && nextT != null && nextT - l.end / 1000 - shift > 4) lines.push({ t: l.end / 1000 + shift, text: '' });
  });
  if (lines.filter((l) => l.text).length < 2) return null;
  return pack('sp', meta, { via, rec: { kind: word ? 'word' : 'line', synced: toLRC(lines), ...extra } });
}
// YouTube Music: синхронизированный текст (тот же запрос, что делает приложение YouTube Music на телефоне); иначе — обычный
const YT_ANDROID = { clientName: 'ANDROID_MUSIC', clientVersion: '7.27.52', androidSdkVersion: 30, hl: 'en', gl: 'US' };
async function ytmLyrics(q) {
  let vid = q.id;
  if (isSvc(vid)) { vid = cachedYt(vid) || await ytFor(vid).catch(() => null); }
  else if (!/^[\w-]{11}$/.test(vid || '')) vid = null;
  if (!vid) return null;
  const n = await ytm.next(vid).catch(() => null); const bid = n && n.lyricsId; if (!bid) return null;
  const r = await get('https://music.youtube.com/youtubei/v1/browse?prettyPrint=false', { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': `com.google.android.apps.youtube.music/${YT_ANDROID.clientVersion} (Linux; U; Android 11) gzip`, Origin: 'https://music.youtube.com' }, body: JSON.stringify({ context: { client: YT_ANDROID }, browseId: bid }) }).catch(() => null);
  let data = null, via = null;
  const j = r && r.ok ? await r.json().catch(() => null) : null;
  if (j) {
    (function w(x, d) { if (data || !x || typeof x !== 'object' || d > 40) return; if (Array.isArray(x.timedLyricsData)) { data = x.timedLyricsData; const s = x.sourceMessage || (x.footer && x.footer.text); if (typeof s === 'string') via = s; return; } for (const k in x) w(x[k], d + 1); })(j.contents, 0);
    if (!via) { const m = JSON.stringify(j.contents || {}).match(/"(?:Source|Источник): ([^"]{2,60})"/); if (m) via = m[1]; }
  }
  via = via ? String(via).replace(/^(Source|Источник):\s*/i, '') : '';
  if (data && data.length) {
    const ls = data.filter((l) => l && l.cueRange).map((l) => ({ t: +l.cueRange.startTimeMilliseconds / 1000, e: +l.cueRange.endTimeMilliseconds / 1000, text: /^\s*♪\s*$/.test(l.lyricLine || '') ? '' : String(l.lyricLine || '').trim() }));
    if (ls.filter((l) => l.text).length >= 2) {
      const out = []; ls.forEach((l, i) => { out.push(l); const nx = ls[i + 1]; if (l.text && nx && nx.text && nx.t - l.e > 4) out.push({ t: l.e, text: '' }); });
      return pack('ytm', q, { via, rec: { kind: 'line', synced: toLRC(out) } });
    }
  }
  const y = await ytm.ytLyrics(bid).catch(() => null);
  return y && y.plain ? pack('ytm', q, { via: y.source || via, rec: { kind: 'plain', plain: y.plain } }) : null;
}
const KIND_RANK = { word: 0, line: 1, plain: 2 };
const better = (a, b) => (!a ? b : !b ? a : (KIND_RANK[b.kind] ?? 9) < (KIND_RANK[a.kind] ?? 9) ? b : a);
// mode: 'am' | 'sp' | 'yt' — только этот сервис; 'auto' — все доступные, лучший по синхронизации (по словам > по строкам > без времени)
async function lyricsFor(q, mode = 'auto', opt = {}) {
  if (!q || !q.title) return null;
  const meta = db().meta[q.id];
  q = { ...q, title: q.title || (meta && meta.title), author: q.author || (meta && meta.author) || '', dur: q.dur || (meta && meta.dur) || 0 };
  const lim = (p, ms) => Promise.race([p.catch((e) => { console.error('lyrics', e.message); return null; }), sleep(ms).then(() => null)]);
  if (mode === 'am') return lim(appleLyrics(q, opt), 20000);
  if (mode === 'sp') return lim(spotifyLyrics(q, true), 30000);
  if (mode === 'yt') return lim(ytmLyrics(q), 20000);
  // по умолчанию сначала сервис, из которого трек (его тексты точно совпадают по времени)
  const order = { am: ['am', 'sp', 'ytm'], sp: ['sp', 'am', 'ytm'] }[svcOf(q.id)] || ['am', 'sp', 'ytm'];
  const res = await Promise.all(order.map((k) => (k === 'am' ? lim(appleLyrics(q, opt), 20000) : k === 'sp' ? lim(spotifyLyrics(q, false), 30000) : lim(ytmLyrics(q), 20000))));
  return res.reduce((a, b) => better(a, b), null);
}

// ======================= вход в Apple Music / Spotify =======================
let loginWin = null;
function login(parent, svc) {
  if (!electron) return Promise.resolve({ error: 'нет Electron' });
  if (loginWin && !loginWin.isDestroyed()) { loginWin.focus(); return Promise.resolve({ error: 'Окно входа уже открыто' }); }
  const isSp = svc === 'sp', part = isSp ? SP_PART : AM_PART;
  const url = isSp ? 'https://accounts.spotify.com/login?continue=' + encodeURIComponent('https://open.spotify.com/') : 'https://music.apple.com/login';
  return new Promise((resolve) => {
    const w = (loginWin = new electron.BrowserWindow({ width: 520, height: 760, parent: parent || undefined, title: isSp ? 'Вход в Spotify' : 'Вход в Apple Music', autoHideMenuBar: true, backgroundColor: '#111', webPreferences: { partition: part, contextIsolation: true, sandbox: true } }));
    w.webContents.setAudioMuted(true);
    // всплывающие окна входа (Apple ID, Google, Facebook) — дочерние, с той же сессией
    w.webContents.setWindowOpenHandler(({ url: u }) => (/^https:\/\/([\w-]+\.)*(apple\.com|spotify\.com|icloud\.com|google\.com|facebook\.com)\//.test(u)
      ? { action: 'allow', overrideBrowserWindowOptions: { parent: w, width: 520, height: 700, autoHideMenuBar: true, webPreferences: { partition: part, contextIsolation: true, sandbox: true } } } : { action: 'deny' }));
    w.loadURL(url, { userAgent: UA }).catch(() => {});
    let done = false;
    const finish = (r) => { if (done) return; done = true; clearInterval(poll); try { if (!w.isDestroyed()) w.destroy(); } catch {} loginWin = null; resolve(r); };
    const poll = setInterval(async () => {
      const ok = isSp ? await spLoggedIn() : !!(await amUserToken());
      if (ok) { clearInterval(poll); if (isSp) spTokDrop(); else amSfUser = null; setTimeout(() => finish({ ok: true }), isSp ? 1500 : 2500); }
    }, 1500);
    w.on('closed', () => finish({ ok: false }));
  });
}
// 2.0.2: вход в Spotify из настоящего браузера (Google не пускает во встроенное окно) — cookies кладём в сессию Spotify
async function spImport(cs) {
  const s = ses(SP_PART); if (!s || !cs || !cs.length) return false;
  await s.clearStorageData({ storages: ['cookies'] }).catch(() => {});
  await require('./account').importCdpCookies(cs, s);
  spTokDrop();
  if (!(await spLoggedIn())) return false;
  const t = await spToken(true).catch(() => null); if (!t || !t.access) return false;
  // вход засчитывается, только если Spotify узнал аккаунт (иначе — устаревшие cookies)
  const me = await spMe(); if (me === false) { await s.clearStorageData({ storages: ['cookies'] }).catch(() => {}); spTokDrop(); return false; }
  return true;
}
// профиль Spotify: { name } | false — не вошли | null — не удалось проверить
async function spMe() {
  try { const r = await spGql('profileAttributes', {}); if (!r) return null; const p = r.me && r.me.profile; return r.me ? { name: (p && (p.name || p.username)) || '' } : false; } catch { return null; }
}
async function logout(svc) {
  const s = ses(svc === 'sp' ? SP_PART : AM_PART); if (!s) return true;
  await s.clearStorageData().catch(() => {}); await s.clearCache().catch(() => {});
  if (svc === 'sp') spTokDrop(); else amSfUser = null;
  return true;
}
async function status() {
  const [sp, am] = await Promise.all([spLoggedIn(), amUserToken().then(Boolean)]);
  let spName = null; if (sp) { const m = await spMe(); spName = m && m.name; if (!spName) { try { const j = await spApi('/me', { user: true }); spName = j && (j.display_name || j.id); } catch {} } }
  return { sp: { user: sp, name: spName }, am: { user: am, sf: am ? await amSf().catch(() => null) : null } };
}
// ======================= 2.0.3: менеджер аккаунтов Apple Music / Spotify =======================
// У каждого сервиса — свой список аккаунтов (отдельно от YouTube Music): userData/accounts-sp.json и accounts-am.json.
// Аккаунт = снимок cookies сессии сервиса, зашифрованный средствами ОС (safeStorage), если доступно.
const SACC_DOM = { sp: /(^|\.)spotify\.com$/, am: /(^|\.)apple\.com$|(^|\.)icloud\.com$/ };
const sPart = (s) => (s === 'sp' ? SP_PART : AM_PART);
const sAccFile = (s) => path.join(app.getPath('userData'), `accounts-${s === 'sp' ? 'sp' : 'am'}.json`);
const sSafe = () => electron && electron.safeStorage;
function sAccRead(s) {
  try {
    const raw = JSON.parse(fs.readFileSync(sAccFile(s), 'utf8')), ss = sSafe();
    (raw.list || []).forEach((a) => { if (a.enc && ss && ss.isEncryptionAvailable()) { try { a.cookies = JSON.parse(ss.decryptString(Buffer.from(a.enc, 'base64'))); } catch { a.cookies = []; } } });
    const list = raw.list || []; return { active: list.some((a) => a.id === raw.active) ? raw.active : null, list };
  } catch { return { active: null, list: [] }; }
}
function sAccWrite(s, d) {
  const ss = sSafe(), enc = ss && ss.isEncryptionAvailable();
  const out = { active: d.active, list: d.list.map((a) => { const o = { id: a.id, name: a.name, photo: a.photo || null, added: a.added, used: a.used, custom: !!a.custom }; if (enc) o.enc = ss.encryptString(JSON.stringify(a.cookies || [])).toString('base64'); else o.cookies = a.cookies || []; return o; }) };
  try { atomicJSON(sAccFile(s), out); } catch (e) { console.error(e); }
}
const sPub = (d) => ({ active: d.active, list: d.list.map((a) => ({ id: a.id, name: a.name, photo: a.photo, used: a.used, active: a.id === d.active })) });
async function sCookies(s) { const S = ses(sPart(s)); if (!S) return []; return (await S.cookies.get({})).filter((c) => SACC_DOM[s].test(String(c.domain).replace(/^\./, ''))); }
async function sUser(s) { return s === 'sp' ? spLoggedIn() : !!(await amUserToken()); }
function sReset(s) { if (s === 'sp') spTokDrop(); else amSfUser = null; }
function sIdOf(s, cs) { const c = cs.find((x) => x.name === (s === 'sp' ? 'sp_dc' : 'media-user-token') && x.value); return c ? require('crypto').createHash('sha1').update(c.value).digest('hex').slice(0, 12) : null; }
async function sInfo(s) {
  if (s === 'sp') {
    const m = await spMe(); if (m === false) return null;
    let name = m && m.name; if (!name) { try { const j = await spApi('/me', { user: true }); name = j && (j.display_name || j.id); } catch {} }
    let photo = null; try { const j = await spApi('/me', { user: true, retry: false }); photo = j && spImg(j.images, 64); } catch {}
    return { name: name || 'Аккаунт Spotify', photo };
  }
  const sf = await amSf().catch(() => null);
  return { name: 'Apple ID' + (sf ? ' · ' + String(sf).toUpperCase() : ''), photo: null };
}
async function sApply(s, cs) {
  const S = ses(sPart(s));
  for (const c of cs || []) {
    const host = String(c.domain).replace(/^\./, '');
    const o = { url: `https://${host}${c.path || '/'}`, path: c.path || '/', secure: !!c.secure, httpOnly: !!c.httpOnly, name: c.name, value: c.value };
    if (!c.hostOnly) o.domain = c.domain; if (c.expirationDate) o.expirationDate = c.expirationDate; if (c.sameSite && c.sameSite !== 'unspecified') o.sameSite = c.sameSite;
    try { await S.cookies.set(o); } catch {}
  }
}
async function accSnapshot(s) {
  const d = sAccRead(s); if (!(await sUser(s))) return sPub(d);
  const cs = await sCookies(s), id = sIdOf(s, cs); if (!id) return sPub(d);
  const info = await sInfo(s).catch(() => null); if (!info) return sPub(d);
  let a = d.list.find((x) => x.id === id) || d.list.find((x) => x.id === d.active && !x.cookies?.length);
  if (!a) { a = { id, added: Date.now() }; d.list.push(a); }
  a.id = id; a.cookies = cs; a.used = Date.now(); if (!a.custom) a.name = info.name; if (info.photo) a.photo = info.photo;
  d.list = d.list.filter((x) => x === a || x.id !== id); d.active = id; sAccWrite(s, d); return sPub(d);
}
async function accSwitch(s, id) {
  await accSnapshot(s).catch(() => {});
  const d = sAccRead(s), a = d.list.find((x) => x.id === id); if (!a) throw new Error('Аккаунт не найден');
  const S = ses(sPart(s)); await S.clearStorageData({ storages: ['cookies'] }).catch(() => {});
  await sApply(s, a.cookies); sReset(s);
  if (!(await sUser(s))) throw new Error('Вход в этот аккаунт устарел — войди заново');
  d.active = a.id; a.used = Date.now(); sAccWrite(s, d); return sPub(d);
}
const sPrev = {};
async function accAddNew(s) {
  await accSnapshot(s).catch(() => {}); sPrev[s] = sAccRead(s).active;
  await ses(sPart(s)).clearStorageData({ storages: ['cookies'] }).catch(() => {}); sReset(s);
  const d = sAccRead(s); d.active = null; sAccWrite(s, d); return sPub(d);
}
async function accRestore(s) {
  if (await sUser(s)) { sPrev[s] = null; return accSnapshot(s); }
  const id = sPrev[s]; sPrev[s] = null; if (!id) return sPub(sAccRead(s));
  try { return await accSwitch(s, id); } catch { return sPub(sAccRead(s)); }
}
async function accRemove(s, id) {
  const d = sAccRead(s), was = d.active === id; d.list = d.list.filter((x) => x.id !== id);
  if (was) { d.active = null; await logout(s); }
  sAccWrite(s, d); return sPub(d);
}
function accRename(s, id, name) { const d = sAccRead(s), a = d.list.find((x) => x.id === id); if (a && name) { a.name = String(name).slice(0, 60); a.custom = true; sAccWrite(s, d); } return sPub(d); }
const accList = (s) => sPub(sAccRead(s));
const svcAcc = { list: accList, snapshot: accSnapshot, switchTo: accSwitch, addNew: accAddNew, restore: accRestore, remove: accRemove, rename: accRename };

async function searchAny(s, q, f) { const l = await searchLink(q).catch(() => null); return l || search(s, q, f); }

module.exports = { setYtm, isSvc, svcOf, ytFor, cachedYt, aliasesOf, feed, browse, search: searchAny, suggest, next, related, like, dislike, playlists, link,
  playlistArtwork, lyricsFor, login, logout, status, spImport, setAppleRegion, flush, svcAcc,
  _test: { spCapture, spToken, spGql, db, spRefreshHashes, matchOne, scoreCand, ttmlParse, ytmLyrics, appleLyrics, spotifyLyrics, baseTitle, norm, sim, artistSim, parseLink, trackMeta } };
