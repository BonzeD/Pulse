'use strict';
// Pulse 2.0: тексты песен — источники, выбор лучшего варианта, единый формат.
// Источники (опрашиваются параллельно):
//   • Musixmatch — пословная синхронизация (richsync), строки (subtitles), обычный текст;
//   • NetEase Cloud Music — пословная (YRC) и построчная синхронизация;
//   • LRCLIB — построчная синхронизация и обычный текст.
// Результат — одна запись { v, kind, synced | plain | instrumental, source, provider, srcDur, stretch? }.
// synced — «расширенный» LRC: [mm:ss.xx] у строки и <mm:ss.xx> у каждого слова (а пустой тег после слова — его конец).
// Такой текст понимают корректор, ручная правка, офлайн-кэш и виджет — отдельный формат не нужен.
const { app } = require('electron');
const fs = require('fs'); const path = require('path');

const REC_V = 2; // версия записи: при росте старые тексты один раз перепроверяются
const T_OUT = 7000;
const get = async (url, opt = {}) => {
  const r = await fetch(url, { ...opt, signal: AbortSignal.timeout(opt.timeout || T_OUT) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
};

// ---------- нормализация названий ----------
const VER = /\b(slowed|slow(?:ed)?\s*\+?\s*reverb|sped\s*up|speed\s*up|nightcore|daycore|reverb|ultra\s*slowed|super\s*slowed|замедл\w*|ускор\w*)\b/i;
const VER_SLOW = /slow|daycore|замедл/i, VER_FAST = /sped|speed|nightcore|ускор/i;
function clean(s) {
  return String(s || '').replace(/\[[^\]]*\]|\([^)]*\)|【[^】]*】/g, ' ')
    .replace(/\b(official|music|video|lyric[s]?|audio|visualizer|mv|hd|4k|клип|премьера)\b/gi, ' ')
    .replace(VER, ' ').replace(/\s*[-–—]\s*$/, '')
    .replace(/\s*(feat\.?|ft\.?|prod\.?)\s.*$/i, '').replace(/[|｜].*$/, '').replace(/["“”«»]/g, '').replace(/\s+/g, ' ').trim();
}
const norm = (x) => String(x || '').toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, '');
// транслит: Musixmatch часто пишет русских исполнителей латиницей («Korol i Shut»)
const TR = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', і: 'i', ї: 'i', є: 'e', ґ: 'g' };
const lat = (x) => norm(x).replace(/[а-яіїєґ]/g, (c) => TR[c] ?? c).replace(/kh/g, 'h').replace(/[yj]/g, 'i');
const near = (a, b) => !!a && !!b && (a === b || a.includes(b) || b.includes(a));
function artOk(a, b) { return near(norm(a), norm(b)) || near(lat(a), lat(b)); }
function trkOk(a, b) { a = clean(a); b = clean(b); return near(norm(a), norm(b)) || near(lat(a), lat(b)); }
// 2.0.4-fix: «умное» название: «Casey Edwards Bury the Light - Vergil's battle theme from DMC5 [OFFICIAL AUDIO]» → «Bury the Light».
// Убираем скобки и служебные слова, имя исполнителя в начале названия, а из «А - Б» берём часть, которая не исполнитель.
function smartTitle(title, author) {
  const a = String(author || '').replace(/VEVO$|\s*-\s*Topic$|Official$/i, '').trim();
  let s = clean(title); const an = norm(a);
  if (a) { const re = new RegExp('^\\s*' + a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*[-–—:|]?\\s*', 'i'); s = s.replace(re, ''); }
  const parts = s.split(/\s+[-–—]\s+/).map((x) => x.trim()).filter(Boolean);
  if (parts.length > 1) { const rest = parts.filter((x) => !an || norm(x) !== an); s = (!a && parts.length === 2 ? parts[1] : rest[0]) || parts[0]; }
  return { track: s.trim(), artist: a || (parts.length === 2 ? parts[0] : '') };
}
// варианты «исполнитель / название»: из полей трека и из заголовка вида «Артист - Трек»
function variants(title, author) {
  title = String(title || ''); author = String(author || '');
  const a0 = author.replace(/VEVO$|\s*-\s*Topic$|Official$/i, '').trim();
  const version = (title.match(VER) || author.match(VER) || [])[0] || null;
  const out = [], dash = title.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (dash && !VER.test(dash[2]) && !/^(remix|edit|version|mix)$/i.test(dash[2].trim())) out.push({ artist: dash[1], track: dash[2] });
  out.push({ artist: a0, track: dash && VER.test(dash[2]) ? dash[1] : title });
  { const sm = smartTitle(title, author); if (sm.track && sm.artist) out.unshift({ artist: sm.artist, track: sm.track }); } // 2.0.4-fix: самый вероятный вариант — первым
  const seen = new Set();
  const list = out.map((v) => ({ artist: clean(v.artist.split(/,|&| x | и | feat/i)[0]), track: clean(v.track) }))
    .filter((v) => v.track && !seen.has(v.artist + '|' + v.track) && seen.add(v.artist + '|' + v.track));
  return { version, list };
}

// ---------- общий формат ----------
// piece = { t, e?, s } — кусок текста со временем начала (и конца). Куски без пробела между ними — одно слово (слоги, знаки).
// glue=false (NetEase): каждый кусок — отдельное слово, к предыдущему приклеиваются только знаки препинания
function piecesToWords(pieces, glue = true) {
  const W = [];
  for (const p of pieces) {
    const s = String(p.s || ''); if (!s) continue;
    if (!s.trim()) { if (W.length) W[W.length - 1].sp = true; continue; }
    const last = W[W.length - 1], lead = /^\s/.test(s), punct = !/[\p{L}\p{N}]/u.test(s);
    if (last && !last.sp && !lead && (glue || punct)) { last.s += s.trimEnd(); if (p.e != null) last.e = p.e; if (/\s$/.test(s)) last.sp = true; continue; }
    W.push({ t: p.t, e: p.e, s: s.trim(), sp: /\s$/.test(s) });
  }
  return W.filter((w) => w.s).map((w) => ({ t: w.t, e: w.e, s: w.s }));
}
const fmtT = (s) => { s = Math.max(0, s || 0); const m = Math.floor(s / 60), x = s - m * 60; return `${String(m).padStart(2, '0')}:${x.toFixed(2).padStart(5, '0')}`; };
// lines: [{ t, text, words?: [{ t, e?, s }] }] → расширенный LRC
function toLRC(lines) {
  return lines.map((l) => {
    if (!l.words || !l.words.length) return `[${fmtT(l.t)}]${l.text || ''}`;
    let s = `[${fmtT(l.t)}]`;
    l.words.forEach((w, i) => {
      const nx = l.words[i + 1];
      s += `<${fmtT(w.t)}>${w.s}`;
      if (w.e != null && (!nx || nx.t - w.e > 0.04)) s += `<${fmtT(w.e)}>`;
      if (nx) s += ' ';
    });
    return s;
  }).join('\n');
}
const lrcCount = (s) => (String(s || '').match(/^\s*\[\d+:\d/gm) || []).length;
const CREDIT = /作词|作曲|编曲|制作|混音|母带|录音|出品|监制|吉他|和声|纯音乐|贝斯|鼓|弦乐|人声|统筹|企划|发行|Lyricist|Composer|Arranger|Producer|Mixing|Mastering|Lyrics by|Music by|Written by/i;

// ---------- LRCLIB ----------
const LR_H = { 'User-Agent': 'Pulse Player 2.0 (https://github.com/scada/pulse)' };
async function lrclibGet(v, dur) {
  try { return await get('https://lrclib.net/api/get?' + new URLSearchParams({ track_name: v.track, artist_name: v.artist, ...(dur ? { duration: Math.round(dur) } : {}) }), { headers: LR_H }); } catch { return null; }
}
async function lrclibSearch(params) { try { const j = await get('https://lrclib.net/api/search?' + new URLSearchParams(params), { headers: LR_H }); return Array.isArray(j) ? j : []; } catch { return []; } }
async function lrclib(list, dur) {
  const res = [];
  // точный запрос по исполнителю + названию + длительности — самый надёжный и быстрый
  const exact = await Promise.all(list.map((v) => (v.artist ? lrclibGet(v, dur) : null)));
  exact.forEach((r) => r && r.id && res.push(r));
  if (!res.some((r) => r.syncedLyrics)) {
    const more = await Promise.all([...list.map((v) => lrclibSearch({ track_name: v.track, artist_name: v.artist })), lrclibSearch({ q: `${list[0].artist} ${list[0].track}`.trim() })]);
    more.forEach((a) => res.push(...a));
  }
  const seen = new Set();
  return res.filter((r) => r && !seen.has(r.id) && seen.add(r.id)).map((r) => ({
    provider: 'lrclib', id: 'lr' + r.id, artist: r.artistName, track: r.trackName, album: r.albumName, dur: r.duration || 0,
    kind: r.syncedLyrics ? 'line' : r.plainLyrics ? 'plain' : r.instrumental ? 'instrumental' : null,
    synced: r.syncedLyrics || null, plain: r.plainLyrics || null
  })).filter((c) => c.kind);
}

// ---------- NetEase ----------
const NE_H = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', Referer: 'https://music.163.com/' };
async function neSearch(q, limit = 8) { try { const j = await get('https://music.163.com/api/search/get?' + new URLSearchParams({ s: q, type: 1, limit }), { headers: NE_H }); return (j.result && j.result.songs) || []; } catch { return []; } }
// YRC: [начало,длина](начало,длина,0)слово(…)слово  — время в мс
function parseYrc(y) {
  const lines = [];
  for (const raw of String(y || '').split(/\r?\n/)) {
    const m = raw.match(/^\[(\d+),(\d+)\](.*)$/); if (!m) continue;
    const pieces = [...m[3].matchAll(/\((\d+),(\d+),\d+\)([^(]*)/g)].map((x) => ({ t: +x[1] / 1000, e: (+x[1] + +x[2]) / 1000, s: x[3] }));
    const words = piecesToWords(pieces, false), text = words.map((w) => w.s).join(' ');
    if (!words.length || CREDIT.test(text)) continue;
    lines.push({ t: +m[1] / 1000, text, words });
  }
  return lines;
}
async function neLyric(id) {
  try {
    const j = await get(`https://music.163.com/api/song/lyric/v1?id=${id}&lv=0&kv=0&tv=0&yv=1&rv=0`, { headers: NE_H });
    const yrc = parseYrc(j.yrc && j.yrc.lyric);
    if (yrc.length >= 4) return { kind: 'word', synced: toLRC(yrc) };
    const lrc = String((j.lrc && j.lrc.lyric) || '').split(/\r?\n/).filter((l) => /^\[\d+:\d/.test(l) && !CREDIT.test(l)).join('\n');
    if (lrcCount(lrc) >= 4) return { kind: 'line', synced: lrc };
    if (j.nolyric || j.pureMusic) return { kind: 'instrumental' };
  } catch {}
  return null;
}
async function netease(list, dur, version, max = 2) {
  const qs = [...new Set(list.flatMap((v) => [`${v.artist} ${v.track}`.trim(), v.track]))].slice(0, 3);
  const songs = (await Promise.all(qs.map((q) => neSearch(q)))).flat();
  const uniq = songs.filter((x, i, a) => x && a.findIndex((y) => y.id === x.id) === i);
  const cands = uniq.map((x) => ({ x, sc: matchScore({ artist: (x.artists || []).map((a) => a.name).join(', '), track: x.name, dur: (x.duration || 0) / 1000 }, list, dur, version) }))
    .filter((c) => c.sc < 60).sort((a, b) => a.sc - b.sc).slice(0, max);
  const out = [];
  for (const { x } of cands) {
    const l = await neLyric(x.id); if (!l || l.kind === 'instrumental') continue;
    out.push({ provider: 'ne', id: 'ne' + x.id, artist: (x.artists || []).map((a) => a.name).join(', '), track: x.name, album: x.album && x.album.name, dur: (x.duration || 0) / 1000, ...l });
    if (l.kind === 'word') break;
  }
  return out;
}

// ---------- Musixmatch ----------
const MX = 'https://apic.musixmatch.com/ws/1.1/', MX_APP = 'mac-ios-v2.0', MX_H = { 'User-Agent': 'Musixmatch/2025 CFNetwork Darwin', Cookie: 'AWSELB=0; AWSELBCORS=0' };
let mxTok = null, mxTokAt = 0, mxBlockUntil = 0, mxTokP = null;
const mxFile = () => path.join(app.getPath('userData'), 'mxm.json');
function mxLoad() { if (mxTok) return; try { const j = JSON.parse(fs.readFileSync(mxFile(), 'utf8')); if (j.t && Date.now() - j.at < 7 * 864e5) { mxTok = j.t; mxTokAt = j.at; } } catch {} }
async function mxToken(fresh) {
  mxLoad(); if (mxTok && !fresh) return mxTok;
  if (Date.now() < mxBlockUntil) return null;
  if (mxTokP) return mxTokP;
  mxTokP = (async () => {
    try {
      const j = await get(`${MX}token.get?app_id=${MX_APP}&format=json`, { headers: MX_H });
      const t = j.message && j.message.body && j.message.body.user_token;
      if (!t || /^0+$/.test(t)) { mxBlockUntil = Date.now() + 10 * 60e3; return null; }
      mxTok = t; mxTokAt = Date.now(); try { fs.writeFileSync(mxFile(), JSON.stringify({ t, at: mxTokAt })); } catch {}
      return t;
    } catch { mxBlockUntil = Date.now() + 2 * 60e3; return null; } finally { mxTokP = null; }
  })();
  return mxTokP;
}
async function mxCall(method, params, retry = true) {
  const tok = await mxToken(); if (!tok) return null;
  const j = await get(`${MX}${method}?` + new URLSearchParams({ app_id: MX_APP, usertoken: tok, format: 'json', ...params }), { headers: MX_H }).catch(() => null);
  const h = j && j.message && j.message.header; if (!h) return null;
  if (h.status_code === 401 && retry) { mxTok = null; if (h.hint === 'captcha') { mxBlockUntil = Date.now() + 10 * 60e3; return null; } await mxToken(true); return mxCall(method, params, false); }
  return h.status_code === 200 ? j.message.body : null;
}
function parseRichsync(body) {
  let arr; try { arr = JSON.parse(body); } catch { return []; }
  return (Array.isArray(arr) ? arr : []).map((l) => {
    const pieces = (l.l || []).map((c) => ({ t: l.ts + (+c.o || 0), s: c.c }));
    // конец слова = начало следующего пробела/куска, у последнего — конец строки
    for (let i = 0; i < pieces.length; i++) pieces[i].e = i + 1 < pieces.length ? pieces[i + 1].t : l.te;
    const words = piecesToWords(pieces);
    return { t: l.ts, text: (l.x || words.map((w) => w.s).join(' ')).trim(), words };
  }).filter((l) => l.words.length);
}
const mxPlain = (s) => String(s || '').replace(/\n*\*{3,}[\s\S]*$/, '').trim();
async function mxTrack(tr, dur) {
  const id = { commontrack_id: tr.commontrack_id };
  const base = { provider: 'mxm', id: 'mx' + tr.commontrack_id, artist: tr.artist_name, track: tr.track_name, album: tr.album_name, dur: tr.track_length || 0 };
  if (tr.instrumental) return { ...base, kind: 'instrumental' };
  if (tr.has_richsync) {
    const b = await mxCall('track.richsync.get', { ...id, ...(dur ? { f_richsync_length: Math.round(dur), f_richsync_length_max_deviation: 3 } : {}) });
    const rs = b && b.richsync; const lines = rs && !rs.restricted ? parseRichsync(rs.richsync_body) : [];
    if (lines.length >= 4) return { ...base, dur: rs.richsync_length || base.dur, kind: 'word', synced: toLRC(lines) };
  }
  if (tr.has_subtitles) {
    const b = await mxCall('track.subtitle.get', { ...id, subtitle_format: 'lrc', ...(dur ? { f_subtitle_length: Math.round(dur), f_subtitle_length_max_deviation: 3 } : {}) });
    const sb = b && b.subtitle; const lrc = sb && !sb.restricted ? String(sb.subtitle_body || '').split(/\r?\n/).filter((l) => /^\[\d+:\d/.test(l)).join('\n') : '';
    if (lrcCount(lrc) >= 4) return { ...base, dur: sb.subtitle_length || base.dur, kind: 'line', synced: lrc };
  }
  if (tr.has_lyrics) {
    const b = await mxCall('track.lyrics.get', id); const ly = b && b.lyrics;
    const txt = ly && !ly.restricted ? mxPlain(ly.lyrics_body) : '';
    if (txt.split('\n').length >= 4) return { ...base, kind: 'plain', plain: txt };
  }
  return null;
}
async function musixmatch(list, dur) {
  for (const v of list) {
    if (!v.artist) continue;
    const b = await mxCall('matcher.track.get', { q_track: v.track, q_artist: v.artist, ...(dur ? { q_duration: Math.round(dur) } : {}) });
    const tr = b && b.track; if (!tr) continue;
    if (!trkOk(v.track, tr.track_name) || !artOk(v.artist, tr.artist_name)) continue;
    const r = await mxTrack(tr, dur).catch(() => null); if (r) return [r];
  }
  return [];
}
async function mxSearch(q, n = 4, v) {
  const b = await mxCall('track.search', { ...(v && v.artist ? { q_track: v.track, q_artist: v.artist } : { q }), page_size: 10, s_track_rating: 'desc', f_has_lyrics: 1 }); const L = (b && b.track_list) || [];
  const out = [];
  for (const { track } of L.slice(0, n)) { const r = await mxTrack(track, 0).catch(() => null); if (r) out.push(r); }
  return out;
}

// ---------- выбор лучшего ----------
// чем меньше, тем лучше; ≥ 100 — другой исполнитель
function matchScore(c, list, dur, version) {
  const arts = list.map((v) => v.artist).filter(Boolean);
  const am = !arts.length || arts.some((a) => artOk(a, c.artist)) ? 0 : 100;
  const tm = list.some((v) => trkOk(v.track, c.track)) ? 0 : 40;
  let dd = 0;
  if (dur && c.dur) {
    const k = dur / c.dur;
    if (version) dd = (VER_SLOW.test(version) ? k > 0.98 && k < 1.6 : VER_FAST.test(version) ? k > 0.62 && k < 1.02 : k > 0.62 && k < 1.6) ? 0 : 60;
    else { const d = Math.abs(c.dur - dur); dd = d <= 2 ? 0 : d <= 5 ? (d - 2) * 3 : d <= 10 ? 9 + (d - 5) * 6 : 70; }
  }
  return am + tm + dd;
}
const KIND_RANK = { word: 0, line: 1, plain: 2, instrumental: 3 };
function pack(c, dur, version) {
  const name = { mxm: 'Musixmatch', ne: 'NetEase', lrclib: 'LRCLIB' }[c.provider] || c.provider;
  const o = { v: REC_V, kind: c.kind, provider: c.provider, source: `${name} · ${c.artist} — ${c.track}`, srcDur: c.dur || 0 };
  if (c.kind === 'instrumental') return { v: REC_V, instrumental: true, source: o.source, provider: c.provider };
  if (c.synced) o.synced = c.synced; else o.plain = c.plain;
  if (version && dur && c.dur) { const k = Math.round((dur / c.dur) * 1000) / 1000; if (Math.abs(k - 1) > 0.03 && k > 0.6 && k < 1.7) o.stretch = k; }
  return o;
}
async function getLyrics({ title, author, dur, prefer }) {
  const { version, list } = variants(title, author); if (!list.length) return null;
  const settle = (p) => p.catch(() => []);
  const [mx, ne, lr] = await Promise.all([settle(musixmatch(list, dur)), settle(netease(list, dur, version)), settle(lrclib(list, dur))]);
  const all = [...mx, ...ne, ...lr].map((c) => ({ c, sc: matchScore(c, list, dur, version) }));
  // берём только уверенные совпадения: тот же исполнитель и название (или почти точная длительность)
  const ok = all.filter(({ c, sc }) => sc < 40 || (sc < 60 && dur && c.dur && Math.abs(c.dur - dur) <= 2));
  const texts = ok.filter(({ c }) => c.kind !== 'instrumental');
  // пословная синхронизация выигрывает у построчной, если совпадает по длительности не хуже чем на ~4 с
  texts.sort((a, b) => (KIND_RANK[a.c.kind] * 20 + a.sc) - (KIND_RANK[b.c.kind] * 20 + b.sc));
  const pr = prefer ? texts.filter(({ c }) => c.provider === prefer) : []; // 2.0.4-fix: выбранная база — первой
  if (pr.length) return pack(pr[0].c, dur, version);
  if (texts.length) return pack(texts[0].c, dur, version);
  const ins = ok.find(({ c, sc }) => c.kind === 'instrumental' && sc < 20);
  return ins ? pack(ins.c, dur, version) : null;
}
// ручной поиск (корректор): все найденные варианты
async function searchLyrics({ q, title, author }) {
  // 2.0.4-fix: запрос «Название - Автор» из корректора — ищем точно по полям (так LRCLIB находит намного лучше)
  const qd = q && String(q).match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (qd) { title = qd[1].trim(); author = qd[2].trim(); }
  const { list } = qd ? { list: [{ track: title, artist: author }] } : variants(title || q || '', author || '');
  const query = qd ? `${author} ${title}` : q || `${(list[0] || {}).artist || ''} ${(list[0] || {}).track || ''}`.trim(); if (!query) return [];
  const settle = (p) => p.catch(() => []);
  const [lr, ne, mx] = await Promise.all([
    settle(q && !qd ? lrclibSearch({ q }).then((a) => a.map((r) => ({ provider: 'lrclib', id: 'lr' + r.id, artist: r.artistName, track: r.trackName, album: r.albumName, dur: r.duration || 0, kind: r.syncedLyrics ? 'line' : r.plainLyrics ? 'plain' : 'instrumental', synced: r.syncedLyrics || null, plain: r.plainLyrics || null }))) : lrclib(list, 0)),
    settle((async () => { const songs = (await neSearch(query, 6)).slice(0, 4); const out = []; for (const x of songs) { const l = await neLyric(x.id); if (l && l.kind !== 'instrumental') out.push({ provider: 'ne', id: 'ne' + x.id, artist: (x.artists || []).map((a) => a.name).join(', '), track: x.name, album: x.album && x.album.name, dur: (x.duration || 0) / 1000, ...l }); } return out; })()),
    settle(mxSearch(qd ? `${title} ${author}` : query, 4, q && !qd ? null : list[0]))
  ]);
  const name = { mxm: 'Musixmatch', ne: 'NetEase', lrclib: 'LRCLIB' };
  return [...mx, ...ne, ...lr].slice(0, 50).map((c) => ({ id: c.id, provider: c.provider, src: name[c.provider], artist: c.artist, track: c.track, album: c.album, dur: c.dur, synced: c.synced || null, plain: c.plain || null, words: c.kind === 'word', instrumental: c.kind === 'instrumental' }));
}

module.exports = { getLyrics, searchLyrics, REC_V, smartTitle, _t: { variants, parseYrc, parseRichsync, toLRC, piecesToWords, matchScore } };
