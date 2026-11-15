'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{EventEmitter}=require('node:events');
const {fixture}=require('./direct-stream-fixture.cjs'),trace=require('../audio-diagnostics'),id='abcdefghijk',broken=()=>[{playability:'ERROR'},{playability:'ERROR'},{playability:'ERROR'}];
const wait=ms=>new Promise(r=>setTimeout(r,ms));

test('actual stable 1.0.2 source renews a denied backup URL inside one playback HTTP request',async()=>{
 const h=await fixture({stable102:true,backup:true,behavior:[...broken(),{statuses:[403,206]}]});try{const r=await fetch(h.origin+'/stream/'+id);assert.equal(r.status,206);assert.deepEqual(Buffer.from(await r.arrayBuffer()),h.bytes);assert.equal(h.events.filter(e=>e.kind==='backup').length,2);}finally{await h.close();}
});
test('negative control reproduces AudioDiagnostics2 regression: one rejected backup probe becomes failed playback',async()=>{
 const h=await fixture({beforeReliability:true,backup:true,behavior:[...broken(),{statuses:[403,206]}]});try{const r=await fetch(h.origin+'/stream/'+id);assert.equal(r.status,502);await r.text();assert.equal(h.events.filter(e=>e.kind==='backup').length,1);}finally{await h.close();}
});
test('renew the first 403 backup URL before exposing failure; same request returns exact audio',async()=>{
 const h=await fixture({backup:true,behavior:[...broken(),{statuses:[403,206]}]});trace.start();try{const r=await fetch(h.origin+'/stream/'+id);assert.equal(r.status,206);assert.deepEqual(Buffer.from(await r.arrayBuffer()),h.bytes);assert.equal(h.events.filter(e=>e.kind==='backup').length,2);assert.ok(trace.read().events.some(e=>e.reason==='backup-retry'&&e.attempt===2));assert.equal(h.api.streams[id].verified,4);}finally{trace.stop();await h.close();}
});
test('permanent denial is bounded to two backup extractions, is never cached and never forwarded as audio',async()=>{
 const h=await fixture({backup:true,behavior:[...broken(),{status:403}]});try{const r=await fetch(h.origin+'/stream/'+id);assert.equal(r.status,502);await r.text();assert.equal(h.events.filter(e=>e.kind==='backup').length,2);assert.equal(h.api.streams[id],undefined);}finally{await h.close();}
});
test('backup JSON carries selected User-Agent and Referer through probe AND actual proxy, not generic UA',async()=>{
 const headers={'User-Agent':'Fixture selected UA','Referer':'https://www.youtube.com/','Cookie':'SECRET','Authorization':'SECRET','X-Arbitrary':'SECRET'};
 const h=await fixture({backup:true,backupScript:{urlDelay:5,closeDelay:15,headers},behavior:[...broken(),{requireUA:headers['User-Agent'],requireReferer:headers.Referer}]});trace.start();try{const r=await fetch(h.origin+'/stream/'+id);assert.equal(r.status,206);assert.deepEqual(Buffer.from(await r.arrayBuffer()),h.bytes);const calls=h.events.filter(e=>e.kind==='media'&&e.ci===3);assert.ok(calls.length>=2);assert.ok(calls.every(e=>e.ua===headers['User-Agent']&&e.referer===headers.Referer));assert.equal(h.api.streams[id].headers.cookie,undefined);assert.equal(h.api.streams[id].headers.authorization,undefined);assert.ok(!/SECRET|Fixture selected|https:\/\//.test(JSON.stringify(trace.read())));}finally{trace.stop();await h.close();}
});
test('persist only safe media headers and restore them with a current verified cache entry',async()=>{
 const h=await fixture({backup:true,backupScript:{urlDelay:1,closeDelay:10,headers:{'User-Agent':'Persist UA','Referer':'https://www.youtube.com/','Cookie':'SECRET'}},behavior:broken()});try{await h.api.resolveStream(id);await wait(1600);const row=h.written()[id];assert.equal(row.headers['user-agent'],'Persist UA');assert.equal(row.headers.cookie,undefined);assert.equal(row.verified,4);const h2=await fixture({stored:{[id]:row}});try{assert.equal(await h2.api.resolveStream(id),row.url);assert.equal(h2.api.streams[id].headers['user-agent'],'Persist UA');assert.equal(h2.events.length,0);}finally{await h2.close();}}finally{await h.close();}
});
test('old verified-v3 URL cache is ignored instead of resurrecting an already-broken fragment stream',async()=>{
 const h=await fixture({stored:{[id]:{url:'https://invalid.test/old',verified:3,exp:Date.now()+3600000}}});try{const url=await h.api.resolveStream(id);assert.ok(url.startsWith(h.origin));assert.equal(h.api.streams[id].verified,4);}finally{await h.close();}
});
test('negative control accepts inconsistent 206 content ranges from the bad direct client',async()=>{
 const h=await fixture({beforeReliability:true,behavior:[{badRange:true},{},{}]});try{assert.ok((await h.api.resolveStream(id)).includes('/cdn/0'));}finally{await h.close();}
});
test('inconsistent range metadata cannot win the direct race; a consistent alternate plays',async()=>{
 const h=await fixture({behavior:[{badRange:true},{},{}]});trace.start();try{const r=await fetch(h.origin+'/stream/'+id);assert.equal(r.status,206);assert.deepEqual(Buffer.from(await r.arrayBuffer()),h.bytes);assert.ok(h.api.streams[id].url.includes('/cdn/1'));assert.ok(trace.read().events.some(e=>e.reason==='invalid-range'));}finally{trace.stop();await h.close();}
});
test('DVR targetDurationSec and missing static-format length cannot beat a seekable song',async()=>{
 const h=await fixture({behavior:[{format:{targetDurationSec:5}},{format:{contentLength:null}},{}]});trace.start();try{assert.ok((await h.api.resolveStream(id)).includes('/cdn/2'));assert.equal(h.events.some(e=>e.kind==='media'&&e.ci<2),false);assert.ok(trace.read().events.some(e=>e.stage==='format-policy'&&e.reason==='unsupported-format'));}finally{trace.stop();await h.close();}
});
test('all direct live fragments fall back to a compatible yt-dlp file instead of being called playable',async()=>{
 const h=await fixture({backup:true,behavior:[0,1,2].map(()=>({format:{targetDurationSec:5}}))});try{assert.ok((await h.api.resolveStream(id)).includes('/cdn/3'));assert.equal(h.events.filter(e=>e.kind==='backup').length,1);}finally{await h.close();}
});
test('unsupported HLS extractor URL is not fed to an MP4 range proxy',async()=>{
 const h=await fixture({backup:true,backupScript:{urlDelay:1,closeDelay:10,info:{protocol:'m3u8_native'}},behavior:broken()});trace.start();try{await assert.rejects(h.api.resolveStream(id));assert.ok(trace.read().events.some(e=>e.reason==='unsupported-format'));assert.equal(h.events.some(e=>e.kind==='media'),false);}finally{trace.stop();await h.close();}
});
test('HEAD playback still returns valid headers without rejecting the intentionally empty body',async()=>{
 const h=await fixture({behavior:[{},{},{}]});try{const r=await fetch(h.origin+'/stream/'+id,{method:'HEAD'});assert.equal(r.status,206);assert.equal((await r.arrayBuffer()).byteLength,0);assert.equal(Number(r.headers.get('content-length')),h.bytes.length);}finally{await h.close();}
});
function nativeClipboard({before=false}={}){
 const handlers=new Map(),app=new EventEmitter();let dev,copied='',broken=false;
 class W extends EventEmitter{constructor(){super();this.webContents={mainFrame:{url:'http://127.0.0.1:47831/index.html'},send(){},setWindowOpenHandler(){},on(){}};this.destroyed=false;}isDestroyed(){return this.destroyed;}loadURL(url){dev=this;this.webContents.mainFrame.url=url;}show(){}focus(){}close(){this.destroyed=true;this.emit('closed');}destroy(){this.close();}}
 const main=new W(),ipcMain={handle:(k,f)=>handlers.set(k,f),on(){}},clipboard={writeText(text){if(broken)throw Error('private OS error');copied=text;}},safety={appURL:()=>true,lockNavigation(){}},options={app,BrowserWindow:W,ipcMain,clipboard,path,safety,getMain:()=>main,getPort:()=>47831};
 if(before){const Module=require('module'),m=new Module(path.join(__dirname,'../dev-window.js'),module);m.filename=path.join(__dirname,'../dev-window.js');m.paths=module.paths;m._compile(require('./reliability-original.cjs')('dev-window.js',fs.readFileSync(m.filename,'utf8')),m.filename);m.exports(options);}else require('../dev-window')(options);
 const event=w=>({sender:w.webContents,senderFrame:w.webContents.mainFrame});handlers.get('dev:open')(event(main));
 return {handlers,app,main,dev,event,copied:()=>copied,fail:()=>broken=true,close:()=>app.emit('before-quit')};
}
function largeLog(){trace.start();for(let i=0;i<999;i++)trace.event('backup-process',{id:'PRIVATE-ID',operation:i,parentOperation:i,elapsedMs:i,authCookies:true,runtime:'bundled-ejs',reason:'network-timeout',exitCode:1});trace.stop();const json=JSON.stringify(trace.read());assert.ok(json.length>65536);return json;}
test('negative control: original native clipboard rejects a large, otherwise valid diagnostics export',()=>{const h=nativeClipboard({before:true});try{const json=largeLog();assert.equal(h.handlers.get('dev:copy')(h.event(h.dev),json),false);assert.equal(h.copied(),'');}finally{h.close();}});
test('native audioCopy exports a full bounded log without lifting the generic 64K copy limit or frame checks',async()=>{
 const h=nativeClipboard();try{const json=largeLog();assert.deepEqual(await h.handlers.get('dev:request')(h.event(h.dev),'audioCopy'),{ok:true});assert.equal(h.copied(),json);assert.equal(JSON.parse(h.copied()).events.length,1000);assert.ok(!h.copied().includes('PRIVATE-ID'));assert.equal(h.handlers.get('dev:copy')(h.event(h.dev),json),false);await assert.rejects(h.handlers.get('dev:request')(h.event(h.main),'audioCopy'),/Untrusted/);await assert.rejects(h.handlers.get('dev:request')({...h.event(h.dev),senderFrame:{url:h.dev.webContents.mainFrame.url}},'audioCopy'),/Untrusted/);h.fail();assert.deepEqual(await h.handlers.get('dev:request')(h.event(h.dev),'audioCopy'),{error:'clipboard-unavailable'});}finally{h.close();}
});
test('reliability changes reverse byte-for-byte to AudioDiagnostics2 and stable-source fixture is pinned',()=>{
 const manifest=require('./reliability-approved.json'),undo=require('./reliability-original.cjs');for(const[name,row]of Object.entries(manifest)){const s=require('./embedded-first-original.cjs')(name,fs.readFileSync(path.join(__dirname,'..',name),'utf8'));assert.equal(crypto.createHash('sha256').update(s).digest('hex'),row.sha256,name);assert.equal(crypto.createHash('sha256').update(undo(name,s)).digest('hex'),row.originalSha256,name);}
 const stable=fs.readFileSync(path.join(__dirname,'fixtures/stable-102-offline.txt'));assert.equal(crypto.createHash('sha256').update(stable).digest('hex'),require('./stable-102-source.json').offlineSha256);
});
