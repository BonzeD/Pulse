// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8758,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || 'chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning'&& /GPU fallback|viz gpu|PulseGPU/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8758'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
 await page.addInitScript(()=>{
   const feed={shelves:[{title:'Тестовые треки',items:Array.from({length:14},(_,i)=>({kind:'song',id:String(i).padStart(11,'a'),title:'Тест переключения '+(i+1),author:'Pulse QA',dur:240,loaded:true}))}],chips:[]};
   const proxy=prefix=>new Proxy({}, {get(_t,k){return (...args)=>{
     if(String(k).startsWith('on'))return;
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
   window.pulse=proxy('');for(const n of ['plugins','account','svc','ytm','spicy','discord','custom','editor','wall','accounts']) Object.defineProperty(window.pulse,n,{value:proxy(n)});
   // replace proxy with explicit nested keys (proxy getter above does not read target).
   const p=proxy('');window.pulse=new Proxy({}, {get(t,k){if(['plugins','account','svc','ytm','spicy','discord','custom','editor','wall','accounts'].includes(k))return proxy(k);return p[k];}});
   localStorage.setItem('pulse.splash','off');
 });
 await page.goto('http://127.0.0.1:8758');await page.waitForTimeout(1600);


 const assert=require('node:assert/strict');
 assert.equal(await page.evaluate(()=>document.documentElement.lang),'en');
 await page.evaluate(()=>{go({r:'settings'});lib.setTab='app';rerenderSettings();});await page.waitForTimeout(850);
 assert.equal(await page.locator('[data-set="app.language"][data-v="en"]').count(),1);
 await page.screenshot({path:out+'/panel5-general-en.png'});
 const untranslated=await page.evaluate(()=>{const result=new Set();const collect=()=>{document.querySelectorAll('[title],[placeholder],[aria-label]').forEach(e=>['title','placeholder','aria-label'].forEach(a=>{const value=e.getAttribute(a);if(value&&/[А-Яа-яЁё]/.test(value)&&!e.closest('[data-set="app.language"]'))result.add(value);}));const tw=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;while(n=tw.nextNode()){if(n.parentElement.closest('script,style,code,textarea,pre,svg,[data-set="app.language"]'))continue;const s=n.nodeValue.trim();if(/[А-Яа-яЁё]/.test(s)&&n.parentElement.getBoundingClientRect().height)result.add(s);}};for(const t of allTabs()){lib.setTab=t.id;rerenderSettings();PulseI18n.walk(document.body);collect();}return [...result].sort();});fs.writeFileSync(path.join(out,'remaining-ru.json'),JSON.stringify(untranslated,null,2));console.log('Remaining strings',untranslated.length);
 await page.evaluate(()=>{go({r:'settings'});lib.setTab='app';rerenderSettings();});await page.waitForTimeout(150);
 await page.click('[data-set="app.language"][data-v="ru"]');await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>document.documentElement.lang),'ru');await page.waitForTimeout(900);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('qa.saved')).settings.app.language),'ru');await page.reload();await page.waitForTimeout(1400);assert.equal(await page.evaluate(()=>document.documentElement.lang),'ru');await page.evaluate(()=>{go({r:'settings'});lib.setTab='app';rerenderSettings();});await page.waitForTimeout(300);
 await page.click('[data-set="app.language"][data-v="en"]');await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>document.documentElement.lang),'en');
 assert.ok(await page.evaluate(()=>dsPalItems('language').some(x=>x.t==='Язык интерфейса')));
 await page.evaluate(()=>{lib.queue={tracks:[{id:'qa',title:'Главная',author:'Настройки',dur:240,art:'/logo.png'}],idx:0};updateNow();});await page.waitForTimeout(200);assert.equal(await page.locator('#bTitle').innerText(),'Главная');assert.ok((await page.locator('#bSub').innerText()).includes('Настройки'));
 await page.evaluate(()=>{S().ly.vis='classic';S().ly.kRefl=true;S().ly.kCover='right';S().ly.kParticles=false;lyStageOpen(true);lyState.lines=[{t:0,text:'Главная'}];lysMeta();});await page.waitForTimeout(500);
 await page.evaluate(()=>{if(lys.raf)cancelAnimationFrame(lys.raf);E.time=()=>3;lyState.lines=[{t:0,text:'Memory reboot',words:[{t:0,s:'Memory'},{t:1,s:'reboot'}]},{t:7,text:'Through the quiet light',words:[{t:7,s:'Through'},{t:8,s:'the quiet light'}]}];lyState.cur=0;lyState.word=1;lys.line=-9;lysSync(true);});
 for(const vis of ['classic','kinetic','stack']){await page.evaluate(v=>{S().ly.vis=v;lysApply();lysSync(true);},vis);await page.waitForTimeout(900);await page.screenshot({path:out+'/panel5-lyrics-water-'+vis+'.png'});assert.equal(await page.locator('.lys-cover-water').evaluate(e=>getComputedStyle(e).display),'block');}
 await page.evaluate(()=>{S().ly.kRefl=false;lysApply();});assert.equal(await page.locator('.lys-cover-water').evaluate(e=>getComputedStyle(e).display),'none');
 console.log('Locale/water errors',errors);assert.deepEqual(errors,[]);await browser.close();server.close();process.exit(0);
})().catch(e=>{console.error(e);server.close();process.exit(1)});
