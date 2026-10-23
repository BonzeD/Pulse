// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const assert=require('node:assert/strict'),fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8781,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning'&& /GPU fallback|viz gpu|PulseGPU/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8781'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
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
     if(k==='feed')return Promise.resolve(feed);
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
 await page.goto('http://127.0.0.1:8781');await page.waitForFunction(()=>window.PulseGlass&&document.querySelector('.page'));await page.waitForTimeout(900);


 const result=await page.evaluate(async()=>{
 S().ly.vis='kinetic';S().ly.kParticles=false;S().ly.kFit=true;S().ly.kRefl=true;
 lib.queue={tracks:[{id:'abcdefghijk',title:'Kinetic QA',author:'Pulse',art:'/logo.png',dur:240}],idx:0};updateNow();
 lyState.lines=[{t:0,text:'Words move together across the night without wasting a single frame',words:'Words move together across the night without wasting a single frame'.split(' ').map((s,i)=>({t:i,s}))}];lyState.cur=0;lyState.word=0;lyStageOpen(true);await new Promise(r=>setTimeout(r,120));cancelAnimationFrame(lys.raf);lys.raf=0;
 let fits=0,queries=0;const orig=lysFit;lysFit=function(...args){fits++;return orig(...args)};const qs=Element.prototype.querySelector,qsa=Element.prototype.querySelectorAll;Element.prototype.querySelector=function(...args){if(this.closest?.('#lyStage'))queries++;return qs.apply(this,args)};Element.prototype.querySelectorAll=function(...args){if(this.closest?.('#lyStage'))queries++;return qsa.apply(this,args)};
 const t=performance.now();for(let k=0;k<48;k++){lyState.word=k%12;lysSync();}const ms=performance.now()-t;const fitResult={updates:48,fits,queries,ms};
 lyState.lines=[{t:0,nb:2,text:'Lead voice backing voice',words:[{t:0,s:'Lead'},{t:1,s:'voice'},{t:10000,s:'backing'},{t:10001,s:'voice'}]}];lyState.cur=0;lyState.word=0;lysSync(true);queries=0;for(let k=0;k<144;k++)lysBgMark();const bgQueries=queries;
 lysFit=orig;Element.prototype.querySelector=qs;Element.prototype.querySelectorAll=qsa;lyStageOpen(false);return{fitResult,bgQueries};
  });
 assert.equal(result.fitResult.fits,0,'Word changes must not refit typography');assert.ok(result.bgQueries<=6,'Idle backing vocals only initialize caches');
 let checks=2;
 const kinetic=await page.evaluate(async()=>{
 S().ly.kReflQ='ultra';S().ly.kFit=true;S().ly.kParticles=true;S().ly.kPtDens=100;
 lyState.lines=[{t:0,nb:2,text:'Lead voice backing voice',words:[{t:0,s:'Lead'},{t:1,s:'voice'},{t:10,s:'backing'},{t:11,s:'voice'}]}];lyState.cur=0;lyState.word=1;lyStageOpen(true);await new Promise(r=>setTimeout(r,100));cancelAnimationFrame(lys.raf);lys.raf=0;
 const previousTime=E.time;let time=12;E.time=()=>time*stretchK()+offset()+outLat()*((audio&&audio.playbackRate)||1)+(S().ly.lag||0)/1000;
 const states=()=>[lys.live,lys.live._twin,lys.live._twin2].filter(Boolean).map(b=>[...b.querySelectorAll('.lw[data-k="2"],.lw[data-k="3"]')].map(e=>e.classList.contains('in')));
 lysBgMark();const forward=states();time=0;lysBgMark();const backward=states();
 time=10.5;lysBgMark();const partial=states();let queries=0;const q=Element.prototype.querySelector,qa=Element.prototype.querySelectorAll;
 Element.prototype.querySelector=function(...a){queries++;return q.apply(this,a)};Element.prototype.querySelectorAll=function(...a){queries++;return qa.apply(this,a)};for(let i=0;i<144;i++)lysBgMark();Element.prototype.querySelector=q;Element.prototype.querySelectorAll=qa;
 E.time=previousTime;
 const fonts=[...lys.live.querySelectorAll('.lr')].map(e=>e.style.fontSize);
 for(let i=0;i<10;i++){lyState.word=i%2;lysSync();}const stable=JSON.stringify(fonts)===JSON.stringify([...lys.live.querySelectorAll('.lr')].map(e=>e.style.fontSize));
 lyStageOpen(false);const closed={raf:lys.raf,on:lys.on,active:!!document.querySelector('#lyStage'),pending:PulseMotion.stats().pending};lyStageOpen(true);const reopened={stages:document.querySelectorAll('.lys:not(.lys-pv)').length,mainIds:document.querySelectorAll('#lysMain').length};cancelAnimationFrame(lys.raf);lys.raf=0;
 return{forward,backward,partial,queries,stable,closed,reopened};
 });
 assert.equal(kinetic.forward.length,3);for(const s of kinetic.forward)assert.deepEqual(s,[true,true]);for(const s of kinetic.backward)assert.deepEqual(s,[false,false]);for(const s of kinetic.partial)assert.deepEqual(s,[true,false]);assert.equal(kinetic.queries,0);assert.ok(kinetic.stable);assert.equal(kinetic.closed.raf,0);assert.equal(kinetic.closed.on,false);assert.equal(kinetic.closed.active,false);assert.equal(kinetic.reopened.mainIds,1);assert.equal(kinetic.reopened.stages,1);checks+=10;
 for(const size of [{width:1366,height:768},{width:390,height:844},{width:1366,height:500}]){
 await page.setViewportSize(size);await page.waitForTimeout(650);
 const geometry=await page.evaluate(()=>{cancelAnimationFrame(lys.raf);lys.raf=0;const b=lys.live;return{vw:b._fitVW,vh:b._fitVH,width:b.clientWidth,finite:[...b.querySelectorAll('.lr')].every(e=>Number.isFinite(parseFloat(e.style.fontSize))&&parseFloat(e.style.fontSize)>0)}});
 assert.equal(geometry.vw,size.width);assert.equal(geometry.vh,size.height);assert.ok(geometry.finite);checks+=3;
 await page.screenshot({path:out+`/kinetic-${size.width}x${size.height}.png`});
 }
 await page.evaluate(()=>{lyStageOpen(false);PulseMotion.flush();});await page.setViewportSize({width:1366,height:768});await page.waitForTimeout(500); // Let the queued resize close old menus before opening a new one.
 await page.evaluate(()=>{modal('<h2>Motion QA</h2><select id="motionSelect"><option>A</option><option>B</option><option>C</option></select>');PulseSelect.open($('motionSelect'));});
 await page.waitForTimeout(60);assert.notEqual(await page.locator('.pulse-select-menu:not([data-motion-leaving])').evaluate(e=>getComputedStyle(e).animationName),'none');
 await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');assert.equal(await page.locator('#motionSelect').inputValue(),'B');assert.equal(await page.locator('#motionSelect').getAttribute('aria-expanded'),'false');
 const menuClose=await page.evaluate(()=>({pending:PulseMotion.stats().pending,inert:document.querySelector('[data-motion-leaving]')?.inert}));assert.equal(menuClose.pending,1);assert.equal(menuClose.inert,true);
 await page.evaluate(()=>{for(let i=0;i<12;i++){PulseSelect.open($('motionSelect'));PulseSelect.close();}PulseSelect.open($('motionSelect'));});assert.equal(await page.locator('.pulse-select-menu').count(),1);checks+=6;
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(30);assert.equal(await page.evaluate(()=>PulseMotion.enabled()),false);await page.evaluate(()=>PulseSelect.close());assert.equal(await page.locator('.pulse-select-menu').count(),0);
 assert.equal(await page.evaluate(()=>PulseMotion.stats().pending),0);checks+=3;
 await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>{closeModal();PulseMotion.flush();});await page.waitForTimeout(230);
 // Native HTML dialogs preserve top-layer focus and close semantics while transitioning visually.
 await page.evaluate(()=>{const b=document.createElement('button');b.id='motionOpener';b.textContent='Metadata';document.body.append(b);b.focus();const d=document.createElement('dialog');d.id='motionDialog';d.className='media-dialog';d.innerHTML='<h2>Редактор трека</h2><input id="motionField" value="Кинетика"><select id="dialogSelect"><option>Первый</option><option>Второй</option></select><button id="motionClose">Закрыть</button>';d.querySelector('button').onclick=()=>d.close();document.body.append(d);d.showModal();const animations=d.getAnimations();for(const a of animations){a.pause();a.currentTime=70;}});await page.evaluate(()=>new Promise(requestAnimationFrame));
 const dm=await page.locator('#motionDialog').evaluate(d=>({opacity:+getComputedStyle(d).opacity,animations:d.getAnimations().length,active:d.contains(document.activeElement)}));assert.ok(dm.animations>0,'native dialog must really transition');assert.ok(dm.opacity>0&&dm.opacity<1);assert.ok(dm.active);
 await page.screenshot({path:out+'/kinetic-dialog-mid.png'});await page.locator('#motionDialog').evaluate(d=>d.getAnimations().forEach(a=>a.play()));await page.evaluate(()=>PulseSelect.open($('dialogSelect')));assert.equal(await page.locator('dialog .pulse-select-menu').count(),1);await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');assert.equal(await page.locator('#dialogSelect').inputValue(),'Второй');
 await page.evaluate(()=>{$('motionDialog').close();$('motionDialog').showModal();});await page.waitForTimeout(280);assert.equal(await page.locator('#motionDialog').evaluate(e=>e.open),true);await page.keyboard.press('Escape');assert.equal(await page.locator('#motionDialog').evaluate(e=>e.open),false);checks+=6;


 await page.evaluate(()=>{PulseMotion.flush();const el=document.createElement('div');el.id='interruptMotion';el.className='acc-pop';el.textContent='Interpolation';document.body.append(el);for(const a of el.getAnimations()){a.pause();a.currentTime=80;}const before=+getComputedStyle(el).opacity;PulseMotion.remove(el,'interrupt');window.__interruption={before,after:+getComputedStyle(el).opacity};});const interruption=await page.evaluate(()=>__interruption);assert.ok(Math.abs(interruption.before-interruption.after)<.03);checks++;await page.evaluate(()=>PulseMotion.flush());
 await page.waitForTimeout(260);
 await page.evaluate(()=>{const p=document.createElement('div');p.id='accPop';p.className='acc-pop';p.textContent='Профиль';document.body.append(p);accPopClose();});assert.equal(await page.locator('#accPop').count(),0);assert.equal(await page.locator('.acc-pop[data-motion-leaving]').count(),1);await page.waitForTimeout(220);assert.equal(await page.locator('.acc-pop').count(),0);checks+=3;
 await page.evaluate(()=>czEdit('home'));await page.waitForTimeout(290);assert.equal(await page.locator('#czDock').count(),1);assert.equal(await page.locator('#czDock').evaluate(e=>getComputedStyle(e).transform),'none');await page.screenshot({path:out+'/kinetic-editor.png'});await page.evaluate(()=>czExit());await page.waitForTimeout(300);assert.equal(await page.locator('#czDock').count(),0);checks+=3;
 for(const vis of ['classic','stack','kinetic']){
 await page.evaluate(vis=>{S().ly.vis=vis;S().ly.kRefl=false;S().ly.kFit=false;lyStageOpen(true);lysSync(true);},vis);await page.waitForTimeout(100);assert.equal(await page.locator('#lyStage').getAttribute('data-vis'),vis);await page.evaluate(()=>{lyStageOpen(false);lyStageOpen(true);lyStageOpen(false);PulseMotion.flush();});assert.equal(await page.locator('#lysMain').count(),0);checks+=2;
 }
 await page.evaluate(()=>{document.body.classList.add('no-anim');const e=document.createElement('div');document.body.append(e);PulseMotion.remove(e);window.__motionImmediate=!e.isConnected;});assert.equal(await page.evaluate(()=>__motionImmediate),true);checks++;
 assert.deepEqual(errors,[]);console.log(JSON.stringify({checks,profile:result,kinetic},null,2));await browser.close();server.close();process.exit(0);
})().catch(e=>{console.error(e);server.close();process.exit(1)});
