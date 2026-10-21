// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8765,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || chromium.executablePath(),headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning'&& /GPU fallback|viz gpu|PulseGPU/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8765'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
 await page.addInitScript(()=>{
   const feed={shelves:[{title:'Тестовые треки',items:Array.from({length:14},(_,i)=>({kind:'song',id:String(i).padStart(11,'a'),title:'Тест переключения '+(i+1),author:'Pulse QA',dur:240,loaded:true}))}],chips:[]};
   const proxy=prefix=>new Proxy({}, {get(_t,k){return (...args)=>{
     if(String(k).startsWith('on'))return;
     if(k==='getLibrary')return Promise.resolve({settings:{look:{splash:true},perf:{showFps:false},ui:{panels:true}}});
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
   localStorage.setItem('pulse.splash','on');
 });

 const assert=require('node:assert/strict');
 // Freeze application timers while screenshots are captured: a busy host must not auto-dismiss the test fixture.
 await page.clock.install();await page.clock.pauseAt(new Date());
 await page.goto('http://127.0.0.1:8765');await page.clock.runFor(650);assert.equal(await page.locator('#splash').count(),1);
 await page.screenshot({path:out+'/motion-splash-live.png'});
 await page.evaluate(()=>{for(const e of document.querySelectorAll('#splash .sp-word b,#splash .sp-tri'))for(const a of e.getAnimations()){a.pause();a.currentTime=1500;}});
 assert.ok(await page.locator('#splash .sp-word b').evaluateAll(es=>es.every(e=>+getComputedStyle(e).opacity===1)),'All letters finish before the shortened intro ends');
 await page.screenshot({path:out+'/motion-splash-word.png'});
 await page.evaluate(()=>document.getElementById('splash').click());await page.clock.runFor(130);await page.screenshot({path:out+'/motion-splash-exit.png'});
 await page.clock.runFor(700);assert.equal(await page.locator('#splash').count(),0);
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>sessionStorage.removeItem('pulse.splashShown'));await page.reload();assert.equal(await page.locator('#splash').count(),0,'OS reduced motion skips splash entirely');
 await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>{sessionStorage.removeItem('pulse.splashShown');localStorage.setItem('pulse.motion','off');});await page.reload();assert.equal(await page.locator('#splash').count(),0,'Cached disabled animation preference skips splash');
 assert.deepEqual(errors,[]);await browser.close();server.close();console.log('Splash entrance/exit and OS/cached reduced motion passed');process.exit(0);
})().catch(e=>{console.error(e);server.close();process.exit(1)});
