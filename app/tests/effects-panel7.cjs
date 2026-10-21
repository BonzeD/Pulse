// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');if(req.url==='/qa-art.jpg'){res.setHeader('Content-Type','image/jpeg');fs.createReadStream(path.join(__dirname,'fixtures/water-art.jpg')).pipe(res);return;}
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8758,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || 'chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning'&& /GPU fallback|viz gpu|PulseGPU/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8758'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
 await page.addInitScript(()=>{
   const feed={shelves:[{title:'Тестовые треки',items:Array.from({length:14},(_,i)=>({kind:'song',id:String(i).padStart(11,'a'),title:'Тест переключения '+(i+1),author:'Pulse QA',dur:240,loaded:true}))}],chips:[]};
   const proxy=prefix=>new Proxy({}, {get(_t,k){return (...args)=>{
     if(String(k).startsWith('on'))return;
     if(k==='saveLibrary'){localStorage.setItem('qa.saved',JSON.stringify(args[0]));return;}
     if(k==='getLibrary'&&localStorage.getItem('qa.saved'))return Promise.resolve(JSON.parse(localStorage.getItem('qa.saved')));
     if(k==='getLibrary')return Promise.resolve({settings:{look:{splash:false},perf:{showFps:false},ui:{panels:true}}});
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
 await page.goto('http://127.0.0.1:8758');await page.waitForTimeout(1600);


 const assert=require('node:assert/strict');
 await page.evaluate(()=>{lib.queue={tracks:[{id:'waterqa',title:'Afterlife',author:'Evanescence',dur:249,art:'/qa-art.jpg'}],idx:0};Object.assign(S().ly,{vis:'kinetic',kFont:'sans',kSize:100,kRefl:true,kRipple:70,kReflQ:'ultra',kCover:'right',kParticles:false,kBeat:0,kShake:0});lyStageOpen(true);});
 await page.evaluate(()=>{cancelAnimationFrame(lys.raf);E.time=()=>3;lyState.lines=[{t:0,text:'Damned to finally meet you',words:['Damned','to','finally','meet','you'].map((s,i)=>({t:i,s}))},{t:9,text:'Save me from the dark'}];lyState.cur=0;lyState.word=4;lysApply();lysSync(true);lysMeta();});await page.waitForTimeout(1100);
 
 for(const vis of ['classic','kinetic','stack'])for(const q of ['simple','normal','ultra','glitch']){
  await page.evaluate(({vis,q})=>{S().ly.vis=vis;S().ly.kReflQ=q;lysApply();lysSync(true);lysWaterFrame(S().ly,.2,2400);}, {vis,q});await page.waitForTimeout(650);
  assert.equal(await page.locator('.lys-cover-water').evaluate(e=>getComputedStyle(e).display),'block');
  const geom=await page.evaluate(()=>{const b=$('lysMain').querySelector('.lys-blk:not(.out)'),r=$('lysRefl'),a=b.getBoundingClientRect(),tw=b._twin.getBoundingClientRect(),w=$('lysWater').getBoundingClientRect();return{source:r.clientHeight,needed:b.offsetHeight+64,widthDelta:Math.abs(a.width-tw.width),top:tw.top,horizon:w.top,mainBottom:a.bottom};});
  console.log(vis,q,geom);assert.ok(geom.source>=geom.needed-2);assert.ok(geom.widthDelta<2);assert.ok(Math.abs(geom.top-geom.horizon)<3);
  await page.screenshot({path:out+'/panel7-'+vis+'-'+q+'.png'});
 }
 await page.evaluate(()=>{S().ly.vis='kinetic';S().ly.kReflQ='ultra';lysApply();lysSync(true);lysWaterFrame(S().ly,0,3000);});await page.waitForTimeout(600);
 const read=()=>page.locator('.lys-cover-mirror').evaluate(c=>Array.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data));
 await page.evaluate(()=>PulseCoverWater.draw(S().ly,0,3000,true));const one=await read();await page.evaluate(()=>PulseCoverWater.draw(S().ly,0,3500,true));const two=await read();let changed=0;for(let i=0;i<one.length;i+=4)if(one[i]!==two[i]||one[i+1]!==two[i+1])changed++;assert.ok(changed>3000);console.log('Animated reflected artwork pixels',changed);
 await page.evaluate(()=>{document.body.classList.add('no-anim');PulseCoverWater.draw(S().ly,0,4000,true);});const still1=await read();await page.evaluate(()=>PulseCoverWater.draw(S().ly,0,4500,true));assert.deepEqual(await read(),still1);await page.evaluate(()=>document.body.classList.remove('no-anim'));
 // Long/multiline reflections and transitions: same active words, no prematurely sung mirror.
 for(let n=0;n<8;n++){await page.evaluate(n=>{lyState.lines=[{t:0,text:'Through the quiet light forever',words:['Through','the','quiet','light','forever'].map((s,i)=>({t:i,s}))}];lyState.cur=0;lyState.word=n%5;lys.line=-9;lysSync(true);},n);await page.waitForTimeout(80);const marks=await page.evaluate(()=>{const a=$('lysMain').querySelector('.lys-blk:not(.out)');return[a,a._twin].map(e=>[...e.querySelectorAll('.lw.in')].map(x=>x.dataset.k).join());});assert.equal(marks[0],marks[1]);}
 await page.waitForTimeout(700);assert.equal(await page.locator('#lysRefl .lys-blk').count(),1);
 for(const width of [980,1918]){await page.setViewportSize({width,height:width===980?640:956});await page.evaluate(()=>{lysApply();lysSync(true);lysWaterFrame(S().ly,0,8000);});await page.waitForTimeout(700);const overflow=await page.evaluate(()=>{const m=$('lysMain').getBoundingClientRect();return [...document.querySelectorAll('#lysMain .lys-blk:not(.out) .lri')].filter(e=>{const r=e.getBoundingClientRect();return r.right>m.right+2||r.left<m.left-2;}).length;});assert.equal(overflow,0);await page.screenshot({path:out+'/panel7-size-'+width+'.png'});}
 await page.evaluate(()=>{S().ly.kRefl=false;lysApply();});assert.equal(await page.locator('.lys-cover-water').evaluate(e=>getComputedStyle(e).display),'none');
 console.log('Water/lyrics errors',errors);assert.deepEqual(errors,[]);await browser.close();server.close();process.exit(0);
})().catch(e=>{console.error(e);server.close();process.exit(1)});
