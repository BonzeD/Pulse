'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), M = require('../renderer/atlas-model');

test('constellation graph must be connected', () => {
  assert.equal(M.connected(['a', 'b', 'c', 'd'], [['a', 'b'], ['c', 'd']]), false);
  assert.equal(M.connected(['a', 'b', 'c'], [['a', 'b'], ['b', 'c']]), true);
});

test('bridge edge cannot be removed, cycle edge can', () => {
  const g = { members: ['a', 'b', 'c'], edges: [['a', 'b'], ['b', 'c']] };
  assert.equal(M.edgeChange(g, 'a', 'b', false), false);
  assert.equal(M.edgeChange(g, 'a', 'c', true), true);
  assert.equal(M.edgeChange(g, 'a', 'b', false), true);
  assert.equal(M.connected(g.members, g.edges), true);
});

test('removing a star never leaves an isolated star', () => {
  const g = { members: ['a', 'b', 'c'], edges: [['a', 'b'], ['b', 'c']] };
  assert.equal(M.removeMember(g, 'b'), false);
  assert.equal(M.removeMember(g, 'a'), true);
  assert.deepEqual(g.members, ['b', 'c']);
  assert.equal(M.connected(g.members, g.edges), true);
});

test('rotation and scale keep the shape around its centre', () => {
  const s = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 100, y: 0 }];
  const d = () => Math.hypot(s[0].x - s[1].x, s[0].y - s[1].y);
  M.rotate(s, ['a', 'b'], 90); assert.ok(Math.abs(d() - 100) < 1e-9);
  M.scale(s, ['a', 'b'], 2); assert.ok(Math.abs(d() - 200) < 1e-9);
});

test('tree links every member', () => {
  const s = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 50, y: 0 }, { id: 'c', x: 0, y: 80 }, { id: 'd', x: 200, y: 10 }];
  const e = M.tree(s, s.map((x) => x.id));
  assert.equal(e.length, 3);
  assert.equal(M.connected(s.map((x) => x.id), e), true);
});

test('migration produces only connected constellations', () => {
  const m = M.migrate({ stars: [{ id: 'a', x: 1, y: 1 }, { id: 'b', x: 9, y: 9 }, { id: 'c', x: 5, y: 3 }], groups: [{ id: 'g', name: 'X', members: ['a', 'b', 'c'], edges: [['a', 'b']] }, { id: 'h', name: 'solo', members: ['a'], edges: [] }] });
  assert.equal(m.version, M.VERSION);
  for (const g of m.groups) assert.equal(M.connected(g.members, g.edges), true);
});

test('Atlas delegates to the existing player and does not create an audio engine', () => {
  const s = fs.readFileSync('renderer/atlas.js', 'utf8') + fs.readFileSync('renderer/atlas-model.js', 'utf8');
  assert.doesNotMatch(s, /fetch\(|XMLHttpRequest|new Audio|AudioContext|setInterval|lib\.history|localStorage/);
  assert.match(s, /playList\(/);
  assert.match(s, /requestAnimationFrame/);
});

test('audio initialization matches the confirmed EmbeddedFirst baseline', () => {
  const old = fs.readFileSync('tests/fixtures/atlas-audio-baseline.txt', 'utf8'), cur = fs.readFileSync('renderer/app.js', 'utf8');
  const section = (s) => s.slice(s.indexOf('let player, ready ='), s.indexOf('// ---------- очередь и воспроизведение ----------'));
  assert.equal(section(cur), old);
});

test('Atlas adds its sidebar entry', () => {
  const s = require('fs').readFileSync(require('path').join(__dirname, '../renderer/atlas.js'), 'utf8');
  assert.match(s, /dataset\.go = 'atlas'/);
  assert.match(s, /\[data-go="library"\]/);
});

test('Atlas 1.0.4: mini widget, list send modes, camera flights, adaptive pulse', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../renderer/atlas.js'), 'utf8');
  for (const k of ['id="atlMini"', 'function openMini', 'function syncMini', 'function send(data, mode)', "mode === 'cons'", 'function listDialog', 'data-atl-list', 'function flight()', 'st.zoomA', 'getFloatFrequencyData']) assert.ok(src.includes(k), k);
  const css = require('fs').readFileSync(require('path').join(__dirname, '../renderer/atlas.css'), 'utf8');
  assert.ok(css.includes('.atl-mini') && css.includes('.atl-seg'));
});

test('Atlas 1.0.5: full-window sky behind the UI, soft edges', () => {
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../renderer/atlas.js'), 'utf8'), css = fs.readFileSync(path.join(__dirname, '../renderer/atlas.css'), 'utf8');
  for (const k of ['function drawSky', 'function skyOn', 'atlas-sky', 'function spawnComet']) assert.ok(src.includes(k), k);
  assert.ok(css.includes('.atl-sky') && css.includes('mask-composite'));
});

test('Atlas 1.0.6: mini widget fixes, comets in space, link toggle', () => {
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../renderer/atlas.js'), 'utf8'), css = fs.readFileSync(path.join(__dirname, '../renderer/atlas.css'), 'utf8');
  assert.ok(!src.includes("tb('songMenu', I('more')"));
  for (const k of ['function rewire', 'SK.pc = {', 'st.miniP', 'function placeMini(snap)']) assert.ok(src.includes(k), k);
  assert.ok(css.includes('.atl-mini .am-ctl>*'));
});
