/* Full application UI with an explicit local-only native bridge fixture. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'../renderer'),out=process.env.PULSE_SETUP_ARTIFACTS||path.join(__dirname,'artifacts/background');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const u=req.url.split('?')[0],p=path.resolve(root,'.'+(u==='/'?'/index.html':u));if(!p.startsWith(root+path.sep)||!fs.existsSync(p)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});const errors=[];const recorder=require('../audio-diagnostics').create();
async function setup(options={}){
 const context=await browser.newContext({viewport:{width:1366,height:900},locale:'ru-RU',...options.context});const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));await page.route('**/*',r=>{if(r.request().url().startsWith(origin))return r.continue();if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
 await page.exposeFunction('__audioEvent',message=>recorder.event(message.stage,message.data));await page.exposeFunction('__audioState',()=>recorder.state());
 await page.addInitScript(({saved,failed,splash})=>{
  window.__saved=saved;window.__failed=failed;window.__writes=[];window.__flushOK=true;window.__auth=null;window.__copied='';window.__wins=[];
  const proxy=()=>new Proxy({}, {get(_t,k){return (...args)=>{
   if(String(k).startsWith('on'))return;
   if(k==='getLibrary')return __failed?Promise.reject(Error('read failure')):Promise.resolve(__saved);
   if(k==='flushLibrary'){if(__flushOK)__writes.push(JSON.parse(JSON.stringify(args[0])));return __flushOK;}
   if(k==='saveLibrary'){__writes.push(JSON.parse(JSON.stringify(args[0])));return;}
   if(k==='copyText'){__copied=args[0];return Promise.resolve({ok:true});}
   if(k==='win'){__wins.push(args[0]);return;}
   if(k==='playlists'){window.__playlistCalls=(window.__playlistCalls||0)+1;return Promise.resolve(window.__playlists||[]);}
   if(k==='list'||k==='downloads'||k==='displays'||k==='browsers')return Promise.resolve([]);
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
  window.__devResponses={};window.__devOpen=0;window.__devCommand=null;window.__devClosed=null;const p=proxy(),names=['plugins','account','svc','ytm','spicy','discord','custom','editor','wall','accounts','media'];const nested=Object.fromEntries(names.map(n=>[n,proxy()]));nested.accounts={list:async()=>({active:'saved',list:[{id:'saved',name:'Saved Fixture',active:true,used:1}]}),snapshot:async()=>{window.__snapshots=(window.__snapshots||0)+1;return {active:'saved',list:[]};}};nested.dev={audioEvent:m=>__audioEvent(m),audioState:()=>__audioState(),onAudioState:fn=>{window.__audioStateCallback=fn;},open:()=>{__devOpen++;return Promise.resolve(true);},onCommand:fn=>{__devCommand=fn;},onClosed:fn=>{__devClosed=fn;},respond:message=>{const done=__devResponses[message.id];if(done){delete __devResponses[message.id];done(message.data);}},inspect:point=>{window.__inspectPoint=point;}};window.pulse=new Proxy({}, {get(_t,k){return nested[k]||p[k];}});localStorage.setItem('pulse.splash',splash?'on':'off');
 },{saved:options.saved===undefined?{settings:{app:{language:'ru'},look:{splash:false}}}:options.saved,failed:!!options.failed,splash:!!options.splash});
 await page.goto(origin);await page.waitForFunction(()=>window.PulseDebug&&typeof lib.settings==='object'&&document.querySelector('.page')&&window.__devCommand);return {page,context};
}
try{
 const a=await setup(),page=a.page;await page.waitForFunction(()=>typeof refreshAccount==='function');
 await page.evaluate(async()=>{window.__auth={name:'Saved Fixture',verified:false,state:'unverified'};window.__playlistCalls=0;window.__snapshots=0;await refreshAccount();});
 assert.equal(await page.evaluate(()=>account),null);assert.equal(await page.evaluate(()=>__playlistCalls),0);assert.equal(await page.evaluate(()=>__snapshots),0);assert.equal(await page.locator('#accBtn').getAttribute('data-auth'),'unverified');
 await page.locator('#accBtn').click();await page.locator('[data-ap=check]').waitFor();assert.equal(await page.locator('.ap-me .acc-dot').count(),0);
 await page.evaluate(()=>window.__auth={name:'Verified Fixture',verified:true,state:'verified'});await page.locator('[data-ap=check]').click();await page.waitForFunction(()=>account?.name==='Verified Fixture');assert.equal(await page.locator('#accBtn').getAttribute('data-auth'),'verified');
 await page.evaluate(async()=>{window.__playlists={authRequired:true};await refreshAccount();});assert.equal(await page.evaluate(()=>account),null);assert.equal(await page.locator('#accBtn').getAttribute('data-auth'),'reauth');
 for(const language of ['ru','en','ja','uk']){await page.evaluate(l=>PulseI18n.setLanguage(l,false),language);await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);const label=await page.locator('#accBtn').getAttribute('aria-label');assert.ok(label.trim().length);if(['en','ja'].includes(language))assert.ok(!/[А-Яа-яЁё]/.test(label));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);const box=await page.locator('#accBtn').boundingBox(),close=await page.locator('#btnClose').boundingBox();assert.ok(box.x+box.width<=close.x);assert.ok(close.x+close.width<=391);await page.screenshot({path:out+'/auth-'+language+'-390.png'});}
 await a.context.close();assert.deepEqual(errors,[]);console.log('PASS full application: saved identity is unverified, no avatar/active dot or sync; explicit retry confirms sign-in; playlist auth denial becomes reauth. All 4 locales at 390px. Synthetic native bridge, no live Google account.');
}finally{recorder.stop();await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
