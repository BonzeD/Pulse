'use strict';
// Pulse 1.6 — клиент YouTube Music (расширяемый: см. PLUGINS.md)
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (s) => { s = Math.max(0, Math.floor(s || 0)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`; };
const ico = (n, c = '') => `<svg class="i ${c}"><use href="#i-${n}"/></svg>`;
const tr = (n) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'трек' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'трека' : 'треков'}`;
const translateUiText = (s) => (window.PulseI18n ? PulseI18n.t(s) : s);
function uiOwnedPart(s) {
  const v = String(s ?? '').trim(); if (!v) return v;
  if (/^\d+\s+(?:трек|трека|треков|мин\.|мин|подписчиков|слушателей в месяц)$/.test(v)) return translateUiText(v);
  if (['Альбом', 'Сингл', 'Сборник', 'Исполнитель', 'Моя медиатека', 'Песни в медиатеке', 'Любимые треки', 'Плейлист', 'Плейлист на устройстве', 'Локальные треки', 'Скачанное', 'Доступно без интернета', 'на устройстве', 'Apple Music', 'Spotify', 'YouTube Music'].includes(v)) return translateUiText(v);
  return v;
}
function uiOwnedText(s) {
  const v = String(s ?? ''); if (!v) return v;
  if (v.includes(' • ')) return v.split(' • ').map(uiOwnedPart).join(' • ');
  if (v.includes(' · ')) return v.split(' · ').map(uiOwnedPart).join(' · ');
  return uiOwnedPart(v);
}
const MINE = 'mine';
const EQI = '<span class="eqi"><i></i><i></i><i></i></span>';
const online = () => navigator.onLine;

let lib = { playlists: [], queue: { name: '', tracks: [], idx: -1 }, volume: 80, shuffle: false, repeat: 'off', mode: 'cover', tab: 'next', lyrics: {}, offsets: {}, known: {}, vizStyle: 'ring', autoplay: true, mini: false };
let account = null, accLists = null;
let off = {}, dl = {}, wsAvail = false;
window.addEventListener('beforeunload', () => { if (saveT && !window.__pulseResetting && pulse.flushLibrary) { clearTimeout(saveT); pulse.flushLibrary(lib); } });
let saveT; const save = () => { clearTimeout(saveT); if (window.__pulseResetting) return; saveT = setTimeout(() => { if (!window.__pulseResetting) pulse.saveLibrary(lib); }, 400); };

// ---------- утилиты ----------
const EMO = /[\u{1F000}-\u{1FAFF}\u2600-\u27BF\u2B00-\u2BFF\uFE0F\u2190-\u21FF]/gu;
function toast(msg, icon) {
  const t = $('toast'); msg = String(msg).replace(EMO, '').replace(/\s+/g, ' ').trim();
  icon = icon || (/Нет интернета|Не удалось|Ошибка|недоступ|Не нашёл|нельзя|запрещено/i.test(msg) ? 'alert' : /[Рр]адио/.test(msg) ? 'radio' : /[Сс]кач|загрузк/.test(msg) ? 'download' : /Мои треки|Понрав/.test(msg) ? 'heart-f' : /[Пп]еремеш/.test(msg) ? 'shuffle' : /[Пп]овтор/.test(msg) ? 'repeat' : /Google|аккаунт|Вход|вош/i.test(msg) ? 'user' : /очеред/i.test(msg) ? 'queue' : 'sparkle');
  t.innerHTML = ico(icon) + `<span>${esc(msg)}</span>`; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 3400);
}
const proxied = (u) => `/img?u=${encodeURIComponent(u)}`;
function sized(u, n) { if (!u) return u; if(/[?&](?:s|sig|signature|expire|token|X-Goog-Signature)=/i.test(u))return u; return /googleusercontent|ggpht/.test(u) ? u.replace(/=w\d+-h\d+[^&?]*$/, `=w${n}-h${n}-l90-rj`).replace(/=s\d+[^&?]*$/, `=s${n}`) : u; }
// все обложки идут через локальный кэш (/img) — так они остаются доступны без интернета
const artOriginal=new Map();
const pimg = (u) => (!u ? u : /^https?:/.test(u) ? proxied(u) : u);
function artOf(t, n = 120) {
  if (!t) return '';
  if (window.MediaLibrary?.has(t.id)) return pimg(MediaLibrary.decorate(t).art || '');
  const o = off[t.id];
  if (o && (o.kind === 'square' || !t.art)) return `/offline/${o.vid || t.id}.jpg`; // 2.0.2: у трека сервиса файлы лежат под id видео
  if (t.art) { const src=pimg(sized(t.art,n));artOriginal.set(src,pimg(t.art));if(artOriginal.size>512)artOriginal.delete(artOriginal.keys().next().value);return src; }
  const v = ytVid(t); if (!v || !/^[\w-]{11}$/.test(v)) return ''; // 2.0.4: у трека сервиса без обложки берём обложку его записи YouTube, а не «битый» адрес из id сервиса (серая рожица-заглушка)
  return pimg(`https://i.ytimg.com/vi/${v}/${n > 300 ? 'hqdefault' : 'mqdefault'}.jpg`);
}
// Two bounded attempts: original signed artwork URL, then an explicit placeholder.
const IMG_ERR = `onerror="artFailed(this)" onload="this.style.opacity=1;this.parentNode?.classList.remove('noimg')"`;
function artFailed(img){
  const key=img.getAttribute('src')||'',original=artOriginal.get(key);
  if(!img.dataset.artRetry){img.dataset.artRetry='1';if(original&&original!==key){img.src=original;return;}}
  img.onerror=null;img.style.opacity=0;img.parentNode?.classList.add('noimg');
  if(img.closest('.card')?.dataset.playlistArt)window.PulsePlaylistArt?.repair(img.closest('.card'));
}
// 2.0.3: плейлиста «Мои треки» больше нет — лайки хранятся на сервере (YouTube Music / Apple Music / Spotify).
// lib.likes — зеркало лайков (id → 1), lib.likeQ — лайки, которые ещё не дошли до сервера (нет входа / интернета).
// mine() оставлен для плагинов и старого кода: только для чтения, в список плейлистов не попадает.
function mine() { return { id: MINE, name: 'Понравившиеся', tracks: Object.keys(lib.likes || {}).map((id) => lib.known[id]).filter(Boolean) }; }
const isLiked = (id) => !!(lib.likes && lib.likes[id]);
const slim = (t) => ({ id: t.id, title: t.title, author: t.author, dur: t.dur || 0, art: t.art || null, album: t.album || null, artistId: t.artistId || null, video: !!t.video, loaded: true });
// 2.0.4: неполный объект трека (только id) больше не затирает известные название, исполнителя и обложку пустыми значениями
function remember(t) { if (!t || !t.id) return; if(window.MediaLibrary)Object.assign(t,MediaLibrary.decorate(t)); const k = lib.known[t.id] || (lib.known[t.id] = {}), s0 = slim(t); for (const f in s0) { const v = s0[f]; if (v == null || v === '' || (f === 'dur' && !v)) { if (!(f in k)) k[f] = v; continue; } k[f] = v; } }
// 2.0.4: «пустые» треки (без названия — чаще всего клипы и треки, сохранённые старой версией) восстанавливаются:
// из памяти Pulse, а если там нет — из YouTube Music по id записи
const healing = new Set();
function needsHeal(t) { return !!t && t.id && (!t.title || t.title === t.id); }
async function healTrack(t) {
  if (!needsHeal(t) || healing.has(t.id)) return;
  const k = lib.known[t.id];
  if (k && k.title && k.title !== t.id) { Object.assign(t, { ...k, ...Object.fromEntries(Object.entries(t).filter(([, v]) => v != null && v !== '' && v !== t.id)) }); if (!t.title || t.title === t.id) t.title = k.title; healed(t); return; }
  const vid = ytVid(t) || (!isSvcId(t.id) ? t.id : null); if (!vid || !online()) return;
  healing.add(t.id);
  try {
    const r = await nextInfo(vid); const x = r && r.tracks && (r.tracks.find((y) => y.id === vid) || (r.tracks[0] && r.tracks[0].id === vid ? r.tracks[0] : null));
    if (x) { t.title = x.title || t.title; t.author = t.author || x.author; t.dur = t.dur || x.dur; if (!t.art && x.art) t.art = x.art; if (!t.album && x.album) t.album = x.album; if (!t.artistId && x.artistId) t.artistId = x.artistId; remember(t); save(); healed(t); }
  } finally { healing.delete(t.id); }
}
function healed(t) { lib.queue.tracks.forEach((q) => { if (q !== t && q.id === t.id) Object.assign(q, { title: t.title, author: t.author, art: q.art || t.art, dur: q.dur || t.dur }); }); if (curTrack() && curTrack().id === t.id) updateNow(); renderQueue(); }
const curTrack = () => { const t=lib.queue.tracks[lib.queue.idx]; if(t&&window.MediaLibrary)Object.assign(t,MediaLibrary.decorate(t)); return t; };
// 2.0.2: клиенты. Треки Apple Music / Spotify имеют id «am:…» / «sp:…»; звук — из найденной записи YouTube Music (её id — в vidMap)
const CL = () => (S().app && ['am', 'sp'].includes(S().app.client) ? S().app.client : 'yt');
const isSvcId = (id) => /^(am|sp):/.test(String(id || ''));
const vidMap = {};
const ytVid = (t) => (!t || t.id?.startsWith('local-') ? null : !isSvcId(t.id) ? t.id : vidMap[t.id] || (off[t.id] && off[t.id].vid) || null);
const canEmbed = (t) => !!t && !noEmbed[t.id] && !!ytVid(t);
// неудачные попытки помним только 15 минут и только в этой сессии: YouTube часто отдаёт трек со второго раза,
// а «серые» треки YouTube Music нередко играют через другой клиент
const failedAt = new Map();
const failed = (t) => { const x = failedAt.get(t.id); if (x && Date.now() - x > 15 * 60e3) { failedAt.delete(t.id); return false; } return !!x; };
const markFailed = (t) => { failedAt.set(t.id, Date.now()); };
const playable = (t) => t && (off[t.id] || (online() && !failed(t)));

// реестр данных для делегированных кликов
const REG = new Map(); let regN = 0;
function reg(v) { const k = 'k' + ++regN; REG.set(k, v); if (REG.size > 600) REG.delete(REG.keys().next().value); return k; }
const got = (k) => REG.get(k);

// ---------- аудио-движок ----------
// две «деки»: активная играет, вторая нужна для плавного сведения в режиме диджея
const decks = [document.createElement('video'), document.createElement('video')];
decks.forEach((a) => { a.preload = 'auto'; a.playsInline = true; a.className = 'file-video-deck'; a.setAttribute('aria-hidden','true'); a.tabIndex = -1; $('art').append(a); });
let audio = decks[0];
const onA = (ev, fn) => decks.forEach((a) => a.addEventListener(ev, (e) => { if (a === audio) fn(e); }));
let actx, analyser, gain, freq, wave, deckNodes = [], busNode = null;
function initAudioGraph() {
  if (actx) return;
  // 'interactive' — минимальная задержка вывода: визуал, бит и караоке совпадают с тем, что слышно
  const lh = (S().perf && S().perf.latency) || 'interactive';
  actx = new AudioContext({ latencyHint: lh === 'auto' ? 'interactive' : lh });
  analyser = actx.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = Math.max(0, Math.min(0.9, (S().viz.smooth ?? 30) / 100));
  gain = actx.createGain(); gain.gain.value = lib.volume / 100;
  const bus = actx.createGain(); busNode = bus;
  const bq = (type, f, q, g) => { const b = actx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q != null) b.Q.value = q; if (g != null) b.gain.value = g; return b; };
  deckNodes = decks.map((a) => {
    a.volume = 1;
    const src = actx.createMediaElementSource(a);
    // ручки деки (эквалайзер 3 полосы + фильтр) → автоматика перехода (бас-свап, фильтр) → кроссфейдер → фейдер канала
    const uLow = bq('lowshelf', 220, null, 0), uMid = bq('peaking', 1100, 0.7, 0), uHigh = bq('highshelf', 4200, null, 0), uHp = bq('highpass', 10, 0.9), uLp = bq('lowpass', 22000, 0.9);
    const low = bq('lowshelf', 200, null, 0), hp = bq('highpass', 10, 0.9), g = actx.createGain(), vol = actx.createGain(), send = actx.createGain();
    g.gain.value = a === audio ? 1 : 0; send.gain.value = 0;
    [src, uLow, uMid, uHigh, uHp, uLp, low, hp, g, vol].reduce((x, y) => (x.connect(y), y)); vol.connect(bus); vol.connect(send);
    return { src, uLow, uMid, uHigh, uHp, uLp, low, hp, g, vol, send };
  });
  buildEq(bus, analyser); analyser.connect(gain); gain.connect(actx.destination);
  if (typeof djBuildFx === 'function') try { djBuildFx(bus, preampNode); } catch (e) { console.error(e); }
  freq = new Uint8Array(analyser.frequencyBinCount); wave = new Uint8Array(analyser.fftSize);
}
// задержка между «обработано» и «услышано» (буфер звуковой карты) + ручная поправка
function outLat() { if (engine !== 'audio' || !actx) return 0; return Math.max(0, (actx.outputLatency || 0) + (actx.baseLatency || 0)); }
const heard = (extraMs = 0) => Math.max(0, E.time() - outLat() * ((audio && audio.playbackRate) || 1) - extraMs / 1000);
let player, ready = false, playing = false, engine = 'audio', audioTrackId = null, loadTok = 0, errStreak = 0, dragging = false, hist = [];
const noEmbed = {};
// 1.0.0: отдельное состояние кнопки, без стилей полноэкранного загрузчика.
function setLoading(v) { $('btnPlay').classList.toggle('is-loading', v); $('btnPlay').setAttribute('aria-busy', String(!!v)); }
onA('play', () => { if (engine === 'audio') { playing = true; onPlayState(); } });
onA('playing', () => { if (engine === 'audio') { errStreak = 0; setLoading(false); onStarted(); } });
onA('waiting', () => engine === 'audio' && setLoading(true));
onA('pause', () => { if (engine === 'audio') { playing = false; onPlayState(); } });
onA('ended', () => { if (engine === 'audio') onEnded(); });
onA('progress', () => { try { const d = audio.duration, b = audio.buffered; if (d && b.length) $('seekBuf').style.width = (b.end(b.length - 1) / d) * 100 + '%'; } catch {} });
const retried = new Set();
onA('error', () => {
  if (engine !== 'audio' || !audio.getAttribute('src')) return;
  if (window.PulseFileVideo?.recover()) return; // file-video integration
  const t = curTrack(), errorTok = loadTok; setLoading(false);
  // первая ошибка потока — просто переподключаемся (ссылка YouTube могла протухнуть), с того же места
  if (t && audio.getAttribute('src').startsWith('/stream/') && !retried.has(t.id)) { retried.add(t.id); const at = audio.currentTime || 0; setLoading(true); audio.src = `/stream/${t.id}?r=${Date.now()}`; audio.addEventListener('loadedmetadata', () => { if (errorTok === loadTok && at > 1) audio.currentTime = at; }, { once: true }); E.play(); return; }
  if (t && audio.getAttribute('src').startsWith('/stream/') && ready && canEmbed(t)) { toast('Пробую через встроенный YouTube…'); return useIframe(t, true); }
  toast(off[t?.id] ? 'Не удалось открыть скачанный файл — пропускаю' : 'Не удалось воспроизвести — пропускаю');
  if (t) { markFailed(t); markRows(); }
  if (++errStreak <= 8) setTimeout(() => { if (errorTok === loadTok) next(true); }, 700);
});
function useIframe(t, autoplay, start = 0) {
  audio.pause(); audio.removeAttribute('src'); audio.load(); engine = 'yt'; audioTrackId = null;
  const vid = ytVid(t) || t.id; // 2.0.2
  autoplay ? player.loadVideoById({ videoId: vid, startSeconds: start }) : player.cueVideoById({ videoId: vid, startSeconds: start });
  updateMode();
}
const E = {
  time: () => (engine === 'audio' ? audio.currentTime : ready && player.getCurrentTime ? player.getCurrentTime() : 0) || 0,
  dur: () => (engine === 'audio' ? (isFinite(audio.duration) ? audio.duration : 0) : ready && player.getDuration ? player.getDuration() : 0) || curTrack()?.dur || 0,
  play: () => { window.PulseFileVideo?.intent(true); if(window.PulseFileVideo?.pending())return; /* file-video integration */ if (engine === 'audio') { initAudioGraph(); actx.resume().catch(() => {}); const playTok = loadTok; audio.play().catch(() => { if (playTok === loadTok) setLoading(false); }); } else if (ready) player.playVideo(); },
  pause: () => { window.PulseFileVideo?.intent(false); /* file-video integration */ if (typeof djFinish === 'function') djFinish(); return engine === 'audio' ? audio.pause() : ready && player.pauseVideo(); },
  seek: (t) => { if (typeof djFinish === 'function') djFinish(); if (engine === 'audio') audio.currentTime = t; else if (ready) player.seekTo(t, true); beatState.kp = -1; },
  volume: (v) => { if (gain) gain.gain.value = v / 100; else audio.volume = v / 100; if (ready) { player.setVolume(v); if (v > 0) player.unMute(); } },
  load(t, autoplay, start = 0) {
    if (typeof djFinish === 'function') djFinish(true);
    const tok = ++loadTok; window.PulseFileVideo?.reset(); /* file-video integration */ setLoading(false); $('seekBuf').style.width = '0';
    const at = () => { if (start > 1) audio.addEventListener('loadedmetadata', () => { if (tok === loadTok) audio.currentTime = start; }, { once: true }); };
    // 1.0.0: owned local/downloaded media always uses the file player, never a YouTube embed.
    if (off[t.id] && lib.mode === 'video' && window.PulseFileVideo) {
      if (ready && engine === 'yt') try { player.stopVideo(); } catch {}
      engine = 'audio'; audioTrackId = t.id; PulseFileVideo.load(t, autoplay, start, tok); return true;
    }
    if (off[t.id]) {
      if (ready && engine === 'yt') try { player.stopVideo(); } catch {}
      engine = 'audio'; audioTrackId = t.id; at();
      audio.src = fileAudioUrl(t);
      if (autoplay) E.play(); updateMode();
      return true;
    }
    if (lib.mode === 'video' && ready && canEmbed(t) && online()) { useIframe(t, autoplay, start); return true; }
    if (ready && engine === 'yt') try { player.stopVideo(); } catch {}
    audio.pause(); audio.removeAttribute('src'); audio.load();
    engine = 'audio'; audioTrackId = t.id; updateMode();
    if (!online()) { toast('Нет интернета — играют только скачанные треки'); return false; }
    setLoading(true);
    // если звук не готов за 12 с — не держим тишину: включаем через встроенный YouTube (если трек это разрешает)
    const slow = setTimeout(() => { if (tok !== loadTok || !ready || !canEmbed(t) || engine !== 'audio' || audio.getAttribute('src')) return; loadTok++; setLoading(false); toast('Звук долго не отдаётся — включаю через встроенный YouTube'); useIframe(t, autoplay, start); }, 12000);
    Promise.resolve().then(() => pulse.resolve(t.id)).catch(e => ({ ok: false, error: String(e.message || e) })).then((r) => {
      clearTimeout(slow); if (r && r.vid && r.vid !== t.id) vidMap[t.id] = r.vid; // 2.0.2: запоминаем запись YouTube для трека сервиса
      if (tok !== loadTok) return;
      if (lib.mode === 'video' && ready && r && r.ok && canEmbed(t) && isSvcId(t.id)) { setLoading(false); return useIframe(t, autoplay, start); }
      if (r && r.ok) { at(); audio.src = `/stream/${t.id}`; if (autoplay) E.play(); else setLoading(false); return; }
      setLoading(false);
      if (ready && canEmbed(t)) { toast('Пробую через встроенный YouTube…'); return useIframe(t, autoplay, start); }
      toast(r ? r.error : 'Не удалось получить звук'); markFailed(t); markRows();
      if (autoplay && ++errStreak <= 8) setTimeout(() => { if (tok === loadTok) next(true); }, 800);
    });
    return true;
  }
};
window.onYouTubeIframeAPIReady = () => {
  player = new YT.Player('ytPlayer', {
    width: '100%', height: '100%',
    playerVars: { autoplay: 0, controls: 1, rel: 0, playsinline: 1, iv_load_policy: 3, fs: 0, origin: location.origin },
    events: {
      onReady: () => { ready = true; player.setVolume(lib.volume); },
      onStateChange: (e) => {
        if (engine !== 'yt') return;
        if (e.data === YT.PlayerState.PLAYING) { playing = true; errStreak = 0; setLoading(false); onStarted(); }
        else if ([0, 2, 5].includes(e.data)) playing = false;
        if (e.data === YT.PlayerState.BUFFERING) setLoading(true);
        if (e.data === YT.PlayerState.ENDED) onEnded();
        onPlayState();
      },
      onError: () => {
        if (engine !== 'yt') return;
        const t = curTrack(); if (!t) return;
        noEmbed[t.id] = true;
        if (lib.mode === 'video') toast('Это видео нельзя показать вне YouTube — играю аудио');
        const tm = E.time(); E.load(t, true, tm);
      }
    }
  });
};

// ---------- очередь и воспроизведение ----------
function setQueue(tracks, idx, name, src) {
  lib.queue = { name: name || '', tracks: tracks.map((t) => ({ ...t })), idx: -1, src: src || null, autoSeed: null };
  hist = []; playIdx(idx);
}
function playList(tracks, i, name, src) {
  const t = tracks[i]; if (!t) return;
  if (!off[t.id] && !online()) return toast('Нет интернета — этот трек не скачан');
  failedAt.delete(t.id); // явный клик — пробуем ещё раз
  setQueue(tracks, i, name, src);
}
function shuffleList(tracks, name, src) {
  const ok = tracks.filter(playable); if (!ok.length) return toast(online() ? 'Нечего играть' : 'Нет скачанных треков');
  const a = ok.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  setQueue(a, 0, name, src);
}
function playIdx(i, fromHist = false) {
  const q = lib.queue, t = q.tracks[i]; if (!t) return;
  if (!fromHist && q.idx >= 0 && q.idx !== i) hist.push(q.idx);
  q.idx = i; remember(t);
  E.load(t, true);
  onTrackChange();
}
function nextIdx(auto) {
  const q = lib.queue, n = q.tracks.length; if (!n) return -1;
  // 2.0.4: дизлайкнутые треки пропускаются (настройка «Пропускать дизлайкнутые»), в волне нет перемешивания — она и так бесконечна
  const ok = q.tracks.map((t, k) => !!playable(t) && (k === q.idx || !(typeof waveSkip === 'function' && waveSkip(t)))); if (!ok.some(Boolean)) return -1;
  if (lib.shuffle && n > 1 && !q.wave) { const left = ok.map((v, k) => (v && k !== q.idx && !hist.includes(k) ? k : -1)).filter((k) => k >= 0); const pool = left.length ? left : ok.map((v, k) => (v && k !== q.idx ? k : -1)).filter((k) => k >= 0); if (!left.length && auto && lib.repeat === 'off') return -1; return pool[Math.floor(Math.random() * pool.length)] ?? -1; }
  for (let s = 1; s <= n; s++) { const i = q.idx + s; if (i >= n && auto && lib.repeat === 'off') return -1; if (ok[i % n]) return i % n; }
  return -1;
}
function next(auto = false) {
  const i = nextIdx(auto);
  if (i >= 0) return playIdx(i);
  if (lib.queue.wave && typeof waveExtend === 'function') { waveExtend(true); return; } // 2.0.4: волна бесконечна (и без интернета — из скачанного)
  if (lib.autoplay && online() && curTrack()) { extendRadio(true); return; }
  if (!auto) toast(online() ? 'Это последний трек в очереди' : 'Нет скачанных треков в очереди');
}
function prev() {
  const q = lib.queue; if (!q.tracks.length) return;
  if (E.time() > 4) return E.seek(0);
  if (hist.length) return playIdx(hist.pop(), true);
  for (let s = 1; s < q.tracks.length; s++) { const i = q.idx - s; if (i < 0) break; if (playable(q.tracks[i])) return playIdx(i, true); }
  E.seek(0);
}
function toggle() {
  const t = curTrack();
  if (!t) return;
  if ((engine === 'yt' && (off[t.id] || !ready)) || (engine === 'audio' && !audio.getAttribute('src') && audioTrackId !== t.id)) { E.load(t, true); return; }
  if (engine === 'audio' && !audio.getAttribute('src')) { E.load(t, true); return; }
  playing ? E.pause() : E.play();
}
function onEnded() { if (engine === 'audio' && typeof djOnEnded === 'function' && djOnEnded()) return; PX.emit('ended', curTrack()); /* 2.0.4: «дослушал до конца» — плюс в волну */ if (lib.repeat === 'one') { E.seek(0); E.play(); } else next(true); }
function onPlayState() { if ('mediaSession' in navigator) navigator.mediaSession.playbackState = curTrack() ? (playing ? 'playing' : 'paused') : 'none'; updateButtons(); document.body.classList.toggle('playing', playing); sendState(); }
function setVolume(v) { lib.volume = Math.max(0, Math.min(100, Math.round(v))); E.volume(lib.volume); updateButtons(); save(); sendState(); }
function seekFrac(f) { const d = E.dur(); if (d) E.seek(d * Math.max(0, Math.min(1, f))); }
const toggleShuffle = () => { lib.shuffle = !lib.shuffle; hist = []; updateButtons(); save(); sendState(); toast(lib.shuffle ? 'Перемешивание включено' : 'Перемешивание выключено'); };
const cycleRepeat = () => { lib.repeat = { off: 'all', all: 'one', one: 'off' }[lib.repeat]; updateButtons(); save(); sendState(); toast({ off: 'Повтор выключен', all: 'Повтор очереди', one: 'Повтор трека' }[lib.repeat]); };

// радио / автовоспроизведение
const nextCache = new Map();
async function nextInfo(id, list) {
  const k = id + '|' + (list || ''); if (nextCache.has(k)) return nextCache.get(k);
  const p = pulse.ytm.next(id, list).then((r) => (r && !r.error ? r : null)).catch(() => null);
  nextCache.set(k, p); if (nextCache.size > 40) nextCache.delete(nextCache.keys().next().value);
  return p;
}
async function playRadio(t, list) {
  if (!online()) return toast('Нет интернета — радио недоступно');
  if (t) { setQueue([t], 0, `Радио: ${t.title}`); }
  else toast('Запускаю радио…', 'radio');
  const r = await nextInfo(t ? t.id : undefined, list);
  if (!r || !r.tracks.length) return toast('Не удалось собрать радио');
  const q = lib.queue;
  if (t) { if (curTrack() !== q.tracks[0] || q.tracks[0].id !== t.id) return; const rest = r.tracks.filter((x) => x.id !== t.id); q.tracks.push(...rest); q.autoSeed = t.id; renderQueue(); save(); }
  else setQueue(r.tracks, 0, 'Радио');
}
let extending = false;
async function extendRadio(playAfter) {
  if (lib.queue.wave && typeof waveExtend === 'function') return waveExtend(playAfter); // 2.0.4
  const q = lib.queue, last = q.tracks[q.tracks.length - 1];
  if (!last || extending || !lib.autoplay || !online() || q.autoSeed === last.id) return;
  extending = true;
  try {
    const r = await nextInfo(last.id);
    q.autoSeed = last.id;
    if (r && r.tracks.length) {
      const have = new Set(q.tracks.map((x) => x.id));
      const add = r.tracks.filter((x) => !have.has(x.id)).slice(0, 25).map((x) => ({ ...x, auto: true }));
      q.tracks.push(...add); renderQueue(); save();
      if (playAfter && add.length) playIdx(q.tracks.length - add.length);
    }
  } finally { extending = false; }
}
function playNextUp(t, end) {
  const q = lib.queue;
  if (!q.tracks.length) return setQueue([t], 0, t.title);
  const c = { ...t }; delete c.auto;
  if (end) q.tracks.splice(q.tracks.findIndex((x, k) => x.auto && k > q.idx) >= 0 ? q.tracks.findIndex((x, k) => x.auto && k > q.idx) : q.tracks.length, 0, c);
  else q.tracks.splice(q.idx + 1, 0, c);
  renderQueue(); save(); toast(end ? 'Добавлено в очередь' : 'Сыграет следующим', 'queue');
}

// предзагрузка ссылки на звук, пока мышь над треком — клик стартует почти мгновенно
let hovT = null, hovId = null; const prefetched = new Set();
document.addEventListener('mouseover', (e) => {
  const r = e.target.closest && e.target.closest('.tr[data-id],.card[data-id]'), id = r && r.dataset.id; if (id === hovId) return; hovId = id; clearTimeout(hovT);
  if (!id || !/^[\w-]{11}$/.test(id) || off[id] || !online() || prefetched.has(id) || !pulse.prefetch) return;
  hovT = setTimeout(() => { prefetched.add(id); pulse.prefetch(id); }, 300);
}, { passive: true });
// после старта воспроизведения
let startedId = null;
function onStarted() {
  applySpeed();
  const t = curTrack(); if (!t) return;
  updateNow();
  if (startedId === t.id) return; startedId = t.id;
  // подгружаем следующий
  const i = nextIdx(true), n = lib.queue.tracks[i];
  // 2.0.12: следующий трек готовим полностью (с запасным путём yt-dlp), если быстрые способы YouTube не справились —
  // раньше предзагрузка запасной путь не трогала, и следующий трек мог грузиться 5–15 с. Через 3 с, чтобы не мешать старту текущего
  if (n && !off[n.id] && online()) { const nid = n.id; (pulse.prefetch || pulse.resolve)(nid); setTimeout(() => { if (curTrack() && curTrack().id === t.id && pulse.resolve) pulse.resolve(nid).catch(() => {}); }, 3000); }
  if (lib.queue.idx >= lib.queue.tracks.length - 3) extendRadio(false);
  analyzeCurrent(t);
}

// ---------- «сейчас играет» ----------
let palTok = 0;
function applyPalette(src) {
  const tok = ++palTok;
  Viz.palette(src).then((p) => {
    if (tok !== palTok) return;
    p = fixedPalette() || p || [[255, 45, 149], [139, 61, 255], [0, 229, 255]];
    setPaletteVars(p);
  }).catch(() => {});
}
// 2.0.3: размытый фон из обложки рисуется ОДИН раз в маленькую картинку (canvas), а не CSS-фильтром blur(90px).
// CSS-размытие на весь экран под визуалом, который перерисовывается каждый кадр, браузер пересчитывал каждый кадр —
// это и съедало FPS во вкладке «Визуал» и в караоке. Маленькая картинка, растянутая на экран, выглядит так же размыто.
const blurCache = new Map();
// Final: viewport-sized cached PNG + stationary sub-LSB dither. Previously a tiny stretched JPEG produced
// «квадраты» и резкие перегибы яркости (как будто выкрутили контраст). Шум-дизеринг из 2.0.8 убран — он давал зерно и пятна.
function blurImage(src, { w = Math.min(1536, Math.max(768, Math.round(innerWidth * Math.min(devicePixelRatio || 1, 1.5)))), blur = 90, sat = 1.5, bright = 0.35, elW = innerWidth } = {}) {
  const key = [src, w, blur, sat, bright, Math.round(elW / 200)].join('|');
  if (blurCache.has(key)) return blurCache.get(key);
  const p = new Promise((res) => {
    const im = new Image(); im.decoding = 'async';
    im.onload = () => {
      try {
        const r = Math.max(0.5, blur * w / Math.max(200, elW)), pad = Math.ceil(r * 2.5);
        const c = document.createElement('canvas'); c.width = w; c.height = w; const g = c.getContext('2d');
        g.filter = `blur(${r.toFixed(2)}px) saturate(${sat}) brightness(${bright})`;
        g.drawImage(im, -pad, -pad, w + pad * 2, w + pad * 2);
        // Decode the finished blur before publishing it; the previous background stays visible.
        const pixels=g.getImageData(0,0,w,w), data=pixels.data;
        // Sub-LSB stationary dither prevents 8-bit dark-gradient contouring after enlargement.
        // Independent RGB channels, deterministic, no per-frame or random texture updates.
        let noise=0x51f15e;
        for(let i=0;i<data.length;i+=4)for(let ch=0;ch<3;ch++){noise=(Math.imul(noise,1664525)+1013904223)>>>0;data[i+ch]=Math.max(0,Math.min(255,data[i+ch]+((noise>>>30)===0?-1:(noise>>>30)===3?1:0)));}
        g.putImageData(pixels,0,0);
        const url = c.toDataURL('image/png'), ready = new Image();
        ready.onload = () => res(url); ready.onerror = () => res(null); ready.src = url;
      } catch { res(null); }
    };
    im.onerror = () => res(null); im.src = src;
  });
  blurCache.set(key, p); if (blurCache.size > 6) blurCache.delete(blurCache.keys().next().value);
  return p;
}
let preBlurSrc = null, preBlurTok = 0; var preBlurSig = '';
function preBlurCover(src) {
  src = src || preBlurSrc; if (!src) return; preBlurSrc = src; const tok = ++preBlurTok;
  const L = S().look, blur = Number.isFinite(+L.blurAmt) ? Math.max(0,+L.blurAmt) : 90, bright = (L.ambBright ?? 35) / 100;
  const set = (id, url) => { const el = $(id); if (!el) return; if (url) { el.style.backgroundImage = `url("${url}")`; el.classList.add('pre'); if (id === 'ambImg') el.classList.add('on'); } };
  const ag = $('artGlow'), agW = (ag && ag.offsetWidth) || 420;
  Promise.all([blurImage(src, { blur, sat: 1.5, bright }), blurImage(src, { blur, sat: 1.6, bright }), blurImage(src, { w: 128, blur: 50, sat: 2, bright: 1, elW: agW })]).then(([a, b, c]) => {
    if (tok !== preBlurTok) return; set('ambImg', a); set('ppBg', b); set('artGlow', c);
  });
}
let coverId = null;
function setCover(t) {
  if (coverId === t.id) return; coverId = t.id;
  const id = t.id, small = artOf(t, 226);
  // Never put a raw cover on a .pre layer: retain the last blur until the next one is ready.
  preBlurCover(small);
  { const im = new Image(); im.onload = () => { if (coverId === id) coverImg = im; }; im.src = small; }
  $('bArt').style.backgroundImage = `url("${artOf(t, 120)}")`;
  applyPalette(small);
  const c = $('cover');
  const apply = (src, full) => { if (coverId !== id) return; if (c._sw !== id) { c._sw = id; c.classList.remove('swap'); void c.offsetWidth; c.classList.add('swap'); } // 2.0.4-fix: обложка проявляется при смене трека
    c.style.backgroundImage = `url("${src}")`; c.style.backgroundSize = full ? 'cover' : 'auto 134%'; };
  const o = off[id];
  if (o && o.kind === 'square') { apply(`/offline/${id}.jpg`, true); return; }
  if (t.art && !t.video) { apply(pimg(sized(t.art, 1200)), true); return; }
  if (o && !online()) { apply(`/offline/${id}.jpg`, !t.video && !t.art); return; }
  const img = new Image(), main = pimg(`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`), hq = pimg(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`);
  img.onload = () => { const r = img.naturalWidth / img.naturalHeight; img.naturalWidth > 200 && r > 1.5 ? apply(main, false) : apply(hq, false); };
  img.onerror = () => apply(o ? `/offline/${id}.jpg` : hq, false);
  img.src = main;
}
function artistLinks(t) {
  if (t.artists && t.artists.length) return t.artists.map((a) => (a.id ? `<a data-b="${esc(a.id)}">${esc(a.name)}</a>` : esc(a.name))).join(', ');
  return t.artistId ? `<a data-b="${esc(t.artistId)}">${esc(t.author)}</a>` : esc(t.author || '');
}
function updateNow() {
  const t = curTrack();
  if (!t) { if ('mediaSession' in navigator) { navigator.mediaSession.metadata = null; navigator.mediaSession.playbackState = 'none'; } $('bTitle').textContent = PulseI18n.t('Ничего не играет'); $('bSub').textContent = PulseI18n.t('Найди песню в поиске'); return; }
  if (needsHeal(t)) healTrack(t);
  $('bTitle').textContent = t.title && t.title !== t.id ? t.title : 'Загружаю название…';
  $('bSub').innerHTML = artistLinks(t) + (t.album && t.album.name && t.album.name.toLowerCase() !== (t.title || '').toLowerCase() ? ` • ${t.album.id ? `<a data-b="${esc(t.album.id)}">${esc(t.album.name)}</a>` : esc(t.album.name)}` : '');
  document.title = `${t.title} — ${t.author} · Pulse`;
  setCover(t); updateLike(); updateDlCur();
  if ('mediaSession' in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.author || '', album: t.album?.name || '', artwork: [{ src: location.origin + artOf(t, 544), sizes: '544x544' }] });
  PX.emit('track', t);
}
function onTrackChange() {
  const t = curTrack(); startedId = null; beatState.an = null; beatState.kp = -1;
  updateNow(); markRows(); renderQueue(); save(); sendState();
  if (t) { loadLyricsFor(t); if ($('tabRelated').classList.contains('on')) renderRelated(); else relFor = null; }
}
function updateButtons() {
  $('icoPlay').innerHTML = `<use href="#i-${playing ? 'pause' : 'play'}"/>`;
  $('btnShuffle').classList.toggle('on', lib.shuffle);
  $('btnRepeat').classList.toggle('on', lib.repeat !== 'off'); $('btnRepeat').classList.toggle('rep-one', lib.repeat === 'one');
  $('vol').value = lib.volume; $('vol').style.setProperty('--v', lib.volume + '%');
  $('volIco').innerHTML = `<use href="#i-${lib.volume ? 'volume' : 'mute'}"/>`;
  const V = vizStyle(); $('vizName').textContent = V ? V.name : ''; $('vizIco').innerHTML = `<use href="#i-${V && V.icon ? V.icon : 'palette'}"/>`;
  document.body.dataset.vcover = V ? V.cover || 'hide' : 'show';
}
function updateMode() {
  const m = lib.mode, b = document.body;
  b.classList.toggle('mode-visual', m === 'visual'); b.classList.toggle('mode-video', m === 'video');
  $('artWrap').classList.toggle('video', m === 'video' && (engine === 'yt' || !!window.PulseFileVideo?.visible()));
  window.PulseFileVideo?.render();
  document.querySelectorAll('#ppSwitch button').forEach((x) => x.classList.toggle('on', x.dataset.mode === m));
}
function setMode(m) {
  lib.mode = m; const t = curTrack();
  if (t && off[t.id] && (m === 'video' || window.PulseFileVideo?.active())) {
    const tm = E.time(), was = playing; E.load(t, was, tm);
  } else if (m === 'video' && t && engine === 'audio') {
    if (off[t.id] && !online()) toast('Скачанный трек — только аудио, видео доступно онлайн');
    else if (!ready || !canEmbed(t)) toast('Это видео нельзя показать вне YouTube — играет аудио');
    else { const tm = E.time(), was = playing; useIframe(t, was, tm); }
  } else if (m !== 'video' && t && engine === 'yt') { const tm = E.time(), was = playing; E.load(t, was, tm); }
  updateMode(); save(); lyState.cur = -2;
}
function updateNet() { const n = online(); $('net').textContent = n ? 'онлайн' : 'офлайн'; $('net').classList.toggle('off', !n); markRows(); }
function sendState() {
  const t = curTrack();
  const o = ({ has: !!t, id: t?.id, art: t ? artOf(t, 226) : null, square: !!t && (!!t.art || (off[t.id] && off[t.id].kind === 'square')), offline: !!(t && off[t.id] && !t.art), title: t ? t.title : 'Ничего не играет', author: t ? t.author : '',
    playing, cur: E.time(), dur: E.dur(), shuffle: lib.shuffle, repeat: lib.repeat, volume: lib.volume, line: lyState.curText || '', liked: !!t && isLiked(t.id), disliked: !!(t && lib.dislikes && lib.dislikes[t.id]), wave: !!lib.queue.wave, album: t && t.album && t.album.name ? t.album.name : '', artistId: t ? t.artistId || null : null, artUrl: t ? (t.art ? sized(t.art, 512) : `https://i.ytimg.com/vi/${t.id}/hqdefault.jpg`) : null, video: !!(t && t.video), off: lyState.id === t?.id ? offset() : 0 }); pulse.sendState(o); if (window.pvWidgetPush) window.pvWidgetPush(o);
}

// ---------- лайки ----------
const likeSvc = (id) => (isSvcId(id) ? String(id).slice(0, 2) : 'yt');
const likeUser = (sv) => (sv === 'yt' ? !!account : !!(typeof svcSt !== 'undefined' && svcSt[sv] && svcSt[sv].user));
const likeName = (sv) => ({ yt: 'YouTube Music', am: 'Apple Music', sp: 'Spotify' })[sv];
function toggleLike(t) {
  if (!t) return; lib.likes = lib.likes || {}; lib.likeQ = lib.likeQ || [];
  const on = !lib.likes[t.id]; remember(t);
  if (on) lib.likes[t.id] = 1; else delete lib.likes[t.id];
  if(t.id.startsWith('local-')){save();updateLike();toast(on?'Нравится · сохранено на устройстве':'Лайк снят');return;}
  // 2.0.3: лайк уходит на сервер сервиса, из которого трек; без входа/интернета — ждёт в очереди и отправится сам
  lib.likeQ = lib.likeQ.filter((x) => x.id !== t.id); lib.likeQ.push({ id: t.id, on, at: Date.now(), n: 0 });
  const sv = likeSvc(t.id);
  if (!likeUser(sv)) toast(`${on ? 'Нравится' : 'Лайк снят'} — сохранится в ${likeName(sv)} после входа в аккаунт`, 'heart-f');
  else if (!online()) toast(`${on ? 'Нравится' : 'Лайк снят'} — отправлю в ${likeName(sv)}, когда появится интернет`, 'heart-f');
  else toast(on ? `Нравится · сохранено в ${likeName(sv)}` : `Убрано из «Понравившихся» в ${likeName(sv)}`, 'heart-f');
  save(); updateLike(); flushLikes(); PX.emit('like', { t, on }); // 2.0.4: волна учится на лайках
  document.querySelectorAll(`[data-like="${CSS.escape(t.id)}"]`).forEach((b) => { b.classList.toggle('liked', on); b.innerHTML = ico(on ? 'heart-f' : 'heart'); });
}
// отправка лайков на сервер (по одному, по порядку); неудачные повторяются позже, после 6 попыток — сообщаем
let likeBusy = false;
async function flushLikes() {
  if (likeBusy || !online() || !lib.likeQ || !lib.likeQ.length) return; likeBusy = true;
  try {
    for (const x of [...lib.likeQ]) {
      const sv = likeSvc(x.id); if (!likeUser(sv)) continue;
      const r = await pulse.ytm.like(x.id, x.on).catch((e) => ({ error: String(e) }));
      if (r && r.error) { if (++x.n >= 6) { lib.likeQ = lib.likeQ.filter((q) => q !== x); toast(`${likeName(sv)} не принял ${x.on ? 'лайк' : 'снятие лайка'}: ${r.error}`, 'alert'); } continue; }
      lib.likeQ = lib.likeQ.filter((q) => q !== x);
      cache.delete && (cache.delete('b:VLLM'), cache.delete('b:' + sv + ':liked'));
    }
  } finally { likeBusy = false; save(); }
}
// лайки, поставленные на сервере (в приложении сервиса или на другом устройстве), тоже горят сердечком в Pulse
async function pullLikes(sv) {
  if (!online() || !likeUser(sv)) return;
  try {
    const d = await ytm('browse', sv === 'yt' ? 'VLLM' : sv + ':liked'); const tr0 = (d && d.tracks) || []; if (!tr0.length) return;
    lib.likes = lib.likes || {}; const pend = new Set((lib.likeQ || []).map((x) => x.id));
    tr0.forEach((t) => { if (!t || !t.id || pend.has(t.id)) return; lib.likes[t.id] = 1; remember(t); });
    save(); updateLike();
    document.querySelectorAll('[data-like]').forEach((b) => { const on = !!lib.likes[b.dataset.like]; if (on !== b.classList.contains('liked')) { b.classList.toggle('liked', on); b.innerHTML = ico(on ? 'heart-f' : 'heart'); } });
  } catch {}
}
setInterval(() => { if (lib.likeQ && lib.likeQ.length) flushLikes(); }, 60e3);
function updateLike() { const t = curTrack(), on = !!t && isLiked(t.id); $('btnLike').classList.toggle('liked', on); $('btnLike').innerHTML = ico(on ? 'heart-f' : 'heart'); }

// ---------- загрузки ----------
function download(tracks, video = false) {
  tracks = tracks.filter((t) => t && (!off[t.id] || video) && !(dl[t.id] && /queued|downloading/.test(dl[t.id].status)));
  if (!tracks.length) return toast('Всё уже скачано');
  if (!online()) return toast('Нет интернета — скачать не получится');
  tracks.forEach((t) => { dl[t.id] = { status: 'queued', pct: 0 }; remember(t); updDl(t.id); }); save();
  pulse.download(tracks.map((t) => ({ id: t.id, art: t.art && !t.video ? t.art : null, video }))); updateDlCur();
  toast(tracks.length > 1 ? `В очереди на скачивание: ${tracks.length}` : 'Скачиваю трек');
}
async function removeDownload(id) {
  if (audioTrackId === id && engine === 'audio' && off[id]) { toast('Сначала переключи трек'); return; }
  await pulse.removeDownload(id); const v = off[id] && off[id].vid; delete off[id]; delete dl[id];
  if (v) { delete off[v]; Object.keys(off).forEach((k) => off[k].vid === v && delete off[k]); } // 2.0.2: файл общий с записью YouTube
  updDl(id); updateDlCur(); updOffCount(); toast('Удалено с устройства');
  if(id.startsWith('local-')&&window.MediaLibrary){await MediaLibrary.init();renderSide();}
  if (['downloads','local'].includes(route().r)) renderRoute(true);
}
function dlInner(id) {
  if (off[id]) return { c: 'done keep', h: ico('check'), t: 'Скачано · варианты загрузки' };
  const d = dl[id];
  if (d && d.status === 'downloading') return { c: 'keep', h: `<span class="ring" style="--p:${Math.round(d.pct || 0)}"></span>`, t: `Скачивается ${Math.round(d.pct || 0)}% · нажми для отмены` };
  if (d && d.status === 'queued') return { c: 'keep', h: `<span class="ring" style="--p:0"></span>`, t: 'В очереди · нажми для отмены' };
  if (d && d.status === 'error') return { c: 'err', h: ico('alert'), t: 'Ошибка — нажми, чтобы повторить' };
  return { c: '', h: ico('download'), t: 'Скачать' };
}
function dlBtn(id) { const d = dlInner(id); return `<button class="ib ${d.c}" data-dl="${esc(id)}" title="${d.t}">${d.h}</button>`; }
function updDl(id) { const d = dlInner(id); document.querySelectorAll(`.tr [data-dl="${CSS.escape(id)}"]`).forEach((b) => { b.className = 'ib ' + d.c; b.innerHTML = d.h; b.title = d.t; }); if (curTrack()?.id === id) updateDlCur(); }
function updateDlCur() { const t = curTrack(), b = $('btnDlCur'); if (!t) return; const d = dlInner(t.id); b.innerHTML = d.h; b.title = d.t; b.classList.toggle('done', !!off[t.id]); }
function downloadChoices(tracks) {
  const items = [['download', 'Только аудио', () => download(tracks)], ['video', 'Вместе с видео', () => download(tracks, true)]];
  if (tracks.length === 1 && off[tracks[0].id]) items.push('-', ['trash', 'Удалить с устройства', () => removeDownload(tracks[0].id)]);
  return items;
}
function downloadMenu(tracks, anchor) {
  const r = (anchor || $('btnDlCur')).getBoundingClientRect();
  showMenu(r.left, r.bottom + 6, downloadChoices(tracks));
}
function dlClick(t, anchor) {
  if (dl[t.id] && /queued|downloading/.test(dl[t.id].status)) pulse.cancelDownload(t.id);
  else downloadMenu([t], anchor);
}
function updOffCount() { const n = offlineTracks().length; $('offCount').textContent = n || ''; }
pulse.onDownload((ev) => {
  dl[ev.id] = ev;
  if (ev.status === 'done') {
    const t = lib.known[ev.id];
    off[ev.id] = { ...off[ev.id],file: ev.file, audioFile:ev.audioFile||null, videoFile:ev.videoFile||null,hasVideo:!!ev.videoFile, kind: t && t.art && !t.video ? 'square' : null, ...(ev.vid ? { vid: ev.vid } : {}) }; delete dl[ev.id]; updOffCount();
    // офлайн-комплект: текст скачивается вместе с треком
    if (t) (lib.lyrics[ev.id] ? Promise.resolve() : fetchLyrics(t)).catch(() => {});
  }
  if (ev.status === 'error') toast(`Ошибка загрузки: ${ev.error}`);
  if (ev.status === 'none') delete dl[ev.id];
  updDl(ev.id);
});

// ---------- разметка: треки, карточки, полки ----------
function trackRow(t, i, key, o = {}) {
  if(window.MediaLibrary)t=MediaLibrary.decorate(t);
  const cur = curTrack(), isCur = cur && cur.id === t.id;
  const cls = ['tr', isCur ? 'cur' : '', failed(t) ? 'broken' : '', !off[t.id] && !online() ? 'nonet' : ''].join(' ');
  const lead = o.num ? `<div class="num">${o.n ?? i + 1}</div>` : `<div class="ta"><img loading="lazy" src="${esc(artOf(t, 120))}" ${IMG_ERR}/><div class="po">${ico('play')}${EQI}</div></div>`;
  const album = !o.noAlbum && t.album && t.album.name ? (t.album.id ? `<a data-b="${esc(t.album.id)}">${esc(t.album.name)}</a>` : esc(t.album.name)) : '';
  const sub = t.plays && o.stack ? `${artistLinks(t)} • ${esc(t.plays)}` : artistLinks(t);
  const meta = o.stack
    ? `<div class="tm stack"><div class="tt">${esc(t.title)}${t.video ? '<span class="vbadge">ВИДЕО</span>' : ''}</div><div class="ar">${sub}${album && !o.noAlbum && o.stackAlbum ? ' • ' + album : ''}</div></div>`
    : `<div class="tm"><div class="tt">${esc(t.title)}${t.video ? '<span class="vbadge">ВИДЕО</span>' : ''}</div>${o.noArtist ? '' : `<div class="ar">${sub}</div>`}${o.noAlbum ? '' : `<div class="al">${album}</div>`}</div>`;
  const liked = isLiked(t.id);
  const acts = o.noActs ? '' : t.id.startsWith('local-') ? `<div class="acts"><button class="ib" data-media-edit="${esc(t.id)}" title="Редактировать метаданные">${ico('edit')}</button><button class="ib" data-more title="Ещё">${ico('more')}</button></div>` : `<div class="acts"><button class="ib ${liked ? 'liked' : ''}" data-like="${esc(t.id)}" title="Нравится">${ico(liked ? 'heart-f' : 'heart')}</button>${dlBtn(t.id)}<button class="ib" data-more title="Ещё">${ico('more')}</button></div>`;
  return `<div class="${cls}" data-l="${key}" data-i="${i}" data-id="${esc(t.id)}">${lead}${meta}${acts}${o.noDur ? '' : `<div class="du">${t.dur ? fmt(t.dur) : ''}</div>`}</div>`;
}
function trackList(tracks, ctx, o = {}) {
  const key = reg({ tracks, ...ctx });
  return `<div class="tl">${tracks.map((t, i) => trackRow(t, i, key, o)).join('')}</div>`;
}
function markRows() {
  const cur = curTrack();
  document.querySelectorAll('.tr[data-id]').forEach((r) => {
    r.classList.toggle('cur', !!cur && r.dataset.id === cur.id);
    const L = got(r.dataset.l), t = L && L.tracks[+r.dataset.i];
    if (t) { r.classList.toggle('broken', failed(t)); r.classList.toggle('nonet', !off[t.id] && !online()); }
  });
}
function card(it, key, i) {
  if (it.kind === 'mood') return `<div class="card mood" data-c="${key}" data-i="${i}" style="--c:${esc(it.color || '#888')}"><div class="ca">${esc(it.kind === 'local' && (it.id === '__local' || it.id === '__off' || it.id === MINE) ? translateUiText(it.title) : it.title)}</div></div>`;
  const round = it.round || it.kind === 'artist', vid = it.kind === 'song' && it.video;
  const sub = it.kind === 'song' ? [it.author, it.plays].filter(Boolean).join(' • ') : it.sub || '';
  const noArt = !it.icon && it.kind !== 'song' && it.kind !== 'local' && !it.art;
  const img = it.icon ? `<div class="ca-ico">${ico(it.icon)}</div>` : noArt ? `<div class="ca-ico ph">${ico(it.kind === 'artist' ? 'user' : it.kind === 'album' ? 'disc' : 'queue')}</div>` : `<img loading="lazy" src="${esc(it.kind === 'song' && vid ? pimg(`https://i.ytimg.com/vi/${it.id}/mqdefault.jpg`) : /^(\/|https?:)/.test(it.art || '') && it.kind === 'local' ? pimg(it.art) : artOf(it, 300))}" ${IMG_ERR}/>`;
  return `<div ${it.kind==='playlist'&&it.browseId?`data-playlist-art="${esc(it.browseId)}"`:""} class="card ${round ? 'round' : ''} ${vid ? 'vid' : ''}" data-c="${key}" data-i="${i}"><div class="ca">${img}${it.kind === 'artist' ? '' : `<button class="cplay" data-cp title="Слушать">${ico('play')}</button>`}</div><div class="ct">${esc(it.kind === 'local' && (it.id === '__local' || it.id === '__off' || it.id === MINE) ? translateUiText(it.title) : it.title)}</div><div class="cs">${it.kind === 'local' ? `<span data-i18n-ui>${esc(sub)}</span>` : esc(uiOwnedText(sub))}</div></div>`;
}
function cards(items, o = {}) {
  const key = reg({ items });
  return `<div class="${o.grid ? 'grid' : 'row'} ${o.big ? 'big' : ''}">${items.map((it, i) => card(it, key, i)).join('')}</div>`;
}
// 1.9.7: YouTube Music подписывает полку «Послушать ещё раз» именем аккаунта — а сверху уже есть «Привет, …». Дубль убираем.
function strapIsMe(t) {
  if (!account || !account.name) return false;
  const n = (x) => String(x || '').toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, '');
  const a = n(t); return !!a && (a === n(account.name) || a === n(account.name.split(' ')[0]));
}
function shelfHead(s, nav) {
  const more = s.more ? reg({ more: s.more }) : null;
  return `<div class="sh-head"><div class="tt">${s.strap && !strapIsMe(s.strap) ? `<div class="sh-strap">${esc(s.strap)}</div>` : ''}<div class="sh-title ${more ? 'link' : ''}" ${more ? `data-more="${more}"` : ''}>${esc(s.title || '')}</div></div>${more ? `<button class="btn" data-more="${more}">Ещё</button>` : ''}${nav ? `<div class="sh-nav"><button class="ib" data-sc="-1">${ico('back')}</button><button class="ib" data-sc="1">${ico('fwd')}</button></div>` : ''}</div>`;
}
function shelf(s, o = {}) {
  const items = (s.items || []).filter(Boolean);
  if (s.desc) return `<div class="shelf">${s.title ? shelfHead(s) : ''}<div class="desc-shelf">${esc(s.desc)}</div></div>`;
  if (!items.length) return '';
  const songs = items.every((x) => x.kind === 'song');
  if (items.every((x) => x.kind === 'mood')) { const key = reg({ items }); return `<div class="shelf">${shelfHead(s, true)}<div class="moods row">${items.map((it, i) => card(it, key, i)).join('')}</div></div>`; }
  if (songs && (s.list || o.list)) return `<div class="shelf">${s.title ? shelfHead(s) : ''}${trackList(items, { name: s.title || o.name || 'Треки', src: o.src }, o.list ? { stack: true, noAlbum: true, noDur: true } : {})}</div>`;
  if (songs && !items.every((x) => x.video)) {
    const key = reg({ tracks: items, name: s.title });
    return `<div class="shelf">${shelfHead(s, items.length > 4)}<div class="qp">${items.map((t, i) => trackRow(t, i, key, { stack: true, noAlbum: true, noDur: true })).join('')}</div></div>`;
  }
  return `<div class="shelf">${shelfHead(s, items.length > 4)}${cards(items, { big: o.big })}</div>`;
}
const shelves = (list, o) => (list || []).map((s) => shelf(s, o)).join('');
const loadingHtml = '<div class="loading"><div class="spinner"></div></div>';
const emptyHtml = (icon, title, sub, btn) => `<div class="empty">${ico(icon)}<b>${esc(title)}</b>${sub || ''}${btn || ''}</div>`;

// ---------- навигация ----------
const navS = { stack: [], pos: -1 };
const route = () => navS.stack[navS.pos] || { r: 'home' };
const cache = new Map();
let pageTok = 0;
function updNav() { const pp = document.body.classList.contains('pp-open'); $('btnBack').disabled = !pp && navS.pos <= 0; $('btnFwd').disabled = !(navS.ppFwd === navS.pos && !pp && curTrack()) && navS.pos >= navS.stack.length - 1; }
function go(r) {
  closePP(); navS.ppFwd = false;
  const cur = route(); if (cur) cur.scroll = $('view').scrollTop;
  if (JSON.stringify({ ...cur, scroll: 0 }) === JSON.stringify({ ...r, scroll: 0 })) return renderRoute(true);
  navS.stack = navS.stack.slice(0, navS.pos + 1); navS.stack.push(r); navS.pos++;
  if (navS.stack.length > 60) { navS.stack.shift(); navS.pos--; }
  renderRoute();
}
function back() { if (document.body.classList.contains('pp-open')) { closePP(); navS.ppFwd = navS.pos; return updNav(); } if (navS.pos > 0) { route().scroll = $('view').scrollTop; navS.pos--; renderRoute(false, true); } }
// «вперёд» после «назад» из плеера снова открывает плеер (раньше эта кнопка была просто мёртвой)
function fwd() {
  if (navS.ppFwd !== false && navS.ppFwd != null && navS.ppFwd === navS.pos && curTrack()) { navS.ppFwd = false; openPP(); return updNav(); }
  if (navS.pos < navS.stack.length - 1) { route().scroll = $('view').scrollTop; navS.pos++; renderRoute(false, true); }
}
const goBrowse = (id, params) => go({ r: 'browse', id, params: params || null });
function setPage(html, restore, same) {
  const p = $('page'), y = $('view').scrollTop; leaveP = null;
  // 2.0.4: обновление той же страницы — без анимации вовсе (иначе она моргает); если разметка не изменилась — не трогаем DOM
  const sig = String(html).replace(/"k\d+"/g, '');
  if (same && p._sig === sig && !p.classList.contains('leave')) return;
  p._sig = sig; p.innerHTML = html; p.classList.remove('fade', 'leave');
  if (!same) { void p.offsetWidth; p.classList.add('fade'); }
  $('view').scrollTop = same ? y : restore ? route().scroll || 0 : 0;
  PX.emit('page', route());
}
let catalogLanguageSync = Promise.resolve();
async function syncCatalogLanguage() {
  const language = S().app.language;
  const pending = catalogLanguageSync.then(() => pulse.svc.setClient(CL(), { amSf: S().app.amSf || 'auto', language })).catch(e => { console.warn('Catalog language sync', e); });
  catalogLanguageSync = pending;
  await pending;
}
async function cached(key, fn, force) {
  key = S().app.language + '|' + key;
  if (CL() !== 'yt') key = CL() + '|' + key; // 2.0.2: у каждого клиента свои страницы
  const c = cache.get(key);
  if (c && !force && Date.now() - c.at < 10 * 60e3) return c.v;
  const v = await fn(); if (v && !v.error) cache.set(key, { v, at: Date.now() }); return v;
}
// 2.0.4: плавная смена страниц — старая страница затухает, новая проявляется. Пока грузится — старая остаётся,
// спиннер появляется только если ответ задерживается (раньше: страница → спиннер → страница, всё рывками)
let leaveP = null, lastPageKey = '';
// 1.0.0: read the live OS preference; it must also skip JS close/route delays.
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const animOn = () => !document.body.classList.contains('no-anim') && !motionPreference.matches;
function pageLeave() {
  const p = $('page'); if (!animOn() || !p.firstElementChild) return Promise.resolve();
  if (leaveP) return leaveP;
  p.classList.remove('fade', 'soft'); p.classList.add('leave');
  return (leaveP = new Promise((res) => setTimeout(res, 120)));
}
async function renderRoute(force, restore) {
  const r = route(), tok = ++pageTok;
  document.body.dataset.page = r.r;
  window.PulseHomePerf?.reset();
  updNav();
  document.querySelectorAll('.nv').forEach((n) => n.classList.toggle('on', n.dataset.go === r.r));
  renderSideOn();
  const key = S().app.language + '|' + CL() + '|' + JSON.stringify({ ...r, scroll: 0 }), same = key === lastPageKey; lastPageKey = key;
  const P = PAGES[r.r] || PAGES.home;
  let sync;
  try { sync = P.sync && P.sync(r); } catch (e) { console.error('Page render', r.r, e); sync = errHtml(e && e.message); }
  if (sync != null) { if (!same) await pageLeave(); if (tok !== pageTok) return; return setPage(sync, restore, same); }
  let html, done = false;
  const job = Promise.resolve().then(() => P.load(r, force)).catch((e) => errHtml(e && e.message)).then((h) => { html = h; done = true; });
  if (!same) await pageLeave();
  if (tok !== pageTok) return;
  if (!done) await Promise.race([job, new Promise((res) => setTimeout(res, same ? 900 : 200))]);
  if (tok !== pageTok) return;
  // спиннер — без анимации страницы (он сам мягко проявляется), иначе потом страница проявлялась бы второй раз — «моргание»
  if (!done) { const p = $('page'); leaveP = null; p._sig = ''; p.classList.remove('fade', 'leave'); p.innerHTML = loadingHtml; await job; if (tok !== pageTok) return; }
  setPage(html, restore, same);
}
function errHtml(msg) {
  if (!online()) return emptyHtml('offline', 'Нет интернета', '<div>Пока сети нет, слушай скачанное</div>', `<br><button class="btn w" data-go="downloads">${ico('offline')}Скачанное</button>`);
  return emptyHtml('alert', 'Не удалось загрузить', `<div>${esc(msg || 'YouTube Music не ответил')}</div>`, `<br><button class="btn" data-act="reload">${ico('refresh')}Повторить</button>`);
}
const ytm = async (fn, ...a) => { await catalogLanguageSync; if (!online()) throw new Error('offline'); const r = await pulse.ytm[fn](...a); if (!r || r.error) throw new Error(r ? r.error : 'нет ответа'); return r; };

const PAGES = {
  home: {
    async load(r, force) {
      // 2.0.4: «Моя волна» живёт на своей странице (пункт в боковом меню), на Главной её больше нет
      const d = await cached('home' + (r.params || ''), () => ytm('feed', 'FEmusic_home', r.params || undefined), force);
      const chips = (d.chips || []).map((c) => `<button class="chip ${c.params === r.params ? 'on' : ''}" data-chip="${reg(c)}">${esc(c.title)}</button>`).join('');
      const greet = CL() !== 'yt' ? clGreet() : account && typeof account.name === 'string' ? `<div class="sh-strap">Привет, ${esc(account.name.trim().split(/\s+/)[0])}</div>` : '';
      return `${greet}${chips ? `<div class="chips">${chips}</div>` : ''}${shelves(d.shelves)}` || emptyHtml('music', 'Пусто', '');
    }
  },
  explore: {
    async load(r, force) {
      const d = await cached('explore', () => ytm('feed', 'FEmusic_explore'), force);
      const xb = [['FEmusic_new_releases', 'disc', 'Новинки'], ['FEmusic_charts', 'list', 'Хит-парады'], ['FEmusic_moods_and_genres', 'sparkle', 'Жанры и настроения']]
        .map(([id, i, n]) => `<a class="xb" data-b="${id}">${ico(i)}${n}</a>`).join('');
      return `<div class="explore-btns">${xb}</div>${shelves((d.shelves || []).filter((s) => !(!s.title && s.items.length && s.items.every((x) => x.kind === 'mood'))))}`;
    }
  },
  search: {
    async load(r, force) {
      const F = [['', 'Все'], ['songs', 'Треки'], ['videos', 'Видео'], ['albums', 'Альбомы'], ['artists', 'Исполнители'], ['playlists', 'Плейлисты']].filter(([f]) => !(f === 'videos' && CL() !== 'yt')); // 2.0.2: у Apple Music / Spotify нет видео
      const chips = `<div class="chips">${F.map(([f, n]) => `<button class="chip ${(r.f || '') === f ? 'on' : ''}" data-sf="${f}">${n}</button>`).join('')}</div>`;
      const d = await cached('s:' + r.f + ':' + r.q, () => ytm('search', r.q, r.f || undefined).then((x) => ({ shelves: x })), force);
      const S = d.shelves || [];
      if (!S.some((s) => s.items && s.items.length)) return chips + emptyHtml('search', 'Ничего не нашлось', `<div>Попробуй написать по-другому</div>`);
      let html = '';
      if (r.f) {
        for (const s of S) { const it = s.items || []; if (!it.length) continue; html += it.every((x) => x.kind === 'song') ? `<div class="shelf">${trackList(it, { name: `Поиск: ${r.q}` }, { noAlbum: r.f === 'videos' })}</div>` : `<div class="shelf">${cards(it, { grid: true })}</div>`; }
        return chips + html;
      }
      let top = S.find((s) => s.top); const rest = S.filter((s) => !s.top);
      if (top && top.items[0] && /^VLRDAT|^RDAT/.test(top.items[0].browseId || '')) { const a = rest.flatMap((s) => s.items).find((x) => x.kind === 'artist' || x.kind === 'album'); top = a ? { top: true, items: [a] } : null; }
      const all = rest.flatMap((s) => (s.mixed ? s.items : []));
      const songs = [...rest.filter((s) => !s.mixed && s.items.every((x) => x.kind === 'song')).flatMap((s) => s.items), ...all.filter((x) => x.kind === 'song' && !x.video)];
      if (top && top.items[0]) {
        const t = top.items[0], k = reg({ items: [t] });
        const isSong = t.kind === 'song';
        const sub = isSong ? `${t.video ? 'Видео' : 'Трек'} • ${t.author}` : t.sub || '';
        const btns = isSong ? `<button class="btn w" data-cp>${ico('play')}Слушать</button><button class="btn" data-radio="${k}">${ico('radio')}Радио</button>`
          : t.kind === 'artist' ? `<button class="btn w" data-cp>${ico('radio')}Радио</button>` : `<button class="btn w" data-cp>${ico('play')}Слушать</button>`;
        html += `<div class="shelf"><div class="sh-head"><div class="tt"><div class="sh-title">Лучший результат</div></div></div><div class="top-res"><div class="tr-card ${t.kind === 'artist' ? 'round' : ''}" data-c="${k}" data-i="0"><div class="tc-top"><img src="${esc(isSong && t.video ? pimg(`https://i.ytimg.com/vi/${t.id}/hqdefault.jpg`) : artOf(t, 226))}" ${IMG_ERR}/><div><div class="tc-t">${esc(t.title)}</div><div class="tc-s">${esc(sub)}</div></div></div><div class="hb" style="display:flex;gap:10px">${btns}</div></div>${songs.length ? trackList(songs.slice(0, 4), { name: `Поиск: ${r.q}` }, { stack: true, noAlbum: true }) : ''}</div></div>`;
      } else if (songs.length) html += `<div class="shelf"><div class="sh-head"><div class="tt"><div class="sh-title">Треки</div></div></div>${trackList(songs.slice(0, 6), { name: `Поиск: ${r.q}` })}</div>`;
      if (top && songs.length > 4) html += `<div class="shelf"><div class="sh-head"><div class="tt"><div class="sh-title">Треки</div></div><button class="btn" data-sf="songs">Все</button></div>${trackList(songs.slice(4, 10), { name: `Поиск: ${r.q}` })}</div>`;
      const groups = [['video', 'Видео', 'videos'], ['album', 'Альбомы', 'albums'], ['artist', 'Исполнители', 'artists'], ['playlist', 'Плейлисты', 'playlists']];
      for (const [k, n, f] of groups) {
        const it = k === 'video' ? all.filter((x) => x.kind === 'song' && x.video) : all.filter((x) => x.kind === k);
        if (it.length) html += `<div class="shelf"><div class="sh-head"><div class="tt"><div class="sh-title">${n}</div></div><button class="btn" data-sf="${f}">Все</button></div>${cards(it)}</div>`;
      }
      for (const s of rest) if (!s.mixed && !s.items.every((x) => x.kind === 'song')) html += shelf(s);
      return chips + html;
    }
  },
  browse: {
    async load(r, force) {
      if (/^FE/.test(r.id)) {
        const d = await cached('f:' + r.id + (r.params || ''), () => ytm('feed', r.id, r.params || undefined), force);
        const chips = (d.chips || []).length ? `<div class="chips">${d.chips.map((c) => `<button class="chip ${c.params === r.params ? 'on' : ''}" data-chip="${reg(c)}">${esc(c.title)}</button>`).join('')}</div>` : '';
        const ttl = d.title || { FEmusic_new_releases: 'Новинки', FEmusic_charts: 'Хит-парады', FEmusic_moods_and_genres: 'Жанры и настроения' }[r.id] || '';
        return `${ttl ? `<h1 class="pg-title">${esc(ttl)}</h1>` : ''}${chips}${shelves(d.shelves)}` || emptyHtml('music', 'Пусто', '');
      }
      let d;
      if (!online() && cachedPage(r.id)) return listPage(cachedPage(r.id), r);
      try { d = await cached('b:' + r.id + (r.params || ''), () => ytm('browse', r.id, r.params || undefined), force); if (d && d.type === 'playlist' && isAccList(r.id)) { cacheList(r.id, d); save(); } }
      catch (e) { // запасной путь: офлайн-копия или публичный плейлист
        if (cachedPage(r.id)) return listPage(cachedPage(r.id), r);
        if (!/^VL/.test(r.id) || !online()) throw e;
        const p = await pulse.playlist(r.id.slice(2)); if (!p || !p.tracks || !p.tracks.length) throw e;
        d = { type: 'playlist', browseId: r.id, header: { title: p.title || 'Плейлист', sub: tr(p.tracks.length) }, tracks: p.tracks, shelves: [] };
      }
      return d.type === 'artist' ? artistPage(d, r) : d.type === 'album' || d.type === 'playlist' ? listPage(d, r) : `${d.header && d.header.title ? `<h1 class="pg-title">${esc(d.header.title)}</h1>` : ''}${shelves(d.shelves)}` || emptyHtml('music', 'Пусто', '');
    }
  },
  library: {
    async load(r, force) {
      const tab = r.tab || 'pl';
      if (CL() !== 'yt') return clLibrary(r, tab, force); // 2.0.2: медиатека Apple Music / Spotify
      const tabs = `<div class="lib-tabs">${[['pl', 'Плейлисты'], ['songs', 'Треки'], ['albums', 'Альбомы'], ['artists', 'Исполнители']].map(([k, n]) => `<button class="chip ${tab === k ? 'on' : ''}" data-lib="${k}">${n}</button>`).join('')}</div>`;
      if (tab === 'pl') {
        const items = [{kind:'local',id:'__local',title:'Локальные треки',sub:tr(window.MediaLibrary?.tracks().length||0),icon:'music'}, { kind: 'local', id: '__off', title: 'Скачанное', sub: tr(Object.keys(off).length), icon: 'offline' }]; // 2.0.3: «Мои треки» убран — лайки в «Понравившихся» сервиса
        (accLists || []).forEach((p) => items.push({ kind: 'playlist', browseId: p.browseId || 'VL' + p.listId, title: p.name, sub: p.sub, art: p.art, icon: p.art ? null : p.listId === 'LM' ? 'heart' : 'list' }));
        lib.playlists.filter((p) => p.id !== MINE).forEach((p) => items.push({ kind: 'local', id: p.id, title: p.name, sub: `${tr(p.tracks.length)} · на устройстве`, art: p.art || (p.tracks[0] && artOf(p.tracks[0], 300)), icon: p.art || p.tracks[0] ? null : 'list' }));
        return tabs + (account ? '' : loginCard()) + `<div class="shelf">${cards(items, { grid: true })}</div>`;
      }
      if (tab === 'songs') {
        if (!account && !(online() ? null : cachedPage('VLLM'))) return tabs + loginCard(true); // 2.0.3: лайки хранятся в аккаунте YouTube Music
        const d = !online() && cachedPage('VLLM') ? cachedPage('VLLM') : await cached('b:VLLM', () => ytm('browse', 'VLLM'), force);
        return tabs + `<div class="hb" style="display:flex;gap:10px;margin-bottom:20px"><button class="btn w" data-play="${reg({ tracks: d.tracks, name: 'Понравившиеся' })}">${ico('play')}Слушать</button><button class="btn" data-shuf="${reg({ tracks: d.tracks, name: 'Понравившиеся' })}">${ico('shuffle')}Перемешать</button></div>` + trackList(d.tracks || [], { name: 'Понравившиеся' });
      }
      if (!account) return tabs + loginCard(true);
      const id = tab === 'albums' ? 'FEmusic_liked_albums' : 'FEmusic_library_corpus_track_artists';
      const d = await cached('f:' + id, () => ytm('feed', id), force);
      const it = (d.shelves || []).flatMap((s) => s.items);
      return tabs + (it.length ? `<div class="shelf">${cards(it, { grid: true })}</div>` : emptyHtml('library', 'Пока пусто', ''));
    }
  },
  downloads: { sync: () => localPage({ id: '__off' }) },
  local: { sync: (r) => localPage(r) }
};
function loginCard(big) {
  return `<div class="sl-login" style="margin:0 0 28px;max-width:560px;font-size:14px">${big ? '<b style="font-size:17px;display:block;margin-bottom:4px;color:#fff">Войди в аккаунт</b>' : ''}Войди в YouTube Music, чтобы видеть свои плейлисты, альбомы, «Понравившиеся» и персональные рекомендации.<button data-act="login">${ico('google')}Войти</button></div>`;
}

function listPage(d, r) {
  const h = d.header || {}, tracks = d.tracks || [], isAlbum = d.type === 'album';
  const name = h.title || 'Плейлист', k = reg({ tracks, name, src: { r: 'browse', id: r.id }, ytPl: d.editable ? r.id : null });
  const acc = !isAlbum && isAccList(r.id), autoOn = (lib.autoDl || []).includes(r.id) || S().sync.autoDlAll;
  const saved = lib.playlists.find((p) => p.browseId === r.id);
  const total = tracks.reduce((a, t) => a + (t.dur || 0), 0);
  const strap = h.artists && h.artists.length ? h.artists.map((a) => (a.id ? `<a data-b="${esc(a.id)}">${esc(a.name)}</a>` : esc(a.name))).join(', ') : esc(h.strap || '');
  const radio = h.radio ? `<button class="btn" data-rlist="${esc(h.radio)}">${ico('radio')}Радио</button>` : '';
  const head = `<div class="hd"><div class="ha">${h.art ? `<img src="${esc(pimg(h.art))}" ${IMG_ERR}/>` : ''}</div><div class="hi">
    <h1>${esc(name)}</h1>${strap ? `<div class="hst">${strap}</div>` : ''}<div class="hs">${esc(uiOwnedText(h.sub || ''))}</div>
    <div class="hs">${tracks.length && !/трек/.test(h.sub || '') ? esc(uiOwnedText(`${tr(tracks.length)}${total ? ' • ' + Math.round(total / 60) + ' мин.' : ''}`)) : ''}</div>
    ${h.desc ? `<div class="hdesc">${esc(h.desc)}</div>` : ''}
    <div class="hb"><button class="btn w" data-play="${k}">${ico('play')}Слушать</button><button class="btn" data-shuf="${k}">${ico('shuffle')}Перемешать</button>${radio}${typeof waveBtn === 'function' ? waveBtn(isAlbum ? 'album' : 'playlist', r.id, name, k) : ''}
    <button class="btn" data-dlall="${k}" title="Скачать все треки для офлайна">${ico('download')}Скачать</button>
    ${acc ? `<button class="btn ${autoOn ? 'on' : ''}" data-autodl="${esc(r.id)}" title="Скачивать новые треки этого плейлиста автоматически">${ico('sync')}Автоскачивание</button>` : `<button class="btn ${saved ? 'on' : ''}" data-save="${reg({ d, id: r.id })}" title="${saved ? 'Сохранено на устройстве — нажми, чтобы убрать' : 'Сохранить в библиотеку Pulse'}">${ico(saved ? 'check' : 'plus')}${saved ? 'В библиотеке' : 'В библиотеку'}</button>`}
    ${tracks.length ? `<button class="btn round" data-addto="${k}" title="Добавить все треки в другой плейлист">${ico('queue')}</button>` : ''}
    ${acc || d.editable ? `<button class="btn round" data-plmenu="${reg({ id: r.id, d })}" title="Ещё">${ico('more')}</button>` : ''}</div>
    ${d.cached ? `<div class="hs off-note">${ico('cloud')}Офлайн-копия от ${new Date(d.cached).toLocaleString().slice(0, 17)} · играют скачанные треки</div>` : ''}</div></div>`;
  const list = tracks.length ? `<div class="tl">${tracks.map((t, i) => trackRow(t, i, k, isAlbum ? { num: true, noAlbum: true, noArtist: !t.author || t.author === (h.artists || []).map((a) => a.name).join(', ') } : {})).join('')}</div>` : emptyHtml('list', 'Здесь пока нет треков', '');
  return head + list + `<div style="height:40px"></div>` + shelves(d.shelves);
}
function artistPage(d, r) {
  const h = d.header || {};
  const songsShelf = (d.shelves || []).find((s) => s.items && s.items.length && s.items.every((x) => x.kind === 'song') && s.list);
  const k = songsShelf ? reg({ tracks: songsShelf.items, name: h.title }) : null;
  const head = `<div class="artist-hd">${h.art ? `<img src="${esc(pimg(h.art))}" ${IMG_ERR}/>` : ''}<div class="ai"><h1>${esc(h.title || '')}</h1><div class="hs">${esc(uiOwnedText([h.subs && (/подписч|subscri/i.test(h.subs) ? h.subs : `${h.subs} подписчиков`), h.monthly, h.sub].filter(Boolean).join(' • ')))}</div>
    <div class="hb">${k ? `<button class="btn w" data-shuf="${k}">${ico('shuffle')}Перемешать</button>` : ''}${h.radio ? `<button class="btn" data-rlist="${esc(h.radio)}">${ico('radio')}Радио</button>` : ''}${typeof waveBtn === 'function' ? waveBtn('artist', r.id, h.title || '', k, h.radio) : ''}${subBtn(h, d)}</div></div></div>`;
  const rest = (d.shelves || []).map((s) => (s === songsShelf ? `<div class="shelf">${shelfHead(s)}${trackList(s.items, { name: h.title }, {})}</div>` : shelf(s))).join('');
  return head + rest + (h.desc ? `<div class="shelf"><div class="sh-head"><div class="tt"><div class="sh-title">Об исполнителе</div></div></div><div class="desc-shelf">${esc(h.desc)}</div></div>` : '');
}
// 2.0: подписка на исполнителя (нужен вход в аккаунт YouTube Music)
function subBtn(h, d) {
  const id = h.channelId || (/^UC/.test(d.browseId || '') ? d.browseId : null); if (!id) return '';
  return `<button class="btn sub-btn ${h.subscribed ? 'on' : ''}" data-subch="${esc(id)}" title="${h.subscribed ? 'Отписаться' : 'Подписаться на исполнителя'}">${ico(h.subscribed ? 'check' : 'plus')}${h.subscribed ? 'Вы подписаны' : 'Подписаться'}</button>`;
}
async function toggleSub(el) {
  if (!account) { toast('Чтобы подписаться, войди в аккаунт YouTube Music (Настройки → Аккаунты)', 'alert'); return; }
  if (!online()) { toast('Нет интернета', 'alert'); return; }
  const on = !el.classList.contains('on'); el.disabled = true;
  const r = await pulse.ytm.subscribe(el.dataset.subch, on).catch((e) => ({ error: String(e) })); el.disabled = false;
  if (r && r.error) { toast('YouTube Music не принял подписку: ' + r.error, 'alert'); return; }
  el.classList.toggle('on', on); el.title = on ? 'Отписаться' : 'Подписаться на исполнителя';
  el.innerHTML = `${ico(on ? 'check' : 'plus')}${on ? 'Вы подписаны' : 'Подписаться'}`;
  for (const c of cache.values()) { const x = c && c.v; if (x && x.header && (x.header.channelId === el.dataset.subch || x.browseId === el.dataset.subch)) x.header.subscribed = on; }
  toast(on ? 'Вы подписались' : 'Подписка отменена', on ? 'check' : 'close');
}
// 2.0.2: запись YouTube, скачанная ради трека сервиса, показывается один раз — под треком сервиса
function offlineTracks() { const groups=new Map();for(const [id,o]of Object.entries(off)){if(id.startsWith('local-'))continue;const key=o.vid||id,previous=groups.get(key);if(!previous||(!lib.known[previous]&&lib.known[id])||(o.vid&&!off[previous]?.vid))groups.set(key,id);}return [...groups.values()].map(id=>lib.known[id]||{id,title:id,author:'',loaded:true}); }
function localPage(r) {
  const isFiles = r.id === '__local';
  const isOff = r.id === '__off', p = isFiles ? {id:'__local',name:'Локальные треки',tracks:window.MediaLibrary?.tracks()||[]} : isOff ? { id: '__off', name: 'Скачанное', tracks: offlineTracks() } : lib.playlists.find((x) => x.id === r.id) || (r.id === MINE ? mine() : null);
  if (!p) return emptyHtml('list', 'Плейлист не найден', '');
  const tracks = p.tracks, k = reg({ tracks, name: p.name, src: { r: isOff ? 'downloads' : 'local', id: p.id }, local: isOff || isFiles ? null : p.id });
  const art = p.art || (tracks[0] && !isOff && p.id !== MINE ? artOf(tracks[0], 544) : null);
  const icon = isFiles ? 'music' : isOff ? 'offline' : p.id === MINE ? 'heart-f' : 'list';
  const total = tracks.reduce((a, t) => a + (t.dur || 0), 0);
  const extra = isFiles ? '<button class="btn w" data-media-import>'+ico('plus')+'Добавить треки</button>' : isOff ? '' : `${p.browseId || p.listId ? `<button class="btn" data-refresh="${esc(p.id)}">${ico('refresh')}Обновить</button>` : ''}${p.id !== MINE && !p.browseId && tracks.length ? `<button class="btn" data-upload="${esc(p.id)}" title="Создать такой же плейлист в YouTube Music">${ico('cloud')}В YouTube Music</button>` : ''}${p.id !== MINE ? `<button class="btn" data-delpl="${esc(p.id)}">${ico('trash')}Удалить</button>` : ''}`;
  const head = `<div class="hd"><div class="ha ${art ? '' : 'ico'}">${art ? `<img src="${esc(pimg(art))}" ${IMG_ERR}/>` : ico(icon)}</div><div class="hi"><h1${isOff || p.id === MINE ? ' data-i18n-ui' : ''}>${esc(p.name)}</h1>
    <div class="hs">${esc(uiOwnedText(isFiles ? 'Твоя музыка · копии хранятся в Pulse · оригиналы не меняются' : isOff ? 'Доступно без интернета' : p.id === MINE ? 'Понравившиеся треки · хранятся в Pulse' : 'Плейлист на устройстве'))}</div><div class="hs">${esc(uiOwnedText(`${tr(tracks.length)}${total ? ' • ' + Math.round(total / 60) + ' мин.' : ''}`))}</div>
    <div class="hb"><button class="btn w" data-play="${k}">${ico('play')}Слушать</button><button class="btn" data-shuf="${k}">${ico('shuffle')}Перемешать</button>${isOff || isFiles ? '' : `<button class="btn" data-dlall="${k}">${ico('download')}Скачать</button>`}${extra}</div></div></div>`;
  return head + (isFiles ? '<div class="media-format-note">MP3 · FLAC · WAV · M4A · AAC · OGG · OPUS · AIFF · WMA и другие. Редактирование — через меню трека.</div>' : '') + (tracks.length ? `<div class="tl">${tracks.map((t, i) => trackRow(t, i, k)).join('')}</div>` : emptyHtml(icon, isFiles ? 'Добавь свою музыку' : isOff ? 'Пока ничего не скачано' : 'Пусто', isFiles ? '<div>Выбери один или несколько аудиофайлов. Они появятся в этом плейлисте и будут доступны без интернета.</div><button class="btn w" data-media-import>Добавить треки</button>' : isOff ? `<div>Нажми ${ico('download')} у трека или «Скачать» у альбома — он будет играть без интернета</div>` : `<div>Ставь ${ico('heart')} трекам или добавляй их через меню ${ico('more')}</div>`));
}
async function saveToLib(d, id) {
  const ex = lib.playlists.find((p) => p.browseId === id);
  if (ex) { if (!confirm(`Убрать «${ex.name}» из библиотеки Pulse?`)) return; lib.playlists = lib.playlists.filter((p) => p !== ex); save(); renderSide(); renderRoute(true); return toast('Убрано из библиотеки'); }
  const h = d.header || {};
  lib.playlists.splice(lib.playlists[0] && lib.playlists[0].id === MINE ? 1 : 0, 0, { id: Date.now().toString(36), browseId: id, name: h.title || 'Плейлист', art: h.art ? sized(h.art, 544) : null, author: (h.artists || []).map((a) => a.name).join(', ') || h.strap || '', tracks: (d.tracks || []).map(slim) });
  save(); renderSide(); renderRoute(true); toast('Сохранено в библиотеку', 'save');
}
async function refreshLocal(id) {
  const p = lib.playlists.find((x) => x.id === id); if (!p) return;
  if (!online()) return toast('Нет интернета');
  toast('Обновляю плейлист…', 'refresh');
  let tracks = null;
  try {
    if (p.browseId) { const d = await pulse.ytm.browse(p.browseId); if (d && !d.error) tracks = d.tracks; }
    if (!tracks && p.listId) { const d = await pulse.playlist(p.listId); if (d && d.tracks) tracks = d.tracks; }
  } catch {}
  if (!tracks || !tracks.length) return toast('Не удалось обновить плейлист');
  p.tracks = tracks.map(slim); save(); renderSide(); renderRoute(true); toast(`Готово: ${tr(tracks.length)}`);
}

// ---------- боковая панель и аккаунт ----------
function renderSide() {
  let h = `<a class="sl media-local-link" data-local="__local"><div class="n">${ico('music')} ${esc(translateUiText('Локальные треки'))}</div><div class="s">${tr(window.MediaLibrary?.tracks().length||0)} · на устройстве</div></a>`;
  if (CL() !== 'yt') h += clSideLists(); // 2.0.2: плейлисты Apple Music / Spotify
  else (accLists || []).forEach((p) => { const b = p.browseId || 'VL' + p.listId, c = lib.ytc && lib.ytc[b], nOff = c ? c.tracks.filter((t) => off[t.id]).length : 0; h += `<a class="sl ${!online() && !c ? 'dim' : ''}" data-b="${esc(b)}"><div class="n">${esc(p.name)}</div><div class="s">${esc(p.sub || 'Плейлист')}${nOff ? ` · ${nOff} офлайн` : ''}</div></a>`; });
  lib.playlists.filter((p) => p.id !== MINE).forEach((p) => { h += `<a class="sl" data-local="${esc(p.id)}"><div class="n">${esc(p.name)}</div><div class="s">${esc(p.author || tr(p.tracks.length))} · на устройстве</div></a>`; });
  h += '<div class="sync-st" id="syncSt"></div>'; // синхронизация — в самом низу, под всеми плейлистами
  $('sideList').innerHTML = h; renderSideOn(); syncLabel();
}
function renderSideOn() {
  const r = route();
  document.querySelectorAll('#sideList .sl').forEach((el) => el.classList.toggle('on', (r.r === 'local' && el.dataset.local === r.id) || (r.r === 'browse' && el.dataset.b === r.id)));
}
function renderAccBtn() {
  const b = $('accBtn'); b.classList.toggle('out', !account);
  b.innerHTML = account ? (account.photo ? `<img src="${esc(account.photo)}" referrerpolicy="no-referrer" />` : `<span class="ava">${esc(String(account.name || '?')[0])}</span>`) : `${ico('google')}<span>Войти</span>`;
  b.title = account ? `${account.name} — YouTube Music` : 'Войти в YouTube Music';
}
async function refreshAccount() {
  if (!online()) { accLists = lib.accCache || null; renderSide(); return; } // офлайн: плейлисты из последней синхронизации
  let info = null; try { info = await pulse.account.info(); } catch {}
  const was = !!account; account = info && !info.error ? info : null;
  renderAccBtn();
  if (!account) { accLists = null; renderSide(); return; }
  lib.accInfo = { name: account.name };
  const r = await pulse.account.playlists().catch(() => null);
  accLists = r && !r.error ? r : lib.accCache || null;
  if (r && !r.error) { lib.accCache = r; save(); }
  renderSide();
  if (!was) { cache.clear(); if (['home', 'library'].includes(route().r)) renderRoute(true); }
  setTimeout(() => syncAll(!was && !lib.syncAt), 1500);
}
function modal(html) { hideMenu(); if (typeof closeLyPop === 'function') closeLyPop(); clearTimeout($('modal')._ct); $('modal').classList.remove('closing'); $('modalBox').innerHTML = `<button class="ib x" data-act="closeModal">${ico('x')}</button>` + html; $('modal').classList.add('show'); }
// 2.0.4: окно закрывается плавно (раньше пропадало мгновенно)
const closeModal = () => { const m = $('modal'); if (!m.classList.contains('show')) return; if (!animOn()) { clearTimeout(m._ct); return m.classList.remove('show', 'closing'); } m.classList.add('closing'); clearTimeout(m._ct); m._ct = setTimeout(() => m.classList.remove('show', 'closing'), 170); };
let browsersFound = null, loginSite = 'yt';
// 1.9.6: в окне входа осталось два способа — «Войти через Google» и «Взять готовый вход из браузера».
// Встроенное окно Google остаётся только запасным (если не найден ни один браузер).
// 2.0.2: то же окно — для Spotify (site 'sp'): Google во встроенном окне пишет «браузер небезопасен».
// Вход открывается в браузере по умолчанию (он стоит первым), можно выбрать другой.
async function openLogin(site = 'yt') {
  loginSite = site === 'sp' ? 'sp' : 'yt'; const SP = loginSite === 'sp';
  if (!browsersFound) browsersFound = await pulse.account.browsers().catch(() => []) || [];
  const B = browsersFound, pick = lib.loginBrowser && B.some((b) => b.id === lib.loginBrowser) ? lib.loginBrowser : (B[0] || {}).id;
  const bn = (b) => esc(b.name) + (b.def ? ' · по умолчанию' : '');
  const head = SP ? `<h2>Вход в Spotify</h2><p>Нужен для своей медиатеки, плейлистов, «Любимых треков» и текстов песен Spotify.</p>`
    : `<h2>Вход в YouTube Music</h2><p>Нужен, чтобы видеть свои плейлисты, «Понравившиеся», альбомы и персональную главную.</p>`;
  // 2.0.2: Firefox открывается в твоём обычном профиле (вход подхватывается сам, окно закрывать не нужно)
  const ff = pick === 'firefox', svcN = SP ? 'Spotify' : 'YouTube Music';
  const how = !B.length ? (SP ? 'Браузер не найден — откроется встроенное окно входа.' : 'Откроется окно входа Google.')
    : ff ? `Откроется твой Firefox — с твоим профилем и вкладками. Если ты уже вошёл в ${svcN}, вход подхватится сразу; если нет — войди${SP ? ' любым способом (Google, почта, Apple)' : ''}, закрывать Firefox не нужно.`
    : SP ? 'Откроется отдельное окно браузера — войди в Spotify любым способом (Google, почта, Apple, Facebook) и закрой это окно, Pulse сам заберёт вход.'
    : 'Откроется обычное окно браузера без подмен — Google не будет писать «браузер небезопасен». Войди и закрой окно, Pulse сам заберёт вход.';
  modal(`${head}
    <button class="opt rec" data-login="google">${ico(SP ? 'spotify' : 'google')}<div style="flex:1"><b>${SP ? 'Войти через браузер' : 'Войти через Google'} <em class="badge">рекомендуется</em></b><span>${how}</span></div></button>
    ${B.length > 1 ? `<div class="opt-row login-br"><span>Браузер для входа:</span>${B.map((b) => `<button class="chip ${b.id === pick ? 'on' : ''}" data-login="pick:${esc(b.id)}">${bn(b)}</button>`).join('')}</div>` : ''}
    ${SP ? '' : `<div class="opt" style="cursor:default">${ico('download')}<div style="flex:1"><b>Взять готовый вход из браузера</b><span>Если ты уже вошёл в ${SP ? 'open.spotify.com' : 'music.youtube.com'} в своём браузере. Лучше всего работает Firefox. Браузер лучше закрыть.</span>
      <div class="opt-row">${['firefox', 'chrome', 'edge', 'opera', 'brave', 'vivaldi'].map((b) => `<button class="chip" data-login="br:${b}">${b[0].toUpperCase() + b.slice(1)}</button>`).join('')}</div></div></div>`}`); // 2.0.2: у Spotify — только вход через браузер
}
function loginWait(name, id) {
  const SP = loginSite === 'sp';
  const txt = id === 'firefox' ? `В Firefox открылась вкладка входа. Войди в свой аккаунт ${SP ? 'Spotify' : 'Google'} — Pulse подхватит вход сам, как только он появится. Закрывать Firefox не нужно.`
    : `В открывшемся окне войди в свой аккаунт ${SP ? 'Spotify' : 'Google'}. Когда откроется ${SP ? 'Spotify' : 'YouTube Music'} — просто <b>закрой окно браузера</b>, Pulse подхватит вход.`;
  modal(`<h2>Жду вход в ${esc(name)}</h2><p>${txt}</p>
    <div class="mrow"><button class="btn" data-login="cancel">Отмена</button></div>`);
}
async function doLogin(kind) {
  let r; const site = loginSite, SP = site === 'sp';
  if (kind === 'cancel') { if (pulse.account.cancelExt) pulse.account.cancelExt(); closeModal(); return; }
  if (kind.startsWith('pick:')) { lib.loginBrowser = kind.slice(5); save(); return openLogin(site); } // текст подсказки зависит от браузера
  if (kind === 'inner') { closeModal(); return svcLogin('sp', true); }
  if (kind === 'google') {
    if (!browsersFound) browsersFound = await pulse.account.browsers().catch(() => []) || [];
    const b = browsersFound.find((x) => x.id === lib.loginBrowser) || browsersFound[0];
    if (b) { loginWait(b.name, b.id); r = await pulse.account.viaBrowser(b.id, site); }
    else if (SP) { closeModal(); return svcLogin('sp', true); }
    else {
      toast('Открываю вход Google…', 'user'); r = await pulse.account.login(lib.loginMode || 'chrome');
      if (r && r.rejected) { lib.loginMode = r.mode === 'firefox' ? 'chrome' : 'firefox'; save(); toast('Google не пустил — пробую другой режим окна', 'user'); r = await pulse.account.login(lib.loginMode); if (r && r.rejected) r = { error: 'Google не пускает во встроенное окно. Установи Edge, Chrome или Firefox — вход пойдёт через него' }; }
    }
  }
  else if (kind.startsWith('br:')) { toast('Читаю вход из браузера…', 'user'); r = await pulse.account.browser(kind.slice(3), site); }
  else return;
  if (!$('modal').classList.contains('show') && kind === 'google' && r === false) return; // отменили
  if (r && r.error) { if (kind === 'google') openLogin(site); return toast('Ошибка входа: ' + r.error, 'alert'); }
  if (!r) { if (kind === 'google') openLogin(site); return toast(kind === 'google' ? `Вход не найден — войди в ${SP ? 'Spotify' : 'аккаунт'} и закрой окно браузера` : `Вход не найден — проверь, что ты вошёл в ${SP ? 'open.spotify.com' : 'music.youtube.com'}`, 'alert'); }
  closeModal();
  if (SP) { toast('Вход в Spotify выполнен', 'check'); cache.clear(); await svcRefresh(); lyRecheckSvc('sp'); if (CL() === 'sp' && ['home', 'library'].includes(route().r)) renderRoute(true); return; }
  await refreshAccount(); toast(account ? `Вошёл как ${account.name}` : 'Вход выполнен', 'user');
}
// ---------- меню ----------
function showMenu(x, y, items) {
  window.PulseMenus?.closeSub(); window.PulseSelect?.close();
  const m = $('menu'); m.classList.remove('pulse-parent-hidden'); m.setAttribute('role','menu'); if (typeof closeLyPop === 'function') closeLyPop();
  m.innerHTML = items.map((it, i) => (it === '-' ? '<div class="mi sep"></div>' : `<div class="mi" role="menuitem" tabindex="0" data-mi="${i}"${it[3] ? ' aria-haspopup="menu" aria-expanded="false"' : ''}>${ico(it[0])}<span>${esc(it[1])}</span>${it[3] ? '<i class="pulse-menu-arrow" aria-hidden="true"></i>' : ''}</div>`)).join('');
  m._items = items; m.style.maxHeight = ''; clearTimeout(m._ht); m.classList.remove('hiding'); m.classList.add('show');
  // 1.9.6: меню не заезжает под верхнюю панель — там область перетаскивания окна, клики по пунктам («Кольцо») не доходили
  const minY = menuTop(), maxY = menuBottom(), w = m.offsetWidth, h = Math.min(m.offsetHeight, Math.max(44,maxY - minY));
  m.style.maxHeight = h + 'px';
  m.style.left = Math.max(8, Math.min(x, innerWidth - w - 8)) + 'px'; m.style.top = Math.max(minY, Math.min(y, maxY - h)) + 'px';
  window.PulseGlass?.fitMenu(m);
}
// Keep menus close to the transport: 8px gap, with a local exclusion for its hide button.
function menuBottom() { const bar=$('bar');if(!bar||document.body.classList.contains('player-bar-hidden'))return innerHeight-8;const css=getComputedStyle(bar),r=bar.getBoundingClientRect();return css.display==='none'||css.visibility==='hidden'||r.top>=innerHeight||r.bottom<=0?innerHeight-8:Math.max(menuTop()+44,Math.min(innerHeight-8,r.top-8)); }
// нижняя граница видимой верхней панели (в полноэкранном режиме она может быть спрятана)
function menuTop() { const t = $('top'); if (!t) return 8; const b = t.getBoundingClientRect().bottom; return Math.max(8, Math.round(b) + 4); }
// всплывающая панель (эффекты визуала, вид текста) не уходит под верхнюю панель окна
function fitPop(el) {
  if (!el) return; el.style.maxHeight = '';
  const r = el.getBoundingClientRect(), lim = menuTop();
  if (r.height && r.top < lim) el.style.maxHeight = Math.max(160, r.bottom - lim) + 'px';
}
const hideMenu = () => { window.PulseMenus?.closeSub(); const m = $('menu'); m.classList.remove('pulse-parent-hidden'); m._viz = false; if (!m.classList.contains('show') || m.classList.contains('hiding')) return; if (!animOn()) { clearTimeout(m._ht); return m.classList.remove('show', 'hiding'); } m.classList.add('hiding'); clearTimeout(m._ht); m._ht = setTimeout(() => m.classList.remove('show', 'hiding'), 120); }; // 2.0.4: меню тает
window.hideMenu = hideMenu;
// Electron's native clipboard does not depend on Chromium document focus/permissions.
async function copyText(text, message = 'Ссылка скопирована') {
  try {
    if(typeof text !== 'string' || !text.trim()) throw Error('Нет текста для копирования');
    if(pulse.copyText) { const r=await pulse.copyText(text); if(!r?.ok)throw Error(r?.error || 'Буфер обмена недоступен'); }
    else { if(!navigator.clipboard?.writeText)throw Error('Буфер обмена недоступен'); await navigator.clipboard.writeText(text); }
    toast(message, 'link'); return true;
  } catch(e) { toast('Не удалось скопировать: ' + (e.message || 'буфер обмена недоступен'), 'alert'); return false; }
}
async function copyTrackLink(t) {
  try {
    const u=isSvcId(t.id)?await pulse.svc.link(t.id):`https://music.youtube.com/watch?v=${encodeURIComponent(t.id)}`;
    if(typeof u!=='string'||!/^https:\/\//.test(u))throw Error('Сервис не вернул ссылку');
    return copyText(u);
  } catch(e) { toast('Не удалось получить ссылку: ' + (e.message || 'ошибка сервиса'), 'alert'); return false; }
}
function trackMenu(t, x, y, ctx) {
  if(t.id?.startsWith('local-'))return MediaLibrary.trackMenu(t,x,y,ctx);
  const items = [['play', 'Играть следующим', () => playNextUp(t)], ['queue', 'Добавить в очередь', () => playNextUp(t, true)], ['radio', 'Радио по треку', () => playRadio(t)], '-',
    [isLiked(t.id) ? 'heart-f' : 'heart', isLiked(t.id) ? 'Убрать из «Понравившихся»' : 'Нравится', () => toggleLike(t)],
    ...(typeof waveMenuItems === 'function' ? waveMenuItems(t) : []), // 2.0.4: «Не нравится» и «Волна по…»
    ['download', 'Скачать', null, () => downloadChoices([t])]];
  if(off[t.id])items.push(['edit','Редактировать метаданные…',()=>MediaLibrary.open(t)]);
  items.push(['plus', 'Добавить в плейлист…', () => addToModal([t])]);
  items.push(['list', 'В новый плейлист…', () => newPlaylistModal([t])]);
  if (ctx && ctx.ytPl) items.push(['x', 'Убрать из этого плейлиста', () => ytmRemove(ctx.ytPl, t)]);
  if (ctx && ctx.local) items.push(['x', 'Убрать из плейлиста', () => { const p = lib.playlists.find((z) => z.id === ctx.local); if (p) { p.tracks = p.tracks.filter((z) => z.id !== t.id); save(); renderSide(); renderRoute(true); } }]);
  if (ctx && ctx.queue) items.push(['x', 'Убрать из очереди', () => { const q = lib.queue, i = q.tracks.indexOf(ctx.queue); if (i < 0 || i === q.idx) return; q.tracks.splice(i, 1); if (i < q.idx) q.idx--; renderQueue(); save(); }]);
  items.push('-');
  if (t.artistId) items.push(['artist', 'Перейти к исполнителю', () => goBrowse(t.artistId)]);
  if (t.album && t.album.id) items.push(['disc', 'Перейти к альбому', () => goBrowse(t.album.id)]);
  items.push(['link', 'Копировать ссылку', () => copyTrackLink(t)]); // 2.0.2: ссылка на сервис трека
  if (curTrack() && curTrack().id === t.id) items.push(['tune', 'Корректор текста', () => openFix()]);
  for (const f of PX.trackMenu) { try { const it = f({ ...t }); if (it) items.push(it); } catch (e) { console.error(e); } }
  showMenu(x, y, items);
}

// ---------- подсказки поиска ----------
let sgT, sgSel = -1;
function renderSuggest(list, q) {
  const box = $('suggest'), f = $('gsearch');
  if (!list.length) { f.classList.remove('open'); return; }
  const hi = (s) => { const i = s.toLowerCase().indexOf(q.toLowerCase()); return i < 0 ? esc(s) : esc(s.slice(0, i)) + `<b>${esc(s.slice(i, i + q.length))}</b>` + esc(s.slice(i + q.length)); };
  box.innerHTML = list.map((s, i) => `<div class="sg" data-sg="${esc(s)}" data-k="${i}">${ico('search')}<span>${hi(s)}</span></div>`).join('');
  sgSel = -1; f.classList.add('open');
}
function doSearch(q) { q = (q || '').trim(); if (!q) return; $('gsearch').classList.remove('open'); $('gq').blur(); lib.lastQ = q; go({ r: 'search', q, f: '' }); }

// ---------- страница плеера ----------
function openPP() { if (!curTrack()) return toast('Сначала включи песню'); document.body.classList.add('pp-open'); $('icoPP').innerHTML = '<use href="#i-down"/>'; setTab(lib.tab || 'next'); lyState.cur = -2; if (typeof updNav === 'function') updNav(); }
function closePP() { document.body.classList.remove('pp-open'); $('icoPP').innerHTML = '<use href="#i-up"/>'; if (typeof closeLyPop === 'function') closeLyPop(); if (typeof updNav === 'function') updNav(); }
const togglePP = () => (document.body.classList.contains('pp-open') ? closePP() : openPP());
function setTab(tab) {
  lib.tab = tab; save();
  document.querySelectorAll('#ppTabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  ['next', 'lyrics', 'related'].forEach((k) => $('tab' + k[0].toUpperCase() + k.slice(1)).classList.toggle('on', k === tab));
  if (tab === 'next') renderQueue(true); if (tab === 'related') renderRelated(); if (tab === 'lyrics') lyState.cur = -2;
}
let qKey = null;
function renderQueue(scroll) {
  { const q = lib.queue, i0 = Math.max(0, q.idx); q.tracks.slice(i0, i0 + 25).filter(needsHeal).slice(0, 4).forEach((t) => setTimeout(() => healTrack(t), 0)); } // 2.0.4
  const box = $('tabNext'); if (!box.classList.contains('on') && !scroll) { qKey = null; return; }
  const q = lib.queue; if (!q.tracks.length) { box.innerHTML = emptyHtml('queue', 'Очередь пуста', ''); return; }
  qKey = reg({ tracks: q.tracks, queue: true });
  const firstAuto = q.tracks.findIndex((t) => t.auto);
  box.innerHTML = `<div class="q-from">Источник<b>${esc(q.name || 'Очередь')}</b></div>` + q.tracks.map((t, i) => (i === firstAuto ? autoHead() : '') + trackRow(t, i, qKey, { stack: true, noAlbum: true, noActs: false })).join('') + (firstAuto < 0 ? autoHead() : '');
  if (scroll) { const c = box.querySelector('.tr.cur'); if (c) box.scrollTop = c.offsetTop - 80; }
}
const autoHead = () => `<div class="q-auto"><span><b style="color:#fff;display:block;font-size:14px">Автовоспроизведение</b>Похожие треки после очереди</span><div class="toggle ${lib.autoplay ? 'on' : ''}" data-act="autoplay"></div></div>`;
let relFor = null;
async function renderRelated() {
  const t = curTrack(), box = $('tabRelated'); if (!t) return;
  if (relFor === t.id) return; relFor = t.id;
  if (!online()) { box.innerHTML = emptyHtml('offline', 'Нет интернета', ''); return; }
  box.innerHTML = loadingHtml;
  const n = await nextInfo(t.id);
  let sh = null; if (n && n.related) sh = await pulse.ytm.related(n.related).catch(() => null);
  if (relFor !== t.id) return;
  box.innerHTML = sh && !sh.error && sh.length ? shelves(sh, { list: true }) : emptyHtml('music', 'Нет похожих', '');
}

// ---------- текст песни (2.0: переписано с нуля) ----------
// Порядок: запись lib.lyrics[id] → разбор в строки и слова → показ → покадровая подсветка.
// Что показываем (по приоритету): своя синхронизация → пословная из базы / сервиса → построчная → обычный текст по ритму.
// 2.0.2: распознавание по голосу (нейросеть) убрано.
const LY_V = 2; // версия записи (lyrics.js REC_V): старые тексты один раз перепроверяются — у многих появится пословная синхронизация
const lyState = { lines: null, cur: -1, word: -1, curText: '', id: null, pace: 'mid', kind: null };
let lyTok = 0; // каждая загрузка получает номер: опоздавшие ответы не перерисовывают уже другой трек
const lyFromDb = () => lyState.kind === 'synced' || lyState.kind === 'word';
// растяжение таймингов (slowed / sped up): ручное значение или авто-коэффициент из базы
const stretchK = () => { const id = lyState.id; if (!id) return 1; if (lib.stretch && lib.stretch[id]) return lib.stretch[id]; const L = lib.lyrics[id]; return lyFromDb() && L && L.stretch ? L.stretch : 1; };
const VOWELS = /[aeiouyаеёиоуыэюяіїєáéíóúàèìòùäöüœæ]+/gi;
const sylOf = (w) => Math.max(1, (String(w).toLowerCase().match(VOWELS) || []).length);
const lrcTime = (m, s) => +m * 60 + parseFloat(String(s).replace(':', '.'));
// LRC → [{ t, text, words?: [{ t, e?, s }], end? }]. Понимает повторы тегов строки, [offset:], пословные теги <mm:ss.xx> и концы слов.
function parseLRCRaw(lrc) {
  const out = []; let shift = 0;
  for (const line of String(lrc || '').split(/\r?\n/)) {
    const off = line.match(/^\s*\[offset:\s*([+-]?\d+)\s*\]/i); if (off) { shift = -(+off[1]) / 1000; continue; }
    const tags = [...line.matchAll(/\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g)]; if (!tags.length) continue;
    const body = line.replace(/\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g, '');
    const parts = body.split(/<(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)>/);
    let words = null;
    if (parts.length > 1) {
      words = [];
      for (let k = 1; k < parts.length; k += 3) {
        const t = lrcTime(parts[k], parts[k + 1]) + shift, s = parts[k + 2] || '';
        if (s.trim()) words.push({ t, s: s.trim() });
        else if (words.length && words[words.length - 1].e == null) words[words.length - 1].e = t; // пустой тег — конец слова
      }
      const lead = parts[0].trim(); if (lead && words.length) words[0].s = lead + ' ' + words[0].s;
      for (let k = 1; k < words.length; k++) if (words[k].t < words[k - 1].t) words[k].t = words[k - 1].t;
      if (!words.length) words = null;
    }
    const text = (words ? words.map((w) => w.s).join(' ') : body.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
    for (const tg of tags) {
      const t = lrcTime(tg[1], tg[2]) + shift;
      // повтор строки ([00:10][00:40]текст): пословные тайминги переносим на новое начало
      const d = words ? t - (words[0].t) : 0;
      out.push({ t: Math.max(0, t), text, words: words ? words.map((w) => ({ t: Math.max(0, w.t + (tags.length > 1 ? d : 0)), e: w.e != null ? w.e + (tags.length > 1 ? d : 0) : undefined, s: w.s })) : null });
    }
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}
// слова для строки без пословных таймингов: по слогам, в реальную длину пропевания (а не на весь промежуток до следующей строки)
function estWords(L, nextT) {
  // знаки без букв («—», «…») приклеиваются к предыдущему слову, а не загораются отдельно
  const parts = []; for (const p of L.text.split(/\s+/).filter(Boolean)) { if (parts.length && !/[\p{L}\p{N}]/u.test(p)) parts[parts.length - 1] += ' ' + p; else parts.push(p); }
  if (!parts.length) return [];
  const sy = parts.map(sylOf), nS = sy.reduce((a, b) => a + b, 0);
  const room = Math.max(0.4, (nextT ?? L.t + 6) - L.t - 0.12), need = nS * 0.24 + 0.4;
  // медленная песня: строка тянется почти до следующей; быстрая — укладывается в своё время
  const span = room < need * 1.6 ? room * 0.94 : Math.min(room, Math.max(1.1, need));
  const W = sy.map((x) => x + 0.35), tot = W.reduce((a, b) => a + b, 0); let acc = 0;
  return parts.map((s, k) => { const t = L.t + (span * acc) / tot; acc += W[k]; return { t, e: L.t + (span * acc) / tot, s }; });
}
// 2.0.4: Spicy Lyrics → строки Pulse. spx: [начало, конец, второй голос, [[слово, начало, конец, слоги|0]…], слов у основного голоса]
function spxLines(spx) {
  try {
    const out = spx.map(([t, e, v2, ws, nb]) => {
      const words = ws.map(([s, a, b, y], j) => ({ t: a, e: b, s, ...(y ? { syl: y.map(([x, p, q]) => ({ s: x, t: p, e: q })) } : {}), ...(j >= nb ? { bg: 1 } : {}) }));
      return { t, end: e, text: words.filter((w) => !w.bg).map((w) => w.s).join(' '), words, v2: !!v2, ...(nb < words.length ? { nb } : {}) };
    }).filter((L) => L.words.length);
    return out.length ? withGaps(out) : null;
  } catch (e) { console.error(e); return null; }
}
function parseLRC(lrc, raw) {
  const out = parseLRCRaw(lrc);
  if (raw) return out.filter((l) => l.text).map((l) => ({ t: l.t, text: l.text }));
  const nextT = (i) => (out[i + 1] ? out[i + 1].t : null); // 2.0.4-fix: пустая строка LRC = конец пения; раньше слова растягивались на весь проигрыш
  out.forEach((L, i) => { if (L.text && !L.words) { L.words = estWords(L, nextT(i)); L.est = true; } });
  const ending = window.PulseLyricModel?.readEnding(lrc);
  if(ending){const line=out.find(l=>Math.abs(l.t-ending.t)<.005&&!l.text);if(line){line.endCredits=true;line.text=ending.text;line.words=[];}}
  return withGaps(out);
}
// паузы (проигрыши) между строками — точки «…»; пустые строки LRC — тоже паузы
function withGaps(lines, duration = typeof E !== 'undefined' ? E.dur() || 86400 : 86400) {
  const src = lines.filter((l) => l.gap || l.text || l.words), res = [];
  const endOf = (L) => L.end || (L.words && L.words.length ? (L.words[L.words.length - 1].e ?? L.words[L.words.length - 1].t + 1.2) : L.t + 3);
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    if (L.endCredits) { res.push(L); continue; }
    if (L.gap) { res.push(L); continue; }
    if (!L.text) { const end = lines[i + 1]?.t ?? duration; if (end > L.t) res.push({ t: L.t, gap: end - L.t }); continue; }
    if (L.words && L.words.length) L.end = Math.max(L.t + 0.3, endOf(L));
    res.push(L);
    const nx = lines[i + 1];
    if (nx && nx.text && !nx.gap && nx.t - endOf(L) > 6) res.push({ t: endOf(L), gap: nx.t - endOf(L) });
  }
  if (src.length && res.length && res[0].t > 5 && !res[0].gap) res.unshift({ t: 0, gap: res[0].t });
  return res;
}
// запись из базы → в библиотеку; своя синхронизация и запуски «по голосу» сохраняются
async function fetchLyrics(t) {
  if (!online()) return null;
  const src = lySrcMode(); // 2.0.2: выбранный источник текста
  // 2.0.4-fix: длительность — настоящей играющей записи (у треков Spotify/Apple в t.dur длина версии сервиса, а звук из YouTube)
  const realDur = audioTrackId === t.id && curTrack()?.id === t.id && engine === 'audio' && audio && isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
  let r = await pulse.lyrics({ id: t.id, title: t.title, author: t.author, dur: realDur || t.dur || 0, src, bgVox: S().ly.bgVox !== false, useSpicy: spicyKeyOn(), artists: (t.artists || []).map((a) => a.name || a) }).catch(() => null);
  if ((!r || (!r.synced && !r.plain && !r.instrumental)) && !isSvcId(t.id) && !t.id.startsWith('local-')) { // 2.0.2: у треков сервисов YouTube Music уже спрошен в главном процессе
    const n = await nextInfo(t.id).catch(() => null); const y = n && n.lyricsId ? await pulse.ytm.lyrics(n.lyricsId).catch(() => null) : null;
    if (y && y.plain) r = { v: LY_V, kind: 'plain', plain: y.plain, source: 'YouTube Music' + (y.source ? ' · ' + y.source : ''), provider: 'ytm', srcMode: src };
  }
  const prev = lib.lyrics[t.id] || {};
  const rec = r && (r.synced || r.plain || r.instrumental) ? { ...r, v: LY_V } : { none: true, at: Date.now(), v: LY_V, srcMode: src };
  if (spicyKeyOn()) rec.spTried = true; // 2.0.4: Spicy Lyrics уже спрошен для этой песни
  if (prev.user) { rec.user = prev.user; rec.userAt = prev.userAt; }
  lib.lyrics[t.id] = rec; save(); return rec;
}
function needFetch(L) {
  if (!L) return true; if (!online() || L.user || L.picked || L.source === 'Свой текст') return false;
  if (L.recheck) return true;
  if (L.provider === 'spicy' && L.kind === 'word' && !L.spx) return true; // 2.0.4: старая запись Spicy без слогов
  if (spicyKeyOn() && !L.spTried && ['auto', 'spicy'].includes(lySrcMode()) && L.provider !== 'spicy') return true; // 2.0.4: появился ключ Spicy Lyrics — спросим его один раз
  if ((L.srcMode || 'auto') !== lySrcMode() && !L.picked) return true; // 2.0.2: сменили источник текста — перезагружаем
  if (L.none) return Date.now() - (L.at || 0) > 864e5;
  return (L.v || 0) < LY_V;
}
const lyEmpty = (icon, title, sub, pbar) => `<div class="ly-empty"><div>${ico(icon)}<b>${title}</b>${sub || ''}${pbar ? '<div class="pbar"><i id="lyPbar"></i></div>' : ''}</div></div>`;
function fileAudioUrl(t) { const o=off[t.id]; return o?.url || `/offline/${encodeURIComponent(o?.file || '')}`; }
function audioUrl(t) { return off[t.id] ? fileAudioUrl(t) : online() ? `/stream/${t.id}` : null; }
function setPace(meta) {
  const pace = meta && meta.pace != null ? (meta.pace < 0.36 ? 'calm' : meta.pace < 0.68 ? 'mid' : 'hype') : 'mid';
  ['lyrics', 'stage'].forEach((id) => { const el = $(id); el.classList.remove('pace-calm', 'pace-mid', 'pace-hype'); el.classList.add('pace-' + pace); });
  lyState.pace = pace;
}
const wtxt = (s) => (/\s$/.test(s) ? s : s + ' ');
function showLines(lines, kind) {
  if (kind) lyState.kind = kind;
  lyState.lines = lines;
  $('lyScroll').innerHTML = `<div class="ly-inner" id="lyInner">${lines.map((l, i) => l.endCredits
    ? `<div class="ly-line ly-credits" data-l="${i}"><small>Конец текста</small><span data-i18n-skip>${esc(l.text || '')}</span></div>`
    : l.gap
    ? `<div class="ly-gap" data-l="${i}"><i></i><i></i><i></i></div>`
    : `<div class="ly-line${lyDuet(l) ? ' v2' : ''}" data-l="${i}" style="--e:${(l.energy ?? 0.6).toFixed(2)}">${lyWordsHtml(l.words && l.words.length ? l.words : [{ t: l.t, s: l.text }])}</div>`).join('')}</div>`;
  if (beatState.an && S().ly.snap !== false) refineWords(lines, beatState.an);
  lyState.cur = -2; lyState.word = -1; lyState.manual = null; $('lyBack') && $('lyBack').classList.remove('on');
  lyLast = null; sendLyrics();
}
function lySrc(html) { $('lySrc').innerHTML = html; if (typeof lySrcDecor === 'function') lySrcDecor(); } // 2.0.2: подпись источника кликабельна — выбор источника
function srcName(L) {
  const s = L.source || '';
  if (L.provider === 'spicy') return s || 'Spicy Lyrics'; // 2.0.4
  if (/^(Musixmatch|NetEase|LRCLIB|YouTube Music|Apple Music|Spotify) · /.test(s) || /^(YouTube Music|Apple Music|Spotify)/.test(s)) return s; // 2.0.2
  if (/ · NetEase$/.test(s)) return 'NetEase · ' + s.replace(/ · NetEase$/, '');
  return s ? 'LRCLIB · ' + s : 'Текст';
}
const hasWordTags = (lrc) => /<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>/.test(lrc || '');
const fixBtn = (txt) => `<br><button class="btn sm" data-act="lyfix">${ico('tune')}${txt}</button>`;
async function loadLyricsFor(t) {
  const tok = ++lyTok;
  Object.assign(lyState, { id: t.id, lines: null, cur: -1, curText: '', word: -1, kind: null }); $('visLine').innerHTML = ''; if (fixOpen) renderFix();
  $('lyScroll').innerHTML = lyEmpty('lyrics', 'Ищу текст…'); lySrc(''); setPace(null); updateOffset();
  let L = lib.lyrics[t.id];
  if (needFetch(L)) L = (await fetchLyrics(t).catch(() => null)) || L;
  if (tok !== lyTok || lyState.id !== t.id) return;
  lyLast = null;
  if (!L || L.none) {
    $('lyScroll').innerHTML = lyEmpty('music', 'Текст не найден', (online() ? '<div>Для этого трека нет текста в Musixmatch, NetEase и LRCLIB</div>' : '<div>Нет интернета — текст скачается вместе с треком</div>') + fixBtn('Найти или вставить текст'));
    sendLyrics(); return;
  }
  if (L.user) { showLines(parseLRC(L.user), 'user'); setPace(AutoSync.paceForSynced(lyState.lines, beatState.an)); lySrc(`${ico('edit')}<span>Своя синхронизация${L.userAt ? ' · ' + new Date(L.userAt).toLocaleDateString() : ''}</span>`); return; }
  if (L.instrumental) { $('lyScroll').innerHTML = lyEmpty('piano', 'Инструментал', '<div>Просто наслаждайся</div>' + fixBtn('Здесь есть слова? Найти текст')); sendLyrics(); return; }
  if (L.synced) {
    const word = hasWordTags(L.synced);
    // 2.0.4: Spicy Lyrics — строим строки из точных данных (слоги, бэк-вокал со своим временем), а не из LRC
    const spx = L.spx && typeof spxLines === 'function' ? spxLines(L.spx) : null;
    showLines(spx || parseLRC(L.synced), word ? 'word' : 'synced'); setPace(AutoSync.paceForSynced(lyState.lines, beatState.an));
    if (beatState.an) lyAutoAlign(t, beatState.an); // 2.0.4-fix
    const k = stretchK();
    lySrc(`${ico('lyrics')}<span>${esc(srcName(L))}${word ? ' · по словам' : ''}${Math.abs(k - 1) > 0.01 ? ` · темп ×${k.toFixed(2)}` : ''}</span>`);
    return;
  }
  // обычный текст без времени: раскладываем по ритму и голосу трека
  lyState.kind = 'auto';
  if (L.auto && L.auto.lines) { showLines(L.auto.lines, 'auto'); setPace(L.auto.meta); }
  else {
    $('lyScroll').innerHTML = lyEmpty('mic', 'Синхронизирую текст…', '<div>Слушаю ритм песни</div>', true);
    const an = await getAnalysis(t).catch(() => null); if (tok !== lyTok) return;
    const res = an ? AutoSync.align(L.plain, an, t.dur || E.dur()) : null;
    if (!res) { $('lyScroll').innerHTML = `<div class="ly-plain">${esc(L.plain)}</div>`; lySrc(`${ico('lyrics')}<span>${esc(srcName(L))} · без времени</span>`); sendLyrics(); return; }
    res.lines.forEach((l) => { if (!l.gap && l.energy == null) l.energy = an.energy(l.t + 1); });
    showLines(res.lines, 'auto'); setPace(res.meta);
    L.auto = { lines: res.lines, meta: res.meta }; save();
  }
  lySrc(`${ico('wave')}<span>${esc(srcName(L))} · примерно, по ритму — поправь в корректоре</span>`);
}
// 2.0.2: распознавание текста нейросетью (Whisper) убрано — заглушки для плагинов и старого кода
function scheduleWhisper() {}
function bgVoice() {}
const wsModelOk = () => false;

// ---------- сдвиг и подгонка ----------
const offset = () => lib.offsets[lyState.id] || 0;
// 2.0.4: ключ Spicy Lyrics API — текст из их базы для всего Pulse (если включено)
const spicyKeyOn = () => (S().spicy || {}).src !== false || lySrcMode() === 'spicy';
function updateOffset() { const o = offset(); $('lyOff').textContent = `${o > 0 ? '+' : ''}${o.toFixed(1)}s`; }
function shiftOffset(d) { if (!lyState.id) return; lib.offsets[lyState.id] = Math.round((offset() + d) * 10) / 10; updateOffset(); save(); lyReRefine(); lyState.cur = -2; sendState(); }
function tapSync(i) {
  const L = lyState.lines && lyState.lines[i]; if (!L || !lyState.id) return;
  lib.offsets[lyState.id] = Math.round((heard(S().ly.lag || 0) - L.t * stretchK()) * 10) / 10; updateOffset(); save(); lyReRefine(); lyState.cur = -2; sendState();
  toast(`Подогнал: эта строка начинается сейчас (${offset() > 0 ? '+' : ''}${offset().toFixed(1)}s)`, 'mic');
}
// текст для виджета и плагинов — уже с учётом темпа
let lyLast = null;
function sendLyrics() {
  if (!pulse.sendLyrics) return;
  const ln = lyState.lines; if (ln === lyLast && ln) return; lyLast = ln; const k = stretchK();
  const lyo = ln ? { id: lyState.id, lines: ln.map((l) => (l.gap ? { t: l.t * k, gap: l.gap * k } : { ...(l.endCredits ? {endCredits:true} : {}), t: l.t * k, text: l.text || (l.words || []).map((w) => w.s).join(' ').trim(), words: l.words ? l.words.map((w) => ({ t: w.t * k, e: w.e != null ? w.e * k : undefined, s: wtxt(w.s) })) : null })) } : { id: lyState.id, lines: [] };
  pulse.sendLyrics(lyo); if (window.pvWidgetLy) window.pvWidgetLy(lyo);
  PX.emit('lyrics', ln);
}

// ---------- прокрутка и подсветка ----------
// ручная прокрутка текста: колесо / перетаскивание; через пару секунд текст сам возвращается к текущей строке
function lyPlace(inner, y) { lyState.ty = y; if (lyState.manual) return; inner.style.transform = `translateY(${y}px)`; }
function lyManual(dy) {
  const inner = $('lyInner'); if (!inner || !lyState.lines) return;
  if (!lyState.manual) { lyState.manual = { y: lyState.ty || 0 }; inner.classList.add('free'); $('lyBack').classList.add('on'); }
  const m = lyState.manual, H = inner.scrollHeight; m.y = Math.max(-H + 40, Math.min(40, m.y - dy)); m.until = performance.now() + (S().ly.backDelay ?? 4) * 1000;
  inner.style.transform = `translateY(${m.y}px)`;
}
function lyResume() { const inner = $('lyInner'); lyState.manual = null; if (inner) { inner.classList.remove('free'); inner.style.transform = `translateY(${lyState.ty || 0}px)`; } $('lyBack').classList.remove('on'); }
// последний индекс i, у которого a[i].t <= x (двоичный поиск)
// 2.0.4: n — искать только среди первых n слов (основной голос без бэк-вокала Spicy)
function lastAt(a, x, n) { let lo = 0, hi = n || a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m].t <= x) lo = m + 1; else hi = m; } return lo - 1; }
// 2.0.5: караоке-движок (karaoke.js, механика Spicy Lyrics) — каждое слово активной строки считается из времени каждый кадр,
// поэтому слова больше не пропускаются и не «пролетают». Старый путь (одно текущее слово + CSS-переходы) остаётся
// для режима «Строкой» и на случай, если karaoke.js не загрузился.
const karaOn = () => typeof Kara !== 'undefined' && S().ly.mode !== 'lines';
let lyLeadKey = '';
function lyricsFrame(t) {
  const lines = lyState.lines; if (!lines) return;
  if (lyState.manual && (S().ly.backDelay ?? 4) > 0 && performance.now() > lyState.manual.until && !lyState.drag) lyResume();
  t = (t - offset()) / stretchK();
  if (fix.tap) tapFrame(t);
  // упреждение строки = половина анимации слова. 2.0.5: getComputedStyle — только при смене темпа/стиля, а не на каждой строке
  { const key = lyState.pace + '|' + (document.body.dataset.lyanim || ''); if (key !== lyLeadKey) { lyLeadKey = key; const wt = parseFloat(getComputedStyle($('lyrics')).getPropertyValue('--wt')) || 0.18; lyState.lead = Math.max(0.03, Math.min(0.3, wt * 0.5)); } }
  const lead = lyState.lead ?? 0.09;
  const i = lastAt(lines, t + Math.max(0.06, lead));
  const inner = $('lyInner'); if (!inner) return;
  const kara = karaOn(), lyEl = $('lyrics'); if (lyEl.classList.contains('kara') !== kara) lyEl.classList.toggle('kara', kara);
  if (i !== lyState.cur) {
    const prev = lyState.cur, kids = inner.children, n = kids.length;
    // 2.0.5: сначала читаем раскладку (пока стили «чистые»), потом пишем классы — без принудительного пересчёта посреди кадра
    const el = kids[i], y = el ? -(el.offsetTop + el.offsetHeight / 2) : -(kids[0]?.offsetHeight || 0) / 2;
    if (prev < 0) { inner.querySelectorAll('.ly-line.cur').forEach((x) => x.classList.remove('cur')); inner.querySelectorAll('.w.on,.w.pop,.w.fl,.w.hot').forEach((w) => w.classList.remove('pop', 'on', 'fl', 'hot')); if (typeof Kara !== 'undefined') Kara.reset(); }
    else { const pe = kids[prev]; if (pe) { pe.classList.remove('cur'); pe.querySelectorAll('.w.on,.w.pop,.w.fl,.w.hot').forEach((w) => w.classList.remove('pop', 'on', 'fl', 'hot')); } }
    // past / far меняются только у строк рядом со старой и новой позицией (раньше — у всех строк песни на каждой смене)
    const lo = prev < 0 ? 0 : Math.max(0, Math.min(prev, i) - 3), hi = prev < 0 ? n - 1 : Math.min(n - 1, Math.max(prev, i) + 3);
    for (let k = lo; k <= hi; k++) { const c = kids[k]; const ps = k < i, fr = Math.abs(k - i) > 2; if (c.classList.contains('past') !== ps) c.classList.toggle('past', ps); if (c.classList.contains('far') !== fr) c.classList.toggle('far', fr); }
    lyState.cur = i; lyState.word = -1; lyState.wEl = null;
    if (el) el.classList.add('cur');
    lyPlace(inner, y);
    const L0 = lines[i];
    if (kara) Kara.line(L0, el, lines, i); else if (typeof Kara !== 'undefined') Kara.reset();
    lyState.curText = (L0 && L0.text) || ''; PX.emit('line', lyState.curText);
    if (typeof lyKinLine === 'function') lyKinLine(i);
    // 2.0.9: «Построчно» — угаданные слова не дробим, строка одним куском; «Импровизация» — по словам
    const visWords = L0 && L0.words ? (L0.est && S().ly.lineFx !== 'improv' ? [{ s: L0.text || L0.words.map((w) => w.s).join(' ') }] : L0.words) : null;
    $('visLine').innerHTML = visWords ? visWords.map((w) => `<span class="w">${esc(wtxt(w.s))}</span>`).join('') : '';
  }
  const L = lines[i], el = inner.children[i];
  if (kara) Kara.frame(t);
  if (!L || !el) return;
  if (L.gap) { const n = Math.min(3, Math.floor(((t - L.t) / L.gap) * 3) + 1); el.querySelectorAll('i').forEach((d, k) => d.classList.toggle('on', k < n)); return; }
  if (!L.words || !L.words.length) return;
  const fill = S().ly.fill !== false;
  const w = lastAt(L.words, t + (kara || fill ? 0.01 : lead), L.nb);
  if (w !== lyState.word) {
    const spans = el.querySelectorAll('.w'), ow = lyState.word;
    if (kara) {
      // классы on/hot — для тем, плагинов и «Только текст»; внешний вид рисует движок. Меняем только изменившиеся слова
      const a = Math.max(0, Math.min(ow, w)), b = Math.max(ow, w);
      for (let k = a; k <= b && k < spans.length; k++) { const s = spans[k]; s.classList.toggle('on', k <= w); s.classList.toggle('hot', k === w); }
      if (ow > w) for (let k = w + 1; k <= ow && k < spans.length; k++) spans[k].classList.remove('on', 'hot');
    } else {
      spans.forEach((s, k) => { s.classList.toggle('on', k <= w); s.classList.toggle('hot', k === w); if (k !== w) s.classList.remove('pop', 'fl'); }); // 2.0.3: hot — светится только поющееся слово
      if (spans[w]) { const sp = spans[w]; sp.classList.add('pop'); setTimeout(() => sp.classList.remove('pop'), 220); }
    }
    $('visLine').querySelectorAll('.w').forEach((s, k) => s.classList.toggle('on', k <= w));
    lyState.word = w; lyState.wEl = spans[w] || null;
    // конец слова: из базы (Musixmatch / NetEase знают длину слова) или до начала следующего, не дольше 2,5 с
    const cw = L.words[w], nx = L.words[w + 1] || lines[i + 1];
    lyState.wEnd = w >= 0 ? (cw.e != null && cw.e > cw.t ? cw.e : Math.min(nx ? nx.t : cw.t + 1.2, cw.t + 2.5)) : 0;
    if (typeof lyKinWord === 'function') lyKinWord(L, w, i);
  }
  if (kara) return;
  // плавная заливка поющегося слова слева направо (караоке) — старый путь
  const we = lyState.wEl;
  if (fill && we && w >= 0) { const a = L.words[w].t, p = Math.max(0, Math.min(1, (t - a) / Math.max(0.12, lyState.wEnd - a))); we.classList.toggle('fl', p < 1); we.style.setProperty('--wp', p.toFixed(3)); }
}
// сглаженные часы для текста. 2.0.5: currentTime у <audio>/YouTube обновляется ступеньками (раз в 15–250 мс).
// Раньше прогноз каждый кадр тянулся к «застывшему» значению — время шло рывками, и слова то пролетали, то стояли.
// Теперь поправка делается только когда плеер реально выдал новое время, и часы не идут назад (кроме перемотки).
const lyClk = { m: 0, p: 0, raw: NaN };
function lySmooth(t) {
  const now = performance.now() / 1000, rate = (engine === 'audio' && audio && audio.playbackRate) || 1;
  if (!playing) { lyClk.m = t; lyClk.p = now; lyClk.raw = NaN; return t; }
  let v = lyClk.m + Math.min(0.25, now - lyClk.p) * rate;
  const raw = E.time();
  if (raw !== lyClk.raw) {
    lyClk.raw = raw; const err = t - v;
    if (Math.abs(err) > 0.25 || !lyClk.p) v = t; // перемотка, буферизация, старт
    else v += err * 0.3;
  }
  if (v < lyClk.m && lyClk.m - v < 0.25) v = lyClk.m; // мелкий откат назад не показываем — слово не «мигает»
  lyClk.m = v; lyClk.p = now; return v;
}

// ---------- ритм песни и визуализатор ----------
const beatState = { an: null, kp: -1, lastT: 0, bass: 0, flux: 0 };
const anCache = new Map();
function getAnalysis(t) {
  const url = audioUrl(t); if (!url || typeof AutoSync === 'undefined') return Promise.resolve(null);
  if (anCache.has(t.id)) return anCache.get(t.id);
  const p = AutoSync.analyze(url).catch(() => null);
  anCache.set(t.id, p); if (anCache.size > 4) anCache.delete(anCache.keys().next().value);
  return p;
}
// 2.0: оценённые слова (у строки из базы есть только время начала) притягиваем к атакам голоса из анализа трека.
// Первое слово стоит на времени строки из базы; остальные — к ближайшей атаке в пределах ±0,35 с от оценки, по порядку.
function refineWords(lines, an) {
  if (!lines || !an || !an.onsets || !an.onsets.length) return;
  const O = an.onsets, k = stretchK(), sh = offset();
  for (const L of lines) {
    if (!L.est || L.refined || !L.words || L.words.length < 2) continue;
    const t0 = L.t, t1 = L.end || L.words[L.words.length - 1].e || L.t + 4;
    const on = O.map((o) => (o - sh) / k).filter((o) => o > t0 + 0.05 && o < t1 + 0.2);
    if (on.length < (L.words.length - 1) * 0.5) { L.refined = true; continue; }
    let prev = L.words[0].t, oi = 0;
    for (const w of L.words) { if (w.t0 == null) { w.t0 = w.t; w.e0 = w.e; } } // 2.0.4-fix: исходная оценка — чтобы пересчитать при новом сдвиге
    for (let j = 1; j < L.words.length; j++) {
      const w = L.words[j]; let best = -1, bd = 0.35;
      for (let q = oi; q < on.length; q++) { const d = Math.abs(on[q] - w.t); if (on[q] <= prev + 0.08) continue; if (d < bd) { bd = d; best = q; } if (on[q] > w.t + 0.35) break; }
      if (best >= 0) { w.t = on[best]; oi = best + 1; }
      if (w.t <= prev + 0.1) w.t = prev + 0.1; // 2.0.5: было 0,06 — слово успевало только мигнуть
      L.words[j - 1].e = Math.min(L.words[j - 1].e ?? w.t, w.t);
      prev = w.t;
    }
    L.refined = true;
  }
}
// 2.0.4-fix: слова притягивались к атакам голоса с учётом сдвига, который был В ТОТ момент. После «+0.5 с» или смены темпа
// они оставались привязаны к старым местам и пели мимо. Теперь при сдвиге/темпе оценённые слова пересчитываются заново.
function lyReRefine() {
  const lines = lyState.lines, an = beatState.an; if (!lines) return;
  for (const L of lines) { if (!L.est || !L.words) continue; for (const w of L.words) if (w.t0 != null) { w.t = w.t0; w.e = w.e0; } L.refined = false; }
  if (an && S().ly.snap !== false) refineWords(lines, an);
  if (typeof Kara !== 'undefined') Kara.reset(); lyLast = null; sendLyrics();
}
// 2.0.4-fix: автоподгонка сдвига. Треки Spotify / Apple Music играют звуком из YouTube Music, а текст размечен под запись сервиса.
// Если у ролика есть вступление или он другой длины, весь текст ехал на несколько секунд. Если длина записи и текста
// расходится больше чем на 1,5 с — ищем сдвиг, при котором начала строк лучше всего совпадают с атаками голоса.
function lyAutoAlign(t, an) {
  const id = t && t.id, lines = lyState.lines, L = id && lib.lyrics[id];
  if (!an || !lines || lyState.id !== id || !L || L.user || !lyFromDb() || lib.offsets[id] != null || !an.onsets || an.onsets.length < 20) return;
  const src = L.srcDur || 0; if (!src || !an.dur || Math.abs(an.dur - src) < 1.5 || L.stretch || lib.stretch[id]) return;
  const tl = lines.filter((l) => !l.gap && l.text), starts = tl.map((l) => l.t); if (starts.length < 6) return;
  // «входы» голоса — первая строка и строки после проигрыша (≥ 6 с тишины): по ним сдвиг виден лучше всего
  const entries = starts.filter((x, i) => i === 0 || x - (tl[i - 1].end || starts[i - 1] + 3) > 4 || x - starts[i - 1] > 8);
  const O = an.onsets, segs = an.segs || []; if (!segs.length) return;
  const hitAt = (x) => { let lo = 0, hi = O.length; while (lo < hi) { const m = (lo + hi) >> 1; if (O[m] < x - 0.12) lo = m + 1; else hi = m; } return lo < O.length && O[lo] <= x + 0.3; };
  const inVoc = (x) => segs.some((g) => x >= g.s - 0.2 && x <= g.e);
  const entryHit = (y) => segs.some((g) => g.s >= y - 0.7 && g.s <= y + 0.7);
  const score = (d) => { let sc = 0, eh = 0; for (const x of starts) { const y = x + d; if (y < 0 || y > an.dur) { sc -= 0.5; continue; } if (inVoc(y + 0.3)) sc += 0.5; if (hitAt(y)) sc += 0.2; } for (const x of entries) if (entryHit(x + d)) { sc += 2; eh++; } return { sc, eh }; };
  const R = Math.min(30, Math.abs(an.dur - src) + 4), base = score(0); let best = base, bd = 0, be = 0;
  for (let d = -R; d <= R; d += 0.05) { const v = score(d); if (v.sc > best.sc + 1e-6) { best = v; bd = be = d; } else if (Math.abs(v.sc - best.sc) < 1e-6 && Math.abs(d - be - 0.05) < 1e-3) be = d; }
  bd = (bd + be) / 2; // середина «плато» лучших значений
  if (Math.abs(bd) < 0.3 || best.eh < 2 || best.eh < base.eh + 1 || best.sc < base.sc + 2.5) return;
  lib.offsets[id] = Math.round(bd * 10) / 10; L.autoOff = lib.offsets[id]; save(); updateOffset(); lyReRefine(); lyState.cur = -2; sendState();
  toast(`Текст подогнан под эту запись: ${bd > 0 ? '+' : ''}${lib.offsets[id].toFixed(1)} с (длина отличается на ${Math.round(an.dur - src)} с)`, 'mic');
}
function analyzeCurrent(t) {
  getAnalysis(t).then((an) => {
    if (!an || curTrack()?.id !== t.id) return;
    beatState.an = an; beatState.kp = -1;
    if (lyState.lines && lyState.id === t.id && S().ly.snap !== false) { refineWords(lyState.lines, an); lyLast = null; sendLyrics(); }
    if (lyState.lines && lyState.id === t.id) lyAutoAlign(t, an);
    if (lyState.lines && lyState.id === t.id) setPace(AutoSync.paceForSynced(lyState.lines, an));
  });
}
function beatTimes() { const an = beatState.an; if (!an) return null; return an.kicks && an.kicks.length > 8 ? an.kicks : (an.grid || []).map((t) => ({ t, s: 0.6 })); }
let beat = 0;
function scheduledBeat(tm) {
  const K = beatTimes(); if (!K || !K.length) return 0;
  if (beatState.kp < 0 || tm < beatState.lastT - 0.25 || tm - beatState.lastT > 1.5) { let lo = 0, hi = K.length; while (lo < hi) { const m = (lo + hi) >> 1; if (K[m].t < tm) lo = m + 1; else hi = m; } beatState.kp = lo; }
  beatState.lastT = tm;
  let hit = 0;
  while (beatState.kp < K.length && K[beatState.kp].t <= tm + 0.02) { const k = K[beatState.kp++]; if (tm - k.t < 0.12) hit = Math.max(hit, 0.5 + 0.5 * (k.s ?? 0.6)); }
  return hit;
}
Viz.init($('viz'));
// центр и радиус обложки в координатах холста (раньше считалось от сцены — кольцо съезжало)
// 2.0.3: раньше считалось КАЖДЫЙ кадр (2× getBoundingClientRect + getComputedStyle сразу после смены --beat) —
// браузер был вынужден пересчитывать стили и раскладку посреди кадра. Теперь — раз в 250 мс (и при смене размера окна)
// 2.0.4: положение обложки для визуала — каждый кадр, но в САМОМ НАЧАЛЕ кадра (до записи стилей), поэтому это дёшево.
// В 2.0.3 значение кэшировалось на 250 мс, и кольцо «прыгало» за вращающейся обложкой 4 раза в секунду. Радиус берём из
// размера элемента без трансформаций (offsetWidth): у вращающейся обложки рамка getBoundingClientRect «дышит» до √2 раз.
function artRect() {
  const art = $('art'), w = $('artWrap'); if (!art || !w) return null;
  const now = performance.now();
  if (now - (artRect.at || 0) > 500) { artRect.at = now; artRect.vis = getComputedStyle(w).opacity >= 0.05; } // прозрачность меняется редко
  const ow = art.offsetWidth; if (!ow || !artRect.vis) return null;
  const cv = vizCv.getBoundingClientRect(), a = art.getBoundingClientRect();
  return { x: a.left - cv.left + a.width / 2, y: a.top - cv.top + a.height / 2, r: ow / 2 };
}
// ---------- темп: сетка долей из анализа трека или «живой» трекер по ударам баса ----------
const live = { kicks: [], bpm: 0, ref: 0, conf: 0 };
function liveKick(tm) {
  const K = live.kicks; if (K.length && tm - K[K.length - 1] < 0.24) return; K.push(tm); while (K.length && tm - K[0] > 10) K.shift();
  if (K.length < 6) return;
  const iv = []; for (let i = 1; i < K.length; i++) { let d = K[i] - K[i - 1]; while (d < 0.33) d *= 2; while (d > 0.86) d /= 2; iv.push(d); }
  iv.sort((a, b) => a - b); const med = iv[iv.length >> 1], near = iv.filter((d) => Math.abs(d - med) < 0.04).length / iv.length;
  live.bpm = 60 / med; live.conf = Math.min(1, near * 1.2); live.ref = tm;
}
// позиция в долях по сетке ударов трека; интервал берётся локальный — сетка следует за «живым» темпом
function tempoOf(an, tm) {
  if (!an || !an.grid || an.grid.length < 8 || !an.bpm) return null;
  const g = an.grid, per = 60 / an.bpm; let lo = 0, hi = g.length; while (lo < hi) { const m = (lo + hi) >> 1; if (g[m] <= tm) lo = m + 1; else hi = m; }
  const i = lo - 1, d0 = an.down || 0;
  let pos;
  if (i < 0) pos = (tm - g[0]) / per;
  else if (i >= g.length - 1) pos = i + (tm - g[i]) / per;
  else { const loc = g[i + 1] - g[i]; pos = i + Math.min(0.999, (tm - g[i]) / (loc > 0.2 && loc < 2 ? loc : per)); }
  const loc = i > 0 && i < g.length - 1 ? 60 / (g[i + 1] - g[i - 1]) * 2 : an.bpm;
  return { bpm: loc > 40 && loc < 240 ? loc : an.bpm, pos: pos - d0, conf: 1 };
}
function tempoAt(tm) {
  const r = tempoOf(beatState.an, tm); if (r) return r;
  const an = null;
  if (live.bpm && tm - live.ref < 12) return { bpm: live.bpm, pos: (tm - live.ref) / (60 / live.bpm), conf: live.conf * 0.8 };
  return { bpm: 100, pos: tm * 100 / 60, conf: 0 };
}
function vizStyle() { if (['galaxy', 'orbit', 'orbits', 'flight'].includes(lib.vizStyle)) lib.vizStyle = 'ring'; return Viz.STYLES.find((x) => x.id === lib.vizStyle) || Viz.STYLES[0]; }
function vizMenu(x, y) {
  showMenu(x, y, Viz.STYLES.map((v) => [v.icon || 'wave', (v.id === lib.vizStyle ? '• ' : '') + v.name, () => setViz(v.id)]));
  const i = Viz.STYLES.findIndex((v) => v.id === lib.vizStyle), el = $('menu').querySelector(`[data-mi="${i}"]`); if (el) el.classList.add('on');
}
function setViz(id) { lib.vizStyle = id; updateButtons(); save(); rerenderSettings(); }
function cycleViz(d = 1) { const S = Viz.STYLES, i = S.findIndex((x) => x.id === lib.vizStyle); setViz(S[(i + d + S.length) % S.length].id); }
Viz.onChange(() => { updateButtons(); rerenderSettings(); });
const mainFramePacer = PulseFramePacer.create();
let lastFrame = 0, lastBeatV = '', ppEl = $('pp'), beatArt = $('artWrap'), beatLine = null; ppEl.style.setProperty('--beat', '0');
// кольцевой буфер кадров анализатора: показываем спектр с той же задержкой, с какой его слышно
const fRing = Array.from({ length: 24 }, () => ({ t: 0, f: null, w: null })); let fRi = 0;
function delayedSpectrum(now, lagMs) {
  const slot = fRing[fRi = (fRi + 1) % fRing.length];
  if (!slot.f) { slot.f = new Uint8Array(analyser.frequencyBinCount); slot.w = new Uint8Array(analyser.fftSize); }
  analyser.getByteFrequencyData(slot.f); analyser.getByteTimeDomainData(slot.w); slot.t = now;
  if (lagMs < 8) return slot;
  let best = slot; for (const x of fRing) if (x.f && x.t <= now - lagMs && (best === slot || x.t > best.t)) best = x;
  return best;
}
// 1.0.0: one real signal feeds Visuals, text bass and Mineradio in either engine.
function readSpectrum(now = performance.now(), lagMs = 0) {
  if (!playing) return null;
  if (engine === 'audio' && analyser && actx && actx.state === 'running') {
    const f = delayedSpectrum(now, lagMs); return { f: f.f, w: f.w, sampleRate: actx.sampleRate, fftSize: analyser.fftSize };
  }
  return engine === 'yt' && window.PulseAudioSignal ? PulseAudioSignal.read(now) : null;
}
let hueT = 0, liveHueAt = 0;
const ambEl = $('ambient'), vizCv = $('viz');
let hiddenNow = document.hidden; document.addEventListener('visibilitychange', () => (hiddenNow = document.hidden || winHiddenIpc));
// 2.0.12: окно спрятано в трей / виджет / свёрнуто (сигнал из main.js — сам браузер этого не видит из-за backgroundThrottling:false).
// Главный цикл, «Только текст», Mineradio и CSS-анимации встают на паузу; звук, диджей и виджет продолжают работать
let winHiddenIpc = false;
function setWinHidden(v) {
  v = !!v; if (v === winHiddenIpc) return; winHiddenIpc = v; window.pulseWinHidden = v; hiddenNow = document.hidden || v;
  document.body.classList.toggle('win-hidden', v);
  if (typeof mrSync === 'function') try { mrSync(); } catch (e) {}
  if (!v && typeof lys !== 'undefined' && lys.on && !lys.raf) lys.raf = requestAnimationFrame(lysLoop);
  if (!v) { lastFrame = 0; mainFramePacer.reset(); }
}
let winFocused = document.hasFocus(); window.addEventListener('focus', () => (winFocused = true)); window.addEventListener('blur', () => (winFocused = false));
let ppOpenNow = document.body.classList.contains('pp-open'), lyOnlyNow = false, mrOnNow = false;
// 2.0.8: заодно помним «Только текст» и Mineradio — под сценой плеер и визуал не видны, их не рисуем
new MutationObserver(() => { const c = document.body.classList; ppOpenNow = c.contains('pp-open'); lyOnlyNow = c.contains('lyonly'); mrOnNow = c.contains('mr-on'); }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
// есть ли на экране что-то живое (предпросмотр визуала, диджей-пульт) — проверяем раз в секунду, а не каждый кадр
let lvAt = 0, lvOn = false;
function liveVisualOnScreen() { const n = performance.now(); if (n - lvAt > 1000) { lvAt = n; lvOn = !!document.querySelector('.pv canvas, .pv-ly, .dj-page, .deck, .wave-hero.anim'); } return lvOn; }
// счётчик FPS (Настройки → Приложение → «Показывать FPS»)
let fpsN = 0, fpsAt = 0;
function fpsTick(now) { if (!S().perf.showFps) return; fpsN++; if (now - fpsAt >= 1000) { let el = $('fpsMeter'); if (!el) { el = document.createElement('div'); el.id = 'fpsMeter'; document.body.appendChild(el); } const ui = Math.round(fpsN * 1000 / (now - fpsAt)), v = Viz.stats ? Viz.stats() : null; el.textContent = 'UI ' + ui + ' FPS' + (ppOpenNow && !lyOnlyNow && lib.mode === 'visual' && v ? ' · VIZ ' + Math.round(v.fps) + ' FPS · ' + v.path + ' · CPU submit ' + v.submitMs.toFixed(1) + ' ms' : ''); fpsN = 0; fpsAt = now; } }
// окно скрыто (в трее / виджете): визуал и текст не рисуем, но диджейский автомикс должен продолжать работать
setInterval(() => { if (!hiddenNow) return; if (playing && typeof djTick === 'function') djTick(E.time()); if (typeof extFrame === 'function') extFrame(performance.now(), null, null, beat, null, E.time(), true); }, 120);
// 2.0.11: авто-облегчение. Режим «Авто» следит за настоящей плавностью окна (интервал между кадрами браузера).
// Если при открытом плеере или игре музыки окно 4 с подряд держится ниже ~33 FPS — значит, не успевает видеокарта
// (её не видно из скрипта): Pulse включает body.perf-lite — убирает размытие под панелями, свечение обложки и
// размытый фон окна под плеером (его и так закрывает фон плеера). Вид почти тот же, кадров на слабой графике +35…50%.
const liteS = { last: 0, ema: 16, slow: 0, on: false, told: false };
function liteSet(on) { liteS.on = on; liteS.slow = 0; document.body.classList.toggle('perf-lite', on); }
function liteTick(now) {
  const d = now - (liteS.last || now); liteS.last = now;
  const P = S().perf; if (P.mode !== 'auto' || P.autoLite === false) { if (liteS.on) liteSet(false); return; }
  if (liteS.on || mrOnNow || d <= 0 || d > 300 || !winFocused || !(ppOpenNow || playing)) return; // окно было скрыто / нечего анимировать
  liteS.ema += (d - liteS.ema) * 0.06;
  if (liteS.ema > 30) liteS.slow += d; else liteS.slow = 0;
  if (liteS.slow > 4000) {
    liteSet(true);
    if (!liteS.told) { liteS.told = true; toast('Окно рисовалось медленно — Pulse облегчил эффекты. Вернуть можно в настройках: Основные, «Авто-облегчение»'); }
  }
}
function frame(now) {
  requestAnimationFrame(frame);
  // Direct GPU draw runs first in this same RAF, before service/DOM writes.
  const visualExperiment = typeof VisualExperiment !== 'undefined' && VisualExperiment.sync(now);
  if (hiddenNow) { liteS.last = 0; mainFramePacer.reset(); return; }
  if (PulseTimecode.precise && playing) PulseTimecode.tick(now);
  if (window.PulseImmersion?.active()) {
    if (now - lastFrame < 33) return; lastFrame = now;
    if (playing && typeof djTick === 'function') djTick(E.time());
    if (typeof djFrame === 'function') djFrame(now);
    if (playing || dragging) lyricsFrame(dragging ? heard(S().ly.lag || 0) : lySmooth(heard(S().ly.lag || 0)));
    if (typeof extFrame === 'function') extFrame(now, null, null, 0, null, E.time(), true);
    return; // The hidden ordinary visualizer/MineRadio must not compete with Immersion.
  }
  if (visualExperiment) {
    if (playing && typeof djTick === 'function') djTick(E.time());
    if (typeof djFrame === 'function') djFrame(now);
    if (playing || dragging || lyState.cur === -2 || lyState.manual) lyricsFrame(dragging ? heard(S().ly.lag || 0) : lySmooth(heard(S().ly.lag || 0)));
  }
  liteTick(now);
  const V = S().viz;
  // Preserve the target phase instead of discarding fractional frame time.
  const P = S().perf, open0 = ppOpenNow;
  // 0 means display cadence. Existing quality/FPS settings are not rewritten.
  let minDt = P.mode === 'eco' ? 1000 / 30 : P.fps > 0 ? 1000 / P.fps : 0;
  // в фоне (окно не в фокусе / плеер свёрнут) хватает 30 FPS; без музыки и без визуала на экране — 4 кадра в секунду
  if (P.bgSlow !== false && P.mode !== 'high' && (!open0 || !winFocused)) minDt = Math.max(minDt, 32);
  if (!playing && !open0 && !dragging && !liveVisualOnScreen()) minDt = Math.max(minDt, 250);
  // 2.0.8: Mineradio живёт во фрейме на том же потоке — Pulse уступает ему кадр: 10 обновлений в секунду хватает тексту, биту и диджею
  if (mrOnNow) minDt = Math.max(minDt, 100);
  if (visualExperiment) minDt = Math.max(minDt, 33); // spectrum/extensions at ~30Hz; direct visuals and lyric motion keep their cadence
  fpsTick(now); // 2.0.4: счётчик показывает настоящую плавность окна, а не то, как часто перерисовывается визуал
  if (!mainFramePacer.due(now, minDt)) return;
  // 1.9.6: затухание бита по реальному времени кадра — раньше на 144 Гц бит гас в 2,4 раза быстрее, чем на 60 Гц, и эффекты «не попадали в темп»
  const dtF = Math.max(0.25, Math.min(6, (now - (lastFrame || now)) / (1000 / 60))) || 1; lastFrame = now;
  let f = null, wv = null;
  const open = ppOpenNow && !lyOnlyNow; // 2.0.8: в «Только текст» плеер закрыт сценой — визуал плеера не рисуем
  const mode0 = open ? (lib.mode === 'video' && engine === 'audio' && !window.PulseFileVideo?.visible() ? 'cover' : lib.mode) : null, ar = !visualExperiment && mode0 === 'visual' ? artRect() : null; // 2.0.4: до записи стилей
  const vLag = (V.lag || 0), ht = heard(vLag);
  const fr = readSpectrum(now, outLat() * 1000 + vLag);
  if (fr) {
    f = fr.f; wv = fr.w;
    // мгновенный удар баса (40–150 Гц)
    const hz = fr.sampleRate / fr.fftSize; let b = 0, n = 0;
    for (let i = Math.max(1, Math.floor(40 / hz)); i <= Math.ceil(150 / hz); i++) { b += f[i]; n++; }
    b = b / (n * 255); const d = b - beatState.bass; const ka = 1 - Math.pow(0.65, dtF); beatState.bass = b * ka + beatState.bass * (1 - ka);
    if (d > 0.07) { if (!beatState.an) beat = Math.max(beat, Math.min(1, b * 1.15)); if (b > 0.3) liveKick(ht); }
  }
  if (playing) { const s = scheduledBeat(ht); if (s) beat = Math.max(beat, s); }
  const tempo = tempoAt(ht), bpm = tempo.conf ? tempo.bpm : 0;
  beat *= Math.pow(bpm > 135 ? 0.86 : bpm && bpm < 90 ? 0.93 : 0.9, dtF); if (!playing) beat *= Math.pow(0.8, dtF);
  if (playing && tempo.conf && Math.floor(tempo.pos) !== beatState.lastPos) { beatState.lastPos = Math.floor(tempo.pos); PX.emit('beat', { n: beatState.lastPos, bpm: tempo.bpm }); }
  // бит квантуем шагом 0.04: глазу не видно, а перерисовок текста и обложки в 2–3 раза меньше
  const L = S().look, bv = (open || L.react) && L.beat && L.anim ? (Math.round(beat * 25) / 25).toFixed(2) : '0';
  // 2.0.3: --beat ставим только тем, кто от него зависит (обложка и текущая строка текста). Раньше он ставился на весь
  // плеер (#pp) — каждый кадр браузер пересчитывал стили сотен элементов, а свечение текста перерисовывалось (−50…100 FPS на 144 Гц)
  if (bv !== lastBeatV) {
    lastBeatV = bv; const v = open ? bv : '0';
    if (ambEl) ambEl.style.setProperty('--gbeat', bv); // 2.0.4: вернули пульс «Цветного свечения окна» под бит (пропал в 2.0.3)
    if (beatArt) beatArt.style.setProperty('--beat', v);
    const inner = open && lyState.cur >= 0 ? $('lyInner') : null, ce = inner ? inner.children[lyState.cur] : null;
    if (beatLine && beatLine !== ce) beatLine.style.removeProperty('--beat');
    beatLine = ce || null; if (beatLine) beatLine.style.setProperty('--beat', v);
  }
  // цвет интерфейса «живёт» под музыку: оттенок плывёт с энергией трека и вздрагивает на сильных долях
  // 2.0.11: каждая смена --a1…--a3 на :root перекрашивает ВСЕ акцентные элементы окна (на Главной −15% кадров и рывки).
  // Оттенок плывёт медленно — 3 раза в секунду с шагом 4° глазу не отличить от 6 раз; в фоне окна — не трогаем вовсе
  if (L.react && playing && !document.body.hasAttribute('data-home-scrolling') && (winFocused || S().perf.mode === 'high') && now - liveHueAt > (S().perf.mode === 'high' ? 90 : 330)) {
    liveHueAt = now; const an = beatState.an, en = an && an.energy ? an.energy(ht) : Math.min(1, (beatState.bass || 0) * 1.6);
    hueT += 0.09 * (0.3 + en); const deg = (L.reactAmt ?? 50) / 100 * (Math.sin(hueT * 0.35) * 26 + (en - 0.5) * 44 + beat * 10);
    livePalette(deg);
  }
  if (!visualExperiment && playing && typeof djTick === 'function') djTick(E.time());
  if (!visualExperiment && typeof djFrame === 'function') djFrame(now);
  if (open && !visualExperiment) {
    const mode = mode0;
    try { Viz.draw({ minDt, quality: S().perf.mode, sens: V.sens / 100, noBars: true, freq: f, wave: wv, beat: V.tempo ? beat : beat * 0.6, playing, mode, style: lib.vizStyle, artRect: ar, center: !ar && mode === 'visual' ? stageCenter() : null, tempo: V.tempo ? tempo : { bpm: 100, pos: performance.now() / 600, conf: 0 }, sr: fr ? fr.sampleRate : actx ? actx.sampleRate : 48000, fx: V.fx, cover: coverImg, energy: beatState.an && beatState.an.energy ? beatState.an.energy(ht) : null }); } catch (e) { console.error(e); }
  }
  if (!visualExperiment && (playing || dragging || lyState.cur === -2 || lyState.manual)) lyricsFrame(dragging ? heard(S().ly.lag || 0) : lySmooth(heard(S().ly.lag || 0)));
  if (typeof extFrame === 'function') extFrame(now, f, wv, V.tempo ? beat : beat * 0.6, tempo, ht, false);
  if (typeof waveFrame === 'function' && !lyOnlyNow && !visualExperiment) waveFrame(now, f, beat, tempo); // 2.0.4: живая волна на Главной (сама решает, рисовать ли)
}
requestAnimationFrame(frame);
// центр сцены в координатах холста (холст может выходить под панель текста — режим «До края окна»)
let scC = null, scAt = 0;
function stageCenter() {
  const now = performance.now(); if (scC && now - scAt < 500) return scC; scAt = now;
  const c = vizCv.getBoundingClientRect(), st = $('stage').getBoundingClientRect();
  return (scC = { x: st.left - c.left + st.width / 2, y: st.top - c.top + st.height * 0.45 });
}
window.addEventListener('resize', () => (scC = null));

PulseTimecode.mount({currentNode:$('tCur'), durationNode:$('tDur'), current:()=>E.time(), duration:()=>E.dur(), legacy:fmt});
setInterval(() => {
  const d = E.dur(), c = E.time();
  if (!hiddenNow) {
    if (!dragging) $('seekFill').style.width = d ? (c / d) * 100 + '%' : '0';
    PulseTimecode.update(c, d);
  }
  if (!playing && lyState.lines && !hiddenNow) lyricsFrame(heard(S().ly.lag || 0));
  if ('mediaSession' in navigator && d && navigator.mediaSession.setPositionState) try { navigator.mediaSession.setPositionState({ duration: d, position: Math.min(c, d), playbackRate: 1 }); } catch {}
}, 250);
setInterval(sendState, 700);

// ---------- действия с элементами ----------
function openItem(it) {
  if (!it) return;
  if (it.kind === 'song') return playRadio(it);
  if (it.kind === 'local') return it.id === '__off' ? go({ r: 'downloads' }) : go({ r: 'local', id: it.id });
  if (it.browseId) goBrowse(it.browseId, it.params);
}
async function quickPlay(it) {
  if (!it) return;
  if (it.kind === 'song') return playRadio(it);
  if (it.kind === 'local') { const p = it.id === '__local' ? {name:'Локальные треки',tracks:MediaLibrary.tracks()} : it.id === '__off' ? { name: 'Скачанное', tracks: offlineTracks() } : lib.playlists.find((x) => x.id === it.id); if (p && p.tracks.length) playList(p.tracks, 0, p.name); return; }
  if (!online()) return toast('Нет интернета');
  toast('Загружаю…', 'play');
  const d = await pulse.ytm.browse(it.browseId).catch(() => null);
  if (!d || d.error) return toast('Не удалось открыть');
  if (d.type === 'artist') { if (d.header && d.header.radio) return playRadio(null, d.header.radio); const s = d.shelves.find((x) => x.items.every((y) => y.kind === 'song')); if (s) return playList(s.items, 0, it.title); return toast('Нечего играть'); }
  if (d.tracks && d.tracks.length) playList(d.tracks, 0, d.header?.title || it.title, { r: 'browse', id: it.browseId });
}
function trackFromRow(el) { const r = el.closest('.tr'); if (!r) return null; const L = got(r.dataset.l); return L ? { L, i: +r.dataset.i, t: L.tracks[+r.dataset.i] } : null; }
document.addEventListener('click', (e) => {
  const T = e.target, c = (s) => T.closest(s);
  let el;
  if (!c('#menu')) hideMenu();
  if ((el = c('[data-mi]'))) { const it = $('menu')._items[+el.dataset.mi]; if(it?.[3]){window.PulseMenus?.openSub(el,it);return;} hideMenu(); if (it && it[2]) it[2](); return; }
  if (!c('#gsearch')) $('gsearch').classList.remove('open');
  if (T === $('modal')) return closeModal();
  if ((el = c('[data-act]'))) {
    const a = el.dataset.act;
    if (a === 'login') return openLogin();
    if (a === 'closeModal') return closeModal();
    if (a === 'reload') return renderRoute(true);
    if (a === 'lyfix') return openFix(/Найти|слова/.test(el.textContent) ? 'find' : null);
    if (a === 'autoplay') { lib.autoplay = !lib.autoplay; save(); document.querySelectorAll('.toggle[data-act="autoplay"]').forEach((x) => x.classList.toggle('on', lib.autoplay)); if (lib.autoplay) extendRadio(false); return; }
  }
  if ((el = c('[data-login]'))) return doLogin(el.dataset.login);
  if ((el = c('[data-sg]'))) { $('gq').value = el.dataset.sg; return doSearch(el.dataset.sg); }
  if ((el = c('[data-go]'))) { const g = el.dataset.go; return go(g === 'library' ? { r: 'library', tab: 'pl' } : { r: g }); }
  if ((el = c('[data-b]'))) { e.stopPropagation(); return goBrowse(el.dataset.b); }
  if ((el = c('[data-local]'))) return go({ r: 'local', id: el.dataset.local });
  if ((el = c('[data-like]'))) { const x = trackFromRow(el); return toggleLike(x ? x.t : curTrack()); }
  if ((el = c('[data-dl]'))) { const x = trackFromRow(el); if (x) dlClick(x.t, el); return; }
  if ((el = c('[data-more]'))) {
    if (el.dataset.more) { const m = got(el.dataset.more); if (m && m.more) { if (m.more.search) go({ r: 'search', q: m.more.search.query, f: '' }); else goBrowse(m.more.browseId, m.more.params); } return; }
    const x = trackFromRow(el); if (x) { const b = el.getBoundingClientRect(); trackMenu(x.t, b.left - 200, b.bottom, { local: x.L.local, queue: x.L.queue ? x.t : null, ytPl: x.L.ytPl }); } return;
  }
  if ((el = c('[data-sc]'))) { const row = el.closest('.shelf').querySelector('.row,.qp,.moods'); if (row) row.scrollBy({ left: +el.dataset.sc * row.clientWidth * 0.8 }); return; }
  if ((el = c('[data-chip]'))) { const ch = got(el.dataset.chip); if (!ch) return; const on = el.classList.contains('on'); if (ch.browseId === 'FEmusic_home') return go({ r: 'home', params: on ? null : ch.params }); return goBrowse(ch.browseId, on ? null : ch.params); }
  if ((el = c('[data-sf]'))) { const r = route(); return go({ r: 'search', q: r.q || lib.lastQ || '', f: el.dataset.sf }); }
  if ((el = c('[data-lib]'))) return go({ r: 'library', tab: el.dataset.lib });
  if ((el = c('[data-play]'))) { const L = got(el.dataset.play); if (L && L.tracks.length) { const i = L.tracks.findIndex(playable); if (i < 0) return toast('Нет доступных треков'); playList(L.tracks, i, L.name, L.src); } return; }
  if ((el = c('[data-shuf]'))) { const L = got(el.dataset.shuf); if (L) shuffleList(L.tracks, L.name, L.src); return; }
  if ((el = c('[data-dlall]'))) { const L = got(el.dataset.dlall); if (L) downloadMenu(L.tracks.filter((t) => !failed(t)), el); return; }
  if ((el = c('[data-subch]'))) return toggleSub(el);
  if ((el = c('[data-rlist]'))) return playRadio(null, el.dataset.rlist);
  if ((el = c('[data-save]'))) { const s = got(el.dataset.save); if (s) saveToLib(s.d, s.id); return; }
  if ((el = c('[data-refresh]'))) return refreshLocal(el.dataset.refresh);
  if ((el = c('[data-delpl]'))) { const p = lib.playlists.find((x) => x.id === el.dataset.delpl); if (p && confirm(`Удалить «${p.name}» из библиотеки? (скачанные файлы останутся)`)) { lib.playlists = lib.playlists.filter((x) => x !== p); save(); renderSide(); back(); } return; }
  if ((el = c('[data-radio]'))) { const R = got(el.dataset.radio); if (R) playRadio(R.items[0]); return; }
  if ((el = c('[data-cp]'))) { e.stopPropagation(); const k = el.closest('[data-c]'); const R = k && got(k.dataset.c); if (R) quickPlay(R.items[+k.dataset.i]); return; }
  if ((el = c('[data-c]'))) { const R = got(el.dataset.c); if (R) openItem(R.items[+el.dataset.i]); return; }
  if ((el = c('.tr[data-l]'))) {
    const x = trackFromRow(el); if (!x) return;
    if (x.L.queue) { if (x.L.tracks === lib.queue.tracks) { if (x.i === lib.queue.idx) return toggle(); if (!playable(x.t)) return toast('Трек недоступен'); return playIdx(x.i); } }
    if (curTrack() && curTrack().id === x.t.id && x.L.tracks.length === lib.queue.tracks.length) return toggle();
    return playList(x.L.tracks, x.i, x.L.name, x.L.src);
  }
  if ((el = c('[data-l]')) && el.closest('#lyScroll') && lyState.lines && (e.altKey || e.ctrlKey)) { tapSync(+el.dataset.l); return; }
  if ((el = c('[data-l]')) && el.closest('#lyScroll') && lyState.lines) { const L = lyState.lines[+el.dataset.l]; if (fix.tap) return; if (lyState.dragged) return; E.seek(Math.max(0, L.t * stretchK() + offset() + 0.01)); if (!playing) E.play(); lyState.cur = -2; lyState.manual = null; return; }
});
document.addEventListener('contextmenu', (e) => {
  const x = trackFromRow(e.target); if (!x) return; e.preventDefault(); trackMenu(x.t, e.clientX, e.clientY, { local: x.L.local, queue: x.L.queue ? x.t : null, ytPl: x.L.ytPl });
});
$('barMid').addEventListener('click', (e) => { if (e.target.closest('button,a')) return; togglePP(); });
$('btnPP').onclick = togglePP;
$('visualReturn').onclick = () => { if (lys?.on) lyStageOpen(false); closePP(); };
$('btnLike').onclick = (e) => { e.stopPropagation(); toggleLike(curTrack()); const b = $('btnLike'); if (b.classList.contains('liked')) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); setTimeout(() => b.classList.remove('pop'), 600); } }; // 2.0.4-fix: анимация лайка
$('btnDlCur').onclick = (e) => { e.stopPropagation(); const t = curTrack(); if (t) dlClick(t, e.currentTarget); };
$('btnMore').onclick = (e) => { e.stopPropagation(); const t = curTrack(); if (!t) return; const b = e.currentTarget.getBoundingClientRect(); trackMenu(t, b.left - 120, b.top - 440, {}); };
$('accBtn').onclick = (e) => {
  e.stopPropagation();
  if (!account) return openLogin();
  const b = e.currentTarget.getBoundingClientRect();
  showMenu(b.right - 260, b.bottom + 6, [['user', account.name, null], '-', ['settings', 'Настройки', () => go({ r: 'settings' })], ['edit', 'Редактор окна', () => window.czEdit ? czEdit() : openEditor('window')], ['refresh', 'Обновить плейлисты', () => refreshAccount().then(() => toast('Обновлено', 'refresh'))],
    ['logout', 'Выйти', async () => { if (!confirm('Выйти из аккаунта?')) return; await pulse.account.logout(); account = null; accLists = null; cache.clear(); renderAccBtn(); renderSide(); renderRoute(true); toast('Вы вышли из аккаунта', 'logout'); }]]);
};

// «три полоски»: из плеера/полноэкранного режима — сразу к меню
$('btnNav').onclick = () => {
  // 1.9: полноэкранный режим больше не сбрасывается — меню открывается прямо в нём
  if (document.body.classList.contains('pp-open')) { closePP(); lib.mini = false; } else lib.mini = !lib.mini;
  document.body.classList.toggle('mini', lib.mini); save();
};
$('btnBack').onclick = back; $('btnFwd').onclick = fwd;
document.querySelectorAll('#ppSwitch button').forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));
document.querySelectorAll('#ppTabs button').forEach((b) => (b.onclick = () => setTab(b.dataset.tab)));
$('btnVizStyle').onclick = (e) => {
  e.stopPropagation(); const m = $('menu');
  // повторный клик по кнопке закрывает меню стилей
  if (m.classList.contains('show') && m._viz) { hideMenu(); return; }
  const b = e.currentTarget.getBoundingClientRect(); vizMenu(b.left, 0); m._viz = true;
  // меню открывается над кнопкой; если не помещается — прокручивается, а не прячется под заголовок окна
  m.style.top = Math.max(menuTop(), b.top - 8 - m.offsetHeight) + 'px';
  if (b.top - 8 - m.offsetHeight < menuTop()) { m.style.maxHeight = Math.max(160, b.top - 8 - menuTop()) + 'px'; m.style.top = menuTop() + 'px'; }
  const on = m.querySelector('.mi.on'); if (on) on.scrollIntoView({ block: 'nearest' });
};
$('vizPrev').onclick = (e) => { e.stopPropagation(); cycleViz(-1); }; $('vizNext').onclick = (e) => { e.stopPropagation(); cycleViz(1); };
// ---------- полноэкранный режим Pulse (вместо полноэкранного YouTube, из которого нельзя было выйти) ----------
let uiT = null;
function setFs(v) { if (lib.fs !== !!v) { lib.fs = !!v; save(); } document.body.classList.toggle('fs', !!v); $('icoFs').innerHTML = `<use href="#i-${v ? 'collapse' : 'expand'}"/>`; $('btnFs').title = v ? 'Выйти из полноэкранного (Esc)' : 'Во весь экран (F11)'; poke(); }
function poke() { document.body.classList.add('ui-show'); clearTimeout(uiT); uiT = setTimeout(() => { if (!document.querySelector('.top:hover,.bar:hover,.menu.show,.modal.show')) document.body.classList.remove('ui-show'); }, 2600); }
if (pulse.onFullscreen) pulse.onFullscreen(setFs);
window.addEventListener('mousemove', () => document.body.classList.contains('fs') && poke(), { passive: true });
$('btnFs').onclick = (e) => { e.stopPropagation(); pulse.win('fs'); };
$('fsExit').onclick = () => pulse.win('fs-off');
$('stage').addEventListener('dblclick', (e) => { if (lib.mode !== 'video') pulse.win('fs'); });
$('lyMinus').onclick = () => shiftOffset(-0.5); $('lyPlus').onclick = () => shiftOffset(0.5);
$('btnPlay').onclick = toggle; $('btnNext').onclick = () => next(); $('btnPrev').onclick = prev;
$('btnShuffle').onclick = toggleShuffle; $('btnRepeat').onclick = cycleRepeat;
$('btnDj').onclick = () => { if (!(S().dj && S().dj.on)) return; if (document.body.classList.contains('pp-open')) closePP(); go({ r: 'dj' }); };
$('brand').onclick = () => { if (document.body.classList.contains('pp-open')) closePP(); go({ r: 'home' }); };
$('btnMute').onclick = () => { if (lib.volume) { lib.prevVol = lib.volume; setVolume(0); } else setVolume(lib.prevVol || 70); };
$('vol').addEventListener('input', (e) => setVolume(+e.target.value));
$('vol').addEventListener('wheel', (e) => setVolume(lib.volume + (e.deltaY < 0 ? 5 : -5)));
const seekEl = $('seek'); const seekAt = (x) => { const r = seekEl.getBoundingClientRect(); return Math.max(0, Math.min(1, (x - r.left) / r.width)); };
seekEl.addEventListener('mousedown', (e) => { dragging = true; document.body.classList.add('seeking'); $('seekFill').style.width = seekAt(e.clientX) * 100 + '%'; });
seekEl.addEventListener('mousemove', (e) => { const tip = $('seekTip'), f = seekAt(e.clientX); tip.textContent = PulseTimecode.display(f * E.dur()); tip.style.left = f * 100 + '%'; });
window.addEventListener('mousemove', (e) => { if (dragging) $('seekFill').style.width = seekAt(e.clientX) * 100 + '%'; });
window.addEventListener('mouseup', (e) => { if (dragging) { dragging = false; document.body.classList.remove('seeking'); seekFrac(seekAt(e.clientX)); } if (e.button === 3) { e.preventDefault(); back(); } if (e.button === 4) { e.preventDefault(); fwd(); } });
$('btnMin').onclick = () => pulse.win('min'); $('btnMax').onclick = () => pulse.win('max');
$('btnClose').onclick = () => pulse.win('close'); // 2.0: кнопка мини-виджета убрана из верхней панели — Ctrl+Alt+W, трей или Настройки → Мини-виджет
$('view').addEventListener('scroll', () => document.body.classList.toggle('scrolled', $('view').scrollTop > 4), { passive: true });
// поиск
$('gsearch').addEventListener('submit', (e) => { e.preventDefault(); const s = $('suggest').querySelector('.sg.sel'); if (s) $('gq').value = s.dataset.sg; doSearch($('gq').value); });
$('gq').addEventListener('input', () => {
  const q = $('gq').value; $('gsearch').classList.toggle('has', !!q); clearTimeout(sgT);
  if (!q.trim() || !online()) return $('gsearch').classList.remove('open');
  sgT = setTimeout(async () => { const r = await pulse.ytm.suggest(q).catch(() => null); if ($('gq').value === q && document.activeElement === $('gq')) renderSuggest(Array.isArray(r) ? r : [], q); }, 180);
});
$('gq').addEventListener('keydown', (e) => {
  const items = [...$('suggest').querySelectorAll('.sg')];
  if (e.key === 'Escape') { $('gsearch').classList.remove('open'); $('gq').blur(); }
  if (!items.length || !$('gsearch').classList.contains('open') || !/Arrow(Up|Down)/.test(e.key)) return;
  e.preventDefault(); sgSel = (sgSel + (e.key === 'ArrowDown' ? 1 : -1) + items.length + 1) % (items.length + 1) - (0);
  if (sgSel >= items.length) sgSel = -1;
  items.forEach((x, k) => x.classList.toggle('sel', k === sgSel));
});
$('gqClear').onclick = () => { $('gq').value = ''; $('gsearch').classList.remove('has', 'open'); $('gq').focus(); };
window.addEventListener('online', () => { updateNet(); refreshAccount().then(flushLikes); }); window.addEventListener('offline', updateNet);
window.addEventListener('keydown', (e) => {
  if(e.target.closest?.('.media-dialog'))return;
  if (e.key === 'Escape') { hideMenu(); if ($('modal').classList.contains('show')) return closeModal(); if (document.body.classList.contains('pp-open')) return closePP(); }
  if ((e.target.tagName === 'INPUT' && e.target.type !== 'range') || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') { return; }
  if ((e.ctrlKey && e.code === 'KeyF') || e.key === '/') { e.preventDefault(); $('gq').focus(); $('gq').select(); return; }
  if (e.code === 'Space') { e.preventDefault(); toggle(); }
  if (e.altKey && e.code === 'ArrowLeft') back();
  if (e.altKey && e.code === 'ArrowRight') fwd();
  if (e.ctrlKey && e.code === 'ArrowRight') next();
  if (e.ctrlKey && e.code === 'ArrowLeft') prev();
  if (e.ctrlKey && e.code === 'ArrowUp') setVolume(lib.volume + 5);
  if (e.ctrlKey && e.code === 'ArrowDown') setVolume(lib.volume - 5);
  if (!e.ctrlKey && !e.altKey && e.code === 'KeyL') { if (document.body.classList.contains('pp-open') && lib.tab === 'lyrics') closePP(); else { openPP(); setTab('lyrics'); } }
  if (!e.ctrlKey && !e.altKey && e.code === 'KeyV') { if (lib.mode === 'visual' && document.body.classList.contains('pp-open')) cycleViz(e.shiftKey ? -1 : 1); else { openPP(); setMode('visual'); } }
  if (!e.ctrlKey && !e.altKey && e.code === 'KeyF') pulse.win('fs');
  // 2.0.4: W — «Моя волна» (запустить / пауза), X — «Не нравится»
  if (!e.ctrlKey && !e.altKey && !e.metaKey && S().wave.keys !== false && e.code === 'KeyW' && typeof waveToggle === 'function') waveToggle();
  if (!e.ctrlKey && !e.altKey && !e.metaKey && S().wave.keys !== false && e.code === 'KeyX' && typeof toggleDislike === 'function') toggleDislike(curTrack());
  // 2.0: режим диджея выключен — клавиша D ничего не делает и не перекидывает во вкладку
  if (!e.ctrlKey && !e.altKey && !e.metaKey && e.code === 'KeyD' && S().dj && S().dj.on) $('btnDj').click();
});
if ('mediaSession' in navigator) {
  navigator.mediaSession.setActionHandler('play', () => { if (!playing) toggle(); }); navigator.mediaSession.setActionHandler('pause', () => { if (playing) E.pause(); });
  // 1.0.1: Windows/GSMTC scrubbing uses the standard seek action.
  navigator.mediaSession.setActionHandler('seekto', d => { if (Number.isFinite(d.seekTime)) E.seek(Math.max(0, Math.min(E.dur(), d.seekTime))); });
  navigator.mediaSession.setActionHandler('nexttrack', () => next()); navigator.mediaSession.setActionHandler('previoustrack', prev);
}
// Esc в полноэкранном режиме: сначала закрываем меню/окна, и только если закрывать нечего — выходим из полноэкранного
function fsEscape() {
  if (window.PulseImmersion?.active()) return window.PulseImmersion.close();
  const m = $('menu').classList.contains('show'), md = $('modal').classList.contains('show'), pp = typeof pops !== 'undefined' && (pops.ly || pops.viz);
  const fx = $('lyFix') && $('lyFix').classList.contains('on');
  if (m || md || pp) { hideMenu(); if (md) closeModal(); if (pp) closeLyPop(); return; }
  if (fx && typeof closeFix === 'function') { closeFix(); return; }
  if (document.activeElement === $('gq')) { $('gsearch').classList.remove('open'); $('gq').blur(); return; }
  pulse.win('fs-off');
}
pulse.onCommand((n, a) => ({ escape: fsEscape, navBack: back, navFwd: fwd, toggle, play: () => { if (!playing) toggle(); }, pause: () => { if (playing) E.pause(); }, seekSeconds: () => { const d = E.dur(); if (Number.isFinite(a) && Number.isFinite(d) && d > 0) E.seek(Math.max(0, Math.min(d, a))); }, next: () => next(), prev, shuffle: toggleShuffle, repeat: cycleRepeat, seek: () => seekFrac(a), volume: () => setVolume(a), like: () => { toggleLike(curTrack()); sendState(); }, dislike: () => { if (typeof toggleDislike === 'function') toggleDislike(curTrack()); sendState(); }, wave: () => typeof waveToggle === 'function' && waveToggle(), editor: () => window.openEditor && openEditor(a), winHidden: () => setWinHidden(a), /* 2.0.12 */ widgetSize: () => { S().widget.size = a; settingChanged('widget.size'); rerenderSettings(); } }[n] || (() => {}))());

// ---------- настройки ----------
const DEF_SETTINGS = {
  chorus: { marks: true, key: true, only: false }, // 2.0.12: припевы
  look: { background: { mode: 'default', first: '#13202c', second: '#28162d', angle: 135, dim: 65, blur: 0, image: '', name: '' }, accent: 'auto', color: '#ff2d95', ambient: true, blurAmt: 90, ambBright: 35, scale: 100, anim: true, splash: true, compact: false, beat: true, artShape: 'round', react: true, reactAmt: 50, ambAll: true, ambAllOp: 45, tint: 35, artSize: 100 },
  ly: { lineFx: 'line', kBar: 'on', mrPreset: 0, mrReaction: 1, mrMorph: true, mrQuality: 'auto', mrFps: 60, mrLyrics: true, mrShowTitle: true, mrShelf: true, mrKeep: false, size: 100, align: 'left', glow: true, mode: 'words', blur: true, visLine: true, font: 'default', weight: 800, color: 'accent', colorC: '#ffffff', dimOp: 28, spacing: 128, speed: 70, anim: 'pop', backDelay: 4, lag: 0, snap: true, visSize: 100, fill: true, vis: 'classic', kFont: 'serif', kSize: 100, kAnim: 'rise', kRefl: true, kRipple: 50, kReflQ: 'normal', kGrad: 'cover', kGradC1: '#ffd36e', kGradC2: '#ff5fa2', kGradSeed: 0, kParticles: true, kGlow: 100, kGlowCol: 'accent', kColor: 'white', kBeat: 40, kShake: 0, kChroma: false, kOutline: false, kReflOp: 32, kReflBlur: 12, kPtType: 'dust', kPtDens: 100, kBgDim: 65, kLayout: 'left', kCover: 'right', kCase: 'upper', kFit: true, idleFs: true, idleSec: 8,
    // 2.0.2: откуда брать текст (auto — все источники), бэк-вокал Apple Music, цвета Spotify, авторы
    src: 'auto', bgVox: true, svcColors: true, credits: true },
  viz: { neonExperiment: true, directExperiment: true, sens: 100, fps: 60, coverBars: false, tempo: true, smooth: 30, lag: 0, react: 60, fx: { glow: 100, trails: 0, zoom: 30, shake: 0, flash: 0, mirror: 'off', hue: 0, thick: 100, density: 100, bass: 100, coverPulse: 100, bgDim: 0 } },
  ui: { playerPanelWidth: 0, playerBarHidden: false, variant: 'full', shell: 'panels', barAll: false, setMode: 'simple', surfaceMaterial: 'blur', glassFx: {}, glassPresets: [], liquid: false, liquidMat: 'acrylic', liquidOp: 35, font: 'default', fontSize: 14, radius: -1, bg: '#09090c', panel: '#141418', txt: '#ffffff', side: 240, bar: 72, glass: false, glassOp: 60, css: '', hide: { net: false, widget: false, like: false, dislike: false, dl: false, more: false, time: false, dj: false, vol: false, shuffle: false, repeat: false } },
  audio: { eqOn: false, preset: 'flat', eq: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], preamp: 0, speed: 1, norm: false },
  widget: { calm: true, size: 'standard', theme: 'glass', opacity: 100, lyrics: true, onTop: true, autoHide: true, onMin: false, cover: true, progress: true, time: true, extra: true, vol: true, radius: 22, blur: 34, scale: 100, lock: false, accent: 'cover', color: '#ff2d95', hideIdle: false, eq: true, align: 'left', title: true, marquee: false,
    coverSize: 100, coverShape: 'round', coverSide: 'left', coverSpin: false, tSize: 100, tColor: '', tWeight: 700, aSize: 100, aColor: '', lSize: 100, lColor: '', ctlScale: 100, iconColor: '', playStyle: 'white', playColor: '', progH: 4, progColor: '', bgColor: '', border: true, shadow: true, font: 'default',
    ctlOrder: ['like', 'dislike', 'shuffle', 'prev', 'play', 'next', 'repeat', 'vol'], hideBtns: [], rowsStd: ['info', 'ctl', 'prog'], rowsLarge: ['lyr', 'prog', 'ctl'], rowsMini: ['info', 'ctl'], off: {}, free: {} },
  app: { language: 'en', start: 'home', close: 'widget', keepFs: true, client: 'yt', amSf: 'auto' }, // 2.0.2: client — YouTube Music / Apple Music / Spotify
  sync: { createInYtm: true, autoDlAll: false, interval: 15 },
  dj: { on: false, auto: false, fade: 8, style: 'bass', beat: true, trim: true, keylock: true, iso: [0, 0, 0], filter: 0, unit: 'beats', beats: 16, range: 8, curve: 'smooth', phrase: true, glide: true, echo: 0.75, pick: 'queue' },
  perf: { mode: 'auto', latency: 'interactive', fps: 60, dpr: 1.5, bgSlow: true, showFps: false, gpu: true, autoLite: true }, // 2.0.11: autoLite
  // 1.9
  discord: { on: false, title: true, tpl1: '{title}', tpl2: '{artist}', tplImg: '{album}', pauseText: 'Пауза', btnLabel: 'Слушать в YouTube Music', btnCustom: false, btnCustomLabel: '', btnCustomUrl: '', artist: true, album: true, cover: true, time: true, timeMode: 'bar', paused: 'show', buttons: true, btnArtist: false, type: 'listen', display: 'details', small: false, lyric: false, hideVideo: false, idle: 10, privacy: false },
  wall: { on: false, motion: 'off', motionSpeed: 100, style: 'same', fps: 30, info: true, infoPos: 'bl', infoSize: 100, clock: true, lyrics: true, bg: 'cover', dim: 35, display: 0, idle: 'calm', glow: true, progress: true, scale: 100, controls: true, lyPos: 'bottom', cardOp: 42, lySize: 100, lyColor: '', clockSize: 100, clockPos: 'top', infoXY: null, lyXY: null, clockXY: null,
    // 2.0: свой дизайн часов, карточки и строки текста + кнопка «Нравится» на обоях
    likeBtn: true, clockStyle: 'thin', clockFont: 'segoe', clockSec: false, clock12: false, clockDate: true, clockColor: '', clockPlate: 'none', clockPlateOp: 40,
    cardStyle: 'glass', cardRadius: 26, artShape: 'rounded', cardFont: 'segoe', lyFont: 'segoe', lyWeight: 800, lyGlow: true, lyPlate: false },
  // 2.0: настройки самого редактора
  studio: { side: 'right', width: 'normal', look: 'auto', stage: 'theme', tips: true, shade: true, collapsed: {} },
  cfg: { autoSave: false },
  // 2.0.4: «Моя волна» — настройки (чипы) и приятные мелочи; профиль вкусов хранится отдельно, в lib.wave
  spicy: { on: false, style: false, stage: true, src: true, ppBg: true, key: '', bg: true, blur: true }, // 2.0.4: Spicy Lyrics
  wave: { mood: 'any', char: 'fav', lang: 'any', anim: true, animQ: 'auto', skipDis: true, why: true, keys: true, learnAll: true, hero: true },
  // 1.9.2: глобальная кастомизация (подготовка, см. customize.js и CUSTOMIZE.md)
  layout: { v: 1, items: {}, objects: [] }
};
const ACCENTS = {
  neon: ['Неон', [[255, 45, 149], [139, 61, 255], [0, 229, 255]]], sunset: ['Закат', [[255, 106, 61], [255, 45, 120], [255, 194, 75]]],
  ocean: ['Океан', [[0, 160, 255], [60, 90, 255], [0, 240, 220]]], acid: ['Кислота', [[170, 255, 0], [0, 230, 140], [0, 229, 255]]],
  violet: ['Фиалка', [[160, 80, 255], [220, 110, 255], [90, 140, 255]]], blood: ['Кровь', [[255, 30, 70], [200, 0, 60], [255, 120, 60]]],
  gold: ['Золото', [[255, 190, 60], [255, 140, 40], [255, 230, 150]]], mono: ['Моно', [[240, 240, 240], [170, 170, 180], [120, 120, 130]]]
};
const EQ_F = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const EQ_P = {
  flat: ['Плоский', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]], bass: ['Бас', [6, 5, 4, 2, 0, 0, 0, 0, 0, 0]], bassplus: ['Мощный бас', [9, 8, 6, 3, 0, -1, 0, 0, 0, 0]],
  vocal: ['Вокал', [-2, -2, -1, 1, 3, 4, 3, 1, 0, -1]], rock: ['Рок', [4, 3, 2, 0, -1, -1, 1, 2, 3, 4]], pop: ['Поп', [-1, 1, 3, 4, 3, 0, -1, -1, 0, 1]],
  electro: ['Электро', [5, 4, 1, 0, -2, 1, 0, 2, 4, 5]], hiphop: ['Хип-хоп', [5, 4, 1, 2, -1, -1, 1, -1, 2, 3]], treble: ['Высокие', [0, 0, 0, 0, 0, 1, 2, 4, 5, 6]],
  night: ['Ночь (тихо)', [3, 2, 1, 0, -1, -1, -2, -3, -4, -5]]
};
const S = () => lib.settings || (lib.settings = JSON.parse(JSON.stringify(DEF_SETTINGS)));
const voiceOn = () => false; // 2.0.2: нейросеть убрана
// 1.9.2: пустой объект в умолчаниях = «словарь» (свободные сдвиги виджета, раскладка): берём сохранённое целиком.
// Раньше такие ключи выбрасывались при каждом запуске — перетащенные мышью блоки виджета возвращались на место.
function mergeDeep(d, s) {
  // 1.9.2: результат — всегда глубокая копия. Раньше вложенные объекты делились с DEF_SETTINGS (и с данными конфигов):
  // на первом запуске правки меняли сами умолчания, и «Сбросить» ничего не сбрасывал до перезапуска.
  const cp = (x) => (x && typeof x === 'object' ? JSON.parse(JSON.stringify(x)) : x);
  if (d && typeof d === 'object' && !Array.isArray(d) && !Object.keys(d).length) return s && typeof s === 'object' && !Array.isArray(s) ? cp(s) : {};
  const o = cp(d); if (!s || typeof s !== 'object') return o;
  for (const k in d) if (k in s) o[k] = d[k] && typeof d[k] === 'object' && !Array.isArray(d[k]) ? mergeDeep(d[k], s[k]) : cp(s[k]);
  return o; }
// Preserve the legacy fallback for existing profiles; only new profiles adopt the author preset.
const LEGACY_SETTINGS = JSON.parse(JSON.stringify(DEF_SETTINGS));
Object.assign(DEF_SETTINGS, PulsePrimaryPreset.settings(LEGACY_SETTINGS));
const hex2rgb = (h) => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
function hueShift([r, g, b], deg) {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
  if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
  h = (h + deg + 360) % 360; const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [a, b2, d2] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(a + m) * 255, (b2 + m) * 255, (d2 + m) * 255].map((v) => Math.round(v));
}
function fixedPalette() {
  const a = S().look.accent; if (a === 'auto') return null;
  if (a === 'custom') { const c = hex2rgb(S().look.color || '#ff2d95'); return [c, hueShift(c, -50), hueShift(c, 70)]; }
  return (ACCENTS[a] || ACCENTS.neon)[1];
}
let basePal = null, coverImg = null;
// пишем переменные цвета только если они реально изменились — каждая запись в корень документа пересчитывает стили всего окна
const palPrev = ['', '', ''];
const paintPal = (p) => { const st = document.documentElement.style; p.forEach((c, i) => { const v = c.map((x) => x | 0).join(','); if (palPrev[i] !== v) { palPrev[i] = v; st.setProperty(`--a${i + 1}`, v); } }); };
function setPaletteVars(p) { basePal = p; paintPal(p); Viz.setPalette(p); widgetCfg(p); }
// живой оттенок: базовая палитра обложки, повёрнутая по кругу цветов на deg градусов
function livePalette(deg) { if (!basePal) return; const qd = S().perf.mode === 'high' ? 2 : 4; deg = Math.round(deg / qd) * qd; /* 2.0.11: шаг 4° (в «Максимум» — 2°) */ if (deg === livePalette.d) return; livePalette.d = deg; const p = basePal.map((c) => hueShift(c, deg)); paintPal(p); Viz.setPalette(p); }
let wcfgT = null, lastPal = null;
function widgetCfg(p) {
  if (p) lastPal = p; const P = lastPal || ACCENTS.neon[1], w = S().widget;
  const h = (c) => '#' + c.map((x) => (x | 0).toString(16).padStart(2, '0')).join('');
  clearTimeout(wcfgT);
  const wc = ({ ...w, motion: S().look.anim !== false, appBg: S().ui.bg, appPanel: S().ui.panel, appText: S().ui.txt, appMaterial: S().ui.surfaceMaterial, opacity: w.opacity / 100, accent: w.accent === 'custom' ? w.color : h(P[0]), accent2: w.accent === 'custom' ? h(hueShift(hex2rgb(w.color || '#ff2d95'), -50)) : h(P[1]), accent3: w.accent === 'custom' ? h(hueShift(hex2rgb(w.color || '#ff2d95'), 70)) : h(P[2]), accentMode: w.accent });
  if (window.pvWidgetCfgPush) window.pvWidgetCfgPush(wc);
  wcfgT = setTimeout(() => pulse.widgetConfig && pulse.widgetConfig(wc), 120);
}
// эквалайзер (Web Audio)
let eqNodes = null, preampNode = null, compNode = null, isoNodes = null, fxLP = null, fxHP = null;
function buildEq(src, dest) {
  preampNode = actx.createGain();
  eqNodes = EQ_F.map((f, i) => { const b = actx.createBiquadFilter(); b.type = i === 0 ? 'lowshelf' : i === EQ_F.length - 1 ? 'highshelf' : 'peaking'; b.frequency.value = f; b.Q.value = 1.1; return b; });
  // диджейский изолятор (низ / середина / верх) и фильтр
  isoNodes = [['lowshelf', 250, 0.7], ['peaking', 1200, 0.6], ['highshelf', 4500, 0.7]].map(([t, f, q]) => { const b = actx.createBiquadFilter(); b.type = t; b.frequency.value = f; b.Q.value = q; return b; });
  fxLP = actx.createBiquadFilter(); fxLP.type = 'lowpass'; fxLP.frequency.value = 22000; fxLP.Q.value = 1.2;
  fxHP = actx.createBiquadFilter(); fxHP.type = 'highpass'; fxHP.frequency.value = 10; fxHP.Q.value = 1.2;
  compNode = actx.createDynamicsCompressor();
  src.connect(preampNode); let n = preampNode; [...eqNodes, ...isoNodes, fxLP, fxHP].forEach((b) => { n.connect(b); n = b; }); n.connect(compNode); compNode.connect(dest);
  applyEq();
}
function applyEq() {
  if (!eqNodes) return; const a = S().audio, on = a.eqOn;
  eqNodes.forEach((b, i) => (b.gain.value = on ? a.eq[i] || 0 : 0));
  preampNode.gain.value = on ? Math.pow(10, (a.preamp || 0) / 20) : 1;
  const D = S().dj || {}, djOn = D.on !== false, iso = djOn ? D.iso || [0, 0, 0] : [0, 0, 0], fv = djOn ? (D.filter || 0) / 100 : 0;
  isoNodes.forEach((b, i) => b.gain.setTargetAtTime(Math.max(-40, iso[i] || 0), actx.currentTime, 0.03));
  fxLP.frequency.setTargetAtTime(fv < 0 ? 20000 * Math.pow(0.006, -fv) : 22000, actx.currentTime, 0.04);
  fxHP.frequency.setTargetAtTime(fv > 0 ? 10 * Math.pow(400, fv) : 10, actx.currentTime, 0.04);
  const c = compNode; if (a.norm) { c.threshold.value = -24; c.knee.value = 24; c.ratio.value = 4; c.attack.value = 0.005; c.release.value = 0.25; } else { c.threshold.value = 0; c.knee.value = 0; c.ratio.value = 1; }
}
function applySpeed() { const v = +S().audio.speed || 1, k = typeof djRateOf === 'function' ? djRateOf(audio) : 1; audio.playbackRate = v * k; if (typeof djSetRate === 'function') decks.forEach((d, i) => d !== audio && djSetRate(i)); audio.preservesPitch = S().dj ? S().dj.keylock !== false : true; try { if (ready && player.setPlaybackRate) player.setPlaybackRate(v); } catch {} }
function applySettings() {
  const s = S(), L = s.look, Y = s.ly, b = document.body, r = document.documentElement.style;
  b.classList.toggle('no-anim', !L.anim); try { localStorage.setItem('pulse.motion', L.anim ? 'on' : 'off'); localStorage.setItem('pulse.splash', L.splash === false ? 'off' : 'on'); } catch {} // 2.0.4-fix: заставка читает это до загрузки настроек
  // 2.0.10: эти переключатели с 2.0.4 случайно стояли внутри комментария и не применялись при запуске («Компактный вид», «Фон из обложки», заливка текста, кнопка диджея)
  b.classList.toggle('no-dj', !(s.dj && s.dj.on)); b.classList.toggle('ly-fill', Y.fill !== false); b.classList.toggle('compact', !!L.compact); b.classList.toggle('no-amb', !L.ambient);
  b.classList.toggle('ly-center', Y.align === 'center'); b.classList.toggle('ly-lines', Y.mode === 'lines'); b.classList.toggle('no-glow', !Y.glow);
  b.classList.toggle('no-lyblur', !Y.blur); b.classList.toggle('no-visline', !Y.visLine); b.classList.add('no-coverbars');
  b.dataset.art = L.artShape; b.classList.toggle('perf-eco', s.perf.mode === 'eco'); b.classList.toggle('show-fps', !!s.perf.showFps); b.classList.toggle('no-gpu', s.perf.gpu === false); if (Viz.setGpu) Viz.setGpu(s.perf.gpu !== false); window.PulseImmersion?.setGpu(s.perf.gpu !== false); // 2.0.6
  // 2.0.10: «Чёткость визуала» и «Края визуала» тоже были закомментированы с 2.0.6 — вернул
  if (Viz.setDpr) Viz.setDpr(+s.perf.dpr || 1.5); delete s.viz.edge; delete b.dataset.vizEdge; scC = null;
  r.setProperty('--lyS', (Y.size / 100).toFixed(2)); r.setProperty('--ambBlur', L.blurAmt + 'px'); r.setProperty('--ambB', (L.ambBright / 100).toFixed(2)); { const sg = L.blurAmt + '|' + L.ambBright; if (sg !== preBlurSig) { preBlurSig = sg; if (typeof preBlurCover === 'function') preBlurCover(); } } // 2.0.3
  if (pulse.zoom) pulse.zoom(L.scale / 100);
  const fp = fixedPalette(); if (fp) { palTok++; setPaletteVars(fp); } else { const t = curTrack(); coverId = null; if (t) { setCover(t); } else widgetCfg(); }
  if (!L.react && basePal) { paintPal(basePal); Viz.setPalette(basePal); }
  b.classList.toggle('amb-all', !!L.ambAll && !!L.ambient); r.setProperty('--ambAllOp', ((L.ambAllOp ?? 45) / 100).toFixed(2)); r.setProperty('--tint', ((L.tint ?? 35) / 100).toFixed(2));
  r.setProperty('--artK', ((L.artSize ?? 100) / 100).toFixed(2));
  if (analyser) analyser.smoothingTimeConstant = Math.max(0, Math.min(0.9, (s.viz.smooth ?? 30) / 100));
  if (typeof applyCustom === 'function') applyCustom();
  applyEq(); applySpeed();
  if (pulse.closeMode) pulse.closeMode(s.app.close);
  widgetCfg();
}
const getP = (path) => path.split('.').reduce((o, k) => o && o[k], S());
function setP(path, v) { const ks = path.split('.'); let o = S(); ks.slice(0, -1).forEach((k) => (o = o[k])); o[ks[ks.length - 1]] = v; }
// UI-кирпичики
const seg = (path, opts) => `<div class="seg">${opts.map(([v, n]) => `<button class="${String(getP(path)) === String(v) ? 'on' : ''}" data-set="${path}" data-v="${esc(String(v))}">${n}</button>`).join('')}</div>`;
const tg = (path) => `<div class="toggle ${getP(path) ? 'on' : ''}" data-tg="${path}"></div>`;
const rng = (path, min, max, step, unit) => `<div class="rng"><input type="range" min="${min}" max="${max}" step="${step}" value="${getP(path)}" data-rg="${path}"><span data-rv="${path}">${getP(path)}${unit || ''}</span></div>`;
const sel = (path, opts) => `<select class="sel" data-sel="${path}">${opts.map(([v, n]) => `<option value="${esc(String(v))}" ${String(getP(path)) === String(v) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
const colr = (path) => `<label class="colr" style="background:${esc(getP(path))}"><input type="color" value="${esc(getP(path))}" data-col="${path}"></label>`;
const row = (title, sub, ctl) => { const isSub = /^↳ /.test(title); if (isSub) title = title.slice(2); return `<div class="set-row${isSub ? ' sub' : ''}"><div class="set-l"><b>${title}</b>${sub ? `<span>${sub}</span>` : ''}</div><div class="set-c">${ctl}</div></div>`; };
const sec = (id, icon, title, body) => `<section class="set-sec" id="set-${id}"><h3>${ico(icon)}${title}</h3>${body}</section>`;
// ---------- настройки: вкладки собираются из описаний (плагины добавляют свои через Pulse.addSettingsTab) ----------
const grp = (title) => ({ h: title });
const R = (t, sub, c, keys) => ({ t, s: sub, c, k: keys || '' });
function eqBlockHtml() {
  const s = S();
  const eq = s.audio.eq.map((g, i) => `<div class="eqb"><span data-eqv="${i}">${g > 0 ? '+' : ''}${g}</span><input type="range" min="-12" max="12" step="1" value="${g}" data-eq="${i}"><em>${EQ_F[i] >= 1000 ? EQ_F[i] / 1000 + 'k' : EQ_F[i]}</em></div>`).join('');
  return `<div class="eq-presets">${Object.entries(EQ_P).map(([k, [n]]) => `<button class="chip ${s.audio.preset === k ? 'on' : ''}" data-eqp="${k}">${n}</button>`).join('')}</div><div class="eq ${s.audio.eqOn ? '' : 'off'}"><div class="eqb pre"><span data-rv="audio.preamp">${s.audio.preamp > 0 ? '+' : ''}${s.audio.preamp}</span><input type="range" min="-12" max="6" step="1" value="${s.audio.preamp}" data-rg="audio.preamp"><em>Усил.</em></div>${eq}</div>`;
}
function builtinTabs() {
  const s = S();
  const acc = [['auto', 'По обложке', null], ...Object.entries(ACCENTS).map(([k, [n, p]]) => [k, n, p])];
  const sw = acc.map(([k, n, p]) => `<button class="sw ${s.look.accent === k ? 'on' : ''}" data-set="look.accent" data-v="${k}" title="${n}" style="${p ? `--c1:rgb(${p[0]});--c2:rgb(${p[1]});--c3:rgb(${p[2]})` : ''}">${p ? '' : ico('sparkle')}<em>${n}</em></button>`).join('')
    + `<label class="sw custom ${s.look.accent === 'custom' ? 'on' : ''}" title="Свой цвет" style="--cc:${esc(s.look.color)}"><input type="color" value="${esc(s.look.color)}" data-color="look.color"><em>Свой</em></label>`;
  const vcards = `<div class="vcards">${Viz.STYLES.map((v) => `<button class="vcard ${lib.vizStyle === v.id ? 'on' : ''}" data-set="vizStyle" data-v="${esc(v.id)}">${ico(v.icon || 'wave')}<span>${esc(v.name)}</span>${v.plugin ? '<em>плагин</em>' : ''}</button>`).join('')}</div>`;
  const nOff = Object.keys(off).length, nLists = Object.keys(lib.ytc || {}).length;
  const keys = [['Пробел', 'Play / Pause'], ['T', 'Только текст — текст песни на весь экран'], ['Ctrl + → / ←', 'Следующий / предыдущий'], ['Ctrl + ↑ / ↓', 'Громкость'], ['L', 'Текст песни'], ['W', 'Моя волна — запустить / пауза'], ['X', 'Не нравится (трек сразу пропускается)'], ['D', 'Диджей (только когда режим диджея включён)'], ['V / Shift + V', 'Визуал: следующий / предыдущий стиль'], ['F или F11', 'Во весь экран'], ['Esc', 'Выйти из полноэкранного / закрыть'], ['Двойной клик по обложке', 'Во весь экран'], ['Ctrl + F или /', 'Поиск'], ['Alt + ← / →', 'Назад / вперёд'], ['Alt + клик по строке', 'Строка начинается сейчас'], ['Пробел (в записи)', 'Отметить начало строки'], ['Ctrl + Alt + W', 'Виджет (везде)'], ['Медиа-клавиши', 'Работают глобально']];
  return [
    { id: 'look', icon: 'palette', title: 'Внешний вид', rows: [
      grp('Материал интерфейса'),
      ...(typeof surfaceRows === 'function' ? surfaceRows() : []),
      grp('Предпросмотр'),
      ...(typeof appPreview === 'function' ? (() => { try { return [{ raw: edBox('app', appPreview()) }]; } catch (e) { console.warn('Optional app preview', e); return []; } })() : []),
      ...(window.PulseBackground ? PulseBackground.rows() : []),
      grp('Цвет'),
      R('Цвет акцента', 'Подсветка, кнопки, свечение текста и визуализатор', `<div class="sws">${sw}</div>`, 'цвет тема'),
      R('Цвет живёт под музыку', 'Оттенок плавно меняется с энергией трека и вздрагивает на сильных долях', tg('look.react'), 'реакция цвет музыка'),
      ...(s.look.react ? [R('↳ Сила реакции', '', rng('look.reactAmt', 0, 100, 5, '%'))] : []),
      R('Цветное свечение окна', 'Цвета обложки по краям окна, пульсируют под бит. 0 — выключено', rng('look.tint', 0, 100, 5, '%'), 'свечение оттенок'),
      grp('Фон из обложки'),
      R('Размытый фон из обложки', 'Цветное свечение за плеером', tg('look.ambient'), 'фон'),
      ...(s.look.ambient ? [
        R('↳ Размытие', '', rng('look.blurAmt', 30, 160, 10, 'px')),
        R('↳ Яркость', '', rng('look.ambBright', 15, 70, 5, '%')),
        R('↳ Во всём приложении', 'Не только в плеере — на главной, в библиотеке и настройках', tg('look.ambAll'), 'фон обложка'),
        ...(s.look.ambAll ? [R('↳ Яркость в приложении', '', rng('look.ambAllOp', 10, 100, 5, '%'))] : [])] : []),
      grp('Обложка в плеере'),
      R('Форма', '', seg('look.artShape', [['round', 'Скруглённая'], ['square', 'Квадрат'], ['circle', 'Винил']]), 'обложка форма'),
      R('Размер', '', rng('look.artSize', 60, 130, 5, '%'), 'обложка размер'),
      R('Пульсация в такт', 'Обложка и текст слегка «дышат» под бит', tg('look.beat')),
      grp('Общее'),
      R('Размер интерфейса', 'Масштаб всего окна', rng('look.scale', 80, 130, 5, '%'), 'масштаб зум'),
      R('Анимации', 'Карточки плавно появляются и приподнимаются, окна и меню всплывают, кнопки откликаются на нажатие. Выключи на слабом ПК', tg('look.anim')),
      R('Анимация запуска', 'Красивая заставка при запуске Pulse. Не показывается, когда открываешь окно из трея — только после полного выхода и нового запуска', tg('look.splash'), 'заставка запуск анимация приветствие'), // 2.0.4-fix
      R('Компактные списки', 'Больше треков на экране', tg('look.compact'))] },
    ...(typeof uiTab === 'function' ? [uiTab()] : []),
    { id: 'viz', icon: 'sparkle', title: 'Визуализатор', rows: [
      grp('Стиль'),
      R('Стиль', `${Viz.STYLES.length} стилей · клавиша <b>V</b> переключает прямо в плеере`, '', 'визуал стиль'), ...(typeof vizPreviewRow === 'function' ? [vizPreviewRow()] : []), { raw: vcards },
      R('Эксперимент: прямой WebGL', 'Только «Частицы обложки 3D»: отдельный цикл, без копии в Canvas 2D. Выключи для сравнения. Следы, зеркалирование и вспышки временно используют прежний путь.', tg('viz.directExperiment'), 'webgl эксперимент производительность gpu'),
      R('Эксперимент: Неон-круг WebGL', 'Только «Неон-круг»: полосы, пики и кольцо рисует GPU. Свечение приближено шейдером. Выключи для сравнения с Canvas 2D; следы, вспышки и зеркала используют старый путь.', tg('viz.neonExperiment'), 'неон круг webgl эксперимент gpu'),
      grp('Реакция на музыку'),
      R('Движение в темп трека', 'Вращение, вспышки и волны идут строго по долям трека', tg('viz.tempo'), 'бит bpm темп'),
      R('Чувствительность', 'Насколько сильно реагирует на звук', rng('viz.sens', 50, 200, 10, '%')),
      R('Отзывчивость', 'Выше — резче прыгает на каждый удар, ниже — плавнее', rng('viz.react', 0, 100, 5, '%'), 'реакция отзывчивость'),
      R('Сглаживание спектра', 'Меньше — точнее в бит, больше — мягче', rng('viz.smooth', 0, 80, 5, '%')),
      R('Сдвиг визуала', 'Если опережает или отстаёт (например, Bluetooth-наушники)', rng('viz.lag', -200, 400, 10, 'ms'), 'задержка блютуз сдвиг'),
      grp('Эффекты'), ...(typeof vizFxRows === 'function' ? vizFxRows() : []),
      grp('Отображение'),
      R('Во весь экран', 'Двойной клик по обложке, клавиша F или F11. Выход — Esc', `<button class="btn sm" data-sact="fs">${ico('expand')}Открыть</button>`, 'полноэкранный фулскрин')] },
    { id: 'ly', icon: 'lyrics', title: 'Текст песен', rows: [
      ...(typeof lySrcRows === 'function' ? lySrcRows() : []), // 2.0.2: откуда брать текст
      ...(typeof spicyRows === 'function' ? spicyRows() : []), // 2.0.4: Spicy Lyrics — внутри «Текст песен»
      grp('Как выглядит'),
      R('Размер текста', '', rng('ly.size', 70, 150, 5, '%')),
      R('Выравнивание', '', seg('ly.align', [['left', 'Слева'], ['center', 'По центру']])),
      R('Подсветка', 'Караоке по словам или целой строкой', seg('ly.mode', [['words', 'По словам'], ['lines', 'Строкой']])),
      ...(typeof lyPreviewRow === 'function' ? [lyPreviewRow()] : []),
      ...(typeof lyLookRows === 'function' ? lyLookRows() : []),
      R('Свечение слов', '', tg('ly.glow')),
      R('Размывать дальние строки', '', tg('ly.blur')),
      grp('Прокрутка'),
      R('Скорость прокрутки', 'Как быстро текст едет к новой строке', rng('ly.speed', 15, 150, 5, ''), 'прокрутка скорость'),
      R('Возврат к текущей строке', 'Через сколько секунд после ручной прокрутки текст вернётся сам (0 — не возвращаться)', rng('ly.backDelay', 0, 15, 1, 's'), 'прокрутка скролл'),
      grp('Строка в режиме «Визуал»'),
      R('Показывать строку текста', 'Текст песни на фоне визуала (можно убрать)', tg('ly.visLine'), 'текст на фоне визуала строка убрать'),
      ...(s.ly.visLine ? [R('↳ Размер строки', '', rng('ly.visSize', 60, 170, 5, '%'))] : []),
      grp('Синхронизация'),
      R('Сдвиг всего текста', 'Общая поправка для всех песен (Bluetooth-наушники и т.п.)', rng('ly.lag', -500, 800, 20, 'ms'), 'задержка сдвиг блютуз'),
      lineFxRow(),
      R('Притягивать слова к голосу', 'Для текстов, где есть время только строк: слова встают на реальные атаки голоса', tg('ly.snap'), 'слова тайминг'),
      R('Корректор текста', 'Сдвиг, темп для slowed / sped up, запись таймингов Пробелом, свой текст и поиск. Кнопка ' + ico('tune') + ' под текстом', `<button class="btn sm" data-sact="lyfix">${ico('tune')}Открыть</button>`, 'корректор тайминг сдвиг'),
      ...(typeof lyStageRows === 'function' ? lyStageRows() : [])] },
    { id: 'dj', icon: 'dj', title: 'Диджей', rows: [
      R('Режим диджея', 'Две деки, сведение, автомикс и эффекты. Выключен — пункт «Диджей» и кнопка в плеере скрыты, звук идёт напрямую', tg('dj.on')),
      ...(S().dj.on ? [
        { raw: `<div class="opt-row"><button class="btn sm" data-go="dj">${ico('dj')}Открыть пульт диджея</button></div>` },
        grp('Автомикс'),
        R('Автомикс', 'Сам сводит треки в конце, как диджей', tg('dj.auto')),
        R('Длина перехода', 'В долях — переход всегда звучит «в квадрат»', seg('dj.unit', [['beats', 'Доли'], ['sec', 'Секунды']])),
        S().dj.unit === 'beats' ? R('↳ Долей', '16 = 4 такта', seg('dj.beats', [[4, '4'], [8, '8'], [16, '16'], [32, '32'], [64, '64']])) : R('↳ Секунд', '', seg('dj.fade', [[4, '4'], [8, '8'], [12, '12'], [16, '16'], [24, '24']])),
        R('Стиль перехода', 'Как уходит старый трек', seg('dj.style', [['smooth', 'Плавно'], ['bass', 'Бас-свап'], ['filter', 'Фильтр'], ['echo', 'Эхо'], ['brake', 'Тормоз'], ['cut', 'Резко']])),
        R('Пропускать тишину', 'Без пауз в начале и конце треков', tg('dj.trim')),
        grp('Темп и доли'),
        R('Бит-синхронизация', 'Подгоняет темп и фазу, вступает с сильной доли', tg('dj.beat')),
        R('↳ Начинать с фразы', 'Переход стартует на границе фразы', tg('dj.phrase')),
        R('↳ Диапазон темпа', 'Насколько можно ускорить или замедлить трек', seg('dj.range', [[4, '±4%'], [8, '±8%'], [12, '±12%'], [16, '±16%']])),
        R('Сохранять тональность', 'При смене темпа голос не «плывёт»', tg('dj.keylock')),
        R('Кривая кроссфейдера', '', seg('dj.curve', [['smooth', 'Плавная'], ['linear', 'Линейная'], ['sharp', 'Скретч']]))] : [])] },
    { id: 'audio', icon: 'eq', title: 'Звук', rows: [
      grp('Эквалайзер'),
      R('Включить эквалайзер', 'Двигай полосы — эквалайзер включится сам. Не действует только в режиме «Видео». Больше ручек — на странице «Диджей»', tg('audio.eqOn')),
      { raw: eqBlockHtml() },
      grp('Воспроизведение'),
      R('Выравнивание громкости', 'Тихие и громкие треки звучат ровнее', tg('audio.norm')),
      R('Скорость воспроизведения', '', seg('audio.speed', [[0.75, '0.75×'], [0.9, '0.9×'], [1, '1×'], [1.1, '1.1×'], [1.25, '1.25×'], [1.5, '1.5×']]))] },
    { id: 'sync', icon: 'cloud', title: 'Синхронизация и офлайн', rows: [
      grp('Аккаунт'),
      R('Аккаунт YouTube Music', account ? `Вошёл как <b data-i18n-skip>${esc(account.name)}</b>` : 'Не выполнен вход — плейлисты только на устройстве', account ? `<button class="btn sm" data-sact="sync">${ico('sync')}Синхронизировать</button>` : `<button class="btn sm acc" data-act="login">${ico('google')}Войти</button>`, 'аккаунт вход google'),
      R('Создавать плейлисты в YouTube Music', 'Новые плейлисты сразу появляются в аккаунте и на всех устройствах', tg('sync.createInYtm')),
      R('Автосинхронизация', 'Как часто обновлять плейлисты из YouTube Music', seg('sync.interval', [[5, '5 мин'], [15, '15 мин'], [60, 'Час'], [0, 'Вручную']])),
      grp('Офлайн'),
      R('Скачивать все плейлисты автоматически', 'Каждый трек из твоих плейлистов будет доступен без интернета (займёт место)', tg('sync.autoDlAll'), 'скачать офлайн'),
      R('Сейчас на устройстве', `Скачано: ${nOff} · плейлистов в офлайн-копии: ${nLists} · обложки кэшируются автоматически`, `<button class="btn sm" data-go="downloads">${ico('offline')}Скачанное</button>`)] },
    { id: 'widget', icon: 'widget', title: 'Мини-виджет', rows: typeof widgetRows === 'function' ? widgetRows() : [
      R('Размер', 'Мини — одна строка, Стандарт — с кнопками, Большой — с караоке-текстом', seg('widget.size', [['mini', 'Мини'], ['standard', 'Стандарт'], ['large', 'Большой']])),
      R('Стиль', '', seg('widget.theme', [['glass', 'Стекло'], ['clear', 'Прозрачный'], ['dark', 'Тёмный'], ['neon', 'Неон']])),
      R('Непрозрачность', '', rng('widget.opacity', 40, 100, 5, '%')),
      R('Текст песни в виджете', '', tg('widget.lyrics')),
      R('Поверх всех окон', '', tg('widget.onTop')),
      R('Показать / скрыть', 'Ctrl + Alt + W', `<button class="btn sm" data-sact="widget">${ico('widget')}Переключить</button>`)] },
    ...(typeof waveTab === 'function' ? [waveTab()] : []), // 2.0.4
    ...(typeof extraTabs === 'function' ? extraTabs() : []),
    { id: 'app', icon: 'settings', title: 'Основные', rows: [
      grp('Язык интерфейса'),
      R('Язык интерфейса', 'Выбери язык интерфейса. Названия песен и тексты не переводятся.', `<select class="language-list" data-language-list data-i18n-skip aria-label="${esc(PulseI18n.t('Язык интерфейса'))}">${[['en','English'],['ru','Русский'],['ja','日本語'],['uk','Українська']].map(([v,n])=>`<option value="${v}"${getP('app.language')===v?' selected':''}>${n}</option>`).join('')}</select>`),
      grp('Запуск и окно'),
      R('Стартовая страница', '', seg('app.start', [['home', 'Главная'], ['library', 'Библиотека'], ['downloads', 'Скачанное']])),
      R('Кнопка «Закрыть» окна', '', seg('app.close', [['widget', 'В виджет'], ['tray', 'В трей'], ['quit', 'Выйти']])),
      grp('Производительность'),
      R('Режим работы', 'Авто — визуал сам упрощается, если компьютер не успевает. Экономно — без размытого фона и свечения, 30 FPS', seg('perf.mode', [['auto', 'Авто'], ['high', 'Максимум'], ['eco', 'Экономно']]), 'лаги тормозит fps производительность'),
      R('Лимит кадров', 'Сколько раз в секунду рисуется визуал и анимации. «Без лимита» — по частоте твоего монитора (144/165/240 Гц), больше нагрузка', seg('perf.fps', [[30, '30'], [60, '60'], [120, '120'], [144, '144'], [0, 'Без лимита']]), 'fps лимит кадров ограничение частота'),
      R('Чёткость визуала', 'Разрешение холста визуализации. Ниже — меньше нагрузка на видеокарту', seg('perf.dpr', [[1, 'Обычная'], [1.5, 'Высокая'], [2, 'Максимум']]), 'чёткость разрешение'),
      R('Экономить в фоне', 'Окно не в фокусе или плеер свёрнут — 30 FPS. Без музыки и визуала на экране — почти ноль нагрузки', tg('perf.bgSlow'), 'фон экономия'),
      R('Авто-облегчение', 'Только в режиме «Авто»: если окно стало рисоваться медленнее ~33 FPS, Pulse сам уберёт размытие под панелями и свечение обложки. Видно почти не будет, а плавность вернётся', tg('perf.autoLite'), 'облегчение лаги просадки fps авто'), // 2.0.11
      R('Показывать FPS', 'Маленький счётчик в углу — настоящая плавность окна', tg('perf.showFps'), 'fps счётчик'),
      R('Графика на видеокарте', (() => { const n = typeof PulseGPU !== 'undefined' && PulseGPU.supported() ? (PulseGPU.gpuName() || 'WebGL2') : 'недоступно на этом ПК'; return 'WebGL для поддерживаемых визуалов и частиц. Не отключает аппаратное ускорение всего приложения · ' + n; })(), tg('perf.gpu'), 'видеокарта gpu webgl ускорение'), // 2.0.6
      R('Задержка звука', 'Низкая — визуал и караоке точнее совпадают с тем, что слышно. Если звук трещит — выбери «Обычная» (после перезапуска)', seg('perf.latency', [['interactive', 'Низкая'], ['balanced', 'Средняя'], ['playback', 'Обычная']]), 'задержка латентность треск'),
      grp('Резервная копия и сброс'),
      R('Настройки в файл', 'Сохрани всё оформление и перенеси на другой компьютер', `<button class="btn sm" data-sact="export">${ico('save')}Экспорт</button><button class="btn sm" data-sact="import">${ico('file')}Импорт</button>`, 'экспорт импорт'),
      R('Сбросить все настройки', 'Полностью: оформление, раскладка из редактора, виджет, обои, визуал, текст, конфиги. Плейлисты, вход в аккаунт и скачанное останутся. Pulse перезапустится', `<button class="btn sm danger" data-sact="reset">${ico('refresh')}Сбросить</button>`, 'сброс настройки заводские'),
      R('Удалить все данные', 'Как после чистой установки: настройки, библиотека, аккаунты, кэш. Скачанные треки — по желанию. Pulse перезапустится', `<button class="btn sm danger" data-sact="wipe">${ico('trash')}Удалить всё</button>`, 'сброс удалить данные чистая установка'),
      R('Основной пресет', 'Все настройки автора. Треки, плейлисты, аккаунты и ключи доступа сохранятся. Pulse перезапустится.', `<button class="btn sm" data-sact="primary-preset">${ico('layers')}Основной пресет</button>`, 'основной пресет автор'),
      { raw: `<div class="set-ver">Pulse ${appVer} · <span>Создатели —</span> ${pulseAuthorsHtml()}</div>` }] },
    { id: 'plugins', icon: 'plugin', title: 'Плагины', rows: [
      R('Папка плагинов', 'Положи туда файл <b>.js</b> — новый визуализатор, вкладка настроек или пункт меню. Пример лежит там же (<b>example-visual.js.off</b> → переименуй в .js)', `<button class="btn sm" data-sact="plugdir">${ico('folder')}Открыть</button><button class="btn sm" data-sact="reload">${ico('refresh')}Перезагрузить</button>`, 'плагин расширение'),
      ...(plug.list.length ? plug.list.map((f) => R(esc(f), plug.err[f] ? `<span style="color:#ff7a90">Ошибка: ${esc(plug.err[f])}</span>` : (lib.plugOff || []).includes(f) ? 'Выключен' : plug.ok[f] ? 'Работает' : 'Включится после перезагрузки', `<div class="toggle ${(lib.plugOff || []).includes(f) ? '' : 'on'}" data-plug="${esc(f)}"></div>`)) : [R('Плагинов пока нет', 'API описан в файле PLUGINS.md рядом с программой', '')])] },
    { id: 'about', icon: 'info', title: 'О приложении', desc: 'О Pulse, людях и открытом коде', rows: [{ raw: pulseAboutHtml() }] },
    { id: 'keys', icon: 'keyboard', title: 'Горячие клавиши', rows: [{ raw: `<div class="keys">${keys.map(([k, d]) => `<div><kbd>${k}</kbd><span>${d}</span></div>`).join('')}</div>` }] }
  ];
}
// 2.0: разделы настроек сгруппированы по смыслу — порядок и подписи меню задаются здесь
const SET_GROUPS = [
  ['Основное', ['app', 'client', 'accounts', 'sync']],
  ['Оформление', ['look', 'ui', 'editor']],
  ['Музыка', ['wave', 'audio', 'ly', 'viz', 'dj']],
  ['Окна и интеграции', ['widget', 'wall', 'discord']],
  ['Дополнительно', ['cfg', 'plugins', 'keys', 'about']]
];
const SET_DESC = {
  dj: 'Режим диджея: включение, автомикс и сведение треков',
  app: 'Запуск, поведение окна, производительность и резервная копия',
  accounts: 'Аккаунты YouTube Music, Apple Music и Spotify — у каждого сервиса свои',
  client: 'YouTube Music, Apple Music или Spotify — чей каталог и медиатеку открывать в Pulse',
  sync: 'Синхронизация плейлистов с YouTube Music и музыка без интернета',
  look: 'Цвета, фон из обложки и масштаб интерфейса',
  ui: 'Шрифты, скругления, прозрачность и мелкие детали интерфейса',
  customize: 'Тонкая настройка отдельных частей приложения',
  editor: 'Всё окно Pulse, мини-виджет, обои, Discord, текст и визуал — в одном месте',
  audio: 'Эквалайзер, громкость и скорость воспроизведения',
  ly: 'Вид караоке-текста, прокрутка и синхронизация с голосом',
  viz: 'Стиль визуализации, реакция на музыку и эффекты',
  widget: 'Маленький плеер поверх других окон',
  wall: 'Визуализация и текст песни на рабочем столе',
  discord: 'Что видят друзья в твоём профиле Discord',
  cfg: 'Сохранённые наборы оформления — переключай в один клик',
  plugins: 'Расширения: свои визуализаторы, вкладки и пункты меню',
  keys: 'Все сочетания клавиш Pulse'
};
const SET_PLUG_GROUP = 'Из плагинов';
function allTabs() {
  if (lib.setTab === 'spicy') lib.setTab = 'ly'; // 2.0.4: «Spicy Lyrics» переехала во «Текст песен»
  if (lib.setTab === 'customize') { lib.setTab = 'editor'; lib.edScope = 'window'; } // «Кастомизация» переехала в «Редактор → Всё окно»
  const T = builtinTabs().filter((t) => t.id !== 'customize');
  for (const t of PX.tabs) { try { T.push({ ...t, plugin: true, rows: typeof t.rows === 'function' ? t.rows({ row: R, group: grp, seg, toggle: tg, range: rng }) : t.rows || [] }); } catch (e) { console.error(e); } }
  const order = SET_GROUPS.flatMap(([, ids]) => ids), pos = (t) => { const k = order.indexOf(t.id); return k < 0 ? order.length : k; };
  return T.map((t, k) => [t, k]).sort((a, b) => pos(a[0]) - pos(b[0]) || a[1] - b[1]).map(([t]) => t);
}
const tabGroupOf = (t) => { const g = SET_GROUPS.find(([, ids]) => ids.includes(t.id)); return g ? g[0] : SET_PLUG_GROUP; };
function setNavHtml(T, cur) {
  let last = null, out = '';
  for (const t of T) {
    const g = tabGroupOf(t); if (g !== last) { out += `<div class="set-ng">${esc(g)}</div>`; last = g; }
    out += `<a class="${!setQ && t.id === cur ? 'on' : ''}" data-stab="${esc(t.id)}" role="button" tabindex="0" aria-current="${!setQ && t.id === cur ? 'page' : 'false'}" title="${esc(t.title)}">${ico(t.icon)}<span>${esc(t.title)}</span></a>`;
  }
  return out;
}
const rowHtml = (r) => (r.raw != null ? r.raw : r.h ? `<div class="set-grp">${esc(r.h)}</div>` : row(r.t, r.s, r.c));
let setQ = '';
// 1.9.1: настройки раскладываются плиткой — простые переключатели собираются в сетку, карточки встают в две колонки
const TG_ONLY = /^<div class="toggle( on)?" data-tg="([^"]+)"><\/div>$/;
const isSubRow = (r) => r && !r.h && r.raw == null && /^↳ /.test(r.t || '');
function cardRows(rows) {
  // строка + её подпункты «↳» = одна ячейка; ячейки встают в две колонки, широкие (превью, чипы, эквалайзер) — на всю ширину
  const units = []; rows.forEach((r) => { if (isSubRow(r) && units.length && !units[units.length - 1].raw) units[units.length - 1].push(r); else { const u = [r]; u.raw = r.raw != null; units.push(u); } });
  return `<div class="set-cells">${units.map((u) => {
    if (u.raw) return `<div class="set-cell span raw">${rowHtml(u[0])}</div>`;
    const wide = u.some((r) => typeof r.c === 'string' && WIDE_C.test(r.c)), m = u.length === 1 && typeof u[0].c === 'string' && TG_ONLY.exec(u[0].c);
    return `<div class="set-cell ${wide ? 'span' : ''} ${m ? 'tgc' + (getP(m[2]) ? ' on' : '') : ''}"${m ? ` data-tg="${m[2]}"` : ''}>${u.map(rowHtml).join('')}</div>`;
  }).join('')}</div>`;
}
const WIDE_C = /class="(eq|chips|vcards|sws|ed-list|eq-presets)|<textarea|class="seg">(?:<button[^>]*>[^<]*<\/button>){5,}/;
const cardWide = () => true;
function setBodyHtml() {
  const T = allTabs(), q = setQ.trim().toLowerCase();
  if (q) {
    const plain = (x) => { const s = String(x || '').replace(/<[^>]+>/g, ' '); return (s + ' ' + (window.PulseI18n ? PulseI18n.t(s) : s)).toLowerCase(); };
    const hits = T.map((t) => ({ t, rows: t.rows.filter((r) => !r.h && r.raw == null && (plain(r.t) + ' ' + plain(r.s) + ' ' + r.k).includes(q)) })).filter((x) => x.rows.length);
    const n = hits.reduce((a, x) => a + x.rows.length, 0);
    return hits.length ? `<section class="set-sec set-tab set-found"><div class="set-th"><h3>${ico('search')}Результаты поиска</h3><p class="set-desc">${n} ${n % 10 === 1 && n % 100 !== 11 ? 'настройка' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'настройки' : 'настроек'} по запросу «${esc(setQ.trim())}»</p></div><div class="set-grid">${hits.map(({ t, rows }) => `<div class="set-card"><button class="set-ct set-ct-link" data-stab="${esc(t.id)}" title="Открыть раздел">${ico(t.icon)}${esc(t.title)}<em>${esc(tabGroupOf(t))}</em></button>${cardRows(rows)}</div>`).join('')}</div></section>` : emptyHtml('search', 'Ничего не нашлось', '<div>Попробуй другое слово — например, «fps», «цвет» или «текст»</div>');
  }
  const t = T.find((x) => x.id === lib.setTab) || T[0];
  // 1.9.3: вкладки на всю ширину (Редактор) рисуют себя сами
  if (t.full && typeof t.html === 'function') return `<section class="set-sec set-tab ${t.launch ? 'set-launch' : 'set-full'}"><div class="set-th"><h3>${ico(t.icon)}${esc(t.title)}</h3></div>${t.html()}</section>`;
  const rs = TAB_RESET[t.id] ? `<button class="btn sm ghost set-reset" data-sact="tabreset:${t.id}" title="Вернуть настройки этого раздела по умолчанию">${ico('refresh')}Сбросить раздел</button>` : '';
  // строки раскладываются по карточкам-группам: больше воздуха и быстрый переход по группам
  const cards = []; let cur = { h: '', rows: [] };
  for (const r of t.rows) { if (r.h) { if (cur.rows.length || cur.h) cards.push(cur); cur = { h: r.h, rows: [] }; } else cur.rows.push(r); }
  if (cur.rows.length || cur.h) cards.push(cur);
  const named = cards.filter((c) => c.h);
  const jump = named.length > 1 ? `<div class="set-jump">${cards.map((c, i) => (c.h ? `<button data-jump="sg-${i}">${esc(c.h)}</button>` : '')).join('')}</div>` : '';
  const body = cards.map((c, i) => `<div class="set-card ${cardWide(c) ? 'wide' : ''}" id="sg-${i}">${c.h ? `<div class="set-ct">${esc(c.h)}</div>` : ''}${cardRows(c.rows)}</div>`).join('');
  const desc = t.desc || SET_DESC[t.id];
  return `<section class="set-sec set-tab"><div class="set-th"><h3>${ico(t.icon)}${esc(t.title)}${rs}</h3>${desc ? `<p class="set-desc">${esc(desc)}</p>` : ''}${jump}</div><div class="set-grid">${body}</div></section>`;
}
document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-jump]'); if (!b) return; const el = document.getElementById(b.dataset.jump); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); el.classList.remove('jump-hl'); void el.offsetWidth; el.classList.add('jump-hl'); setTimeout(() => el.classList.remove('jump-hl'), 1300); } b.parentElement.querySelectorAll('[data-jump]').forEach((x) => x.classList.toggle('on', x === b)); });
const TAB_RESET = { discord: ['discord'], wall: ['wall'], look: ['look'], ui: ['ui'], viz: ['viz'], ly: ['ly'], audio: ['audio'], sync: ['sync'], widget: ['widget'], app: ['app', 'perf'] };
function resetTab(id) {
  const ks = TAB_RESET[id]; if (!ks) return; const s = S();
  ks.forEach((k) => (s[k] = JSON.parse(JSON.stringify(DEF_SETTINGS[k]))));
  if (id === 'look') { /* масштаб тоже */ }
  applySettings(); applyEq(); applySpeed(); if (typeof applyCustom === 'function') applyCustom(); save(); rerenderSettings(); toast('Раздел сброшен', 'refresh');
}
function settingsHtml() {
  const T = allTabs(), cur = (T.find((x) => x.id === lib.setTab) || T[0]).id;
  return `<div class="set-wrap set2"><aside class="set-side"><h1 class="sh-title">Настройки</h1>
    <label class="set-search">${ico('search')}<input id="setQ" placeholder="Найти настройку…" value="${esc(setQ)}" spellcheck="false"></label>
    <nav>${setNavHtml(T, cur)}</nav></aside>
    <div class="set-main" id="setBody" data-tab="${esc(cur)}">${setBodyHtml()}</div></div>`;
}
// пересборка после того, как тумблер доиграл анимацию (иначе элемент заменяется мгновенно и анимации не видно)
let defRT = 0;
function deferRerender(ms = 230) { clearTimeout(defRT); defRT = setTimeout(rerenderSettings, ms); }
function rerenderSettings() { clearTimeout(defRT);
  if (typeof rerenderPops === 'function') rerenderPops();
  if (route().r !== 'settings' || !$('setBody')) return; const y = $('view').scrollTop, contentY=$('setBody').scrollTop, previousTab=$('setBody').dataset.tab, nav=document.querySelector('.set-side nav'), navY=nav?.scrollTop||0;
  const root=$('setBody'), html=setBodyHtml(), T=allTabs(), cur=(T.find(x=>x.id===lib.setTab)||T[0]).id;
  const commit=()=>{
  if (window.keepAliveRender) keepAliveRender(root, html); else root.innerHTML=html;
  if (typeof edMarkAll === 'function') edMarkAll();
  document.querySelector('.set-side nav').innerHTML = setNavHtml(T, cur);
  document.querySelector('.set-side nav').scrollTop=navY;
  $('setBody').dataset.tab=cur;$('setBody').scrollTop=previousTab===cur?contentY:0;
  $('view').scrollTop = y;
  };
  if(window.PulseSettingsMotion)PulseSettingsMotion.render(root,cur,commit);else commit();
}
function settingChanged(path) {
  if (path === 'app.language') { PulseI18n.setLanguage(S().app.language); cache.clear(); syncCatalogLanguage(); rerenderSettings(); if (typeof mrSync === 'function') mrSync(); save(); return; }
  // 2.0.9: переключатель «Построчно / Импровизация» — перерисовать текст во всех видах
  if (path === 'ly.lineFx') { if (lyState.lines) showLines(lyState.lines); if (typeof SP !== 'undefined') SP.srcLines = null; if (typeof lys !== 'undefined' && lys.on) lyState.cur = -2; save(); return; }
  if (typeof clChanged === 'function' && clChanged(path)) { save(); return; } // 2.0.2: клиент и источник текста
  if (typeof extraChanged === 'function' && extraChanged(path)) { save(); return; }
  if (typeof waveChanged === 'function' && waveChanged(path)) { save(); return; } // 2.0.4
  // «лёгкие» настройки оформления — без пересборки обложки и палитры
  if (/^(viz\.fx\.|ui\.)/.test(path) || /^ly\.(font|weight|color|colorC|dimOp|spacing|speed|anim|visSize|lag|backDelay|snap|size|align)$/.test(path) || /^viz\.(lag|react|smooth|sens)$/.test(path) || /^look\.(reactAmt|tint|ambAllOp|artSize|react|ambAll)$/.test(path)) {
    if (typeof applyCustom === 'function') applyCustom(); if (/^ly\.(size|align)$/.test(path)) applySettings();
    if (path === 'look.react' && !S().look.react && basePal) { paintPal(basePal); Viz.setPalette(basePal); }
    save(); return;
  }
  if (path.startsWith('dj.') || path === 'audio.speed' || path.startsWith('audio.eq') || path === 'audio.preamp') { applyEq(); applySpeed(); save(); return; }
  if (path === 'perf.latency') toast('Задержка звука применится после перезапуска Pulse', 'settings');
  if (path.startsWith('ui.') || path.startsWith('look.') || path.startsWith('ly.') || path.startsWith('viz.')) { if (typeof applyCustom === 'function') applyCustom(); }
  if (path === 'look.accent' || path.startsWith('look.') || path.startsWith('ui.') || path.startsWith('ly.') || path.startsWith('widget.') || path.startsWith('app.') || path.startsWith('audio.') || path.startsWith('viz.') || path.startsWith('dj.') || path.startsWith('perf.')) applySettings();
  if (path === 'ly.model') { const t = curTrack(); if (t && lib.lyrics[t.id]) { /* новая модель — пересчитать текущий трек по кнопке */ } }
  if (path === 'vizStyle') updateButtons();
  if (path === 'look.compact') renderQueue();
  if (path === 'sync.interval') scheduleSync();
  if (path === 'sync.autoDlAll' && S().sync.autoDlAll) Object.keys(lib.ytc || {}).forEach(autoDl);
  save();
}
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-set],[data-tg],[data-eqp],[data-sact],[data-stab],[data-plug]'); if (!el || !el.closest('.set-wrap')) return;
  e.stopPropagation();
  if (el.dataset.stab) { lib.setTab = el.dataset.stab; setQ = ''; const q = $('setQ'); if (q) q.value = ''; save(); rerenderSettings(); $('view').scrollTop = 0; return; } // 2.0.4: вкладки настроек проявляются
  if (el.dataset.plug) { const f = el.dataset.plug; lib.plugOff = lib.plugOff || []; lib.plugOff = lib.plugOff.includes(f) ? lib.plugOff.filter((x) => x !== f) : lib.plugOff.concat(f); save(); rerenderSettings(); toast('Изменения применятся после перезагрузки', 'plugin'); return; }
  if (el.dataset.set) {
    const p = el.dataset.set, cur = getP(p); let v = el.dataset.v; if (typeof cur === 'number') v = +v;
    if (p === 'vizStyle') lib.vizStyle = v; else setP(p, v);
    const box = el.closest('.seg,.vcards,.sws'); if (box) box.querySelectorAll('[data-set]').forEach((x) => x.classList.toggle('on', x === el));
    settingChanged(p); deferRerender(180); return;
  }
  if (el.dataset.tg) { const p = el.dataset.tg, v = !getP(p); setP(p, v); document.querySelectorAll(`.toggle[data-tg="${p}"],.set-cell[data-tg="${p}"]`).forEach((x) => x.classList.toggle('on', v)); settingChanged(p); deferRerender(); return; }
  if (el.dataset.eqp) { const a = S().audio; a.preset = el.dataset.eqp; a.eq = [...EQ_P[a.preset][1]]; a.preamp = a.preset === 'bassplus' ? -4 : a.eq.some((x) => x > 4) ? -2 : 0; a.eqOn = true; settingChanged('audio.eq'); rerenderSettings(); return; }
  const a = el.dataset.sact;
  if (a === 'primary-preset') return applyPrimaryPreset();
  if (a === 'export' && typeof exportSettings === 'function') return exportSettings();
  if (a === 'import' && typeof importSettings === 'function') return importSettings();
  if (a && a.startsWith('cx:') && typeof customAct === 'function') return customAct(a.slice(3), el);
  if (a && a.startsWith('tabreset:')) { if (confirm('Сбросить настройки этого раздела?')) resetTab(a.slice(9)); return; }
  if (a === 'widget') pulse.win('widget');
  if (a === 'fs') pulse.win('fs');
  if (a === 'lyfix') return openFix();
  if (a === 'sync') { toast('Синхронизирую плейлисты…', 'sync'); syncAll(true).then(rerenderSettings); }
  if (a === 'plugdir') pulse.plugins.open();
  if (a === 'reload') location.reload();
  // 1.9.6: раньше сбрасывался только lib.settings — раскладка, стиль визуала, конфиги, стекло окна и виджет оставались,
  // а отложенные сохранения других модулей записывали старое обратно. Теперь сброс делает главный процесс при перезапуске.
  if (a === 'reset') {
    if (!confirm('Сбросить ВСЕ настройки Pulse?\n\nОформление, раскладка, виджет, обои, визуал и текст вернутся как после установки. Плейлисты, аккаунт и скачанные треки останутся.\nPulse перезапустится.')) return;
    if (!pulse.factoryReset) { lib.settings = JSON.parse(JSON.stringify(DEF_SETTINGS)); applySettings(); save(); rerenderSettings(); toast('Настройки сброшены', 'refresh'); return; }
    clearTimeout(saveT); window.__pulseResetting = true; toast('Сбрасываю настройки и перезапускаю…', 'refresh'); pulse.factoryReset({ mode: 'settings' });
  }
  if (a === 'wipe' && pulse.factoryReset) {
    if (!confirm('Удалить ВСЕ данные Pulse?\n\nНастройки, библиотека, плейлисты, вход в аккаунты и кэш будут удалены — как после чистой установки.\nPulse перезапустится.')) return;
    const keep = confirm('Оставить скачанные треки?\n\nОК — оставить, Отмена — удалить и их.');
    clearTimeout(saveT); window.__pulseResetting = true; toast('Удаляю данные и перезапускаю…', 'trash'); pulse.factoryReset({ mode: 'all', keepDownloads: keep });
  }
}, true);
let colRaf = 0; const colQ = new Set();
document.addEventListener('input', (e) => {
  const el = e.target; if (!el.closest || !el.closest('.set-wrap')) return;
  if (el.id === 'setQ') { setQ = el.value; rerenderSettings(); return; }
  if (el.dataset.rg) { const p = el.dataset.rg, v = +el.value; setP(p, v); document.querySelectorAll(`[data-rv="${p}"]`).forEach((lab) => (lab.textContent = (p === 'audio.preamp' && v > 0 ? '+' : '') + v + (lab.textContent.match(/[%a-zа-я×]+$/i) || [''])[0])); if (p === 'look.scale') { save(); return; } settingChanged(p); }
  if (el.dataset.eq != null) { const i = +el.dataset.eq, v = +el.value, a = S().audio; a.eq[i] = v; a.preset = 'custom'; if (!a.eqOn) { a.eqOn = true; document.querySelectorAll('[data-tg="audio.eqOn"]').forEach((x) => x.classList.add('on')); document.querySelectorAll('.eq.off').forEach((x) => x.classList.remove('off')); } document.querySelectorAll(`[data-eqv="${i}"]`).forEach((lab) => (lab.textContent = (v > 0 ? '+' : '') + v)); document.querySelectorAll('[data-eqp]').forEach((c) => c.classList.remove('on')); applyEq(); save(); }
  if (el.dataset.color) { setP('look.color', el.value); S().look.accent = 'custom'; el.parentElement.style.setProperty('--cc', el.value); el.closest('.sws') && el.closest('.sws').querySelectorAll('.sw').forEach((x) => x.classList.toggle('on', x === el.parentElement)); applySettings(); save(); }
  // 1.9.2: пипетка цвета шлёт десятки событий в секунду — раньше на каждое вызывалось полное applySettings() (пересчёт палитры обложки и т.д.)
  if (el.dataset.col) { const p = el.dataset.col; setP(p, el.value); const lab = el.closest('.colr'); if (lab) { lab.style.background = el.value; lab.classList.remove('auto'); } colQ.add(p); if (!colRaf) colRaf = requestAnimationFrame(() => { colRaf = 0; const ps = [...colQ]; colQ.clear(); ps.forEach(settingChanged); }); }
});
document.addEventListener('change', (e) => {
  const d = e.target.dataset || {}; if (d.color) rerenderSettings(); if (d.rg === 'look.scale') applySettings();
  if (d.sel && e.target.closest('.set-wrap')) { const cur = getP(d.sel); setP(d.sel, typeof cur === 'number' ? +e.target.value : e.target.value); settingChanged(d.sel); rerenderSettings(); }
  if (d.col && e.target.closest('.set-wrap')) { setP(d.col, e.target.value); settingChanged(d.col); if (d.col.startsWith('widget.') && e.target.closest('.ed-panel') && typeof edPanels === 'function') edPanels(); }
  if (d.txt && e.target.closest('.set-wrap')) { setP(d.txt, e.target.value); settingChanged(d.txt); }
});
PAGES.settings = { sync: () => settingsHtml() };
let appVer = ''; if (pulse.version) pulse.version().then((v) => (appVer = v || '')).catch(() => {});


// 2.0.9: строка настройки «Построчно / Импровизация» (общая для настроек, «Вида текста» и «Эффектов визуала»)
function lineFxRow() {
  return R('Текст только по строкам', 'Когда у песни время есть только у строк: «Построчно» — строка заливается целиком; «Импровизация» — слова загораются по одному, их время Pulse угадывает сам по слогам и голосу', seg('ly.lineFx', [['line', 'Построчно'], ['improv', 'Импровизация']]), 'построчно импровизация слова строки угадывать');
}

// 1.0.0 panel13: a keyboard-accessible language list; no click-side effects while opening it.
document.addEventListener('change',e=>{if(!e.target.matches('[data-language-list]'))return;const value=e.target.value;if(!['en','ru','ja','uk'].includes(value))return;setP('app.language',value);settingChanged('app.language');});
