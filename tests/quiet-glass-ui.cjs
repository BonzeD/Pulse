// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8763,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning'&& /GPU fallback|viz gpu|PulseGPU/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8763'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
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
 await page.goto('http://127.0.0.1:8763');await page.waitForFunction(()=>window.PulseGlass&&document.querySelector('.page'));await page.waitForTimeout(900);
 const assert=require('node:assert/strict');
 async function settings(){await page.evaluate(()=>{closePP();go({r:'settings'});});await page.locator('#setBody').waitFor();await page.waitForTimeout(120);await page.evaluate(()=>{lib.setTab='look';S().ui.setMode='simple';rerenderSettings();});await page.locator('.surface-options').waitFor({timeout:5000});}
 async function mode(v){await page.locator('[data-sel="ui.surfaceMaterial"]').click();await page.locator('.pulse-select-menu [data-option="'+(v==='liquid'?1:0)+'"]').click();await page.waitForFunction(v=>document.body.dataset.surfaceMaterial===v,v);await page.waitForTimeout(500);}


 await page.evaluate(()=>{lib.queue.tracks=[{id:'aaaaaaaaaa0',kind:'song',title:'Memory Reboot',author:'VØJ, Narvent',dur:209,art:'/logo.png'}];lib.queue.idx=0;updateNow();S().ui.panel='#000000';S().ui.bg='#001017';applyCustom();});
 for(const width of [1920,1366,390])for(const variant of ['full','clean']){
  await page.setViewportSize({width,height:width===1920?1080:width===390?844:768});await settings();await page.evaluate(v=>{S().ui.variant=v;applyCustom();rerenderSettings();},variant);await mode('liquid');
  await page.evaluate(()=>{S().ui.glassFx=PulseGlassModel.defaults();applyCustom();rerenderSettings();});await page.waitForTimeout(300);
  await page.locator('[data-gfx-section="editor"]>summary').scrollIntoViewIfNeeded();
  await page.screenshot({path:out+`/quiet-settings-${width}-${variant}.png`});
  assert.equal(await page.locator('.gfx-heading').innerText().then(s=>s.includes('Редактор материала')),false,'no repeated editor heading');
  assert.equal(await page.locator('.glass-demo-panel .gfx-demo-meta>b').innerText(),'Memory Reboot');assert.equal(await page.locator('.gfx-backdrop').count(),0);
  const styles=await page.evaluate(()=>{const s=e=>getComputedStyle(e);return{panel:s(document.querySelector('.view-surface')).backgroundColor,card:s(document.querySelector('[data-glass-editor]').closest('.set-card')).backgroundColor,play:s(document.querySelector('#btnPlay')).boxShadow,off:document.querySelector('#btnNext').dataset.glassOff,nextBg:s(document.querySelector('#btnNext')).backgroundColor,barEdge:s(document.querySelector('#bar')).borderTopColor,mainWidth:document.documentElement.scrollWidth,w:innerWidth};});
  assert.notEqual(styles.card,'rgba(23, 29, 36, 0.88)','no fixed card tint');assert.match(styles.card,/0.035/,'same page surface token');assert.equal(styles.play,'none');assert.equal(styles.off,'true');assert.equal(styles.nextBg,'rgba(0, 0, 0, 0)');assert.ok(styles.mainWidth<=styles.w);
  await page.evaluate(()=>{const p=document.querySelector('[data-gfx-section="preview"]'),s=document.querySelector('#setBody');s.scrollTop+=p.getBoundingClientRect().top-s.getBoundingClientRect().top+100;});await page.waitForTimeout(200);
  await page.screenshot({path:out+`/quiet-preview-${width}-${variant}.png`});
  // Inspect actual mini-transport bounds even at the narrowest supported width.
  assert.ok(await page.locator('.glass-demo-panel').evaluate(e=>{const r=e.getBoundingClientRect();return [...e.children].every(c=>{const q=c.getBoundingClientRect();return q.left>=r.left&&q.right<=r.right+1&&q.top>=r.top&&q.bottom<=r.bottom+1})}),'mini player fits preview');
 }
 // Focus, hover, and stronger saved materials remain distinct from the quiet default.
 await page.setViewportSize({width:1366,height:768});await settings();await page.evaluate(()=>{S().ui.variant='full';applyCustom();rerenderSettings();});await page.locator('[data-gfx-preset="vivid"]').click();await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>S().ui.glassFx.rimPower),120);assert.equal(await page.evaluate(()=>S().ui.glassFx.scopeButtons),true);await page.screenshot({path:out+'/quiet-strong-preset.png'});
 await page.locator('[data-gfx-action="reset"]').click();await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>S().ui.glassFx.rimPower),22);
 for(const width of [1366,390]){await page.setViewportSize({width,height:width===390?844:768});await settings();await page.locator('.surface-options').click();await page.waitForTimeout(300);const fill=await page.locator('.pulse-select-menu').evaluate(e=>getComputedStyle(e).backgroundColor);assert.match(fill,/0.7\)/);await page.screenshot({path:out+`/quiet-dropdown-${width}.png`});await page.keyboard.press('Escape');}
 assert.deepEqual(errors,[]);console.log('PASS quiet appearance: black panel fallback, real track preview, unboxed buttons, stronger preset/reset, desktop/mobile/full/clean, preview bounds');await browser.close();server.close();process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
