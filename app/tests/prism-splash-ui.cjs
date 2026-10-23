/* Startup-only offline fixture, plus the existing full-app motion-splash smoke. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'../renderer'),out=process.env.PULSE_PRISM_ARTIFACTS||path.join(__dirname,'artifacts/prism-splash');
fs.mkdirSync(out,{recursive:true});
const source=fs.readFileSync(path.join(root,'index.html'),'utf8'),markup=source.slice(source.indexOf('<div id="splash"'),source.indexOf('<script src="splash.js">'));
const server=http.createServer((req,res)=>{const u=req.url.split('?')[0];if(u==='/favicon.ico'){res.writeHead(204);return res.end();}if(u==='/'){res.setHeader('Content-Type','text/html');return res.end('<meta charset="UTF-8"><style>html,body{margin:0;background:#101015}body{--motion-out:cubic-bezier(.2,.75,.25,1);--motion-in:ease}</style><link rel="stylesheet" href="splash.css"><link rel="stylesheet" href="motion.css">'+markup+'<script src="splash.js"></script>');}const p=path.resolve(root,'.'+u);if(!p.startsWith(root+path.sep)||!fs.existsSync(p)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',p.endsWith('.css')?'text/css':'text/javascript');fs.createReadStream(p).pipe(res);});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});const errors=[];
 async function fixture({fallback=false,reducedMotion='no-preference',forcedColors='none',disabled=false}={}){
  const context=await browser.newContext({viewport:{width:1366,height:768},reducedMotion,forcedColors}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(({fallback,disabled})=>{
   window.__lang='en';window.PulseI18n={language:()=>__lang};window.__contexts=0;window.__frames=0;
   if(disabled)localStorage.setItem('pulse.splash','off');
   const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='webgl'){__contexts++;if(fallback)return null;const gl=get.call(this,type,...args);window.__gl=gl;return gl;}return get.call(this,type,...args);};
   const raf=window.requestAnimationFrame;window.requestAnimationFrame=f=>raf.call(window,t=>{__frames++;f(t);});
  },{fallback,disabled});
  await page.clock.install();await page.clock.pauseAt(new Date());await page.goto(origin);return{context,page};
 }
 try{
  const {context,page}=await fixture();await page.clock.runFor(1100);
  assert.equal(await page.locator('#splash').getAttribute('data-style'),'prism');assert.equal(await page.locator('#splash').evaluate(e=>e.classList.contains('sp-prism-ready')),true);assert.equal(await page.evaluate(()=>__contexts),1);assert.equal(await page.evaluate(()=>__gl.getError()),0);
  await page.screenshot({path:path.join(out,'prism-1366-en.png')});
  await page.evaluate(()=>{__lang='ru';dispatchEvent(new Event('pulse-language'));});assert.equal(await page.locator('.sp-tagline').innerText(),'Музыка в твоём ритме');await page.screenshot({path:path.join(out,'prism-1366-ru.png')});
  await page.setViewportSize({width:390,height:844});await page.clock.runFor(100);
  for(const [language,text]of Object.entries({ja:'あなたのリズムで音楽を',uk:'Музика у твоєму ритмі'})){
   await page.evaluate(language=>{__lang=language;dispatchEvent(new Event('pulse-language'));},language);assert.equal(await page.locator('.sp-tagline').innerText(),text);
   for(const selector of ['.sp-word','.sp-tagline']){const box=await page.locator(selector).boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390,selector+' stays inside mobile width');}
   await page.screenshot({path:path.join(out,'prism-390-'+language+'.png')});
  }
  await page.keyboard.press('Enter');await page.clock.runFor(700);assert.equal(await page.locator('#splash').count(),0);assert.equal(await page.evaluate(()=>__gl.isContextLost()),true);
  const frames=await page.evaluate(()=>__frames);await page.clock.runFor(500);assert.equal(await page.evaluate(()=>__frames),frames,'no startup animation loop survives dismissal');
  await page.reload();await page.clock.runFor(100);assert.equal(await page.locator('#splash').count(),0,'session reload does not replay startup');await context.close();
  const fallback=await fixture({fallback:true});await fallback.page.clock.runFor(1100);assert.equal(await fallback.page.locator('#splash.sp-prism-fallback').count(),1);await fallback.page.screenshot({path:path.join(out,'prism-fallback.png')});await fallback.page.locator('#splash').click();await fallback.page.clock.runFor(700);assert.equal(await fallback.page.locator('#splash').count(),0);await fallback.context.close();
  for(const options of [{reducedMotion:'reduce'},{disabled:true}]){const f=await fixture(options);await f.page.clock.runFor(100);assert.equal(await f.page.locator('#splash').count(),0);assert.equal(await f.page.evaluate(()=>__contexts),0);await f.context.close();}
  const forced=await fixture({forcedColors:'active'});await forced.page.clock.runFor(1100);assert.equal(await forced.page.evaluate(()=>__contexts),0);await forced.page.screenshot({path:path.join(out,'prism-forced-colors.png')});await forced.page.keyboard.press('Escape');await forced.page.clock.runFor(700);await forced.context.close();
  const live=await fixture();await live.page.clock.runFor(800);await live.page.emulateMedia({reducedMotion:'reduce'});await live.page.clock.runFor(100);assert.equal(await live.page.locator('#splash').count(),0);assert.equal(await live.page.evaluate(()=>__gl.isContextLost()),true);await live.context.close();
  const lost=await fixture();await lost.page.clock.runFor(800);await lost.page.evaluate(()=>__gl.getExtension('WEBGL_lose_context').loseContext());await lost.page.clock.runFor(100);assert.equal(await lost.page.locator('#splash.sp-prism-fallback').count(),1);await lost.page.keyboard.press('Escape');await lost.page.clock.runFor(700);assert.equal(await lost.page.locator('#splash').count(),0);await lost.context.close();
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({errors,viewports:[1366,390],languages:['en','ru','ja','uk'],fallback:true,forcedColors:true,contextLoss:true,reloadSkip:true,resourceCleanup:true},null,2));
  console.log('PASS prism startup: WebGL, 1366/390, RU/EN/JA/UK, keyboard/click skip, no repeated intro, fallback, reduced motion, forced colors, context loss, context release and zero trailing RAFs');
 }finally{await browser.close();}
})().then(()=>server.close()).catch(e=>{console.error(e);server.close();process.exitCode=1;});
