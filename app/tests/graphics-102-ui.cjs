'use strict';
const fs=require('fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/chromium',args:['--no-sandbox']});try{const page=await browser.newPage({viewport:{width:1366,height:768}});await page.setContent('<style>body{margin:0}#stage{position:relative;width:640px;height:400px}canvas{width:640px;height:400px}</style><div id="stage"><canvas id="viz"></canvas></div>');await page.addScriptTag({path:require('node:path').resolve('renderer/gpu.js')});const src=fs.readFileSync('renderer/viz.js','utf8'),before=require('./graphics-102-original.cjs')('renderer/viz.js',src);
const result=await page.evaluate(({src,before})=>{
 let now=1000,seed=456;Object.defineProperty(performance,'now',{configurable:true,value:()=>now});Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const current=new Function(src+';return makeViz;')(),previous=new Function(before+';return makeViz;')(),freq=new Uint8Array(1024).fill(190),wave=Uint8Array.from({length:2048},(_,i)=>128+Math.sin(i*.05)*70),cv=document.querySelector('canvas'),stage=cv.parentElement;
 function render(make,id,fx={}){now=1000;seed=456;const v=make({gpu:false,maxDpr:1});v.init(cv);for(let i=0;i<6;i++){now+=1000/60;v.draw({quality:'high',mode:'visual',style:id,playing:true,freq,wave,beat:.6,tempo:{bpm:120,pos:i/30,conf:.9},fx:{density:100,thick:100,zoom:30,glow:0,...fx}});}const a=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;let hash=2166136261;for(const b of a)hash=Math.imul(hash^b,16777619);v.destroy();return hash;}
 const ids=current({gpu:false}).STYLES.map(s=>s.id),same=[];for(const id of ids){if(render(current,id)!==render(previous,id))throw Error('unintended sharp pixel change '+id);same.push(id);}
 // Non-finite geometry must never be sent to the browser at supported density/short wave inputs.
 const proto=CanvasRenderingContext2D.prototype,saved={};let calls=0;
 for(const name of ['moveTo','lineTo','arc','arcTo','fillRect']){saved[name]=proto[name];proto[name]=function(...a){calls++;if(a.some(x=>typeof x==='number'&&!Number.isFinite(x)))throw Error(name+' non-finite');return saved[name].apply(this,a);};}
 const v=current({gpu:false,maxDpr:1});v.init(cv);const errors=[],log=console.error;console.error=(...a)=>errors.push(a.map(String).join(' '));
 try{
 now+=17;v.draw({quality:'high',mode:'cover',freq,playing:true,fx:{density:300}});
 for(const n of [1,2,8,16,24]){now+=17;v.draw({quality:'high',mode:'visual',style:'wave',playing:true,freq,wave:new Uint8Array(n).fill(128),fx:{glow:0}});}
 stage.style.height='0px';cv.style.height='0px';v.resize();now+=17;v.draw({quality:'high',mode:'visual',style:'stars',playing:true,freq,fx:{density:200}});
 stage.style.height='400px';cv.style.height='400px';v.resize();now+=17;v.draw({quality:'high',mode:'visual',style:'stars',playing:true,freq,fx:{density:200}});
 }finally{for(const name in saved)proto[name]=saved[name];console.error=log;v.destroy();}
 if(errors.length)throw Error(errors.join('\n'));
 // Real bass-dependent cell counts fluctuate: capacity should be reused, not reallocated each frame.
 function gridAllocs(make){now=1000;seed=456;let allocations=0;const Original=Int32Array;window.Int32Array=new Proxy(Original,{construct(t,args){allocations++;return Reflect.construct(t,args);}});const v=make({gpu:false,maxDpr:1});v.init(cv);let st;const style=v.STYLES.find(s=>s.id==='stars'),draw=style.draw;style.draw=g=>{st=g.state;draw(g);};try{for(let i=0;i<100;i++){freq.fill(i%20<10?0:255);now+=17;v.draw({quality:'high',mode:'visual',style:'stars',playing:true,freq,fx:{density:200,glow:0}});}}finally{window.Int32Array=Original;v.destroy();}return allocations;}
 const oldAllocs=gridAllocs(previous),newAllocs=gridAllocs(current);if(!(newAllocs<oldAllocs&&newAllocs<6))throw Error('grid still churns '+newAllocs+'/'+oldAllocs);
 // Destroy/re-init must not retain spectrogram bitmap or blank-video visibility/state.
 const life=current({gpu:false,maxDpr:1});life.init(cv);let state;const spec=life.STYLES.find(s=>s.id==='spectro'),draw=spec.draw;spec.draw=g=>{state=g.state;draw(g);};now+=17;life.draw({quality:'high',mode:'visual',style:'spectro',freq});const cache=state.c;life.destroy();if(cache.width!==1||cache.height!==1||life.stats().path!=='idle')throw Error('bitmap not released');life.init(cv);life.draw({mode:'video'});if(cv.style.visibility!=='hidden')throw Error('video canvas not hidden');life.destroy();life.init(cv);life.draw({mode:'video'});if(cv.style.visibility!=='hidden')throw Error('stale blank flag after reinit');life.destroy();if(cv.style.visibility==='hidden')throw Error('destroy left caller canvas hidden');
 // Real owned WebGL2 context must be explicitly lost once, not an absent API.gl field.
 const get=HTMLCanvasElement.prototype.getContext;let lost=0;
 HTMLCanvasElement.prototype.getContext=function(kind,...args){const ctx=get.call(this,kind,...args);if(kind==='webgl2'&&ctx&&!ctx.__qaLose){ctx.__qaLose=true;const ext=ctx.getExtension.bind(ctx);ctx.getExtension=name=>{const e=ext(name);return name==='WEBGL_lose_context'&&e?{loseContext(){lost++;e.loseContext();}}:e;};}return ctx;};
 try{const owned=current({maxDpr:1});owned.init(cv);now+=17;owned.draw({quality:'high',mode:'visual',style:'coverfield',direct:true,playing:true,freq,wave,fx:{glow:0}});if(owned.stats().path!=='WebGL direct')throw Error('GPU lifecycle fixture not exercising GPU');owned.destroy();owned.destroy();}finally{HTMLCanvasElement.prototype.getContext=get;}
 if(lost!==1)throw Error('owned GPU context release count '+lost);
 return{ownedGpuContextsReleased:lost,sharpPixelIdentical:same,finiteGeometryCalls:calls,shortWaveLengths:[1,2,8,16,24],zeroHeightSafe:true,gridAllocations:{before:oldAllocs,after:newAllocs},lifecycleReleased:true};
},{src,before});fs.mkdirSync('tests/artifacts',{recursive:true});fs.writeFileSync('tests/artifacts/graphics-102.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
