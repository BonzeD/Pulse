// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8765,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning'&& /GPU fallback|viz gpu|PulseGPU/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8765'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
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
 await page.goto('http://127.0.0.1:8765');await page.waitForFunction(()=>window.PulseGlass&&document.querySelector('.page'));await page.waitForTimeout(900);
 const assert=require('node:assert/strict');
 async function settings(){await page.evaluate(()=>{closePP();go({r:'settings'});});await page.locator('#setBody').waitFor();await page.waitForTimeout(120);await page.evaluate(()=>{lib.setTab='look';S().ui.setMode='simple';rerenderSettings();});await page.locator('.surface-options').waitFor({timeout:5000});}
 async function mode(v){await page.locator('[data-sel="ui.surfaceMaterial"]').click();await page.locator('.pulse-select-menu [data-option="'+(v==='liquid'?1:0)+'"]').click();await page.waitForFunction(v=>document.body.dataset.surfaceMaterial===v,v);await page.waitForTimeout(500);}


 await page.evaluate(()=>{lib.queue.tracks=[{id:'aaaaaaaaaa0',kind:'song',title:'Memory Reboot',author:'VØJ, Narvent',dur:209,art:'/logo.png'}];lib.queue.idx=0;updateNow();});
 for(const width of [1366,390])for(const variant of ['full','clean'])for(const material of ['blur','liquid'])for(const glass of [true,false]){
  await page.setViewportSize({width,height:width===390?844:768});await page.evaluate(({variant,material,glass})=>{S().ui.variant=variant;S().ui.surfaceMaterial=material;S().ui.glass=glass;applyCustom();}, {variant,material,glass});if(width===390)await settings();await page.waitForTimeout(200);await page.mouse.move(3,3);
  for(const state of ['has','on'])for(const scale of [1,1.15]){
   await page.locator('#bar').evaluate((e,scale)=>e.style.setProperty('scale',String(scale),'important'),scale);
   await page.locator('#btnChorus').evaluate((e,state)=>{e.classList.remove('has','on');e.classList.add(state);},state);await page.waitForTimeout(220);
   const g=await page.locator('#btnChorus').evaluate(e=>{const r=e.getBoundingClientRect(),svg=e.querySelector('svg'),sr=svg.getBoundingClientRect(),u=svg.querySelector('use'),bb=u.getBBox(),p=new DOMPoint(bb.x+bb.width/2,bb.y+bb.height/2).matrixTransform(svg.getScreenCTM());const br=e.closest('#bar').getBoundingClientRect();return{rect:{x:r.x,y:r.y,bottom:r.bottom},barRect:{x:br.x,y:br.y,bottom:br.bottom},insideBar:r.left>=br.left-1&&r.right<=br.right+1&&r.top>=br.top-1&&r.bottom<=br.bottom+1,display:getComputedStyle(e).display,bg:getComputedStyle(e).backgroundColor,filter:getComputedStyle(e).backdropFilter,w:r.width,h:r.height,sw:sr.width,inkW:bb.width,dx:Math.abs(r.x+r.width/2-p.x),dy:Math.abs(r.y+r.height/2-p.y)};});
   assert.ok(g.w>20&&g.sw>10&&g.inkW>10,'assert a visible glyph, never a zero-size hidden button');assert.match(g.display,/^(inline-)?grid$/);assert.ok(g.insideBar,'visible chorus must stay inside bar: '+JSON.stringify({width,variant,material,glass,state,scale,g}));assert.ok(g.dx<.6&&g.dy<.6,JSON.stringify({width,variant,material,glass,state,scale,g}));
   if(material==='blur'&&state==='has'){assert.equal(g.bg,'rgba(0, 0, 0, 0)');assert.equal(g.filter,'none');}
  }
  await page.locator('#bar').evaluate(e=>e.style.removeProperty('scale'));await page.locator('#btnChorus').evaluate(e=>{e.classList.remove('on');e.classList.add('has');});await page.waitForTimeout(220);
  const collisions=await page.locator('#bar').evaluate(bar=>{const bs=[...bar.querySelectorAll('button')].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden');const overlaps=[];for(let i=0;i<bs.length;i++)for(let j=i+1;j<bs.length;j++){const a=bs[i].getBoundingClientRect(),b=bs[j].getBoundingClientRect();if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2)overlaps.push([bs[i].id,bs[j].id]);}return overlaps;});assert.deepEqual(collisions,[],JSON.stringify({width,variant,material,glass,collisions}));
  if(glass){await page.screenshot({path:out+`/transport-fix-${material}-${width}-${variant}.png`});}
  if(material==='blur')for(const id of ['btnNext','btnMore','btnChorus'])assert.equal(await page.locator('#'+id).evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
 }
 await page.setViewportSize({width:1366,height:768});await page.evaluate(()=>{S().ui.variant='full';S().ui.surfaceMaterial='blur';S().ui.glass=true;applyCustom();});await page.waitForTimeout(150);await page.locator('#btnChorus').evaluate(e=>e.classList.add('has'));
 await page.locator('#btnChorus').hover();await page.waitForTimeout(250);assert.equal(await page.locator('#btnChorus').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(255, 255, 255, 0.08)');await page.keyboard.press('Tab');await page.locator('#btnChorus').focus();assert.notEqual(await page.locator('#btnChorus').evaluate(e=>getComputedStyle(e).outlineStyle),'none');
 await page.locator('#btnChorus').click({button:'right'});assert.equal(await page.evaluate(()=>S().chorus.only),true);await page.keyboard.press('Escape');await page.evaluate(()=>{chorusOnly(false);document.querySelector('#btnChorus').classList.add('has');});
 await page.mouse.move(3,3);await page.evaluate(()=>document.body.classList.add('perf-lite'));await page.waitForTimeout(150);assert.equal(await page.locator('#btnNext').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');await page.evaluate(()=>document.body.classList.remove('perf-lite'));
 await page.emulateMedia({forcedColors:'active'});await page.waitForTimeout(150);assert.equal(await page.locator('#btnChorus').evaluate(e=>getComputedStyle(e).backdropFilter),'none');assert.notEqual(await page.locator('#btnNext').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');await page.screenshot({path:out+'/transport-fix-forced-colors.png'});
 assert.deepEqual(errors,[]);console.log('PASS transport: no black button fills in standard glass (glass on/off, eco), visible chorus glyph and SVG centres, has/on states, full/clean, desktop/mobile, 100%/115% scale, hover/focus/right-click, forced colors');await browser.close();server.close();process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
