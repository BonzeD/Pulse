// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8759,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || 'chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning'&& /GPU fallback|viz gpu|PulseGPU/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8759'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
 await page.addInitScript(()=>{
   const feed={shelves:[{title:'Тестовые треки',items:Array.from({length:14},(_,i)=>({kind:'song',id:String(i).padStart(11,'a'),title:'Тест переключения '+(i+1),author:'Pulse QA',dur:240,loaded:true}))}],chips:[]};
   const proxy=prefix=>new Proxy({}, {get(_t,k){return (...args)=>{
     if(String(k).startsWith('on'))return;
     if(k==='getLibrary')return Promise.resolve({settings:{fun:{cockpit:true},look:{splash:false},perf:{showFps:false},ui:{panels:true}}});
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
 await page.goto('http://127.0.0.1:8759');await page.waitForTimeout(1600);
 console.log('startup errors',errors);await page.screenshot({path:out+'/home.png'});

 const assert=require('node:assert/strict');
 for (const variant of ['full','clean']) for (const lite of [false,true]) {
  await page.setViewportSize({width:1366,height:768});
  await page.evaluate(({variant,lite})=>{
    S().ui.variant=variant;S().ui.shell='panels';S().look.ambAll=true;S().look.glass=true;
    applyCustom();document.body.classList.toggle('perf-lite',lite);document.body.classList.add('amb-all','glass');
    $('ambImg').style.backgroundImage='linear-gradient(135deg,#634a34,#273e47)';$('ambImg').classList.add('on');
    go({r:'settings'});$('view').scrollTop=180;
  },{variant,lite});
  await page.waitForTimeout(700);
  await page.evaluate(()=>{const probe=document.createElement("div");probe.style.height="1800px";probe.className="qaScrollProbe";$("page").append(probe);$("view").scrollTop=180;});await page.waitForTimeout(100);
  const report=await page.evaluate(()=>{const h=document.querySelector('.top'),v=$('view'),s=getComputedStyle(h);return{background:s.backgroundColor,image:s.backgroundImage,filter:s.backdropFilter,viewTop:v.getBoundingClientRect().top,headerBottom:h.getBoundingClientRect().bottom,scrolled:document.body.classList.contains('scrolled')};});
  assert.equal(report.background,'rgba(0, 0, 0, 0)');assert.equal(report.image,'none');assert.equal(report.filter,'none');assert.ok(report.viewTop>=report.headerBottom-1);assert.ok(report.scrolled);
  await page.screenshot({path:out+'/chrome-'+variant+'-'+lite+'.png'});console.log('scroll chrome',variant,lite,report);
  await page.evaluate(()=>{lib.queue={tracks:[{id:'abcdefghijk',title:'Проверка визуализации',author:'Pulse QA',dur:240,art:'/logo.png'}],idx:0};updateNow();openPP();setMode('visual');});
  await page.waitForTimeout(600);
  const stage=await page.evaluate(()=>{const s=getComputedStyle($('pp'));const bg=getComputedStyle($('ppBg'));const buttons=[...document.querySelectorAll('.pp-switch button')].filter(e=>e.getBoundingClientRect().width>0);const box=document.querySelector('.pp-switch').getBoundingClientRect();return{background:s.backgroundColor,duplicate:bg.display,overflows:buttons.filter(e=>{const r=e.getBoundingClientRect();return r.left<box.left-1||r.right>box.right+1}).length};});
  assert.equal(stage.background,'rgba(0, 0, 0, 0)');assert.equal(stage.duplicate,'none');const hiddenContent=await page.evaluate(()=>[...$('view').querySelectorAll('*')].every(e=>getComputedStyle(e).visibility==='hidden'));assert.ok(hiddenContent,'No fixed settings descendants may bleed through the player');assert.equal(stage.overflows,0);const immersive=await page.evaluate(()=>({side:getComputedStyle($('side')).display,playerLeft:$('pp').getBoundingClientRect().left,tabLeft:$('ppSwitch').getBoundingClientRect().left}));assert.equal(immersive.side,'none','Visual player must hide navigation');assert.ok(immersive.playerLeft>=0&&immersive.playerLeft<=12,'No reserved sidebar column in visual mode');assert.ok(immersive.tabLeft>=immersive.playerLeft,'Tabs remain inside visual player');const actions=await page.evaluate(()=>{const a=$('btnFs').getBoundingClientRect(),b=$('btnLyOnly').getBoundingClientRect();return Math.min(a.right,b.right)-Math.max(a.left,b.left)<=0;});assert.ok(actions,'Fullscreen and Lyrics buttons must not overlap');console.log('visual stage',stage);
  await page.screenshot({path:out+'/visual-'+variant+'-'+lite+'.png'});
  // 1.0.0: all three modes hide navigation; only closing the player restores it.
  for(const mode of ['cover','video']){
   await page.evaluate(mode=>setMode(mode),mode);await page.waitForTimeout(450);
   const bounds=await page.evaluate(()=>({side:getComputedStyle($('side')).display,left:$('pp').getBoundingClientRect().left,tabs:[...$('ppSwitch').querySelectorAll('button')].map(b=>b.dataset.mode)}));
   assert.equal(bounds.side,'none','Navigation stays hidden for '+mode);assert.ok(bounds.left>=0&&bounds.left<=12);assert.deepEqual(bounds.tabs,['cover','video','visual']);
   await page.screenshot({path:out+'/immersive-'+mode+'-'+variant+'-'+lite+'.png'});
  }
  await page.evaluate(()=>setMode('visual'));assert.equal(await page.evaluate(()=>getComputedStyle($('side')).display),'none');
  await page.evaluate(()=>closePP());await page.waitForTimeout(500);assert.notEqual(await page.evaluate(()=>getComputedStyle($('side')).display),'none','Navigation restores when visual player closes');await page.waitForTimeout(3500); // Let the intentional video-fallback toast finish before the next visual capture.
 }
 // 1.0.1: both layouts expand at desktop, narrow width and fullscreen without changing saved nav preferences.
 for(const variant of ['full','clean'])for(const width of [980,390]){
  await page.setViewportSize({width,height:640});
  const saved=await page.evaluate(variant=>{S().ui.variant=variant;applyCustom();lib.mini=true;document.body.classList.add('mini');openPP();setMode('visual');return JSON.stringify({side:S().ui.side,mini:lib.mini});},variant);
  await page.waitForTimeout(500);
  const g=await page.evaluate(()=>({side:getComputedStyle($('side')).display,x:$('pp').getBoundingClientRect().left,r:$('pp').getBoundingClientRect().right}));
  assert.equal(g.side,'none');assert.ok(g.x<=12&&g.x>=0&&g.r<=width,'Visual stage spans viewport');
  await page.screenshot({path:out+'/sidebar-visual-'+variant+'-'+width+'.png'});
  if(width===980)for(const mode of ['cover','video']){
   await page.evaluate(mode=>setMode(mode),mode);await page.waitForTimeout(450);
   const b=await page.evaluate(()=>({side:getComputedStyle($('side')).display,x:$('pp').getBoundingClientRect().left,r:$('pp').getBoundingClientRect().right,bar:$('bar').getBoundingClientRect().left}));
   assert.equal(b.side,'none');assert.ok(b.x>=0&&b.x<=12&&b.r<=width);if(variant==='clean')assert.equal(b.bar,20);
   await page.screenshot({path:out+'/immersive-'+mode+'-'+variant+'-980.png'});
   await page.evaluate(()=>document.body.classList.add('fs'));assert.equal(await page.evaluate(()=>$('pp').getBoundingClientRect().left),0);await page.evaluate(()=>document.body.classList.remove('fs'));
  }
  await page.evaluate(()=>setMode('visual'));
  if(variant==='clean'&&width===980){let html=await page.content();html=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace('<head>','<head><base href="file://'+root+'/">');fs.writeFileSync(out+'/visual-preview.html',html);}
  await page.evaluate(()=>document.body.classList.add('fs'));assert.equal(await page.evaluate(()=>$('pp').getBoundingClientRect().left),0);await page.evaluate(()=>document.body.classList.remove('fs'));
  await page.evaluate(()=>closePP());assert.equal(await page.evaluate(()=>JSON.stringify({side:S().ui.side,mini:lib.mini})),saved,'Saved sidebar preferences stay intact');
 }
 await page.setViewportSize({width:1366,height:768});await page.evaluate(()=>{S().ui.variant='full';lib.mini=false;document.body.classList.remove('mini');applyCustom();go({r:'home'});});await page.waitForTimeout(450);await page.screenshot({path:out+'/sidebar-restored.png'});
 // Legacy enabled/disabled flags are inert: no UI, command, global or request remains.
 for(const legacy of [true,false]){
  await page.evaluate(legacy=>{S().fun={cockpit:legacy};applySettings();},legacy);
  const removed=await page.evaluate(()=>({button:!!$('btnCockpit'),root:!!$('cockpit'),open:typeof window.cockpitOpen,settings:JSON.stringify(builtinTabs()),commands:JSON.stringify(typeof window.dsExtraActions==='function'?window.dsExtraActions():[]),resources:performance.getEntriesByType('resource').map(x=>x.name).filter(n=>/cockpit/i.test(n))}));
  assert.equal(removed.button,false);assert.equal(removed.root,false);assert.equal(removed.open,'undefined');assert.doesNotMatch(removed.settings,/кабин|cockpit|data-ck-open/i);assert.doesNotMatch(removed.commands,/кабин|cockpit/i);assert.deepEqual(removed.resources,[]);
 }
 assert.deepEqual(errors,[]);await browser.close();server.close();console.log('Chrome UI scenarios passed');process.exit(0);
})().catch(e=>{console.error(e);server.close();process.exit(1)});
