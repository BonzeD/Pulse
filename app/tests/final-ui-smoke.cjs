// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8781,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning'&& /GPU fallback|viz gpu|PulseGPU/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8781'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
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
 await page.goto('http://127.0.0.1:8781');await page.waitForFunction(()=>window.PulseGlass&&document.querySelector('.page'));await page.waitForTimeout(900);

 const assert=require('node:assert/strict');
 // Locale helpers must coexist with the existing auto-hide timer in the real app.
 for(const lang of ['en','ja','uk']){
  const got=await page.evaluate(lang=>{
   PulseI18n.setLanguage(lang);
   return {mixed:uiOwnedText('Моя медиатека • 35 мин.'),expected:PulseI18n.t('Моя медиатека')+' • '+PulseI18n.t('35 мин.'),name:uiOwnedText('My playlist / 私の曲 / Моя песня')};
  },lang);
  assert.equal(got.mixed,got.expected);assert.equal(got.name,'My playlist / 私の曲 / Моя песня');
 }
 await page.evaluate(()=>{S().app.language='uk';PulseI18n.setLanguage('uk');go({r:'settings'});});
 await page.waitForTimeout(250);
 assert.equal(await page.locator('html').getAttribute('lang'),'uk');
 assert.equal(await page.locator('[data-language-list] option[value=uk]').innerText(),'Українська');
 assert.equal(await page.evaluate(()=>PulseI18n.t('Добавлено в «Моя песня»')),'Додано в Моя песня');
 for(const n of [0,1,2,5,11,21,22,25]){const got=await page.evaluate(n=>PulseI18n.t(n+' треков'),n);assert.ok(!got.includes('треков'));}
 const localeAudit=await page.evaluate(()=>{const leaked=[];for(const tab of allTabs())for(const row of tab.rows||[])for(const v of [row.t,row.s,row.h])if(v&&/[ыэъёЫЭЪЁ]/.test(PulseI18n.t(v)))leaked.push({tab:tab.id,source:v,value:PulseI18n.t(v)});return leaked;});
 fs.writeFileSync(out+'/uk-settings-audit.json',JSON.stringify(localeAudit,null,2));assert.deepEqual(localeAudit,[]);
 await page.screenshot({path:out+'/final-uk-settings-1366.png'});
 await page.evaluate(()=>{lib.queue={tracks:[{id:'abcdefghijk',title:'QA song',author:'Pulse QA',art:'/logo.png',dur:240}],idx:0};updateNow();openPP();lib.mode='visual';updateMode();S().app.language='uk';PulseI18n.setLanguage('uk');});
 await page.waitForTimeout(350);assert.equal(await page.locator('#visualReturn').isVisible(),true);
 for(const width of [1919,1366,390]){
  await page.setViewportSize({width,height:width===390?844:768});
  for(const mode of ['cover','video','visual','cover','visual']){
   await page.evaluate(mode=>{lib.mode=mode;updateMode();openPP();},mode);await page.waitForTimeout(200);
   assert.equal(await page.locator('#visualReturn').isVisible(),true,mode+' return visible');
   const r=await page.locator('#visualReturn').boundingBox();assert.ok(r.x>=0&&r.x+r.width<=width+.5);
   const others=await page.locator('.top .search,.top .acc-btn,.pp-switch').evaluateAll(es=>es.filter(e=>e.offsetWidth&&e.offsetHeight).map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}}));
   for(const b of others)assert.ok(r.x+r.width<=b.x||b.x+b.width<=r.x||r.y+r.height<=b.y||b.y+b.height<=r.y,'return handle overlap '+JSON.stringify({width,mode,r,b}));
   await page.screenshot({path:out+`/final-return-${mode}-${width}.png`});
   const before=await page.evaluate(()=>audio.paused);await page.locator('#visualReturn').click();assert.equal(await page.evaluate(()=>document.body.classList.contains('pp-open')),false);assert.equal(await page.evaluate(()=>audio.paused),before);assert.equal(await page.locator('#visualReturn').isVisible(),false);
  }
 }
 // Editor action is a separate, reachable row ABOVE the Discord preview.
 for(const width of [1919,1366,390])for(const zoom of [1,1.25]){
  await page.setViewportSize({width,height:844});
  await page.evaluate(zoom=>{document.documentElement.style.zoom=zoom;closePP();lib.setTab='discord';go({r:'settings'});rerenderSettings();},zoom);await page.waitForTimeout(200);
  const button=page.locator('.ed-mini[data-ed-scope="discord"] .ed-open');await button.scrollIntoViewIfNeeded();
  const br=await button.boundingBox(),pr=await page.locator('#pvDiscord').boundingBox(),cr=await page.locator('.ed-mini[data-ed-scope="discord"]').boundingBox();
  assert.ok(br&&pr&&cr);assert.ok(br.y+br.height<=pr.y+.5,'editor action must be above preview');assert.ok(br.x>=cr.x&&br.x+br.width<=cr.x+cr.width+.5,'editor action inside card');assert.ok(br.height>=43,'action hit target');
  await page.screenshot({path:out+`/final-editor-action-${width}-${zoom}.png`});
 }
 await page.locator('.ed-mini[data-ed-scope="discord"] .ed-open').click();await page.waitForFunction(()=>czE.on&&czE.part==='discord');await page.evaluate(()=>{czExit(undefined,true);document.documentElement.style.zoom='';});
 // Entering a hover target must not teleport the global camera input to centre.
 await page.setViewportSize({width:1366,height:768});await page.evaluate(()=>{openPP();lib.mode='cover';updateMode();});await page.waitForTimeout(300);
 const art=page.locator('#artWrap > .art');await art.hover({position:{x:20,y:20}});await page.waitForTimeout(300);
 const op=await page.locator('#artWrap .pulse-pointer-light').evaluate(e=>getComputedStyle(e).opacity);assert.ok(+op>.9);
 await page.screenshot({path:out+'/final-cover-hover.png'});
 // Real shader compilation, both direct styles, and effects that require a copied frame.
 await page.evaluate(()=>{openPP();lib.mode='visual';updateMode();S().perf.mode='high';});
 for(const style of ['coverfield','radial'])for(const fx of [{thick:200,glow:180,density:150,hue:200},{trails:50,flash:50,mirror:'h'}]){
  await page.evaluate(({style,fx})=>{lib.vizStyle=style;S().viz.fx={...DEF_SETTINGS.viz.fx,...fx};applyCustom();}, {style,fx});await page.waitForTimeout(500);await page.screenshot({path:out+`/final-gpu-${style}-${fx.mirror?'copied':'direct'}.png`});
 }
 await page.evaluate(()=>{S().ly.kWorld='sakura';PulseImmersion.open();});await page.waitForFunction(()=>PulseImmersion.stats().draws>0,null,{timeout:30000});assert.equal(await page.evaluate(()=>PulseImmersion.stats().world),2);assert.deepEqual(await page.locator('[data-scene="world"] option').evaluateAll(es=>es.map(e=>e.value)),['orbit','ocean']);await page.evaluate(()=>PulseImmersion.close());
 // Glass is still refracting while the page scrolls.
 await page.evaluate(()=>{closePP();go({r:'home'});S().ui.surfaceMaterial='liquid';applyCustom();});await page.waitForTimeout(300);
 const glassBefore=await page.locator('#bar').evaluate(e=>getComputedStyle(e).backdropFilter);
 await page.evaluate(()=>{$('view').scrollTop=200;});await page.waitForTimeout(30);const glassDuring=await page.locator('#bar').evaluate(e=>getComputedStyle(e).backdropFilter);assert.equal(glassDuring,glassBefore);assert.ok(glassDuring.includes('url('));
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(50);assert.equal(await page.locator('#visualReturn').evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
 fs.writeFileSync(out+'/final-ui-errors.json',JSON.stringify(errors,null,2));assert.deepEqual(errors,[]);
 console.log('PASS Ukrainian, return handle, camera continuity, all effect renders, shader paths, removed Sakura, scroll glass and reduced motion');
 await browser.close();server.close();process.exit(0);
})().catch(e=>{console.error(e);server.close();process.exit(1)});
