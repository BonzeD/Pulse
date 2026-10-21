// YouTube Music InnerTube: главная, обзор, поиск, альбомы, артисты, плейлисты, «далее», похожие, лайки
const txt = (o) => (o ? o.simpleText || (o.runs || []).map((r) => r.text).join('') : '');
const dur = (t) => (t || '').split(':').reduce((a, x) => a * 60 + (+x || 0), 0);
let API = null; // async (endpoint, body, query) => json — задаётся из account.js
const setApi = (f) => (API = f);

function bigArt(thumbs, size = 544) {
  const list=(thumbs||[]).filter(t=>t&&typeof t.url==='string'&&t.url.trim());
  const t=list.sort((a,b)=>(Number(b.width)||0)*(Number(b.height)||0)-(Number(a.width)||0)*(Number(a.height)||0))[0];if(!t)return null;
  const u=t.url.startsWith('//')?'https:'+t.url:t.url;
  // Playlist collages and signed thumbnails must retain their original URL/query.
  // Their server size is already chosen above; rewriting =w/=s can invalidate signatures.
  return /^https:\/\//.test(u)?u:null;
}
const thumbsOf = (o) => {
  if (!o) return null;
  const m = o.musicThumbnailRenderer || (o.croppedSquareThumbnailRenderer) || o;
  const r = (m.thumbnail || {}).thumbnails || m.thumbnails || null;
  if (r && r.length) return r;
  // 1.9.5: у авто-плейлистов («Новинки и любимые треки», миксы) обложка лежит глубже — ищем первый массив thumbnails
  let found = null; const walk = (x, d) => { if (found || !x || typeof x !== 'object' || d > 6) return; if (Array.isArray(x.thumbnails) && x.thumbnails.length && x.thumbnails[0].url) { found = x.thumbnails; return; } for (const k in x) walk(x[k], d + 1); };
  walk(o, 0); return found;
};
const pageType = (ep) => (((ep || {}).browseEndpointContextSupportedConfigs || {}).browseEndpointContextMusicConfig || {}).pageType || '';
const KIND = { MUSIC_PAGE_TYPE_ALBUM: 'album', MUSIC_PAGE_TYPE_PLAYLIST: 'playlist', MUSIC_PAGE_TYPE_ARTIST: 'artist', MUSIC_PAGE_TYPE_USER_CHANNEL: 'artist', MUSIC_PAGE_TYPE_LIBRARY_ARTIST: 'artist', MUSIC_PAGE_TYPE_AUDIOBOOK: 'album', MUSIC_PAGE_TYPE_PODCAST_SHOW_DETAIL_PAGE: 'playlist' };

function runsInfo(runs) { // артисты / альбом из строки «Артист • Альбом • 3:21»
  const artists = [], out = { artists, album: null, dur: 0, plain: [] };
  for (const r of runs || []) {
    const be = r.navigationEndpoint && r.navigationEndpoint.browseEndpoint;
    const pt = pageType(be);
    if (be && /ARTIST|USER_CHANNEL/.test(pt)) artists.push({ name: r.text, id: be.browseId });
    else if (be && /ALBUM/.test(pt)) out.album = { name: r.text, id: be.browseId };
    else if (/^\d+(:\d+)+$/.test(r.text.trim())) out.dur = dur(r.text.trim());
    if (r.text !== ' • ') out.plain.push(r.text);
  }
  return out;
}

const TYPEW = /^(Песня|Композиция|Трек|Song|Видео|Клип|Video|Эпизод|Episode|Сингл|Single|Альбом|Album|EP|Плейлист|Playlist|Исполнитель|Artist)$/i;
function parseListItem(v, ctx = {}) {
  const cols = (v.flexColumns || []).map((c) => ((c.musicResponsiveListItemFlexColumnRenderer || {}).text || {}).runs || []);
  const fixed = (v.fixedColumns || []).map((c) => txt((c.musicResponsiveListItemFixedColumnRenderer || {}).text));
  const title = (cols[0] || []).map((x) => x.text).join('');
  const id = (v.playlistItemData && v.playlistItemData.videoId) || (JSON.stringify(v.overlay || {}).match(/"videoId":"([\w-]{11})"/) || [])[1]
    || ((cols[0][0] || {}).navigationEndpoint && ((cols[0][0].navigationEndpoint.watchEndpoint) || {}).videoId);
  const art = bigArt(thumbsOf(v.thumbnail || v.thumbnailRenderer || v)) || ctx.art || null;
  if (id) {
    const info = runsInfo(cols.slice(1).flat());
    const parts = (cols[1] || []).map((x) => x.text); const dot = parts.indexOf(' • ');
    let author = info.artists.length ? info.artists.map((a) => a.name).join(', ') : (dot >= 0 ? parts.slice(0, dot) : parts).join('');
    if (TYPEW.test(author) && dot >= 0) author = parts.slice(dot + 1).join('').split(' • ')[0];
    if (/^\d+(:\d+)+$/.test(author)) author = '';
    if (!author && ctx.author) author = ctx.author;
    if (/^(Выпуск|Эпизод|Episode|Подкаст|Podcast)$/i.test(parts[0] || '')) return null;
    const d = fixed.find((x) => /^\d+(:\d+)+$/.test(x)) ? dur(fixed.find((x) => /^\d+(:\d+)+$/.test(x))) : info.dur;
    const isVideo = /MUSIC_VIDEO_TYPE_(UGC|OMV|PODCAST)/.test(JSON.stringify(v.overlay || v.flexColumns || ''));
    const views = cols.slice(1).flat().map((r) => r.text).find((x) => /просмотр|views|прослушиван|plays/i.test(x));
    return { kind: 'song', id, setVid: (v.playlistItemData && v.playlistItemData.playlistSetVideoId) || null, title, author, dur: d, art, album: info.album || ctx.album || null, artistId: (info.artists[0] || ctx.artist || {}).id || null, video: isVideo, plays: views || null, loaded: true, broken: v.musicItemRendererDisplayPolicy === 'MUSIC_ITEM_RENDERER_DISPLAY_POLICY_GREY_OUT' };
  }
  const be = v.navigationEndpoint && v.navigationEndpoint.browseEndpoint;
  if (be) return { kind: KIND[pageType(be)] || 'playlist', browseId: be.browseId, title, sub: cols.slice(1).flat().map((r) => r.text).join(''), art, round: /ARTIST/.test(pageType(be)) };
  return null;
}
function parseTwoRow(v) {
  const title = txt(v.title), sub = txt(v.subtitle), art = bigArt(thumbsOf(v.thumbnailRenderer || v.thumbnail || v));
  const ne = v.navigationEndpoint || {};
  if (ne.watchEndpoint && ne.watchEndpoint.videoId) {
    const info = runsInfo((v.subtitle || {}).runs);
    return { kind: 'song', id: ne.watchEndpoint.videoId, title, author: info.artists.map((a) => a.name).join(', ') || sub.split(' • ').filter((x) => !TYPEW.test(x))[0] || '', art, artistId: (info.artists[0] || {}).id || null, video: true, card: true, loaded: true };
  }
  if (ne.watchPlaylistEndpoint) return { kind: 'playlist', browseId: 'VL' + ne.watchPlaylistEndpoint.playlistId, title, sub, art };
  const be = ne.browseEndpoint; if (!be) return null;
  return { kind: KIND[pageType(be)] || 'playlist', browseId: be.browseId, title, sub, art, round: /ARTIST/.test(pageType(be)) };
}
function parseItem(n, ctx) {
  if (n.musicResponsiveListItemRenderer) return parseListItem(n.musicResponsiveListItemRenderer, ctx);
  if (n.musicTwoRowItemRenderer) return parseTwoRow(n.musicTwoRowItemRenderer);
  if (n.musicNavigationButtonRenderer) {
    const b = n.musicNavigationButtonRenderer, be = (b.clickCommand || {}).browseEndpoint; if (!be) return null;
    const c = ((b.solid || {}).leftStripColor) || 0; const hex = '#' + ((c >>> 0) & 0xffffff).toString(16).padStart(6, '0');
    return { kind: 'mood', browseId: be.browseId, params: be.params || null, title: txt(b.buttonText), color: hex };
  }
  return null;
}
function shelfTitle(h) {
  if (!h) return '';
  const r = h.musicCarouselShelfBasicHeaderRenderer || h.gridHeaderRenderer || h.musicImmersiveCarouselShelfBasicHeaderRenderer || h.musicSideAlignedItemRenderer || h;
  return txt(r.title);
}
function shelfMore(h) {
  const s = JSON.stringify(h || {}); const m = s.match(/"moreContentButton".*?"browseEndpoint":\{"browseId":"([^"]+)"(?:,"params":"([^"]+)")?/);
  return m ? { browseId: m[1], params: m[2] || null } : null;
}
function parseShelves(root, ctx = {}) {
  const shelves = []; let cont = null;
  (function w(n) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(w);
    const add = (title, items, extra = {}) => { items = items.filter(Boolean); if (items.length) shelves.push({ title, items, ...extra }); };
    if (n.musicCarouselShelfRenderer) { const s = n.musicCarouselShelfRenderer; const hd = s.header || {}; add(shelfTitle(hd), (s.contents || []).map((x) => parseItem(x, ctx)), { strap: txt((hd.musicCarouselShelfBasicHeaderRenderer || {}).strapline), more: shelfMore(hd) }); return; }
    if (n.musicImmersiveCarouselShelfRenderer) { const s = n.musicImmersiveCarouselShelfRenderer; add(shelfTitle(s.header), (s.contents || []).map((x) => parseItem(x, ctx))); return; }
    if (n.musicShelfRenderer) { const s = n.musicShelfRenderer; add(txt(s.title), (s.contents || []).map((x) => parseItem(x, ctx)), { list: true, more: s.bottomEndpoint && s.bottomEndpoint.searchEndpoint ? { search: s.bottomEndpoint.searchEndpoint } : (s.bottomEndpoint && s.bottomEndpoint.browseEndpoint ? { browseId: s.bottomEndpoint.browseEndpoint.browseId, params: s.bottomEndpoint.browseEndpoint.params } : null) }); return; }
    if (n.musicPlaylistShelfRenderer) { const s = n.musicPlaylistShelfRenderer; add('', (s.contents || []).map((x) => parseItem(x, ctx)), { list: true }); return; }
    if (n.gridRenderer) { const s = n.gridRenderer; add(shelfTitle(s.header), (s.items || []).map((x) => parseItem(x, ctx)), { grid: true }); return; }
    if (n.musicCardShelfRenderer) {
      const s = n.musicCardShelfRenderer; const t = (s.title || {}).runs || []; const ne = (t[0] || {}).navigationEndpoint || {};
      const art = bigArt(thumbsOf(s.thumbnail)); const sub = txt(s.subtitle);
      let top = null;
      if (ne.watchEndpoint) { const info = runsInfo((s.subtitle || {}).runs); top = { kind: 'song', id: ne.watchEndpoint.videoId, title: txt(s.title), author: info.artists.map((a) => a.name).join(', '), art, dur: info.dur, loaded: true, sub }; }
      else if (ne.browseEndpoint) top = { kind: KIND[pageType(ne.browseEndpoint)] || 'playlist', browseId: ne.browseEndpoint.browseId, title: txt(s.title), sub, art, round: /ARTIST/.test(pageType(ne.browseEndpoint)) };
      const cctx = { ...ctx, author: top && (top.kind === 'artist' ? top.title : top.author) };
      add(txt((s.header || {}).musicCardShelfHeaderBasicRenderer ? s.header.musicCardShelfHeaderBasicRenderer.title : null) || 'Лучший результат', [top, ...(s.contents || []).map((x) => parseItem(x, cctx))], { top: true });
      return;
    }
    if (n.itemSectionRenderer && (n.itemSectionRenderer.contents || []).some((x) => x.musicResponsiveListItemRenderer || x.musicTwoRowItemRenderer)) {
      const items = n.itemSectionRenderer.contents.map((x) => parseItem(x, ctx)).filter(Boolean);
      const last = shelves[shelves.length - 1];
      if (last && last.mixed) last.items.push(...items); else if (items.length) shelves.push({ title: 'Результаты', items, list: true, mixed: true });
      return;
    }
    if (n.musicDescriptionShelfRenderer) { const s = n.musicDescriptionShelfRenderer; shelves.push({ title: txt(s.header) || 'Описание', desc: txt(s.description), items: [] }); return; }
    if (n.nextContinuationData) { cont = n.nextContinuationData.continuation; return; }
    if (n.continuationItemRenderer) { const t = JSON.stringify(n.continuationItemRenderer).match(/"token":"([^"]+)"/); if (t) cont = t[1]; return; }
    for (const k in n) if (k !== 'frameworkUpdates' && k !== 'responseContext') w(n[k]);
  })(root);
  return { shelves, cont };
}

async function feed(browseId, params) {
  const j = await API('browse', params ? { browseId, params } : { browseId });
  const r = parseShelves(j.contents);
  const hdr = header(j);
  // ещё немного полок по continuation
  let cont = r.cont, g = 0;
  while (cont && g++ < 3 && browseId === 'FEmusic_home') {
    const c = await API('browse', {}, `&ctoken=${encodeURIComponent(cont)}&continuation=${encodeURIComponent(cont)}&type=next`).catch(() => null);
    if (!c) break; const more = parseShelves(c.continuationContents || c.onResponseReceivedActions); r.shelves.push(...more.shelves); cont = more.cont;
  }
  const chips = [];
  (function w(n) { if (!n || typeof n !== 'object') return; if (n.chipCloudChipRenderer) { const c = n.chipCloudChipRenderer; const be = ((c.navigationEndpoint || {}).browseEndpoint) || {}; if (be.params) chips.push({ title: txt(c.text), browseId: be.browseId, params: be.params, on: !!c.isSelected }); return; } for (const k in n) w(n[k]); })(j.header || j.contents);
  return { title: hdr.title, header: hdr.title ? hdr : null, shelves: r.shelves, chips };
}

function header(j) {
  const s = JSON.stringify(j.header || {}).length > 2 ? j.header : null;
  let h = null;
  (function w(n) {
    if (h || !n || typeof n !== 'object') return;
    for (const k of ['musicResponsiveHeaderRenderer', 'musicImmersiveHeaderRenderer', 'musicVisualHeaderRenderer', 'musicDetailHeaderRenderer', 'musicEditablePlaylistDetailHeaderRenderer', 'musicHeaderRenderer']) if (n[k]) {
      const r = k === 'musicEditablePlaylistDetailHeaderRenderer' ? ((n[k].header || {}).musicResponsiveHeaderRenderer || (n[k].header || {}).musicDetailHeaderRenderer || n[k]) : n[k];
      h = { title: txt(r.title), sub: [txt(r.subtitle), txt(r.secondSubtitle)].filter(Boolean).join(' • '), strap: txt(r.straplineTextOne), desc: txt(((r.description || {}).musicDescriptionShelfRenderer || {}).description) || txt(r.description),
        art: bigArt(thumbsOf(r.thumbnail || r.foregroundThumbnail), 900), artists: runsInfo((r.straplineTextOne || r.subtitle || {}).runs).artists, round: k === 'musicImmersiveHeaderRenderer' || k === 'musicVisualHeaderRenderer' };
      const sub = JSON.stringify(r.subscriptionButton || '').match(/"subscriberCountText":\{"runs":\[\{"text":"([^"]+)"/); if (sub) h.subs = sub[1];
      // 2.0: подписка на исполнителя и «слушателей в месяц» (если YouTube Music их показывает)
      const sb = (function f(x, d) { if (!x || typeof x !== 'object' || d > 8) return null; if (x.subscribeButtonRenderer) return x.subscribeButtonRenderer; for (const k in x) { const v = f(x[k], d + 1); if (v) return v; } return null; })(r.subscriptionButton || r.buttons || r, 0);
      if (sb) { h.channelId = sb.channelId || null; h.subscribed = !!sb.subscribed; if (!h.subs) h.subs = txt(sb.subscriberCountText) || txt(sb.shortSubscriberCountText) || undefined; }
      const ml = txt(r.monthlyListenerCount); if (ml) h.monthly = ml;
      const radio = JSON.stringify(r.startRadioButton || r.buttons || '').match(/"playlistId":"(RD[\w-]+)"/); if (radio) h.radio = radio[1];
      return;
    }
    if (Array.isArray(n)) n.forEach(w); else for (const k in n) w(n[k]);
  })(s ? { a: s, b: j.contents } : j.contents);
  return h || {};
}

async function browse(browseId, params) {
  if (/^(VL|RD|PL|OLAK|LM)/.test(browseId) && !browseId.startsWith('VL') && !browseId.startsWith('MPRE')) browseId = 'VL' + browseId;
  const j = await API('browse', params ? { browseId, params } : { browseId });
  const hdr = header(j);
  const isAlbum = browseId.startsWith('MPRE'), isList = browseId.startsWith('VL'), isArtist = /^(UC|MPLA)/.test(browseId);
  const ctx = isAlbum ? { art: hdr.art && hdr.art.replace(/=w900-h900/, '=w544-h544'), author: (hdr.artists || []).map((a) => a.name).join(', ') || hdr.strap, album: { name: hdr.title, id: browseId }, artist: (hdr.artists || [])[0] } : {};
  const r = parseShelves(j.contents, ctx);
  const out = { type: isAlbum ? 'album' : isList ? 'playlist' : isArtist ? 'artist' : 'page', browseId, header: hdr, shelves: r.shelves };
  out.editable = /musicEditablePlaylistDetailHeaderRenderer/.test(JSON.stringify(j.header || '').slice(0, 400)) || /musicEditablePlaylistDetailHeaderRenderer/.test(JSON.stringify(j.contents || '').slice(0, 20000));
  if (isAlbum || isList) {
    const tracks = []; const rest = [];
    for (const s of r.shelves) { if (s.list && !tracks.length) tracks.push(...s.items.filter((x) => x.kind === 'song')); else rest.push(s); }
    let cont = r.cont, g = 0;
    while (cont && g++ < 100) {
      const c = await API('browse', { continuation: cont }).catch(() => null) || await API('browse', {}, `&ctoken=${encodeURIComponent(cont)}&continuation=${encodeURIComponent(cont)}&type=next`).catch(() => null);
      if (!c) break; const more = parseShelves(c.onResponseReceivedActions || c.continuationContents, ctx);
      more.shelves.forEach((s) => tracks.push(...s.items.filter((x) => x.kind === 'song'))); if (more.cont === cont) break; cont = more.cont;
    }
    const seen = new Set(); out.tracks = tracks.filter((t) => !seen.has(t.id) && seen.add(t.id));
    out.shelves = rest.filter((s) => !s.list);
    if (isList && !hdr.art && out.tracks[0]) hdr.art = out.tracks[0].art;
  }
  return out;
}

async function search(q, filter) {
  const P = { songs: 'EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D', videos: 'EgWKAQIQAWoKEAkQChAFEAMQBA%3D%3D', albums: 'EgWKAQIYAWoKEAkQChAFEAMQBA%3D%3D', artists: 'EgWKAQIgAWoKEAkQChAFEAMQBA%3D%3D', playlists: 'EgeKAQQoAEABagoQAxAEEAoQCRAF' };
  const j = await API('search', filter ? { query: q, params: decodeURIComponent(P[filter]) } : { query: q });
  return parseShelves(j.contents).shelves;
}
async function suggest(q) {
  const j = await API('music/get_search_suggestions', { input: q });
  const out = [];
  (function w(n) { if (!n || typeof n !== 'object') return; if (n.searchSuggestionRenderer) { out.push(txt(n.searchSuggestionRenderer.suggestion)); return; } if (Array.isArray(n)) n.forEach(w); else for (const k in n) w(n[k]); })(j.contents);
  return out.slice(0, 8);
}

async function next(videoId, playlistId) {
  const j = await API('next', { videoId, playlistId: playlistId || `RDAMVM${videoId}`, isAudioOnly: true, enablePersistentPlaylistPanel: true, tunerSettingValue: 'AUTOMIX_SETTING_NORMAL' });
  const tracks = [];
  (function w(n) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(w);
    const p = n.playlistPanelVideoRenderer || (n.playlistPanelVideoWrapperRenderer && n.playlistPanelVideoWrapperRenderer.primaryRenderer.playlistPanelVideoRenderer);
    if (p && p.videoId) {
      const info = runsInfo((p.longBylineText || {}).runs);
      tracks.push({ kind: 'song', id: p.videoId, title: txt(p.title), author: info.artists.map((a) => a.name).join(', ') || txt(p.shortBylineText), dur: dur(txt(p.lengthText)), art: bigArt((p.thumbnail || {}).thumbnails), album: info.album, artistId: (info.artists[0] || {}).id || null, loaded: true });
      return;
    }
    for (const k in n) w(n[k]);
  })(j.contents);
  const s = JSON.stringify(j.contents || {});
  const related = (s.match(/"browseId":"(MPTRt_[\w-]+)"/) || [])[1] || null;
  const lyricsId = (s.match(/"browseId":"(MPLYt_[\w-]+)"/) || [])[1] || null;
  const seen = new Set();
  return { tracks: tracks.filter((t) => !seen.has(t.id) && seen.add(t.id)), related, lyricsId };
}
async function related(browseId) { const j = await API('browse', { browseId }); return parseShelves(j.contents).shelves; }
async function ytLyrics(browseId) { // текст от YouTube Music (обычно без таймингов)
  const j = await API('browse', { browseId }); let t = null, src = null;
  (function w(n) { if (t || !n || typeof n !== 'object') return; if (n.musicDescriptionShelfRenderer) { t = txt(n.musicDescriptionShelfRenderer.description); src = txt(n.musicDescriptionShelfRenderer.footer); return; } if (Array.isArray(n)) n.forEach(w); else for (const k in n) w(n[k]); })(j.contents);
  return t ? { plain: t, source: (src || 'YouTube Music').replace(/^Источник:\s*/, '') } : null;
}
// 2.0: подписка на канал исполнителя
async function subscribe(channelId, on) { await API(on ? 'subscription/subscribe' : 'subscription/unsubscribe', { channelIds: [channelId] }); return true; }
async function like(videoId, on) { await API(on ? 'like/like' : 'like/removelike', { target: { videoId } }); return true; }
// 2.0.4: настоящий дизлайк YouTube Music («Не нравится»); снятие — тем же removelike
async function dislike(videoId, on) { await API(on ? 'like/dislike' : 'like/removelike', { target: { videoId } }); return true; }

// ---------- плейлисты YouTube Music: создание, добавление, удаление ----------
async function addToOptions(videoIds) {
  const j = await API('playlist/get_add_to_playlist', { videoIds: [].concat(videoIds || []) });
  const out = [];
  (function w(n) {
    if (!n || typeof n !== 'object') return;
    if (n.playlistAddToOptionRenderer) { const r = n.playlistAddToOptionRenderer; out.push({ playlistId: r.playlistId, title: txt(r.title), has: r.containsSelectedVideos === 'ALL', privacy: r.privacy || '' }); return; }
    if (Array.isArray(n)) n.forEach(w); else for (const k in n) w(n[k]);
  })(j);
  return out;
}
async function createPlaylist(title, description, privacy, videoIds) {
  const body = { title: String(title || 'Новый плейлист').slice(0, 150), description: String(description || '').slice(0, 5000), privacyStatus: privacy || 'PRIVATE' };
  if (videoIds && videoIds.length) body.videoIds = videoIds.slice(0, 5000);
  const j = await API('playlist/create', body);
  if (!j.playlistId) throw new Error('YouTube Music не создал плейлист');
  return { playlistId: j.playlistId, browseId: 'VL' + j.playlistId };
}
async function addToPlaylist(playlistId, videoIds) {
  const ids = [].concat(videoIds || []); let ok = 0;
  for (let i = 0; i < ids.length; i += 50) {
    const j = await API('browse/edit_playlist', { playlistId: playlistId.replace(/^VL/, ''), actions: ids.slice(i, i + 50).map((v) => ({ action: 'ACTION_ADD_VIDEO', addedVideoId: v, dedupeOption: 'DEDUPE_OPTION_SKIP' })) });
    if (j.status && !/SUCCEEDED/.test(j.status)) throw new Error('не удалось добавить: ' + j.status);
    ok += Math.min(50, ids.length - i);
  }
  return { added: ok };
}
async function removeFromPlaylist(playlistId, items) {
  const acts = [].concat(items || []).filter((x) => x && x.setVid).map((x) => ({ action: 'ACTION_REMOVE_VIDEO', setVideoId: x.setVid, removedVideoId: x.id }));
  if (!acts.length) throw new Error('нет данных о треке в плейлисте — обнови страницу');
  await API('browse/edit_playlist', { playlistId: playlistId.replace(/^VL/, ''), actions: acts }); return true;
}
async function renamePlaylist(playlistId, name) { await API('browse/edit_playlist', { playlistId: playlistId.replace(/^VL/, ''), actions: [{ action: 'ACTION_SET_PLAYLIST_NAME', playlistName: name }] }); return true; }
async function deletePlaylist(playlistId) { await API('playlist/delete', { playlistId: playlistId.replace(/^VL/, '') }); return true; }

module.exports = { addToOptions, createPlaylist, addToPlaylist, removeFromPlaylist, renamePlaylist, deletePlaylist, setApi, feed, browse, search, suggest, next, related, ytLyrics, like, dislike, subscribe, parseShelves };
