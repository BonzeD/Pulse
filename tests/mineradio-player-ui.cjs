// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8760,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || chromium.executablePath(),headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning'&& /GPU fallback|viz gpu|PulseGPU/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8760'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
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
 await page.goto('http://127.0.0.1:8760');await page.waitForTimeout(1600);


 const assert=require('node:assert/strict');page.setDefaultTimeout(8000);
 try {
 await page.evaluate(()=>{lib.queue={tracks:[{id:'mrhover',title:'MineRadio hover QA',author:'Pulse QA',dur:240,art:'/logo.png'}],idx:0};playing=true;E.time=()=>10;E.dur=()=>240;S().ly.vis='mineradio';S().ly.mrQuality='eco';S().ly.mrFps=15;S().ly.mrKeep=true;lyStageOpen(true);updateNow();});
 await page.waitForFunction(()=>window.mrActive&&mrActive(),{},{timeout:120000});
 const frame=page.frames().find(f=>f.url().includes('/mineradio/index.html'));
 await frame.waitForFunction(()=>window.__pulse,{},{timeout:120000});
 await page.evaluate(()=>{S().ui.playerBarHidden=false;S().ly.kBar='on';lybSync();});
 await page.waitForTimeout(600);await page.click('#btnBarHide');await page.waitForTimeout(600);
 const hidden=async()=>{await page.waitForTimeout(300);assert.equal(await page.locator('#btnBarShow').evaluate(e=>getComputedStyle(e).opacity),'0');};
 await page.mouse.move(250,300);await hidden();
 // One rapid final move into the actual iframe, not a synthetic host event.
 await page.mouse.move(680,740);await page.waitForTimeout(400);
 assert.equal(await page.locator('#btnBarShow').evaluate(e=>getComputedStyle(e).opacity),'1','MineRadio must forward real pointer coordinates to the reveal zone');
 console.log('PASS actual MineRadio iframe hover reveals player');
 await page.screenshot({path:out+'/mineradio-player-reveal.png'});
 await page.click('#btnBarShow');await page.waitForTimeout(600);
 assert.equal(await page.locator('#bar').evaluate(e=>e.inert),false);
 console.log('PASS reveal button opens the player and is clickable above MineRadio');
 await page.click('#btnBarHide');await page.waitForTimeout(500);
 for(const [x,y] of [[50,740],[1300,740],[680,400]]){await page.mouse.move(x,y);await hidden();}
 await page.mouse.move(680,740);await page.waitForFunction(()=>getComputedStyle(document.getElementById('btnBarShow')).opacity==='1');
 assert.equal(await page.locator('#btnBarShow').evaluate(e=>getComputedStyle(e).opacity),'1');
 await page.mouse.move(680,600);await hidden();console.log('PASS fast final move is delivered and leaving hover region hides button');
 await page.keyboard.press('Control+Shift+B');await page.waitForTimeout(600);
 assert.equal(await page.locator('#bar').evaluate(e=>e.inert),false);console.log('PASS keyboard recovery inside MineRadio');
 for(const size of [{width:980,height:640},{width:1920,height:1080}]){
  await page.setViewportSize(size);await page.waitForTimeout(500);
  await page.click('#btnBarHide');await page.waitForTimeout(550);
  await page.mouse.move(40,200);await hidden();
  await page.mouse.move(size.width/2,size.height-25);
  await page.waitForFunction(()=>getComputedStyle(document.getElementById('btnBarShow')).opacity==='1');
  await page.click('#btnBarShow');await page.waitForTimeout(600);
  assert.equal(await page.locator('#bar').evaluate(e=>e.inert),false);
 }
 console.log('PASS actual iframe recovery at 980x640 and 1920x1080');
 assert.deepEqual(errors,[]);
 } finally { await browser.close();server.close(); }
})().catch(e=>{console.error(e);server.close();process.exit(1);});
