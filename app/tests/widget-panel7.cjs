// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');if(req.url==='/qa-art.jpg'){res.setHeader('Content-Type','image/jpeg');fs.createReadStream(path.join(__dirname,'fixtures/water-art.jpg')).pipe(res);return;}
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8762,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || 'chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning'&& /GPU fallback|viz gpu|PulseGPU/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8762'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
 await page.addInitScript(()=>{
   const feed={shelves:[{title:'Тестовые треки',items:Array.from({length:14},(_,i)=>({kind:'song',id:String(i).padStart(11,'a'),title:'Тест переключения '+(i+1),author:'Pulse QA',dur:240,loaded:true}))}],chips:[]};
   const proxy=prefix=>new Proxy({}, {get(_t,k){return (...args)=>{
     if(String(k).startsWith('on')){window.__qaHandlers[k]=args[0];return;}
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
   window.__qaHandlers={};window.pulse=proxy('');for(const n of ['plugins','account','svc','ytm','spicy','discord','custom','editor','wall','accounts']) Object.defineProperty(window.pulse,n,{value:proxy(n)});
   // replace proxy with explicit nested keys (proxy getter above does not read target).
   const p=proxy('');window.pulse=new Proxy({}, {get(t,k){if(['plugins','account','svc','ytm','spicy','discord','custom','editor','wall','accounts'].includes(k))return proxy(k);return p[k];}});
   localStorage.setItem('pulse.splash','off');
 });
 await page.goto('http://127.0.0.1:8762/widget.html');await page.waitForTimeout(1600);


 const assert=require('node:assert/strict');await page.setViewportSize({width:320,height:84});
 for(const theme of ['glass','dark','clear','neon']){
 await page.evaluate(theme=>{__qaHandlers.onWidgetConfig({size:'mini',theme,lyrics:true,shadow:true});__qaHandlers.onState({id:'qa',has:true,title:'Afterlife (from the Netflix Series)',artist:'Evanescence',art:'/qa-art.jpg',line:"You wonder why I'm",playing:true,cur:85,dur:249,volume:75});},theme);await page.waitForTimeout(500);
 const shadows=await page.locator('.w,.cover,.play,.fill').evaluateAll(es=>es.map(e=>getComputedStyle(e).boxShadow));assert.ok(shadows.every(x=>x==='none'));await page.screenshot({path:out+'/panel7-mini-'+theme+'.png',omitBackground:true});}
 // 1.0.0: system reduced motion also freezes the decorative widget EQ.
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await page.locator('.eq i').first().evaluate(e=>getComputedStyle(e).animationName),'none');
 await page.emulateMedia({reducedMotion:'no-preference'});
 assert.notEqual(await page.locator('.eq i').first().evaluate(e=>getComputedStyle(e).animationName),'none');
 console.log('All four mini themes are shadow-free',errors);assert.deepEqual(errors,[]);await browser.close();server.close();process.exit(0);
})().catch(e=>{console.error(e);server.close();process.exit(1)});
