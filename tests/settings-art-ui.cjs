// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const assert=require('node:assert/strict'),fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8782,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning'&& /GPU fallback|viz gpu|PulseGPU/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().includes('/img?')&&decodeURIComponent(r.request().url()).includes('p.bad'))return r.fulfill({status:404,body:''});if(r.request().url().includes('/img?'))return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});if(r.request().url().startsWith('http://127.0.0.1:8782'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
 let stored=null;await page.exposeFunction('__readLib',()=>stored);await page.exposeFunction('__writeLib',v=>{stored=v;return true;});
 await page.addInitScript(()=>{
   const feed={shelves:Array.from({length:36},(_,j)=>({title:'Полка '+(j+1),items:Array.from({length:20},(_,i)=>({kind:'album',browseId:'MPRE'+j+'-'+i,id:'album'+j+'-'+i,title:'Альбом '+(j+1)+' — '+(i+1),art:'/logo.png',sub:'Pulse QA'}))})),chips:[]};
   const proxy=prefix=>new Proxy({}, {get(_t,k){return (...args)=>{
     if(String(k).startsWith('on'))return;
     if(k==='getLibrary')return __readLib().then(s=>s||{settings:{look:{splash:false},app:{language:'ru'},perf:{showFps:false},ui:{glass:true,glassOp:60}}});if(k==='saveLibrary'||k==='flushLibrary')return __writeLib(args[0]);
     if(k==='list'||k==='playlists'||k==='downloads'||k==='displays')return Promise.resolve([]);
     if(k==='offlineList')return Promise.resolve({});
     if(k==='status')return Promise.resolve({am:{},sp:{}});
     if(k==='info')return Promise.resolve(null);
     if(k==='version')return Promise.resolve('1.0.0');
     if(k==='lyrics')return Promise.resolve({none:true});
     if(k==='playlistArtwork'){window.__artCalls=(window.__artCalls||[]).concat(args[0]);window.__artActive=(window.__artActive||0)+1;window.__artMax=Math.max(window.__artMax||0,window.__artActive);return new Promise(resolve=>setTimeout(()=>{window.__artActive--;resolve({art:args[0].endsWith('missing')?null:'https://is1-ssl.mzstatic.com/'+args[0].split(':').pop()+'.png?sig=KEEP%3D'});},55));}if(k==='feed')return Promise.resolve(feed);
     if(k==='next')return Promise.resolve({tracks:[]});
     if(k==='resolve')return new Promise(()=>{});
     if(k==='prefetch')return Promise.resolve(true);
     if(k==='openUrl'){window.__opened=(window.__opened||[]).concat(args[0]);return Promise.resolve(true);}if(k==='getGlass')return Promise.resolve({});
     return Promise.resolve({});
   };}});
   window.pulse=proxy('');for(const n of ['plugins','account','svc','ytm','spicy','discord','custom','editor','wall','accounts']) Object.defineProperty(window.pulse,n,{value:proxy(n)});
   // replace proxy with explicit nested keys (proxy getter above does not read target).
   const p=proxy('');window.pulse=new Proxy({}, {get(t,k){if(['plugins','account','svc','ytm','spicy','discord','custom','editor','wall','accounts'].includes(k))return proxy(k);return p[k];}});
   localStorage.setItem('pulse.splash','off');
 });
 await page.goto('http://127.0.0.1:8782');await page.waitForFunction(()=>window.PulseGlass&&document.querySelector('.page'));await page.waitForTimeout(900);



 let checks=0;const tick=ms=>page.waitForTimeout(ms);
 await page.evaluate(()=>{go({r:'settings'});});await tick(500);
 await page.evaluate(()=>{lib.setTab='app';rerenderSettings();PulseSettingsMotion.settle();});
 const initial=await page.evaluate(()=>$('setBody').innerHTML);
 const exit=await page.evaluate(()=>{document.querySelector('[data-stab="client"]').click();return{html:$('setBody').innerHTML,inert:$('setBody').inert};});
 assert.equal(exit.html,initial,'Old panel remains during the short exit');assert.equal(exit.inert,true);checks+=2;
 await tick(115);assert.equal(await page.locator('#setBody').getAttribute('data-tab'),'client');assert.equal(await page.locator('#setBody').evaluate(e=>e.inert),false);checks+=2;
 const mid=await page.locator('#setBody').evaluate(e=>{for(const a of e.getAnimations()){a.pause();a.currentTime=100;}return{opacity:+getComputedStyle(e).opacity,transform:getComputedStyle(e).transform};});assert.ok(mid.opacity>.72&&mid.opacity<1);assert.notEqual(mid.transform,'none');checks+=2;
 await page.screenshot({path:out+'/settings-art-mid.png'});
 const stable=await page.evaluate(()=>{const b=$('setBody'),a=b.getAnimations()[0];rerenderSettings();return a===b.getAnimations()[0];});assert.ok(stable,'Same-tab async refresh does not restart motion');checks++;
 await page.evaluate(()=>{for(const a of $('setBody').getAnimations())a.play();});await tick(300);assert.equal(await page.locator('#setBody').evaluate(e=>getComputedStyle(e).transform),'none');checks++;
 await page.evaluate(()=>{for(let i=0;i<24;i++){lib.setTab=i%2?'sync':'accounts';rerenderSettings();}lib.setTab='ui';rerenderSettings();});await tick(450);assert.equal(await page.locator('#setBody').getAttribute('data-tab'),'ui');assert.equal(await page.locator('.set-side nav [aria-current="page"]').getAttribute('data-stab'),'ui');assert.equal(await page.evaluate(()=>PulseSettingsMotion.stats().active),0);assert.equal(await page.locator('#setBody').count(),1);checks+=4;
 // Search and live control rerenders must not animate on every keystroke or steal scroll position.
 await page.evaluate(()=>{$('setBody').scrollTop=130;rerenderSettings();});assert.equal(await page.locator('#setBody').evaluate(e=>e.scrollTop),130);checks++;
 await page.evaluate(()=>{lib.setTab='audio';rerenderSettings();});await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>$('setBody').dataset.tab==='audio');assert.equal(await page.locator('#setBody').getAttribute('data-tab'),'audio');assert.equal(await page.locator('#setBody').evaluate(e=>e.getAnimations().length),0);assert.equal(await page.locator('#setBody').evaluate(e=>e.inert),false);checks+=3;
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.evaluate(()=>{S().look.anim=false;applySettings();lib.setTab='look';rerenderSettings();});assert.equal(await page.locator('#setBody').getAttribute('data-tab'),'look');assert.equal(await page.evaluate(()=>PulseSettingsMotion.stats().active),0);checks+=2;
 await page.evaluate(()=>{S().look.anim=true;applySettings();});
 for(const variant of ['full','clean'])for(const width of [1366,390]){
  await page.setViewportSize({width,height:844});await page.evaluate(variant=>{S().ui.variant=variant;applyCustom();lib.setTab='client';rerenderSettings();},variant);await tick(500);
  const g=await page.locator('#setBody').evaluate(e=>{const r=e.getBoundingClientRect();return{x:r.x,right:r.right,width:r.width,transform:getComputedStyle(e).transform};});assert.ok(g.x>=0&&g.right<=width+1);assert.equal(g.transform,'none');assert.equal(await page.locator('#setBody').evaluate(e=>e.inert),false);checks+=3;
  await page.screenshot({path:out+`/settings-art-${variant}-${width}.png`});
 }
 // Missing personal Apple covers use the metadata-only IPC and update both cards and saved library records.
 await page.setViewportSize({width:1366,height:844});await page.evaluate(()=>{S().ui.variant='full';applyCustom();S().app.client='am';const entries=Array.from({length:5},(_,i)=>({kind:'playlist',browseId:'am:lib:p.custom'+i,title:'Личный плейлист '+i,sub:'Apple Music',icon:'list',art:null}));svcLists.am=entries.map(p=>({...p}));window.__artCalls=[];window.__artMax=0;setPage(cards(entries,{grid:true}),false,false);});
 await page.waitForFunction(()=>document.querySelectorAll('[data-playlist-art] .ca img').length===5);await tick(200);
 const art=await page.evaluate(()=>({calls:__artCalls,max:__artMax,saved:JSON.parse(localStorage.getItem('pulse.svcLists')).am,src:[...document.querySelectorAll('[data-playlist-art] .ca img')].map(i=>i.getAttribute('src')),stats:PulsePlaylistArt.stats()}));
 assert.equal(art.calls.length,5);assert.ok(art.max<=2);assert.equal(art.stats.active,0);assert.ok(art.saved.every(p=>p.art?.includes('sig=KEEP%3D')&&p.icon===null));assert.ok(art.src.every(s=>decodeURIComponent(s).includes('sig=KEEP%3D')));assert.equal(await page.locator('[data-playlist-art] .ca-ico').count(),0);checks+=6;
 await page.screenshot({path:out+'/settings-art-covers.png'});
 const retry=await page.evaluate(async()=>{const before=__artCalls.length;setPage(cards(svcLists.am,{grid:true}),false,false);await new Promise(r=>setTimeout(r,200));return __artCalls.length-before;});assert.equal(retry,0,'Successful covers survive list redraw without new requests');checks++;
 await page.evaluate(()=>{setPage(cards([{kind:'playlist',browseId:'am:lib:p.missing',title:'Apple не вернул обложку',icon:'list'}],{grid:true}),false,false);});await tick(200);assert.equal(await page.locator('[data-playlist-art] .ca-ico').count(),1);assert.equal(await page.locator('[data-playlist-art] img').count(),0);checks+=2;
 // A broken image must not poison the successful cache or hammer metadata on redraw.
 await page.evaluate(()=>{setPage(cards([{kind:'playlist',browseId:'am:lib:p.bad',title:'Broken cover QA',icon:'list'}],{grid:true}),false,false);});await tick(250);
 const bad=await page.evaluate(()=>({calls:__artCalls.length,cache:PulsePlaylistArt.stats().cache}));assert.equal(await page.locator('[data-playlist-art] img').count(),0);assert.equal(bad.cache,5);checks+=2;
 await page.evaluate(()=>{setPage(cards([{kind:'playlist',browseId:'am:lib:p.bad',title:'Broken cover QA',icon:'list'}],{grid:true}),false,false);});await tick(150);assert.equal(await page.evaluate(()=>__artCalls.length),bad.calls);checks++;
 // A disconnected view never receives a late image; duplicate cards share one metadata job.
 await page.evaluate(()=>{setPage(cards(Array.from({length:2},()=>({kind:'playlist',browseId:'am:lib:p.dupe',title:'Duplicate QA',icon:'list'})),{grid:true}),false,false);});await tick(250);assert.equal(await page.evaluate(()=>__artCalls.filter(id=>id==='am:lib:p.dupe').length),1);assert.equal(await page.locator('[data-playlist-art] img').count(),2);checks+=2;
 await page.evaluate(()=>{setPage(cards([{kind:'playlist',browseId:'am:lib:p.detached',title:'Detached QA',icon:'list'}],{grid:true}),false,false);PulsePlaylistArt.repair(document.querySelector('[data-playlist-art]'));setPage('<h1>Another route</h1>',false,false);});await tick(180);assert.equal(await page.locator('[data-playlist-art] img').count(),0);assert.equal(await page.evaluate(()=>PulsePlaylistArt.stats().active),0);checks+=2;
 assert.deepEqual(errors,[]);console.log(JSON.stringify({checks,apple:{requests:art.calls.length,maxConcurrent:art.max,persisted:art.saved.length},mid},null,2));await browser.close();server.close();process.exit(0);
})().catch(e=>{console.error(e);server.close();process.exit(1)});
