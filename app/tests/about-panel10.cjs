// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8766,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || 'chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning'&& /GPU fallback|viz gpu|PulseGPU/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8766'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
 await page.addInitScript(()=>{
   const feed={shelves:[{title:'Тестовые треки',items:Array.from({length:14},(_,i)=>({kind:'song',id:String(i).padStart(11,'a'),title:'Тест переключения '+(i+1),author:'Pulse QA',dur:240,loaded:true}))}],chips:[]};
   const proxy=prefix=>new Proxy({}, {get(_t,k){return (...args)=>{
     if(String(k).startsWith('on'))return;
     if(k==='openUrl'){(window.qaOpened||(window.qaOpened=[])).push(args[0]);return;}
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
   localStorage.setItem('pulse.splash','off');localStorage.setItem('pulse.language','ru');
 });
 await page.goto('http://127.0.0.1:8766');await page.waitForTimeout(1600);

 const assert=require('node:assert/strict');
 await page.evaluate(()=>{S().app.language='ru';PulseI18n.setLanguage('ru');go({r:'settings'});});await page.waitForTimeout(500);
 await page.locator('[data-stab="about"]').click();await page.waitForTimeout(350);
 assert.equal(await page.locator('[data-stab="about"]').evaluate(e=>e.classList.contains('on')),true);
 assert.equal((await page.locator('.pulse-about .about-name').innerText()).replace(/\s+/g,' '),'Pulse 1.0.0');
 assert.equal(await page.locator('.about-license').evaluate(e=>e.open),false);
 assert.equal(await page.locator('a[data-about-url]').count(),2);
 await page.screenshot({path:out+'/panel10-about-1366-ru.png'});
 await page.locator('.about-license>summary').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/panel10-thanks-1366-ru.png'});
 await page.locator('a[data-about-url="https://github.com/oirge"]').click();await page.locator('a[data-about-url="https://github.com/spicylyrics"]').click();
 assert.deepEqual(await page.evaluate(()=>qaOpened),['https://github.com/oirge','https://github.com/spicylyrics']);
 await page.locator('.about-license>summary').focus();await page.keyboard.press('Enter');
 assert.equal(await page.locator('.about-license').evaluate(e=>e.open),true);
 assert.equal(await page.locator('.about-license-text').first().textContent(),fs.readFileSync(path.join(root,'..','LICENSE'),'utf8'));
 await page.locator('.about-license').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/panel10-license-1366-ru.png'});
 await page.locator('.about-license-text').first().focus();await page.keyboard.press('PageDown');await page.waitForTimeout(250);assert.ok(await page.locator('.about-license-text').first().evaluate(e=>e.scrollTop>0));
 await page.evaluate(()=>PulseI18n.setLanguage('en'));await page.waitForTimeout(200);
 assert.equal(await page.locator('[data-stab="about"]').innerText(),'About');
 assert.equal(await page.locator('.about-license>summary>span').first().innerText(),'License');
 assert.equal(await page.locator('.about-license-text').first().textContent(),fs.readFileSync(path.join(root,'..','LICENSE'),'utf8'));
 await page.evaluate(()=>{$('view').scrollTop=0;});await page.screenshot({path:out+'/panel10-about-1366-en.png'});
 await page.evaluate(()=>PulseI18n.setLanguage('ru'));await page.waitForTimeout(150);
 for(const size of [{width:980,height:640},{width:1680,height:960}]){
  await page.setViewportSize(size);await page.evaluate(()=>{$('view').scrollTop=0;document.querySelector('.about-license').open=false;});await page.waitForTimeout(200);
  const g=await page.evaluate(()=>{const p=document.querySelector('.pulse-about'),r=p.getBoundingClientRect();return{page:document.documentElement.scrollWidth,view:innerWidth,content:p.scrollWidth,width:p.clientWidth,right:r.right};});assert.ok(g.page<=g.view&&g.content<=g.width+1&&g.right<=g.view);console.log('About geometry',size,g);
  await page.screenshot({path:out+'/panel10-about-'+size.width+'-ru.png'});
  await page.locator('.about-license>summary').click();assert.equal(await page.locator('.about-license').evaluate(e=>e.open),true);await page.locator('.about-license').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/panel10-license-'+size.width+'-ru.png'});
 }
 await page.locator('.about-notices>summary').click();assert.equal(await page.locator('.about-notices pre').textContent(),fs.readFileSync(path.join(root,'..','NOTICE.md'),'utf8'));
 assert.deepEqual(errors,[]);console.log('About navigation, author links, GPL offline/verbatim, keyboard, RU/EN and responsive tests passed');await browser.close();server.close();process.exit(0);
})().catch(e=>{console.error(e);server.close();process.exit(1)});
