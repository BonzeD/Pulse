'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function pacer(){return vm.runInNewContext(fs.readFileSync('renderer/frame-pacer.js','utf8')+';PulseFramePacer.create()');}
for(const hz of [60,120,144,165,240])for(const fps of [30,60,120,144])test(`phase gate ${fps} FPS on ${hz} Hz does not drift or exceed refresh`,()=>{
 const p=pacer(),hits=[];for(let i=0;i<hz*10;i++){const t=i*1000/hz;if(p.due(t,1000/fps))hits.push(t);}
 const expected=Math.min(hz,fps)*10;assert.ok(Math.abs(hits.length-expected)<=1,`${hits.length} vs ${expected}`);
 if(fps<=hz){const intervals=hits.slice(1).map((t,i)=>t-hits[i]);assert.ok(Math.max(...intervals)-Math.min(...intervals)<=1000/hz+.001);}
});
test('phase gate keeps cadence under jitter, no burst after a stall',()=>{const p=pacer();let n=0;for(let i=0;i<1440;i++)if(p.due(i*1000/144+Math.sin(i)*.025,1000/60))n++;assert.ok(Math.abs(n-600)<=1);assert.equal(p.due(30000,1000/60),true);assert.equal(p.due(30000,1000/60),false);assert.equal(p.due(30001,1000/60),false);});
test('reset, backwards clock, cap changes and unlimited are safe',()=>{const p=pacer();assert.equal(p.due(0,1000/30),true);assert.equal(p.due(4,1000/30),false);assert.equal(p.due(5,1000/120),true);assert.equal(p.due(6,1000/120),false);p.reset();assert.equal(p.due(6,1000/120),true);assert.equal(p.due(0,1000/120),true);assert.equal(p.due(NaN,12),false);for(let i=1;i<100;i++)assert.equal(p.due(i,0),true);});
test('direct visual uses caller RAF, handles visibility, caps and fallback',()=>{
 const settings={viz:{sens:100,fx:{},tempo:true},perf:{mode:'high',fps:120}},draws=[];let hide=0;
 const c={window:{},performance:{now:()=>1000},S:()=>settings,lib:{vizStyle:'coverfield',mode:'visual'},ppOpenNow:true,lyOnlyNow:false,mrOnNow:false,hiddenNow:false,document:{hidden:false},winFocused:true,Viz:{canDirect:()=>true,hideDirect:()=>hide++,draw:o=>draws.push(o),stats:()=>({})},readSpectrum:()=>null,heard:()=>0,outLat:()=>0,tempoAt:()=>({}),artRect:()=>null,stageCenter:()=>({x:100,y:100}),playing:true,beat:.2,actx:null,coverImg:null,beatState:{},console};
 vm.createContext(c);vm.runInContext(fs.readFileSync('renderer/frame-pacer.js','utf8')+'\n'+fs.readFileSync('renderer/visual-experiment.js','utf8')+'\nthis.V=VisualExperiment;',c);
 for(let i=0;i<144;i++)c.V.sync(i*1000/144);assert.equal(draws.length,120);assert.ok(draws.every(x=>x.direct));
 c.hiddenNow=true;assert.equal(c.V.sync(1001),false);assert.equal(hide,1);assert.equal(c.V.sync(1002),false);assert.equal(hide,1);
 c.hiddenNow=false;assert.equal(c.V.sync(1003),true);c.lib.mode='cover';assert.equal(c.V.sync(1004),false);assert.equal(hide,2);
 assert.doesNotMatch(fs.readFileSync('renderer/visual-experiment.js','utf8'),/requestAnimationFrame|cancelAnimationFrame/);
});
test('single RAF reads direct geometry before DOM updates and retains lyric cadence',()=>{const s=fs.readFileSync('renderer/app.js','utf8').split('function frame(now) {')[1].split('requestAnimationFrame(frame);\n// центр')[0];assert.ok(s.indexOf('VisualExperiment.sync(now)')<s.indexOf('mainFramePacer.due'));assert.equal((s.match(/lyricsFrame\(/g)||[]).length,3);const directBlock=s.split('  if (visualExperiment) {')[1].split('  liteTick')[0];assert.match(directBlock,/if \(playing \|\| dragging/);assert.doesNotMatch(directBlock,/!visualExperiment/);assert.ok(s.indexOf('VisualExperiment.sync(now)')<s.indexOf('lyricsFrame('));assert.ok(s.indexOf('mainFramePacer.due')<s.lastIndexOf('lyricsFrame('));assert.doesNotMatch(s,/1000 \/ P.fps - 2/);});
