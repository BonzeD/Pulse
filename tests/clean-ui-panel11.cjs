// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8767,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || 'chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning'&& /GPU fallback|viz gpu|PulseGPU/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8767'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
 await page.addInitScript(()=>{
   const feed={shelves:[{title:'Тестовые треки',items:Array.from({length:14},(_,i)=>({kind:'song',id:String(i).padStart(11,'a'),title:'Тест переключения '+(i+1),author:'Pulse QA',dur:240,loaded:true}))}],chips:[]};
   const proxy=prefix=>new Proxy({}, {get(_t,k){return (...args)=>{
     if(String(k).startsWith('on'))return;
     if(k==='saveLibrary'){localStorage.setItem('qa.clean.saved',JSON.stringify(args[0]));return;}
     if(k==='getLibrary'&&localStorage.getItem('qa.clean.saved'))return Promise.resolve(JSON.parse(localStorage.getItem('qa.clean.saved')));
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
 await page.goto('http://127.0.0.1:8767');await page.waitForTimeout(1600);

 const assert=require('node:assert/strict');
 await page.evaluate(()=>{S().app.language='ru';PulseI18n.setLanguage('ru');S().look.anim=false;applySettings();});
 assert.equal(await page.evaluate(()=>S().ui.variant),'full');assert.equal(await page.locator('body').evaluate(b=>b.classList.contains('ui-clean')),false);
 const originalSide=await page.locator('#side').evaluate(e=>[...e.children].filter(x=>!x.classList.contains('clean-only')).map(x=>x.id||x.dataset.go||x.className));
 await page.screenshot({path:out+'/panel11-full-home.png'});
 await page.evaluate(()=>{lib.queue={tracks:[{id:'clean-test-a',title:'Океан внутри — длинное название композиции',author:'Тестовый исполнитель',dur:240,art:'/logo.png'},{id:'clean-test-b',title:'Следующая песня',author:'Другой исполнитель',dur:210,art:'/logo.png'}],idx:0,name:'Проверка чистого UI'};updateNow();window.qaCalls=[];for(const k of ['load','pause','play','seek']){E[k]=(...a)=>qaCalls.push(k);}E.time=()=>37;E.dur=()=>240;window.qaQueue=JSON.stringify(lib.queue);window.qaSettings=JSON.stringify({...S(),ui:{...S().ui,variant:'full'}});});
 await page.evaluate(()=>{lib.setTab='look';go({r:'settings'});});await page.waitForTimeout(350);
 assert.equal(await page.locator('#setBody [data-set="ui.variant"]').count(),2);
 const firstSetting=await page.locator('#setBody .set-row').first().textContent();assert.ok(firstSetting.includes('Вариант интерфейса'));
 await page.screenshot({path:out+'/panel11-selector-full.png'});
 await page.locator('[data-set="ui.variant"][data-v="clean"]').click();await page.waitForTimeout(350);
 assert.equal(await page.evaluate(()=>S().ui.variant),'clean');assert.deepEqual(await page.evaluate(()=>qaCalls),[]);assert.equal(await page.evaluate(()=>JSON.stringify(lib.queue)===qaQueue),true);
 assert.equal(await page.evaluate(()=>JSON.stringify({...S(),ui:{...S().ui,variant:'full'}})===qaSettings),true);
 await page.screenshot({path:out+'/panel11-selector-clean.png'});
 assert.equal(await page.locator('#cleanNavMore').evaluate(e=>e.open),false);assert.equal(await page.locator('#cleanPlaylists').evaluate(e=>e.open),false);
 await page.locator('#cleanNavMore>summary').focus();await page.keyboard.press('Space');await page.waitForTimeout(150);assert.equal(await page.locator('#cleanNavMore').evaluate(e=>e.open),true);assert.deepEqual(await page.evaluate(()=>qaCalls),[]);
 await page.locator('#cleanNavMore>summary').click();
 await page.evaluate(()=>{go({r:'home'});loadLyricsFor(curTrack());});await page.waitForTimeout(500);
 const visible=await page.locator('#bar button').evaluateAll(a=>a.filter(x=>x.getBoundingClientRect().width&&getComputedStyle(x).visibility!=='hidden').map(x=>x.id));console.log('Visible clean player controls',visible);assert.deepEqual(new Set(visible),new Set(['btnPrev','btnPlay','btnNext','btnMute','btnCleanActions']));
 await page.screenshot({path:out+'/panel11-clean-home.png'});
 await page.locator('#btnCleanActions').click();assert.equal(await page.locator('#cleanOverlay').count(),1);assert.equal(await page.locator('#view').evaluate(e=>e.inert),true);
 await page.screenshot({path:out+'/panel11-player-actions.png'});
 await page.keyboard.press('Escape');assert.equal(await page.locator('#cleanOverlay').count(),0);assert.equal(await page.evaluate(()=>document.activeElement.id),'btnCleanActions');assert.equal(await page.locator('#view').evaluate(e=>e.inert),false);
 await page.locator('#btnCleanActions').click();await page.locator('[data-clean="queue"]').click();assert.equal(await page.locator('body').evaluate(b=>b.classList.contains('clean-panel-only')),true);assert.equal(await page.locator('#view').evaluate(e=>getComputedStyle(e).visibility),'visible');await page.screenshot({path:out+'/panel11-queue.png'});await page.keyboard.press('Escape');
 await page.locator('#btnCleanActions').click();await page.locator('[data-clean="lyrics"]').click();assert.equal(await page.evaluate(()=>lib.tab),'lyrics');await page.waitForTimeout(250);assert.ok((await page.locator('#lyScroll').innerText()).includes('Текст не найден'));await page.screenshot({path:out+'/panel11-lyrics.png'});await page.locator('#cleanPanelHeader button').click();
 await page.locator('#btnCleanActions').click();await page.locator('[data-clean="playback"]').click();const oldShuffle=await page.evaluate(()=>lib.shuffle);await page.locator('[data-clean="shuffle"]').click();assert.equal(await page.evaluate(()=>lib.shuffle),!oldShuffle);await page.keyboard.press('Escape');
 await page.locator('#btnCleanActions').click();await page.locator('[data-clean="track"]').click();assert.ok(await page.locator('#menu [role="menuitem"]').count()>5);await page.keyboard.press('ArrowDown');assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('role')),'menuitem');await page.screenshot({path:out+'/panel11-track-menu.png'});await page.keyboard.press('Escape');
 await page.locator('#btnCleanTools').click();await page.screenshot({path:out+'/panel11-tools.png'});
 await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.dataset.clean),'close');
 await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.dataset.clean),'visual');
 await page.evaluate(()=>{window.qaStage=[];window.qaStageOriginal=lyStageOpen;lyStageOpen=on=>qaStage.push(on);});
 await page.locator('[data-clean="mineradio"]').click();assert.equal(await page.evaluate(()=>S().ly.vis),'mineradio');assert.deepEqual(await page.evaluate(()=>qaStage),[true]);await page.evaluate(()=>{lyStageOpen=qaStageOriginal;});
 await page.locator('#btnCleanTools').click();await page.keyboard.press('Control+k');assert.equal(await page.locator('#cleanOverlay').count(),0);assert.equal(await page.locator('#view').evaluate(e=>e.inert),false);await page.keyboard.press('Escape');
 // Each viewport must retain basic controls and a non-overlapping bar.
 for(const size of [{width:980,height:640},{width:1680,height:960}]){await page.setViewportSize(size);await page.waitForTimeout(250);const geo=await page.evaluate(()=>{const bar=$('bar').getBoundingClientRect(),els=[...$('bar').querySelectorAll('button,.b-art,.b-meta,.vol')].filter(e=>e.getBoundingClientRect().width&&getComputedStyle(e).visibility!=='hidden'&&(!e.closest('.vol')||e.classList.contains('vol'))),r=els.map(e=>({id:e.id||e.className,r:e.getBoundingClientRect()}));return{outside:r.filter(x=>x.r.left<bar.left-1||x.r.right>bar.right+1||x.r.top<bar.top-1||x.r.bottom>bar.bottom+1).map(x=>x.id),overlap:r.flatMap((a,i)=>r.slice(i+1).filter(b=>Math.min(a.r.right,b.r.right)-Math.max(a.r.left,b.r.left)>1&&Math.min(a.r.bottom,b.r.bottom)-Math.max(a.r.top,b.r.top)>1).map(b=>[a.id,b.id])),width:document.documentElement.scrollWidth,view:innerWidth};});assert.equal(await page.locator('#bSub').isVisible(),true);console.log('Clean geometry',size,geo);assert.deepEqual(geo.outside,[]);assert.deepEqual(geo.overlap,[]);assert.ok(geo.width<=geo.view);await page.screenshot({path:out+'/panel11-clean-'+size.width+'.png'});}
 await page.setViewportSize({width:1366,height:768});
 await page.evaluate(()=>{PulseI18n.setLanguage('en');S().app.language='en';});await page.waitForTimeout(200);await page.screenshot({path:out+'/panel11-clean-en.png'});await page.locator('#btnCleanTools').click();assert.equal(await page.locator('#cleanDialogTitle').innerText(),'Tools');await page.keyboard.press('Escape');
 // Persist and restore clean mode using the real library serialization path.
 await page.evaluate(()=>{S().app.language='ru';save();});await page.waitForTimeout(1200);await page.reload();await page.waitForTimeout(1800);assert.equal(await page.evaluate(()=>S().ui.variant),'clean');
 await page.evaluate(()=>{lib.setTab='look';go({r:'settings'});});await page.waitForTimeout(300);await page.locator('[data-set="ui.variant"][data-v="full"]').click();await page.waitForTimeout(300);
 assert.equal(await page.locator('body').evaluate(b=>b.classList.contains('ui-clean')),false);assert.equal(await page.locator('#cleanNavMore').count(),0);
 const restored=await page.locator('#side').evaluate(e=>[...e.children].filter(x=>!x.classList.contains('clean-only')).map(x=>x.id||x.dataset.go||x.className));assert.deepEqual(restored,originalSide);
 assert.equal(await page.locator('.about-author').count(),0);await page.evaluate(()=>{lib.setTab='about';rerenderSettings();});assert.ok((await page.locator('.about-author').innerText()).includes('Bon_zeD'));
 assert.deepEqual(errors,[]);console.log('Full/Clean selection, no audio calls, settings isolation, panels, grouped tools, keyboard, persistence and restoration passed');await browser.close();server.close();process.exit(0);
})().catch(e=>{console.error(e);server.close();process.exit(1)});
