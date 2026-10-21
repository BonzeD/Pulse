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
 await page.evaluate(()=>{lib.queue={tracks:[{id:'abcdefghijk',title:'Hotfix QA',author:'Pulse QA',dur:240,art:'/logo.png'}],idx:0};updateNow();openPP();setMode('visual');});await page.waitForTimeout(600);
 await qa('all built-in presets use the stage viewport after repeated resize',async()=>{
  for(const width of [980,1444,1918]){
   await page.setViewportSize({width,height:900});await page.waitForTimeout(450);
   const result=await page.evaluate(()=>{
    Viz.setGpu(false);Viz.resize();const st=$('stage').getBoundingClientRect(),results=[];
    for(const s of Viz.STYLES.filter(s=>!s.plugin)){
     const draw=s.draw,gl=s.gl;delete s.gl;
     s.draw=function(g){results.push({id:s.id,W:g.W,H:g.H,tx:g.ctx.getTransform().e,ty:g.ctx.getTransform().f});return draw.call(this,g);};
     try{setViz(s.id);Viz.draw({mode:'visual',style:s.id,quality:'high',playing:true,wave:new Uint8Array(512).fill(128),freq:new Uint8Array(512).fill(130),fx:{zoom:0},tempo:{bpm:120,pos:8,conf:1}});}finally{s.draw=draw;if(gl)s.gl=gl;}
    }Viz.setGpu(true);return{results,W:st.width,H:st.height};
   });assert.ok(result.results.length>=18);
   for(const s of result.results){assert.ok(Math.abs(s.W-result.W)<1,s.id+' width');assert.ok(Math.abs(s.H-result.H)<1,s.id+' height');}
  }
 });
 await qa('direct GPU is centered and is removed on switching to Wave',async()=>{
  for(const id of ['radial','coverfield']){
   const r=await page.evaluate(id=>{
    setViz(id);Viz.resize();Viz.draw({mode:'visual',style:id,direct:true,quality:'high',playing:true,artRect:artRect(),center:stageCenter(),freq:new Uint8Array(512).fill(128),fx:{zoom:0},tempo:{bpm:120,pos:8,conf:1}});
    const c=$('vizDirect'),st=$('stage').getBoundingClientRect(),r=c&&c.getBoundingClientRect();return {stats:Viz.stats(),hidden:c&&c.hidden,x:r&&r.x,y:r&&r.y,w:r&&r.width,h:r&&r.height,sx:st.x,sy:st.y,sw:st.width,sh:st.height};
   },id);assert.equal(r.stats.path,'WebGL direct');assert.equal(r.hidden,false);for(const k of ['x','y','w','h'])assert.ok(Math.abs(r[k]-r['s'+k])<1,id+' '+k);
   await page.evaluate(()=>{setViz('wave');Viz.draw({mode:'visual',style:'wave',playing:true,quality:'high',wave:new Uint8Array(512).fill(128),fx:{zoom:0}});});
   assert.equal(await page.locator('#vizDirect').evaluate(e=>getComputedStyle(e).display),'none');
  }
 });
 await page.evaluate(()=>setViz('dots'));await page.waitForTimeout(450);await page.screenshot({path:out+'/hotfix-centered-dots.png'});
 await qa('settings remain interactive after all visual modes',async()=>{
  await page.click('#btnPP');await page.waitForTimeout(450);
  for(let i=0;i<3;i++){await page.click('a[data-go=settings]');await page.waitForSelector('#setQ');await page.click('[data-stab=client]');await page.waitForTimeout(250);await page.click('a[data-go=home]');await page.waitForTimeout(250);}
  await page.click('#btnNewPl');await page.waitForTimeout(200);assert.ok(await page.locator('#modal.show').isVisible());await page.click('[data-act=closeModal]');await page.waitForTimeout(250);
 });
 await qa('water is animated by the live frame loop, not only forced tests',async()=>{
  await page.evaluate(()=>{S().ly.kRipple=75;S().ly.kReflQ='normal';S().ly.kRefl=true;lyStageOpen(true);});await page.waitForTimeout(600);
  const a=await page.locator('.lys-cover-mirror').evaluate(c=>({pixels:c.toDataURL(),phase:c.dataset.phase}));await page.waitForTimeout(450);
  const b=await page.locator('.lys-cover-mirror').evaluate(c=>({pixels:c.toDataURL(),phase:c.dataset.phase}));assert.notEqual(a.phase,b.phase);assert.notEqual(a.pixels,b.pixels);
  await page.screenshot({path:out+'/hotfix-live-water.png'});
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(250);assert.equal(await page.locator('.lys-cover-mirror').getAttribute('data-phase'),'static');
 });
 assert.deepEqual(errors,[]);console.log('HOTFIX QA COMPLETE');await browser.close();server.close();process.exit(0);
})().catch(e=>{console.error(e);server.close();process.exit(1);});
