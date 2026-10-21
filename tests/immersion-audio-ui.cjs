// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8787,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || chromium.executablePath(),headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&/Pulse Immersion|Shader|ERROR: 0:/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8787'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
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
 await page.goto('http://127.0.0.1:8787');await page.waitForTimeout(1600);


 const assert=require('node:assert/strict');page.setDefaultTimeout(90000);
 const qa=async(name,fn)=>{await fn();console.log('PASS',name);};
 try {

 await page.setViewportSize({width:640,height:480});
 await page.evaluate(async()=>{lib.queue={tracks:[{id:'local:real-pcm',title:'PCM signal test',author:'Pulse QA',art:'/logo.png',dur:240}],idx:0};engine='audio';actx=new AudioContext();await actx.resume();analyser=actx.createAnalyser();analyser.fftSize=2048;analyser.smoothingTimeConstant=.05;freq=new Uint8Array(1024);wave=new Uint8Array(2048);window.__osc=actx.createOscillator();window.__gain=actx.createGain();const silent=actx.createGain();__osc.frequency.value=90;__gain.gain.value=.012;silent.gain.value=0;__osc.connect(__gain).connect(analyser).connect(silent).connect(actx.destination);__osc.start();playing=true;PulseImmersion.open();});
 await page.selectOption('[data-im="select"]','2');await page.waitForFunction(()=>PulseImmersion.stats().renderer?.audio!==null&&PulseImmersion.stats().renderer?.audio?.bass>0,{},{timeout:60000});await page.waitForTimeout(500);
 let quiet;
 await qa('actual PCM from WebAudio reaches the station director',async()=>{quiet=await page.evaluate(()=>PulseImmersion.stats());await page.screenshot({path:out+'/orbit-real-pcm-quiet.png'});assert.equal(quiet.signal,true);assert.ok(quiet.renderer.audio.bass>0);});
 await qa('real amplitude change drives the visible reactor and segmented lights',async()=>{await page.evaluate(()=>__gain.gain.setValueAtTime(.65,actx.currentTime));await page.waitForFunction(()=>PulseImmersion.stats().power>.75,{},{timeout:60000});const loud=await page.evaluate(()=>PulseImmersion.stats());assert.ok(loud.power>quiet.power+.5,JSON.stringify({quiet:quiet.power,loud:loud.power}));assert.ok(loud.renderer.audio.range>quiet.renderer.audio.range+.3);assert.ok(loud.renderer.audio.barMax>quiet.renderer.audio.barMax+.4);assert.ok(loud.renderer.audio.plasma>quiet.renderer.audio.plasma+.2);await page.screenshot({path:out+'/orbit-real-pcm-loud.png'});});
 await qa('pausing audio removes beat impulses without changing the transport',async()=>{await page.evaluate(()=>playing=false);await page.waitForTimeout(500);const s=await page.evaluate(()=>PulseImmersion.stats());assert.equal(s.kick,0);assert.equal(s.signal,false);await page.evaluate(async()=>{PulseImmersion.close();__osc.stop();await actx.close();});});
 assert.deepEqual(errors,[]);
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exit(1)});
