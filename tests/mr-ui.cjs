// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8756,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || 'chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning'&& /GPU fallback|viz gpu|PulseGPU/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8756'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
 await page.addInitScript(()=>{
   const feed={shelves:[{title:'Тестовые треки',items:Array.from({length:14},(_,i)=>({kind:'song',id:String(i).padStart(11,'a'),title:'Тест переключения '+(i+1),author:'Pulse QA',dur:240,loaded:true}))}],chips:[]};
   const proxy=prefix=>new Proxy({}, {get(_t,k){return (...args)=>{
     if(String(k).startsWith('on'))return;
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
 await page.goto('http://127.0.0.1:8756');await page.waitForTimeout(1600);

 const assert=require('node:assert/strict');
 await page.evaluate(()=>{window.mrCalls=[];window.mrToggles=0;toggle=function(){mrToggles++;playing=!playing;onPlayState();};lib.queue={tracks:Array.from({length:6},(_,i)=>({id:'mrtest'+i,title:'Track '+i,author:'QA',dur:240,art:'/logo.png'})),idx:0};playing=true;playIdx=function(i){mrCalls.push(i);lib.queue.idx=i;playing=true;updateNow();};S().ly.vis='mineradio';S().ly.mrQuality='eco';S().ly.mrFps=20;S().ly.mrLyrics=false;S().ly.mrKeep=true;lyStageOpen(true);updateNow();});
 await page.waitForFunction(()=>window.mrActive&&mrActive(),{},{timeout:120000});
 const frame=page.frames().find(f=>f.url().includes('/mineradio/index.html'));await frame.waitForFunction(()=>window.__pulse&&window.shelfManager&&shelfManager.getCards().length>0,{},{timeout:120000});
 await frame.evaluate(()=>renderer.domElement.id='qaScene');
 async function report(label){console.log(label,await frame.evaluate(()=>({mode:shelfManager.getMode(),cards:shelfManager.getCards().map(c=>({i:c.index,action:c.mesh.userData.action,visible:c.mesh.visible})),center:shelfManager.getCenterIdx(),pinned:shelfPinnedOpen,hadDrag:mouseDownAt.hadDrag,visible:shelfVisibility,playing})));}
 await report('initial');await page.waitForTimeout(2000);
 async function clickCard(index){const barTop=await page.locator('#bar').evaluate(el=>el.getBoundingClientRect().top);const point=await frame.evaluate(({index:i,barTop})=>{const c=shelfManager.getCards().find(c=>c.mesh.userData.action.index===i);if(!c)throw Error('No card '+i);scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);const g=c.mesh.geometry.parameters;for(const y of [0,.35,-.35,.2,-.2])for(const x of [0,.25,-.25]){const p=c.mesh.localToWorld(new THREE.Vector3(x*g.width,y*g.height,0));p.project(camera);const pt={x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};if(pt.x<5||pt.x>innerWidth-5||pt.y<5||pt.y>barTop-6)continue;const e={clientX:pt.x,clientY:pt.y};const hit=pointerCardHit(raycasterFromPointerEvent(e),e);if(hit&&hit.card&&hit.card.mesh.userData.action.index===i&&document.elementFromPoint(pt.x,pt.y)===renderer.domElement)return pt;}throw Error('No unobstructed card point '+i);},{index,barTop});console.log('click point',index,point);await frame.locator('#qaScene').dblclick({position:point,force:true});await page.waitForTimeout(1500);console.log('calls',await page.evaluate(()=>mrCalls));assert.equal(await page.evaluate(()=>lib.queue.idx),index,'Clicked card must select its track');assert.equal(await page.evaluate(()=>playing),true,'Double click must not pause selection');}
 await clickCard(1);assert.deepEqual(await page.evaluate(()=>mrCalls),[1]);
 await page.waitForTimeout(30000);await report('after idle');await page.evaluate(()=>failedAt.set('mrtest2',Date.now()));await clickCard(2);assert.equal(await page.evaluate(()=>failedAt.has('mrtest2')),false);assert.deepEqual(await page.evaluate(()=>mrCalls),[1,2]);
 await frame.evaluate(()=>shelfManager.openContent(shelfManager.getCenterIdx()));await page.waitForTimeout(1000);await clickCard(3);assert.deepEqual(await page.evaluate(()=>mrCalls),[1,2,3]);
 await page.evaluate(()=>{playing=false;});await page.waitForTimeout(400);await clickCard(3);assert.equal(await page.evaluate(()=>mrToggles),1);assert.deepEqual(await page.evaluate(()=>mrCalls),[1,2,3]);
 await frame.evaluate(()=>{setShelfMode('stage');});await page.waitForTimeout(2500);await report('classic stage');await frame.evaluate(()=>shelfManager.openContent(4));await page.waitForTimeout(1200);assert.equal(await page.evaluate(()=>lib.queue.idx),4);assert.deepEqual(await page.evaluate(()=>mrCalls),[1,2,3,4]);
 await frame.evaluate(()=>setShelfMode('side'));await page.waitForTimeout(2500);await clickCard(5);assert.deepEqual(await page.evaluate(()=>mrCalls),[1,2,3,4,5]);
 await page.evaluate(()=>mrConsole(true));await page.waitForTimeout(600);
 assert.equal(await frame.evaluate(()=>window.__pulseLocaleText('СЕЙЧАС ИГРАЕТ')),'NOW PLAYING');
 assert.equal(await frame.evaluate(()=>presetMeta[0].name),'Artwork');
 await frame.evaluate(()=>window.__pulseTranslate(document.body));await page.waitForTimeout(200);
 await page.screenshot({path:out+'/panel5-mr-console-en.png'});
 await page.evaluate(()=>{S().app.language='ru';settingChanged('app.language');});await page.waitForTimeout(200);
 assert.equal(await frame.evaluate(()=>window.__pulseLocaleText('СЕЙЧАС ИГРАЕТ')),'СЕЙЧАС ИГРАЕТ');
 await page.evaluate(()=>{S().app.language='en';settingChanged('app.language');});await page.waitForTimeout(200);
 assert.equal(await frame.evaluate(()=>presetMeta[0].name),'Artwork');
 const pulseCheck=await frame.evaluate(()=>{let d=PulseBeatOnset.create();let z=new Uint8Array(1024),f=new Uint8Array(1024);for(let i=2;i<8;i++)f[i]=230;for(let i=0;i<20;i++)d.step(z);let v=d.step(f);return {hit:v.hit,pulse:v.pulse};});assert.equal(pulseCheck.hit,true);assert.ok(pulseCheck.pulse>0);console.log('MineRadio transient detector',pulseCheck);
 console.log('MR selection passed: idle, failed-track retry, no duplicate/pause, resume, side/stage rebuild.');
 console.log('errors',errors.slice(0,8));assert.deepEqual(errors,[]);await page.screenshot({path:out+'/mr-shelf.png'});await browser.close();server.close();process.exit(0);
})().catch(e=>{console.error(e);server.close();process.exit(1)});
