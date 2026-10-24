/* Full application UI with an explicit local-only native bridge fixture. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'../renderer'),out=process.env.PULSE_SETUP_ARTIFACTS||path.join(__dirname,'artifacts/developer-experience');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const u=req.url.split('?')[0],p=path.resolve(root,'.'+(u==='/'?'/index.html':u));if(!p.startsWith(root+path.sep)||!fs.existsSync(p)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});const errors=[];
async function setup(options={}){
 const context=await browser.newContext({viewport:{width:1366,height:900},locale:'ru-RU',...options.context});const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));await page.route('**/*',r=>{if(r.request().url().startsWith(origin))return r.continue();if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
 await page.addInitScript(({saved,failed,splash})=>{
  window.__saved=saved;window.__failed=failed;window.__writes=[];window.__flushOK=true;window.__auth=null;window.__copied='';window.__wins=[];
  const proxy=()=>new Proxy({}, {get(_t,k){return (...args)=>{
   if(String(k).startsWith('on'))return;
   if(k==='getLibrary')return __failed?Promise.reject(Error('read failure')):Promise.resolve(__saved);
   if(k==='flushLibrary'){if(__flushOK)__writes.push(JSON.parse(JSON.stringify(args[0])));return __flushOK;}
   if(k==='saveLibrary'){__writes.push(JSON.parse(JSON.stringify(args[0])));return;}
   if(k==='copyText'){__copied=args[0];return Promise.resolve({ok:true});}
   if(k==='win'){__wins.push(args[0]);return;}
   if(k==='list'||k==='playlists'||k==='downloads'||k==='displays'||k==='browsers')return Promise.resolve([]);
   if(k==='offlineList')return Promise.resolve({});
   if(k==='status')return Promise.resolve({am:{user:false},sp:{user:false}});
   if(k==='info')return Promise.resolve(__auth);
   if(k==='version')return Promise.resolve('1.0.2');
   if(k==='lyrics')return Promise.resolve({none:true});
   if(k==='feed'||k==='search')return Promise.resolve({shelves:[],chips:[]});
   if(k==='next')return Promise.resolve({tracks:[]});
   if(k==='resolve')return new Promise(()=>{});
   if(k==='getGlass')return Promise.resolve({});return Promise.resolve({});
  };}});
  window.__devResponses={};window.__devOpen=0;window.__devCommand=null;window.__devClosed=null;const p=proxy(),names=['plugins','account','svc','ytm','spicy','discord','custom','editor','wall','accounts','media'];const nested=Object.fromEntries(names.map(n=>[n,proxy()]));nested.dev={open:()=>{__devOpen++;return Promise.resolve(true);},onCommand:fn=>{__devCommand=fn;},onClosed:fn=>{__devClosed=fn;},respond:message=>{const done=__devResponses[message.id];if(done){delete __devResponses[message.id];done(message.data);}},inspect:point=>{window.__inspectPoint=point;}};window.pulse=new Proxy({}, {get(_t,k){return nested[k]||p[k];}});localStorage.setItem('pulse.splash',splash?'on':'off');
 },{saved:options.saved===undefined?{settings:{app:{language:'ru'},look:{splash:false}}}:options.saved,failed:!!options.failed,splash:!!options.splash});
 await page.goto(origin);await page.waitForFunction(()=>window.PulseDebug&&typeof lib.settings==='object'&&document.querySelector('.page')&&window.__devCommand);return {page,context};
}
const shot=async(page,name)=>{await page.waitForTimeout(380);await page.screenshot({path:out+'/'+name+'.png'});};
let seq=0;
const send=(page,action)=>page.evaluate(({id,action})=>new Promise(resolve=>{__devResponses[id]=resolve;__devCommand({id,action});}),{id:++seq,action});
try{
 const a=await setup();await a.page.waitForTimeout(350);assert.equal(await a.page.locator('#pulseWelcome').count(),0);
 for(let i=0;i<5;i++)await a.page.locator('#brand').click({button:'right'});assert.equal(await a.page.evaluate(()=>__devOpen),1);assert.equal(await a.page.locator('#pulseDebug').count(),0);assert.equal(await a.page.locator('#brand').evaluate(e=>e.inert),false);
 await a.page.evaluate(()=>{lib.settings.perf.fps=144;lib.settings.perf.dpr=2;lib.playlists=[{id:'private',name:'Keep',tracks:[]}];window.__before=JSON.stringify(lib.settings);PulseWelcome.open();});
 for(let step=0;step<5;step++){
  await shot(a.page,'setup-desktop-'+step);assert.equal(await a.page.locator('.pt-steps [aria-current=step]').count(),1);
  if(step===0){await a.page.locator('[data-choice="app.language"][data-value=ja]').click();assert.equal(await a.page.evaluate(()=>S().app.language),'ru');await a.page.locator('[data-choice="app.language"][data-value=ru]').click();}
  if(step===1){await a.page.locator('[data-pt=login]').click();await a.page.waitForSelector('#modal.show');assert.equal(await a.page.locator('#modal').evaluate(x=>x.inert),false);await a.page.waitForTimeout(350);await a.page.keyboard.press('Escape');await a.page.waitForFunction(()=>!document.body.classList.contains('pulse-welcome-auth'));await a.page.locator('[data-choice="app.client"][data-value=ad]').click();assert.equal(await a.page.locator('[data-pt=login]').count(),0);}
  if(step===2)await a.page.locator('[data-graphics=eco]').click();if(step<4)await a.page.locator('[data-pt=next]').click();
 }
 await a.page.evaluate(()=>__flushOK=false);await a.page.locator('[data-pt=finish]').click();assert.equal(await a.page.evaluate(()=>JSON.stringify(lib.settings)===__before),true);await shot(a.page,'setup-save-error');await a.page.evaluate(()=>__flushOK=true);await a.page.locator('[data-pt=finish]').click();assert.equal(await a.page.evaluate(()=>S().perf.fps),30);assert.equal(await a.page.evaluate(()=>lib.playlists[0].name),'Keep');
 await a.page.evaluate(()=>dsOpenSetting('client'));await a.page.waitForSelector('#audiusSource');assert.equal(await a.page.locator('#bar #audiusSource').count(),0);assert.equal(await a.page.locator('#audiusSource').isDisabled(),true);await a.page.locator('#audiusSource').scrollIntoViewIfNeeded();await shot(a.page,'source-settings');
 await a.page.evaluate(()=>{const rate=44100,n=rate*4,b=new ArrayBuffer(44+n*2),v=new DataView(b),write=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));};write(0,'RIFF');v.setUint32(4,36+n*2,true);write(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);write(36,'data');v.setUint32(40,n*2,true);for(let i=0;i<n;i++)v.setInt16(44+i*2,(Math.sin(2*Math.PI*160*i/rate)+.4*Math.sin(2*Math.PI*2800*i/rate))*9000,true);window.__wav=URL.createObjectURL(new Blob([b],{type:'audio/wav'}));lib.queue={tracks:[{id:'aaaaaaaaaa1',title:'Local test',author:'Test artist',dur:4}],idx:0};});
 await a.page.evaluate(()=>dsOpenSetting('client'));await a.page.locator('#audiusSource').scrollIntoViewIfNeeded();assert.equal(await a.page.locator('#audiusSource').isDisabled(),false);await a.page.locator('#audiusSource').click();await a.page.waitForSelector('#modal.show');await shot(a.page,'source-recording-picker');await a.page.keyboard.press('Escape');await a.page.waitForTimeout(300);await a.page.evaluate(()=>{PulsePrism.open();PulsePrism.setCoverPalette([[244,50,122],[48,228,164],[80,100,240]]);});
 await shot(a.page,'prism-mini-silent');assert.equal(await a.page.locator('.sp-mini-spectrum i').count(),24);assert.equal(await a.page.locator('.sp-live-status').evaluate(e=>e.getBoundingClientRect().width),1);
 await a.page.evaluate(async()=>{initAudioGraph();await actx.resume();audio.src=__wav;audio.loop=true;await audio.play();playing=true;});await a.page.waitForTimeout(800);await shot(a.page,'prism-mini-playing');const bars=await a.page.locator('.sp-mini-spectrum i').evaluateAll(els=>els.map(e=>e.style.transform));assert.ok(bars.some(x=>parseFloat(x.slice(7))>.08),'real audio raises spectrum bars');await a.page.keyboard.press('Escape');await a.page.waitForTimeout(600);await a.page.evaluate(()=>{audio.pause();playing=false;});
 const snap=await send(a.page,'snapshot');assert.ok(snap.dom.elements>0);assert.equal(snap.storage.playlists,1);assert.ok(!/Keep|aaaaaaaaaa1|title|cookie|token|path/i.test(JSON.stringify(snap)));
 const checks=await send(a.page,'checks');assert.ok(checks.checks.every(x=>['pass','not-checked'].includes(x.state)));
 await send(a.page,'outlines');await send(a.page,'guides');assert.equal(await a.page.locator('#pulseDevGuides').count(),1);await send(a.page,'inspect');await a.page.locator('#brand').hover();assert.equal(await a.page.locator('#pulseDevInspect').count(),1);await a.page.keyboard.press('Escape');assert.equal(await a.page.locator('#pulseDevInspect').count(),0);
 const frames=await send(a.page,'frames');assert.ok(frames.samples>5);assert.ok(frames.p95Ms>0);const pending=send(a.page,'frames');await a.page.waitForTimeout(80);await send(a.page,'cancelFrames');assert.equal((await pending).error,'cancelled');await a.page.evaluate(()=>__devClosed());assert.equal(await a.page.locator('#pulseDevGuides').count(),0);assert.equal(await a.page.evaluate(()=>document.documentElement.hasAttribute('data-dev-outlines')),false);
 const dev=await a.context.newPage();dev.on('pageerror',e=>errors.push(String(e)));await dev.setViewportSize({width:920,height:740});await dev.exposeFunction('__nativeRequest',async action=>{if(action==='runtime')return {version:'1.0.2',electron:'fixture',gpu:{note:'UI fixture only'}};if(['devtools','focus','screenshot'].includes(action))return {ok:true};return send(a.page,action);});await dev.exposeFunction('__copyReport',text=>{assert.ok(!/Keep|cookie|token/.test(text));return true;});await dev.addInitScript(()=>window.pulseDev={request:action=>__nativeRequest(action),copy:text=>__copyReport(text),close:()=>{}});await dev.goto(origin+'/dev.html');await dev.waitForFunction(()=>document.documentElement.lang==='ru');
 for(const tab of ['overview','inspect','performance','actions']){await dev.locator(`[data-tab="${tab}"]`).click();await shot(dev,'developer-'+tab);}
 await dev.locator('[data-action=checks]').click();await dev.waitForSelector('.check');await shot(dev,'developer-checks');await dev.locator('#copy-report').click();
 for(const width of [390,620]){await dev.setViewportSize({width,height:844});for(const tab of ['overview','inspect','performance','actions']){await dev.locator(`[data-tab="${tab}"]`).click();assert.equal(await dev.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await shot(dev,'dev-'+width+'-'+tab);}}
 for(const language of ['ja','uk','en','ru']){await a.page.evaluate(l=>PulseI18n.setLanguage(l,false),language);await dev.locator('[data-tab=overview]').click();await dev.locator('[data-action=refresh]').click();await dev.waitForFunction(l=>document.documentElement.lang===l,language);await shot(dev,'dev-language-'+language);}
 await dev.close();await a.context.close();
 for(const mode of [{},{reducedMotion:'reduce'},{forcedColors:'active'}]){
  const m=await setup({context:{viewport:{width:390,height:844},...mode}});await m.page.evaluate(()=>PulseWelcome.open());for(let i=0;i<5;i++){assert.equal(await m.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await shot(m.page,'setup-narrow-'+(mode.reducedMotion?'reduced':mode.forcedColors?'forced':'normal')+'-'+i);if(i<4)await m.page.locator('[data-pt=next]').click();}await m.page.locator('[data-pt=later]').click();await m.page.evaluate(()=>PulsePrism.open());await shot(m.page,'prism-narrow-'+(mode.reducedMotion?'reduced':mode.forcedColors?'forced':'normal'));await m.context.close();
 }
 const f=await setup({saved:null});await f.page.waitForSelector('#pulseWelcome');await f.page.locator('[data-pt=later]').click();const stored=await f.page.evaluate(()=>__writes.at(-1));assert.equal(stored.onboarding.status,'skipped');await f.context.close();const old=await setup({saved:stored});await old.page.waitForTimeout(300);assert.equal(await old.page.locator('#pulseWelcome').count(),0);await old.context.close();
 assert.deepEqual(errors,[]);console.log('PASS developer experience UI: draft/rollback/preservation, optional auth, settings source, real audio mini spectrum, opt-in tools + cancellation/cleanup, localized companion UI, 390/620/1366, reduced motion/forced colors. Not native Windows E2E.');
}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
