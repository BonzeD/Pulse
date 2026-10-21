// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8770,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning'&& /GPU fallback|viz gpu|PulseGPU/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8770'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
 let stored=null;await page.exposeFunction('__readLib',()=>stored);await page.exposeFunction('__writeLib',v=>{stored=v;return true;});
 await page.addInitScript(()=>{
   const feed={shelves:Array.from({length:36},(_,j)=>({title:'Полка '+(j+1),items:Array.from({length:20},(_,i)=>({kind:'album',browseId:'MPRE'+j+'-'+i,id:'album'+j+'-'+i,title:'Альбом '+(j+1)+' — '+(i+1),art:'/logo.png',sub:'Pulse QA'}))})),chips:[]};
   const proxy=prefix=>new Proxy({}, {get(_t,k){return (...args)=>{
     if(String(k).startsWith('on'))return;
     if(k==='getLibrary')return __readLib().then(s=>s||{settings:{look:{splash:false},app:{language:'ru'},perf:{showFps:false},ui:{glass:true,glassOp:60}}});if(k==='saveLibrary'||k==='flushLibrary')return __writeLib(args[0]);
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
     if(k==='openUrl'){window.__opened=(window.__opened||[]).concat(args[0]);return Promise.resolve(true);}if(k==='getGlass')return Promise.resolve({});
     return Promise.resolve({});
   };}});
   window.pulse=proxy('');for(const n of ['plugins','account','svc','ytm','spicy','discord','custom','editor','wall','accounts']) Object.defineProperty(window.pulse,n,{value:proxy(n)});
   // replace proxy with explicit nested keys (proxy getter above does not read target).
   const p=proxy('');window.pulse=new Proxy({}, {get(t,k){if(['plugins','account','svc','ytm','spicy','discord','custom','editor','wall','accounts'].includes(k))return proxy(k);return p[k];}});
   localStorage.setItem('pulse.splash','off');
 });
 await page.goto('http://127.0.0.1:8770');await page.waitForFunction(()=>window.PulseGlass&&document.querySelector('.page'));await page.waitForTimeout(900);
 const assert=require('node:assert/strict');
 async function settings(){await page.evaluate(()=>{closePP();go({r:'settings'});});await page.locator('#setBody').waitFor();await page.waitForTimeout(120);await page.evaluate(()=>{lib.setTab='look';S().ui.setMode='simple';rerenderSettings();});await page.locator('.surface-options').waitFor({timeout:5000});}
 async function mode(v){await page.locator('[data-sel="ui.surfaceMaterial"]').click();await page.locator('.pulse-select-menu [data-option="'+(v==='liquid'?1:0)+'"]').click();await page.waitForFunction(v=>document.body.dataset.surfaceMaterial===v,v);await page.waitForTimeout(500);}



 await page.waitForFunction(()=>document.querySelectorAll('#page>.shelf').length>=36);await page.waitForTimeout(600);
 assert.equal(await page.locator('#page .card').count(),720);
 const visible=await page.locator('#page>.shelf').evaluateAll(es=>es.filter(e=>e.querySelector('.card').checkVisibility({contentVisibilityAuto:true})).length);assert.ok(visible<12,'offscreen shelves must skip rendering: '+visible);
 await page.evaluate(()=>{S().ui.surfaceMaterial='liquid';applyCustom();});await page.waitForSelector('#bar[data-glass-lens]');const cachedLens=await page.locator('#bar').evaluate(e=>getComputedStyle(e).backdropFilter);assert.match(cachedLens,/url\(/);
 await page.locator('#view').evaluate(e=>e.scrollTop=1300);await page.waitForFunction(()=>document.body.hasAttribute('data-home-scrolling'));
 assert.equal(await page.locator('#bar').evaluate(e=>getComputedStyle(e).backdropFilter),cachedLens,'keep the cached optical lens active during Home scroll');
 await page.waitForTimeout(230);assert.equal(await page.evaluate(()=>document.body.hasAttribute('data-home-scrolling')),false);assert.match(await page.locator('#bar').evaluate(e=>getComputedStyle(e).backdropFilter),/url\(/,'cached lens remains active');
 await page.screenshot({path:out+'/home-optimized-1366.png'});
 await settings();await page.waitForFunction(()=>document.body.dataset.page==='settings');
 await page.evaluate(()=>{lib.setTab='other';rerenderSettings();});await page.waitForTimeout(350);
 for(const width of [1366,390])for(const variant of ['full','clean']){
  await page.setViewportSize({width,height:width===390?844:768});await page.evaluate(v=>{S().ui.variant=v;S().ui.bg='#26080f';S().ui.panel='#311026';applyCustom();rerenderSettings();},variant);await page.waitForTimeout(300);
  const g=await page.locator('#setBody').evaluate(e=>({mask:getComputedStyle(e).maskImage,pad:getComputedStyle(e).paddingBottom,card:getComputedStyle(e.querySelector('.set-card')).backgroundColor,token:getComputedStyle(e).getPropertyValue('--ds-s1').trim()}));assert.match(g.mask,/linear-gradient/);assert.equal(g.card,'rgba(255, 255, 255, 0.035)');
  await page.locator('#setBody').evaluate(e=>e.scrollTop=350);await page.waitForTimeout(200);await page.screenshot({path:out+`/settings-theme-fade-${width}-${variant}.png`});
 }
 await page.setViewportSize({width:1366,height:768});await page.evaluate(()=>{lib.setTab='about';rerenderSettings();});await page.waitForTimeout(200);
 for(const [name,url] of [['werxapee','https://github.com/BonzeD'],['Daswi','https://github.com/daswiccii-cloud']]){const a=page.locator('.about-author a').filter({hasText:name});assert.equal(await a.getAttribute('href'),url);await a.click();assert.equal(await page.evaluate(()=>window.__opened.at(-1)),url);}
 await page.screenshot({path:out+'/authors-links-1366.png'});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/authors-links-390.png'});
 await page.emulateMedia({forcedColors:'active'});assert.equal(await page.locator('#setBody').evaluate(e=>getComputedStyle(e).maskImage),'none');
 assert.deepEqual(errors,[]);console.log('PASS Home: 720 cards preserved, offscreen render skipped, cached scroll optics stay active; themed settings and fade 1366/390 full/clean; author links open correct URLs; forced colors');await browser.close();server.close();process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
