/* Full application UI with an explicit local-only native bridge fixture. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'../renderer'),out=process.env.PULSE_SETUP_ARTIFACTS||path.join(__dirname,'artifacts/audio-engine');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const u=req.url.split('?')[0],p=path.resolve(root,'.'+(u==='/'?'/index.html':u));if(!p.startsWith(root+path.sep)||!fs.existsSync(p)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});const errors=[];
async function setup(options={}){
 const context=await browser.newContext({viewport:{width:1366,height:900},locale:'ru-RU',...options.context});const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));await page.route('**/*',r=>{if(r.request().url().startsWith(origin))return r.continue();if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
 await page.addInitScript(({saved,failed,splash})=>{
  window.__ytFailed=true;window.__saved=saved;window.__failed=failed;window.__writes=[];window.__flushOK=true;window.__auth=null;window.__copied='';window.__wins=[];
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
   if(k==='version')return Promise.resolve('1.0.3');
   if(k==='lyrics')return Promise.resolve({none:true});
   if(k==='feed'||k==='search')return Promise.resolve({shelves:[],chips:[]});
   if(k==='next')return Promise.resolve({tracks:[]});
   if(k==='resolve'){window.__resolves ||= [];return new Promise(resolve=>__resolves.push({id:args[0],resolve}));}
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
 const a=await setup(),page=a.page,rate=44100,seconds=8,data=Buffer.alloc(44+rate*seconds*2);data.write('RIFF');data.writeUInt32LE(data.length-8,4);data.write('WAVEfmt ',8);data.writeUInt32LE(16,16);data.writeUInt16LE(1,20);data.writeUInt16LE(1,22);data.writeUInt32LE(rate,24);data.writeUInt32LE(rate*2,28);data.writeUInt16LE(2,32);data.writeUInt16LE(16,34);data.write('data',36);data.writeUInt32LE(data.length-44,40);for(let i=0;i<rate*seconds;i++)data.writeInt16LE(Math.sin(2*Math.PI*220*i/rate)*10000,44+i*2);
 await page.route(/\/(stream|offline)\//,r=>{const m=/bytes=(\d+)-(\d*)/.exec(r.request().headers().range||'');if(m){const start=+m[1],end=m[2]?Math.min(+m[2],data.length-1):data.length-1;return r.fulfill({status:206,contentType:'audio/wav',headers:{'Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${data.length}`},body:data.subarray(start,end+1)});}return r.fulfill({status:200,contentType:'audio/wav',headers:{'Accept-Ranges':'bytes'},body:data});});
 await page.evaluate(()=>{const t={id:'abcdefghijk',title:'Audio regression',author:'Test artist',dur:8};lib.queue={tracks:[t],idx:0};lib.known[t.id]=t;S().app.audioSource='current';S().dj.on=false;window.__plays=0;audio.addEventListener('play',()=>__plays++);window.__seekListeners=new Set();const add=audio.addEventListener.bind(audio),remove=audio.removeEventListener.bind(audio);audio.addEventListener=(ev,fn,opts)=>{if(ev==='loadedmetadata')__seekListeners.add(fn);return add(ev,fn,opts);};audio.removeEventListener=(ev,fn,opts)=>{if(ev==='loadedmetadata')__seekListeners.delete(fn);return remove(ev,fn,opts);};});
 const wait=n=>page.waitForFunction(n=>(window.__resolves||[]).length===n,n);
 const resolve=i=>page.evaluate(i=>__resolves[i].resolve({ok:true,vid:__resolves[i].id}),i);
 // Slow resolution + actual pause click: no delayed autoplay and no duplicate request.
 await page.evaluate(()=>E.load(curTrack(),true));await wait(1);await page.locator('#btnPlay').click();await resolve(0);await page.waitForFunction(()=>audio.readyState>=1);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>audio.paused),true);assert.equal(await page.evaluate(()=>__plays),0);assert.equal(await page.evaluate(()=>__resolves.length),1);assert.equal(await page.locator('#btnPlay').getAttribute('aria-busy'),'false');
 await page.locator('#btnPlay').click();await page.waitForFunction(()=>!audio.paused&&audio.currentTime>.1);assert.equal(await page.evaluate(()=>actx.state),'running');const signal=await page.evaluate(()=>{const values=new Uint8Array(analyser.frequencyBinCount);analyser.getByteFrequencyData(values);return Math.max(...values);});assert.ok(signal>0);await shot(page,'playing-real-audio');
 // Offline autoplay=false must stop existing sound, preserving a sub-second resume.
 await page.evaluate(()=>{off[curTrack().id]={file:'fixture.wav'};E.load(curTrack(),false,.4);});await page.waitForFunction(()=>audio.readyState>=1&&Math.abs(audio.currentTime-.4)<.1);assert.equal(await page.evaluate(()=>audio.paused),true);
 // Seeking during a pending resolver is applied to the new media, not the removed one.
 await page.evaluate(()=>{delete off[curTrack().id];E.load(curTrack(),false);E.seek(3);});await wait(2);await resolve(1);await page.waitForFunction(()=>audio.readyState>=1&&Math.abs(audio.currentTime-3)<.1);assert.equal(await page.evaluate(()=>audio.paused),true);
 // Rapid A -> B, B resolves first. A is never allowed to replace B's media element.
 await page.evaluate(()=>E.load(curTrack(),true));await wait(3);await page.evaluate(()=>{const t={...curTrack(),id:'qwertyuiopa1'};lib.queue.tracks=[t];lib.queue.idx=0;E.load(t,true);});await wait(4);await resolve(3);await page.waitForFunction(()=>!audio.paused&&audio.getAttribute('src').includes('qwertyuiopa1'));await resolve(2);await page.waitForTimeout(150);assert.ok((await page.evaluate(()=>audio.getAttribute('src'))).includes('qwertyuiopa1'));
 // Repeated loads clean metadata listeners instead of leaking per-track callbacks.
 await page.evaluate(()=>{off[curTrack().id]={file:'fixture.wav'};for(let i=0;i<25;i++)E.load(curTrack(),false,.4);});await page.waitForFunction(()=>audio.readyState>=1&&Math.abs(audio.currentTime-.4)<.1);assert.equal(await page.evaluate(()=>__seekListeners.size),0);assert.equal(await page.evaluate(()=>audio.paused),true);
 await page.evaluate(()=>{E.seek(NaN);E.seek(-5);});assert.equal(await page.evaluate(()=>audio.currentTime),0);await shot(page,'paused-after-switch');
 assert.deepEqual(errors,[]);await a.context.close();console.log('PASS audio engine full renderer: actual WAV -> existing media element -> single AudioContext/analyser, pause during resolver, real transport toggle, no duplicate resolve, offline pause/.4s resume, pending seek, latest-track wins and metadata-listener cleanup. Local fixture only, not real YouTube/Windows latency.');
}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
