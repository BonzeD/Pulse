// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8757,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || 'chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning'&& /GPU fallback|viz gpu|PulseGPU/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8757'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
 await page.addInitScript(()=>{
   const feed={shelves:[{title:'Тестовые треки',items:Array.from({length:14},(_,i)=>({kind:'song',id:String(i).padStart(11,'a'),title:'Тест переключения '+(i+1),author:'Pulse QA',dur:240,loaded:true}))}],chips:[]};
   const proxy=prefix=>new Proxy({}, {get(_t,k){return (...args)=>{
     if(String(k).startsWith('on'))return;
     if(k==='copyText'){window.__copied=args[0];return Promise.resolve(window.__copyFail?{error:'locked'}:{ok:true});}
     if(k==='link')return Promise.resolve(window.__linkFail?null:'https://open.spotify.com/track/abc');
     if(k==='getLibrary')return Promise.resolve({settings:{app:{language:'ru'},look:{splash:false},perf:{showFps:false},ui:{panels:true}}});
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
 await page.goto('http://127.0.0.1:8757');await page.waitForTimeout(1600);

 const assert=require('node:assert/strict');
 try {
 await page.evaluate(()=>{lib.setTab='ly';go({r:'settings'});});await page.waitForTimeout(800);
 await page.locator('details.set-adv').evaluateAll(es=>es.forEach(e=>e.open=true));
 const field=page.locator('[data-txt="spicy.key"]');assert.equal(await field.count(),0);
 assert.equal(await page.locator('[data-spc="test"]').count(),0);
 // Directly inspect rendered settings through the real settings route, not a synthetic screenshot.
 await page.evaluate(()=>{go({r:'settings'});lib.setTab='ly';rerenderSettings();});await page.waitForTimeout(500);
 console.log('PASS no API key or test button in lyrics settings');
 const result=await page.evaluate(async()=>{
   const calls=[];const prior=window.pulse;const projectSpicy={lyrics:async(...args)=>{calls.push(args);return {body:{Type:'Static',Lines:[{Text:'Project lyrics'}],source:'spicy_lyrics'}};}};window.pulse=new Proxy(prior,{get:(t,k)=>k==='spicy'?projectSpicy:Reflect.get(t,k)});
   const track={id:'sp:1QV6tiMFM6fSOKOGLMHYYg',title:'QA',author:'Pulse QA',dur:240};lib.queue={tracks:[track],idx:0};S().spicy.key='';spicyOpen(true);await spLoad();return {calls,text:document.querySelector('#spicy').innerText};
 });assert.ok(result.calls.length);assert.ok(result.calls.every(x=>x.length===1));assert.match(result.text,/Project lyrics/);console.log('PASS full-screen Spicy loads without a personal key');
 await page.waitForTimeout(700);await page.screenshot({path:out+'/spicy-project-fullscreen.png'});
 await page.evaluate(()=>{spicyOpen(false);lib.setTab='ly';go({r:'settings'});});await page.waitForTimeout(500);
 // Settings tab is called ly in this build: locate it from the application mapping.
 await page.evaluate(()=>{lib.setTab='ly';rerenderSettings();});await page.waitForTimeout(500);
 await page.locator('details.set-adv').evaluateAll(es=>es.forEach(e=>e.open=true));
 await page.locator('.set-ct').filter({hasText:'Spicy Lyrics — текст из их базы'}).scrollIntoViewIfNeeded();await page.waitForTimeout(500);
 assert.equal(await page.locator('[data-txt="spicy.key"]').count(),0);await page.screenshot({path:out+'/spicy-project-settings.png'});
 console.log('PASS renderer remains responsive after project-auth lyrics');
 assert.deepEqual(errors,[]);
 } finally { await browser.close();server.close(); }
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
