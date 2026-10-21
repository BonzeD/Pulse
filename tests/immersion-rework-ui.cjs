// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8785,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || chromium.executablePath(),headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&/Pulse Immersion|Shader|ERROR: 0:/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8785'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
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
 await page.goto('http://127.0.0.1:8785');await page.waitForTimeout(1600);


 const assert=require('node:assert/strict');page.setDefaultTimeout(90000);
 const qa=async(name,fn)=>{await fn();console.log('PASS',name);};
 try {

 const fixture=async()=>page.evaluate(()=>{lib.queue={tracks:[{id:'local:milky-sea',title:'Milky Way',author:'Pulse · QA',art:'/logo.png',dur:240}],idx:0};playing=true;window.__position=42;window.__amplitude=.18;E.time=()=>__position;E.dur=()=>240;E.seek=n=>__position=n;updateNow();updateButtons();readSpectrum=()=>{const f=new Uint8Array(1024),w=new Uint8Array(2048),a=__amplitude;f.fill(Math.round(a*255));for(let i=0;i<w.length;i++)w[i]=128+Math.round(Math.sin(i*.07)*127*a);return{f,w,sampleRate:48000,fftSize:2048};};});
 await fixture();const nativeBar=await page.locator('#bar').evaluateHandle(e=>e);
 await qa('native player is the exact same node, not a transport replica',async()=>{await page.evaluate(()=>PulseImmersion.open());await page.waitForTimeout(2200);assert.equal(await page.locator('#immersion #bar').evaluate((e,bar)=>e===bar,nativeBar),true);assert.equal(await page.locator('.im-play,[data-im="seek"]').count(),0);assert.equal(await page.locator('#bar').evaluate(e=>e.inert),false);});
 await qa('all three scenes and the galactic ocean render without shader errors',async()=>{for(const [i,name]of ['city','ocean','orbit'].entries()){await page.selectOption('[data-im="select"]',String(i));await page.waitForTimeout(1800);assert.equal(await page.locator('[data-im="error"]').isVisible(),false);await page.screenshot({path:out+'/rework-'+name+'.png'});if(i===1)assert.equal(await page.evaluate(()=>PulseImmersion.stats().renderer.milkyWay),true);}});
 await qa('station lights react visibly to actual waveform amplitude and bands',async()=>{await page.evaluate(()=>__amplitude=.015);await page.waitForFunction(()=>PulseImmersion.stats().renderer.audio?.power<.12,{},{timeout:120000});const low=await page.evaluate(()=>PulseImmersion.stats().renderer.audio);await page.evaluate(()=>__amplitude=.75);await page.waitForFunction(()=>PulseImmersion.stats().renderer.audio?.power>.75,{},{timeout:120000});const high=await page.evaluate(()=>PulseImmersion.stats().renderer.audio);assert.ok(high.power>low.power+.5,JSON.stringify({low,high}));assert.ok(high.range>low.range+.7,JSON.stringify({low,high}));await page.screenshot({path:out+'/rework-orbit-loud.png'});});
 await qa('native seek, volume and repeat handlers still work',async()=>{await page.locator('#seek').click({position:{x:400,y:8}});assert.ok(await page.evaluate(()=>__position)>42);await page.locator('#vol').fill('35');await page.locator('#vol').dispatchEvent('input');assert.equal(await page.locator('#vol').inputValue(),'35');const repeat=await page.evaluate(()=>lib.repeat);await page.locator('#btnRepeat').click();assert.notEqual(await page.evaluate(()=>lib.repeat),repeat);});
 await qa('every visible scene button and select is its own center hit target',async()=>{for(const [width,height]of [[1366,768],[980,640],[390,844]]){await page.setViewportSize({width,height});await page.waitForTimeout(1000);const misses=await page.evaluate(()=>[...document.querySelectorAll('#immersion button,#immersion select')].filter(e=>e.getClientRects().length&&!e.disabled).map(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{label:e.id||e.getAttribute('aria-label')||e.textContent,ok:r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1&&r.width>=43&&r.height>=43&&(hit===e||e.contains(hit))};}).filter(x=>!x.ok));assert.deepEqual(misses,[],width+' hit targets');await page.screenshot({path:out+'/rework-'+width+'.png'});}});
 await qa('help opens, closes and never leaves an invisible click blocker',async()=>{await page.locator('[data-im-action="help"]').click();assert.equal(await page.locator('[data-im="help"]').isVisible(),true);await page.screenshot({path:out+'/rework-help.png'});await page.keyboard.press('Escape');assert.equal(await page.locator('[data-im="help"]').isVisible(),false);await page.selectOption('[data-im="select"]','1');});
 await qa('pause and missing audio never fabricate motion or beats',async()=>{await page.evaluate(()=>playing=false);await page.waitForTimeout(600);const t=await page.evaluate(()=>PulseImmersion.stats().travel);await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>PulseImmersion.stats().travel),t);await page.evaluate(()=>{playing=true;readSpectrum=()=>null;});await page.waitForTimeout(600);assert.match(await page.locator('[data-im="signal"]').innerText(),/Нет аудиосигнала/);assert.equal(await page.evaluate(()=>PulseImmersion.stats().kick),0);});
 await qa('exit restores the native player, focus and inert state',async()=>{await page.locator('.im-exit').click();assert.equal(await page.evaluate(()=>PulseImmersion.active()),false);assert.equal(await page.locator('body>#bar').count(),1);assert.equal(await page.locator('#side').evaluate(e=>e.inert),false);});
 await qa('Clean UI preserves real controls and valid hit targets on narrow and desktop screens',async()=>{await page.evaluate(()=>{S().ui.variant='clean';applyCustom();});for(const [width,height]of [[1366,768],[390,844]]){await page.setViewportSize({width,height});await fixture();await page.evaluate(()=>PulseImmersion.open());await page.selectOption('[data-im="select"]','1');await page.waitForTimeout(1800);await page.screenshot({path:out+'/rework-clean-'+width+'.png'});const misses=await page.evaluate(()=>[...document.querySelectorAll('#bar button,#bar input')].filter(e=>e.getClientRects().length&&!e.disabled).map(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{label:e.id,ok:r.x>=0&&r.right<=innerWidth+1&&r.y>=0&&r.bottom<=innerHeight+1&&(hit===e||e.contains(hit))};}).filter(x=>!x.ok));assert.deepEqual(misses,[]);await page.locator('#btnCleanActions').click();assert.equal(await page.evaluate(()=>PulseImmersion.active()),false);assert.equal(await page.locator('#cleanOverlay').isVisible(),true);await page.locator('[data-clean="close"]').click();}});
 await qa('reduced motion suppresses reactive accents and keeps exit available',async()=>{await page.emulateMedia({reducedMotion:'reduce'});await fixture();await page.evaluate(()=>PulseImmersion.open());await page.selectOption('[data-im="select"]','2');await page.waitForTimeout(700);const t=await page.evaluate(()=>PulseImmersion.stats().travel);await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>PulseImmersion.stats().travel),t);assert.equal(await page.evaluate(()=>PulseImmersion.stats().renderer.audio.power),0);await page.locator('.im-exit').click();await page.emulateMedia({reducedMotion:'no-preference'});});
 assert.deepEqual(errors,[]);
 } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exit(1);});
