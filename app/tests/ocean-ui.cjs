// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8784,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || chromium.executablePath(),headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&/Pulse Immersion|Shader|ERROR: 0:/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8784'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
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
 await page.goto('http://127.0.0.1:8784');await page.waitForTimeout(1600);


 const assert=require('node:assert/strict');page.setDefaultTimeout(90000);
 const qa=async(n,fn)=>{await fn();console.log('PASS',n)};
 const track=async(id,color)=>page.evaluate(({id,color})=>{const c=document.createElement('canvas');c.width=c.height=96;const x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,96,96);const art=c.toDataURL();lib.queue={tracks:[{id,title:'Black Ocean',author:'Pulse · демонстрация материала',art,dur:240}],idx:0};playing=false;E.time=()=>42;E.dur=()=>240;lyState.id='none';readSpectrum=()=>null;},{id,color});
 try{
 await qa('actual cover pixels drive the frame independently of a fixed green UI accent',async()=>{await track('local:red-cover','#ed1858');await page.evaluate(()=>{S().look.accent='green';basePal=[[0,255,0],[0,255,0],[0,255,0]];PulseImmersion.open();});await page.selectOption('[data-im="select"]','1');await page.selectOption('[data-im="quality"]','high');await page.waitForFunction(()=>{const s=PulseImmersion.stats(),h=s.renderer?.portalColor;return s.coverColor[0]>.8&&s.coverColor[1]<.25&&h&&parseInt(h.slice(0,2),16)>parseInt(h.slice(2,4),16)*2;});await page.waitForTimeout(1600);await page.screenshot({path:out+'/ocean-cover-pink.png'});assert.equal(await page.evaluate(()=>playing),false);});
 await qa('new cover recolors the frame while music remains paused',async()=>{await track('local:blue-cover','#148ce9');await page.waitForFunction(()=>{const s=PulseImmersion.stats(),h=s.renderer?.portalColor;return s.coverColor[2]>.8&&s.coverColor[0]<.2&&h&&parseInt(h.slice(4,6),16)>parseInt(h.slice(0,2),16)*2;});await page.waitForTimeout(1600);await page.screenshot({path:out+'/ocean-cover-blue.png'});const t=await page.evaluate(()=>PulseImmersion.stats().travel);await page.waitForTimeout(700);assert.equal(await page.evaluate(()=>PulseImmersion.stats().travel),t);assert.equal(await page.evaluate(()=>playing),false);});
 await qa('out-of-order palette promises cannot restore the previous cover color',async()=>{await page.evaluate(()=>{window.__oldPalette=Viz.palette;window.__coverJobs=[];Viz.palette=()=>new Promise(resolve=>__coverJobs.push(resolve));});await track('local:slow-cover','#ff3300');await page.waitForFunction(()=>__coverJobs.length===1);await track('local:fast-cover','#9900ff');await page.waitForFunction(()=>__coverJobs.length===2);await page.evaluate(()=>{__coverJobs[1]([[150,0,255]]);__coverJobs[0]([[0,255,0]]);});await page.waitForTimeout(600);const color=await page.evaluate(()=>PulseImmersion.stats().coverColor);assert.deepEqual(color,[150/255,0,1]);await page.evaluate(()=>Viz.palette=__oldPalette);});
 await qa('ocean controls and exit stay usable in a narrow window',async()=>{await page.setViewportSize({width:390,height:844});await page.waitForTimeout(900);for(const selector of ['.im-exit','#btnPlay','[data-im="select"]','[data-im="quality"]']){const r=await page.locator(selector).boundingBox();assert.ok(r&&r.x>=0&&r.y>=0&&r.x+r.width<=391&&r.y+r.height<=845,selector);}await page.screenshot({path:out+'/ocean-390.png'});await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>PulseImmersion.active()),false);});
 assert.deepEqual(errors,[]);
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exit(1)});
