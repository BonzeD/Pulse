// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
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
 await page.goto('http://127.0.0.1:8783');await page.waitForFunction(()=>window.PulseGlass&&document.querySelector('.page'));await page.waitForTimeout(900);

 const assert=require('node:assert/strict');
 assert.equal(await page.locator('html').getAttribute('lang'),'ja');
 for(const client of ['yt','am','sp'])for(const lang of ['ru','en','ja','uk']){
  await page.evaluate(async({client,lang})=>{S().app.language=lang;PulseI18n.setLanguage(lang);await syncCatalogLanguage();cache.clear();await setClient(client);await renderRoute(true);},{client,lang});
  await page.waitForFunction(()=>document.querySelectorAll('#page .sh-title').length===17);
  const got=await page.evaluate(()=>({heads:[...document.querySelectorAll('#page .sh-title')].map(e=>e.textContent),chips:[...document.querySelectorAll('#page .chip')].map(e=>e.textContent),titles:[...document.querySelectorAll('#page .ct')].map(e=>e.textContent),last:window.__catalogCalls.filter(x=>x[0]==='feed').at(-1),lang:document.documentElement.lang}));
  assert.equal(got.lang,lang);assert.equal(got.last[1],lang,client+' backend language');assert.ok(got.titles.length===17);for(const t of got.titles)assert.equal(t,'Моя песня / Bon zeD / 日本語');
  if(lang==='ja'){for(const text of [...got.heads,...got.chips])assert.match(text,/[\u3040-\u30ff\u3400-\u9fff]/,text);for(const text of got.heads)assert.doesNotMatch(text,/[А-Яа-яЁё]/,text);}
  if(lang==='en')for(const text of [...got.heads,...got.chips])assert.doesNotMatch(text,/[А-Яа-яЁё]/,text);
  if(lang==='uk')for(const text of [...got.heads,...got.chips])assert.doesNotMatch(text,/[ыэъёЫЭЪЁ]/,text);
  if(lang==='ja')await page.screenshot({path:out+'/release-101-home-'+client+'-ja-1366.png'});
 }
 await page.setViewportSize({width:390,height:844});await page.evaluate(async()=>{S().app.language='ja';PulseI18n.setLanguage('ja');await syncCatalogLanguage();cache.clear();await renderRoute(true);});await page.screenshot({path:out+'/release-101-home-ja-390.png'});
 const gpu=await page.evaluate(()=>{
  const host=document.createElement('div');document.body.append(host);const cv=document.createElement('canvas');cv.id='qa-particles';host.append(cv);
  const results=[];for(const enabled of [true,false,true,false,true]){const f=PulseParticleCanvas.frame(document.getElementById('qa-particles'),enabled,100,100,1);results.push({enabled,backend:f.renderer?'webgl':f.context?'canvas':'none'});if(f.renderer){const pb=f.renderer.buf(11);pb.set([50,50,0,4,0,1,1,1,1,0,0]);f.renderer.camera({screen:true});f.renderer.draw('pt',pb,1);}}
  host.remove();return results;
 });
 assert.deepEqual(gpu.map(x=>x.backend),['webgl','canvas','webgl','canvas','webgl']);
 await page.evaluate(()=>{S().perf.gpu=true;applySettings();S().ly.vis='immersion';lyStageOpen(true);});await page.waitForTimeout(200);
 const active=await page.evaluate(()=>PulseImmersion.stats());assert.ok(active.active);
 await page.evaluate(()=>{S().perf.gpu=false;applySettings();});assert.equal(await page.evaluate(()=>PulseImmersion.stats().raf),false);
 await page.evaluate(()=>{S().perf.gpu=true;applySettings();});await page.waitForTimeout(150);assert.ok(await page.evaluate(()=>PulseImmersion.stats().raf));
 assert.deepEqual(errors,[]);console.log('PASS release 1.0.1 UI: 3 clients x 4 languages, 17 headings + 9 chips; metadata preserved; 1366/390; real WebGL/Canvas live toggles and Immersion recovery.');
 await browser.close();server.close();process.exit(0);
})().catch(e=>{console.error(e);server.close();process.exit(1);});
