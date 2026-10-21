'use strict';
// 2.0.12: вкладка «Остальное» — сюда переехали эффекты «для красоты», без которых можно жить
// (тряска, зеркало, вспышки, хроматический сдвиг…).
// Сами настройки не менялись — только место: строки переносятся по заголовку из своих вкладок.
// Тут же в «Звук» добавляются строки «Припевов».
(() => {
  const MOVE = {
    viz: ['Тряска на басу', 'Зеркало', 'Вспышка на сильной доле'],
    ly: ['Хроматический сдвиг', 'Тряска на ударах', 'Контур у неспетых слов', 'Строки-плакат'],
    wave: ['Клавиши W и X'],
    look: ['Анимация запуска'],
    app: ['Показывать FPS']
  };
  const isSub = (r) => r && !r.h && r.raw == null && /^↳ /.test(r.t || '');
  // убираем заголовки групп, под которыми ничего не осталось
  const tidy = (rows) => rows.filter((r, i) => !(r && r.h && (!rows[i + 1] || rows[i + 1].h)));
  const base = builtinTabs;
  builtinTabs = function () {
    const T = base.apply(this, arguments), out = [];
    for (const t of T) {
      const names = MOVE[t.id]; if (!names || !t.rows) continue;
      const took = [];
      for (let i = 0; i < t.rows.length; i++) {
        const r = t.rows[i]; if (!r || !names.includes(r.t)) continue;
        let j = i + 1; while (j < t.rows.length && isSub(t.rows[j])) j++;
        took.push(...t.rows.splice(i, j - i)); i--;
      }
      t.rows = tidy(t.rows);
      if (took.length) out.push(grp('Из раздела «' + t.title + '»'), ...took);
    }
    const au = T.find((t) => t.id === 'audio');
    if (au && typeof chorusRows === 'function') try { au.rows.push(...chorusRows()); } catch (e) { console.error(e); }
    const tab = { id: 'other', icon: 'sparkle', title: 'Остальное', rows: out };
    const k = T.findIndex((t) => t.id === 'keys');
    T.splice(k < 0 ? T.length : k, 0, tab);
    return T;
  };
  const G = SET_GROUPS.find(([n]) => n === 'Дополнительно'); if (G && !G[1].includes('other')) G[1].splice(Math.max(0, G[1].indexOf('keys')), 0, 'other');
  SET_DESC.other = 'Эффекты «для красоты»: тряска, зеркало, вспышки и оформление';
})();
