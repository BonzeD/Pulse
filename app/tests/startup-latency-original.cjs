'use strict';
// Test-only inverse for historical controls; production never imports this file.
const crypto=require('node:crypto'),approved=require('./startup-latency-approved.json');
module.exports=(name,source)=>{
 source=require("./diagnostics-detail-original.cjs")(name,source);
 const row=approved[name];
 if(!row||crypto.createHash('sha256').update(source).digest('hex')!==row.sha256)return source;
 const lines=source.toString().match(/[^\n]*\n|[^\n]+$/g)||[];
 for(const patch of [...row.patches].reverse())lines.splice(patch.from,patch.to-patch.from,...patch.original);
 const original=lines.join('');
 if(crypto.createHash('sha256').update(original).digest('hex')!==row.originalSha256)throw Error('Startup inverse mismatch: '+name);
 return original;
};
