// 2.0.10: чистка CSS — находит объявления, которые гарантированно перебиты позже тем же селектором в том же @media
// (то же свойство или его сокращение, не слабее по !important) и удаляет их. node cssdead.js [--apply]
const postcss = require('postcss'), fs = require('fs'), { chromium } = require('playwright');
const DIR = '/data/pulse/renderer/';
const ORDER = ['ds', 'style', 'pulse2', 'pulse3', 'settings', 'studio', 'clients', 'v203', 'v204', 'kara', 'gpu', 'refl', 'splash', 'anim', 'wave', 'spicy', 'lysbar', 'mineradio-host', 'ui'];
const SH = { margin: /^margin-(top|right|bottom|left)$/, padding: /^padding-(top|right|bottom|left)$/, inset: /^(top|right|bottom|left)$/, background: /^background-(color|image|position|size|repeat|attachment|origin|clip)$/,
  'border-radius': /^border-(top|bottom)-(left|right)-radius$/, transition: /^transition-(property|duration|timing-function|delay)$/, animation: /^animation-(name|duration|timing-function|delay|iteration-count|direction|fill-mode|play-state)$/,
  flex: /^flex-(grow|shrink|basis)$/, overflow: /^overflow-[xy]$/, gap: /^(row|column)-gap$/, outline: /^outline-(color|style|width)$/,
  border: /^border(-(top|right|bottom|left))?(-(color|style|width))?$/, 'border-top': /^border-top-(color|style|width)$/, 'border-bottom': /^border-bottom-(color|style|width)$/, 'border-left': /^border-left-(color|style|width)$/, 'border-right': /^border-right-(color|style|width)$/,
  'border-color': /^border-(top|right|bottom|left)-color$/, 'border-width': /^border-(top|right|bottom|left)-width$/, 'border-style': /^border-(top|right|bottom|left)-style$/,
  font: /^(font-(style|variant|weight|stretch|size|family)|line-height)$/, 'grid-template': /^grid-template-(rows|columns|areas)$/, 'place-items': /^(align|justify)-items$/, 'place-content': /^(align|justify)-content$/, 'list-style': /^list-style-(type|position|image)$/, 'text-decoration': /^text-decoration-(line|color|style)$/ };
const kills = (later, earlier) => later === earlier || (SH[later] && SH[later].test(earlier));
const ctxOf = (n) => { const c = []; for (let p = n.parent; p && p.type !== 'root'; p = p.parent) if (p.type === 'atrule') c.unshift('@' + p.name + ' ' + p.params.replace(/\s+/g, ' ')); else if (p.type === 'rule') c.unshift(p.selector); return c.join(' | '); };
(async () => {
  const roots = {}, D = [];
  for (const f of ORDER) { const p = DIR + f + '.css'; roots[f] = postcss.parse(fs.readFileSync(p, 'utf8'), { from: p });
    roots[f].walkDecls((d) => { const r = d.parent; if (!r || r.type !== 'rule') return; for (let p = r.parent; p; p = p.parent) if (p.type === 'atrule' && /keyframes/.test(p.name)) return;
      D.push({ f, d, sel: r.selector.replace(/\s+/g, ' ').trim(), ctx: ctxOf(r), prop: d.prop.toLowerCase(), imp: !!d.important }); }); }
  // проверить в Chromium, что «перебивающие» значения валидны (иначе браузер их выбросит и прежнее объявление живо)
  const b = await chromium.launch({ executablePath: require('child_process').execSync('which chromium').toString().trim(), args: ['--no-sandbox'] }); const pg = await b.newPage();
  const uniq = [...new Set(D.map((x) => x.prop + '\u0001' + x.d.value))];
  const ok = await pg.evaluate((L) => L.map((s) => { const [p, v] = s.split('\u0001'); return p.startsWith('--') || CSS.supports(p, v); }), uniq);
  const valid = new Map(uniq.map((s, i) => [s, ok[i]])); await b.close();
  const by = new Map(); D.forEach((x, i) => { x.i = i; const k = x.ctx + '\u0002' + x.sel; (by.get(k) || by.set(k, []).get(k)).push(x); });
  const dead = [];
  for (const L of by.values()) for (let i = 0; i < L.length; i++) { const e = L[i];
    for (let j = i + 1; j < L.length; j++) { const l = L[j]; if (!valid.get(l.prop + '\u0001' + l.d.value)) continue;
      if (kills(l.prop, e.prop) && (l.imp || !e.imp)) { dead.push(e); break; } } }
  const per = {}; dead.forEach((x) => (per[x.f] = (per[x.f] || 0) + 1));
  console.log('declarations', D.length, 'dead', dead.length, JSON.stringify(per));
  const imp = {}; D.forEach((x) => x.imp && (imp[x.f] = (imp[x.f] || 0) + 1)); console.log('important', JSON.stringify(imp));
  if (process.argv.includes('--list')) dead.slice(0, 40).forEach((x) => console.log(x.f, x.d.source.start.line, x.sel.slice(0, 60), x.prop));
  if (process.argv.includes('--apply')) {
    dead.forEach((x) => x.d.remove());
    let rules = 0; for (const f of ORDER) { roots[f].walkRules((r) => { if (!r.nodes.length) { r.remove(); rules++; } }); roots[f].walkAtRules((a) => { if (a.nodes && !a.nodes.length && !/keyframes|font-face/.test(a.name)) a.remove(); }); fs.writeFileSync(DIR + f + '.css', roots[f].toString()); }
    console.log('removed decls', dead.length, 'empty rules', rules);
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
