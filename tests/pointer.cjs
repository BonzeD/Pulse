'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('renderer/pointer.js','utf8');
function fixture(){
 const handlers={},jobs=new Map(),styles={},classes=new Set();let next=0,reads=0;
 const media={matches:false,addEventListener(){}};
 const fine={matches:true,addEventListener(){}};
 const art={isConnected:true,style:{position:'',setProperty:(k,v)=>styles[k]=v,removeProperty:k=>delete styles[k]},classList:{add:k=>classes.add(k),remove:k=>classes.delete(k)},getBoundingClientRect:()=>{reads++;return{left:0,top:0,width:300,height:300};},append(){}};
 const document={hidden:false,addEventListener:(k,f)=>handlers[k]=f,createElement:()=>({style:{},setAttribute(){},remove(){}})};
 const c={document,setTimeout,innerWidth:1000,innerHeight:700,matchMedia:q=>q.includes('reduced')?media:fine,getComputedStyle:()=>({position:'static'}),requestAnimationFrame:f=>{jobs.set(++next,f);return next;},cancelAnimationFrame:id=>jobs.delete(id),performance:{now:()=>100},S:()=>({look:{anim:true}}),addEventListener:(k,f)=>handlers[k]=f};c.window=c;
 vm.runInNewContext(source,c);
 const move=(x=150,y=150,element=art)=>handlers.pointermove({pointerType:'mouse',clientX:x,clientY:y,target:{closest:()=>element}});
 const flush=()=>{for(const [id,f]of jobs){jobs.delete(id);f();}};
 return{c,media,fine,handlers,jobs,styles,classes,art,move,flush,reads:()=>reads};
}
test('pointer work is event driven, coalesces moves, and caches the hover bounds',()=>{const f=fixture();assert.equal(f.jobs.size,0);f.move(50,50);f.move(100,100);f.move(200,200);assert.equal(f.jobs.size,1);assert.equal(f.reads(),1);f.flush();assert.equal(f.jobs.size,0);assert.equal(f.styles['--pointer-x'],'200.0px');assert.ok(f.classes.has('pulse-pointer'));f.handlers.blur();assert.equal(f.art.style.position,'');assert.equal(f.classes.size,0);});
test('reduced motion, hidden windows and coarse pointers disable reactions',()=>{const f=fixture();f.media.matches=true;f.move();assert.equal(f.c.PulsePointer.position(),null);assert.equal(f.jobs.size,0);f.media.matches=false;f.c.document.hidden=true;assert.equal(f.c.PulsePointer.position(),null);f.c.document.hidden=false;f.fine.matches=false;assert.equal(f.c.PulsePointer.position(),null);});
test('light overlays never intercept input and scenes use bounded camera offsets',()=>{const css=fs.readFileSync('renderer/pointer.css','utf8'),scene=fs.readFileSync('renderer/graphics/immersion-scene.entry.mjs','utf8'),viz=fs.readFileSync('renderer/viz.js','utf8');assert.match(css,/pointer-events:none/);assert.match(scene,/active.update\(o\);[\s\S]*?camera.position.x\+=o.pointer.x\*\.7/);assert.match(viz,/cx: cx \+ pointerX/);assert.doesNotMatch(source,/fetch\(|new Audio|E\.seek|setInterval\(/);});

test('catalog pointer light targets artwork rather than the title/card perimeter',()=>{
 const css=fs.readFileSync('renderer/pointer.css','utf8');
 assert.match(source,/const selector = '\.card \.ca,/);
 assert.doesNotMatch(source,/const selector = '\.card,/);
 assert.doesNotMatch(css,/:is\(\.card,/);
 assert.match(css,/\.card \.ca > \.pulse-pointer-light\{border-radius:inherit;overflow:hidden/);
});

test('crossing an artwork boundary preserves global camera coordinates',()=>{const f=fixture();f.move(900,500);const before=f.c.PulsePointer.position();const other={...f.art,style:{...f.art.style}};f.move(900,500,other);const after=f.c.PulsePointer.position();assert.ok(before.x>0);assert.ok(after.x>=before.x,'camera must not snap to origin on target change');assert.match(source,/old.style.opacity='0'/);assert.match(source,/light.style.opacity='0'/);});
