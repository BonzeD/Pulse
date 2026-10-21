// Pulse 2.0.8: мост «Mineradio ↔ Pulse».
// Mineradio (https://github.com/oirge/Mineradio, автор — oirge, лицензия GPL-3.0) работает здесь только как сцена:
// 3D-визуал, текст песни, 3D-полка, визуальная консоль. Звук, очередь, текст песен и управление — из Pulse.
// Этот файл — часть модифицированной версии Mineradio и распространяется под GPL-3.0.
(function () {
  'use strict';
  var H = null;
  try { H = window.parent && window.parent !== window ? window.parent.PulseMR : null; } catch (e) { H = null; }
  if (!H) { console.warn('[Pulse] Mineradio открыт без Pulse — мост не подключён'); return; }
  var W = window;
  function def(name, fn) { if (typeof W[name] === 'function') W[name] = fn; }
  function safe(fn) { try { return fn(); } catch (e) { console.warn('[Pulse-bridge]', e); } }

  // ---------- 1. тишина и без «первого запуска» ----------
  def('playMineradioIntroSound', function () {});
  def('armSplashSoundFallback', function () {});
  def('ensureUiSfxContext', function () { return null; });
  ['maybeRunStartupVisualGuide', 'maybeRunStartupLoginGuide', 'maybeShowUploadTipOnce', 'scheduleSavedLocalMusicFolderRestore',
    'prewarmHomeWallpaperPreview', 'activateHomeWallpaperPreview', 'checkForUpdates', 'scheduleUpdateCheck'].forEach(function (n) { def(n, function () { return false; }); });
  def('updateEmptyHomeVisibility', function () { var h = document.getElementById('empty-home'); if (h) h.classList.remove('show', 'visible'); return false; });
  def('markSplashReadyToEnter', function () { safe(function () { dismissSplash(); }); });
  // свой текст песни (自定义歌词) в Pulse не нужен — текст приходит из Pulse; иначе при загрузке выскакивало окно ввода текста
  def('openCustomLyricModal', function () {});
  def('applyCustomLyricState', function () { return false; });
  def('preferredLyricSourceForSong', function () { return 'original'; });
  // всплывашки Mineradio (по-китайски и про его медиатеку) — тихо, в консоль
  def('showToast', function (msg) { if (msg && W.__pulseDebug) console.log('[Mineradio]', msg); });

  // ---------- 2. «звук»: Mineradio думает, что играет свой <audio>, а на деле читает время и спектр Pulse ----------
  var A = new Audio(); A.muted = true; A.preload = 'none';
  var tr = function () { return H.track() ? 'pulse://now' : ''; };
  Object.defineProperties(A, {
    currentTime: { configurable: true, get: function () { return H.time(); }, set: function (v) { H.seek(+v || 0); } },
    duration: { configurable: true, get: function () { var d = H.dur(); return d > 0 ? d : NaN; } },
    paused: { configurable: true, get: function () { return !H.playing(); } },
    ended: { configurable: true, get: function () { return false; } },
    src: { configurable: true, get: tr, set: function () {} },
    currentSrc: { configurable: true, get: tr },
    readyState: { configurable: true, get: function () { return 4; } },
    networkState: { configurable: true, get: function () { return 1; } },
    volume: { configurable: true, get: function () { return H.volume(); }, set: function (v) { H.setVolume(v); } },
    playbackRate: { configurable: true, get: function () { return 1; }, set: function () {} },
    play: { configurable: true, value: function () { H.play(); return Promise.resolve(); } },
    pause: { configurable: true, value: function () { H.pause(); } },
    load: { configurable: true, value: function () {} }
  });
  function fakeAnalyser(smooth) {
    return {
      fftSize: 2048, frequencyBinCount: 1024, smoothingTimeConstant: smooth, minDecibels: -100, maxDecibels: -30,
      get context() { return { sampleRate: H.sampleRate(), currentTime: performance.now() / 1000, state: 'running' }; },
      getByteFrequencyData: function (a) { if (!H.freq(a)) a.fill(0); },
      getByteTimeDomainData: function (a) { if (!H.wave(a)) a.fill(128); },
      getFloatFrequencyData: function (a) { a.fill(-100); },
      getFloatTimeDomainData: function (a) { a.fill(0); },
      connect: function () {}, disconnect: function () {}
    };
  }
  var fakeCtx = { state: 'running', destination: null, get sampleRate() { return H.sampleRate(); }, get currentTime() { return performance.now() / 1000; },
    resume: function () { return Promise.resolve(); }, suspend: function () { return Promise.resolve(); } };
  audio = A; audioDeckList = [{ el: A, source: null, gain: null, pendingStartRamp: 0, retireSerial: 0 }]; audioDeckActive = 0;
  def('ensureAudioDeckPool', function () { return audioDeckList; });
  def('attachAudioDeckNodes', function () {});
  def('initAudio', function () {
    if (audioReady) return;
    audioCtx = fakeCtx; analyser = fakeAnalyser(0.58); beatAnalyser = fakeAnalyser(0.1);
    frequencyData.fill(0); beatFrequencyData.fill(0); beatTimeDomainData.fill(128);
    safe(function () { resetRealtimeBeatEngine(); });
    audioReady = true;
  });
  def('resumeAudioAnalysis', function () { return Promise.resolve(); });
  def('applyVolumeToAudio', function () {});
  def('applyAudioChainToNodes', function () {});
  def('applyOutputDeviceToAudioContext', function () {});
  def('setReplayGainNodeGain', function () {});
  def('preparePlaybackFadeIn', function () {});
  def('startPlaybackFadeIn', function () {});
  def('restorePlaybackGain', function () {});
  def('pauseInactiveAudioDecks', function () {});
  def('pauseCurrentAudioForTrackSwitch', function () {});
  // офлайн-анализ бита Mineradio скачивает файл песни — у Pulse свой поток, поэтому оставляем только живой бит по спектру
  ['scheduleBeatAnalysis', 'scheduleBeatPrefetch', 'startLocalBeatAnalysis', 'analyzeBeatMapForSong'].forEach(function (n) { def(n, function () { return null; }); });
  def('finalizeListenSession', function () {}); def('recordSongResumeTick', function () {}); def('updateListenStatsTick', function () {});
  initAudio();

  // ---------- 3. управление — команды уходят в Pulse ----------
  def('togglePlay', function () { H.toggle(); return Promise.resolve(); });
  def('playAudio', function () { H.play(); return Promise.resolve(true); });
  def('attemptAudioPlay', function () { H.play(); return Promise.resolve(true); });
  def('nextTrack', function () { H.next(); });
  def('prevTrack', function () { H.prev(); });
  def('playQueueAt', function (i) { H.playIdx(i); return Promise.resolve(); });
  def('setVolume', function (v) { H.setVolume(Math.max(0, Math.min(1, +v || 0))); });
  def('toggleLikeSong', function () { H.like(); });

  // ---------- 4. трек, обложка, очередь ----------
  var lastKey = '', lastLyr, lastLyricOwner = '', lastQ = '';
  function songOf(t, i) {
    return { id: 'pulse:' + t.id, pulseId: t.id, pulseIdx: i, name: t.title || '', artist: t.artist || '', album: t.album || '',
      cover: t.cover || '', duration: t.dur || 0, dt: (t.dur || 0) * 1000, type: 'pulse' };
  }
  function syncQueue(force) {
    var q = H.queue(); var key = q.sig;
    if (!force && key === lastQ) { if (currentIdx !== q.idx) currentIdx = q.idx; return; }
    lastQ = key;
    var list = []; for (var i = 0; i < q.tracks.length; i++) list.push(songOf(q.tracks[i], i));
    playQueue = list; currentIdx = q.idx;
    safe(function () { markQueueContentChanged(); });
    safe(function () { safeShelfRebuild('pulse-queue', true); });
  }
  function syncTrack(force) {
    var t = H.track(); syncQueue(force);
    var key = t ? t.id : '';
    if (!force && key === lastKey) return;
    lastKey = key; trackSwitchToken++;
    // 1.0.0 panel8: never carry a same-index lyric mesh into another song.
    safe(function () { clearStageLyrics(); }); lastLyr = undefined; lastLyricOwner = '';
    if (!t) { safe(function () { loadCoverFromUrl(''); }); return; }
    var song = playQueue[currentIdx]; if (!song || song.pulseId !== t.id) song = songOf(t, currentIdx);
    homeSuppressed = true; homeForcedOpen = false;
    safe(function () { updateControlTrackInfo(song); });
    safe(function () { updateLikeButtons(song); });
    safe(function () { resetCinemaTrackProfile(song); });
    safe(function () { switchPlaybackVisualToEmily(); });
    if (!firstPlayDone) { firstPlayDone = true; safe(function () { tweenParticleAlpha(uniforms.uAlpha.value || 0, 1.0, 220); }); }
    lyricSunEnergy = 0; lyricSunTarget = 0; lyricSunHold = 0; lyricSunAvg = 0; lyricSunPeak = 0.55;
    safe(function () { loadCoverFromUrl(song.cover, { trackToken: trackSwitchToken }); });
    safe(function () { safeShelfRebuild('pulse-track', true); });
    lastLyr = undefined; syncLyrics(true);
  }

  // 1.0.0 panel8: track metadata belongs to Pulse, not a potentially stale queue snapshot.
  def('currentLyricFallbackText', function () { var t = H.track(); if (!t || H.cfg().showTitle === false) return ''; return t.artist ? t.title + ' - ' + t.artist : t.title || ''; });

  // ---------- 5. текст песни: строки Pulse → формат Mineradio {t, duration, text, words[{text,t,d,c0,c1}]} ----------
  function convLines(src) {
    var out = [], native = false, rows = [];
    for (var i = 0; i < src.length; i++) { var L = src[i]; if (!L || L.gap) continue; rows.push(L); }
    for (var j = 0; j < rows.length; j++) {
      var R = rows[j], nx = rows[j + 1], ws = R.words && R.words.length && !R.words[0].line && (!R.est || (H.improv && H.improv())) ? R.words : null; // 2.0.9: угаданные слова — только в «Импровизации»
      var text = String(R.text || (R.words || []).map(function (w) { return w.s; }).join(' ')).replace(/\s+/g, ' ').trim();
      if (!text) continue;
      var lineEnd = R.end || (nx ? nx.t : R.t + 5);
      if (ws) {
        native = true; var raw = [];
        for (var k = 0; k < ws.length; k++) {
          var w = ws[k], wn = ws[k + 1], e = w.e != null ? w.e : (wn ? wn.t : lineEnd);
          raw.push({ text: String(w.s).trim() + (k < ws.length - 1 ? ' ' : ''), startMs: w.t * 1000, durMs: Math.max(60, (e - w.t) * 1000) });
        }
        var built = safe(function () { return buildWordTimedLyricLine(R.t * 1000, Math.max(0, (lineEnd - R.t) * 1000), raw, text, 'yrc-word', 'yrc-line'); });
        if (built) { out.push(built); continue; }
      }
      out.push({ t: R.t, duration: Math.max(0.2, lineEnd - R.t), text: text, words: [], charCount: Math.max(1, text.length), source: 'lrc' });
    }
    out = safe(function () { return finalizeLyricLineDurations(out); }) || out;
    return { lines: out, native: native };
  }
  function syncLyrics(force) {
    var t = H.track(), L = H.lyrics();
    var owned = !!(t && L && String(t.id) === String(L.id));
    var src = owned ? L.lines : null;
    var owner = (t ? t.id : '') + '|' + (owned ? L.id : 'pending') + '|' + !!(H.improv && H.improv());
    if (src === lastLyr && owner === lastLyricOwner && force !== true) return;
    // Only publish cache identity after success, so transient errors can be retried.
    safe(function () {
      clearStageLyrics();
      var c = src && src.length ? convLines(src) : null;
      var lines = c && c.lines.length ? c.lines : withLyricFallback([]);
      setOriginalLyricsState(lines, !!(c && c.native), c && c.lines.length ? 'pulse' : 'fallback');
      applyOriginalLyricsState();
      lastLyr = src; lastLyricOwner = owner;
    });
  }

  // ---------- 6. состояние «играет/пауза» ----------
  var lastPlaying = null;
  function syncPlay() {
    var p = !!H.playing(); if (p === lastPlaying) return; lastPlaying = p;
    playing = p; safe(function () { setPlayIcon(p); });
    try { A.dispatchEvent(new Event(p ? 'play' : 'pause')); } catch (e) {}
    safe(function () { markRenderInteraction('pulse-play', 600); scheduleMainRenderFrame(); });
  }

  // ---------- 7. настройки из Pulse ----------
  var lastCfg = '';
  function applyCfg(c) {
    c = c || H.cfg(); W.__pulseReaction = c.reaction == null ? 1 : Math.max(0, Math.min(1.6, +c.reaction)); W.__pulseMorph = c.morph !== false; if (!W.__pulseMorph && uniforms.uPulseMorph) uniforms.uPulseMorph.value = 0; var k = JSON.stringify(c); if (k === lastCfg) { syncTitleControl(c); return; } var prev = lastCfg ? JSON.parse(lastCfg) : {}; lastCfg = k;
    if (c.language !== prev.language && W.__pulseSetLanguage) safe(function () { W.__pulseSetLanguage(c.language); safeShelfRebuild('pulse-language', true); });
    if (c.preset != null && c.preset !== prev.preset && fx.preset !== c.preset) { playbackVisualPreset = c.preset; safe(function () { setPreset(c.preset, { silent: true, preserveCamera: false }); }); }
    if (c.quality && c.quality !== prev.quality) safe(function () { setPerformanceQualityMode(c.quality, true); });
    if (c.fps != null) { RENDER_PLAYBACK_FPS_CAP = c.fps > 0 ? c.fps : 0; RENDER_PLAYBACK_FPS_CAP_ECO = c.fps > 0 ? Math.min(48, c.fps) : 48; }
    if (c.lyrics != null && c.lyrics !== prev.lyrics && !!fx.particleLyrics !== !!c.lyrics) safe(function () { setParticleLyricsSilently(!!c.lyrics); });
    // 1.0.0 panel13: rebuild fallback immediately, leaving actual lyrics intact.
    if (c.showTitle !== prev.showTitle) safe(function () { syncLyrics(true); });
    syncTitleControl(c);
    if (c.shelf && c.shelf !== prev.shelf && fx.shelf !== c.shelf) safe(function () { setShelfMode(c.shelf); });
  }

  // 1.0.0 panel13: separate from the lyric visibility switch.
  function syncTitleControl(c) {
    var grid=document.getElementById('fx-lyric-primary-controls'); if(!grid)return;
    var button=document.getElementById('pulse-track-title-toggle');
    if(!button){button=document.createElement('button');button.type='button';button.id='pulse-track-title-toggle';button.className='fx-toggle';button.innerHTML='<span></span><span class="dot" aria-hidden="true"></span>';button.onclick=function(){H.setShowTitle(H.cfg().showTitle===false);applyCfg(H.cfg());};grid.insertBefore(button,grid.firstChild);}
    var on=c.showTitle!==false;button.classList.toggle('on',on);button.setAttribute('aria-pressed',String(on));
    var label=W.__pulseLocaleText?W.__pulseLocaleText('Название трека в сцене'):'Название трека в сцене';if(button.firstElementChild.textContent!==label)button.firstElementChild.textContent=label;
  }
  // ---------- 8. пауза отрисовки, когда сцену не видно ----------
  var shown = true;
  W.__pulseSetVisible = function (v) {
    v = !!v; if (v === shown) return; shown = v;
    desktopRuntimeState.visible = v;
    if (v) { safe(function () { resumeMainRenderLoop('pulse-show'); }); syncTrack(true); syncPlay(); }
    else safe(function () { suspendMainRenderLoop('pulse-hide'); });
  };

  // ---------- 9. клавиши и мышь → Pulse (Пробел, стрелки, T, Esc работают как в Pulse) ----------
  W.addEventListener('keydown', function (e) {
    var tg = e.target, tn = tg && tg.tagName;
    if (tn === 'INPUT' || tn === 'TEXTAREA' || tn === 'SELECT' || (tg && tg.isContentEditable)) return;
    e.stopImmediatePropagation(); e.preventDefault();
    H.key({ key: e.key, code: e.code, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, metaKey: e.metaKey, repeat: e.repeat });
  }, true);
  // Forward the final position too: throttling can drop the one move into the reveal zone.
  W.addEventListener('pointermove', function (e) { H.wake(e.clientX, e.clientY); }, { passive: true, capture: true });
  // 3D-полка: клик по карточке трека → играть в Pulse (полка зовёт playQueueAt — уже переопределён)
  // Queue cards always dispatch directly to Pulse. Playlist rows, real dragging and UI controls
  // remain owned by Mineradio. A click cannot fall through into a second playback handler.
  var lastQueuePick = null;
  W.addEventListener('click', function (e) {
    safe(function () {
      if (typeof renderer === 'undefined' || e.target !== renderer.domElement) return;
      if (!shelfManager || shelfManager.getMode() === 'off' || mouseDownAt.hadDrag || isPointerOverUi(e)) return;
      if (e.detail > 1 && lastQueuePick && performance.now() - lastQueuePick.at < 800 && Math.hypot(e.clientX - lastQueuePick.x, e.clientY - lastQueuePick.y) < 8) { e.preventDefault(); e.stopImmediatePropagation(); return; }
      var rc = raycasterFromPointerEvent(e), open = shelfManager.hasOpenContent && shelfManager.hasOpenContent();
      if (open) { var cl = shelfManager.getContentList && shelfManager.getContentList(); if (cl && (cl.raycastRows(rc) || (cl.pickRowAtScreen && cl.pickRowAtScreen(e.clientX, e.clientY)))) return; }
      var mode = shelfManager.getMode();
      var hit = pointerCardHit(rc, e, mode === 'side' && !shelfPinnedOpen ? 18 : undefined); if (!hit || !hit.card || !hit.card.mesh) return;
      if (!hit.card.mesh.visible || (hit.card.mesh.material && hit.card.mesh.material.opacity <= 0.05)) return;
      var a = hit.card.mesh.userData && hit.card.mesh.userData.action; if (!a || a.kind !== 'playQueue' || !(a.index >= 0)) return;
      // Own the queue-card command in capture phase, for centered and side cards alike.
      // Do not also let the legacy shelf close/focus/play the same click a second time.
      e.preventDefault(); e.stopImmediatePropagation();
      lastQueuePick = { at: performance.now(), x: e.clientX, y: e.clientY };
      if (shelfManager.scrollBy) shelfManager.scrollBy(hit.card.index - shelfManager.getCenterIdx());
      H.playIdx(a.index);
    });
  }, true);
  // 2.0.12: «музыка очень долго грузится». Ссылку на звук трека, к которому подвели полку (центр или наведение),
  // Pulse получает заранее — как при наведении на трек в обычном списке; клик стартует почти сразу
  var pfAt = 0, pfLast = -1;
  setInterval(function () {
    if (!shown || !H.prefetch) return;
    safe(function () {
      if (!shelfManager || !shelfManager.getCardAt) return;
      var c = shelfManager.getCardAt(Math.round(shelfManager.getCenterIdx())), a = c && c.mesh && c.mesh.userData && c.mesh.userData.action;
      if (!a || a.kind !== 'playQueue' || a.index === pfLast) return;
      var n = performance.now(); if (n - pfAt < 600) return; pfAt = n; pfLast = a.index; H.prefetch(a.index);
    });
  }, 300);

  // ---------- 10. запуск ----------
  function boot() {
    safe(function () { dismissSplash(); });
    // пресет 8 (оригинальный Wallpaper Engine CmzYa) в Pulse не входит — лицензия у этой сборки своя, не GPL
    safe(function () { if (presetMeta.length > 8) { presetMeta.length = 8; presetIcons.length = 8; } if (fx.preset > 7) setPreset(0, { silent: true }); });
    safe(function () { if (typeof W.__pulseTranslate === 'function') W.__pulseTranslate(document.body); });
    safe(function () { buildPresetGrid(); });
    applyCfg(); syncTrack(true); syncPlay();
    H.ready();
  }
  W.__pulse = { syncTrack: syncTrack, syncLyrics: syncLyrics, syncPlay: syncPlay, applyCfg: applyCfg,
    openConsole: function (v) { safe(function () { toggleFxPanel(v === false ? false : undefined); }); },
    consoleOpen: function () { var el = document.getElementById('fx-panel'); return !!(el && (el.classList.contains('show') || el.classList.contains('peek'))); } };
  setInterval(function () { if (!shown) return; syncPlay(); syncTrack(false); syncLyrics(); }, 250);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 0); });
  else setTimeout(boot, 0);
})();
