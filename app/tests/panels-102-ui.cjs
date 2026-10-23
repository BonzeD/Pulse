// 1.0.2: real renderer panel entry/exit, draft and accessibility regressions.
const assert=require('node:assert/strict'),fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8783,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning'&& /GPU fallback|viz gpu|PulseGPU/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8783'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
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
     if(k==='version')return Promise.resolve('1.0.2');
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
 await page.goto('http://127.0.0.1:8783');await page.waitForFunction(()=>window.PulseGlass&&document.querySelector('.page'));await page.waitForTimeout(900);


 let checks=0;
 await page.evaluate(()=>{lib.queue={tracks:[{id:'abcdefghijk',title:'Motion QA',author:'Pulse QA',art:'/logo.png',dur:240}],idx:0};updateNow();openPP();setTab('lyrics');S().look.anim=true;document.body.classList.remove('no-anim');});
 for(const size of [{width:1366,height:768},{width:390,height:844}]){
 await page.setViewportSize(size);await page.evaluate(w=>{document.body.classList.toggle('ui-clean',w<900);document.body.classList.toggle('clean-panel-only',w<900);},size.width);await page.waitForTimeout(450);
 await page.evaluate(()=>{closeFix();PulseMotion.stop();void document.querySelector('#lyFix').offsetWidth;openFix('text');});
 const opening=await page.locator('#lyFix').evaluate(async e=>{const a=e.getAnimations();for(const x of a){x.pause();x.currentTime=80;}await new Promise(requestAnimationFrame);return{opacity:+getComputedStyle(e).opacity,animations:a.length,details:a.map(x=>({name:x.transitionProperty,time:x.currentTime,frames:x.effect.getKeyframes()})),display:getComputedStyle(e).display,cls:e.className,inert:e.inert};});assert.ok(opening.opacity>0&&opening.opacity<1);assert.ok(opening.animations>0);assert.equal(opening.inert,false);checks+=3;
 await page.screenshot({path:out+`/panels-102-mid-${size.width}.png`});await page.locator('#lyFix').evaluate(e=>e.getAnimations().forEach(a=>a.finish()));
 await page.waitForTimeout(270);await page.screenshot({path:out+`/panels-102-fix-${size.width}.png`});
 await page.locator('#fxText').fill('Unfinished draft 日本語');await page.evaluate(()=>closeFix());
 const leaving=await page.locator('#lyFix').evaluate(e=>({display:getComputedStyle(e).display,inert:e.inert,hidden:e.getAttribute('aria-hidden')}));assert.equal(leaving.display,'flex');assert.equal(leaving.inert,true);assert.equal(leaving.hidden,'true');checks+=3;
 await page.waitForTimeout(300);assert.equal(await page.locator('#lyFix').evaluate(e=>getComputedStyle(e).display),'none');checks++;
 await page.evaluate(()=>openFix('text'));await page.waitForTimeout(270);assert.equal(await page.locator('#fxText').inputValue(),'Unfinished draft 日本語');checks++;
 await page.locator('[data-fx="tab:time"]').click();assert.ok(await page.locator('#lyFix .fx-body').evaluate(e=>e.getAnimations().length>0));checks++;
 await page.evaluate(()=>closeFix());await page.waitForTimeout(300);
 await page.locator('#lyLookBtn').click();await page.waitForTimeout(280);await page.screenshot({path:out+`/panels-102-look-${size.width}.png`});
 await page.evaluate(()=>closeLyPop());assert.ok(await page.locator('#lyPop').evaluate(e=>e.childElementCount>0&&e.inert));checks++;
 // Reopen during the exit: an old cleanup must not erase the new controls.
 await page.waitForTimeout(60);await page.locator('#lyLookBtn').click();await page.waitForTimeout(320);assert.ok(await page.locator('#lyPop').evaluate(e=>e.classList.contains('on')&&e.childElementCount>0&&!e.inert));checks++;
 await page.evaluate(()=>closeLyPop());await page.waitForTimeout(300);assert.equal(await page.locator('#lyPop').evaluate(e=>e.childElementCount),0);assert.equal(await page.evaluate(()=>PulseMotion.stats().panels),0);checks+=2;
 }
 // Accessibility: preference changes settle cleanup immediately; no transition/background loop.
 await page.evaluate(()=>{document.body.classList.add('no-anim');openFix('text');});assert.equal(await page.locator('#lyFix').evaluate(e=>e.getAnimations().length),0);await page.evaluate(()=>closeFix());assert.equal(await page.locator('#lyFix').evaluate(e=>getComputedStyle(e).display),'none');checks+=2;
 await page.evaluate(()=>document.body.classList.remove('no-anim'));await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>openFix('text'));assert.equal(await page.locator('#lyFix').evaluate(e=>e.getAnimations().length),0);await page.evaluate(()=>closeFix());assert.equal(await page.locator('#lyFix').evaluate(e=>getComputedStyle(e).display),'none');checks+=2;
 assert.deepEqual(errors,[]);console.log(JSON.stringify({checks,errors},null,2));await browser.close();server.close();process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
