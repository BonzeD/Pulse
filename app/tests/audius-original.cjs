// Exact inverse of Audius integration, only for historical baseline verification.
'use strict';
const crypto=require('node:crypto'),assert=require('node:assert/strict'),manifest=require('./audius-approved.json');
module.exports=(p,s)=>{s=require('./prism-live-original.cjs')(p,s);const m=manifest[p];if(!m)return s;const hash=crypto.createHash('sha256').update(s).digest('hex');if(hash===m.originalSha256)return s;assert.equal(hash,m.sha256,p+' Audius edit changed; review required');const lines=s.toString().match(/[^\n]*\n|[^\n]+$/g)||[];for(const e of [...m.patches].reverse())lines.splice(e.from,e.to-e.from,...e.original);const out=lines.join('');assert.equal(crypto.createHash('sha256').update(out).digest('hex'),m.originalSha256);return out;};
