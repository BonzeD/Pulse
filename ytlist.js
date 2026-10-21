// Чтение публичного плейлиста YouTube без API-ключа (ytInitialData + continuation)
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';
const H = { 'User-Agent': UA, 'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8', Cookie: 'CONSENT=YES+1; SOCS=CAI' };
const txt = (o) => (o ? o.simpleText || (o.runs || []).map((r) => r.text).join('') : '');

const dur = (t) => (t || '').split(':').reduce((a, x) => a * 60 + (+x || 0), 0);
function walk(node, out, cont) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const n of node) walk(n, out, cont); return; }
  if (node.playlistVideoRenderer) { // старый формат
    const v = node.playlistVideoRenderer;
    if (v.videoId) out.push({ id: v.videoId, title: txt(v.title), author: txt(v.shortBylineText).replace(/ - Topic$/, ''), dur: +v.lengthSeconds || 0, loaded: !!txt(v.title), broken: v.isPlayable === false });
    return;
  }
  if (node.lockupViewModel) { // новый формат (2025+)
    const v = node.lockupViewModel, md = (v.metadata || {}).lockupMetadataViewModel || {};
    if (v.contentId && /VIDEO/.test(v.contentType || 'VIDEO')) {
      const rows = (((md.metadata || {}).contentMetadataViewModel || {}).metadataRows) || [];
      const author = rows.flatMap((r) => r.metadataParts || []).map((p) => p.text && p.text.content).filter(Boolean)[0] || '';
      const badge = (JSON.stringify(v.contentImage || {}).match(/"text":"(\d+(?::\d+)+)"/) || [])[1];
      const title = (md.title && md.title.content) || '';
      out.push({ id: v.contentId, title, author: author.replace(/ - Topic$/, ''), dur: dur(badge), loaded: !!title });
    }
    return;
  }
  if (node.continuationCommand && node.continuationCommand.token) { cont.push(node.continuationCommand.token); return; }
  for (const k in node) walk(node[k], out, cont);
}

async function fetchPlaylist(listId) {
  const r = await fetch(`https://www.youtube.com/playlist?list=${encodeURIComponent(listId)}&hl=ru`, { headers: H });
  const html = await r.text();
  const m = html.match(/var ytInitialData\s*=\s*(\{.+?\});<\/script>/s) || html.match(/ytInitialData"\]\s*=\s*(\{.+?\});/s);
  if (!m) return null;
  const data = JSON.parse(m[1]);
  const ver = (html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/) || [])[1] || '2.20250101.00.00';
  const title = (data.metadata && data.metadata.playlistMetadataRenderer && data.metadata.playlistMetadataRenderer.title) || null;
  const tracks = [], cont = [];
  walk(data.contents, tracks, cont);
  const used = new Set(); let guard = 0;
  while (cont.length && guard++ < 60) {
    const token = cont.shift(); if (used.has(token)) continue; used.add(token);
    const rr = await fetch('https://www.youtube.com/youtubei/v1/browse?prettyPrint=false', {
      method: 'POST', headers: { ...H, 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: { client: { clientName: 'WEB', clientVersion: ver, hl: 'ru' } }, continuation: token })
    });
    if (!rr.ok) break;
    walk((await rr.json()).onResponseReceivedActions, tracks, cont);
  }
  const seen = new Set();
  return { title, tracks: tracks.filter((t) => !seen.has(t.id) && seen.add(t.id)) };
}

// ---------- поиск по YouTube Music ----------
const MUSIC_H = { 'User-Agent': UA, 'Content-Type': 'application/json', Origin: 'https://music.youtube.com', Referer: 'https://music.youtube.com/', 'Accept-Language': 'ru-RU,ru;q=0.9' };
async function search(query) {
  const r = await fetch('https://music.youtube.com/youtubei/v1/search?prettyPrint=false', {
    method: 'POST', headers: MUSIC_H,
    body: JSON.stringify({ context: { client: { clientName: 'WEB_REMIX', clientVersion: '1.20250101.01.00', hl: 'ru' } }, query, params: 'EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D' })
  });
  const j = await r.json(); const out = [];
  (function w(n) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(w);
    if (n.musicResponsiveListItemRenderer) {
      const v = n.musicResponsiveListItemRenderer;
      const id = (v.playlistItemData && v.playlistItemData.videoId) || (JSON.stringify(v.overlay || {}).match(/"videoId":"([\w-]{11})"/) || [])[1];
      const cols = (v.flexColumns || []).map((c) => ((c.musicResponsiveListItemFlexColumnRenderer || {}).text || {}).runs || []);
      const title = (cols[0] || []).map((x) => x.text).join('');
      const meta = cols[1] || []; const parts = meta.map((x) => x.text);
      const firstDot = parts.indexOf(' • ');
      const author = (firstDot >= 0 ? parts.slice(0, firstDot) : parts).join('');
      const durTxt = parts.filter((x) => /^\d+(:\d+)+$/.test(x)).pop();
      const thumbs = (((v.thumbnail || {}).musicThumbnailRenderer || {}).thumbnail || {}).thumbnails || [];
      const art = thumbs.length ? thumbs[thumbs.length - 1].url.replace(/=w\d+-h\d+.*$/, '=w544-h544-l90-rj') : null;
      if (id && title) out.push({ id, title, author, dur: dur(durTxt), art, loaded: true });
      return;
    }
    for (const k in n) w(n[k]);
  })(j.contents);
  const seen = new Set(); return out.filter((t) => !seen.has(t.id) && seen.add(t.id));
}

// ---------- микс / радио по треку ----------
async function fetchMix(videoId, listId) {
  listId = listId || `RDAMVM${videoId}`;
  const r = await fetch(`https://www.youtube.com/watch?v=${videoId}&list=${listId}&hl=ru`, { headers: H });
  const html = await r.text();
  const m = html.match(/var ytInitialData\s*=\s*(\{.+?\});<\/script>/s); if (!m) return null;
  const d = JSON.parse(m[1]); const out = [];
  (function w(n) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(w);
    if (n.playlistPanelVideoRenderer) {
      const v = n.playlistPanelVideoRenderer;
      if (v.videoId) out.push({ id: v.videoId, title: txt(v.title), author: txt(v.shortBylineText || v.longBylineText).replace(/ - Topic$/, '').split(' • ')[0], dur: dur(txt(v.lengthText)), loaded: true });
      return;
    }
    for (const k in n) w(n[k]);
  })(d.contents);
  const title = ((((d.contents || {}).twoColumnWatchNextResults || {}).playlist || {}).playlist || {}).title || 'Микс';
  const seen = new Set(); return { title, tracks: out.filter((t) => !seen.has(t.id) && seen.add(t.id)) };
}

async function videoInfo(id) {
  try {
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}`);
    if (!r.ok) return null; const j = await r.json();
    return { id, title: j.title, author: (j.author_name || '').replace(/ - Topic$/, ''), loaded: true };
  } catch { return null; }
}
module.exports = { fetchPlaylist, search, fetchMix, videoInfo };
