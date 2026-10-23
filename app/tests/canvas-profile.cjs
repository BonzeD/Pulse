'use strict';
// Diagnostic raster profile, NOT a Windows FPS benchmark. Readback deliberately
// forces completion of queued Canvas work that the in-app submit timer cannot see.
const fs=require('fs'),path=require('path'),{chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/chromium',args:['--no-sandbox']});try{
 const p=await b.newPage({viewport:{width:1366,height:768}});
 await p.setContent('<div id="stage" style="width:1100px;height:640px"><canvas id="viz" style="width:1100px;height:640px"></canvas></div>');
 let src=fs.readFileSync(process.env.VIZ_SOURCE||'renderer/viz.js','utf8');if(process.env.VIZ_BASELINE==='1')src=require('./canvas-perf-original.cjs')('renderer/viz.js',src);
 await p.addScriptTag({content:src+';window.makeViz=makeViz;'});
 const r=await p.evaluate(()=>{
  const cv=document.querySelector('canvas'),freq=new Uint8Array(1024).fill(190);let time=1000,seed=456;
  Object.defineProperty(performance,'now',{value:()=>time,configurable:true});Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const timer=Date.now,out=[],proto=CanvasRenderingContext2D.prototype,methods={};let shadowed=0;
  for(const k of ['stroke','fill','drawImage','fillRect']){methods[k]=proto[k];proto[k]=function(...a){if(this.shadowBlur>0)shadowed++;return methods[k].apply(this,a);};}
  try{for(const id of ['stars','hex','fire','vinyl','rays','ring','bars']){
   seed=456;const v=makeViz({gpu:false,maxDpr:1.5});v.init(cv);const ctx=cv.getContext('2d');shadowed=0;const t=timer();
   for(let i=0;i<35;i++){time+=16.67;v.draw({quality:'high',mode:'visual',style:id,playing:true,freq,beat:.7,sens:1,tempo:{bpm:120,pos:i/30,conf:.9},fx:{glow:100,density:100,thick:100,zoom:30,bass:100}});ctx.getImageData(0,0,1,1);}
   out.push({id,rasterMsPerFrame:(timer()-t)/35,shadowOperationsPerFrame:shadowed/35});v.destroy();
  }}finally{for(const k in methods)proto[k]=methods[k];}return out;
 });
 const dest=process.env.PROFILE_OUT||path.resolve('tests/artifacts/canvas-profile.json');fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,JSON.stringify({environment:'Linux headless Chromium; forced Canvas readback; not Windows FPS',samples:35,viewport:[1100,640],results:r},null,2));console.log(JSON.stringify(r));
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1);});
