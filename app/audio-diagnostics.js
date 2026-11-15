'use strict';
// Opt-in, bounded, enum-only audio diagnostics. Never export free-form errors.
const LIMIT=1000,MAX_BYTES=256000,MAX_MS=10*60*1000;
const STAGES=new Set(['mapping','capture','load','load-switch','play','pause','seek','metadata','data','canplay','playing','waiting','stalled','seeking','seeked','ended','media-error','resolve','cache','player-api','probe','backup','backup-queue','backup-runtime','backup-health','backup-download','backup-process','backup-spawned','backup-output','backup-url','client-policy','resolve-path','resolve-shared','prefetch-policy','format-policy','engine-policy','stream','upstream','first-byte','fallback']);
const SOURCES=new Set(['yt','am','sp','ad','local','audio','embedded','backup','unknown']);
const OUTCOMES=new Set(['start','end','ok','error','cancelled','timeout','denied','miss','hit','pending','stop','limit','clear','skipped']);
const REASONS=new Set(['eligible','track-rejected','policy-cooldown','network-cooldown','no-candidates','direct-start','backup-start','winner-direct','winner-backup','repeated-upstream-rejection','foreground-priority','aborted','consumer-closed','runtime-missing','runtime-unhealthy','runtime-ready','shared-foreground','shared-prefetch','hover-direct-only','next-direct-only','next-backup-eligible','next-warm-scheduled','warm-policy-changed','foreground-busy','target-cancelled','replaced-selection','probe-rejected','invalid-content','empty-body','http-error','no-url','bot-check','login-required','age-restricted','unavailable','geo-blocked','rate-limited','http-403','network-timeout','dns','tls','connection','extractor','js-runtime','runtime-broken','spawn-missing','spawn-denied','spawn-error','process-deadline','next-request','invalid-range','unsupported-format','backup-retry','invalid-output','embedded-first','embedded-ready-timeout','embedded-start-timeout','embedded-error','embedded-autoplay-blocked','mapping-error','background-resume','background-stall','background-ended','unknown']);
const ENUMS={channel:new Set(['stdout','stderr']),reason:REASONS,runtime:new Set(['updated','bundled','single-exe','path','bundled-ejs','remote-ejs']),purpose:new Set(['playback','analysis','unknown']),rangeKind:new Set(['none','open','bounded','suffix','invalid']),method:new Set(['GET','HEAD']),exitSignal:new Set(['SIGTERM','SIGKILL','SIGINT','unknown'])};
function classifyFailure(error){
 const code=error?.code||error?.cause?.code,text=String(typeof error==='string'?error:error?.message||'');
 if(error?.name==='AbortError'||/cancelled|canceled|aborted/i.test(text))return 'aborted';
 if(error?.name==='TimeoutError'||code==='ETIMEDOUT'||/TIMEOUT/.test(code||'')||/timed?\s*out|timeout/i.test(text))return 'network-timeout';
 if(code==='ENOENT')return 'spawn-missing';if(code==='EACCES'||code==='EPERM')return 'spawn-denied';
 if(['ENOTFOUND','EAI_AGAIN'].includes(code)||/getaddrinfo|name resolution|resolve.*host/i.test(text))return 'dns';
 if(/CERT|TLS|SSL/.test(code||'')||/certificate|ssl|tls/i.test(text))return 'tls';
 if(/not a bot|confirm.*not.*bot/i.test(text))return 'bot-check';
 if(/age.restrict|confirm your age|inappropriate/i.test(text))return 'age-restricted';
 if(/sign in|login.required|authentication|cookies.*required/i.test(text))return 'login-required';
 if(/country|geo.restrict|geo.block|region/i.test(text))return 'geo-blocked';
 if(/429|too many requests|rate.limit/i.test(text))return 'rate-limited';
 if(/403|forbidden/i.test(text))return 'http-403';
 if(/private video|unavailable|removed|not available/i.test(text))return 'unavailable';
 if(/javascript|js.runtime|ejs|signature|nsig/i.test(text))return 'js-runtime';
 if(/python|base_library|failed to load|fatal error/i.test(text))return 'runtime-broken';
 if(/extractor|unable to extract|unsupported url/i.test(text))return 'extractor';
 if(['ECONNRESET','ECONNREFUSED','EHOSTUNREACH','ENETUNREACH'].includes(code)||/connection|network|fetch failed/i.test(text))return 'connection';
 return 'unknown';
}
const noop=()=>{};noop.event=noop;noop.child=()=>noop;
function create({now=()=>performance.now(),wall=()=>new Date().toISOString(),onState=()=>{}}={}){
 let active=false,started=0,created=null,timer=null,rows=[],bytes=0,dropped=0,seq=0,operation=0,generation=0,tracks=new Map(),listeners=new Set();
 function state(){return {active,events:rows.length,dropped,maxEvents:LIMIT,maxBytes:MAX_BYTES,maxDurationSeconds:MAX_MS/1000};}
 function notify(){try{onState(state());}catch{}for(const fn of listeners)try{fn(state());}catch{}}
 function track(id){if(typeof id!=='string'||!id||id.length>256)return undefined;if(!tracks.has(id)){if(tracks.size>=128)return 'other';tracks.set(id,'T'+(tracks.size+1));}return tracks.get(id);}
 function event(stage,d={}){if(!active||!STAGES.has(stage)||!d||typeof d!=='object')return;const e={n:++seq,atMs:Math.max(0,Math.round((now()-started)*10)/10),stage};const ref=track(d.id);if(ref)e.track=ref;const previous=track(d.previousId);if(previous)e.previousTrack=previous;
  for(const k of ['load','operation','parentOperation','sharedOperation','attempt','elapsedMs','status','client','bytes','readyState','networkState','position','duration','code','formats','cooldownMs','rangeStart','rangeEnd','rangeTotal','contentLength','activeBackups'])if(Number.isFinite(d[k]))e[k]=Math.max(0,Math.min(1e12,Math.round(d[k]*100)/100));
  if(Number.isInteger(d.exitCode))e.exitCode=Math.max(-255,Math.min(65535,d.exitCode));
  for(const k of ['source','engine'])if(SOURCES.has(d[k]))e[k]=d[k];if(OUTCOMES.has(d.outcome))e.outcome=d.outcome;
  for(const k of ['autoplay','prefetch','authCookies','cacheHit','next','urlFound'])if(typeof d[k]==='boolean')e[k]=d[k];
  for(const [key,values]of Object.entries(ENUMS))if(values.has(d[key]))e[key]=d[key];
  if(typeof d.toolVersion==='string'&&/^\d{4}\.\d{2}\.\d{2}(?:\.\d{1,4})?$/.test(d.toolVersion))e.toolVersion=d.toolVersion;
  if(['OK','LOGIN_REQUIRED','UNPLAYABLE','ERROR','LIVE_STREAM_OFFLINE'].includes(d.playability))e.playability=d.playability;
  const size=Buffer.byteLength(JSON.stringify(e));while(rows.length&&(rows.length>=LIMIT||bytes+size>MAX_BYTES)){bytes-=Buffer.byteLength(JSON.stringify(rows.shift()));dropped++;}rows.push(e);bytes+=size;
 }
 function stop(outcome='stop'){if(!active)return read();event('capture',{outcome});active=false;clearTimeout(timer);timer=null;notify();return read();}
 function start(){if(active)return read();rows=[];bytes=dropped=seq=operation=0;tracks=new Map();generation++;created=wall();started=now();active=true;event('capture',{outcome:'start'});timer=setTimeout(()=>stop('limit'),MAX_MS);timer.unref?.();notify();return read();}
 function clear(){generation++;rows=[];bytes=dropped=0;tracks.clear();if(active)event('capture',{outcome:'clear'});return read();}
 function read(){return {pulseAudioLog:1,diagnosticsVersion:2,build:'Atlas-AudioRollback-EmbeddedFirst',created,...state(),note:'Relative times in ms. Track labels are local to this capture. Enum-only failure categories; no raw errors, stderr, track names, URLs, cookies, tokens or file paths.',events:rows.map(x=>({...x}))};}
 function begin(stage,data={}){if(!active)return noop;const capture=generation,op=++operation,t=now();event(stage,{...data,operation:op,outcome:'start'});let done=false;const valid=()=>active&&generation===capture;const finish=result=>{if(done||!valid())return;done=true;event(stage,{...data,...result,operation:op,elapsedMs:now()-t,outcome:result?.outcome||'end'});};Object.defineProperty(finish,'operation',{get:()=>valid()?op:undefined});finish.event=(s,d={})=>{if(valid())event(s,{...data,...d,parentOperation:op});};finish.child=(s,d={})=>valid()?begin(s,{...data,...d,parentOperation:op}):noop;return finish;}
 function alias(a,b){if(!active||typeof b!=='string'||!b||b.length>256||tracks.size>=128)return;const ref=track(a);if(ref)tracks.set(b,ref);}
 return {start,stop,clear,read,state,event,begin,alias,isActive:()=>active,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);}};
}
const recorder=create();module.exports={...recorder,create,classifyFailure};
