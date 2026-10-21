// 2.0.10: найти все правила, где селектор совпадает с регуляркой: node cssq.js 'regex' [files...]
const postcss = require('postcss'), fs = require('fs');
const ORDER = ['style', 'pulse2', 'pulse3', 'settings', 'studio', 'clients', 'v203', 'v204', 'kara', 'gpu', 'refl', 'splash', 'anim', 'wave', 'spicy', 'lysbar', 'mineradio-host', 'ui'];
const re = new RegExp(process.argv[2]);
for (const f of ORDER) { const p = '/data/pulse/renderer/' + f + '.css'; if (!fs.existsSync(p)) continue;
  postcss.parse(fs.readFileSync(p, 'utf8')).walkRules((r) => { if (r.parent.type === 'atrule' && /keyframes/.test(r.parent.name)) return; if (re.test(r.selector)) { const ctx = r.parent.type === 'atrule' ? '@' + r.parent.params + ' ' : ''; console.log(f + ':' + r.source.start.line + ' ' + ctx + r.selector.replace(/\s+/g, ' ').slice(0, 140) + ' { ' + r.nodes.map((d) => d.toString()).join(';').slice(0, 260) + ' }'); } }); }
