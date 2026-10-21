// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8763,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || chromium.executablePath(),headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&/Pulse Immersion|Shader|ERROR: 0:/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8763'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
 await page.addInitScript(()=>{
   const feed={shelves:[{title:'Тестовые треки',items:Array.from({length:14},(_,i)=>({kind:'song',id:String(i).padStart(11,'a'),title:'Тест переключения '+(i+1),author:'Pulse QA',dur:240,loaded:true}))}],chips:[]};
   const proxy=prefix=>new Proxy({}, {get(_t,k){return (...args)=>{
     if(String(k).startsWith('on'))return;
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
 await page.goto('http://127.0.0.1:8763');await page.waitForTimeout(1600);


 const assert=require('node:assert/strict');page.setDefaultTimeout(90000);
 const qa=async(name,fn)=>{await fn();console.log('PASS',name);};
 try {


 await qa('disabled GPU is an explicit error with an exit',async()=>{await page.evaluate(()=>S().perf.gpu=false);await page.locator('#btnImmersionNav').click();assert.ok(await page.locator('[data-im="error"]').isVisible());await page.waitForTimeout(650);await page.screenshot({path:out+'/immersion-gpu-disabled.png'});await page.locator('[data-im="error"] [data-im-action="exit"]').click();await page.evaluate(()=>S().perf.gpu=true);});
 await qa('hidden-window signal suspends rendering and restores it on return',async()=>{await page.locator('#btnImmersionNav').click();await page.waitForTimeout(2000);await page.evaluate(()=>window.pulseWinHidden=true);await page.waitForTimeout(800);const n=await page.evaluate(()=>PulseImmersion.stats().draws);await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>PulseImmersion.stats().draws),n);await page.evaluate(()=>window.pulseWinHidden=false);await page.waitForTimeout(1000);assert.ok(await page.evaluate(()=>PulseImmersion.stats().draws)>n);});
 await qa('keyboard focus stays inside the active mode',async()=>{for(let i=0;i<15;i++){await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>!!document.activeElement.closest('#immersion')));}await page.locator('[data-im-action="help"]').click();for(let i=0;i<3;i++){await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>!!document.activeElement.closest('.im-help')));}await page.keyboard.press('Escape');});
 await qa('a lost WebGL context produces a recoverable explanation, not a black screen',async()=>{await page.evaluate(()=>document.querySelector('#immersion canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>PulseImmersion.stats().contextLost),true);assert.ok(await page.locator('[data-im="error"]').isVisible());assert.equal(await page.evaluate(()=>PulseImmersion.stats().raf),false);await page.screenshot({path:out+'/immersion-context-lost.png'});await page.locator('[data-im="error"] [data-im-action="exit"]').click();assert.equal(await page.evaluate(()=>PulseImmersion.active()),false);assert.equal(await page.locator('#side').evaluate(e=>e.inert),false);});
 assert.deepEqual(errors,[]);
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exit(1);});
