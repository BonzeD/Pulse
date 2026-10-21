// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8760,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || chromium.executablePath(),headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning'&& /GPU fallback|viz gpu|PulseGPU/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8760'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
 await page.addInitScript(()=>{
   const feed={shelves:[{title:'Тестовые треки',items:Array.from({length:14},(_,i)=>({kind:'song',id:String(i).padStart(11,'a'),title:'Тест переключения '+(i+1),author:'Pulse QA',dur:240,loaded:true}))}],chips:[]};
   const proxy=prefix=>new Proxy({}, {get(_t,k){return (...args)=>{
     if(String(k).startsWith('on'))return;
     if(k==='getLibrary')return Promise.resolve({settings:{app:{language:'ru'},look:{splash:false},perf:{showFps:false},ui:{panels:true}}});
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
 await page.goto('http://127.0.0.1:8760');await page.waitForTimeout(1600);


 const assert=require('node:assert/strict');page.setDefaultTimeout(10000);
 const qa=async(name,fn)=>{await fn();console.log('PASS',name);};
 try {
 await qa('launcher explains live editing and safe cancellation',async()=>{await page.evaluate(()=>{lib.setTab='editor';go({r:'settings'});});await page.waitForTimeout(600);assert.match(await page.locator('#view').innerText(),/Отмена/);await page.screenshot({path:out+'/editor-release-launcher.png'});});
 await qa('editor selects real elements and undo/redo restore values',async()=>{await page.evaluate(()=>{S().cfg.autoSave=true;lib.cfgActive='qa-layout';lib.configs=[{id:'qa-layout',name:'Мой конфиг',parts:['layout'],data:{layout:JSON.parse(JSON.stringify(S().layout))},at:123}];window.__configBefore=JSON.stringify(lib.configs);czEdit('home');czSelect(document.querySelector('#brand'));czSet({x:24,scale:125,tc:'#ff0000',sh:20,bw:3,bk:10,rot:15});});assert.equal(await page.evaluate(()=>czItem('brand').x),24);await page.waitForTimeout(1700);assert.equal(await page.evaluate(()=>JSON.stringify(lib.configs)),await page.evaluate(()=>window.__configBefore));await page.click('#czDock [data-cz="undo"]');assert.equal(await page.evaluate(()=>czItem('brand').x||0),0);await page.click('#czDock [data-cz="redo"]');assert.equal(await page.evaluate(()=>czItem('brand').x),24);});
 await qa('full element reset removes all effects and is undoable',async()=>{await page.waitForTimeout(400);await page.click('[data-cz="clr"]');assert.equal(await page.evaluate(()=>S().layout.items.brand),undefined);await page.click('#czDock [data-cz="undo"]');assert.equal(await page.evaluate(()=>czItem('brand').rot),15);});
 await qa('numeric validation rejects nonfinite values and clamps physical limits',async()=>{await page.evaluate(()=>czSet({x:Infinity,op:-25,w:-100,h:999999,scale:900}));const v=await page.evaluate(()=>czItem('brand'));assert.equal(v.x,24);assert.equal(v.op,0);assert.equal(v.w,0);assert.equal(v.h,16384);assert.equal(v.scale,300);await page.evaluate(()=>czUndo(false));});
 await qa('critical regions cannot be hidden through the layer or property controls',async()=>{await page.evaluate(()=>{czSelect(document.querySelector('#bar'));czSet({hidden:true});});assert.equal(await page.evaluate(()=>!!czItem('bar').hidden),false);assert.equal(await page.locator('[data-czeye="bar"]').isDisabled(),true);});
 await qa('Tab stays in editor and keyboard activates buttons normally',async()=>{await page.locator('#czDock [data-cz="help"]').focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>czE.on),true);assert.equal(await page.evaluate(()=>czE.help),true);const wasPlaying=await page.evaluate(()=>playing);await page.locator('#czDock [data-cz="help"]').focus();await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>czE.help),false);assert.equal(await page.evaluate(()=>playing),wasPlaying);await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>!!document.activeElement.closest('#czDock')),true);});
 await qa('cancelled resize removes temporary inline scale and restores layout',async()=>{await page.evaluate(()=>{czSelect(document.querySelector('#brand'));czE.drag={rs:true,on:true,o:false,s:200};czE.el.style.setProperty('scale','2','important');czEndDrag(true);});assert.equal(await page.locator('#brand').evaluate(el=>el.style.getPropertyValue('scale')),'');});
 await qa('session cancellation rolls back window, objects, and other editor parts',async()=>{await page.evaluate(()=>{window.__beforeCancel=JSON.stringify(czSession);czAddObj('text');czPart('app');setP('ui.radius',3);settingChanged('ui.radius');});page.once('dialog',d=>d.accept());await page.click('#czDock [data-cz="cancel"]');assert.equal(await page.evaluate(()=>JSON.stringify(S())),await page.evaluate(()=>window.__beforeCancel));assert.equal(await page.evaluate(()=>czE.on),false);});
 await qa('cancel confirmation can keep an editing session open',async()=>{await page.evaluate(()=>{czEdit('home');czSelect(document.querySelector('#brand'));czSet({x:40});});page.once('dialog',d=>d.dismiss());await page.click('#czDock [data-cz="cancel"]');assert.equal(await page.evaluate(()=>czE.on),true);assert.equal(await page.evaluate(()=>czItem('brand').x),40);});
 await qa('done persists edits; editor panel fits the supported minimum viewport',async()=>{await page.setViewportSize({width:980,height:640});await page.evaluate(()=>{S().studio.side='float';S().studio.w=4000;S().studio.fx=9000;S().studio.fy=9000;czStudioApply();});await page.waitForTimeout(500);const r=await page.locator('#czDock').boundingBox();assert.ok(r.x>=0&&r.x+r.width<=980);await page.evaluate(()=>{S().studio={side:'right',width:'normal',collapsed:{}};czStudioApply();});await page.waitForTimeout(300);await page.screenshot({path:out+'/editor-release-minimum.png'});await page.click('#czDock .czd-foot [data-cz="done"]');assert.equal(await page.evaluate(()=>czE.on),false);assert.equal(await page.evaluate(()=>czItem('brand').x),40);});
 await qa('typing object text keeps focus and supports undo',async()=>{await page.setViewportSize({width:1366,height:768});await page.evaluate(()=>{S().studio={side:'right',width:'normal',collapsed:{}};czEdit('home');czAddObj('text');});const field=page.locator('[data-czf="text"]');await field.fill('Мой Pulse — своя надпись');assert.equal(await field.inputValue(),'Мой Pulse — своя надпись');await page.waitForTimeout(1000);assert.ok((await page.locator('#toast').boundingBox()).height<100);await field.evaluate(e=>e.scrollIntoView({block:'center'}));await page.waitForTimeout(300);await page.screenshot({path:out+'/editor-release-object.png'});await page.locator('#czDock .czd-foot [data-cz="done"]').click();});
 await qa('style chip is removed but scene style controls remain',async()=>{await page.evaluate(()=>{lib.queue={tracks:[{id:'qa',title:'QA',author:'Pulse QA',dur:240}],idx:0};S().ly.vis='kinetic';S().ly.kBar='on';S().ui.playerBarHidden=false;lyStageOpen(true);updateNow();});await page.waitForTimeout(500);assert.equal(await page.locator('#btnLybStyle').count(),0);assert.ok(await page.locator('#bar').isVisible());await page.screenshot({path:out+'/editor-release-lyrics-bar.png'});await page.evaluate(()=>lyStageOpen(false));});
 await qa('all editor parts open, select layers and close cleanly',async()=>{for(const sc of ['widget','wall','discord','ly','viz','app']){await page.evaluate(sc=>{czPart(sc);const keys=Object.keys(ED[sc]());if(keys.length)edPick(sc,keys[0]);},sc);await page.waitForTimeout(3700);if(sc!=='app')assert.equal(await page.locator('#czLayer').evaluate(el=>getComputedStyle(el).display),'none');assert.ok(await page.locator('#czDock .czd-foot [data-cz="cancel"]').isVisible());await page.screenshot({path:out+'/editor-release-'+sc+'.png'});await page.evaluate(()=>czExit());}});
 assert.deepEqual(errors,[]);
 } finally { await browser.close();server.close(); }
})().catch(e=>{console.error(e);server.close();process.exit(1);});
