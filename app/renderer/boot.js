'use strict';
// Запуск Pulse: загрузка библиотеки, плагинов и первого экрана (подключается последним)
async function loadPlugins() {
  try { plug.list = (await pulse.plugins.list()) || []; } catch { plug.list = []; }
  for (const f of plug.list) {
    if ((lib.plugOff || []).includes(f)) continue;
    await new Promise((res) => { const sc = document.createElement('script'); sc.src = '/plugins/' + encodeURIComponent(f); sc.onload = () => { if (!plug.err[f]) plug.ok[f] = true; res(); }; sc.onerror = () => { plug.err[f] = 'файл не загрузился'; res(); }; document.body.appendChild(sc); setTimeout(res, 3000); });
  }
}
// YouTube-плеер грузим асинхронно — раньше он блокировал запуск окна при медленной сети
{ const sc = document.createElement('script'); sc.src = 'https://www.youtube.com/iframe_api'; sc.async = true; sc.onerror = () => (window.__ytFailed = true); document.head.appendChild(sc); }
// ---------- запуск ----------
(async () => {
  let libraryReadFailed = false;
  const saved = await pulse.getLibrary().catch(() => { libraryReadFailed = true; return null; });
  if (saved) {
    // миграция с 1.3: текущий плейлист → очередь
    if (!saved.queue && saved.cur && saved.playlists) { const p = saved.playlists.find((x) => x.id === saved.cur.pl); if (p) saved.queue = { name: p.name, tracks: p.tracks, idx: Math.max(0, saved.cur.idx) }; }
    ['cur', 'view', 'searchRes', 'radio', 'accView', 'hideQueue', 'video'].forEach((k) => delete saved[k]);
    if (saved.mode === 'lyrics') saved.mode = 'cover';
    lib = Object.assign(lib, saved);
  }
  const primaryFirstRun = PulsePrimaryPreset.initialize(lib, saved, LEGACY_SETTINGS);
  if (!primaryFirstRun) lib.settings = mergeDeep(LEGACY_SETTINGS, saved.settings);
  if (window.PulseI18n) PulseI18n.setLanguage(lib.settings.app.language);
  // 1.9.4: режим диджея теперь выключен по умолчанию — один раз выключаем его и у тех, кто обновился
  if (!lib._m194) { lib._m194 = 1; lib.settings.dj.on = false; lib.settings.dj.auto = false; }
  // 2.0: новый облик виджета — у обновившихся один раз меняем старую градиентную кнопку Play на новую «Белую»
  if (!lib._m200) { lib._m200 = 1; if (lib.settings.widget && lib.settings.widget.playStyle === 'grad') lib.settings.widget.playStyle = 'white'; }
  // 2.0.10: новый вид — у обновившихся старые цвета по умолчанию (фон #030303, панель #212121) один раз меняются на новые; свои цвета не трогаем
  if (!lib._m2010) { lib._m2010 = 1; const U = lib.settings.ui; if (U.bg === '#030303') U.bg = '#09090c'; if (U.panel === '#212121') U.panel = '#141418'; }
  if (!Array.isArray(lib.settings.audio.eq) || lib.settings.audio.eq.length !== 10) lib.settings.audio.eq = [...DEF_SETTINGS.audio.eq];
  lib.lyrics = lib.lyrics || {}; lib.offsets = lib.offsets || {}; lib.known = lib.known || {}; lib.playlists = lib.playlists || []; lib.stretch = lib.stretch || {}; lib.ytc = lib.ytc || {};
  if (!lib.queue || !Array.isArray(lib.queue.tracks)) lib.queue = { name: '', tracks: [], idx: -1 };
  lib.queue.tracks.forEach((t) => delete t.broken); lib.queue.autoSeed = null;
  if (!Viz.STYLES.some((x) => x.id === lib.vizStyle)) lib.vizStyle = 'ring';
  if (!['cover', 'video', 'visual'].includes(lib.mode)) lib.mode = 'cover';
  // 2.0.3: плейлист «Мои треки» убран. Его треки становятся лайками и уходят на сервер сервиса (после входа — сами).
  lib.likes = lib.likes || {}; lib.likeQ = lib.likeQ || [];
  { const i = lib.playlists.findIndex((x) => x.id === MINE); if (i >= 0) { const old = lib.playlists[i]; lib.playlists.splice(i, 1); (old.tracks || []).forEach((t) => { if (!t || !t.id) return; remember(t); if (!lib.likes[t.id]) { lib.likes[t.id] = 1; lib.likeQ.push({ id: t.id, on: true, at: Date.now(), n: 0 }); } }); } }
  // 1.5: перепроверить старые тексты (могли прийти от другой песни) и пересинхронизировать по голосу с новой моделью
  if ((lib.lyV || 0) < 2) { for (const id in lib.lyrics) { const L = lib.lyrics[id]; if (!L || L.none || L.instrumental) continue; L.recheck = true; delete L.ws; delete L.auto; delete L.wsFail; } lib.lyV = 2; }
  document.body.classList.toggle('mini', !!lib.mini);
  try { off = (await pulse.offlineList()) || {}; } catch { off = {}; }
  if(window.MediaLibrary)await MediaLibrary.init();
  if (!online() && lib.accCache) accLists = lib.accCache;
  await loadPlugins();
  // 2.0.2: распознавание текста нейросетью убрано — старые «распознанные» тексты больше не показываются
  if (!lib.noWs) { for (const id in lib.lyrics) { const L = lib.lyrics[id]; if (L && L.ws) { delete L.ws; delete L.wsFail; if (L.none) L.at = 0; } } lib.noWs = true; }
  if (S().sync) delete S().sync.bgVoice; if (S().ly) { delete S().ly.voice; delete S().ly.transcribe; delete S().ly.model; }
  applySettings();
  if (typeof clInit === 'function') await clInit(); // 2.0.2: текущий клиент (YouTube Music / Apple Music / Spotify)
  renderAccBtn(); renderSide(); updateButtons(); updateMode(); updateNet(); updOffCount();
  const sp = S().app.start; navS.stack = [online() ? { r: PAGES[sp] ? sp : 'home' } : { r: 'downloads' }]; navS.pos = 0; renderRoute();
  const t = curTrack();
  if (t) { if (off[t.id] || online()) E.load(t, false); updateNow(); loadLyricsFor(t); renderQueue(); }
  if (online()) refreshAccount();
  scheduleSync();
  PX.emit('ready');
  window.PulseWelcome?.ready(saved, libraryReadFailed);
  if (!libraryReadFailed) { if (primaryFirstRun) save(); } // Persist once; upgrades never reapply the author preset.
})();
