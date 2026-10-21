// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8760,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning'&& /GPU fallback|viz gpu|PulseGPU/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8760'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
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
 await page.goto('http://127.0.0.1:8760');await page.waitForFunction(()=>window.PulseGlass&&document.querySelector('.page'));await page.waitForTimeout(900);
 const assert=require('node:assert/strict');
 async function settings(){await page.evaluate(()=>{closePP();go({r:'settings'});});await page.locator('#setBody').waitFor();await page.waitForTimeout(120);await page.evaluate(()=>{lib.setTab='look';S().ui.setMode='simple';rerenderSettings();});await page.locator('.surface-options').waitFor({timeout:5000});}
 async function mode(v){await page.locator('[data-sel="ui.surfaceMaterial"]').click();await page.locator('.pulse-select-menu [data-option="'+(v==='liquid'?1:0)+'"]').click();await page.waitForFunction(v=>document.body.dataset.surfaceMaterial===v,v);await page.waitForTimeout(500);}

 await settings();await mode('liquid');await page.locator('[data-glass-editor]').waitFor();
 await page.locator('[data-gfx-section="presets"]').scrollIntoViewIfNeeded();
 for(const id of ['original','subtle','vivid','vision','obsidian','prism','frost']){await page.locator(`[data-gfx-preset="${id}"]`).click();await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>S().ui.glassFx.preset),id);await page.screenshot({path:out+`/editor-preset-${id}.png`});}
 await page.locator('[data-gfx-preset="original"]').click();
 await page.locator('[data-gfx-section="refraction"]>summary').click();
 const input=page.locator('input[type=range][data-gfx="strength"]');await input.scrollIntoViewIfNeeded();
 await input.evaluate(e=>{window.__slider=e;e.value='145';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.waitForTimeout(250);
 assert.equal(await page.evaluate(()=>__slider.isConnected),true,'slider must not be replaced on drag');assert.equal(await page.evaluate(()=>S().ui.glassFx.strength),145);assert.equal(await page.locator('input[type=number][data-gfx="strength"]').inputValue(),'145');
 await page.locator('[data-gfx-remove="refraction"]').click();assert.equal(await page.evaluate(()=>S().ui.glassFx.refraction),false);
 await page.locator('[data-gfx-add]').selectOption('refraction');await page.locator('[data-gfx-action="add"]').click();assert.equal(await page.evaluate(()=>S().ui.glassFx.refraction),true);assert.equal(await page.evaluate(()=>S().ui.glassFx.strength),145);
 await page.locator('[data-gfx-name]').fill('QA Glass');await page.locator('[data-gfx-action="save"]').click();assert.equal(await page.evaluate(()=>S().ui.glassPresets.length),1);
 await page.locator('[data-gfx-name]').fill('QA Renamed');await page.locator('[data-gfx-rename]').click();assert.equal(await page.evaluate(()=>S().ui.glassPresets[0].name),'QA Renamed');
 await page.locator('[data-gfx-import]').setInputFiles({name:'safe.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'pulse-liquid-glass',version:1,name:'Imported',settings:{strength:999,tintColor:'bad',dispersion:true}}))});await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>S().ui.glassPresets.length),2);assert.equal(await page.evaluate(()=>S().ui.glassFx.strength),180);
 await page.waitForTimeout(650);assert.equal(stored.settings.ui.glassPresets.length,2);await page.reload();await page.waitForFunction(()=>window.PulseGlass&&document.body.dataset.surfaceMaterial==='liquid');await settings();assert.equal(await page.evaluate(()=>S().ui.glassPresets.length),2);assert.equal(await page.evaluate(()=>S().ui.glassFx.strength),180);
 await page.locator('[data-gfx-action="reset"]').click();
 // Desktop editor parameters, keyboard and live optics.
 await page.locator('[data-gfx-section="refraction"]>summary').click();await page.locator('[data-gfx-section="blur"]>summary').click();await page.locator('[data-gfx-section="tint"]>summary').click();await page.locator('[data-gfx-section="blur"]').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/editor-parameters-desktop.png'});
 // Scope off must restore standard glass; eco and accessibility override either scope.
 await page.evaluate(()=>{S().ui.glassFx.scopeBar=false;applyCustom();});await page.waitForTimeout(180);assert.equal(await page.locator('#bar').getAttribute('data-glass-off'),'true');assert.doesNotMatch(await page.locator('#bar').evaluate(e=>getComputedStyle(e).backdropFilter),/url/);
 await page.evaluate(()=>{S().ui.glassFx.scopeBar=true;applyCustom();});await page.waitForTimeout(180);
 const mediaCdp=await page.context().newCDPSession(page);for(const state of ['eco','reduce','forced']){if(state==='eco')await page.evaluate(()=>document.body.classList.add('perf-lite'));else if(state==='forced')await page.emulateMedia({forcedColors:'active'});else {const c=mediaCdp;await c.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:'reduce'}]});}await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>PulseGlass.stats().filters),0,state);for(const e of await page.locator('#bar,.glass-demo-panel').all())assert.equal(await e.evaluate(n=>getComputedStyle(n).backdropFilter),'none',state);if(state==='eco')await page.evaluate(()=>document.body.classList.remove('perf-lite'));else if(state==='forced')await page.emulateMedia({forcedColors:'none'});else {const c=mediaCdp;await c.send('Emulation.setEmulatedMedia',{features:[]});}}
 await mediaCdp.detach();await page.setViewportSize({width:390,height:844});await settings();await page.locator('[data-gfx-section="preview"]').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/editor-mobile-preview.png'});await page.locator('[data-gfx-section="presets"]').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/editor-mobile-presets.png'});
 await page.locator('[data-gfx-section="blur"]').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/editor-mobile-parameters.png'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 // The icon geometry must be centered at both widths, normal and Clean layouts.
 for(const width of [390,1366]){await page.setViewportSize({width,height:width===390?844:768});for(const variant of ['full','clean']){await page.evaluate(v=>{S().ui.variant=v;applyCustom();},variant);await page.waitForTimeout(200);const delta=await page.locator('#btnChorus').evaluate(e=>{const b=e.getBoundingClientRect(),i=e.querySelector('svg').getBoundingClientRect();return{x:Math.abs(b.x+b.width/2-i.x-i.width/2),y:Math.abs(b.y+b.height/2-i.y-i.height/2)};});assert.ok(delta.x<1&&delta.y<1,JSON.stringify({width,variant,delta}));}}
 await page.evaluate(()=>{S().ui.variant='full';applyCustom();});
 for(const lang of ['en','ja']){await page.evaluate(lang=>{S().app.language=lang;PulseI18n.setLanguage(lang);lib.setTab='look';rerenderSettings();},lang);await page.waitForTimeout(150);const text=await page.locator('[data-glass-editor]').innerText();console.log('UNTRANSLATED',lang,JSON.stringify(text.split('\n').filter(x=>/[А-Яа-яЁё]/.test(x))));assert.doesNotMatch(text,/[А-Яа-яЁё]/,'new editor must be localized: '+lang);await page.locator('[data-gfx-section="preview"]').scrollIntoViewIfNeeded();await page.screenshot({path:out+`/editor-locale-${lang}.png`});}
 assert.deepEqual(errors,[]);console.log('PASS editor: seven presets, live sliders, remove/add layers, save/rename/import/reload, bounds, scopes, eco/accessibility, mobile, icon center, EN/JA');await browser.close();server.close();process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
