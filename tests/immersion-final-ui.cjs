// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8788,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || chromium.executablePath(),headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&/Pulse Immersion|Shader|ERROR: 0:/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8788'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
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
 await page.goto('http://127.0.0.1:8788');await page.waitForTimeout(1600);


 const assert=require('node:assert/strict');page.setDefaultTimeout(90000);
 const qa=async(name,fn)=>{await fn();console.log('PASS',name);};
 try {

 await page.evaluate(()=>{lib.queue={tracks:[{id:'local:final',title:'Milky Way',author:'Pulse QA',art:'/logo.png',dur:240}],idx:0};playing=false;E.time=()=>42;E.dur=()=>240;updateNow();updateButtons();});
 await qa('saved hidden-player state is respected outside Immersion and usable inside',async()=>{await page.evaluate(()=>{S().ui.playerBarHidden=true;applyCustom();PulseImmersion.open();});await page.selectOption('[data-im="select"]','1');await page.waitForTimeout(2000);assert.equal(await page.locator('#bar').evaluate(e=>e.inert),false);assert.equal(await page.locator('#bar').getAttribute('aria-hidden'),'false');await page.locator('.im-exit').click();await page.waitForTimeout(300);assert.equal(await page.locator('#bar').evaluate(e=>e.inert),true);assert.equal(await page.evaluate(()=>S().ui.playerBarHidden),true);await page.evaluate(()=>{S().ui.playerBarHidden=false;applyCustom();});});
 await qa('final ocean controls have a valid calm-camera icon and no blocked hit target',async()=>{await page.evaluate(()=>PulseImmersion.open());await page.selectOption('[data-im="select"]','1');await page.waitForTimeout(1800);assert.equal(await page.locator('.im-calm use').getAttribute('href'),'#i-eye');await page.screenshot({path:out+'/rework-final-ocean.png'});await page.locator('.im-calm').click();assert.equal(await page.locator('.im-calm').getAttribute('aria-pressed'),'true');await page.locator('.im-calm').click();await page.locator('.im-exit').click();});
 await qa('Clean UI final narrow view has usable playback and scene controls',async()=>{await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{S().ui.variant='clean';applyCustom();PulseImmersion.open();});await page.selectOption('[data-im="select"]','1');await page.waitForTimeout(1800);await page.screenshot({path:out+'/rework-final-clean-390.png'});for(const selector of ['#btnPlay','#btnPrev','#btnNext','.im-calm','.im-exit']){const hit=await page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect(),h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return h===e||e.contains(h);});assert.equal(hit,true,selector);}await page.locator('.im-exit').click();});
 assert.deepEqual(errors,[]);
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exit(1)});
