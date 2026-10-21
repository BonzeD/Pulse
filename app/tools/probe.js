// 2.0.11: замер нагрузки по сценариям: node perf.js "<имя>=<js>@@..."  → время стилей/раскладки/скриптов/отрисовки за 4 с
const { chromium } = require('playwright');
(async () => {
  const sc = process.argv[2].split('@@').map((s) => { const i = s.indexOf('='); return [s.slice(0, i), s.slice(i + 1)]; });
  const b = await chromium.launch({ executablePath: require('child_process').execSync('which chromium').toString().trim(), args: ['--no-sandbox', '--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await p.addInitScript(() => { const mk = () => new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : k === Symbol.toPrimitive ? () => '' : mk(), apply: () => Promise.resolve(null) }); window.pulse = mk(); });
  await p.goto('file:///data/pulse/renderer/index.html'); await p.waitForTimeout(1500);
  await p.evaluate(() => {
    document.querySelectorAll('#splash').forEach((e) => e.remove()); document.body.classList.remove('sp-intro');
    const art = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><defs><linearGradient id="g"><stop offset="0" stop-color="#6a3cff"/><stop offset="1" stop-color="#ff4fa8"/></linearGradient></defs><rect width="300" height="300" fill="url(#g)"/></svg>');
    const tr = (i) => ({ id: 'id' + i, title: 'Track ' + i, artists: [{ name: 'A' }], author: 'A', art, dur: 200 });
    lib.queue = { name: 'Q', tracks: Array.from({ length: 40 }, (_, i) => tr(i)), idx: 0 }; try { updateNow(); } catch (e) {}
    lyState.id = 'id0'; lyState.lines = Array.from({ length: 60 }, (_, k) => ({ t: k * 3, text: 'line number ' + k + ' with some words here', words: ('line number ' + k + ' with some words here').split(' ').map((s, j) => ({ t: k * 3 + j * .4, s })) })); lyState.kind = 'synced';
    try { showLines(lyState.lines); } catch (e) {}
    basePal = [[255, 45, 149], [139, 61, 255], [0, 229, 255]];
    // имитация игры: время идёт, playing = true
    window.__t0 = performance.now(); E.time = () => (performance.now() - window.__t0) / 1000; E.dur = () => 200; playing = true;
  });
  for (const [name, js] of sc) { await p.evaluate(js); await p.waitForTimeout(900); console.log('== '+name); console.log(await p.evaluate(require('fs').readFileSync('/tmp/bd.js','utf8').replace('console.log(out.join','return (out.join'))); }
  console.log(errs.slice(0, 5).join('\n')); await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
