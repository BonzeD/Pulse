'use strict';
// 2.0.4-fix: анимация запуска. Окно, закрытое в трей, только прячется (не перезагружается) — поэтому заставка
// играет только при полном запуске Pulse. Перезагрузка страницы (импорт настроек и т. п.) её тоже не показывает.
(function () {
  const el = document.getElementById('splash'); if (!el) return;
  // 1.0.0: no long decorative intro when motion is disabled.
  let off = window.matchMedia('(prefers-reduced-motion: reduce)').matches; try { off = off || localStorage.getItem('pulse.motion') === 'off' || localStorage.getItem('pulse.splash') === 'off' || sessionStorage.getItem('pulse.splashShown') === '1'; sessionStorage.setItem('pulse.splashShown', '1'); } catch {}
  if (off) { el.remove(); return; }
  // искорки
  const dots = el.querySelector('.sp-dots'); if (dots) { let h = ''; for (let i = 0; i < 26; i++) h += `<i style="left:${(Math.random() * 100).toFixed(1)}%;top:${(20 + Math.random() * 70).toFixed(1)}%;animation-delay:${(Math.random() * 3).toFixed(2)}s;animation-duration:${(2.4 + Math.random() * 2).toFixed(2)}s;opacity:0;transform:scale(${(0.5 + Math.random()).toFixed(2)})"></i>`; dots.innerHTML = h; }
  // 2.0.4: заставка реагирует на курсор — логотип наклоняется к нему, блик на плитке и подсветка следуют за мышью,
  // буквы «Pulse» подпрыгивают под курсором. Только transform/opacity, один rAF на кадр.
  let mx = 0, my = 0, raf = 0;
  const logo = el.querySelector('.sp-logo'), word = el.querySelectorAll('.sp-word b');
  const paint = () => { raf = 0; const r = logo ? logo.getBoundingClientRect() : null; if (!r) return;
    const dx = (mx - (r.left + r.width / 2)) / (innerWidth / 2), dy = (my - (r.top + r.height / 2)) / (innerHeight / 2);
    el.style.setProperty('--mx', Math.max(-1, Math.min(1, dx)).toFixed(3)); el.style.setProperty('--my', Math.max(-1, Math.min(1, dy)).toFixed(3));
    el.style.setProperty('--cx', mx + 'px'); el.style.setProperty('--cy', my + 'px');
    word.forEach(b => { const q = b.getBoundingClientRect(); b.classList.toggle('hv', Math.abs(mx - (q.left + q.width / 2)) < q.width * 0.9 && Math.abs(my - (q.top + q.height / 2)) < q.height); });
  };
  el.addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; el.classList.add('hot'); if (!raf) raf = requestAnimationFrame(paint); });
  el.addEventListener('pointerleave', () => { el.classList.remove('hot'); el.style.setProperty('--mx', 0); el.style.setProperty('--my', 0); word.forEach(b => b.classList.remove('hv')); });
  // окно запущено скрытым (автозапуск в трей) — ждём, пока его покажут, чтобы анимацию увидели целиком
  let t0 = 0, loaded = document.readyState === 'complete', done = false;
  const MIN = 1800, MAX = 4500;
  // отсчёт — с первого нарисованного кадра (пока грузятся скрипты, кадров нет, а CSS-анимация ещё не идёт)
  const start = () => requestAnimationFrame(() => requestAnimationFrame(begin));
  const begin = () => { if (t0) return; t0 = performance.now(); el.classList.remove('wait'); setTimeout(tryEnd, MIN); setTimeout(end, MAX); };
  const tryEnd = () => { if (loaded && performance.now() - t0 >= MIN - 20) end(); };
  function end() {
    if (done) return; done = true;
    const ln = el.querySelector('.sp-line'); if (ln) ln.classList.add('out');
    el.classList.add('bye'); document.body.classList.add('sp-intro');
    setTimeout(() => { el.remove(); document.body.classList.remove('sp-intro'); }, 650);
  }
  window.addEventListener('load', () => { loaded = true; if (t0) tryEnd(); });
  el.addEventListener('click', () => { if (t0) end(); });
  window.addEventListener('keydown', function k(e) { if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') { window.removeEventListener('keydown', k, true); if (t0) end(); } }, true);
  if (document.hidden) { el.classList.add('wait'); document.addEventListener('visibilitychange', function v() { if (!document.hidden) { document.removeEventListener('visibilitychange', v); start(); } }); }
  else start();
})();
