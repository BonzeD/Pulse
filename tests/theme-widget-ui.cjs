// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8774,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning'&& /GPU fallback|viz gpu|PulseGPU/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8774'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
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
 await page.goto('http://127.0.0.1:8774');await page.waitForFunction(()=>window.PulseGlass&&document.querySelector('.page'));await page.waitForTimeout(900);
 const assert=require('node:assert/strict');
 async function settings(){await page.evaluate(()=>{closePP();go({r:'settings'});});await page.locator('#setBody').waitFor();await page.waitForTimeout(120);await page.evaluate(()=>{lib.setTab='look';S().ui.setMode='simple';rerenderSettings();});await page.locator('.surface-options').waitFor({timeout:5000});}
 async function mode(v){await page.locator('[data-sel="ui.surfaceMaterial"]').click();await page.locator('.pulse-select-menu [data-option="'+(v==='liquid'?1:0)+'"]').click();await page.waitForFunction(v=>document.body.dataset.surfaceMaterial===v,v);await page.waitForTimeout(500);}



 await settings();
 const choose=async v=>{await page.locator('[data-sel="look.background.mode"]').click();await page.locator('.pulse-select-menu [data-option="'+['default','solid','gradient','image'].indexOf(v)+'"]').click();await page.waitForFunction(v=>document.body.dataset.background===v,v);};
 await choose('gradient');
 await page.locator('[data-col="look.background.first"]').fill('#193041');await page.locator('[data-col="look.background.second"]').fill('#42223f');
 await page.evaluate(()=>{S().look.background.dim=20;applyCustom();save();rerenderSettings();});await page.waitForTimeout(300);
 assert.match(await page.locator('#pulseBackdrop .pb-image').evaluate(e=>e.style.backgroundImage),/linear-gradient/);
 for(const width of [1366,390]){await page.setViewportSize({width,height:width===390?844:768});await page.locator('[data-sel="look.background.mode"]').scrollIntoViewIfNeeded();await page.screenshot({path:out+`/theme-gradient-${width}.png`});}
 await choose('solid');await page.locator('[data-col="look.background.first"]').fill('#152e30');await page.waitForTimeout(300);assert.equal(await page.locator('#pulseBackdrop .pb-image').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(21, 46, 48)');assert.equal(await page.locator('#ambient').evaluate(e=>getComputedStyle(e).display),'none');
 await choose('image');await page.evaluate(()=>{S().look.background.dim=65;applyCustom();});const fc=page.waitForEvent('filechooser');await page.locator('[data-background-pick]').click();await (await fc).setFiles(path.resolve(root,'immersion-assets/nasa-earth-day.jpg'));await page.waitForFunction(()=>S().look.background.image.startsWith('data:image/jpeg;base64,'));
 assert.equal(await page.evaluate(async()=>{try{await PulseBackground.encode(new File(['<svg></svg>'],'fake.png',{type:'image/png'}));return false;}catch{return true;}}),true);
 const savedImage=await page.evaluate(()=>S().look.background.image);assert.ok(savedImage.length<1500000);
 await page.waitForTimeout(800);assert.equal(stored.settings.look.background.image,savedImage);
 await page.reload();await page.waitForFunction(()=>window.PulseBackground&&document.body.dataset.background==='image');assert.equal(await page.evaluate(()=>S().look.background.image),savedImage);
 await settings();await page.setViewportSize({width:1366,height:768});await page.locator('[data-sact="cx:theme:studio"]').first().click();await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>S().look.background.image),savedImage);assert.equal(await page.evaluate(()=>S().ui.bg),'#0d0f12');
 await page.evaluate(()=>{go({r:'home'});});await page.waitForTimeout(400);await page.screenshot({path:out+'/theme-photo-home.png'});
 await settings();await page.locator('[data-sel="look.background.mode"]').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/theme-photo-settings.png'});
 for(const lang of ['en','ja']){await page.evaluate(lang=>{S().app.language=lang;PulseI18n.setLanguage(lang);rerenderSettings();},lang);await page.waitForTimeout(200);const texts=await page.locator('#setBody').innerText();assert.ok(!texts.includes('Задний фон'),lang);}
 await page.evaluate(()=>{S().app.language='ru';PulseI18n.setLanguage('ru');rerenderSettings();});await page.locator('[data-background-remove]').click();await page.waitForFunction(()=>!S().look.background.image);assert.equal(await page.locator('#pulseBackdrop .pb-image').evaluate(e=>e.style.backgroundImage),'none');
 await choose('default');assert.equal(await page.locator('#pulseBackdrop').isVisible(),false);
 assert.deepEqual(errors,[]);
 // Widget operates with the same handlers in preview and desktop; no window IPC changes.
 const widget=await browser.newPage();await widget.addInitScript(()=>{window.__h={};window.pulse={onState:f=>__h.state=f,onWidgetConfig:f=>__h.cfg=f,onLyrics:f=>__h.ly=f,command:()=>{},win:()=>{}};});await widget.goto('http://127.0.0.1:8774/widget.html');await widget.waitForFunction(()=>!!window.__h.cfg);
 for(const [size,[width,height]] of Object.entries({mini:[320,84],standard:[420,156],large:[460,300]})){
  await widget.setViewportSize({width,height});await widget.evaluate(size=>{__h.cfg({size,theme:'glass',appPanel:'#141820',appBg:'#090b10',appText:'#ffffff',accent:'#ff2d95',extra:true,vol:true});__h.state({has:true,id:'qa',title:'Memory Reboot',author:'VØJ, Narvent',art:'/logo.png',playing:true,cur:72,dur:209,volume:65});},size);await widget.waitForTimeout(180);
  const bounds=await widget.locator('#play,#prev,#next,#t,#a,.prog').evaluateAll(es=>es.filter(e=>e.offsetParent!==null).map(e=>({id:e.id,r:e.getBoundingClientRect().toJSON()})));for(const {id,r} of bounds)assert.ok(r.left>=0&&r.top>=0&&r.right<=width+.5&&r.bottom<=height+.5,size+' '+id+JSON.stringify(r));
  await widget.screenshot({path:out+`/pulse-widget-${size}.png`,omitBackground:true});
 }
 await widget.evaluate(()=>__h.state({has:false}));assert.equal(await widget.locator('#cover').evaluate(e=>e.style.backgroundImage),'');
 // All installer/uninstaller pages at their actual design dimensions.
 const inst=await browser.newPage({viewport:{width:680,height:440}});
 for(const pg of ['wel','upd','prog','uprog','fin','ucf','udone']){await inst.goto('file://'+path.resolve(__dirname,'../build/installer-ui/design.html')+'?p='+pg+'&v=1.0.0&size=520');const text=await inst.locator('body').innerText();assert.doesNotMatch(text,/[А-Яа-яЁё]/);await inst.screenshot({path:out+'/installer-english-'+pg+'.png'});}
 console.log('PASS theme/background modes, photo copy/reload/remove, presets preserve photo, EN/JA, widget geometry and 7 English installer pages');await browser.close();server.close();process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
