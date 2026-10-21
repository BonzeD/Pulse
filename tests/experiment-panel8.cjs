// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');if(req.url==='/qa-art.jpg'){res.setHeader('Content-Type','image/jpeg');fs.createReadStream(path.join(__dirname,'fixtures/water-art.jpg')).pipe(res);return;}
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8763,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || 'chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram|VALIDATE_STATUS/.test(m.text()))errors.push(m.text());});page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning'&& /GPU fallback|viz gpu|PulseGPU/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8763'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
 await page.addInitScript(()=>{
   const feed={shelves:[{title:'Тестовые треки',items:Array.from({length:14},(_,i)=>({kind:'song',id:String(i).padStart(11,'a'),title:'Тест переключения '+(i+1),author:'Pulse QA',dur:240,loaded:true}))}],chips:[]};
   const proxy=prefix=>new Proxy({}, {get(_t,k){return (...args)=>{
     if(String(k).startsWith('on'))return;
     if(k==='saveLibrary'){localStorage.setItem('qa.saved',JSON.stringify(args[0]));return;}
     if(k==='getLibrary'&&localStorage.getItem('qa.saved'))return Promise.resolve(JSON.parse(localStorage.getItem('qa.saved')));
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
 await page.goto('http://127.0.0.1:8763');await page.waitForTimeout(1600);



 const assert=require('node:assert/strict');
 await page.evaluate(async()=>{
  lib.queue={tracks:[{id:'exp',title:'WebGL experiment',author:'Pulse QA',dur:240,art:'/qa-art.jpg'}],idx:0};
  E.time=()=>5;Object.assign(S().perf,{gpu:true,fps:60,mode:'high',showFps:true,bgSlow:false});Viz.setGpu(true);document.body.classList.add('show-fps');
  Object.assign(S().viz,{directExperiment:true,edge:'fade'});lib.vizStyle='coverfield';lib.mode='visual';updateNow();openPP();updateMode();
  const im=new Image();im.src='/qa-art.jpg';await im.decode();coverImg=im;
  const f=new Uint8Array(1024);for(let i=0;i<f.length;i++)f[i]=Math.round(90+65*Math.sin(i*.08));window.qaSpectrum={f,w:new Uint8Array(2048).fill(128),sampleRate:48000,fftSize:2048};readSpectrum=()=>qaSpectrum;
 });
 await page.waitForFunction(()=>Viz.stats().path==='WebGL direct',{},{timeout:30000});await page.waitForTimeout(2200);
 let direct=await page.evaluate(()=>({stats:Viz.stats(),active:VisualExperiment.active(),rect:document.getElementById('vizDirect').getBoundingClientRect().toJSON(),source:document.getElementById('viz').getBoundingClientRect().toJSON()}));
 assert.equal(direct.active,true);assert.equal(direct.stats.copies,0);assert.ok(direct.stats.directFrames>5);assert.equal(direct.rect.width,direct.source.width);assert.equal(direct.rect.height,direct.source.height);
 console.log('Direct renderer',direct.stats);await page.screenshot({path:out+'/panel8-direct.png'});
 await page.evaluate(()=>{S().viz.directExperiment=false;});await page.waitForFunction(()=>!VisualExperiment.active()&&Viz.stats().path==='WebGL copied');await page.waitForTimeout(600);assert.equal(await page.locator('#vizDirect').evaluate(c=>c.hidden),true);assert.equal(await page.locator('#viz').evaluate(c=>getComputedStyle(c).visibility),'visible');
 await page.screenshot({path:out+'/panel8-legacy.png'});console.log('Rollback renderer',await page.evaluate(()=>Viz.stats()));
 await page.evaluate(()=>{S().viz.directExperiment=true;S().viz.fx.mirror='h';});await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>VisualExperiment.active()),false);assert.equal(await page.evaluate(()=>Viz.stats().path),'WebGL copied');
 await page.evaluate(()=>{S().viz.fx.mirror='off';});await page.waitForFunction(()=>VisualExperiment.active());
 for(const size of [{width:980,height:640},{width:1680,height:960}]){await page.setViewportSize(size);await page.waitForTimeout(500);const d=await page.evaluate(()=>{const a=$('viz').getBoundingClientRect(),b=$('vizDirect').getBoundingClientRect();return [a.x-b.x,a.y-b.y,a.width-b.width,a.height-b.height];});assert.ok(d.every(x=>Math.abs(x)<1));await page.screenshot({path:out+'/panel8-direct-'+size.width+'.png'});}
 await page.evaluate(()=>{Viz.setGpu(false);S().perf.gpu=false;});await page.waitForFunction(()=>!VisualExperiment.active()&&Viz.stats().path==='Canvas 2D',{},{timeout:20000});console.log('GPU-disabled fallback',await page.evaluate(()=>Viz.stats().path));
 await page.evaluate(()=>{Viz.setGpu(true);S().perf.gpu=true;});await page.waitForFunction(()=>VisualExperiment.active());
 await page.evaluate(()=>{const c=$('vizDirect');const gl=c.getContext('webgl2');window.qaLost=gl.getExtension('WEBGL_lose_context');qaLost.loseContext();});await page.waitForFunction(()=>!VisualExperiment.active());await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>Viz.stats().path),'Canvas 2D');
 await page.evaluate(()=>qaLost.restoreContext());await page.waitForFunction(()=>VisualExperiment.active()&&Viz.stats().path==='WebGL direct',{},{timeout:20000});
 await page.evaluate(()=>{closePP();});await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>VisualExperiment.active()),false);assert.equal(await page.locator('#vizDirect').evaluate(c=>c.hidden),true);
 await page.evaluate(()=>{openPP();});await page.waitForFunction(()=>VisualExperiment.active());
 await page.evaluate(()=>{lib.vizStyle='ring';updateButtons();});await page.waitForFunction(()=>!VisualExperiment.active());assert.equal(await page.locator('#vizDirect').evaluate(c=>c.hidden),true);
 await page.evaluate(()=>{document.body.style.background='#c890b8';toast('Для этой песни пока нет текста — покажу обложку','lyrics');});await page.waitForTimeout(450);
 const colors=await page.locator('#toast').evaluate(e=>({fg:getComputedStyle(e).color,bg:getComputedStyle(e).backgroundColor,icon:getComputedStyle(e.querySelector('svg')).color}));console.log('Notification colors',colors);assert.equal(colors.fg,'rgb(245, 245, 247)');assert.equal(colors.icon,colors.fg);await page.screenshot({path:out+'/panel8-toast.png'});
 assert.deepEqual(errors,[]);console.log('Direct/legacy, resizing, CPU fallback, context loss/restore, route exit and notification tests passed');await browser.close();server.close();process.exit(0);
})().catch(e=>{console.error(e);server.close();process.exit(1)});
