'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{chromium}=require('playwright');
const inverse=require('./visual-performance-original.cjs');
const current=fs.readFileSync('renderer/viz.js','utf8'),before=inverse('renderer/viz.js',current);
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1000,height:700}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.text().startsWith('QA '))console.log(m.text());});
  await page.setContent('<style>#stage{position:relative;width:200px;height:140px}#viz,#vizDirect{position:absolute;left:0;top:0;width:200px;height:140px}</style><div id="stage"></div>');
  await page.addScriptTag({path:path.resolve('renderer/gpu.js')});await page.addScriptTag({path:path.resolve('renderer/neon-gpu.js')});
  const results=await page.evaluate(({current,before})=>{
    const create=src=>new Function(src+';return makeViz;')();
    const oldMake=create(before),newMake=create(current),base={glow:100,trails:0,zoom:30,shake:0,flash:0,mirror:'off',hue:0,thick:100,density:100,bass:100};
    const originalNow=performance.now.bind(performance),originalRandom=Math.random,originalMQ=window.matchMedia.bind(window);let time=1000,seed=123,mqCalls=0;
    Object.defineProperty(performance,'now',{configurable:true,value:()=>time});window.matchMedia=(...a)=>{mqCalls++;return originalMQ(...a);};
    Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const art=document.createElement('canvas');art.width=art.height=32;const ac=art.getContext('2d');ac.fillStyle='#dc3487';ac.fillRect(0,0,32,32);ac.fillStyle='#2c78e8';ac.fillRect(5,5,20,20);
    const stage=document.getElementById('stage'),freq=Uint8Array.from({length:1024},(_,i)=>40+(i*37%170)),wave=Uint8Array.from({length:2048},(_,i)=>128+Math.sin(i*.04)*70);
    function render(make,id,fx=base,gpu=false,direct=false,frames=6){
      stage.replaceChildren();seed=123;time=1000;mqCalls=0;
      const c=document.createElement('canvas');c.id='viz';stage.append(c);const v=make({gpu,maxDpr:1});v.init(c);
      const ctx=c.getContext('2d');let clears=0;const clear=ctx.clearRect.bind(ctx);ctx.clearRect=(...a)=>{clears++;return clear(...a);};
      const o={direct,quality:'high',mode:'visual',style:id,playing:true,sens:1,freq,wave,beat:.5,tempo:{bpm:120,pos:0,conf:.9},sr:48000,fx,cover:art};
      for(let i=0;i<frames;i++){time=1000+i*1000/120;o.tempo.pos=i/60;v.draw(o);}
      const img=ctx.getImageData(0,0,c.width,c.height).data;let hash=2166136261;for(const x of img)hash=Math.imul(hash^x,16777619);
      const stats=v.stats(),visible=c.style.visibility,directVisible=stage.querySelector('#vizDirect')?.hidden===false;
      const out={hash,clears,mqCalls,path:stats.path,visible,directVisible};v.destroy();return out;
    }
    const styles=newMake({gpu:false}).STYLES.map(s=>s.id),matrix=[];
    try{
      for(const id of styles){console.log('QA Canvas '+id);const a=render(oldMake,id),b=render(newMake,id);matrix.push({id,before:a.hash,after:b.hash});if(a.hash!==b.hash&&!['ring','bars','particles','warp','hex','fire','stars','vinyl','rays'].includes(id))throw Error('Unmodified Canvas pixels changed: '+id);}
      const gpu=[];
      for(const id of ['coverfield','radial']){console.log('QA GPU '+id);
        const a=render(oldMake,id,base,true,true,24),b=render(newMake,id,base,true,true,24);
        if(a.path!=='WebGL direct'||b.path!=='WebGL direct')throw Error('GPU fallback '+id+JSON.stringify({a,b}));
        if(b.clears!==1||a.clears!==24)throw Error('redundant direct canvas clear '+JSON.stringify({a,b}));
        if(b.mqCalls!==1)throw Error('MQ allocated per frame');
        if(!b.directVisible||b.visible!=='hidden')throw Error('direct canvas visibility');gpu.push({id,before:a,after:b});
        for(const fx of [{...base,trails:50},{...base,mirror:'quad'},{...base,flash:50}]){
          const x=render(newMake,id,fx,true,false),expected=id==='radial'?'Canvas 2D':'WebGL copied';if(x.path!==expected||x.visible==='hidden'||x.directVisible)throw Error('FX copy fallback '+id+JSON.stringify(x));
        }
      }
      // One instance repeatedly switches direct -> copied -> Canvas -> empty -> direct.
      stage.replaceChildren();const c=document.createElement('canvas');c.id='viz';stage.append(c);const v=newMake({maxDpr:1});v.init(c);
      const o={direct:true,quality:'high',mode:'visual',style:'radial',playing:true,sens:1,freq,wave,beat:.5,tempo:{bpm:120,pos:0,conf:.9},sr:48000,fx:base,cover:art};
      const transitions=[];
      for(const [mode,style,direct,fx] of [['visual','radial',true,base],['visual','radial',false,{...base,trails:50}],['visual','ring',false,base],['cover','ring',false,base],['visual','coverfield',true,base],['video','ring',false,base],['visual','radial',true,base]]){
        time+=16.67;v.draw({...o,mode,style,direct,fx,noBars:true});const visible=stage.querySelector('#vizDirect')?.hidden===false;
        if(visible!==direct)throw Error('switch left stale direct canvas '+mode+' '+style);if(mode==='visual'&&!direct&&c.style.visibility==='hidden')throw Error('Canvas fallback hidden');transitions.push({mode,style,directVisible:visible});
      }
      // Unchanged ResizeObserver notifications must not wipe a static frame.
      v.hideDirect();v.draw({...o,direct:false,style:'ring'});const ctx=c.getContext('2d');const a=ctx.getImageData(0,0,c.width,c.height).data.slice();v.resize();const b=ctx.getImageData(0,0,c.width,c.height).data;if(a.some((x,i)=>x!==b[i]))throw Error('same-size resize erased canvas');
      v.destroy();return {canvasPresets:matrix.length,pixelIdentical:matrix.every(x=>x.before===x.after),gpu,transitions,sameSizeResizePreservesPixels:true};
    }finally{Object.defineProperty(performance,'now',{configurable:true,value:originalNow});Math.random=originalRandom;window.matchMedia=originalMQ;}
  },{current,before});
  assert.deepEqual(errors,[]);fs.mkdirSync('tests/artifacts',{recursive:true});fs.writeFileSync('tests/artifacts/visual-performance.json',JSON.stringify(results,null,2));
  console.log(JSON.stringify(results,null,2));
 }finally{await browser.close();}
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
