'use strict';
// Exact test-only inverse of diagnostics v2; never used by production.
const crypto=require('node:crypto'),approved=require('./diagnostics-detail-approved.json');
module.exports=(name,source)=>{
 source=require('./reliability-original.cjs')(name,source);
 const row=approved[name];if(!row||crypto.createHash('sha256').update(source).digest('hex')!==row.sha256)return source;
 const lines=source.toString().match(/[^\n]*\n|[^\n]+$/g)||[];
 for(const patch of [...row.patches].reverse())lines.splice(patch.from,patch.to-patch.from,...patch.original);
 const original=lines.join('');if(crypto.createHash('sha256').update(original).digest('hex')!==row.originalSha256)throw Error('Diagnostics inverse mismatch: '+name);return original;
};
