// Pulse 2.0.8: подготовка Mineradio к работе внутри Pulse (режим «Только текст»).
// Этот файл — часть модифицированной версии Mineradio (GPL-3.0), автор оригинала — oirge, https://github.com/oirge/Mineradio
// Включаем «DIY-режим» (без него не открывается визуальная консоль) и помечаем страницу как встроенную.
(function () {
  try { localStorage.setItem('mineradio-diy-player-mode-v1', '1'); } catch (e) {}
  // подсказки первого запуска Mineradio не показываем — в Pulse они не к месту
  try { localStorage.setItem('mineradio-visual-guide-seen-v2', '1'); localStorage.setItem('mineradio-upload-tip-seen', '1'); } catch (e) {}
  document.documentElement.classList.add('pulse-embed');
  window.__PULSE_EMBED__ = true;
})();
// Pulse: у Mineradio внутри Pulse нет своего сервера (/api/… — обновления, поиск, облако). Отвечаем «недоступно» сразу, без сети.
(function () {
  var f = window.fetch;
  window.fetch = function (u, o) {
    var s = typeof u === 'string' ? u : (u && u.url) || '';
    if (/^\/api\/|^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/api\//.test(s)) return Promise.resolve(new Response('{"ok":false,"pulse":"offline"}', { status: 503, headers: { 'content-type': 'application/json' } }));
    return f.apply(this, arguments);
  };
})();
