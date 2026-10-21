// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const qaAudio=process.env.PULSE_QA_AUDIO||path.join(out,'drum-fixture.wav');
if(!process.env.PULSE_QA_AUDIO){const sr=48000,n=sr*4,b=Buffer.alloc(44+n*2);b.write('RIFF');b.writeUInt32LE(36+n*2,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(sr,24);b.writeUInt32LE(sr*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);for(let i=0;i<n;i++){const t=i/sr,p=t%.5,value=Math.sin(2*Math.PI*82*t)*Math.exp(-p/.065)*.34+Math.sin(2*Math.PI*320*t)*.018;b.writeInt16LE(Math.round(value*32767),44+i*2);}fs.writeFileSync(qaAudio,b);}
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');
 if(req.url==='/qa-recording.wav'){res.setHeader('Content-Type','audio/wav');fs.createReadStream(qaAudio).pipe(res);return;}
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8759,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || 'chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram|VALIDATE_STATUS/.test(m.text()))errors.push(m.text());});page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning'&& /GPU fallback|viz gpu|PulseGPU/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8759'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
 await page.addInitScript(()=>{
   const feed={shelves:[{title:'Тестовые треки',items:Array.from({length:14},(_,i)=>({kind:'song',id:String(i).padStart(11,'a'),title:'Тест переключения '+(i+1),author:'Pulse QA',dur:240,loaded:true}))}],chips:[]};
   const proxy=prefix=>new Proxy({}, {get(_t,k){return (...args)=>{
     if(String(k).startsWith('on'))return;
     if(k==='getLibrary')return Promise.resolve({settings:{look:{splash:false},perf:{showFps:false},ui:{panels:true}}});
     if(k==='list'||k==='playlists'||k==='downloads'||k==='displays')return Promise.resolve([]);
     if(k==='offlineList')return Promise.resolve({});
     if(k==='status')return Promise.resolve({am:{},sp:{}});
     if(k==='info')return Promise.resolve(null);
     if(k==='version')return Promise.resolve('1.0.0');
     if(k==='lyrics')return Promise.resolve({none:true});
     if(k==='feed')return Promise.resolve(feed);
     if(k==='next')return Promise.resolve({tracks:[]});
     if(k==='resolve')return new Promise(()=>{});
     if(k==='prefetch')return Promise.resolve(true);
     if(k==='getGlass')return Promise.resolve({});
     return Promise.resolve({});
   };}});
   window.pulse=proxy('');for(const n of ['plugins','account','svc','ytm','spicy','discord','custom','editor','wall','accounts']) Object.defineProperty(window.pulse,n,{value:proxy(n)});
   // replace proxy with explicit nested keys (proxy getter above does not read target).
   const p=proxy('');window.pulse=new Proxy({}, {get(t,k){if(['plugins','account','svc','ytm','spicy','discord','custom','editor','wall','accounts'].includes(k))return proxy(k);return p[k];}});
   localStorage.setItem('pulse.splash','off');
 });
 await page.goto('http://127.0.0.1:8759');await page.waitForTimeout(1600);


 await page.evaluate(async()=>{lib.queue={tracks:[{id:'recording',title:'Audio reaction QA',author:'Pulse QA',dur:15,art:'/logo.png'}],idx:0};engine='audio';audioTrackId='recording';audio.src='/qa-recording.wav';audio.loop=true;E.play();S().ly.vis='mineradio';S().ly.mrQuality='eco';S().ly.mrFps=30;S().ly.mrLyrics=false;S().ly.mrShelf=false;lyStageOpen(true);updateNow();});
 await page.waitForFunction(()=>window.mrActive&&mrActive(),{},{timeout:120000});const frame=page.frames().find(f=>f.url().includes('/mineradio/index.html'));
 await frame.evaluate(()=>{window.qaFrames=[];const original=PulseBeatOnset.step;PulseBeatOnset.step=function(f,o){const v=original(f,o);if(qaFrames.length<1500)qaFrames.push({t:performance.now(),...v,fft:f?Math.max(...f):0,wave:typeof timeDomainData!=='undefined'?Math.max(...timeDomainData)-Math.min(...timeDomainData):0,playing:o.playing,uniform:uniforms.uBeat.value});return v;};});
 await page.waitForTimeout(15500);const frames=await frame.evaluate(()=>qaFrames);const result={count:frames.length,hits:frames.filter(x=>x.hit).length,maxPulse:Math.max(...frames.map(x=>x.pulse)),maxFFT:Math.max(...frames.map(x=>x.fft)),maxWave:Math.max(...frames.map(x=>x.wave)),maxUniform:Math.max(...frames.map(x=>x.uniform)),playingFrames:frames.filter(x=>x.playing).length,errors};fs.writeFileSync(process.env.PULSE_QA_RESULT||path.join(out,'mr-audio-evidence.json'),JSON.stringify({result,frames},null,2));console.log(result);const assert=require('node:assert/strict');assert.ok(result.hits>=5);assert.ok(result.maxPulse>.35);assert.ok(result.maxUniform>.3);assert.deepEqual(errors,[]);
 assert.equal(await page.locator('#pulseBloomToggle').count(),0);assert.equal(await frame.locator('#pulsePrism').count(),0);
 await frame.evaluate(()=>{const cv=document.createElement('canvas');cv.width=cv.height=256;const c=cv.getContext('2d');c.fillStyle='#765cbc';c.fillRect(0,0,256,256);applyCoverCanvas(cv,'qa-first',{coverKey:'qa-first'});});await page.waitForTimeout(1500);
 await frame.evaluate(()=>{const cv=document.createElement('canvas');cv.width=cv.height=256;const c=cv.getContext('2d');const g=c.createLinearGradient(0,0,256,256);g.addColorStop(0,'#e98d64');g.addColorStop(1,'#4489b8');c.fillStyle=g;c.fillRect(0,0,256,256);applyCoverCanvas(cv,'qa-next',{coverKey:'qa-next'});});
 await frame.waitForFunction(()=>uniforms.uColorMixT.value>.08&&uniforms.uColorMixT.value<.95,{},{timeout:5000});
 assert.equal(await frame.evaluate(()=>uniforms.uPulseMorph.value),1);await page.screenshot({path:out+'/panel7-mr-morph.png'});await frame.waitForFunction(()=>uniforms.uColorMixT.value===1,{},{timeout:10000});
 await page.evaluate(()=>{S().ly.mrMorph=false;settingChanged('ly.mrMorph');});assert.equal(await frame.evaluate(()=>uniforms.uPulseMorph.value),0);
 await page.evaluate(()=>{S().ly.mrMorph=true;settingChanged('ly.mrMorph');});
 console.log('Artwork dissolve: real shader transition, settled and disabled successfully');
 await page.evaluate(()=>{S().ly.mrReaction=0;settingChanged('ly.mrReaction');});await frame.waitForFunction(()=>uniforms.uBeat.value===0,{},{timeout:5000});
 await page.screenshot({path:out+'/panel7-mr-audio.png'});await browser.close();server.close();process.exit(0);
})().catch(e=>{console.error(e);server.close();process.exit(1)});
