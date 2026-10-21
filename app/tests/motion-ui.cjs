// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8760,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || chromium.executablePath(),headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning'&& /GPU fallback|viz gpu|PulseGPU/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8760'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
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
 await page.goto('http://127.0.0.1:8760');await page.waitForTimeout(1600);
 console.log('startup errors',errors);await page.screenshot({path:out+'/motion-home.png'});


 const assert=require('node:assert/strict');
 const shot=async name=>page.screenshot({path:out+'/motion-'+name+'.png'});
 const animationOf=selector=>page.locator(selector).evaluate(e=>({name:getComputedStyle(e).animationName,transform:getComputedStyle(e).transform,opacity:+getComputedStyle(e).opacity}));
 await page.evaluate(()=>{S().look.anim=true;applySettings();go({r:'settings'});});await page.waitForTimeout(600);
 assert.equal(await page.evaluate(()=>animOn()),true);
 await shot('settings-full');
 // Capture actual halfway animation frames, not just settled states.
 await page.evaluate(()=>modal('<h2>Мягкое движение</h2><p>Окна появляются спокойно, кнопки отзываются быстро.</p><br><button class="btn" data-act="closeModal">Понятно</button>'));
 await page.evaluate(()=>{for(const a of $('modalBox').getAnimations()){a.pause();a.currentTime=130;}});
 let mid=await animationOf('#modalBox');assert.ok(mid.opacity>0&&mid.opacity<1,'Modal has a real interpolated entrance');await shot('modal-mid');
 await page.evaluate(()=>{for(const a of $('modalBox').getAnimations())a.play();});await page.waitForTimeout(380);await shot('modal-full');
 await page.evaluate(()=>{closeModal();modal('<h2>Повторное открытие</h2><p>Старый таймер не закрывает новое окно.</p>');});await page.waitForTimeout(240);assert.ok(await page.locator('#modal').evaluate(e=>e.classList.contains('show')));
 await page.evaluate(()=>closeModal());await page.waitForTimeout(210);assert.equal(await page.locator('#modal').evaluate(e=>e.classList.contains('show')),false);
 await page.evaluate(()=>showMenu(innerWidth-20,innerHeight-20,[['play','Слушать',()=>{}],['heart','Нравится',()=>{}],['plus','В плейлист',()=>{}]]));await page.waitForTimeout(240);
 let bounds=await page.locator('#menu').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=1366&&bounds.y+bounds.height<=768);await shot('menu');await page.evaluate(()=>hideMenu());await page.waitForTimeout(150);
 // The settled page must not become a containing block for fixed descendants.
 assert.equal((await animationOf('#page')).transform,'none');
 await page.evaluate(()=>{setPage('<div class="shelf">'+Array.from({length:120},(_,i)=>'<div class="tr">Трек '+(i+1)+'</div>').join('')+'</div>',false,false);});
 const cascade=await page.evaluate(()=>({rows:[...document.querySelectorAll('#page .tr')].filter(e=>getComputedStyle(e).animationName!=='none').length,shelf:getComputedStyle(document.querySelector('#page .shelf')).animationName}));
 assert.equal(cascade.rows,8);assert.equal(cascade.shelf,'none');await page.waitForTimeout(450);
 // Player transitions, tabs, sidebar fix, desktop and narrow widths.
 for(const variant of ['full','clean']){
  await page.setViewportSize({width:1366,height:768});
  await page.evaluate(variant=>{S().ui.variant=variant;applyCustom();lib.queue={tracks:[{id:'abcdefghijk',title:'Последний штрих',author:'Pulse • проверка движения',dur:240,art:'/logo.png'}],idx:0};updateNow();openPP();setMode('visual');},variant);
  if(variant==='full'){
   await page.waitForTimeout(30);
   const moving=await page.evaluate(()=>{const a=$('pp').getAnimations().find(a=>a.transitionProperty==='transform');if(!a)return false;a.pause();a.currentTime=150;return true;});
   assert.ok(moving,'Player has a real transform transition');await shot('player-mid');
   assert.notEqual(await page.locator('#pp').evaluate(e=>getComputedStyle(e).transform),'none');
   await page.evaluate(()=>{for(const a of $('pp').getAnimations())a.play();});
  }
  await page.waitForTimeout(450);assert.equal(await page.locator('#side').evaluate(e=>getComputedStyle(e).display),'none');await shot('player-'+variant);
  await page.evaluate(()=>setTab('lyrics'));await page.waitForTimeout(300);
  const box=await page.locator('#pp').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=1366);
  await page.evaluate(()=>closePP());await page.waitForTimeout(430);assert.notEqual(await page.locator('#side').evaluate(e=>getComputedStyle(e).display),'none');
 }
 for(const width of [980,390]){
  await page.setViewportSize({width,height:720});await page.evaluate(()=>{openPP();setMode('visual');});await page.waitForTimeout(430);
  const b=await page.locator('#pp').boundingBox();assert.ok(b.x>=0&&b.x+b.width<=width);await shot('clean-'+width);await page.evaluate(()=>closePP());await page.waitForTimeout(430);
 }
 await page.setViewportSize({width:1366,height:768});
 await page.evaluate(()=>$('btnCleanActions').click());await page.waitForTimeout(320);await shot('clean-sheet');
 assert.equal(await page.locator('#cleanOverlay .clean-dialog').evaluate(e=>getComputedStyle(e).animationName),'axSpring');
 await page.evaluate(()=>document.querySelector('#cleanOverlay [data-clean="close"]').click());
 assert.equal(await page.locator('#cleanOverlay').count(),0,'Closing sheet releases its active ID immediately');
 assert.equal(await page.locator('#bar').evaluate(e=>e.inert),false,'Controls become actionable immediately');
 await page.evaluate(()=>$('btnCleanActions').click());await page.waitForTimeout(220);
 assert.equal(await page.locator('#cleanOverlay').count(),1,'Old exit cannot remove a reopened sheet');
 await page.evaluate(()=>document.querySelector('#cleanOverlay [data-clean="close"]').click());await page.waitForTimeout(200);
 assert.equal(await page.locator('.clean-overlay').count(),0,'Visual exit nodes are cleaned up');
 // OS preference changes while the app is open: no JS delay, no CSS motion.
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await page.evaluate(()=>animOn()),false);
 await page.evaluate(()=>{modal('<h2>Без лишнего движения</h2><p>Системное уменьшение движения включено.</p>');});
 assert.equal((await animationOf('#modalBox')).name,'none');await shot('reduced');
 assert.equal(await page.evaluate(()=>{closeModal();return $('modal').classList.contains('show');}),false);
 assert.equal(await page.evaluate(()=>{showMenu(300,140,[['play','Проверка',()=>{}]]);hideMenu();return $('menu').classList.contains('show');}),false);
 await page.emulateMedia({reducedMotion:'no-preference'});
 // In-app switch has the same result, including ::after animations.
 await page.evaluate(()=>{S().look.anim=false;applySettings();modal('<h2>Анимации выключены</h2>');});
 assert.equal(await page.evaluate(()=>animOn()),false);assert.equal((await animationOf('#modalBox')).name,'none');
 assert.equal(await page.evaluate(()=>localStorage.getItem('pulse.motion')),'off');await page.evaluate(()=>closeModal());
 await page.evaluate(()=>{S().look.anim=true;applySettings();});assert.equal(await page.evaluate(()=>animOn()),true);
 assert.deepEqual(errors,[]);
 await browser.close();server.close();console.log('Motion UI passed: mid-frame interpolation, exits, rapid reopen, 8-row cap, Full/Clean, 390/980/1366, live reduced motion, disabled motion');process.exit(0);
})().catch(e=>{console.error(e);server.close();process.exit(1)});
