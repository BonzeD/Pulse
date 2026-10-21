// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');if(req.url==='/qa-art.jpg'){res.setHeader('Content-Type','image/jpeg');fs.createReadStream(path.join(__dirname,'fixtures/water-art.jpg')).pipe(res);return;}
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8769,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || 'chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram|VALIDATE_STATUS/.test(m.text()))errors.push(m.text());});page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning'&& /GPU fallback|viz gpu|PulseGPU/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8769'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
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
 await page.goto('http://127.0.0.1:8769');await page.waitForTimeout(1600);




 const assert=require('node:assert/strict');
 await page.evaluate(async()=>{
  S().app.language='ru';PulseI18n.setLanguage('ru');S().ui.variant='clean';S().look.anim=false;applySettings();
  lib.queue={tracks:[{id:'exp',title:'Afterlife',author:'Evanescence',dur:240,art:'/qa-art.jpg'}],idx:0};
  E.time=()=>37;E.dur=()=>240;updateNow();go({r:'home'});
 });await page.waitForTimeout(600);await page.screenshot({path:out+'/panel12-art-home.png'});
 assert.equal(await page.locator('.clean-now-card img').evaluate(i=>i.complete&&i.naturalWidth>0),true);
 await page.evaluate(()=>{lib.setTab='look';go({r:'settings'});});await page.waitForTimeout(300);
 await page.locator('.clean-setting-picker>summary').click();await page.screenshot({path:out+'/panel12-settings-picker.png'});
 const box=await page.locator('.clean-setting-picker>nav').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=1366);const dock=await page.locator('#bar').boundingBox();assert.ok(box.y+box.height<dock.y);
 await page.locator('.clean-setting-picker [data-stab="audio"]').click();await page.waitForTimeout(200);assert.equal(await page.locator('.clean-setting-picker').evaluate(e=>e.open),false);assert.equal(await page.locator('.clean-setting-picker>summary span').innerText(),'Звук');
 await page.evaluate(()=>{go({r:'home'});Object.assign(S().perf,{gpu:true,fps:60,mode:'high',showFps:false,bgSlow:false});Viz.setGpu(true);Object.assign(S().viz,{directExperiment:false,neonExperiment:true,edge:'fade'});lib.vizStyle='radial';lib.mode='visual';openPP();updateMode();updateButtons();const f=new Uint8Array(1024);for(let i=0;i<f.length;i++)f[i]=Math.round(90+65*Math.sin(i*.08));window.qaSpectrum={f,w:new Uint8Array(2048).fill(128),sampleRate:48000,fftSize:2048};readSpectrum=()=>qaSpectrum;});
 await page.waitForFunction(()=>Viz.stats().path==='WebGL direct',{},{timeout:30000});await page.waitForTimeout(900);
 assert.equal(await page.locator('#pp>.pp-side').isVisible(),false);assert.equal(await page.locator('#cleanStageHeader button').isVisible(),true);
 assert.equal(await page.locator('#vizDirect').isVisible(),true);assert.ok(await page.evaluate(()=>Viz.stats().directFrames>5));
 for(const size of [{width:1366,height:768},{width:980,height:640},{width:1680,height:960}]){await page.setViewportSize(size);await page.waitForTimeout(400);const p=await page.locator('#cleanStageHeader button').boundingBox();assert.ok(p.x>=0&&p.x+p.width<=size.width&&p.y>=0&&p.y+p.height<=size.height);await page.screenshot({path:out+'/panel12-neon-'+size.width+'.png'});}
 await page.setViewportSize({width:1366,height:768});await page.locator('#cleanStageHeader button').click();assert.equal(await page.locator('body.pp-open').count(),0);
 await page.locator('#btnCleanTools').click();await page.screenshot({path:out+'/panel12-studio.png'});await page.keyboard.press('Escape');
 await page.evaluate(()=>{S().ui.variant='full';settingChanged('ui.variant');});assert.equal(await page.locator('.clean-setting-picker').count(),0);assert.equal(await page.locator('#cleanStageHeader').isVisible(),false);assert.equal(await page.evaluate(()=>S().ui.variant),'full');
 assert.deepEqual(errors,[]);console.log('Panel12: artwork/palette, section picker, immersive scene and original WebGL direct visualizer passed');await browser.close();server.close();process.exit(0);
})().catch(e=>{console.error(e);server.close();process.exit(1)});
