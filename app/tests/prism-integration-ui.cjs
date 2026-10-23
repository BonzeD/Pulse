/* Full app / actual WebAudio integration, isolated from network and accounts. */
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'../renderer');
const server=http.createServer((req,res)=>{const u=req.url.split('?')[0];if(u==='/test-tone.wav'){res.setHeader('Content-Type','audio/wav');return res.end(tone());}const p=path.resolve(root,'.'+(u==='/'?'/index.html':u));if(!p.startsWith(root+path.sep)||!fs.existsSync(p)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.svg':'image/svg+xml'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
function tone(){const sr=48000,n=sr*4,b=Buffer.alloc(44+n*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(sr,24);b.writeUInt32LE(sr*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);for(let i=0;i<n;i++){const t=i/sr,env=.12+.65*Math.exp(-((t*2)%1)*9);const v=env*(.65*Math.sin(2*Math.PI*80*t)+.25*Math.sin(2*Math.PI*880*t)+.1*Math.sin(2*Math.PI*5000*t));b.writeInt16LE(Math.round(v*30000),44+i*2);}return b;}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.route('**/*',r=>{if(r.request().url().startsWith(origin))return r.continue();if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
 await page.addInitScript(()=>{
   const feed={shelves:[{title:'Тестовые треки',items:Array.from({length:14},(_,i)=>({kind:'song',id:String(i).padStart(11,'a'),title:'Тест переключения '+(i+1),author:'Pulse QA',dur:240,loaded:true}))}],chips:[]};
   const proxy=prefix=>new Proxy({}, {get(_t,k){return (...args)=>{
     if(String(k).startsWith('on'))return;
     if(k==='getLibrary')return Promise.resolve({settings:{look:{splash:true},perf:{showFps:false},ui:{panels:true}}});
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
try{
 await page.goto(origin);await page.waitForFunction(()=>window.PulsePrism&&document.querySelector('.page'));await page.waitForTimeout(300);
 await page.evaluate(async origin=>{lib.queue={tracks:[{id:'local:prism-qa',title:'Prism QA',author:'Audio test',dur:4,art:'/logo.png'}],idx:0};engine='audio';initAudioGraph();gain.gain.value=0;await actx.resume();audio.src=origin+'/test-tone.wav';audio.loop=true;await audio.play();window.__before={audio,actx,analyser,loadTok,settings:JSON.stringify(lib.settings),volume:lib.volume,time:audio.currentTime};},origin);
 await page.waitForFunction(()=>{const s=readSpectrum();return s&&Math.max(...s.f)>50;});
 for(let i=0;i<4;i++){await page.locator('#brand').click();await page.waitForTimeout(65);}assert.equal(await page.locator('#prismLive').count(),0);
 await page.locator('#brand').click();await page.waitForFunction(()=>PulsePrism.stats().signal);assert.equal(await page.locator('#prismLive').getAttribute('data-signal'),'live');
 const sound=await page.evaluate(()=>({sameAudio:audio===__before.audio,sameContext:actx===__before.actx,sameAnalyser:analyser===__before.analyser,settings:JSON.stringify(lib.settings)===__before.settings,volume:lib.volume===__before.volume,playing:playing&&!audio.paused,load:loadTok===__before.loadTok,time:audio.currentTime}));assert.equal(sound.sameAudio&&sound.sameContext&&sound.sameAnalyser&&sound.settings&&sound.volume&&sound.playing&&sound.load,true);
 await page.evaluate(()=>setWinHidden(true));const n=await page.evaluate(()=>PulsePrism.stats().draws);await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>PulsePrism.stats().draws),n);assert.equal(await page.evaluate(()=>audio.paused),false);
 await page.evaluate(()=>setWinHidden(false));await page.waitForFunction(n=>PulsePrism.stats().draws>n,n);
 await page.keyboard.press('Escape');await page.waitForTimeout(650);assert.equal(await page.locator('#prismLive').count(),0);assert.equal(await page.evaluate(()=>audio===__before.audio&&!audio.paused&&playing&&actx===__before.actx),true);
 // Enter is also an activation of the existing brand; no synthetic mouse-only requirement.
 await page.locator('#brand').focus();for(let i=0;i<5;i++){await page.keyboard.press('Enter');await page.waitForTimeout(65);}await page.waitForFunction(()=>PulsePrism.active());await page.keyboard.press('Enter');await page.waitForTimeout(650);assert.equal(await page.locator('#prismLive').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS full-app Prism: actual WAV -> existing WebAudio analyser -> live glass, five brand activations, keyboard activation, unchanged audio/context/settings/volume/track, native tray suspend/resume, exit leaves playback running');
}finally{await browser.close();}
})().then(()=>server.close()).catch(e=>{console.error(e);server.close();process.exitCode=1;});
