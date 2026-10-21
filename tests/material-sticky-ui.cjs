// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8762,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning'&& /GPU fallback|viz gpu|PulseGPU/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8762'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
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
 await page.goto('http://127.0.0.1:8762');await page.waitForFunction(()=>window.PulseGlass&&document.querySelector('.page'));await page.waitForTimeout(900);
 const assert=require('node:assert/strict');
 async function settings(){await page.evaluate(()=>{closePP();go({r:'settings'});});await page.locator('#setBody').waitFor();await page.waitForTimeout(120);await page.evaluate(()=>{lib.setTab='look';S().ui.setMode='simple';rerenderSettings();});await page.locator('.surface-options').waitFor({timeout:5000});}
 async function mode(v){await page.locator('[data-sel="ui.surfaceMaterial"]').click();await page.locator('.pulse-select-menu [data-option="'+(v==='liquid'?1:0)+'"]').click();await page.waitForFunction(v=>document.body.dataset.surfaceMaterial===v,v);await page.waitForTimeout(500);}


 const preview='[data-gfx-section="preview"]';
 for(const width of [1366,390])for(const tab of ['look','ui'])for(const variant of ['full','clean']){
  await page.setViewportSize({width,height:width===390?844:768});await settings();
  await page.evaluate(v=>{S().ui.variant=v;applyCustom();},variant);
  await page.evaluate(tab=>{lib.setTab=tab;S().ui.setMode=tab==='ui'?'all':'simple';rerenderSettings();},tab);
  const parentGroup=page.locator('.clean-settings-group').filter({has:page.locator('.surface-options')});if(await parentGroup.count()){if(!(await parentGroup.evaluate(e=>e.open)))await parentGroup.locator(':scope>summary').click();}
  const select=page.locator('.surface-options');await select.scrollIntoViewIfNeeded();await select.click();
  assert.equal(await page.locator('.pulse-select-menu [role=option]').count(),2);
  const menu=await page.locator('.pulse-select-menu').boundingBox();assert.ok(menu.x>=7&&menu.x+menu.width<=width-7);
  await page.screenshot({path:out+`/material-dropdown-${width}-${tab}-${variant}.png`});await page.keyboard.press('Escape');assert.equal(await page.locator('.pulse-select-menu').count(),0);
  await mode('liquid');await page.locator('[data-glass-editor]').waitFor();
  await page.evaluate(()=>{for(const d of document.querySelectorAll('.glass-editor>details'))d.open=true;});await page.waitForTimeout(100);
  // The real scrollport is the settings body. Probe multiple positions, not scrollIntoView.
  const metrics=()=>page.evaluate(()=>{const p=document.querySelector('[data-gfx-section="preview"]'),g=document.querySelector('.glass-editor'),s=document.querySelector('#setBody');const r=e=>{const x=e.getBoundingClientRect();return {top:x.top,bottom:x.bottom,height:x.height}};return {p:r(p),g:r(g),s:r(s),scroll:s.scrollTop};});
  await page.evaluate(()=>{const p=document.querySelector('[data-gfx-section="preview"]'),s=document.querySelector('#setBody');s.scrollTop+=p.getBoundingClientRect().top-s.getBoundingClientRect().top+100;});await page.waitForTimeout(150);
  let first=await metrics();console.log('STICKY',width,tab,variant,JSON.stringify(first));assert.ok(Math.abs(first.p.top-first.s.top-8)<2,'preview sticks at scrollport top');
  await page.evaluate(()=>document.querySelector('#setBody').scrollTop+=300);await page.waitForTimeout(150);let second=await metrics();assert.ok(Math.abs(first.p.top-second.p.top)<2);assert.ok(second.p.bottom<=second.g.bottom+1);
  // A real control can be reached and clicked without the preview covering it.
  const control=page.locator('input[type=number][data-gfx="strength"]');await control.scrollIntoViewIfNeeded();await control.fill('127');await control.dispatchEvent('input');assert.equal(await page.evaluate(()=>S().ui.glassFx.strength),127);
  assert.ok(await control.evaluate(e=>{const r=e.getBoundingClientRect();return e===document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)}),'sticky preview must not cover focused inputs');
  await page.screenshot({path:out+`/material-sticky-${width}-${tab}-${variant}.png`});
  // Add inert tail only in the test so even a last settings group can be scrolled past.
  await page.evaluate(()=>{const s=document.createElement('div');s.id='qa-tail';s.style.height='1200px';document.querySelector('[data-glass-editor]').closest('.set-card').after(s);const g=document.querySelector('.glass-editor'),b=document.querySelector('#setBody');b.scrollTop+=g.getBoundingClientRect().bottom-b.getBoundingClientRect().top-100;});await page.waitForTimeout(150);
  let last=await metrics();assert.ok(last.p.bottom<=last.g.bottom+1);assert.ok(last.p.top<last.s.top,'preview leaves viewport with its group');await page.screenshot({path:out+`/material-sticky-boundary-${width}-${tab}-${variant}.png`});
  await page.evaluate(()=>{document.querySelector('#qa-tail').remove();document.querySelector('[data-glass-editor]').open=false;});await page.waitForTimeout(100);assert.equal(await page.locator('.gfx-preview').isVisible(),false);
  await page.evaluate(()=>rerenderSettings());assert.equal(await page.locator('[data-glass-editor]').getAttribute('open'),null,'group collapse survives settings rerender');
  await page.locator('[data-glass-editor]>summary').click();assert.equal(await page.locator('.gfx-preview').isVisible(),true);
  await mode('blur');assert.equal(await page.locator('[data-glass-editor]').count(),0);
  // Keyboard path uses the same real setting and persists through save.
  await page.locator('.surface-options').focus();await page.keyboard.press('Enter');await page.keyboard.press('End');await page.keyboard.press('Enter');await page.waitForTimeout(700);assert.equal(stored.settings.ui.surfaceMaterial,'liquid');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal page overflow');
 }
 assert.deepEqual(errors,[]);console.log('PASS material dropdown and bounded sticky preview: desktop/mobile, simple/all, mouse/keyboard, collapse, hit targets, persistence');await browser.close();server.close();process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
