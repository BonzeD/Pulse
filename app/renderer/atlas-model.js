/* Pulse Atlas 3 — чистая модель космоса: плоские координаты, связные созвездия, преобразования.
   Без DOM: используется и в рендерере, и в node-тестах. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PulseAtlasModel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const VERSION = 3;
  const key = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
  const same = (e, a, b) => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a);
  const hasEdge = (g, a, b) => g.edges.some((e) => same(e, a, b));

  // Созвездие валидно, только если в нём ≥2 звезды и граф связный (никто не висит отдельно).
  function connected(members, edges) {
    if (!members || members.length < 2) return false;
    const set = new Set(members), adj = new Map(members.map((m) => [m, []]));
    for (const [a, b] of edges || []) {
      if (!set.has(a) || !set.has(b) || a === b) continue;
      adj.get(a).push(b); adj.get(b).push(a);
    }
    const seen = new Set([members[0]]), stack = [members[0]];
    while (stack.length) for (const n of adj.get(stack.pop())) if (!seen.has(n)) { seen.add(n); stack.push(n); }
    return seen.size === set.size;
  }
  // Ребро — «мост», если без него созвездие распадается.
  const isBridge = (g, a, b) => hasEdge(g, a, b) && !connected(g.members, g.edges.filter((e) => !same(e, a, b)));

  // add=true — добавить связь, add=false — убрать. Возвращает true, если граф изменился.
  function edgeChange(g, a, b, add) {
    if (a === b || !g.members.includes(a) || !g.members.includes(b)) return false;
    const has = hasEdge(g, a, b);
    if (add) { if (has) return false; g.edges.push([a, b]); return true; }
    if (!has) return false;
    const next = g.edges.filter((e) => !same(e, a, b));
    if (!connected(g.members, next)) return false;
    g.edges = next; return true;
  }
  const toggleEdge = (g, a, b) => (hasEdge(g, a, b) ? (edgeChange(g, a, b, false) ? 'removed' : 'blocked') : edgeChange(g, a, b, true) ? 'added' : 'blocked');

  // Убрать звезду можно, если остальные остаются связными. Если осталась одна звезда — созвездие распадается (dissolve).
  function removeMember(g, id) {
    if (!g.members.includes(id)) return false;
    const members = g.members.filter((m) => m !== id), edges = g.edges.filter((e) => e[0] !== id && e[1] !== id);
    if (members.length >= 2 && !connected(members, edges)) return false;
    g.members = members; g.edges = edges; return true;
  }
  function addMember(g, id, to) {
    if (g.members.includes(id) || !g.members.includes(to)) return false;
    g.members.push(id); g.edges.push([to, id]); return true;
  }

  const pick = (stars, ids) => stars.filter((s) => ids.includes(s.id));
  function center(stars, ids) {
    const p = ids ? pick(stars, ids) : stars;
    if (!p.length) return { x: 0, y: 0 };
    return { x: p.reduce((s, a) => s + a.x, 0) / p.length, y: p.reduce((s, a) => s + a.y, 0) / p.length };
  }
  function move(stars, ids, dx, dy) { for (const s of pick(stars, ids)) { s.x += dx; s.y += dy; } return true; }
  function rotate(stars, ids, deg, c) {
    const p = pick(stars, ids); if (!p.length) return false;
    c = c || center(p); const r = (deg * Math.PI) / 180, cs = Math.cos(r), sn = Math.sin(r);
    for (const s of p) { const x = s.x - c.x, y = s.y - c.y; s.x = c.x + x * cs - y * sn; s.y = c.y + x * sn + y * cs; }
    return true;
  }
  function scale(stars, ids, k, c) {
    const p = pick(stars, ids); if (!p.length || !(k > 0)) return false;
    c = c || center(p);
    for (const s of p) { s.x = c.x + (s.x - c.x) * k; s.y = c.y + (s.y - c.y) * k; }
    return true;
  }
  const chain = (ids) => ids.slice(1).map((b, i) => [ids[i], b]);
  // Кратчайшее остовное дерево — «аккуратные связи» без пересечений через всё небо.
  function tree(stars, ids) {
    const p = pick(stars, ids); if (p.length < 2) return [];
    const inT = new Set([p[0].id]), out = [];
    while (inT.size < p.length) {
      let best = null;
      for (const a of p) if (inT.has(a.id)) for (const b of p) if (!inT.has(b.id)) {
        const d = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
        if (!best || d < best.d) best = { a: a.id, b: b.id, d };
      }
      inT.add(best.b); out.push([best.a, best.b]);
    }
    return out;
  }
  function hull(pts) {
    const p = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y);
    if (p.length < 3) return p;
    const cr = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x), lo = [], up = [];
    for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (const q of p.slice().reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  function inHull(q, h) {
    if (h.length < 3) return false;
    for (let i = 0; i < h.length; i++) {
      const a = h[i], b = h[(i + 1) % h.length];
      if ((b.x - a.x) * (q.y - a.y) - (b.y - a.y) * (q.x - a.x) < 0) return false;
    }
    return true;
  }
  function segDist(q, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy;
    const t = l ? Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / l)) : 0;
    return Math.hypot(q.x - a.x - t * dx, q.y - a.y - t * dy);
  }
  // Свободное место рядом с точкой: спираль, пока не найдём точку дальше minD от всех звёзд.
  function freeSpot(stars, at, minD) {
    minD = minD || 110;
    for (let i = 0; i < 400; i++) {
      const a = i * 2.39996, r = i ? 26 * Math.sqrt(i) : 0, p = { x: at.x + Math.cos(a) * r, y: at.y + Math.sin(a) * r };
      if (stars.every((s) => (s.x - p.x) ** 2 + (s.y - p.y) ** 2 >= minD * minD)) return p;
    }
    return { x: at.x, y: at.y };
  }
  const HUES = [212, 268, 188, 322, 154, 32, 246, 350];
  // v1/v2 жили на сфере x∈[0,1000), y∈[0,600]; v3 — бесконечная плоскость с центром в нуле.
  function migrate(old) {
    if (!old || typeof old !== 'object') return { version: VERSION, stars: [], groups: [] };
    if (old.version === VERSION) return old;
    const K = 2.4, stars = (old.stars || []).filter((s) => s && s.id).map((s) => ({
      ...s, kind: s.kind === 'playlist' ? 'playlist' : s.source ? 'remote' : 'list',
      x: ((+s.x || 500) - 500) * K, y: ((+s.y || 300) - 300) * K, tracks: Array.isArray(s.tracks) ? s.tracks : []
    }));
    const ids = new Set(stars.map((s) => s.id));
    const groups = (old.groups || []).map((g, i) => {
      const members = (g.members || []).filter((m) => ids.has(m));
      let edges = (g.edges || []).filter((e) => ids.has(e[0]) && ids.has(e[1]));
      if (!connected(members, edges)) edges = tree(stars, members);
      return { id: g.id, name: g.name || 'Созвездие', members, edges, hue: g.hue ?? HUES[i % HUES.length] };
    }).filter((g) => g.members.length >= 2);
    return { version: VERSION, stars, groups };
  }
  return { VERSION, HUES, key, hasEdge, connected, isBridge, edgeChange, toggleEdge, removeMember, addMember, center, move, rotate, scale, chain, tree, hull, inHull, segDist, freeSpot, migrate };
});
