// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8758,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning'&& /GPU fallback|viz gpu|PulseGPU/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8758'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
 let stored=null;await page.exposeFunction('__readLib',()=>stored);await page.exposeFunction('__writeLib',v=>{stored=v;return true;});
 await page.addInitScript(()=>{
   const feed={shelves:[{title:'Тестовые треки',items:Array.from({length:14},(_,i)=>({kind:'song',id:String(i).padStart(11,'a'),title:'Тест переключения '+(i+1),author:'Pulse QA',dur:240,loaded:true}))}],chips:[]};
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
     if(k==='getGlass')return Promise.resolve({});
     return Promise.resolve({});
   };}});
   window.pulse=proxy('');for(const n of ['plugins','account','svc','ytm','spicy','discord','custom','editor','wall','accounts']) Object.defineProperty(window.pulse,n,{value:proxy(n)});
   // replace proxy with explicit nested keys (proxy getter above does not read target).
   const p=proxy('');window.pulse=new Proxy({}, {get(t,k){if(['plugins','account','svc','ytm','spicy','discord','custom','editor','wall','accounts'].includes(k))return proxy(k);return p[k];}});
   localStorage.setItem('pulse.splash','off');
 });
 await page.goto('http://127.0.0.1:8758');await page.waitForFunction(()=>window.PulseGlass&&document.querySelector('.page'));await page.waitForTimeout(900);
 const assert=require('node:assert/strict');
 async function settings(){await page.evaluate(()=>{closePP();go({r:'settings'});});await page.locator('#setBody').waitFor();await page.waitForTimeout(120);await page.evaluate(()=>{lib.setTab='look';S().ui.setMode='simple';rerenderSettings();});await page.locator('.surface-options').waitFor({timeout:5000});}
 async function mode(v){await page.locator('[data-sel="ui.surfaceMaterial"]').click();await page.locator('.pulse-select-menu [data-option="'+(v==='liquid'?1:0)+'"]').click();await page.waitForFunction(v=>document.body.dataset.surfaceMaterial===v,v);await page.waitForTimeout(500);}
 const track={id:'abcdefghijk',title:'Glass test',author:'Pulse QA',dur:220};
 // An actual artwork image behind the UI, no artificial glass-only fixture.
 await page.evaluate(()=>{const n=document.createElement('div');n.id='qa-artwork';n.style='position:fixed;inset:0;z-index:-1;background:url(/immersion-assets/nasa-earth-day.jpg) center/cover';document.body.prepend(n);document.documentElement.style.background='#081321';document.body.style.background='transparent';});
 await settings();await page.screenshot({path:out+'/glass-settings-blur-desktop.png'});
 assert.equal(await page.evaluate(()=>document.body.dataset.surfaceMaterial),'blur');
 await mode('liquid');await page.waitForFunction(()=>PulseGlass.stats().filters>0);await page.screenshot({path:out+'/glass-settings-liquid-desktop.png'});
 assert.equal(stored.settings.ui.surfaceMaterial,'liquid');assert.equal(stored.settings.ui.glass,true);
 // Persistent setting is loaded through the real boot merge, not just a DOM class.
 await page.reload();await page.waitForFunction(()=>window.PulseGlass&&document.body.dataset.surfaceMaterial==='liquid');await page.waitForTimeout(700);assert.equal(await page.evaluate(()=>S().ui.surfaceMaterial),'liquid');
 await page.evaluate(()=>{const n=document.createElement('div');n.id='qa-artwork';n.style='position:fixed;inset:0;z-index:-1;background:url(/immersion-assets/nasa-earth-day.jpg) center/cover';document.body.prepend(n);document.documentElement.style.background='#081321';document.body.style.background='transparent';});
 async function menu(x=780,y=730){await page.evaluate(({track,x,y})=>trackMenu(track,x,y),{track,x,y});await page.waitForTimeout(300);}
 async function geometry(){const g=await page.evaluate(()=>{const m=$('menu').getBoundingClientRect(),b=$('bar').getBoundingClientRect(),h=$('btnBarHide').getBoundingClientRect();return {gap:b.top-m.bottom,overButton:m.left<h.right+4&&m.right>h.left-4,hideGap:h.top-m.bottom,top:m.top,left:m.left,right:m.right,bottom:m.bottom,w:innerWidth};});assert.ok(g.gap>=7.5,JSON.stringify(g));assert.ok(g.top>=0&&g.left>=0&&g.right<=g.w,JSON.stringify(g));if(g.overButton)assert.ok(g.hideGap>=3.5,JSON.stringify(g));else assert.ok(g.gap<=8.5,JSON.stringify(g));return g;}
 await menu();await geometry();assert.match(await page.locator('#menu').evaluate(e=>getComputedStyle(e).backdropFilter),/url/);await page.screenshot({path:out+'/glass-menu-liquid-desktop.png'});
 // Prove that the SVG bends real background pixels, not just a different blur tint.
 const optical=await page.locator('#menu').screenshot({path:out+'/glass-optical-proof.png'});await page.locator('#menu').evaluate(e=>{e.style.setProperty('backdrop-filter','blur(3px) saturate(1.25) brightness(.9)','important');e.style.setProperty('-webkit-backdrop-filter','blur(3px) saturate(1.25) brightness(.9)','important');});const plain=await page.locator('#menu').screenshot();fs.writeFileSync(out+'/glass-plain-proof.png',plain);const changed=+require('child_process').execFileSync('python3',['-c',"from PIL import Image,ImageChops; import sys; a=Image.open(sys.argv[1]).convert('RGB'); b=Image.open(sys.argv[2]).convert('RGB'); print(sum(sum(p)>8 for p in ImageChops.difference(a,b).getdata()))",out+'/glass-optical-proof.png',out+'/glass-plain-proof.png'],{encoding:'utf8'});assert.ok(changed>30,'SVG backdrop must visibly refract background pixels: '+changed);console.log('Refraction changed pixels:',changed);await page.locator('#menu').evaluate(e=>{e.style.removeProperty('backdrop-filter');e.style.removeProperty('-webkit-backdrop-filter');});

 // Busy real DOM beneath the transport: verifies the clear centre against text/covers,
 // not just an empty wallpaper. Fixture is test-only and never ships in renderer.
 await page.evaluate(()=>{hideMenu();document.querySelector('#qa-artwork').style.display='none';const n=document.createElement('section');n.id='qa-busy';n.style='position:fixed;bottom:0;left:0;right:0;height:180px;z-index:1;background:linear-gradient(110deg,#0c233d,#161023)';n.innerHTML=Array.from({length:12},(_,i)=>`<div style="display:inline-flex;width:24%;height:58px;align-items:center;gap:12px;padding:8px 24px"><img src="/logo.png" width="40" height="40" style="border-radius:6px"><span><b>Тестовая композиция ${i+1}</b><br><span style="color:#b5bfd2">Исполнитель · Альбом</span></span></div>`).join('');document.body.append(n);});await page.waitForTimeout(250);await page.screenshot({path:out+'/glass-busy-transport-desktop.png'});
 await page.evaluate(()=>{document.querySelector('#qa-busy').remove();document.querySelector('#qa-artwork').style.display='';});await menu();
 // Menu, listbox and submenu share exactly the same fill alpha, with real handlers.
 await page.locator('#menu [data-mi]').filter({hasText:'Скачать'}).hover();await page.locator('.pulse-submenu').waitFor();await page.waitForTimeout(250);const fills=await page.locator('#menu,.pulse-submenu').evaluateAll(es=>es.map(e=>getComputedStyle(e).backgroundColor));assert.equal(new Set(fills).size,1);
 await page.screenshot({path:out+'/glass-submenu-liquid-desktop.png'});
 await page.keyboard.press('Escape');await settings();await mode('blur');await menu();await geometry();const blur=await page.locator('#menu').evaluate(e=>({fill:getComputedStyle(e).backgroundColor,filter:getComputedStyle(e).backdropFilter}));assert.match(blur.filter,/blur/);assert.doesNotMatch(blur.filter,/url/);assert.ok(/0\.[5-7]/.test(blur.fill));await page.screenshot({path:out+'/glass-menu-blur-desktop.png'});
 await page.evaluate(()=>hideMenu());await settings();await mode('liquid');
 // A single-select in real settings gets the same transparent material.
 
 await page.evaluate(()=>{S().ui.setMode='all';rerenderSettings();});await page.waitForTimeout(200);for(const el of await page.locator('.settings-workspace .set-side>nav,.settings-workspace .set-main').all()){const c=await el.evaluate(e=>getComputedStyle(e).scrollbarColor);assert.notEqual(c,'auto','Both settings scrollers need explicit dark colors');assert.match(c,/transparent|rgba\(0, 0, 0, 0\)/);}const scrollers=page.locator('.settings-workspace .set-side>nav,.settings-workspace .set-main');assert.equal(await scrollers.count(),2);for(const el of await scrollers.all()){await el.hover();await page.mouse.wheel(0,220);await page.waitForTimeout(180);assert.ok(await el.evaluate(e=>e.scrollTop>0),'Both settings regions must actually scroll');}await page.screenshot({path:out+'/glass-settings-scrollbars.png'});
 await page.evaluate(()=>{lib.setTab='app';rerenderSettings();});await page.locator('[data-language-list]').click();await page.waitForTimeout(250);assert.equal(await page.locator('.pulse-select-menu').evaluate(e=>getComputedStyle(e).backgroundColor),fills[0]);await page.screenshot({path:out+'/glass-select-liquid-desktop.png'});await page.keyboard.press('Escape');
 // Tight gap and local button collision on phone dimensions, in both materials.
 await page.setViewportSize({width:390,height:844});await settings();await mode('liquid');await page.screenshot({path:out+'/glass-settings-liquid-mobile.png'});await menu(280,820);await geometry();await page.screenshot({path:out+'/glass-menu-liquid-mobile.png'});
 await page.locator('#menu [data-mi]').filter({hasText:'Скачать'}).click();await page.waitForTimeout(250);await page.screenshot({path:out+'/glass-submenu-liquid-mobile.png'});await page.keyboard.press('Escape');
 await settings();await mode('blur');await menu(140,820);await geometry();await page.screenshot({path:out+'/glass-menu-blur-mobile.png'});
 // Test local exclusion: a left menu does not reserve space for a right hide button.
 await page.setViewportSize({width:1366,height:768});await menu(900,730);await geometry();await menu(1180,730);await geometry();
 // Actual lower menu actions remain reachable through scrolling.
 await page.evaluate(()=>{window.__last=0;showMenu(700,740,Array.from({length:35},(_,i)=>['list','Пункт '+i,()=>__last=i]));});await page.locator('#menu [data-mi="34"]').click();assert.equal(await page.evaluate(()=>__last),34);
 // Bounded filters and no idle redraw loop.
 await settings();await mode('liquid');await menu();await page.waitForTimeout(500);const start=await page.evaluate(()=>PulseGlass.stats());await page.waitForTimeout(600);const idle=await page.evaluate(()=>PulseGlass.stats());assert.ok(idle.scans-start.scans<4,JSON.stringify({start,idle}));assert.ok(idle.filters<=24);
 await page.evaluate(()=>document.body.classList.add('perf-lite'));await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>PulseGlass.stats().filters),0);assert.equal(await page.locator('#menu').evaluate(e=>getComputedStyle(e).backdropFilter),'none');for(const e of await page.locator('#bar,.side,.search').all())assert.equal(await e.evaluate(n=>getComputedStyle(n).backdropFilter),'none','Accessibility/eco must disable every optical surface');await page.evaluate(()=>document.body.classList.remove('perf-lite'));
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(120);assert.equal(await page.locator('.surface-options').first().evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:'reduce'}]});await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>PulseGlass.stats().filters),0);assert.equal(await page.locator('#menu').evaluate(e=>getComputedStyle(e).backdropFilter),'none');for(const e of await page.locator('#bar,.side,.search').all())assert.equal(await e.evaluate(n=>getComputedStyle(n).backdropFilter),'none','Accessibility/eco must disable every optical surface');await cdp.send('Emulation.setEmulatedMedia',{features:[]});await cdp.detach();
 await page.emulateMedia({forcedColors:'active'});await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>PulseGlass.stats().filters),0);assert.equal(await page.locator('#menu').evaluate(e=>getComputedStyle(e).backdropFilter),'none');for(const e of await page.locator('#bar,.side,.search').all())assert.equal(await e.evaluate(n=>getComputedStyle(n).backdropFilter),'none','Accessibility/eco must disable every optical surface');await page.screenshot({path:out+'/glass-forced-colors.png'});await page.emulateMedia({forcedColors:'none'});
 // i18n uses existing dictionaries; changing language must not revert the material.
 await page.evaluate(()=>{hideMenu();S().app.language='en';PulseI18n.setLanguage('en');lib.setTab='look';rerenderSettings();});await page.waitForTimeout(300);assert.ok((await page.locator('.surface-options').innerText()).includes('Frosted glass'));
 await page.evaluate(()=>{S().app.language='ja';PulseI18n.setLanguage('ja');rerenderSettings();});await page.waitForTimeout(300);assert.ok((await page.locator('.surface-options').innerText()).includes('すりガラス'));
 assert.equal(await page.locator('[data-surface-material]').getAttribute('data-surface-material'),'liquid');

 // The existing reversible Clean presentation uses the same material, not a fork.
 await page.evaluate(()=>{S().app.language='ru';PulseI18n.setLanguage('ru');S().ui.variant='clean';applyCustom();lib.setTab='look';rerenderSettings();});await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>document.body.classList.contains('ui-clean')),true);await menu(780,730);await geometry();await page.screenshot({path:out+'/glass-clean-liquid-desktop.png'});await page.setViewportSize({width:390,height:844});await menu(140,820);await geometry();await page.screenshot({path:out+'/glass-clean-liquid-mobile.png'});await page.evaluate(()=>{hideMenu();S().ui.variant='full';applyCustom();});
 await page.evaluate(()=>{S().ui.surfaceMaterial='blur';applyCustom();});await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>PulseGlass.stats().filters),0);
 assert.deepEqual(errors,[]);console.log('PASS: materials switch/save/reload, optical backdrop, shared translucent menus, 8px gap/local exclusion, desktop/mobile, scroll/click, locales, reduced motion, forced colors, eco, bounded resources/no idle loop.');await browser.close();await new Promise(r=>server.close(r));process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
