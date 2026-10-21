// Пример плагина Pulse. Чтобы включить — переименуй файл в example-visual.js
// (убери «.off») и нажми «Перезагрузить» в Настройки → Плагины. Подробно: PLUGINS.md
(function () {
  const store = Pulse.storage('example');

  // 1) своя иконка (SVG, viewBox 24×24)
  Pulse.addIcon('v-hex', '0 0 24 24', '<path d="M12 2 21 7v10l-9 5-9-5V7zm0 2.3L5 8.2v7.6l7 3.9 7-3.9V8.2z"/>');

  // 2) своя визуализация: шестиугольники, которые расходятся точно в такт (g.pos — номер доли)
  Pulse.registerVisual({
    id: 'example-hex', name: 'Соты (пример)', icon: 'v-hex', cover: 'show',
    draw(g) {
      const { ctx, cx, cy, R } = g, n = store.get('rings', 6);
      for (let i = 0; i < n; i++) {
        const k = (i + (g.pos % 1)) / n, r = R * 1.15 + k * Math.max(g.W, g.H) * 0.55;
        ctx.beginPath();
        for (let j = 0; j <= 6; j++) { const a = j / 6 * g.TAU + g.tick * 0.05; ctx[j ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
        ctx.strokeStyle = g.mix(k + g.bar, (1 - k) * (0.4 + g.bass));
        ctx.lineWidth = 2 + g.beat * 6 * (1 - k);
        g.glow(g.mix(k), 14); ctx.stroke();
      }
      g.noGlow();
    }
  });

  // 3) своя вкладка настроек
  Pulse.addSettingsTab({
    id: 'example', icon: 'plugin', title: 'Пример плагина',
    rows: (ui) => [
      ui.group('Соты'),
      ui.row('Количество колец', 'Сейчас: ' + store.get('rings', 6),
        [4, 6, 9, 12].map((n) => `<button class="btn sm" onclick="Pulse.storage('example').set('rings',${n});Pulse.toast('Колец: ${n}')">${n}</button>`).join(''))
    ]
  });

  // 4) пункт в меню трека («⋯»)
  Pulse.addTrackMenuItem((t) => ['search', 'Найти «' + t.title + '» в Google', () => window.open('https://www.google.com/search?q=' + encodeURIComponent(t.author + ' ' + t.title))]);

  // 5) события плеера
  Pulse.on('track', (t) => console.log('[example] сейчас играет', t && t.title));
})();
