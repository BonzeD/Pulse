'use strict';
// Short-lived evidence, never credentials or persisted per-track browsing history.
function create({now=()=>Date.now(),clients=3,cooldown=120000}={}) {
 const rows=Array.from({length:clients},()=>({ids:new Map(),until:0}));let backupUntil=0;
 const reset=()=>{for(const r of rows){r.ids.clear();r.until=0;}backupUntil=0;};
 function blocked(ci){const r=rows[ci];if(!r)return false;if(r.until&&now()>=r.until){r.ids.clear();r.until=0;}return r.until>now();}
 function reject(ci,id){const r=rows[ci];if(!r||typeof id!=='string')return;blocked(ci);for(const [k,t]of r.ids)if(now()-t>=cooldown)r.ids.delete(k);r.ids.set(id,now());while(r.ids.size>4)r.ids.delete(r.ids.keys().next().value);if(r.ids.size>=2)r.until=now()+cooldown;}
 function success(ci){const r=rows[ci];if(r){r.ids.clear();r.until=0;}}
 const allBlocked=()=>rows.every((_,i)=>blocked(i));
 return {reject,success,blocked,allBlocked,reset,backupSuccess:()=>{backupUntil=now()+cooldown;},canWarm:()=>allBlocked()&&backupUntil>now()};
}
module.exports={create};
