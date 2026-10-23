const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const baseline=require('./stable-baseline.json');
for(const [file,hash] of Object.entries(baseline).filter(([file])=>!['renderer/spicy.js','renderer/lystage.js','renderer/viz.js','main.js','preload.js','offline.js','services.js'].includes(file)))test('Stable 2.0.12 unchanged: '+file,()=>assert.equal(crypto.createHash('sha256').update(file==='main.js'?read(file).replace(/  \/\/ 1\.0\.0 panel14: begin Pulse-only tray integration\n[\s\S]*?  \/\/ 1\.0\.0 panel14: end Pulse-only tray integration\n/,'').split('\n// 1.0.0: read-only tap')[0].replace('  tray.__pulseMenu = menu;\n',''):file==='renderer/shell.js'?read(file).replace("  if(e.target.closest?.('.media-dialog'))return;\n",''):file==='preload.js'?read(file).replace("  visualizerTap: (options) => ipcRenderer.invoke('visualizer:tap', options),\n",''):require('./final-original.cjs')(file,fs.readFileSync(path.join(root,file)))).digest('hex'),hash));
test('Playback retains reviewed safety fixes, YouTube fallback and explicit file-video hooks',()=>{
 const a=require('./audius-original.cjs')('renderer/app.js',read('renderer/app.js'));let expected=read('tests/stable-player.txt');
 const changes=[
  ['audio.src = `/offline/${encodeURIComponent(off[t.id].file)}`;', 'audio.src = fileAudioUrl(t);'],
  ['const t = curTrack(); setLoading(false);','const t = curTrack(), errorTok = loadTok; setLoading(false);'],
  ['if (at > 1) audio.currentTime = at;','if (errorTok === loadTok && at > 1) audio.currentTime = at;'],
  ['setTimeout(() => next(true), 700)','setTimeout(() => { if (errorTok === loadTok) next(true); }, 700)'],
  ['actx.resume(); audio.play().catch(() => {});','actx.resume().catch(() => {}); const playTok = loadTok; audio.play().catch(() => { if (playTok === loadTok) setLoading(false); });'],
  ['() => (audio.currentTime = start)','() => { if (tok === loadTok) audio.currentTime = start; }'],
  ['pulse.resolve(t.id).then((r) => {','Promise.resolve().then(() => pulse.resolve(t.id)).catch(e => ({ ok: false, error: String(e.message || e) })).then((r) => {'],
  ['setTimeout(() => next(true), 800)','setTimeout(() => { if (tok === loadTok) next(true); }, 800)']
 ];
 changes.push(
 ["// 2.0.4: в режиме «Видео» клип показываем и для скачанного трека (раньше играл файл, а на месте видео висел старый кадр с кнопкой Play)", "// 1.0.0: owned local/downloaded media always uses the file player, never a YouTube embed."],
 ["  const t = curTrack(), errorTok = loadTok; setLoading(false);", "  if (window.PulseFileVideo?.recover()) return; // file-video integration\n  const t = curTrack(), errorTok = loadTok; setLoading(false);"],
 ["play: () => { if (engine", "play: () => { window.PulseFileVideo?.intent(true); if(window.PulseFileVideo?.pending())return; /* file-video integration */ if (engine"],
 ["pause: () => { if (typeof djFinish", "pause: () => { window.PulseFileVideo?.intent(false); /* file-video integration */ if (typeof djFinish"],
 ["const tok = ++loadTok; setLoading(false);", "const tok = ++loadTok; window.PulseFileVideo?.reset(); /* file-video integration */ setLoading(false);"],
 ["if (off[t.id] && lib.mode === 'video' && ready && canEmbed(t) && online()) { useIframe(t, autoplay, start); return true; }", "if (off[t.id] && lib.mode === 'video' && window.PulseFileVideo) {\n      if (ready && engine === 'yt') try { player.stopVideo(); } catch {}\n      engine = 'audio'; audioTrackId = t.id; PulseFileVideo.load(t, autoplay, start, tok); return true;\n    }"]
 );
 for(const [oldStr,newStr]of changes){assert.ok(expected.includes(oldStr),oldStr);expected=expected.replace(oldStr,newStr);}
 assert.equal(a.slice(a.indexOf("onA('play',"),a.indexOf('window.onYouTubeIframeAPIReady')),expected);
});
test('Loading UI never uses the generic page loading class',()=>{const a=read('renderer/app.js');assert.match(a,/btnPlay'\)\.classList.toggle\('is-loading'/);assert.doesNotMatch(a,/btnPlay'\)\.classList.toggle\('loading'/);assert.match(read('renderer/style.css'),/play\.is-loading::after/);assert.doesNotMatch(read('renderer/wave.css'),/wave-hero\.loading/);});
test('Main bar is loaded after legacy panel styles; no experimental GPU module',()=>{const h=read('renderer/index.html');assert.ok(h.indexOf('mainbar.css')>h.indexOf('ui.css'));assert.match(h,/<body class="main-bar">/);assert.doesNotMatch(h,/gpu-renderer|release-fixes/);assert.match(read('renderer/lysbar.js'),/toggle\('main-bar', !B.classList.contains\('lyonly'\)\)/);});

test('Full-height content has no hard cut and retains safe bottom padding',()=>{const c=read('renderer/mainbar.css');assert.match(c,/\.view-surface\{display:block;position:fixed/);assert.match(c,/\.view\{bottom:0;scroll-padding-bottom:calc\(var\(--bar\) \+ 32px\)/);assert.match(c,/padding-bottom:calc\(var\(--bar\) \+ 48px\)/);assert.match(c,/\.side-list\{min-height:0;flex:1 1 0;margin-bottom:0;padding-bottom:104px/);assert.match(c,/\.pp\{padding-bottom:112px/);assert.match(read('renderer/index.html'),/class="view-surface" aria-hidden="true"/);});
test('Volume is inline, with hover and keyboard focus support, without a popup hitbox',()=>{const c=read('renderer/mainbar.css');assert.match(c,/position:static;inset:auto;width:0/);assert.match(c,/\.vol::before\{content:none\}/);assert.match(c,/\.vol:focus-within input/);assert.match(read('renderer/index.html'),/id="vol" aria-label="Громкость"/);});

test('Main player is a bordered pill without an outside content mask',()=>{const c=read('renderer/mainbar.css');assert.match(c,/background:rgba\(12,12,18,.68\)!important/);assert.match(c,/border:1px solid rgba\(255,255,255,.11\)!important/);assert.doesNotMatch(c,/mask-image|content-fade/);});

function mrSelector(source=read('renderer/mineradio-host.js')) {
 const begin=source.indexOf('playIdx: (i) => {')+'playIdx: '.length;
 const finish=source.indexOf('\n    // 2.0.12:',begin);
 const state={lib:{queue:{idx:0,tracks:[{id:'a'},{id:'b'},{id:'c'}]}},playing:true,off:{},bad:new Set(),calls:[],toggles:0,notices:[],connected:true};
 state.online=()=>state.connected;state.toast=t=>state.notices.push(t);state.failed=t=>state.bad.has(t.id);state.failedAt={delete:id=>state.bad.delete(id)};
 state.playIdx=i=>{state.calls.push(i);state.lib.queue.idx=i;state.playing=true;};state.toggle=()=>{state.toggles++;state.playing=!state.playing;};
 const fn=require('node:vm').runInNewContext('('+source.slice(begin,finish).trim().replace(/,$/,'')+')',state);return{state,fn};
}
test('MineRadio explicit selection retries a failed track; automatic skip does not block it',()=>{const{state:s,fn}=mrSelector();s.bad.add('b');assert.equal(fn(1),true);assert.deepEqual(s.calls,[1]);assert.equal(s.bad.has('b'),false);});
test('MineRadio repeated/double selection does not pause a playing track',()=>{const{state:s,fn}=mrSelector();fn(1);fn(1);assert.deepEqual(s.calls,[1]);assert.equal(s.toggles,0);assert.equal(s.playing,true);s.playing=false;fn(1);fn(1);assert.equal(s.toggles,1);assert.equal(s.playing,true);});
test('MineRadio invalid index and offline selection are safe; offline downloads still play',()=>{const{state:s,fn}=mrSelector();for(const i of [-1,999,'1',1.5])fn(i);assert.deepEqual(s.calls,[]);s.connected=false;assert.equal(fn(1),false);assert.equal(s.notices.length,1);s.off.b={};assert.equal(fn(1),true);assert.deepEqual(s.calls,[1]);});
test('MineRadio centered/side cards use one capture route and no expiring hover gate',()=>{const b=read('renderer/mineradio/pulse-bridge.js');assert.ok(b.includes('e.preventDefault(); e.stopImmediatePropagation();'));assert.ok(!b.includes('if (centered && !open) return'));assert.ok(!b.includes('!canUseSideShelfWithoutPinnedOpen()'));assert.ok(b.includes('e.detail > 1 && lastQueuePick'));assert.ok(read('renderer/mineradio/app.js').includes('playQueueAt: function () { return playQueueAt.apply(null, arguments); }'));});
test('Visible MineRadio cards remain selectable after hover expiry; double clicks and hidden cards are safe',()=>{
 const b=read('renderer/mineradio/pulse-bridge.js'),a=b.indexOf('  var lastQueuePick = null;'),z=b.indexOf('  // 2.0.12:',a);let listener,now=1000,ui=false;const calls=[],canvas={},card={index:0,mesh:{visible:true,material:{opacity:1},userData:{action:{kind:'playQueue',index:0}}}},sm={getMode:()=> 'side',hasOpenContent:()=>false,getCenterIdx:()=>0,scrollBy:()=>{}};
 const c={H:{playIdx:i=>calls.push(i)},W:{addEventListener:(_n,fn)=>listener=fn},safe:fn=>fn(),renderer:{domElement:canvas},shelfManager:sm,mouseDownAt:{hadDrag:false},isPointerOverUi:()=>ui,performance:{now:()=>now},raycasterFromPointerEvent:()=>({}),pointerCardHit:()=>({card}),shelfPinnedOpen:false,canUseSideShelfWithoutPinnedOpen:()=>false};
 require('node:vm').runInNewContext(b.slice(a,z),c);
 const ev=detail=>({target:canvas,detail,clientX:40,clientY:50,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}});
 let e=ev(1);listener(e);assert.deepEqual(calls,[0]);assert.equal(e.stopped,true);e=ev(2);listener(e);assert.deepEqual(calls,[0]);assert.equal(e.stopped,true);
 now+=1000;card.index=1;card.mesh.userData.action.index=1;listener(ev(1));assert.deepEqual(calls,[0,1]);card.mesh.material.opacity=0;listener(ev(1));assert.deepEqual(calls,[0,1]);card.mesh.material.opacity=1;c.mouseDownAt.hadDrag=true;listener(ev(1));assert.deepEqual(calls,[0,1]);c.mouseDownAt.hadDrag=false;ui=true;listener(ev(1));assert.deepEqual(calls,[0,1]);
});

// panel7 intentionally edits lysstage water filters/settings; lyric parsing and timing stay identical.
test('Lyrics timing, foreground marking and loop retain their reviewed behavior',()=>{
 const old=read('tests/lystage-panel6-reference.txt'),now=require('./lyric-ending-original.cjs')('renderer/lystage.js',read('renderer/lystage.js'));
 for(const [start,end] of [['function lysClick(', 'function lysRender('],['function lysMark(', '// 2.0.4: бэк-вокал'],['function lysSync(', 'const WHITE ='],['function lysLoop(', 'function lysCfgRows(']]){
  const a=old.indexOf(start),b=old.indexOf(end,a);assert.ok(a>=0);if(b>=0)assert.equal(now.slice(now.indexOf(start),now.indexOf(end,now.indexOf(start))),old.slice(a,b));
 }
});

// panel8 presentation/scheduling experiment: retain every preset's drawing algorithm.
test('Retained visual algorithms match panel7; removed presets and stationary ring are explicit',()=>{
 const old=read('tests/viz-panel7-reference.txt'),now=require('./final-original.cjs')('renderer/viz.js',read('renderer/viz.js'));
 const piece=s=>s.slice(s.indexOf('  const B = [];'),s.indexOf('  B.forEach((s) => REG.push(s));'));
 let expected = piece(old);
 for(const id of ['galaxy','orbit','flight','orbits']) expected=expected.replace(new RegExp("  B\\.push\\(\\{ id: '"+id+"',[^]*?(?=  B\\.push\\(|  //)"),'');
 expected=expected.replace(/    flight\(g, R\) \{[^]*?(?=    helix\(g, R\))/,'').replace('N = 128, rot = g.tick * (TAU / 64)','N = 128, rot = 0');
 assert.equal(piece(now).replace('      if (g.direct && g.directTransform) { c.f *= g.directTransform.k; c.ox += g.directTransform.sx; c.oy += g.directTransform.sy; }\n',''),expected);
});
test('MineRadio 3D renderer is unchanged from panel7',()=>{
 assert.equal(crypto.createHash('sha256').update(read('renderer/mineradio/app.js')).digest('hex'),'6bdc2bb00051daa30bc252a8918e1a03c48897a8f894a1a3474986f5557a00fa');
});

test('Spicy UI differs from stable only by reviewed project-auth changes',()=>{
 let expected=read('tests/spicy-project-reference.txt');
 assert.equal(crypto.createHash('sha256').update(expected).digest('hex'),baseline['renderer/spicy.js']);
 for(const [oldStr,newStr] of require('./spicy-project-changes.json')){assert.ok(expected.includes(oldStr));expected=expected.replace(oldStr,newStr);}
 assert.equal(read('renderer/spicy.js'),expected);
});
