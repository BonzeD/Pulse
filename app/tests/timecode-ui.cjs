// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8784,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning'&& /GPU fallback|viz gpu|PulseGPU/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8784'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
 let stored=null;await page.exposeFunction('__readLib',()=>stored);await page.exposeFunction('__writeLib',v=>{stored=v;return true;});
 await page.addInitScript(()=>{
   const headings=['Новинки и любимые треки','Из вашей библиотеки','Кавер-версии и ремиксы','Вы давно не слушали','Видеоклипы для вас','Миксы для вас','Плейлисты других пользователей','Playlists Made for You','Recently Played','New Releases for You','Video Game Music','Рекомендуемые станции','Только для тебя, Bon zeD','Похоже на: Casey Edwards','Альбомы с треками, которые тебе нравятся','Soundtrack your Thursday morning','Еще больше открытий: Gareth Coker'];
   const feed={shelves:headings.map((title,j)=>({title,items:[{kind:'album',browseId:'MPRE'+j,title:'Моя песня / Bon zeD / 日本語',sub:'Мой исполнитель / 日本語',art:'/logo.png'}]})),chips:['Заряд энергии','Веселье','Релакс','Тренировки','В дороге','Концентрация','Романтика','Грусть','Сон'].map((title,i)=>({title,params:String(i)}))};
   window.__catalogCalls=[];
   const proxy=prefix=>new Proxy({}, {get(_t,k){return (...args)=>{
     if(String(k).startsWith('on'))return;
     if(k==='getLibrary')return __readLib().then(s=>s||{settings:{look:{splash:false},app:{language:'ja'},perf:{showFps:false},ui:{glass:true,glassOp:60}}});if(k==='saveLibrary'||k==='flushLibrary')return __writeLib(args[0]);
     if(k==='list'||k==='playlists'||k==='downloads'||k==='displays')return Promise.resolve([]);
     if(k==='offlineList')return Promise.resolve({});
     if(k==='status')return Promise.resolve({am:{},sp:{}});
     if(k==='info')return Promise.resolve(null);
     if(k==='version')return Promise.resolve('1.0.0');
     if(k==='lyrics')return Promise.resolve({none:true});
     if(k==='setClient'){window.__catalogLanguage=args[1]?.language;window.__catalogCalls.push(['set',args[0],args[1]?.language]);return Promise.resolve(args[0]);} if(k==='feed'){window.__catalogCalls.push(['feed',window.__catalogLanguage]);return Promise.resolve(feed);}
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
 await page.goto('http://127.0.0.1:8784');await page.waitForFunction(()=>window.PulseGlass&&document.querySelector('.page'));await page.waitForTimeout(900);

 const assert=require('node:assert/strict');
 await page.evaluate(()=>{window.__clock=6.53;window.__seeks=0;window.__plays=0;E.time=()=>window.__clock;E.dur=()=>240.67;E.seek=()=>window.__seeks++;toggle=()=>window.__plays++;playing=false;PulseTimecode.update(E.time(),E.dur());});
 const time=page.locator('#bar .time[data-precise-time]');await time.waitFor({state:'visible'});assert.equal(await page.locator('#tCur').innerText(),'0:06');
 await time.click();assert.equal(await page.locator('#tCur').innerText(),'00:06.53');assert.equal(await page.locator('#tDur').innerText(),'04:00.67');assert.equal(await time.getAttribute('aria-pressed'),'true');
 await time.press('Space');assert.equal(await time.getAttribute('aria-pressed'),'false');await time.press('Enter');assert.equal(await time.getAttribute('aria-pressed'),'true');
 await page.evaluate(()=>{window.__clock=59.999;PulseTimecode.update(E.time(),E.dur());});assert.equal(await page.locator('#tCur').innerText(),'00:59.99');
 await page.evaluate(()=>{window.__clock=60;PulseTimecode.update(E.time(),E.dur());});assert.equal(await page.locator('#tCur').innerText(),'01:00.00');
 for(const width of [1366,1919]){
  await page.setViewportSize({width,height:768});const t=await time.boundingBox(),bar=await page.locator('#bar').boundingBox();assert.ok(t.x>=bar.x&&t.x+t.width<=bar.x+bar.width+.5,JSON.stringify({t,bar}));
 }
 await page.setViewportSize({width:1366,height:768});await page.evaluate(()=>{lib.queue={tracks:[{id:'abcdefghijk',title:'QA song',author:'Pulse QA',dur:240.67}],idx:0};updateNow();openPP();});await page.waitForTimeout(150);await time.click();assert.equal(await time.getAttribute('aria-pressed'),'false');await time.click();assert.equal(await time.getAttribute('aria-pressed'),'true');
 await page.evaluate(()=>{S().ly.vis='classic';S().ly.kBar='on';lyStageOpen(true);});await page.waitForTimeout(150);assert.ok(await time.isVisible());await time.click();await time.press('Enter');assert.equal(await time.getAttribute('aria-pressed'),'true');
 assert.equal(await page.evaluate(()=>window.__seeks),0);assert.equal(await page.evaluate(()=>window.__plays),0);
 await page.screenshot({path:out+'/timecode-precise-lyrics-1366.png'});
 await page.reload();await page.waitForFunction(()=>window.PulseTimecode&&document.querySelector('[data-precise-time]'));assert.equal(await time.getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#tCur').innerText(),'00:00.00');assert.doesNotMatch(await time.getAttribute('title'),/[А-Яа-яЁё]/);
 assert.deepEqual(errors,[]);console.log('PASS precise timecode: click, Enter/Space, hundredths, minute boundaries, main/full/lyrics player, 1366/1919, persistence, no seeks or transport changes.');
 await browser.close();server.close();process.exit(0);
})().catch(e=>{console.error(e);server.close();process.exit(1);});
