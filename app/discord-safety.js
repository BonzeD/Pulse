'use strict';
// Application ID is public; this integration never needs a bot token/client secret.
const text=(v,n)=>typeof v==='string'?v.replace(/[\x00-\x1f\x7f]/g,' ').slice(0,n):'';
function publicURL(v){if(typeof v!=='string'||v.length>2048)return null;try{const u=new URL(v);if(u.protocol!=='https:'||u.username||u.password||u.port)return null;const h=u.hostname.toLowerCase();if(!h.includes('.')||h.endsWith('.localhost')||h.endsWith('.local')||h.endsWith('.internal')||/^\d+\.\d+\.\d+\.\d+$/.test(h)||h.includes(':'))return null;return u.href;}catch{return null;}}
function normalizeActivity(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const out={type:[0,2,3].includes(value.type)?value.type:2,instance:false,status_display_type:[0,1,2].includes(value.status_display_type)?value.status_display_type:0};
 for(const k of ['details','state']){const v=text(value[k],128).trim();if(v)out[k]=v.length<2?v+' ':v;}
 const a=value.assets;if(a&&typeof a==='object'){const assets={};for(const k of ['large_image','small_image']){const v=text(a[k],2048);if(/^[\w-]{1,256}$/.test(v)||publicURL(v))assets[k]=v;}for(const k of ['large_text','small_text']){const v=text(a[k],128);if(v)assets[k]=v;}if(Object.keys(assets).length)out.assets=assets;}
 const times=value.timestamps;if(times&&typeof times==='object'){const t={};for(const k of ['start','end'])if(Number.isSafeInteger(times[k])&&times[k]>=0&&times[k]<8640000000000000)t[k]=times[k];if(Object.keys(t).length)out.timestamps=t;}
 if(Array.isArray(value.buttons)){const b=value.buttons.slice(0,2).map(v=>({label:text(v?.label,32).trim(),url:publicURL(v?.url)})).filter(v=>v.label&&v.url);if(b.length)out.buttons=b;}
 return out;
}
module.exports={normalizeActivity,publicURL};
