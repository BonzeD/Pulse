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
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&/Pulse Immersion|Shader|ERROR: 0:/.test(m.text()))errors.push(m.text());});
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


 const assert=require('node:assert/strict');page.setDefaultTimeout(90000);
 const qa=async(name,fn)=>{await fn();console.log('PASS',name);};
 try {

 const fixture=()=>page.evaluate(()=>{lib.queue={tracks:[{id:'local:neon-rain',title:'Neon Rain',author:'Pulse — Immersion QA',album:{name:'Night drive'},art:'logo.png',dur:240}],idx:0};playing=true;window.__savedSpectrum=readSpectrum;window.__position=42;E.time=()=>window.__position;E.dur=()=>240;E.seek=n=>window.__position=n;lyState.id='local:neon-rain';lyState.kind='word';lyState.lines=[{t:40,end:55,text:'We become the light',words:[{t:40,s:'We'},{t:41,s:'become'},{t:42,s:'the'},{t:43,s:'light'}]}];readSpectrum=()=>{const f=new Uint8Array(1024),w=new Uint8Array(2048),a=.2+.16*Math.sin(performance.now()/280);for(let i=0;i<f.length;i++)f[i]=Math.round((i<15?.7:.22)*255);for(let i=0;i<w.length;i++)w[i]=128+Math.round(Math.sin(i*.07)*127*a);return{f,w,sampleRate:48000,fftSize:2048};};});
 await qa('empty state opens without starting music and exits reliably',async()=>{await page.locator('#btnImmersionNav').click();await page.waitForTimeout(2200);assert.equal(await page.evaluate(()=>playing),false);assert.match(await page.locator('[data-im="signal"]').innerText(),/Нет трека/);assert.equal(await page.locator('[data-im="error"]').isVisible(),false);await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>PulseImmersion.active()),false);});
 await qa('all three cinematic worlds render without WebGL errors',async()=>{await fixture();await page.locator('#btnImmersionNav').click();await page.waitForTimeout(2300);assert.equal(await page.locator('[data-im="error"]').isVisible(),false);for(const [i,name]of ['city','ocean','orbit'].entries()){await page.selectOption('[data-im="select"]',String(i));await page.waitForTimeout(1500);assert.equal(await page.evaluate(()=>PulseImmersion.stats().world),i);await page.screenshot({path:out+'/immersion-'+name+'.png'});}assert.equal(await page.evaluate(()=>PulseImmersion.stats().signal),true);assert.ok(await page.evaluate(()=>PulseImmersion.stats().draws)>5);});
 await qa('manual quality settings are honored and do not mutate the player',async()=>{const before=await page.evaluate(()=>JSON.stringify(S()));for(const [quality,expected,max]of [['high','high',2880],['balanced','balanced',1920],['eco','eco',1280],['auto','software',1000]]){await page.selectOption('[data-im="quality"]',quality);await page.waitForTimeout(900);const r=await page.evaluate(()=>PulseImmersion.stats().renderer);assert.equal(r.quality,expected);assert.ok(r.width<=max);if(quality==='high')assert.ok(r.width>=1366);}assert.equal(await page.evaluate(()=>JSON.stringify(S())),before);});
 await qa('Immersion never renders song text even when synchronized lyrics exist',async()=>{assert.equal(await page.locator('.im-lyrics,[data-im="line"]').count(),0);});
 await qa('no audio is honest atmosphere, pause freezes camera and seek is bounded',async()=>{await page.evaluate(()=>readSpectrum=()=>null);await page.waitForTimeout(500);assert.match(await page.locator('[data-im="signal"]').innerText(),/Нет аудиосигнала/);await page.evaluate(()=>playing=false);await page.waitForTimeout(500);const t=await page.evaluate(()=>PulseImmersion.stats().travel);await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>PulseImmersion.stats().travel),t);const seekBox=await page.locator('#seek').boundingBox();await page.locator('#seek').click({position:{x:seekBox.width*.5,y:8}});assert.ok(Math.abs(await page.evaluate(()=>E.time())-120)<1);await page.screenshot({path:out+'/immersion-paused.png'});});
 await qa('help distinguishes intended effects from faults and does not exit on first Escape',async()=>{await page.locator('[data-im-action="help"]').click();assert.match(await page.locator('[data-im="help"]').innerText(),/Что уже не норма/);await page.screenshot({path:out+'/immersion-help.png'});await page.keyboard.press('Escape');assert.equal(await page.locator('[data-im="help"]').isVisible(),false);assert.equal(await page.evaluate(()=>PulseImmersion.active()),true);});
 await qa('minimum and narrow viewports keep exit and transport usable',async()=>{for(const [width,height]of [[980,640],[390,844]]){await page.setViewportSize({width,height});await page.waitForTimeout(700);for(const selector of ['.im-exit','#btnPlay','[data-im="select"]']){const r=await page.locator(selector).boundingBox();assert.ok(r&&r.x>=0&&r.y>=0&&r.x+r.width<=width+1&&r.y+r.height<=height+1,selector+JSON.stringify(r));}await page.screenshot({path:out+'/immersion-'+width+'.png'});}await page.setViewportSize({width:1366,height:768});});
 await qa('reduced motion produces a stationary scene and suppresses intro',async()=>{await page.keyboard.press('Escape');await page.emulateMedia({reducedMotion:'reduce'});await fixture();await page.locator('#btnImmersionNav').click();await page.waitForTimeout(600);assert.equal(await page.locator('.im-portal').count(),0);const t=await page.evaluate(()=>PulseImmersion.stats().travel);await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>PulseImmersion.stats().travel),t);await page.keyboard.press('Escape');await page.emulateMedia({reducedMotion:'no-preference'});});
 await qa('repeat openings restore focus, inert and ordinary player settings',async()=>{const before=await page.evaluate(()=>JSON.stringify({s:S(),mode:lib.mode,queue:lib.queue}));for(let i=0;i<3;i++){await page.locator('#btnImmersionNav').click();await page.waitForTimeout(150);await page.locator('.im-exit').click();assert.equal(await page.evaluate(()=>PulseImmersion.stats().raf),false);assert.equal(await page.locator('#btnImmersionNav').evaluate(e=>e===document.activeElement),true);assert.equal(await page.locator('#side').evaluate(e=>e.inert),false);}assert.equal(await page.evaluate(()=>JSON.stringify({s:S(),mode:lib.mode,queue:lib.queue})),before);});
 await qa('GPU disabled gives an explanation instead of a black screen',async()=>{await page.evaluate(()=>S().perf.gpu=false);await page.locator('#btnImmersionNav').click();assert.equal(await page.locator('[data-im="error"]').isVisible(),true);await page.screenshot({path:out+'/immersion-error.png'});await page.locator('[data-im="error"] [data-im-action="exit"]').click();await page.evaluate(()=>S().perf.gpu=true);});

 await qa('English UI and guide never translate song metadata or lyrics',async()=>{await fixture();await page.evaluate(()=>{S().app.language='en';PulseI18n.setLanguage('en');lib.queue.tracks[0].title='Пауза';$('bTitle').textContent='Пауза';});await page.locator('#btnImmersionNav').click();await page.waitForTimeout(900);assert.equal(await page.locator('#bTitle').innerText(),'Пауза');assert.match(await page.locator('.im-exit').innerText(),/Back to player/);await page.locator('[data-im-action="help"]').click();assert.match(await page.locator('[data-im="help"]').innerText(),/What is not normal/);await page.screenshot({path:out+'/immersion-english-guide.png'});await page.keyboard.press('Escape');await page.selectOption('[data-im="select"]','1');await page.waitForTimeout(1000);await page.screenshot({path:out+'/immersion-english.png'});await page.keyboard.press('Escape');});
 await qa('entry from text mode preserves it; Clean UI Escape returns immediately',async()=>{await page.evaluate(()=>{S().ui.variant='clean';applyCustom();lyStageOpen(true);});await page.keyboard.press('i');await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>PulseImmersion.active()),true);await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>PulseImmersion.active()),false);assert.equal(await page.evaluate(()=>lys.on),true);await page.evaluate(()=>lyStageOpen(false));});

 await qa('rapid world changes cannot leave a stale delayed scene',async()=>{await page.evaluate(()=>PulseImmersion.open());await page.selectOption('[data-im="select"]','0');await page.selectOption('[data-im="select"]','2');await page.selectOption('[data-im="select"]','1');await page.waitForTimeout(1100);await page.waitForFunction(()=>!document.querySelector('#immersion .im-cut'));assert.equal(await page.evaluate(()=>PulseImmersion.stats().world),1);assert.equal(await page.locator('.im-cut').count(),0);await page.keyboard.press('Escape');});
 assert.deepEqual(errors,[]);
 } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exit(1);});
