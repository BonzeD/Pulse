// Exact inverse of this requested easter egg, for historical comparisons only.
// Current behavior is exercised without inversion in prism-*-ui / prism-signal.
const crypto=require('node:crypto'),assert=require('node:assert/strict'),manifest=require('./prism-live-approved.json');
module.exports=(p,s)=>{s=require('./setup-debug-original.cjs')(p,s);const m=manifest[p];if(!m)return s;const hash=crypto.createHash('sha256').update(s).digest('hex');if(hash!==m.sha256)return s;const lines=s.toString().match(/[^\n]*\n|[^\n]+$/g)||[];for(const e of [...m.patches].reverse())lines.splice(e.from,e.to-e.from,...e.original);const out=lines.join('');assert.equal(crypto.createHash('sha256').update(out).digest('hex'),m.originalSha256);return out;};
