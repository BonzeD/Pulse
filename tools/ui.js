// 2.0.10: скриншоты экранов Pulse пачкой: node ui.js <outdir> <W> <H> <screens через запятую> [extra-js]
const { chromium } = require('playwright');
(async () => {
  const dir = process.argv[2], W = +process.argv[3], H = +process.argv[4], list = process.argv[5].split(process.env.SEP || ','), extra = process.argv[6] || '';
  const b = await chromium.launch({ executablePath: require('child_process').execSync('which chromium').toString().trim(), args: ['--no-sandbox', '--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  const errs = []; p.on('pageerror', (e) => errs.push('E ' + String(e).slice(0, 300))); p.on('console', (m) => m.type() === 'error' && !/MediaMetadata|Failed to load resource/.test(m.text()) && errs.push('C ' + m.text().slice(0, 300)));
  await p.addInitScript(() => {
    const mk = () => new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : k === Symbol.toPrimitive ? () => '' : mk(), apply: () => Promise.resolve(null) });
    const art = (a, b) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="300" height="300" fill="url(#g)"/><circle cx="150" cy="150" r="70" fill="#fff" opacity=".25"/></svg>`);
    const C = [['#6a3cff', '#ff4fa8'], ['#00b3ff', '#2bffb0'], ['#ff8a00', '#ff2d55'], ['#222', '#888'], ['#ffd36e', '#ff5fa2'], ['#3a0ca3', '#4cc9f0'], ['#0f9b8e', '#c7f464'], ['#ff6b6b', '#556270']];
    const N = ['Midnight City', 'Blinding Lights', 'Очень длинное название альбома, которое не влезает в карточку', 'Sunflower', 'Levitating', 'Stray.wav', 'Ночь', 'Again'];
    const song = (i) => ({ kind: 'song', id: 's' + i, title: N[i % 8], author: 'Artist ' + i, artists: [{ name: 'Artist ' + i, id: 'UC' + i }], art: art(...C[i % 8]), dur: 150 + i * 7, plays: (i + 1) * 3 + ' млн' });
    const it = (k, i) => ({ kind: k, browseId: (k === 'artist' ? 'UC' : 'MPRE') + i, title: N[(i + 3) % 8], sub: k === 'artist' ? '2 млн слушателей' : 'Альбом • 2024', art: art(...C[(i + 2) % 8]) });
    const feed = () => ({ chips: ['Энергия', 'Расслабиться', 'Тренировка', 'Грусть', 'Вечеринка'].map((t, i) => ({ title: t, params: 'p' + i })),
      shelves: [{ title: 'Послушать ещё раз', strap: 'Для вас', items: [0, 1, 2, 3, 4, 5, 6, 7].map(song) }, { title: 'Альбомы для вас', items: [0, 1, 2, 3, 4, 5, 6].map((i) => it('album', i)) }, { title: 'Исполнители', items: [0, 1, 2, 3, 4, 5].map((i) => it('artist', i)) }, { title: 'Миксы', items: [0, 1, 2, 3, 4, 5].map((i) => ({ ...it('playlist', i), browseId: 'VLRD' + i, sub: 'Микс' })) }] });
    const ytm = { feed: async () => feed(), search: async () => [{ top: true, items: [song(1)] }, { title: 'Треки', items: [0, 1, 2, 3, 4, 5].map(song) }, { mixed: true, items: [it('album', 1), it('artist', 2), it('album', 3)] }],
      browse: async (id) => /^UC/.test(id) ? { type: 'artist', header: { title: 'Artist 1', sub: '2 млн слушателей', art: art('#6a3cff', '#ff4fa8') }, shelves: [{ title: 'Популярное', list: true, items: [0, 1, 2, 3, 4].map(song) }, { title: 'Альбомы', items: [0, 1, 2, 3].map((i) => it('album', i)) }] }
        : { type: /^MPRE/.test(id) ? 'album' : 'playlist', browseId: id, header: { title: 'Midnight City', sub: 'Альбом • Artist 1 • 2024', art: art('#ff8a00', '#ff2d55'), desc: 'Описание альбома' }, tracks: [0, 1, 2, 3, 4, 5, 6, 7].map(song), shelves: [] } };
    const base = mk();
    window.pulse = new Proxy(base, { get: (t, k) => k === 'ytm' ? ytm : k === 'then' ? undefined : base[k] });
  });
  await p.goto('file:///data/pulse/renderer/index.html'); await p.waitForTimeout(1500);
  await p.evaluate(() => {
    document.body.classList.remove('sp-intro'); document.querySelectorAll('.splash,#splash').forEach((e) => e.remove());
    const art = (a, b) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="300" height="300" fill="url(#g)"/><circle cx="150" cy="150" r="70" fill="#fff" opacity=".25"/></svg>`);
    const C = [['#6a3cff', '#ff4fa8'], ['#00b3ff', '#2bffb0'], ['#ff8a00', '#ff2d55'], ['#222', '#888'], ['#ffd36e', '#ff5fa2'], ['#3a0ca3', '#4cc9f0']];
    const tr = (i) => ({ id: 'id' + i, title: ['MONTAGEM SOLITÁRIA (Slowed + Reverb) — очень длинное название трека для проверки', 'Stray.wav', 'One Last Kiss', 'Moonlit Dream', 'Patience', 'Again'][i % 6], artists: [{ name: 'Ranfish222', id: 'a1' }, { name: 'Itsinochi' }], author: 'Ranfish222', art: art(...C[i % 6]), dur: 112 + i * 17, album: { name: 'Album ' + i, id: 'al' + i } });
    window.__tr = tr;
    lib.queue = { name: 'Моя волна', tracks: [0, 1, 2, 3, 4, 5, 6, 7].map(tr), idx: 0, src: null };
    try { updateNow(); updateLike(); } catch (e) { console.error(e.message) }
    lyState.id = 'id0'; lyState.lines = [{ t: 0, text: 'I like to feel like I am meant to be here', words: 'I like to feel like I am meant to be here'.split(' ').map((s, k) => ({ t: k * .3, s })) }, { t: 4, text: 'want u to say u need me' }, { t: 8, text: 'Каждый день как новый день' }, { t: 12, text: 'and the night is calling' }]; lyState.kind = 'synced';
    // фейковые данные главной
    lib.history = [0, 1, 2, 3, 4, 5].map(tr);
    lib.liked = [0, 1, 2, 3].map(tr);
    lib.playlists = [{ id: 'p1', name: 'Мой плейлист', tracks: [0, 1, 2].map(tr) }, { id: 'p2', name: 'Для бега', tracks: [3, 4].map(tr) }];
    try { renderSide && renderSide(); } catch (e) {}
  });
  if (extra) await p.evaluate(extra);
  if (process.env.DUMP) require('fs').writeFileSync(process.env.DUMP, await p.evaluate(() => window.__audit || ''));
  for (const s of list) {
    const [name, ...rest] = s.split(':'); const arg = rest.join(':');
    await p.evaluate(([name, arg]) => {
      try { if (document.body.classList.contains('lyonly')) lyStageOpen(false); } catch (e) {}
      try { closePP(); } catch (e) {} try { hideMenu(); closeModal(); } catch (e) {}
      if (name === 'pp') { openPP(); setMode(arg || 'cover'); setTab('next'); }
      else if (name === 'ppl') { openPP(); setMode('cover'); setTab('lyrics'); }
      else if (name === 'lys') lyStageOpen(true);
      else if (name === 'set') { lib.setTab = arg; go({ r: 'settings' }); }
      else if (name === 'eval') eval(arg);
      else if (name === 'q') go({ r: 'search', q: arg || 'midnight' });
      else if (name === 'artist') go({ r: 'browse', id: 'UC1' });
      else if (name === 'album') go({ r: 'browse', id: 'MPRE1' });
      else go({ r: name });
    }, [name, arg]);
    await p.waitForTimeout(1300);
    if (process.env.SCROLL) await p.evaluate(() => { const v = document.getElementById('view'); v.scrollTop = v.scrollHeight; }); await p.waitForTimeout(200);
    await p.screenshot({ path: `${dir}/${W}-${s.replace(/[^a-z0-9]+/gi, '_').slice(0, 30)}.png` });
  }
  console.log([...new Set(errs)].slice(0, 20).join('\n') || 'NO ERRORS'); await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
