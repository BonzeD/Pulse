// 2.0.8: Mineradio внутри «Только текст».
// Mineradio — визуальный плеер oirge (https://github.com/oirge/Mineradio, GPL-3.0). Его сцена (3D-визуал, текст песни,
// 3D-полка, визуальная консоль) загружается во фрейм renderer/mineradio/ и получает от Pulse время, спектр, очередь и текст.
// Пока сцену не видно, она не рисует; через минуту после закрытия выгружается (если не включено «Держать загруженной»).
(() => {
  const MR_URL = 'mineradio/index.html';
  const MR = { box: null, frame: null, ready: false, unloadT: 0, parked: false, wantShow: false };
  LYS_VIS.push(['mineradio', 'Mineradio']);
  const Y = () => lyY();
  const isMr = () => (Y().vis || 'classic') === 'mineradio';
  const want = () => !window.PulseImmersion?.active() && typeof lys !== 'undefined' && lys.on && !lys.idle && isMr() && !window.pulseWinHidden; // 2.0.12: окно спрятано — сцена спит
  const active = () => want() && MR.ready;
  window.mrActive = active;
  const win = () => { try { return MR.frame && MR.frame.contentWindow; } catch (e) { return null; } };
  const abs = (u) => (!u ? '' : /^(https?|data|blob|file):/i.test(u) ? u : location.origin + (u[0] === '/' ? u : '/' + u));
  const artists = (t) => (t.artists || []).map((x) => x.name || x).join(', ') || t.author || '';
  const tOut = (t) => t && ({ id: t.id, title: t.title || '', artist: artists(t), album: (t.album && t.album.name) || '', cover: abs(artOf(t, 600)), dur: t.dur || 0 });
  let qCache = { sig: '', tracks: [] };

  function cfg() {
    const y = Y(), pm = (S().perf && S().perf.mode) || 'balanced';
    const q = y.mrQuality && y.mrQuality !== 'auto' ? y.mrQuality : pm === 'eco' ? 'eco' : pm === 'high' ? 'ultra' : 'high';
    return { language: S().app.language || 'en', reaction: y.mrReaction == null ? 1 : +y.mrReaction, morph: y.mrMorph !== false && !document.body.classList.contains('no-anim'), preset: +y.mrPreset || 0, quality: q, fps: y.mrFps == null ? 60 : +y.mrFps, lyrics: y.mrLyrics !== false, showTitle: y.mrShowTitle !== false, shelf: y.mrShelf === false ? 'off' : 'side' };
  }

  // ---------- API для фрейма ----------
  window.PulseMR = {
    version: '1.0.1',
    time: () => { const k = stretchK() || 1; return Math.max(0, (heard(S().ly.lag || 0) - offset()) / k); },
    dur: () => E.dur() || 0,
    playing: () => !!playing,
    track: () => tOut(curTrack()),
    queue: () => {
      const q = lib.queue, n = q.tracks.length, sig = n + '|' + (n ? q.tracks[0].id + '|' + q.tracks[n - 1].id : '') + '|' + (q.name || '');
      if (sig !== qCache.sig) qCache = { sig, tracks: q.tracks.slice(0, 400).map(tOut) }; // 2.0.8: полке хватает 400, не копируем огромные очереди
      return { sig, idx: Math.min(q.idx, 399), name: q.name || '', tracks: qCache.tracks };
    },
    lyrics: () => { const t = curTrack(); return t && lyState.id === t.id ? { id: t.id, lines: lyState.lines, kind: lyState.kind } : { id: t ? t.id : null, lines: null, kind: null }; },
    improv: () => (S().ly || {}).lineFx === 'improv', // 2.0.9
    sampleRate: () => (readSpectrum()?.sampleRate || (actx ? actx.sampleRate : 48000)),
    freq: (a) => { const s = readSpectrum(); if (!s) return false; a.fill(0); a.set(s.f.subarray(0, a.length)); return true; },
    wave: (a) => { const s = readSpectrum(); if (!s) return false; a.fill(128); a.set(s.w.subarray(0, a.length)); return true; },
    volume: () => (lib.volume || 0) / 100,
    setVolume: (v) => setVolume(Math.round(v * 100)),
    play: () => { if (!playing) toggle(); },
    pause: () => { if (playing) toggle(); },
    toggle: () => toggle(),
    next: () => next(),
    prev: () => prev(),
    seek: (s) => { const k = stretchK() || 1; E.seek(Math.max(0, s * k + offset())); },
    // Explicit selection is a retry, like playList(), not automatic skip logic.
    // Selecting the same playing track twice must not turn the second click into Pause.
    playIdx: (i) => {
      if (!Number.isInteger(i)) return false;
      const t = lib.queue.tracks[i]; if (!t) return false;
      if (!off[t.id] && !online()) { toast('Нет интернета — этот трек не скачан'); return false; }
      const retry = failed(t); failedAt.delete(t.id);
      if (i === lib.queue.idx && !retry) { if (!playing) toggle(); return true; }
      playIdx(i); return true;
    },
    // 2.0.12: заранее получить ссылку на звук трека очереди (полка Mineradio) — клик по нему стартует быстрее
    prefetch: (i) => { const t = lib.queue.tracks[i]; if (!t || off[t.id] || !online() || i === lib.queue.idx || !pulse.prefetch) return; if (!window.__mrPf) window.__mrPf = new Map(); const k = window.__mrPf.get(t.id); if (k && Date.now() - k < 10 * 60e3) return; window.__mrPf.set(t.id, Date.now()); pulse.prefetch(t.id); },
    like: () => { const t = curTrack(); if (t) toggleLike(t); },
    // 1.0.0 panel13: shared persisted switch for the console and Pulse settings.
    setShowTitle: (v) => { setP('ly.mrShowTitle',!!v); save(); mrSync(); if(route().r==='settings')rerenderSettings(); },
    cfg,
    key: (o) => document.dispatchEvent(new KeyboardEvent('keydown', { ...o, bubbles: true, cancelable: true })),
    // Pointer events do not bubble out of an iframe. Translate its CSS coordinates
    // into the parent viewport (also works if the frame is resized/scaled).
    wake: (x, y) => {
      const f = MR.frame;
      if (f && Number.isFinite(x) && Number.isFinite(y)) {
        const r = f.getBoundingClientRect();
        if (f.clientWidth > 0 && f.clientHeight > 0) document.dispatchEvent(new PointerEvent('pointermove', {
          bubbles: true, clientX: r.left + x * r.width / f.clientWidth,
          clientY: r.top + y * r.height / f.clientHeight, pointerType: 'mouse',
        }));
      }
      if (typeof lysWake === 'function') lysWake();
    },
    ready: () => { MR.ready = true; mrSync(); },
  };

  // ---------- фрейм ----------
  function ensure() {
    if (MR.box) return;
    const b = document.createElement('div'); b.id = 'mrStage'; b.className = 'mr-stage';
    b.innerHTML = `<div class="mr-load"><b>Mineradio</b><span>загружаю 3D-сцену…</span></div>`;
    const f = document.createElement('iframe'); f.src = MR_URL; f.title = 'Mineradio'; f.setAttribute('allow', 'autoplay');
    b.appendChild(f); document.body.appendChild(b); MR.box = b; MR.frame = f; MR.ready = false;
  }
  function unload() { clearTimeout(MR.unloadT); MR.unloadT = 0; if (!MR.box) return; MR.box.remove(); MR.box = MR.frame = null; MR.ready = false; }
  function mrSync() {
    const w = want(), st = $('lyStage');
    if (w) { clearTimeout(MR.unloadT); MR.unloadT = 0; ensure(); }
    const on = w && MR.ready;
    if (MR.box) { MR.box.classList.toggle('show', on); MR.box.classList.toggle('loading', w && !MR.ready); }
    const fw = win(); if (fw && fw.__pulseSetVisible) try { fw.__pulseSetVisible(on); if (on) fw.__pulse.applyCfg(cfg()); } catch (e) { console.error(e); }
    if (st) {
      st.classList.toggle('mr-on', on);

    }
    document.body.classList.toggle('mr-on', on);
    // своя сцена Pulse под Mineradio не рисуется — возвращаем цикл, когда Mineradio ушёл
    if (!on && MR.parked && typeof lys !== 'undefined' && lys.on) { MR.parked = false; cancelAnimationFrame(lys.raf); lys.raf = requestAnimationFrame(lysLoop); }
    if (!w && !window.pulseWinHidden && MR.box && !MR.unloadT && Y().mrKeep !== true) MR.unloadT = setTimeout(unload, 60000);
  }
  window.mrSync = mrSync;
  window.mrConsole = () => { const fw = win(); if (fw && fw.__pulse) fw.__pulse.openConsole(); };

  // цикл сцены Pulse стоит, пока на экране Mineradio (экономим кадр целиком)
  { const base = lysLoop; lysLoop = function (t) { if (active()) { MR.parked = true; lys.raf = 0; return; } return base(t); }; }
  { const base = window.lyStageOpen; window.lyStageOpen = function (v, idle) { const r = base(v, idle); mrSync(); return r; }; }
  if (typeof lysApply === 'function') { const base = lysApply; lysApply = function () { const r = base.apply(this, arguments); mrSync(); return r; }; }
  { const base = settingChanged; settingChanged = function (p) { const r = base(p); if (/^ly\.mr|^ly\.vis|^perf\./.test(p)) { if (p === 'ly.mrKeep' && Y().mrKeep !== true && !want()) mrSync(); const fw = win(); if (fw && fw.__pulse) fw.__pulse.applyCfg(cfg()); } return r; }; }
  // события Pulse → фрейм сразу, без ожидания опроса
  const push = (fn) => () => { if (!active()) return; const fw = win(); if (fw && fw.__pulse) try { fw.__pulse[fn](fn === 'syncLyrics' ? true : undefined); } catch (e) {} };
  PX.on && PX.on('track', push('syncTrack')); PX.on && PX.on('lyrics', push('syncLyrics'));
  // 2.0.9: смена «Построчно / Импровизация» — пересобрать текст во фрейме
  { const base = settingChanged; settingChanged = function (p) { const r = base(p); if (p === 'ly.lineFx' && active()) { const fw = win(); if (fw && fw.__pulse) try { fw.__pulse.syncLyrics(true); } catch (e) {} } return r; }; }

  // ---------- настройки: вкладка «Текст песен» → «Только текст» ----------
  const MR_PRESETS = [[0, 'Обложка (emily)'], [1, 'Тоннель'], [2, 'Планета'], [3, 'Пустота'], [4, 'Пластинка'], [5, 'Звёздная река'], [6, 'Реквием'], [7, 'Звуковой рельеф']];
  function mrRows() {
    const y = Y(), on = isMr();
    return [
      grp('Mineradio — 3D-сцена'),
      { raw: `<div class="mr-about">
        <div class="mr-about-h"><b>Mineradio</b><span>визуальная сцена для «Только текст»</span></div>
        <p>3D-визуал из частиц обложки, объёмный текст песни, 3D-полка и визуальная консоль. Автор — <b>oirge</b>.
        Встроено в Pulse по лицензии <b>GPL-3.0</b> (звук, очередь и текст берутся из Pulse).</p>
        <p class="mr-thanks">Пресет «Звуковой рельеф» — порт <b>Ajin</b> (yin-yizhen/sonic-topography) по работе <b>CmzYa</b> «音域回响», через форк XxHuberrr/Mineradio.
        Пресет «Обложка» — по идее <b>emily</b>. three.js, GSAP, music-tempo — MIT. Шрифты Noto Sans SC — SIL OFL 1.1.</p>
        <div class="mr-about-b"><button class="btn sm" data-sact="mr:src">${ico('link')}Исходник на GitHub</button><button class="btn sm" data-sact="mr:lic">${ico('file')}Лицензия GPL-3.0</button><button class="btn sm ${on ? 'on' : ''}" data-sact="mr:open">${ico('lyrics')}${on ? 'Открыть сцену' : 'Включить и открыть'}</button></div>
      </div>` },
      R('Сцена «Только текст»', 'Pulse — свои стили (Классика, Кинетика, Столбик) · Mineradio — 3D-сцена', seg('ly.vis', [['classic', 'Pulse'], ['mineradio', 'Mineradio']]), 'mineradio сцена 3d'),
      R('Визуальный пресет', 'Тонкая настройка — в визуальной консоли Mineradio (кнопка «Вид» на панели)', seg('ly.mrPreset', MR_PRESETS), 'mineradio пресет визуал частицы'),
      R('Реакция обложки на музыку', 'Сила короткого импульса на аудиоатаках. Без фонового метронома.', seg('ly.mrReaction', [[0, 'Выкл'], [0.55, 'Мягко'], [1, 'Обычно'], [1.6, 'Сильно']]), 'mineradio audio reaction sensitivity beat pulse'),
      R('Переход обложек', 'При смене трека частицы мягко расходятся и собираются в новую обложку. Без колец и вспышек.', tg('ly.mrMorph'), 'mineradio cover transition morph'),
      R('Название трека в сцене', 'Показывать название и исполнителя до первой строки или когда текста песни нет. Текст песни остаётся включённым.', tg('ly.mrShowTitle'), 'mineradio название заголовок title'),
      R('Текст песни в сцене', 'Объёмный текст Mineradio поверх визуала', tg('ly.mrLyrics'), 'mineradio текст'),
      R('3D-полка с очередью', 'Карточки треков сбоку; клик — включить', tg('ly.mrShelf'), 'mineradio полка очередь'),
      grp('Mineradio — производительность'),
      R('Качество графики', 'Авто — по режиму Pulse («Экономно» → Эконом)', seg('ly.mrQuality', [['auto', 'Авто'], ['eco', 'Эконом'], ['balanced', 'Баланс'], ['high', 'Высокое'], ['ultra', 'Максимум']]), 'mineradio качество графика'),
      R('Лимит кадров во время песни', '0 — как у монитора. 60 — плавно и тише для видеокарты', seg('ly.mrFps', [[30, '30'], [48, '48'], [60, '60'], [0, 'Монитор']]), 'mineradio fps кадры'),
      R('Держать сцену загруженной', 'Открывается мгновенно, но держит память видеокарты. Иначе выгружается через минуту после закрытия', tg('ly.mrKeep'), 'mineradio память выгрузка'),
    ];
  }
  { const base = lyStageRows; lyStageRows = function () { const r = base(); const i = r.findIndex((x) => x && x.h === 'Эффекты текста'); r.splice(i < 0 ? r.length : i, 0, ...mrRows()); return r; }; }
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-sact^="mr:"]'); if (!b) return; e.stopPropagation(); e.preventDefault();
    const a = b.dataset.sact.slice(3), open = (u) => { try { pulse.openUrl ? pulse.openUrl(u) : window.open(u); } catch (er) {} };
    if (a === 'src') return open('https://github.com/oirge/Mineradio');
    if (a === 'lic') return open('https://github.com/oirge/Mineradio/blob/main/LICENSE');
    if (a === 'open') { Y().vis = 'mineradio'; save(); if (document.body.classList.contains('pp-open')) closePP(); lyStageOpen(true); mrSync(); }
  }, true);
})();
