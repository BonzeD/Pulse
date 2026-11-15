/* Full application UI with an explicit local-only native bridge fixture. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'../renderer'),out=process.env.PULSE_SETUP_ARTIFACTS||path.join(__dirname,'artifacts/embedded-first');fs.mkdirSync(out,{recursive:true});

const fakeYT=`window.__ytCalls=[];window.YT={PlayerState:{PLAYING:1,BUFFERING:3,ENDED:0},Player:function(id,o){window.__yt=this;this.events=o.events;this.vid='';this.tm=0;this.getVideoData=()=>({video_id:this.vid});this.getCurrentTime=()=>this.tm;this.getDuration=()=>120;this.setVolume=()=>{};this.unMute=()=>{};this.stopVideo=()=>__ytCalls.push(['stop']);this.pauseVideo=()=>{__ytCalls.push(['pause']);o.events.onStateChange({data:2,target:this});};this.playVideo=()=>{__ytCalls.push(['play']);};this.seekTo=v=>{this.tm=v;__ytCalls.push(['seek',v]);};this.loadVideoById=x=>{this.vid=x.videoId;this.tm=x.startSeconds;__ytCalls.push(['load',x]);};this.cueVideoById=x=>{this.vid=x.videoId;this.tm=x.startSeconds;__ytCalls.push(['cue',x]);};this.state=n=>o.events.onStateChange({data:n,target:this});this.error=n=>o.events.onError({data:n,target:this});setTimeout(()=>o.events.onReady(),0);}};const wait=setInterval(()=>{if(window.onYouTubeIframeAPIReady){clearInterval(wait);onYouTubeIframeAPIReady();}},5);`;

const server=http.createServer((req,res)=>{const u=req.url.split('?')[0],p=path.resolve(root,'.'+(u==='/'?'/index.html':u));if(!p.startsWith(root+path.sep)||!fs.existsSync(p)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});const errors=[];
async function setup(options={}){
 const context=await browser.newContext({viewport:{width:1366,height:900},locale:'ru-RU',...options.context});const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));await page.route('**/*',r=>{if(r.request().url().includes('youtube.com/iframe_api'))return r.fulfill({contentType:'text/javascript',body:fakeYT});if(r.request().url().startsWith(origin))return r.continue();if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
 await page.addInitScript(({saved,failed,splash})=>{
  window.__resolves=[];window.__maps=[];window.__prefetches=[];window.__saved=saved;window.__failed=failed;window.__writes=[];window.__flushOK=true;window.__auth=null;window.__copied='';window.__wins=[];
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
   if(k==='prefetch'){window.__prefetches ||= [];__prefetches.push(args);return Promise.resolve(false);}
   if(k==='mapYouTube'){window.__maps ||= [];return new Promise(resolve=>__maps.push({id:args[0],resolve}));}
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
 const a=await setup(),page=a.page;await page.waitForFunction(()=>window.__yt&&ready);
 await page.evaluate(()=>{const t={id:'abcdefghijk',title:'Embedded fixture',author:'Test',dur:120};lib.queue={tracks:[t],idx:0};lib.known[t.id]=t;S().app.audioSource='current';S().dj.on=false;E.load(t,true);});
 await page.waitForFunction(()=>__ytCalls.some(x=>x[0]==='load'));assert.equal(await page.evaluate(()=>(__resolves||[]).length),0);
 await page.evaluate(()=>__yt.state(1));assert.equal(await page.evaluate(()=>engine),'yt');
 await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>(__resolves||[]).length),0);assert.equal(await page.evaluate(()=>(__prefetches||[]).some(x=>x[0]!==null)),false);
 // Visual mode changes keep this player and never start an alternate resolver.
 await page.evaluate(()=>{setMode('video');setMode('cover');});assert.equal(await page.evaluate(()=>(__resolves||[]).length),0);
 await page.locator('#btnPlay').click();assert.equal(await page.evaluate(()=>audioWanted),false);await page.locator('#btnPlay').click();assert.equal(await page.evaluate(()=>audioWanted),true);await page.evaluate(()=>__yt.state(1));
 await page.evaluate(()=>{E.seek(14);__yt.error(150);});await page.waitForFunction(()=>(__resolves||[]).length===1);assert.equal(await page.evaluate(()=>engine),'audio');assert.equal(await page.evaluate(()=>audioResumeAt),14);
 await page.locator('#btnPlay').click();assert.equal(await page.evaluate(()=>audioWanted),false);
 // No stale fallback result may overwrite a later embedded selection.
 await page.evaluate(()=>{const t={id:'qwertyuiop1',title:'Later fixture',author:'Test',dur:120};lib.queue={tracks:[t],idx:0};lib.known[t.id]=t;E.load(t,true);});await page.waitForFunction(()=>__yt.vid==='qwertyuiop1');
 await page.evaluate(()=>__resolves[0].resolve({ok:true,vid:'abcdefghijk'}));await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>engine),'yt');assert.equal(await page.evaluate(()=>audio.getAttribute('src')),null);
 // Real transport toggle while service mapping is pending preserves intent and load identity.
 await page.evaluate(()=>{const t={id:'sp:123',title:'Mapped fixture',author:'Test',dur:120};lib.queue={tracks:[t],idx:0};lib.known[t.id]=t;E.load(t,true);});await page.waitForFunction(()=>(__maps||[]).length===1);const tok=await page.evaluate(()=>loadTok);
 await page.locator('#btnPlay').click();assert.equal(await page.evaluate(()=>audioWanted),false);assert.equal(await page.evaluate(()=>loadTok),tok);
 await page.evaluate(()=>__maps[0].resolve({ok:true,vid:'abcdefghijk'}));await page.waitForFunction(()=>__ytCalls.some(x=>x[0]==='cue'));assert.equal(await page.evaluate(()=>audioWanted),false);
 await page.evaluate(()=>__yt.state(1));assert.equal(await page.evaluate(()=>playing),false);assert.equal(await page.evaluate(()=>(__resolves||[]).length),1);
 await shot(page,'paused-embedded-first');assert.deepEqual(errors,[]);await a.context.close();console.log('PASS EmbeddedFirst full renderer: mocked YouTube API; embed first, zero speculative direct calls, visual modes preserve engine, pause/play, seek fallback, stale resolver isolation, transport toggle during service mapping. NOT a live YouTube latency test.');
}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
