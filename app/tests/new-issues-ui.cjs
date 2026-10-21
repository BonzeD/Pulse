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

 const assert=require('node:assert/strict');page.setDefaultTimeout(10000);
 const qa=async(name,fn)=>{await fn();console.log('PASS',name);};
 try {
 await qa('real track-menu click copies YouTube link with document clipboard unavailable',async()=>{
  await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.reject(Error('unfocused'))},configurable:true}); trackMenu({id:'abcdefghijk',title:'Трек',author:'QA'},650,400);});
  await page.locator('#menu .mi').filter({hasText:'Копировать ссылку'}).click();await page.waitForFunction(()=>window.__copied==='https://music.youtube.com/watch?v=abcdefghijk');
 });
 await qa('Spotify menu uses its own service URL and errors do not claim success',async()=>{
  await page.evaluate(()=>trackMenu({id:'sp:abc',title:'Spotify',author:'QA'},650,400));await page.locator('#menu .mi').filter({hasText:'Копировать ссылку'}).click();await page.waitForFunction(()=>window.__copied==='https://open.spotify.com/track/abc');
  await page.evaluate(()=>{window.__copyFail=true;trackMenu({id:'abcdefghijk',title:'Трек'},650,400);});await page.locator('#menu .mi').filter({hasText:'Копировать ссылку'}).click();await page.waitForTimeout(300);assert.match(await page.locator('body').innerText(),/Не удалось скопировать/);
 });
 await qa('General settings exposes the active author preset at the bottom',async()=>{
  await page.evaluate(()=>{lib.setTab='app';go({r:'settings'});});await page.waitForTimeout(450);await page.locator('details.set-adv').evaluateAll(es=>es.forEach(e=>e.open=true));await page.getByRole('button',{name:'Основной пресет',exact:true}).scrollIntoViewIfNeeded();assert.ok(await page.getByRole('button',{name:'Основной пресет',exact:true}).isEnabled());await page.screenshot({path:out+'/preset-active-desktop.png'});
 });
 await qa('settings export is shareable and leaves the live key untouched',async()=>{
  await page.evaluate(()=>S().spicy.key='qa-secret');const dl=page.waitForEvent('download');await page.locator('[data-sact="export"]').click();const f=await dl;const stream=await f.createReadStream();let text='';for await(const b of stream)text+=b;const data=JSON.parse(text);assert.equal(data.settings.spicy.key,'');assert.equal(await page.evaluate(()=>S().spicy.key),'qa-secret');assert.equal(data.cues,undefined);
 });
 await qa('preset row is usable at the supported minimum window width, 980px',async()=>{
  await page.setViewportSize({width:980,height:640});await page.waitForTimeout(1200);await page.getByRole('button',{name:'Основной пресет',exact:true}).scrollIntoViewIfNeeded();await page.waitForTimeout(1000);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:out+'/preset-active-minimum.png'});
 });
 assert.deepEqual(errors,[]);console.log('NEW ISSUES UI COMPLETE');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exit(1);});
