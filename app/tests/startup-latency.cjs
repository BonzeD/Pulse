'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {hedgedFallback}=require('../stream-race');
const {fixture}=require('./direct-stream-fixture.cjs');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const id='abcdefghijk';

test('fast verified direct result avoids a backup entirely',async()=>{
 let count=0;const race=hedgedFallback(async()=>({url:'direct'}),async()=>{count++;},{delay:15});
 assert.equal((await race.promise).url,'direct');await wait(25);assert.equal(count,0);
});
test('backup starts on deadline while a direct request is still pending; losing direct is aborted',async()=>{
 let aborted=false;const race=hedgedFallback(signal=>new Promise(resolve=>signal.addEventListener('abort',()=>{aborted=true;resolve(null);})),async()=>({url:'backup'}),{delay:15});
 assert.equal((await race.promise).url,'backup');assert.ok(aborted);
});
test('a rejected direct path starts backup immediately rather than waiting for the hedge timer',async()=>{
 const order=[];const race=hedgedFallback(async()=>{order.push('direct');return null;},async()=>{order.push('backup');return {url:'backup'};},{delay:60000});
 assert.equal((await race.promise).url,'backup');assert.deepEqual(order,['direct','backup']);
});
test('failed backup does not cancel a slower playable direct candidate',async()=>{
 const race=hedgedFallback(async()=>{await wait(40);return {url:'direct'};},async()=>{throw Error('backup unavailable');},{delay:5});
 assert.equal((await race.promise).url,'direct');
});
test('a later direct winner aborts an already running backup',async()=>{
 let killed=false;const race=hedgedFallback(async()=>{await wait(35);return {url:'direct'};},signal=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>{killed=true;reject(Error('cancelled'));})),{delay:5});
 assert.equal((await race.promise).url,'direct');assert.ok(killed);
});
test('hover remains direct-only; promotion after deadline starts backup without restarting direct',async()=>{
 let foreground=false,directCalls=0,backupCalls=0;const race=hedgedFallback(()=>{directCalls++;return new Promise(()=>{});},async()=>{backupCalls++;return {url:'backup'};},{delay:5,canBackup:()=>foreground});
 await wait(20);assert.equal(backupCalls,0);foreground=true;race.promote();
 assert.equal((await race.promise).url,'backup');assert.equal(directCalls,1);assert.equal(backupCalls,1);
});
test('all failures reject once; a hover miss never launches a subprocess',async()=>{
 const race=hedgedFallback(async()=>null,async()=>{throw Error('specific backup failure');},{delay:5});
 await assert.rejects(race.promise,/specific backup failure/);
 let calls=0;const hover=hedgedFallback(async()=>null,async()=>{calls++;},{canBackup:()=>false});
 assert.equal(await hover.promise,null);assert.equal(calls,0);
});
test('session abort cancels both contenders and settles even if jobs ignore cancellation',async()=>{
 const c=new AbortController();let signals=[];
 const race=hedgedFallback(s=>{signals.push(s);return new Promise(()=>{});},s=>{signals.push(s);return new Promise(()=>{});},{signal:c.signal,delay:5});
 await wait(20);c.abort();await assert.rejects(race.promise,/cancelled/);assert.equal(signals.length,2);assert.ok(signals.every(s=>s.aborted));
});
test('already aborted sessions perform no work',async()=>{
 const c=new AbortController();c.abort();let calls=0;
 const race=hedgedFallback(async()=>{calls++;},async()=>{calls++;},{signal:c.signal});
 await assert.rejects(race.promise,/cancelled/);assert.equal(calls,0);
});

test('real HTTP: slow direct APIs no longer serialize the working verified backup',async()=>{
 const h=await fixture({backup:true,backupDelay:20,behavior:[{apiDelay:3500},{apiDelay:3500},{apiDelay:3500}]});
 try{
  const url=await h.api.resolveStream(id);assert.ok(url.includes('/cdn/3'));
  const response=await fetch(h.origin+'/stream/'+id);assert.equal(response.status,206);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),h.bytes);
  assert.equal(h.events.filter(e=>e.kind==='backup').length,1);
  await wait(20);assert.ok(h.events.some(e=>e.kind==='api-closed'));
  await h.api.resolveStream(id);assert.equal(h.events.filter(e=>e.kind==='backup').length,1);
 }finally{await h.close();}
});
test('real HTTP: direct winner terminates hedged backup child, not the media stream',async()=>{
 const h=await fixture({backup:true,backupDelay:5000,behavior:[{apiDelay:1800},{apiDelay:1800},{apiDelay:1800}]});
 try{
  const url=await h.api.resolveStream(id);assert.ok(url.includes('/cdn/0'));
  assert.equal(h.events.filter(e=>e.kind==='backup').length,1);assert.ok(h.events.some(e=>e.kind==='backup-kill'));
  const response=await fetch(h.origin+'/stream/'+id);assert.deepEqual(Buffer.from(await response.arrayBuffer()),h.bytes);
 }finally{await h.close();}
});
test('real HTTP: a failing backup still allows a verified direct stream to win',async()=>{
 const h=await fixture({behavior:[{apiDelay:1750},{apiDelay:1750},{apiDelay:1750}]});
 try{assert.ok((await h.api.resolveStream(id)).includes('/cdn/0'));}finally{await h.close();}
});
test('real HTTP: foreground promotion reuses slow hover lookup and enables backup',async()=>{
 const h=await fixture({backup:true,behavior:[{apiDelay:3500},{apiDelay:3500},{apiDelay:3500}]});
 try{
  const hover=h.api.prefetch(id);await wait(1650);assert.equal(h.events.some(e=>e.kind==='backup'),false);
  assert.ok((await h.api.resolveStream(id)).includes('/cdn/3'));assert.equal(await hover,true);
  assert.equal(h.events.filter(e=>e.kind==='api').length,3);assert.equal(h.events.filter(e=>e.kind==='backup').length,1);
 }finally{await h.close();}
});
test('real HTTP: account revision aborts old direct requests and prevents stale cache writes',async()=>{
 const h=await fixture({backup:true,behavior:[{apiDelay:3500},{apiDelay:3500},{apiDelay:3500}]});
 try{
  const pending=h.api.resolveStream(id);const rejected=assert.rejects(pending,/cancelled/);await wait(20);
  h.setRevision(1);h.behavior.forEach(item=>item.apiDelay=0);
  assert.ok((await h.api.resolveStream('bcdefghijkl')).includes('/cdn/0'));await rejected;
  assert.equal(h.api.streams[id],undefined);assert.equal(h.events.filter(e=>e.kind==='backup').length,0);
 }finally{await h.close();}
});
test('startup delta reverses exactly to the supplied AdaptiveAudio source',()=>{
 const fs=require('fs'),path=require('path'),crypto=require('crypto'),manifest=require('./startup-latency-approved.json'),undo=require('./startup-latency-original.cjs');
 for(const [name,row] of Object.entries(manifest)){
  const source=require('./diagnostics-detail-original.cjs')(name,fs.readFileSync(path.join(__dirname,'..',name),'utf8'));
  assert.equal(crypto.createHash('sha256').update(source).digest('hex'),row.sha256,name);
  assert.equal(crypto.createHash('sha256').update(undo(name,source)).digest('hex'),row.originalSha256,name);
 }
});
