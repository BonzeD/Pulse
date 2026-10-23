// 1.0.0: motion contracts; rendering/interruption checks live in motion-ui.cjs.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
const read=p=>fs.readFileSync(p,'utf8');
test('Motion stylesheet loads last, before user CSS; requested version is 1.0.2',()=>{const h=read('renderer/index.html');assert.ok(h.indexOf('href="motion.css"')>h.indexOf('href="chrome.css"'));assert.ok(h.indexOf('href="motion.css"')<h.indexOf('id="userCss"'));assert.equal(require('../package.json').version,'1.0.2');});
test('Motion respects live OS preference and persistent animation switch',()=>{const a=read('renderer/app.js');assert.match(a,/!motionPreference\.matches/);assert.match(a,/localStorage\.setItem\('pulse.motion'/);for(const f of ['renderer/motion.css','renderer/widget.css'])assert.match(read(f),/prefers-reduced-motion:reduce/);assert.match(read('renderer/splash.js'),/localStorage\.getItem\('pulse.motion'\) === 'off'/);});
test('Motion exits match JS timers and do not animate blur',()=>{const a=read('renderer/app.js'),c=read('renderer/anim.css');assert.match(c,/#page.leave\{animation:axLeave 120ms/);assert.match(a,/leaveP = new Promise\(\(res\) => setTimeout\(res, 120\)\)/);assert.match(c,/animation:axBoxOut 170ms/);assert.match(c,/animation:axMenuOut 120ms/);assert.doesNotMatch(c,/filter:\s*blur/);});
test('Stagger is bounded and settled entrances do not retain transform layers',()=>{const c=read('renderer/anim.css');assert.match(c,/\.tr:nth-child\(-n\+8\)/);assert.match(c,/\.shelf:not\(:has\(\.tr\)\)/);assert.match(c,/#page.fade\{[^}]+ backwards\}/);assert.doesNotMatch(c,/will-change/);});

function prismFixture({reduced=false,hidden=false,loaded=true,local={},session={},language='en'}={}){
 const vm=require('node:vm'),winEvents=new Map(),docEvents=new Map(),elEvents=new Map(),prefEvents=new Map(),frames=new Map(),timers=new Map();
 const classes=()=>{const values=new Set();return{add:v=>values.add(v),remove:v=>values.delete(v),toggle(v,on){if(on)values.add(v);else values.delete(v);},contains:v=>values.has(v)};};
 let now=100,seq=0,contexts=0,removed=false;
 const tag={textContent:''},canvas={getContext(){contexts++;return null;}};
 const el={dataset:{},classList:classes(),querySelector:s=>s==='canvas'?canvas:tag,addEventListener:(n,f)=>elEvents.set(n,f),removeEventListener:n=>elEvents.delete(n),remove(){removed=true;}};
 const preference={matches:reduced,addEventListener:(n,f)=>prefEvents.set(n,f),removeEventListener:n=>prefEvents.delete(n)};
 const doc={hidden,readyState:loaded?'complete':'loading',body:{classList:classes()},getElementById:()=>el,addEventListener:(n,f)=>docEvents.set(n,f),removeEventListener:n=>docEvents.delete(n)};
 const window={matchMedia:q=>q.includes('reduced-motion')?preference:{matches:false},PulseI18n:{language:()=>language},addEventListener:(n,f)=>winEvents.set(n,f),removeEventListener:n=>winEvents.delete(n)};
 const ctx={window,document:doc,localStorage:{getItem:k=>local[k]??null},sessionStorage:{getItem:k=>session[k]??null,setItem:(k,v)=>session[k]=v},performance:{now:()=>now},requestAnimationFrame:f=>{frames.set(++seq,f);return seq;},cancelAnimationFrame:id=>frames.delete(id),setTimeout:(f,ms)=>{timers.set(++seq,{f,due:now+ms});return seq;},clearTimeout:id=>timers.delete(id)};
 vm.runInNewContext(read('renderer/splash.js'),ctx);
 function frame(){const pending=[...frames.values()];frames.clear();now+=16;for(const f of pending)f(now);}
 function advance(ms){const end=now+ms;for(;;){const next=[...timers].filter(([,v])=>v.due<=end).sort((a,b)=>a[1].due-b[1].due)[0];if(!next)break;now=next[1].due;timers.delete(next[0]);next[1].f();}now=end;}
 return{el,doc,tag,preference,winEvents,docEvents,elEvents,prefEvents,frames,timers,session,frame,advance,get contexts(){return contexts;},get removed(){return removed;}};
}
test('prism intro skips all GPU work for reduced motion, disabled startup and same-session reload',()=>{
 for(const options of [{reduced:true},{local:{'pulse.motion':'off'}},{local:{'pulse.splash':'off'}},{session:{'pulse.splashShown':'1'}}]){
  const f=prismFixture(options);assert.ok(f.removed);assert.equal(f.contexts,0);assert.equal(f.frames.size,0);assert.equal(f.timers.size,0);assert.equal(f.winEvents.size,0);
 }
});
test('hidden startup waits for visibility and keyboard skip tears down timers and listeners',()=>{
 const f=prismFixture({hidden:true});assert.equal(f.contexts,0);assert.equal(f.frames.size,0);
 f.doc.hidden=false;f.docEvents.get('visibilitychange')();f.frame();f.frame();assert.equal(f.contexts,1);
 let prevented=false,stopped=false;f.winEvents.get('keydown')({key:'Enter',preventDefault(){prevented=true;},stopPropagation(){stopped=true;}});
 assert.ok(prevented&&stopped);assert.equal(f.frames.size,0);assert.equal(f.winEvents.size,0);assert.equal(f.docEvents.size,0);assert.equal(f.prefEvents.size,0);assert.equal(f.timers.size,1,'only the bounded exit removal remains');
 f.advance(700);assert.ok(f.removed);assert.equal(f.timers.size,0);
});
test('prism intro retains 1800ms minimum, 4500ms safety cap and click skip without a WebGL context',()=>{
 for(const loaded of [true,false]){const f=prismFixture({loaded});f.frame();f.frame();f.advance(loaded?1790:4490);assert.ok(!f.el.classList.contains('bye'));f.advance(20);assert.ok(f.el.classList.contains('bye'));f.advance(700);assert.ok(f.removed);}
 const f=prismFixture();f.frame();f.frame();f.elEvents.get('click')();f.advance(700);assert.ok(f.removed);
});
test('live reduced-motion change immediately stops a running intro',()=>{
 const f=prismFixture();f.frame();f.frame();f.preference.matches=true;f.prefEvents.get('change')();assert.ok(f.removed);assert.equal(f.frames.size,0);assert.equal(f.timers.size,0);
});
test('prism captions are localized and the standalone renderer never reads music or downloads assets',()=>{
 for(const [language,text]of Object.entries({ru:'Музыка в твоём ритме',en:'Music in your rhythm',ja:'あなたのリズムで音楽を',uk:'Музика у твоєму ритмі'})){const f=prismFixture({language});assert.equal(f.tag.textContent,text);}
 const s=read('renderer/splash.js');assert.doesNotMatch(s,/fetch\(|new Audio|AudioContext|curTrack|readSpectrum|https:\/\//);assert.match(s,/deleteBuffer\(buffer\)/);assert.match(s,/deleteProgram\(program\)/);assert.match(s,/loseContext\(\)/);assert.match(s,/canvas.width!==width\|\|canvas.height!==height/);
});
