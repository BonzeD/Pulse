/* Full application UI with an explicit local-only native bridge fixture. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'../renderer'),out=process.env.PULSE_SETUP_ARTIFACTS||path.join(__dirname,'artifacts/setup-debug');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const u=req.url.split('?')[0],p=path.resolve(root,'.'+(u==='/'?'/index.html':u));if(!p.startsWith(root+path.sep)||!fs.existsSync(p)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});const errors=[];
async function setup(options={}){
 const context=await browser.newContext({viewport:{width:1366,height:900},locale:'ru-RU',...options.context});const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));await page.route('**/*',r=>{if(r.request().url().startsWith(origin))return r.continue();if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
 await page.addInitScript(({saved,failed,splash})=>{
  window.__saved=saved;window.__failed=failed;window.__writes=[];window.__flushOK=true;window.__auth=null;window.__copied='';window.__wins=[];
  const proxy=()=>new Proxy({}, {get(_t,k){return (...args)=>{
   if(String(k).startsWith('on'))return;
   if(k==='getLibrary')return __failed?Promise.reject(Error('read failure')):Promise.resolve(__saved);
   if(k==='flushLibrary'){if(__flushOK)__writes.push(JSON.parse(JSON.stringify(args[0])));return __flushOK;}
   if(k==='saveLibrary'){__writes.push(JSON.parse(JSON.stringify(args[0])));return;}
   if(k==='copyText'){__copied=args[0];return Promise.resolve({ok:true});}
   if(k==='win'){__wins.push(args[0]);return;}
   if(k==='list'||k==='playlists'||k==='downloads'||k==='displays'||k==='browsers')return Promise.resolve([]);
   if(k==='offlineList')return Promise.resolve({});
   if(k==='status')return Promise.resolve({am:{user:false},sp:{user:false}});
   if(k==='info')return Promise.resolve(__auth);
   if(k==='version')return Promise.resolve('1.0.2');
   if(k==='lyrics')return Promise.resolve({none:true});
   if(k==='feed'||k==='search')return Promise.resolve({shelves:[],chips:[]});
   if(k==='next')return Promise.resolve({tracks:[]});
   if(k==='resolve')return new Promise(()=>{});
   if(k==='getGlass')return Promise.resolve({});return Promise.resolve({});
  };}});
  const p=proxy(),names=['plugins','account','svc','ytm','spicy','discord','custom','editor','wall','accounts','media'];const nested=Object.fromEntries(names.map(n=>[n,proxy()]));window.pulse=new Proxy({}, {get(_t,k){return nested[k]||p[k];}});localStorage.setItem('pulse.splash',splash?'on':'off');
 },{saved:options.saved===undefined?{settings:{app:{language:'ru'},look:{splash:false}}}:options.saved,failed:!!options.failed,splash:!!options.splash});
 await page.goto(origin);await page.waitForFunction(()=>window.PulseDebug&&typeof lib.settings==='object'&&document.querySelector('.page'));return {page,context};
}
const next=page=>page.locator('[data-pt=next]').click();const shot=(page,name)=>page.screenshot({path:out+'/'+name+'.png'});
try{
 // Existing profiles do not get a surprise wizard after an update.
 const a=await setup();await a.page.waitForTimeout(400);assert.equal(await a.page.locator('#pulseWelcome').count(),0);
 // Four right clicks and slow right clicks do not open; five rapid do.
 for(let i=0;i<4;i++)await a.page.locator('#brand').click({button:'right'});assert.equal(await a.page.locator('#pulseDebug').count(),0);await a.page.waitForTimeout(500);for(let i=0;i<5;i++){await a.page.locator('#brand').click({button:'right'});await a.page.waitForTimeout(45);}await a.page.waitForSelector('#pulseDebug');assert.equal(await a.page.locator('#prismLive').count(),0);
 await shot(a.page,'debug-actions-desktop');await a.page.locator('[data-debug-tab=actions]').focus();await a.page.keyboard.press('ArrowRight');assert.equal(await a.page.locator('[data-debug-tab=tests]').getAttribute('aria-selected'),'true');await a.page.locator('[data-pt=run]').click();await a.page.waitForFunction(()=>document.querySelectorAll('.pt-result').length===7);assert.equal(await a.page.locator('.pt-result[data-state=fail]').count(),0);await shot(a.page,'debug-checks-desktop');await a.page.locator('[data-pt=copy]').click();await a.page.waitForFunction(()=>__copied);const report=await a.page.evaluate(()=>JSON.parse(__copied));assert.equal(report.pulseDiagnostics,1);assert.ok(!/token|cookie|email|known|playlists|password|author|title|path/i.test(JSON.stringify(report)));
 await a.page.keyboard.press('Escape');assert.equal(await a.page.locator('#pulseDebug').count(),0);assert.equal(await a.page.locator('#brand').evaluate(x=>x.inert),false);
 await a.page.evaluate(()=>{lib.settings.perf.fps=144;lib.settings.perf.dpr=2;lib.settings.perf.mode='high';lib.playlists=[{id:'private',name:'Keep me',tracks:[]}];lib.known={private:{title:'Private'}};window.__initial=JSON.stringify(lib.settings);PulseWelcome.open();});await a.page.waitForSelector('#pulseWelcome');
 await shot(a.page,'welcome-language-desktop');await a.page.locator('[data-choice="app.language"][data-value=ja]').click();assert.match(await a.page.locator('h1').last().innerText(),/Pulse/);assert.equal(await a.page.evaluate(()=>S().app.language),'ru','preview does not commit language');await a.page.locator('[data-choice="app.language"][data-value=ru]').click();await next(a.page);
 await shot(a.page,'welcome-catalog-desktop');await a.page.locator('[data-pt=login]').click();await a.page.waitForSelector('#modal.show');assert.equal(await a.page.locator('#modal').evaluate(x=>x.inert),false);assert.equal(await a.page.locator('#pulseWelcome').evaluate(x=>x.inert),true);await a.page.waitForTimeout(550);await shot(a.page,'welcome-login-modal-desktop');await a.page.keyboard.press('Escape');await a.page.waitForFunction(()=>!document.body.classList.contains('pulse-welcome-auth'));assert.equal(await a.page.locator('#pulseWelcome').evaluate(x=>x.inert),false);
 await a.page.locator('[data-choice="app.client"][data-value=ad]').click();assert.equal(await a.page.locator('[data-pt=login]').count(),0);await next(a.page);assert.equal(await a.page.locator('[data-graphics=current]').getAttribute('aria-pressed'),'true');await shot(a.page,'welcome-graphics-desktop');await a.page.locator('[data-graphics=eco]').click();assert.equal(await a.page.evaluate(()=>S().perf.fps),144);await next(a.page);await shot(a.page,'welcome-preferences-desktop');await a.page.locator('[data-choice="app.start"][data-value=library]').click();await next(a.page);await shot(a.page,'welcome-review-desktop');
 await a.page.evaluate(()=>__flushOK=false);await a.page.locator('[data-pt=finish]').click();assert.equal(await a.page.evaluate(()=>JSON.stringify(lib.settings)===__initial),true,'durable failure rolls back settings');assert.equal(await a.page.locator('#pulseWelcome').count(),1);await shot(a.page,'welcome-save-error-desktop');await a.page.evaluate(()=>__flushOK=true);await a.page.locator('[data-pt=finish]').click();await a.page.waitForFunction(()=>!PulseWelcome.active());const done=await a.page.evaluate(()=>({fps:S().perf.fps,client:S().app.client,start:S().app.start,marker:lib.onboarding,playlist:lib.playlists[0].id,known:lib.known.private.title}));assert.deepEqual(done,{fps:30,client:'ad',start:'library',marker:{version:1,status:'complete'},playlist:'private',known:'Private'});
 // The Settings button reopens with current values; skip applies no draft.
 await a.page.evaluate(()=>dsOpenSetting('app'));await a.page.locator('[data-sact=welcome]').click();await a.page.locator('[data-choice="app.language"][data-value=en]').click();await a.page.locator('[data-pt=later]').click();assert.equal(await a.page.evaluate(()=>S().app.language),'ru');assert.equal(await a.page.evaluate(()=>PulseI18n.language()),'ru');assert.equal(await a.page.evaluate(()=>lib.onboarding.status),'skipped');
 // Left gesture remains independent; cover ink updates before accent override.
 for(let i=0;i<5;i++){await a.page.locator('#brand').click();await a.page.waitForTimeout(45);}await a.page.waitForFunction(()=>PulsePrism.active());await a.page.waitForTimeout(900);await a.page.evaluate(()=>PulsePrism.setCoverPalette([[240,25,70],[20,220,130],[25,100,240]]));await shot(a.page,'prism-cover-colours-desktop');assert.equal(await a.page.locator('#prismLive .sp-word').textContent(),'Pulse','brand letters must never be localized as seconds');assert.equal(await a.page.locator('.sp-live-hint').count(),0);const back=await a.page.locator('.sp-live-back').boundingBox();assert.ok(back.width<=1&&back.height<=1,'no visible return chrome');const css=await a.page.locator('#prismLive .sp-word').evaluate(e=>getComputedStyle(e).backgroundImage);assert.match(css,/246, 112, 140/);
 await a.page.evaluate(()=>{window.__priorInk=document.documentElement.style.getPropertyValue('--prism-ink1');S().look.accent='custom';S().look.color='#ffffff';const c=document.createElement('canvas');c.width=c.height=48;const g=c.getContext('2d');g.fillStyle='#f02040';g.fillRect(0,0,16,48);g.fillStyle='#20d090';g.fillRect(16,0,16,48);g.fillStyle='#3060f0';g.fillRect(32,0,16,48);applyPalette(c.toDataURL());});
 await a.page.waitForFunction(()=>document.documentElement.style.getPropertyValue('--prism-ink1')!==__priorInk);assert.deepEqual(await a.page.evaluate(()=>basePal[0]),[255,255,255],'fixed UI accent remains fixed while Prism ink follows the cover');await shot(a.page,'prism-decoded-cover-desktop');
 await a.page.locator('.sp-word').dblclick();await a.page.waitForTimeout(650);assert.equal(await a.page.locator('#prismLive').count(),0);
 assert.deepEqual(await a.page.evaluate(()=>({opened:PulseDebug.open(),prism:!!document.getElementById('prismLive'),modal:document.getElementById('modal').className,tools:[...document.querySelectorAll('.pulse-tools')].map(e=>e.id)})),{opened:true,prism:false,modal:'modal',tools:['pulseDebug']});await a.page.locator('[data-debug-action="15"]').click();await a.page.waitForFunction(()=>route().r==='settings'&&lib.setTab==='audio');assert.equal(await a.page.locator('#pulseDebug').count(),0);
 await a.context.close();
 // Fresh profile: only after startup splash, then once per profile.
 const f=await setup({saved:null,splash:true});assert.equal(await f.page.locator('#pulseWelcome').count(),0);await f.page.waitForSelector('#pulseWelcome',{timeout:10000});assert.equal(await f.page.locator('#splash').count(),0);assert.equal(await f.page.evaluate(()=>lib.onboarding.status),'pending');await f.page.locator('[data-pt=later]').click();const stored=await f.page.evaluate(()=>__writes.at(-1));assert.equal(stored.onboarding.status,'skipped');await f.context.close();
 const again=await setup({saved:stored});await again.page.waitForTimeout(400);assert.equal(await again.page.locator('#pulseWelcome').count(),0);await again.context.close();
 const failed=await setup({saved:null,failed:true});await failed.page.waitForTimeout(700);assert.equal(await failed.page.locator('#pulseWelcome').count(),0);assert.equal(await failed.page.evaluate(()=>__writes.length),0,'read error does not overwrite a profile');await failed.context.close();
 // Narrow, keyboard, four languages, reduced motion and forced colours.
 for(const mode of [{},{reducedMotion:'reduce'},{forcedColors:'active'}]){
  const m=await setup({context:{viewport:{width:390,height:844},...mode}});await m.page.evaluate(()=>PulseWelcome.open());for(let i=0;i<5;i++){
   if(i===0){for(const l of ['ja','uk','en','ru']){await m.page.locator(`[data-choice="app.language"][data-value=${l}]`).click();assert.equal(await m.page.evaluate(()=>PulseI18n.language()),l);}}
   assert.equal(await m.page.evaluate(()=>document.querySelector('#pulseWelcome .pt-panel').scrollWidth<=document.querySelector('#pulseWelcome .pt-panel').clientWidth+1),true);
   await shot(m.page,'welcome-mobile-'+(mode.reducedMotion?'reduced':mode.forcedColors?'forced':'normal')+'-'+i);if(i<4)await next(m.page);
  }
  await m.page.keyboard.press('Escape');await m.page.evaluate(()=>PulseDebug.open());await shot(m.page,'debug-mobile-'+(mode.reducedMotion?'reduced':mode.forcedColors?'forced':'normal'));await m.page.locator('[data-debug-tab=status]').click();await shot(m.page,'debug-status-mobile-'+(mode.reducedMotion?'reduced':mode.forcedColors?'forced':'normal'));await m.page.locator('[data-pt=close]').click();assert.equal(await m.page.locator('#pulseDebug').count(),0);await m.context.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS setup/debug: upgrade/fresh/restart/read-failure, 5-right vs 5-left, durable save+rollback, optional native login modal, Audius no fake login, preserved library, current presets, Settings rerun, locale preview/skip, sanitized report, read-only self-check, no visible Prism chrome, cover gradient, double-click exit, 390+1366, reduced/forced colour');
}finally{await browser.close();}
})().then(()=>server.close()).catch(e=>{console.error(e);server.close();process.exitCode=1;});
