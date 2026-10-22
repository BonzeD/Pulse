const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8'),src=read('renderer/viz.js');
test('Deleted built-in styles have no Canvas or GPU implementation',()=>{for(const id of ['galaxy','orbit','orbits','flight']){assert.ok(!src.includes("id: '"+id+"'"));assert.ok(!src.includes('    '+id+'(g, R)'));}});
test('Wave smoothing reduces alternating spatial noise and does not mutate incoming audio',()=>{
 const c={Float32Array,Math};vm.createContext(c);vm.runInContext(src.slice(src.indexOf('  function stableWave('),src.indexOf('  function draw(o)'))+'\nthis.smooth=stableWave;',c);
 const input=Uint8Array.from([0,255,0,255,0,255,0,255]),copy=Uint8Array.from(input),st={};c.smooth(input,st,1/60);const out=c.smooth(input,st,.2);
 assert.deepEqual(input,copy);assert.ok(out[3]-out[4]<130);assert.ok(out.every(v=>v>=0&&v<=255));
 assert.equal(c.smooth(null,st,.02),null);assert.equal(st.waveSmooth,null);
});
test('Temporal smoothing has the same response at 30, 60 and 144 Hz',()=>{
 const c={Float32Array,Math};vm.createContext(c);vm.runInContext(src.slice(src.indexOf('  function stableWave('),src.indexOf('  function draw(o)'))+'\nthis.smooth=stableWave;',c);
 const result=hz=>{const st={};c.smooth(new Uint8Array(16).fill(128),st,1/hz);for(let i=0;i<hz;i++)c.smooth(new Uint8Array(16).fill(255),st,1/hz);return st.waveSmooth[8];};
 assert.ok(Math.abs(result(30)-result(144))<.001);assert.ok(result(60)>254);
});
test('Ring frequency bars do not orbit as musical time advances',()=>{
 const c={performance:{now:()=>1000},Float32Array,Math,console};vm.createContext(c);vm.runInContext(src+'\nthis.ring=Viz.STYLES.find(s=>s.id==="ring");',c);
 const draw=tick=>{const lines=[];const ctx={createRadialGradient:()=>({addColorStop(){}}),beginPath(){},arc(){},fill(){},moveTo(x,y){lines.push([x,y]);},lineTo(x,y){lines.push([x,y]);},stroke(){}};
 c.ring.draw({ctx,cx:300,cy:200,R:90,tick,pos:tick,mix:()=>'',bass:.3,beat:.3,state:{},beatN:1,playing:false,dt:1/60,speed:1});return lines;};
 assert.deepEqual(draw(0),draw(32));
});
test('Wave filters are scoped to the requested styles, audio engine stays untouched',()=>{assert.match(src,/S.id === 'wave' \|\| S.id === 'scope'/);assert.match(src,/g.wave = stableWave\(o.wave, g.state, dt\)/);assert.doesNotMatch(read('renderer/ui-fixes.js'),/\bE\.(load|play|pause|seek)\s*\(/);});
test('No edge control remains in settings, editor, or quick effects',()=>{for(const f of ['renderer/custom.js','renderer/editor.js'])assert.ok(!read(f).includes('viz.edge'));const a=read('renderer/app.js');assert.ok(!a.includes("seg('viz.edge'"));assert.match(a,/delete s.viz.edge/);});
test('Legacy galaxy icon id is retained for plugins but depicts connected stars',()=>{const h=read('renderer/index.html'),symbol=h.match(/<symbol id="i-v-galaxy"[^]*?<\/symbol>/)[0];assert.equal((symbol.match(/<circle /g)||[]).length,4);assert.ok(!symbol.includes('M12 12c'));assert.ok(h.includes('id="vizFx"'));assert.ok(!h.includes('id="vizLySrc"'));assert.match(read('renderer/custom.js'),/\$\('vizFx'\)\.onclick/);});
test('Cover reflection uses original width, rounded geometry and no horizontal stretching',()=>{const s=read('renderer/cover-water.js'),c=read('renderer/cover-water.css');assert.match(s,/ctx.roundRect\(0,0,width,width,radii\)/);assert.match(s,/shift\+glitch,y,width,2.3/);assert.match(c,/left:0;right:0/);assert.doesNotMatch(s,/width\+pad\*2/);});
test('Sidebar motion is interruptible, keyboard resize and bar recovery remain accessible',()=>{const s=read('renderer/ui-fixes.js');for(const part of ['getBoundingClientRect','cancelMotion','setPointerCapture','pointercancel','aria-valuenow','ArrowLeft','btnBarShow','prefers-reduced-motion'])assert.ok(s.includes(part));});

test('Lyric layout changes are rolled back; no overrides of scroll, inner or text reflection remain',()=>{const s=read('renderer/ui-fixes.css');for(const part of ['.ly-scroll','.ly-inner','.ly-gap','.lys-water','.lys-refl'])assert.ok(!s.includes(part));});
test('Settings rendering contains synchronous failures and optional preview has a safe boundary',()=>{const s=read('renderer/app.js');assert.match(s,/try \{ sync = P.sync/);assert.match(s,/Optional app preview/);assert.match(read('renderer/editor.js'),/typeof account.name === 'string'/);});
test('Main musical viewport is separate from 2D overscan and GPU uses logical pixel ratio',()=>{assert.match(src,/cv.id === 'viz' && cv.parentElement.id === 'stage'/);assert.match(src,/o.artRect.x - OX/);assert.match(src,/gpuRenderer.begin\(W, H, DPR\)/);assert.match(src,/ctx.clearRect\(0, 0, cv.width, cv.height\)/);});

test('Visual fade accounts for overscan and fades inside the stage on both rendering paths',()=>{const c=read('renderer/ui-fixes.css');assert.match(c,/--viz-inset:64px/);assert.match(c,/--viz-inset:0px/);assert.match(c,/transparent calc\(100% - var\(--viz-inset/);});
test('Player exit animates before hiding; hover zone does not swallow clicks and keyboard recovery remains',()=>{const c=read('renderer/ui-fixes.css'),s=read('renderer/ui-fixes.js');assert.match(c,/visibility 0s 380ms/);assert.match(c,/translate 380ms/);assert.match(c,/#barRevealZone\{[^}]*pointer-events:none/);assert.match(c,/#barRevealZone:focus-within/);assert.match(s,/innerHeight - 104/);assert.match(s,/e.detail === 0/);assert.match(s,/setBar\(!S\(\).ui.playerBarHidden, true\)/);});
