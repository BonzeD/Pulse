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
     if(k==='getLibrary')return Promise.resolve({settings:{app:{language:'ru'},look:{splash:false},perf:{showFps:false},ui:{panels:true}}});
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

 const assert=require('node:assert/strict');
 const qa = async (name, fn) => {await fn();console.log('PASS',name);};
 const shot=async name=>page.screenshot({path:out+'/ui-fix-'+name+'.png'});
 const recoverBar=async()=>{const v=page.viewportSize();await page.mouse.move(v.width/2,v.height-48);await page.waitForTimeout(280);await page.click('#btnBarShow');};
 await qa('startup',async()=>assert.deepEqual(errors,[]));
 await qa('removed presets and preference migration',async()=>{
  const d=await page.evaluate(()=>{lib.vizStyle='galaxy';updateButtons();return{ids:Viz.STYLES.map(s=>s.id),style:lib.vizStyle,edge:S().viz.edge,buttons:!!$('vizFx')};});
  for(const id of ['galaxy','orbit','orbits','flight'])assert.ok(!d.ids.includes(id));assert.equal(d.style,'ring');assert.equal(d.edge,undefined);assert.equal(d.buttons,true);assert.equal(await page.locator('#vizLySrc').count(),0);
 });
 await qa('real interruptible child animations in sidebar',async()=>{
  await page.click('#btnNav');
  const names=await page.evaluate(()=>[...$('side').querySelectorAll('.nv>svg,.nv>span,.cl-sw>button')].filter(e=>e.getAnimations().length).length);
  assert.ok(names>=8,'icons/labels/service buttons animate, not only shell');
  await page.evaluate(()=>{$('side').getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=160;});});await shot('sidebar-mid');await page.evaluate(()=>{$('side').getAnimations({subtree:true}).forEach(a=>a.play());});
  for(let i=0;i<7;i++){await page.click('#btnNav');await page.waitForTimeout(35);}
  await page.waitForTimeout(400);
  assert.ok(await page.evaluate(()=>[...$('side').querySelectorAll('.nv>svg')].every(e=>getComputedStyle(e).transform==='none')));
  await shot('sidebar-end');
 });
 await qa('real navigation and settings with incomplete account data',async()=>{
  await page.evaluate(()=>account={photo:'/logo.png'});
  await page.click('a[data-go=settings]');await page.waitForSelector('#setQ');
  await page.click('[data-stab=viz]');await page.waitForTimeout(260);assert.ok(await page.locator('#setBody').innerText());
  await page.click('[data-stab=ui]');await page.waitForTimeout(260);
  await page.click('[data-set="ui.setMode"][data-v="all"]');await page.waitForTimeout(280);
  assert.equal(await page.evaluate(()=>S().ui.setMode),'all');
  await page.click('a[data-go=home]');await page.waitForTimeout(260);
  await page.evaluate(()=>account={name:'Pulse QA',photo:'/logo.png'});
  for(const sel of ['a[data-go=settings]','a[data-go=downloads]','a[data-go=home]']){await page.click(sel);await page.waitForTimeout(260);assert.equal(await page.evaluate(()=>route().r),sel.match(/=(\w+)/)[1]);}
 });
 await page.evaluate(()=>{lib.queue={tracks:[{id:'abcdefghijk',title:'Проверка интерфейса',author:'Pulse QA',dur:240,art:'/logo.png'}],idx:0};updateNow();openPP();setMode('visual');setTab('lyrics');});await page.waitForTimeout(500);
 await qa('restored visual effects button works by mouse',async()=>{
  await page.click('#vizFx');await page.waitForTimeout(100);assert.ok(await page.locator('#vizPop.on').isVisible());
  await page.click('#vizFx');assert.equal(await page.locator('#vizPop.on').count(),0);
 });
 await qa('overscan preserves stage geometry and coverless artwork is hidden',async()=>{
  const result=await page.evaluate(()=>{
   window.frameQA=null;Viz.register({id:'qa-viewport',cover:'hide',draw(g){const m=g.ctx.getTransform();window.frameQA={W:g.W,H:g.H,cx:g.cx,cy:g.cy,tx:m.e,ty:m.f,d:m.a};}});
   setViz('qa-viewport');Viz.resize();Viz.draw({mode:'visual',style:'qa-viewport',center:stageCenter(),quality:'high',playing:false,fx:{zoom:0}});
   const st=$('stage').getBoundingClientRect(),c=$('viz').getBoundingClientRect();return {frame:frameQA,st:{x:st.x,y:st.y,w:st.width,h:st.height},cv:{x:c.x,y:c.y},hidden:getComputedStyle($('art')).visibility};
  });const {frame:f,st,cv}=result;assert.ok(Math.abs(f.W-st.w)<1);assert.ok(Math.abs(f.H-st.h)<1);
  assert.ok(Math.abs(cv.x+f.tx/f.d+f.cx-(st.x+st.w/2))<1);assert.ok(Math.abs(cv.y+f.ty/f.d+f.cy-(st.y+st.h*.45))<1);
  assert.equal(result.hidden,'hidden');await page.evaluate(()=>setViz('ring'));
 });
 await qa('panel drag, keyboard, bounds and saved width',async()=>{
  let r=await page.locator('#ppResize').boundingBox();assert.ok(r);
  const before=await page.locator('.pp-side').boundingBox();
  await page.mouse.move(r.x+r.width/2,r.y+100);await page.mouse.down();await page.mouse.move(r.x+130,r.y+100,{steps:12});await page.mouse.up();
  const after=await page.locator('.pp-side').boundingBox();assert.ok(after.width<before.width-80);
  let saved=await page.evaluate(()=>S().ui.playerPanelWidth);assert.ok(saved>=260);
  await page.focus('#ppResize');await page.keyboard.press('ArrowLeft');assert.ok(await page.evaluate(()=>S().ui.playerPanelWidth)>saved);
  await page.keyboard.press('Home');assert.equal(await page.evaluate(()=>S().ui.playerPanelWidth),0);
 });
 await qa('fixed fade, overflow and layering',async()=>{
  const v=await page.evaluate(()=>({mask:getComputedStyle($('viz')).maskImage,overflow:getComputedStyle($('stage')).overflow,pp:getComputedStyle($('pp')).overflow,canvas:$('viz').getBoundingClientRect().top,stage:$('stage').getBoundingClientRect().top,cz:+getComputedStyle($('viz')).zIndex,sz:+getComputedStyle(document.querySelector('.pp-side')).zIndex}));
  assert.match(v.mask,/linear-gradient/);assert.equal(v.overflow,'visible');assert.equal(v.pp,'visible');assert.ok(v.canvas<v.stage-90);assert.ok(v.canvas<=0,'canvas top boundary is outside the visible window');assert.ok(v.cz<v.sz);
 });
 await qa('lyrics layout and reflection styles rolled back',async()=>{
  const v=await page.evaluate(()=>{lyState.lines=[{t:0,text:'Плавный текст',words:[]},{t:8,gap:true,text:''},{t:12,text:'Следующая строка',words:[]}];showLines(lyState.lines);return{scroll:$('lyScroll').getBoundingClientRect().width,lyrics:$('lyrics').getBoundingClientRect().width,contain:getComputedStyle($('lyScroll')).contain};});
  assert.ok(Math.abs(v.scroll-v.lyrics)<1);assert.ok(v.contain.includes('paint'));await shot('visual-and-lyrics');
 });
 await qa('corrector modern dialog, draft, Escape only closes corrector',async()=>{
  await page.evaluate(()=>openFix('text'));await page.fill('#fxText','Черновик строки\nВторая строка');
  await page.click('[data-fx="tab:time"]');await page.click('[data-fx="tab:text"]');assert.equal(await page.inputValue('#fxText'),'Черновик строки\nВторая строка');
  assert.equal(await page.locator('#lyFix').getAttribute('role'),'dialog');
  const b=await page.locator('#lyFix').boundingBox();assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=1366);
  await shot('corrector');await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>fixOpen),false);assert.equal(await page.evaluate(()=>document.body.classList.contains('pp-open')),true);
 });
 await qa('search response races, draft and caret preserved',async()=>{
  await page.evaluate(()=>{window.searchResolvers=[];const original=pulse;window.pulse=new Proxy(original,{get(t,k){return k==='lyricsSearch'?()=>new Promise(r=>searchResolvers.push(r)):t[k];}});openFix('find');});await page.waitForTimeout(60);
  await page.fill('#fxQ','Новый запрос');await page.evaluate(()=>{findLyrics('Новый запрос');});await page.waitForTimeout(20);
  await page.evaluate(()=>searchResolvers[searchResolvers.length-1]([{track:'Новый результат',artist:'QA',synced:'[00:01]test',dur:240}]));await page.waitForTimeout(50);
  await page.evaluate(()=>searchResolvers[0]([{track:'Старый результат',artist:'Old'}]));await page.waitForTimeout(50);
  assert.match(await page.locator('.fx-res').innerText(),/Новый результат/);assert.doesNotMatch(await page.locator('.fx-res').innerText(),/Старый результат/);
  await page.fill('#fxQ','Текст для курсора');await page.locator('#fxQ').evaluate(e=>e.setSelectionRange(4,7));await page.evaluate(()=>renderFix());
  assert.deepEqual(await page.locator('#fxQ').evaluate(e=>[e.selectionStart,e.selectionEnd]),[4,7]);
  await page.evaluate(()=>closeFix());
 });
 await qa('settings focus ring belongs to field container, typing remains stable',async()=>{
  await page.click('#btnPP');await page.waitForTimeout(450);await page.click('a[data-go=settings]');await page.waitForTimeout(400);
  await page.focus('#setQ');await page.keyboard.type('текст',{delay:25});assert.equal(await page.inputValue('#setQ'),'текст');
  const v=await page.locator('#setQ').evaluate(e=>({shadow:getComputedStyle(e).boxShadow,radius:getComputedStyle(e).borderRadius,focus:document.activeElement===e}));assert.equal(v.shadow,'none');assert.equal(v.radius,'0px');assert.equal(v.focus,true);await shot('settings-focus');
  const tabs=await page.evaluate(()=>allTabs());assert.ok(!JSON.stringify(tabs).includes('viz.edge'));assert.ok(!JSON.stringify(tabs.find(t=>t.id==='client')).includes('Чью музыку открывать'));
 });
 await qa('hide / recover bar and Ctrl+Shift+B',async()=>{
  await page.click('#btnBarHide');assert.equal(await page.evaluate(()=>$('bar').inert),true);assert.ok(await page.locator('#btnBarShow').isVisible());
  await recoverBar();assert.equal(await page.evaluate(()=>$('bar').inert),false);
  await page.locator('#btnNav').focus();await page.keyboard.press('Control+Shift+B');assert.equal(await page.evaluate(()=>S().ui.playerBarHidden),true);await recoverBar();
 });
 await qa('lyrics-only: one progress indicator and reflection geometry',async()=>{
  await page.evaluate(()=>{S().ly.vis='classic';S().ly.kRefl=true;S().ly.kRipple=0;S().ly.kBar='on';lyState.lines=[{t:0,text:'Отражение текста',words:[{t:0,s:'Отражение'},{t:1,s:'текста'}]}];lyState.cur=0;lyStageOpen(true);lysRender(0,0);});await page.waitForTimeout(500);
  const v=await page.evaluate(()=>{const art=$('lysArt').getBoundingClientRect(),water=document.querySelector('.lys-cover-water').getBoundingClientRect();return{artWidth:art.width,waterWidth:water.width,artX:art.x,waterX:water.x,progress:getComputedStyle(document.querySelector('.lys-prog')).display,top:parseFloat(getComputedStyle($('lysRefl')).top),margin:parseFloat(getComputedStyle($('lysWater')).marginTop)};});
  assert.ok(Math.abs(v.artWidth-v.waterWidth)<1);assert.ok(Math.abs(v.artX-v.waterX)<1);assert.equal(v.progress,'none');assert.equal(v.top,-32);assert.equal(v.margin,4);await shot('reflection');
  for(const q of ['normal','ultra','glitch']){
   const d=await page.evaluate(q=>{S().ly.kReflQ=q;S().ly.kRipple=75;lysApply();const c=document.querySelector('.lys-cover-mirror');PulseCoverWater.draw(S().ly,0,100000,true);const a=c.toDataURL();PulseCoverWater.draw(S().ly,0,100900,true);return{a,b:c.toDataURL(),phase:c.dataset.phase};},q);
   assert.notEqual(d.a,d.b,'water pixels must really move: '+q);assert.notEqual(d.phase,'static');
  }
  await page.evaluate(()=>{S().ly.kReflQ='simple';S().ly.kRipple=75;lysApply();});
  const still=await page.evaluate(()=>{const c=document.querySelector('.lys-cover-mirror');PulseCoverWater.draw(S().ly,0,101000,true);let a=c.toDataURL();PulseCoverWater.draw(S().ly,0,101900,true);return[a,c.toDataURL()];});assert.equal(still[0],still[1]);
  await page.click('#btnBarHide');assert.notEqual(await page.locator('.lys-prog').evaluate(e=>getComputedStyle(e).display),'none');await recoverBar();
  await page.evaluate(()=>lyStageOpen(false));
 });
 await qa('narrow / fullscreen / Clean boundaries',async()=>{
  for(const variant of ['full','clean'])for(const width of [980,1366]){
   await page.setViewportSize({width,height:768});await page.evaluate(v=>{S().ui.variant=v;applyCustom();openPP();setMode('visual');},variant);await page.waitForTimeout(400);
   const b=await page.locator('#pp').boundingBox();assert.ok(b.x>=-1&&b.x+b.width<=width+1);await shot(variant+'-'+width);await page.evaluate(()=>closePP());
  }
 });
 await qa('Clean sidecar resizing and fullscreen',async()=>{
  await page.evaluate(()=>{S().ui.variant='clean';applyCustom();CleanUI.openPanel('lyrics');});await page.waitForTimeout(400);
  await page.focus('#ppResize');await page.keyboard.press('ArrowLeft');
  const w=await page.locator('#pp').evaluate(e=>e.getBoundingClientRect().width);assert.ok(w>260&&w<=720);
  await page.evaluate(()=>{CleanUI.closePanel(false);S().ui.variant='full';applyCustom();document.body.classList.add('fs');openPP();});await page.waitForTimeout(450);
  const b=await page.locator('#pp').boundingBox();assert.ok(b.x>=0&&b.x+b.width<=1366);await page.evaluate(()=>{closePP();document.body.classList.remove('fs');});
 });
 await qa('reduced motion: no navigation animation',async()=>{
  await page.evaluate(()=>{S().ui.variant='full';applyCustom();});await page.emulateMedia({reducedMotion:'reduce'});await page.click('#btnNav');assert.equal(await page.evaluate(()=>$('side').getAnimations({subtree:true}).filter(a=>a.playState==='running').length),0);
 });
 assert.deepEqual(errors,[]);console.log('UI FIX QA COMPLETE, no runtime errors');await browser.close();server.close();process.exit(0);
})().catch(e=>{console.error(e);server.close();process.exit(1);});
