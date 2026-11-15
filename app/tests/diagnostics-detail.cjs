'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const trace=require('../audio-diagnostics'),{fixture}=require('./direct-stream-fixture.cjs');
const id='abcdefghijk',broken=[{playability:'LOGIN_REQUIRED'},{status:403},{status:403}],wait=ms=>new Promise(r=>setTimeout(r,ms));

test('v2 is opt-in, declares build/limits, and whitelists safe enums instead of free-form text',()=>{
 const r=trace.create();r.event('backup-process',{reason:'http-403'});assert.equal(r.read().events.length,0);r.start();
 r.event('backup-process',{id:'private-id',reason:'http-403',exitCode:-1,exitSignal:'SIGTERM',authCookies:true,url:'https://private/?token=SECRET',stderr:'SECRET',message:'SECRET',path:'C:/private',cookie:'SECRET',toolVersion:'2026.10.15'});
 r.event('client-policy',{reason:'https://private',runtime:'C:/private',channel:'SECRET',toolVersion:'token=SECRET',parentOperation:3});
 const log=r.stop();assert.equal(log.pulseAudioLog,1);assert.equal(log.diagnosticsVersion,2);assert.equal(log.maxEvents,1000);assert.equal(log.maxBytes,256000);
 assert.equal(log.events[1].reason,'http-403');assert.equal(log.events[1].exitCode,-1);assert.equal(log.events[1].toolVersion,'2026.10.15');assert.equal(log.events[2].reason,undefined);
 assert.ok(!/private-id|https:\/\/private|C:\/private|SECRET/.test(JSON.stringify(log)));
});
test('ring is bounded even with large diagnostics and tracks remain anonymous',()=>{
 const r=trace.create();r.start();for(let i=0;i<5000;i++)r.event('upstream',{id:'private-'+i,parentOperation:i,rangeStart:i,rangeEnd:i+20000,contentLength:20000,purpose:'analysis',reason:'consumer-closed',status:206,attempt:2,exitCode:-1,authCookies:true,toolVersion:'2026.10.15'});
 const log=r.stop();assert.ok(log.events.length<=1000);assert.ok(log.dropped>0);assert.ok(Buffer.byteLength(JSON.stringify(log))<258048);assert.ok(!JSON.stringify(log).includes('private-'));
});
test('children are correlated and cannot leak late events into a new capture',()=>{
 let ms=0;const r=trace.create({now:()=>ms});r.start();const parent=r.begin('backup',{id}),child=parent.child('backup-process');ms=12;child.event('backup-url',{outcome:'ok'});child({outcome:'ok',exitCode:0});
 let rows=r.read().events;assert.equal(rows.find(e=>e.stage==='backup-process'&&e.outcome==='start').parentOperation,parent.operation);assert.equal(rows.find(e=>e.stage==='backup-url').parentOperation,child.operation);
 r.stop();r.start();assert.equal(parent.operation,undefined);parent.event('backup-url');parent.child('backup-runtime')({outcome:'ok'});child({outcome:'error'});assert.equal(r.read().events.length,1);r.stop();
});
test('failure classifier returns categories only for network, authorization, tool and runtime errors',()=>{
 for(const [input,expected]of [
  ['ERROR: Sign in to confirm you are not a bot https://secret','bot-check'],['Please sign in','login-required'],['Confirm your age','age-restricted'],['HTTP Error 429: Too Many Requests','rate-limited'],['HTTP Error 403: Forbidden https://secret','http-403'],['Video unavailable','unavailable'],['No supported JavaScript runtime','js-runtime'],['Failed to load Python base_library.zip','runtime-broken'],['Audio preparation cancelled','aborted'],[{code:'ENOENT'},'spawn-missing'],[{code:'ENOTFOUND'},'dns'],[{code:'CERT_HAS_EXPIRED'},'tls'],[{name:'TimeoutError'},'network-timeout'],['private arbitrary secret','unknown']])assert.equal(trace.classifyFailure(input),expected);
});
test('real HTTP/mocked child: runtime preparation, URL-before-close and process exit have separate spans',async()=>{
 const h=await fixture({backup:true,backupScript:{runtimeDelay:25,urlDelay:20,closeDelay:100},behavior:structuredClone(broken)});trace.start();
 try{await h.api.resolveStream(id);const rows=trace.stop().events;const runtime=rows.find(e=>e.stage==='backup-runtime'&&e.outcome==='ok'),processStart=rows.find(e=>e.stage==='backup-process'&&e.outcome==='start'),url=rows.find(e=>e.stage==='backup-url'),exit=rows.find(e=>e.stage==='backup-process'&&e.outcome==='ok');
  assert.ok(runtime.elapsedMs>=15);assert.ok(processStart);assert.ok(rows.some(e=>e.stage==='backup-spawned'));assert.ok(url.atMs<exit.atMs);assert.equal(url.parentOperation,processStart.operation);assert.equal(exit.exitCode,0);assert.equal(exit.urlFound,true);assert.ok(rows.some(e=>e.stage==='resolve-path'&&e.reason==='winner-backup'));assert.ok(!JSON.stringify(rows).includes(h.origin));
 }finally{trace.stop();await h.close();}
});
test('403 subprocess failure exports category/exit but not stderr, URLs, cookies or paths',async()=>{
 const secret='ERROR HTTP Error 403 https://private.test/?token=SECRET cookie=SECRET C:/private/SECRET';
 const h=await fixture({backup:true,backupScript:{stderr:secret,exitCode:1},behavior:structuredClone(broken)});trace.start();
 try{await assert.rejects(h.api.resolveStream(id));const log=trace.stop();const e=log.events.find(e=>e.stage==='backup-process'&&e.outcome==='error');assert.equal(e.reason,'http-403');assert.equal(e.exitCode,1);assert.equal(e.urlFound,false);assert.ok(!/SECRET|private.test|C:\/private/.test(JSON.stringify(log)));assert.ok(log.events.some(e=>e.stage==='backup-output'&&e.channel==='stderr'));}finally{trace.stop();await h.close();}
});
test('cooldown skips are explicit instead of looking like instant unexplained prefetch errors',async()=>{
 const h=await fixture({backup:true,behavior:structuredClone(broken)});trace.start();
 try{await h.api.resolveStream(id);await h.api.resolveStream('bcdefghijkl');await h.api.prefetch('cdefghijklm');const rows=trace.stop().events;assert.ok(rows.some(e=>e.stage==='client-policy'&&e.reason==='policy-cooldown'));assert.ok(rows.some(e=>e.stage==='resolve-path'&&e.reason==='no-candidates'));assert.ok(rows.some(e=>e.stage==='prefetch-policy'&&e.reason==='hover-direct-only'));}finally{trace.stop();await h.close();}
});
test('concurrent callers identify the shared acquisition operation without another subprocess',async()=>{
 const h=await fixture({backup:true,backupScript:{urlDelay:10,closeDelay:80},behavior:structuredClone(broken)});trace.start();
 try{const a=h.api.resolveStream(id);await wait(10);const b=h.api.resolveStream(id);await Promise.all([a,b]);const rows=trace.stop().events;const shared=rows.find(e=>e.stage==='resolve-shared');assert.ok(shared.sharedOperation>0);assert.equal(shared.reason,'shared-foreground');assert.equal(h.events.filter(e=>e.kind==='backup').length,1);}finally{trace.stop();await h.close();}
});
test('range numbers and analysis purpose distinguish duplicate analysis requests from playback',async()=>{
 const h=await fixture({behavior:[{},{},{}]});trace.start();
 try{const response=await fetch(h.origin+'/stream/'+id,{headers:{Range:'bytes=44-99','X-Pulse-Audio-Purpose':'analysis'}});assert.equal((await response.arrayBuffer()).byteLength,56);await wait(15);const rows=trace.stop().events,stream=rows.find(e=>e.stage==='stream'&&e.outcome==='start');assert.equal(stream.purpose,'analysis');assert.equal(stream.rangeKind,'bounded');assert.equal(stream.rangeStart,44);assert.equal(stream.rangeEnd,99);const end=rows.find(e=>e.stage==='stream'&&e.outcome==='ok');assert.equal(end.bytes,56);assert.ok(rows.some(e=>e.stage==='upstream'&&e.parentOperation===stream.operation&&e.attempt===1));}finally{trace.stop();await h.close();}
});
test('bad probe content includes a safe reason, not the upstream body',async()=>{
 const h=await fixture({behavior:[{status:200,type:'text/html'},{empty:true},{}]});trace.start();
 try{await h.api.resolveStream(id);const rows=trace.stop().events;assert.ok(rows.some(e=>e.stage==='probe'&&e.reason==='invalid-content'));assert.ok(rows.some(e=>e.stage==='probe'&&e.reason==='empty-body'));}finally{trace.stop();await h.close();}
});
test('recording does not change request counts, winning source or received audio bytes',async()=>{
 const results=[];
 for(const active of [false,true]){const h=await fixture({behavior:[{status:403},{status:403},{}]});if(active)trace.start();try{const r=await fetch(h.origin+'/stream/'+id);assert.deepEqual(Buffer.from(await r.arrayBuffer()),h.bytes);results.push(h.events.filter(e=>e.kind==='api'||e.kind==='media').map(e=>({kind:e.kind,ci:e.ci,range:e.range})));}finally{trace.stop();await h.close();}}
 assert.deepEqual(results[0],results[1]);
});
test('selection changes preserve the old anonymous track reference without changing E calls',()=>{
 const sent=[];let enable,current={id:'first-private'},calls=0;
 const context={pulse:{dev:{audioEvent:m=>sent.push(m),onAudioState:f=>enable=f,audioState:()=>new Promise(()=>{})}},curTrack:()=>current,engine:'audio',E:{load(){calls++;return 7;},play(){},pause(){},seek(){}},decks:[],window:{},performance:{now:()=>0}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../renderer/audio-diagnostics.js'),'utf8'),context);enable({active:true});current={id:'second-private'};assert.equal(context.E.load(current,true),7);assert.equal(calls,1);const e=sent.find(e=>e.stage==='load-switch');assert.equal(e.data.previousId,'first-private');assert.equal(e.data.id,'second-private');
 const r=trace.create();r.start();r.event(e.stage,e.data);const log=r.stop();assert.ok(log.events.some(e=>e.previousTrack&&e.track!==e.previousTrack));assert.ok(!JSON.stringify(log).includes('private'));
});
test('embedded YouTube errors retain the numeric error code and diagnostic transport is still allowlisted',()=>{
 const app=fs.readFileSync(path.join(__dirname,'../renderer/app.js'),'utf8'),dev=fs.readFileSync(path.join(__dirname,'../dev-window.js'),'utf8');assert.match(app,/event\('media-error',\{engine:'embedded',code:Number\(e\?\.data\)\}\)/);assert.match(dev,/rendererStages=new Set\(\['capture','load','load-switch'/);
});
test('diagnostic production delta reverses exactly to the delivered StartupFix source',()=>{
 const crypto=require('node:crypto'),manifest=require('./diagnostics-detail-approved.json'),undo=require('./diagnostics-detail-original.cjs');for(const [name,row]of Object.entries(manifest)){const s=require('./reliability-original.cjs')(name,fs.readFileSync(path.join(__dirname,'..',name),'utf8'));assert.equal(crypto.createHash('sha256').update(s).digest('hex'),row.sha256,name);assert.equal(crypto.createHash('sha256').update(undo(name,s)).digest('hex'),row.originalSha256,name);}
});
