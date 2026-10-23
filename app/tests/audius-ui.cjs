// Live Audius catalog and first-signal smoke test; requires internet and Chromium.
// AUDIUS_ARTIFACT_DIR overrides the local tests/artifacts/audius output directory.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const audius=require('../audius').create();
const root=path.join(__dirname,'..','renderer');
const out=process.env.AUDIUS_ARTIFACT_DIR||path.join(__dirname,'artifacts','audius');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{if(req.url.startsWith('/audius/'))return audius.proxy(req,res,req.url.split('?')[0]);let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8784,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning'&& /GPU fallback|viz gpu|PulseGPU/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8784'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
 await page.exposeFunction('__adRPC',async(method,...args)=>{if(method==='track')return audius.getTrack(...args);if(method==='select')return audius.select(...args);if(method==='cancel')return audius.cancel(...args);if(method==='feed')return audius.feed(...args);if(method==='search')return audius.search(...args);if(method==='browse')return audius.browse(...args);if(method==='related')return audius.related(...args);return null;});
 let stored=null;await page.exposeFunction('__readLib',()=>stored);await page.exposeFunction('__writeLib',v=>{stored=require('../audius').libraryReferences(v);return true;});
 await page.addInitScript(()=>{
   const headings=['Новинки и любимые треки','Из вашей библиотеки','Кавер-версии и ремиксы','Вы давно не слушали','Видеоклипы для вас','Миксы для вас','Плейлисты других пользователей','Playlists Made for You','Recently Played','New Releases for You','Video Game Music','Рекомендуемые станции','Только для тебя, Bon zeD','Похоже на: Casey Edwards','Альбомы с треками, которые тебе нравятся','Soundtrack your Thursday morning','Еще больше открытий: Gareth Coker'];
   const feed={shelves:headings.map((title,j)=>({title,items:[{kind:'album',browseId:'MPRE'+j,title:'Моя песня / Bon zeD / 日本語',sub:'Мой исполнитель / 日本語',art:'/logo.png'}]})),chips:['Заряд энергии','Веселье','Релакс','Тренировки','В дороге','Концентрация','Романтика','Грусть','Сон'].map((title,i)=>({title,params:String(i)}))};
   window.__catalogCalls=[];
   const proxy=prefix=>new Proxy({}, {get(_t,k){return (...args)=>{
     if(String(k).startsWith('on'))return;
     if(prefix==='audius')return __adRPC(k,...args);
     if(prefix==='ytm'&&window.__selected==='ad'&&['feed','search','browse','related'].includes(k))return __adRPC(k,...args);
     if(prefix==='ytm'&&window.__selected==='ad'&&k==='next')return Promise.resolve({tracks:[]});
     if(k==='getLibrary')return __readLib().then(s=>s||{settings:{look:{splash:false},app:{language:'ru'},perf:{showFps:false},ui:{glass:true,glassOp:60}}});if(k==='saveLibrary'||k==='flushLibrary')return __writeLib(args[0]);
     if(k==='list'||k==='playlists'||k==='downloads'||k==='displays')return Promise.resolve([]);
     if(k==='offlineList')return Promise.resolve({});
     if(k==='status')return Promise.resolve({am:{},sp:{}});
     if(k==='info')return Promise.resolve(null);
     if(k==='version')return Promise.resolve('1.0.2');
     if(k==='lyrics')return Promise.resolve({none:true});
     if(k==='setClient'){window.__selected=args[0];window.__catalogLanguage=args[1]?.language;window.__catalogCalls.push(['set',args[0],args[1]?.language]);return Promise.resolve(args[0]);} if(k==='feed'){window.__catalogCalls.push(['feed',window.__catalogLanguage]);return Promise.resolve(feed);}
     if(k==='next')return Promise.resolve({tracks:[]});
     if(k==='resolve')return new Promise(()=>{});
     if(k==='prefetch')return Promise.resolve(true);
     if(k==='openUrl'){window.__opened=(window.__opened||[]).concat(args[0]);return Promise.resolve(true);}if(k==='getGlass')return Promise.resolve({});
     return Promise.resolve({});
   };}});
   window.pulse=proxy('');for(const n of ['audius','plugins','account','svc','ytm','spicy','discord','custom','editor','wall','accounts']) Object.defineProperty(window.pulse,n,{value:proxy(n)});
   // replace proxy with explicit nested keys (proxy getter above does not read target).
   const p=proxy('');window.pulse=new Proxy({}, {get(t,k){if(['audius','plugins','account','svc','ytm','spicy','discord','custom','editor','wall','accounts'].includes(k))return proxy(k);return p[k];}});
   localStorage.setItem('pulse.splash','off');
 });
 await page.goto('http://127.0.0.1:8784');await page.waitForFunction(()=>window.PulseGlass&&document.querySelector('.page'));await page.waitForTimeout(900);
 const assert=require('node:assert/strict');
 await page.evaluate(()=>setClient('ad'));await page.waitForFunction(()=>document.body.dataset.client==='ad'&&document.querySelector('#page .sh-title')?.textContent.includes('Популярные'));



 assert.equal(await page.locator('[data-cl]').count(),4);assert.equal(await page.locator('#accBtn').isVisible(),false);
 await page.screenshot({path:path.join(out,'audius-home.png')});
 const nativeTrack=await page.evaluate(async()=>{const d=await pulse.ytm.feed('FEmusic_home');const t=d.shelves[0].items[0];window.__track=t;return t;});
 const probes=[];
 for(let i=0;i<2;i++){
  const signal=await page.evaluate(async t=>{const begin=performance.now();setQueue([t],0);const samples=new Uint8Array(2048);return await new Promise(resolve=>{const timeout=setTimeout(()=>{clearInterval(interval);resolve({timeout:true,src:audio.getAttribute('src'),ready:audio.readyState});},18000);const interval=setInterval(()=>{if(!analyser)return;analyser.getByteTimeDomainData(samples);if([...samples].some(n=>Math.abs(n-128)>3)){clearTimeout(timeout);clearInterval(interval);resolve({ms:performance.now()-begin,src:audio.getAttribute('src'),clock:audio.currentTime,signal:true});}},20);});},nativeTrack);
  probes.push(signal);assert.equal(signal.signal,true,JSON.stringify(signal));assert.match(signal.src,/^\/audius\/audio\//);
  await page.evaluate(()=>E.pause());await page.waitForTimeout(200);
 }
 await page.evaluate(()=>{E.seek(22);E.volume(65);S().audio.speed=.5;audio.playbackRate=.5;});await page.evaluate(()=>E.play());await page.waitForTimeout(600);const controls=await page.evaluate(()=>({time:E.time(),rate:audio.playbackRate,paused:audio.paused}));assert.ok(controls.time>22);assert.equal(controls.rate,.5);assert.equal(controls.paused,false);await page.evaluate(()=>E.pause());
 const identity=await page.evaluate(()=>{toggleLike(curTrack());return {id:curTrack().id,liked:!!lib.likes[curTrack().id],queued:lib.likeQ.some(t=>t.id===curTrack().id)};});assert.equal(identity.id,nativeTrack.id);assert.equal(identity.liked,true);assert.equal(identity.queued,false);
 await page.locator('#audiusSource').click();await page.waitForTimeout(100);assert.ok(await page.locator('[data-ad="open"]').isVisible());await page.screenshot({path:path.join(out,'audius-source.png')});await page.evaluate(()=>closeModal());
 // Real catalog search and browse through same RPC, not fake service responses.
 const search=await page.evaluate(()=>pulse.ytm.search('Ciara Graves','artists'));assert.ok(search[0].items.length);
 const artist=await page.evaluate(id=>pulse.ytm.browse(id),nativeTrack.artistId);assert.equal(artist.type,'artist');assert.ok(artist.shelves[0].items.length);
 const playlistId=await page.evaluate(async()=>{const d=await pulse.ytm.feed('FEmusic_home');return d.shelves[1].items[0].browseId;});const playlist=await page.evaluate(id=>pulse.ytm.browse(id),playlistId);assert.equal(playlist.type,'playlist');assert.ok(playlist.tracks.length);
 // Settings and translations, metadata must stay untouched.
 await page.evaluate(()=>{lib.setTab='client';go({r:'settings'});});await page.waitForTimeout(500);await page.screenshot({path:path.join(out,'audius-settings.png')});
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{PulseI18n.setLanguage('ja');go({r:'home'});});await page.waitForTimeout(500);await page.screenshot({path:path.join(out,'audius-mobile-ja.png')});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.equal(await page.evaluate(()=>__track.title),nativeTrack.title);
 await page.waitForTimeout(700);
 assert.ok(stored.likes[nativeTrack.id]);assert.equal(stored.known[nativeTrack.id].title,nativeTrack.id);
 assert.ok(!JSON.stringify(stored.known).includes(nativeTrack.title));
 await page.reload();await page.waitForFunction(()=>window.PulseAudius&&typeof lib!=='undefined'&&lib.known);
 await page.waitForFunction(id=>lib.known[id]?.title!==id&&!!lib.known[id]?.author,nativeTrack.id,{timeout:12000});
 assert.equal(await page.evaluate(id=>!!lib.likes[id],nativeTrack.id),true);
 await page.evaluate(()=>{go({r:'library',tab:'songs'});});await page.waitForTimeout(500);
 const rehydrated=await page.evaluate(id=>({title:lib.known[id].title,liked:!!lib.likes[id]}),nativeTrack.id);assert.equal(rehydrated.title,nativeTrack.title);

 console.log(JSON.stringify({probes,controls,identity,artistTracks:artist.shelves[0].items.length,playlistTracks:playlist.tracks.length,errors},null,2));assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'live-ui-result.json'),JSON.stringify({probes,controls,identity,artistTracks:artist.shelves[0].items.length,playlistTracks:playlist.tracks.length,errors},null,2));
 await browser.close();server.close();process.exit(0);
})().catch(e=>{console.error(e);server.close();process.exit(1);});
