/* Full application UI with an explicit local-only native bridge fixture. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'../renderer'),out=process.env.PULSE_SETUP_ARTIFACTS||path.join(__dirname,'artifacts/lyrics-provider-103');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const u=req.url.split('?')[0],p=path.resolve(root,'.'+(u==='/'?'/index.html':u));if(!p.startsWith(root+path.sep)||!fs.existsSync(p)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});const errors=[];
async function setup(options={}){
 const context=await browser.newContext({viewport:{width:1366,height:900},locale:'ru-RU',...options.context});const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));await page.route('**/*',r=>{if(r.request().url().startsWith(origin))return r.continue();if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
 await page.addInitScript(({saved,failed,splash})=>{
  window.__saved=saved;window.__failed=failed;window.__writes=[];window.__flushOK=true;window.__auth=null;window.__copied='';window.__wins=[];
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
   if(k==='lyrics'){window.__lyricsQueue=window.__lyricsQueue||[];return new Promise(resolve=>__lyricsQueue.push({q:args[0],resolve}));}
   if(k==='feed'||k==='search')return Promise.resolve({shelves:[],chips:[]});
   if(k==='next')return Promise.resolve({tracks:[]});
   if(k==='resolve')return new Promise(()=>{});
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
 const a=await setup(),page=a.page;
 await page.evaluate(async()=>{const t={id:'sp:1QV6tiMFM6fSOKOGLMHYYg',title:'Provider switch regression',author:'Test artist',dur:120};lib.queue={tracks:[t],idx:0};lib.known[t.id]=t;S().ly.src='spicy';S().spicy.key='';S().spicy.src=true;lib.offsets[t.id]=1.25;lib.stretch[t.id]=1.01;lib.lyrics[t.id]={provider:'spicy',srcMode:'spicy',spTried:true,v:LY_V,kind:'line',source:'Spicy Lyrics',synced:'[00:01.00]Original Spicy lyric'};openPP();setTab('lyrics');await loadLyricsFor(t);});
 await page.waitForFunction(()=>document.querySelector('#lyScroll').textContent.includes('Original Spicy lyric'));
 const choose=async name=>{await page.evaluate(()=>lySrcMenu(360,350));await page.locator('#menu.show .mi').filter({hasText:new RegExp('^'+name+'(?:$| ·)')}).click();};
 const pending=async n=>page.waitForFunction(n=>(window.__lyricsQueue||[]).length===n,n);
 const resolve=async(index,provider,src,text)=>page.evaluate(({index,provider,src,text})=>__lyricsQueue[index].resolve({provider,srcMode:src,v:LY_V,spTried:true,kind:'line',source:provider==='spicy'?'Spicy Lyrics':'Apple Music',synced:'[00:01.00]'+text}),{index,provider,src,text});
 await choose('Apple Music');await pending(1);await choose('Spicy Lyrics');await pending(2);
 assert.equal(await page.evaluate(()=>S().ly.src),'spicy');assert.equal(await page.evaluate(()=>S().spicy.key),'');
 await resolve(1,'spicy','spicy','Newest Spicy lyric');await page.waitForFunction(()=>lyState.lines?.some(x=>x.text==='Newest Spicy lyric'));
 await resolve(0,'am','am','Stale Apple lyric');await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>lib.lyrics[curTrack().id].provider),'spicy');assert.ok(!(await page.locator('#lyScroll').innerText()).includes('Stale Apple lyric'));
 await shot(page,'spicy-restored');await page.evaluate(()=>lySrcMenu(360,350));assert.ok(!(await page.locator('#menu').innerText()).includes('нужен ключ'));await shot(page,'provider-menu');await page.keyboard.press('Escape');
 await page.evaluate(()=>{hideMenu();closePP();dsOpenSetting('ly');});await page.waitForSelector('[data-set="ly.src"][data-v="am"]');
 await page.locator('[data-set="ly.src"][data-v="am"]').click();await pending(3);await page.locator('[data-set="ly.src"][data-v="spicy"]').click();await pending(4);await resolve(3,'spicy','spicy','Spicy from Settings');await resolve(2,'am','am','Stale Settings Apple');await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>lib.lyrics[curTrack().id].provider),'spicy');
 await page.evaluate(()=>{lib.lyrics[curTrack().id]={provider:'am',srcMode:'spicy',spTried:true,fallback:true,v:LY_V,kind:'line',synced:'[00:01.00]Fallback'};});
 await page.locator('[data-set="ly.src"][data-v="spicy"]').click();await pending(5);await resolve(4,'spicy','spicy','Retried Spicy');await page.waitForFunction(()=>lib.lyrics[curTrack().id].provider==='spicy');await shot(page,'settings-spicy');
 await page.evaluate(()=>{lib.lyrics[curTrack().id]={user:'[00:01.00]Custom timing',userAt:123,picked:true};});await choose('Apple Music');await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>__lyricsQueue.length),5);assert.equal(await page.evaluate(()=>lib.lyrics[curTrack().id].user),'[00:01.00]Custom timing');assert.equal(await page.evaluate(()=>lib.offsets[curTrack().id]),1.25);assert.equal(await page.evaluate(()=>lib.stretch[curTrack().id]),1.01);
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>lySrcMenu(30,350));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await shot(page,'provider-menu-390');
 assert.deepEqual(errors,[]);await a.context.close();console.log('PASS 1.0.3 full-renderer source menu/settings: empty personal key, Spicy → Apple → Spicy, stale response/cache protection, explicit fallback retry, custom text and timing preserved, desktop/390. API transport mocked; no live account or native Windows claim.');
}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
