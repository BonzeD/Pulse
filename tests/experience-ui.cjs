// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8758,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning'&& /GPU fallback|viz gpu|PulseGPU/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8758'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
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
 await page.goto('http://127.0.0.1:8758');await page.waitForTimeout(1600);

 page.setDefaultTimeout(120000);const assert=require('node:assert/strict');
 assert.deepEqual(errors,[]);
 const home=await page.evaluate(()=>({parent:$('bar').parentElement.tagName,html:$('bar').outerHTML.length}));
 await page.evaluate(()=>{S().ly.vis='classic';S().ly.kBar='on';lyState.lines=[{t:0,end:60,text:'Your music. In focus.',words:[{t:0,s:'Your'},{t:1,s:'music.'}]}];lyState.cur=0;lyStageOpen(true);});
 await page.waitForTimeout(300);
 await page.mouse.move(820,500);await page.screenshot({path:out+'/native-text.png'});
 await page.evaluate(()=>PulseImmersion.open());await page.waitForFunction(()=>PulseImmersion.stats().draws>0,null,{timeout:30000});
 await page.evaluate(()=>{$('lyStage').classList.add('lyb-pin');});
 await page.waitForTimeout(1200);
 assert.equal(await page.locator('#immersion').count(),0);
 assert.equal(await page.locator('#btnImmersionNav,#btnImmersionPlayer').count(),0);
 assert.equal(await page.locator('#lyStage .lys-scene').count(),1);
 assert.deepEqual(await page.locator('[data-scene="world"] option').evaluateAll(es=>es.map(e=>e.value)),['orbit','ocean','sakura']);
 assert.equal(await page.evaluate(()=>getComputedStyle($('lysWrap')).display),'none');
 assert.equal(await page.evaluate(()=>$('bar').parentElement.tagName),home.parent);
 assert.equal(await page.locator('#bar').count(),1);
 await page.screenshot({path:out+'/immersion-orbit.png'});
 await page.selectOption('[data-scene="world"]','ocean');await page.waitForTimeout(1800);
 assert.equal(await page.evaluate(()=>PulseImmersion.stats().world),1);
 await page.mouse.move(1100,400);await page.waitForTimeout(250);
 await page.screenshot({path:out+'/immersion-ocean.png'});
 await page.selectOption('[data-scene="world"]','sakura');await page.waitForFunction(()=>PulseImmersion.stats().renderer.cinema==='sakura-glade');await page.waitForTimeout(1200);assert.equal(await page.evaluate(()=>PulseImmersion.stats().world),3);await page.screenshot({path:out+'/sakura-native-stage-desktop.png'});
 await page.selectOption('[data-scene="quality"]','eco');await page.waitForTimeout(250);
 assert.equal(await page.evaluate(()=>PulseImmersion.stats().eco),true);
 // Native mode switching destroys the scene and never removes transport controls.
 await page.click('[data-lys="vis:classic"]');await page.waitForTimeout(250);
 assert.equal(await page.locator('.lys-scene').count(),0);
 assert.equal(await page.evaluate(()=>PulseImmersion.active()),false);
 console.log('Re-entering Sakura after classic');await page.click('[data-lys="vis:immersion"]');console.log('Re-entered Sakura');await page.waitForTimeout(350);
 await page.keyboard.press('Escape');await page.waitForTimeout(150);
 assert.equal(await page.evaluate(()=>lys.on),false);
 assert.equal(await page.locator('.lys-scene').count(),0);
 // Small viewport and keyboard-driven native UI.
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>PulseImmersion.open());await page.waitForTimeout(600);
 await page.evaluate(()=>{$('lyStage').classList.add('lyb-pin');});
 const bounds=await page.locator('#lyStage .lys-ui').boundingBox();
 assert.ok(bounds.x>=0 && bounds.x+bounds.width<=391,JSON.stringify(bounds));
 const controls=await page.evaluate(()=>{const b=$('bar').getBoundingClientRect();return ['btnPrev','btnPlay','btnNext','btnLybQueue','btnMute','btnLybView'].map(id=>{const r=$(id).getBoundingClientRect();return {id,visible:r.width>=40&&r.height>=40,inside:r.left>=b.left&&r.right<=b.right&&r.top>=b.top&&r.bottom<=b.bottom};});});
 assert.ok(controls.every(c=>c.visible&&c.inside),JSON.stringify(controls));
 await page.screenshot({path:out+'/immersion-mobile.png'});
 await page.evaluate(()=>lyStageOpen(false));
 await page.setViewportSize({width:1366,height:768});
 // Honor motion preferences and GPU-disabled state with a recoverable error.
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.evaluate(()=>{S().perf.gpu=false;PulseImmersion.open();});await page.waitForTimeout(150);
 assert.equal(await page.locator('.lys-scene-error').count(),1);
 assert.equal(await page.evaluate(()=>PulsePointer.position()),null);
 await page.screenshot({path:out+'/immersion-error.png'});
 await page.click('[data-lys="vis:classic"]');
 assert.equal(await page.locator('.lys-scene-error').count(),0);
 await page.evaluate(()=>lyStageOpen(false));
 assert.deepEqual(errors,[]);
 fs.writeFileSync(out+'/experience-results.json',JSON.stringify({errors,worlds:2,nativeTransport:true,mobileControls:true,errorRecovery:true,reducedMotion:true},null,2));
 console.log('Experience integration checks passed.');
 await browser.close();server.close();process.exit(0);
})().catch(e=>{console.error(e);server.close();process.exit(1)});
