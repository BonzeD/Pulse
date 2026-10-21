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

 const assert=require('node:assert/strict');page.setDefaultTimeout(6000);
 const qa=async(name,fn)=>{await fn();console.log('PASS',name);};
 await qa('CSS masks fade both visible stage edges, for overscan 2D and direct GPU',async()=>{
  const maskPage=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1});
  const css=fs.readFileSync(root+'/ui-fixes.css','utf8');
  for(const id of ['viz','vizDirect']){
   await maskPage.setContent(`<style>html,body{margin:0;background:#000}#pp{position:absolute;left:180px;top:240px}#stage{position:relative;width:800px;height:300px}canvas{position:absolute;pointer-events:none}${css}</style><div id="pp"><div id="stage"><canvas id="${id}"></canvas></div></div>`);
   await maskPage.evaluate(id=>{const c=document.getElementById(id),r=c.getBoundingClientRect();c.width=r.width;c.height=r.height;c.getContext('2d').fillStyle='#fff';c.getContext('2d').fillRect(0,0,c.width,c.height);},id);
   const png=await maskPage.screenshot();fs.writeFileSync(out+'/fade-pixel-'+id+'.png',png);const row=await maskPage.evaluate(async base64=>{const img=new Image();img.src='data:image/png;base64,'+base64;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);return Array.from(ctx.getImageData(0,390,c.width,1).data);},png.toString('base64'));
   const pixel=(x)=>row[x*4];
   const left=[180,188,212,260,360].map(pixel),right=[979,971,947,899,799].map(pixel);
   assert.ok(left[0]<4&&right[0]<4,id+' boundary alpha must reach zero');
   for(const side of [left,right]){for(let i=1;i<side.length;i++)assert.ok(side[i]>side[i-1],id+' fade must increase gradually');assert.ok(side.at(-1)>248);}
   assert.equal(pixel(170),0);assert.equal(pixel(990),0);console.log(id,'left/right luminance',left,right);
  }await maskPage.close();
 });
 await page.evaluate(()=>{lib.queue={tracks:[{id:'abcdefghijk',title:'Проверка краёв',author:'Pulse QA',dur:240,art:'/logo.png'}],idx:0};updateNow();openPP();setMode('visual');setViz('aurora');});await page.waitForTimeout(600);await page.screenshot({path:out+'/fade-aurora-scene.png'});await page.click('#btnPP');await page.waitForTimeout(450);
 const style=()=>page.locator('#bar').evaluate(e=>{const s=getComputedStyle(e);return{opacity:+s.opacity,translate:s.translate,scale:s.scale,visibility:s.visibility,inert:e.inert,animations:e.getAnimations().map(a=>({name:a.transitionProperty,time:a.currentTime,duration:a.effect.getTiming().duration}))};});
 const reveal=()=>page.locator('#btnBarShow').evaluate(e=>({opacity:+getComputedStyle(e).opacity,events:getComputedStyle(e).pointerEvents,focused:document.activeElement===e}));
 await qa('hide slides/scales/fades, is inert immediately, and stays visible while exiting',async()=>{
  await page.waitForTimeout(500);await page.click('#btnBarHide');
  const mid=await style();assert.equal(mid.inert,true);assert.equal(mid.visibility,'visible');assert.ok(mid.animations.some(a=>a.name==='translate'),'real slide transition');
  await page.waitForTimeout(90);const moving=await style();assert.ok(moving.opacity>0&&moving.opacity<1);assert.notEqual(moving.translate,'0px');
  await page.screenshot({path:out+'/bar-hide-mid.png'});await page.waitForTimeout(430);const end=await style();assert.equal(end.visibility,'hidden');assert.equal(end.opacity,0);
 });
 await qa('show button only appears in bottom-center hover area and does not intercept other clicks',async()=>{
  await page.mouse.move(30,300);await page.waitForTimeout(280);let r=await reveal();assert.equal(r.opacity,0);assert.equal(r.events,'none');assert.equal(r.focused,false);
  await page.mouse.move(1366/2,768-55);await page.waitForTimeout(300);r=await reveal();assert.equal(r.opacity,1);assert.equal(r.events,'auto');await page.screenshot({path:out+'/bar-hover-reveal.png'});
  await page.mouse.move(30,740);await page.waitForTimeout(300);assert.equal((await reveal()).opacity,0);
  await page.mouse.move(1366/2,768-120);await page.waitForTimeout(280);assert.equal((await reveal()).opacity,0);
  await page.mouse.move(1366/2,768-45);await page.waitForTimeout(300);await page.click('#btnBarShow');
  const start=await style();assert.equal(start.visibility,'visible');assert.equal(start.inert,false);assert.ok(start.animations.some(a=>a.name==='translate'));await page.waitForTimeout(500);assert.equal((await style()).opacity,1);
 });
 await qa('keyboard can reveal the button outside the hover zone',async()=>{
  await page.mouse.move(20,200);await page.focus('#btnNav');await page.keyboard.press('Control+Shift+B');await page.waitForTimeout(450);
  assert.equal((await reveal()).focused,true);assert.equal((await reveal()).opacity,1);await page.keyboard.press('Enter');await page.waitForTimeout(500);assert.equal((await style()).inert,false);
 });
 await qa('rapid reversal is continuous rather than teleporting',async()=>{
  await page.click('#btnBarHide');await page.waitForTimeout(100);const a=await style();
  await page.keyboard.press('Control+Shift+B');const b=await style();assert.ok(Math.abs(a.opacity-b.opacity)<.2);await page.waitForTimeout(500);assert.equal((await style()).opacity,1);
 });
 await qa('full/clean and lyrics-only retain hover recovery and a single progress bar',async()=>{
  for(const v of ['full','clean']){
   await page.evaluate(v=>{S().ui.variant=v;applyCustom();lib.queue={tracks:[{id:'abcdefghijk',title:'Panel QA',author:'QA',dur:240,art:'/logo.png'}],idx:0};updateNow();S().ly.kBar='on';lyStageOpen(true);},v);await page.waitForTimeout(450);
   await page.click('#btnBarHide');await page.mouse.move(20,200);await page.waitForTimeout(450);assert.equal((await reveal()).opacity,0);
   assert.notEqual(await page.locator('.lys-prog').evaluate(e=>getComputedStyle(e).display),'none');
   await page.mouse.move(683,723);await page.waitForTimeout(280);await page.click('#btnBarShow');await page.waitForTimeout(500);assert.equal((await style()).inert,false);
   assert.equal(await page.locator('.lys-prog').evaluate(e=>getComputedStyle(e).display),'none');await page.evaluate(()=>lyStageOpen(false));await page.waitForTimeout(300);
  }
 });
 await qa('reduced motion and disabled animation settle immediately',async()=>{
  for(const os of [true,false]){
   await page.evaluate(os=>{S().ui.variant='full';S().look.anim=os;applySettings();applyCustom();},os);await page.emulateMedia({reducedMotion:os?'reduce':'no-preference'});
   await page.click('#btnBarHide');const a=await style();assert.equal(a.visibility,'hidden');assert.equal(a.animations.length,0);
   await page.keyboard.press('Control+Shift+B');assert.equal((await style()).opacity,1);assert.equal((await style()).animations.length,0);
  }
 });
 assert.deepEqual(errors,[]);console.log('FADE + PLAYER MOTION QA COMPLETE');await browser.close();server.close();process.exit(0);
})().catch(e=>{console.error(e);server.close();process.exit(1);});
