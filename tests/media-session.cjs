const test = require('node:test'), assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createMediaBridge, normalizeState } = require('../media-session');
function fixture() {
  const child = new EventEmitter(), commands = [], statuses = [], writes = [];
  child.stdin = new EventEmitter(); child.stdin.writable = true; child.stdin.write = data => { writes.push(JSON.parse(data)); return true; }; child.stdin.end = () => { child.emit('exit', 0); };
  child.stdout = new EventEmitter(); child.stdout.setEncoding = () => {}; child.stderr = new EventEmitter(); child.kill = () => { child.killed = true; };
  const bridge = createMediaBridge({ executable:'owned.exe', origin:'http://127.0.0.1:8765', platform:'win32', exists:() => true, spawnProcess:(file,args,options) => { assert.equal(file,'owned.exe'); assert.equal(options.shell,false); return child; }, onCommand:(...a) => commands.push(a), onStatus:s => statuses.push(s) });
  const emit = msg => child.stdout.emit('data', JSON.stringify(msg) + '\n');
  return { child, commands, statuses, writes, bridge, emit };
}
test('SMTC handshake replays latest state; command protocol is allowlisted', () => {
 const f = fixture(); f.bridge.update({has:true,title:'Тест',playing:true,dur:200,cur:8,art:'/img?u=test'}); f.bridge.start(); assert.equal(f.writes.length,0);
 f.emit({type:'command',command:'play'}); assert.equal(f.commands.length,0);
 f.child.stdout.emit('data','\uFEFF{"type":"rea'); f.child.stdout.emit('data','dy","protocol":1}\n');
 assert.equal(f.bridge.ready,true); assert.equal(f.writes[0].title,'Тест');
 f.emit({type:'command',command:'play'});f.emit({type:'command',command:'pause'});f.emit({type:'command',command:'seekSeconds',value:60});
 f.emit({type:'command',command:'win'});f.emit({type:'command',command:'seekSeconds',value:-1}); f.emit({type:'command',command:'seekSeconds',value:'60'}); f.emit(null);
 assert.deepEqual(f.commands,[['play',undefined],['pause',undefined],['seekSeconds',60]]); f.bridge.destroy();
});
test('SMTC state limits numeric values and only uses own local artwork endpoint', () => {
 const origin='http://127.0.0.1:123';
 let s=normalizeState({has:true,title:'x'.repeat(5000),dur:Infinity,cur:NaN,art:'https://evil.example/image'},origin);
 assert.equal(s.title.length,2048);assert.equal(s.artwork,'');assert.equal(s.dur,0);assert.equal(s.cur,0);
 s=normalizeState({has:true,dur:100,cur:999,art:'/offline/a.jpg'},origin);assert.equal(s.cur,100);assert.equal(s.artwork,origin+'/offline/a.jpg');
 assert.equal(normalizeState({art:'http://127.0.0.1:124/img'},origin).artwork,'');
});
test('SMTC backpressure keeps only newest pending state',()=>{
 const f=fixture();f.bridge.start();f.emit({type:'ready',protocol:1}); f.child.stdin.write = data => {f.writes.push(JSON.parse(data));return false;};
 f.bridge.update({title:'first'});f.bridge.update({title:'old'});f.bridge.update({title:'latest'});
 assert.equal(f.writes.length,1);f.child.stdin.emit('drain');assert.equal(f.writes[1].title,'latest');f.bridge.destroy();
});
test('oversized native output closes child and destroy cancels restart',()=>{
 const f=fixture();f.bridge.start();f.child.stdout.emit('data','x'.repeat(65537));assert.equal(f.bridge.ready,false);assert.equal(f.child.killed,true);assert.equal(f.statuses.at(-1).detail,'oversized-frame');f.bridge.destroy();
});
test('missing bridge and non-Windows do not spawn anything',()=>{
 let count=0; const b=createMediaBridge({platform:'win32',executable:'missing',origin:'http://127.0.0.1:1',exists:()=>false,spawnProcess:()=>count++,onCommand:()=>{}});b.start();assert.equal(count,0);b.destroy();
});

test('native bridge is built and packaged with source and licenses; Chromium remains fallback',()=>{
 const fs=require('node:fs'),pkg=require('../package.json');
 assert.ok(pkg.build.files.includes('media-session.js'));assert.ok(pkg.build.extraResources.some(r=>r.to==='media-bridge'));
 const cs=fs.readFileSync('native/media-bridge/Program.cs','utf8');assert.match(cs,/CommandManager.IsEnabled = false/);assert.match(cs,/SystemMediaTransportControls/);assert.doesNotMatch(cs,/player.Play\(/);
 assert.match(fs.readFileSync('NOTICE.md','utf8'),/## Windows media bridge/);assert.ok(fs.existsSync('native/media-bridge/licenses/CSWINRT-LICENSE.txt'));
});
test('main forwards only valid live player state into SMTC',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),src=fs.readFileSync('main.js','utf8');let handler;const states=[];
 const code=src.slice(src.indexOf("ipcOn('state',"),src.indexOf("ipcOn('lyrics',"));
 const c={ipcOn:(n,fn)=>handler=fn,lastState:null,quitting:false,mediaBridge:{update:s=>states.push(s)},widget:null,tray:null};vm.runInNewContext(code,c);
 handler({},null);assert.equal(states.length,0);handler({},{has:true,title:'Test'});assert.equal(states.length,1);c.quitting=true;handler({},{has:false});assert.equal(states.length,1);
});
test('native Play/Pause/seek commands reach the existing engine without toggle inversion',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),src=fs.readFileSync('renderer/app.js','utf8');const line=src.split('\n').find(s=>s.startsWith('pulse.onCommand('));let command;
 const c={pulse:{onCommand:f=>command=f},playing:false,toggles:0,pauses:0,positions:[],fsEscape(){},back(){},fwd(){},prev(){},toggleShuffle(){},cycleRepeat(){},
 toggle(){c.toggles++;c.playing=!c.playing;},next(){},E:{pause(){c.pauses++;c.playing=false;},dur:()=>200,seek:n=>c.positions.push(n)}};
 vm.runInNewContext(line,c);command('play');command('play');assert.equal(c.toggles,1);command('pause');command('pause');assert.equal(c.pauses,1);
 command('seekSeconds',250);command('seekSeconds',-2);command('seekSeconds',NaN);command('seekSeconds','10');assert.deepEqual(c.positions,[200,0]);
});
