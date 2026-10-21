// 2.0.7: панель плеера в «Только текст» (и в Spicy-полноэкранном) — плавающая «таблетка» снизу.
// Используем тот же #bar: id, классы и обработчики не меняются (публичный API для плагинов и тем).
// Режим включается классом body.lys-bar, пока на body есть .lyonly. Настройка ly.kBar: on | auto | off.
(() => {
  const B = document.body, bar = $('bar');
  const mode = () => { const v = S().ly && S().ly.kBar; return v === 'off' || v === 'auto' ? v : 'on'; };
  const idle = () => (typeof lys !== 'undefined' && lys.on && lys.idle) || (typeof SP !== 'undefined' && SP.on && SP.idle);
  const stage = () => $('lyStage');
  let saved = null, awakeT = 0;

  function lybFsIco() { const i = $('icoLybFs'); if (i) i.innerHTML = `<use href="#i-${B.classList.contains('fs') ? 'collapse' : 'expand'}"/>`; $('btnLybFs').title = B.classList.contains('fs') ? 'Выйти из полноэкранного (F)' : 'Во весь экран (F)'; }
  function lybSync() {
    // 1.0.0: основная панель всегда видна; авто-скрытие относится только к сцене.
    B.classList.toggle('main-bar', !B.classList.contains('lyonly'));
    const on = B.classList.contains('lyonly') && mode() !== 'off' && !idle();
    if (on !== B.classList.contains('lys-bar')) {
      if (on) { // раскладка редактора могла сдвинуть/увеличить #bar — на время режима убираем, потом вернём
        saved = { tr: bar.style.getPropertyValue('translate'), trP: bar.style.getPropertyPriority('translate'), sc: bar.style.getPropertyValue('scale'), scP: bar.style.getPropertyPriority('scale') };
        bar.style.removeProperty('translate'); bar.style.removeProperty('scale');
      } else {
        if (saved) { if (saved.tr) bar.style.setProperty('translate', saved.tr, saved.trP); if (saved.sc) bar.style.setProperty('scale', saved.sc, saved.scP); saved = null; }
        lybQueue(false); const st = stage(); if (st) st.classList.remove('lyb-pin'); $('btnLybView').classList.remove('on');
      }
      B.classList.toggle('lys-bar', on);
    }
    B.classList.toggle('lyb-auto', on && mode() === 'auto');
    if (on) { lybFsIco(); }
  }
  new MutationObserver(lybSync).observe(B, { attributes: true, attributeFilter: ['class'] });

  // «Прятать сама»: показываем при движении мыши
  document.addEventListener('pointermove', () => {
    if (!B.classList.contains('lyb-auto')) return;
    B.classList.add('lyb-awake'); clearTimeout(awakeT); awakeT = setTimeout(() => B.classList.remove('lyb-awake'), 2400);
  }, { passive: true });

  // ---------- очередь слева ----------
  let qEl = null;
  function lybQueueHtml() {
    const q = lib.queue;
    const head = `<div class="lyb-q-h"><span class="grow"><b>Очередь</b><small>${esc(q.name || 'Сейчас играет')}</small></span>
      <button class="ib ${lib.shuffle ? 'on' : ''}" data-lq="shuffle" title="Перемешать">${ico('shuffle')}</button>
      <button class="ib" data-lq="close" title="Закрыть">${ico('x')}</button></div>`;
    if (!q.tracks.length) return head + `<div class="lyb-q-e">Очередь пуста</div>`;
    const i0 = Math.max(0, q.idx - 3);
    return head + `<div class="lyb-q-l">${q.tracks.slice(i0, i0 + 200).map((t, k) => { const i = i0 + k;
      const a = (t.artists || []).map((x) => x.name || x).join(', ') || t.author || '';
      return `<div class="lyb-q-r ${i === q.idx ? 'cur' : ''}" data-lqi="${i}"><i style="background-image:url(&quot;${esc(artOf(t, 60))}&quot;)"></i><span><b>${esc(t.title || '')}</b><em>${esc(a)}</em></span></div>`; }).join('')}</div>`;
  }
  function lybQueue(v) {
    if (v == null) v = !(qEl && qEl.classList.contains('show'));
    if (v && !qEl) {
      qEl = document.createElement('div'); qEl.className = 'lyb-q'; qEl.id = 'lybQueue'; document.body.appendChild(qEl);
      qEl.addEventListener('click', (e) => {
        e.stopPropagation(); const b = e.target.closest('[data-lq]');
        if (b && b.dataset.lq === 'close') return lybQueue(false);
        if (b && b.dataset.lq === 'shuffle') { toggleShuffle(); return lybQueueRender(); }
        const r = e.target.closest('[data-lqi]'); if (!r) return; const i = +r.dataset.lqi;
        if (i === lib.queue.idx) return toggle(); if (!playable(lib.queue.tracks[i])) return toast('Трек недоступен'); playIdx(i);
      });
      qEl.addEventListener('contextmenu', (e) => { const r = e.target.closest('[data-lqi]'); if (!r) return; e.preventDefault(); const t = lib.queue.tracks[+r.dataset.lqi]; if (t) trackMenu(t, e.clientX, e.clientY, { queue: t }); });
    }
    if (!qEl) return;
    if (v) lybQueueRender(true);
    qEl.classList.toggle('show', !!v); $('btnLybQueue').classList.toggle('on', !!v);
  }
  function lybQueueRender(scroll) {
    if (!qEl) return; const l0 = qEl.querySelector('.lyb-q-l'), top = l0 ? l0.scrollTop : 0;
    qEl.innerHTML = lybQueueHtml(); const l = qEl.querySelector('.lyb-q-l'); if (!l) return;
    if (scroll) { const c = l.querySelector('.cur'); if (c) l.scrollTop = c.offsetTop - 60; } else l.scrollTop = top;
  }
  PX.on && PX.on('track', () => { if (qEl && qEl.classList.contains('show')) lybQueueRender(true); });

  // ---------- кнопки панели ----------
  $('btnLybAdd').onclick = (e) => { e.stopPropagation(); const t = curTrack(); if (t) addToModal([t]); };
  $('btnLybQueue').onclick = (e) => { e.stopPropagation(); lybQueue(); };
  $('btnLybFs').onclick = (e) => { e.stopPropagation(); pulse.win('fs'); };
  $('btnLybLy').onclick = (e) => { e.stopPropagation(); lyStageOpen(false); if (curTrack()) { openPP(); setTab('lyrics'); } };
  $('btnLybView').onclick = (e) => { e.stopPropagation(); if (window.mrActive && mrActive()) return mrConsole(); const st = stage(); if (!st) return; const on = st.classList.toggle('lyb-pin'); e.currentTarget.classList.toggle('on', on); };
  // 1.0.0: текст открывается в сцене; основная панель не меняет настройки текста.
  // клик по обложке/названию в режиме — меню трека (там «Не нравится», «Скачать», «К исполнителю»…), а не страница плеера под сценой
  $('barMid').addEventListener('click', (e) => {
    if (!B.classList.contains('lys-bar') || e.target.closest('button,a')) return;
    e.stopPropagation(); const t = curTrack(); if (!t) return; const r = $('bArt').getBoundingClientRect(); trackMenu(t, r.left, r.top - 440, {});
  }, true);
  // диджей открывается страницей — сначала выходим из сцены
  $('btnDj').addEventListener('click', () => { if (B.classList.contains('lys-bar') && S().dj && S().dj.on) lyStageOpen(false); }, true);
  // клики по панели не должны доходить до сцены (там клик = свои действия)
  bar.addEventListener('pointerdown', (e) => { if (B.classList.contains('lys-bar')) e.stopPropagation(); });
  window.lybSync = lybSync; window.lybQueue = lybQueue;
  lybSync();
})();
