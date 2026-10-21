'use strict';
// 2.0: общий дизайн элементов музыкальных обоев — им пользуются и сами обои (wallpaper.html), и предпросмотр в Pulse.
(function () {
  const FONTS = {
    segoe: ['Segoe UI', '"Segoe UI Variable Display","Segoe UI",system-ui,sans-serif'],
    light: ['Segoe UI Light', '"Segoe UI Light","Segoe UI Variable Display","Segoe UI",sans-serif'],
    bahn: ['Bahnschrift', 'Bahnschrift,"DIN Alternate","Segoe UI",sans-serif'],
    mono: ['Consolas', 'Consolas,"Cascadia Mono","Courier New",monospace'],
    serif: ['Georgia', 'Georgia,"Times New Roman",serif'],
    script: ['Segoe Script', '"Segoe Script","Segoe Print","Comic Sans MS",cursive'],
    impact: ['Impact', 'Impact,Haettenschweiler,"Arial Narrow Bold",sans-serif'],
    verdana: ['Verdana', 'Verdana,Tahoma,sans-serif']
  };
  const font = (k) => (FONTS[k] || FONTS.segoe)[1];
  const p2 = (n) => String(n).padStart(2, '0');
  const op = (v, d) => Math.max(0, Math.min(1, (v == null ? d : +v) / 100)).toFixed(2);
  function analog(c, d) {
    const h = d.getHours() % 12, m = d.getMinutes(), s = d.getSeconds();
    const hand = (deg, len, w, col) => `<line x1="50" y1="50" x2="${(50 + len * Math.sin(deg * Math.PI / 180)).toFixed(2)}" y2="${(50 - len * Math.cos(deg * Math.PI / 180)).toFixed(2)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
    let ticks = '';
    for (let i = 0; i < 12; i++) { const a = i * 30 * Math.PI / 180, r1 = i % 3 ? 41 : 37; ticks += `<line x1="${(50 + r1 * Math.sin(a)).toFixed(2)}" y1="${(50 - r1 * Math.cos(a)).toFixed(2)}" x2="${(50 + 45 * Math.sin(a)).toFixed(2)}" y2="${(50 - 45 * Math.cos(a)).toFixed(2)}" stroke="currentColor" stroke-opacity="${i % 3 ? .45 : .9}" stroke-width="${i % 3 ? 1.2 : 2.4}" stroke-linecap="round"/>`; }
    return `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="rgba(255,255,255,.05)" stroke="currentColor" stroke-opacity=".3" stroke-width="1.2"/>${ticks}`
      + hand((h + m / 60) * 30, 24, 4.2, 'currentColor') + hand((m + s / 60) * 6, 35, 2.6, 'currentColor')
      + (c.clockSec ? hand(s * 6, 40, 1.1, 'rgb(var(--a1))') : '') + '<circle cx="50" cy="50" r="2.8" fill="rgb(var(--a1))"/></svg>';
  }
  // разметка часов: <b class="hm">…</b><span class="dt">…</span>
  function clockHtml(c, d) {
    c = c || {}; d = d || new Date();
    const st = c.clockStyle || 'thin';
    const date = c.clockDate === false ? '' : `<span class="dt">${d.toLocaleDateString((window.PulseI18n ? PulseI18n.locale() : 'en-US'), { weekday: 'long', day: 'numeric', month: 'long' })}</span>`;
    if (st === 'analog') return analog(c, d) + date;
    let h = d.getHours(), ap = '';
    if (c.clock12) { ap = h < 12 ? 'AM' : 'PM'; h = h % 12 || 12; }
    const H = c.clock12 && st !== 'stack' ? String(h) : p2(h), M = p2(d.getMinutes());
    const hm = st === 'stack' ? `<i>${H}</i><i>${M}</i>` : `${H}:${M}${c.clockSec ? `<small>:${p2(d.getSeconds())}</small>` : ''}${ap ? `<sup>${ap}</sup>` : ''}`;
    return `<b class="hm">${hm}</b>${date}`;
  }
  const clockClass = (c) => `cs-${c.clockStyle || 'thin'} pl-${c.clockPlate || 'none'}`;
  function plateBg(kind, o) {
    if (kind === 'glass') return `rgba(10,8,18,${o})`;
    if (kind === 'dark') return `rgba(0,0,0,${o})`;
    if (kind === 'accent') return `linear-gradient(135deg,rgba(var(--a1),${o}),rgba(var(--a2),${(o * .7).toFixed(2)}))`;
    return '';
  }
  const clockBg = (c) => plateBg(c.clockPlate || 'none', op(c.clockPlateOp, 40));
  // фон карточки трека по стилю и плотности
  function cardBg(c) {
    const o = op(c.cardOp, 42), st = c.cardStyle || 'glass';
    if (st === 'minimal') return 'none';
    if (st === 'accent') return `linear-gradient(135deg,rgba(var(--a1),${(o * .85).toFixed(2)}),rgba(var(--a2),${(o * .55).toFixed(2)}))`;
    if (st === 'solid') return `rgba(16,14,24,${Math.max(o, .5)})`;
    return `rgba(10,8,18,${o})`;
  }
  const cardClass = (c) => `st-${c.cardStyle || 'glass'} as-${c.artShape || 'rounded'}`;
  const HEART = '<path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.7 4.5c2.1 0 3.6 1.1 4.3 2.4h2c.7-1.3 2.2-2.4 4.3-2.4 3.7 0 5.8 3.8 4.3 7.2C19.5 16.4 12 21 12 21z"/>';
  const HEART_O = '<path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.7 4.5c2.1 0 3.6 1.1 4.3 2.4h2c.7-1.3 2.2-2.4 4.3-2.4 3.7 0 5.8 3.8 4.3 7.2C19.5 16.4 12 21 12 21z" fill="none" stroke="currentColor" stroke-width="2"/>';
  const g = typeof window !== 'undefined' ? window : globalThis;
  g.WallStyle = { FONTS, font, clockHtml, clockClass, clockBg, cardBg, cardClass, HEART, HEART_O };
})();
