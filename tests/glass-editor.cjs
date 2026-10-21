'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
const M=require('../renderer/glass-presets');
test('material presets normalize untrusted data, preserve defaults and bound every numeric option',()=>{assert.equal(M.defaults().ior,1.5);assert.equal(M.presets.length,7);for(const [key,[lo,hi]]of Object.entries(M.limits)){assert.equal(M.normalize({[key]:-1e9})[key],lo,key);assert.equal(M.normalize({[key]:1e9})[key],hi,key);assert.equal(M.normalize({[key]:null})[key],M.defaults()[key],key);}assert.equal(M.normalize({tintColor:'url(evil)',glowColor:'#11aaff',refraction:'yes'}).tintColor,M.defaults().tintColor);assert.equal(M.normalize({glowColor:'#11aaff'}).glowColor,'#11aaff');assert.equal(M.normalize({refraction:'no'}).refraction,true);assert.equal(M.normalize({fake:4}).fake,undefined);for(const[id]of M.presets)assert.equal(M.builtIn(id).preset,id);});
test('preset JSON import accepts plain settings only, clamps values and limits saved profiles',()=>{for(const input of [null,{},[],{format:'other',version:1,settings:{}},{format:'pulse-liquid-glass',version:2,settings:{}},{format:'pulse-liquid-glass',version:1,settings:[]}])assert.throws(()=>M.importData(input));const p=M.importData({format:'pulse-liquid-glass',version:1,name:'x'.repeat(100),settings:{strength:999}});assert.equal(p.name.length,48);assert.equal(p.settings.strength,180);assert.equal(M.customs(Array.from({length:25},(_,i)=>({id:'a'+i,name:'Saved',settings:{}}))).length,20);assert.equal(M.customs([null,{id:'x',name:''}]).length,0);});
function cadence(playing,reduced=false,eco=false){let cb,frames=0,seq=0;const settings={ui:{},look:{anim:!reduced},ly:{kWorld:'sakura',kSceneQuality:eco?'eco':'balanced'},viz:{lag:0},perf:{fps:60,gpu:true,mode:'balanced'}};const stage={isConnected:true,dataset:{vis:'immersion'},clientWidth:1366,clientHeight:768,prepend(){}};const ctx={window:{},document:{hidden:false,addEventListener(){},createElement(){return{setAttribute(){},addEventListener(){},remove(){}};}},matchMedia:()=>({matches:reduced}),S:()=>settings,playing,E:{time:()=>0},curTrack:()=>null,outLat:()=>0,readSpectrum:()=>null,requestAnimationFrame:f=>(cb=f,++seq),cancelAnimationFrame(){cb=null;},setInterval(){},performance:{now:()=>0},console};ctx.window.PulseImmersionCore={coverColor:()=>[.5,.5,.5],world:()=>({seed:1}),create:()=>({reset(){},step:()=>({speed:1,age:0,power:0,bass:0,mid:0,treble:0,kick:0})})};ctx.window.PulseImmersionScene={create:()=>({software:false,draw(o){frames++;assert.equal(o.world,2);},destroy(){},stats:()=>({})})};vm.runInNewContext(fs.readFileSync('renderer/immersion.js','utf8'),ctx);ctx.window.PulseImmersion.attach(stage);for(let i=1;i<=120;i++){const f=cb;cb=null;f?.(i*1000/60);}ctx.window.PulseImmersion.detach();return frames;}
test('paused Immersion keeps the same render cadence as playing; eco and reduced motion still cap it',()=>{const paused=cadence(false),playing=cadence(true);assert.ok(paused>=118);assert.equal(paused,playing);assert.ok(cadence(false,false,true)<=61);assert.ok(cadence(false,true)<=21);});
test('removed sakura assets stay absent; existing settings fall back to orbit',()=>{assert.equal(fs.existsSync('renderer/graphics/sakura-glade.mjs'),false);assert.equal(fs.existsSync('renderer/immersion-assets/sakura-dawn.jpg'),false);assert.ok(fs.readFileSync('renderer/graphics/immersion-scene.entry.mjs','utf8').includes('if(n.isInstancedMesh)n.dispose()'));});

test('Material selection uses the shared dropdown and preview is sticky only inside a collapsible editor',()=>{
 const custom=fs.readFileSync(path.join(__dirname,'../renderer/custom.js'),'utf8');
 const controls=fs.readFileSync(path.join(__dirname,'../renderer/glass-controls.js'),'utf8');
 const css=fs.readFileSync(path.join(__dirname,'../renderer/glass-controls.css'),'utf8');
 assert.match(custom,/<select class="sel surface-options" data-sel="ui.surfaceMaterial"/);
 assert.doesNotMatch(custom,/data-set="ui.surfaceMaterial"/);
 assert.match(controls,/<details class="gfx-editor-group" data-gfx-section="editor" data-glass-editor/);
 assert.match(css,/\.set2 \.set-card:has\(\[data-glass-editor\]\)\{overflow:clip\}/);
 assert.match(css,/\.glass-editor>\[data-gfx-section="preview"\]\{position:sticky;top:8px/);
 assert.doesNotMatch(css,/position:fixed/);
});

test('Quiet factory migration upgrades only the untouched legacy profile and never changes saved/custom settings',()=>{
 const legacy=require('./fixtures/glass-factory-legacy.json'),quiet=M.defaults();
 assert.deepEqual(M.profile(legacy),quiet);assert.deepEqual(M.profile({}),quiet);
 assert.ok(quiet.rimPower<=25);assert.ok(quiet.strength<legacy.strength);assert.equal(quiet.scopeButtons,false);
 assert.equal(quiet.sheen,false);assert.equal(quiet.innerShadow,false);assert.equal(quiet.glow,false);
 const changed={...legacy,barAlpha:17};assert.deepEqual(M.profile(changed),changed);
 const custom={...legacy,preset:'custom'};assert.deepEqual(M.profile(custom),custom);
 assert.deepEqual(M.customs([{id:'saved',name:'Mine',settings:legacy}])[0].settings,legacy);
 assert.deepEqual(M.importData({format:'pulse-liquid-glass',version:1,settings:legacy}).settings,legacy);
 assert.equal(M.builtIn('vivid').rimPower,120);assert.equal(M.builtIn('vision').sheen,true);
 assert.equal(M.presets.length,7);assert.deepEqual(M.normalize(legacy),legacy);
});

test('Factory glass keeps secondary text readable even over a white artwork centre',()=>{
 const d=M.defaults(),tint=d.tintColor.match(/[\da-f]{2}/g).map(x=>parseInt(x,16));
 const linear=x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4};
 const luminance=c=>c.map(linear).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);
 for(const [alpha,brightness] of [[d.barAlpha,d.barBrightness],[d.navAlpha,d.navBrightness],[d.menuAlpha,d.menuBrightness]]){
  const bg=tint.map(x=>x*alpha/100+255*brightness/100*(1-alpha/100));
  const fg=bg.map(x=>255*.92+x*.08);assert.ok((luminance(fg)+.05)/(luminance(bg)+.05)>=4.5);
 }
});

test('Standard glass does not tint every transport button; visible chorus uses a centred grid and balanced glyph',()=>{
 const material=fs.readFileSync('renderer/glass-material.css','utf8'),css=fs.readFileSync('renderer/glass-controls.css','utf8'),chorus=fs.readFileSync('renderer/chorus.css','utf8'),html=fs.readFileSync('renderer/index.html','utf8');
 assert.match(material,/body\[data-surface-material=blur\]\.glass :is\(\.side,\.bar,\.modal-box,\.clean-dialog,\.ds-pal-box\)/);
 assert.match(css,/body\[data-surface-material=blur\] #bar button\.ib\{background:transparent!important/);
 assert.match(chorus,/\.ch-btn\.has,\.ch-btn\.on\{display:inline-grid!important;place-items:center\}/);
 assert.match(html,/<symbol id="i-chorus" viewBox="0 0 24 24"><g transform="translate\(0 1.5\)"/);
});
