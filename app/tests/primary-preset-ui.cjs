// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8757,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || 'chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning'&& /GPU fallback|viz gpu|PulseGPU/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8757'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
 await page.addInitScript(()=>{
   const feed={shelves:[{title:'Тестовые треки',items:Array.from({length:14},(_,i)=>({kind:'song',id:String(i).padStart(11,'a'),title:'Тест переключения '+(i+1),author:'Pulse QA',dur:240,loaded:true}))}],chips:[]};
   const proxy=prefix=>new Proxy({}, {get(_t,k){return (...args)=>{
     if(String(k).startsWith('on'))return;
     if(k==='copyText'){window.__copied=args[0];return Promise.resolve(window.__copyFail?{error:'locked'}:{ok:true});}
     if(k==='link')return Promise.resolve(window.__linkFail?null:'https://open.spotify.com/track/abc');
     if(k==='getLibrary')return Promise.resolve(JSON.parse(localStorage.getItem('qa.profile')||'null'));
     if(k==='saveLibrary'){localStorage.setItem('qa.profile',JSON.stringify(args[0]));return;}
     if(k==='flushLibrary'){if(window.__flushFail)return false;localStorage.setItem('qa.profile',JSON.stringify(args[0]));return true;}
     if(k==='relaunch'){window.__relaunches=(window.__relaunches||0)+1;return;}
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
 await page.goto('http://127.0.0.1:8757');await page.waitForTimeout(1600);


 const assert=require('node:assert/strict'),author=JSON.parse(fs.readFileSync(__dirname+'/fixtures/primary-preset.json','utf8'));author.settings.ui.surfaceMaterial='blur';author.settings.ui.glassFx={};author.settings.ui.glassPresets=[];page.setDefaultTimeout(10000);
 const qa=async(name,fn)=>{await fn();console.log('PASS',name);};
 const settings=async()=>{await page.evaluate(()=>{lib.setTab='app';go({r:'settings'});});await page.waitForTimeout(500);await page.locator('details.set-adv').evaluateAll(es=>es.forEach(e=>e.open=true));await page.locator('[data-sact="primary-preset"]').scrollIntoViewIfNeeded();await page.waitForTimeout(800);};
 try {
 await qa('first launch applies the full supplied preset and persists it once',async()=>{
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('qa.profile')||'null')?.settings?.app?.language==='en');
  assert.deepEqual(await page.evaluate(()=>JSON.parse(JSON.stringify(S()))),author.settings);
  for(const k of ['vizStyle','mode','tab','mini'])assert.deepEqual(await page.evaluate(k=>lib[k],k),author[k]);
  assert.equal(await page.locator('body').getAttribute('data-art'),'round');
 });
 await qa('editing settings then reopening does not reapply the author preset',async()=>{
  await page.evaluate(()=>{S().perf.fps=30;S().look.color='#123456';S().app.language='ja';pulse.flushLibrary(lib);});await page.reload();await page.waitForTimeout(1600);assert.equal(await page.evaluate(()=>S().perf.fps),30);assert.equal(await page.evaluate(()=>S().look.color),'#123456');assert.equal(await page.evaluate(()=>S().app.language),'ja');
 });
 await qa('existing profile fallback and sensitive/library data remain intact',async()=>{
  await page.evaluate(()=>{const next={settings:mergeDeep(LEGACY_SETTINGS,{app:{language:'ru'},look:{splash:false},perf:{mode:'eco',fps:30},spicy:{key:'qa-private-key'}}),playlists:[{id:'qa-list',name:'Моя коллекция',tracks:[]}],known:{abcdefghijk:{id:'abcdefghijk',title:'Мой трек'}},lyrics:{abcdefghijk:{user:'[00:00] Мой текст'}},offsets:{abcdefghijk:1.25},cfgs:[{id:'qa-config',name:'Мой конфиг'}],cfgActive:'qa-config',mode:'cover',tab:'next',vizStyle:'ring',mini:false,_m194:1,_m200:1,_m2010:1,lyV:2,noWs:true};localStorage.setItem('qa.profile',JSON.stringify(next));});
  await page.reload();await page.waitForTimeout(1600);assert.equal(await page.evaluate(()=>S().perf.mode),'eco');assert.equal(await page.evaluate(()=>S().perf.fps),30);assert.equal(await page.evaluate(()=>S().look.color),'#ff2d95');assert.equal(await page.evaluate(()=>S().spicy.key),'qa-private-key');
 });
 await qa('active button can be cancelled without changing settings',async()=>{
  await settings();assert.ok(await page.locator('[data-sact="primary-preset"]').isEnabled());page.once('dialog',d=>d.dismiss());await page.locator('[data-sact="primary-preset"]').click();assert.equal(await page.evaluate(()=>window.__relaunches||0),0);assert.equal(await page.evaluate(()=>S().perf.fps),30);
 });
 await qa('save error is shown, prior settings restored, restart cancelled',async()=>{
  await page.evaluate(()=>window.__flushFail=true);page.once('dialog',d=>d.accept());await page.locator('[data-sact="primary-preset"]').click();assert.equal(await page.evaluate(()=>window.__relaunches||0),0);assert.equal(await page.evaluate(()=>S().perf.fps),30);assert.equal(await page.evaluate(()=>window.__pulsePresetApplying),false);assert.match(await page.locator('#toast').innerText(),/Не удалось применить пресет/);await page.evaluate(()=>window.__flushFail=false);
 });
 await qa('real click persists every supplied value before requesting restart',async()=>{
  page.once('dialog',d=>d.accept());await page.locator('[data-sact="primary-preset"]').click();assert.equal(await page.evaluate(()=>window.__relaunches),1);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('qa.profile'))),expected=JSON.parse(JSON.stringify(author.settings));expected.spicy.key='qa-private-key';assert.deepEqual(saved.settings,expected);assert.equal(saved.playlists[0].id,'qa-list');assert.equal(saved.known.abcdefghijk.title,'Мой трек');assert.equal(saved.lyrics.abcdefghijk.user,'[00:00] Мой текст');assert.equal(saved.offsets.abcdefghijk,1.25);assert.equal(saved.cfgs[0].id,'qa-config');assert.equal(saved.cfgActive,null);
 });
 await qa('after restart all authored values and API key persist, including latency and MineRadio quality',async()=>{
  await page.reload();await page.waitForTimeout(1700);const expected=JSON.parse(JSON.stringify(author.settings));expected.spicy.key='qa-private-key';assert.deepEqual(await page.evaluate(()=>JSON.parse(JSON.stringify(S()))),expected);assert.equal(await page.evaluate(()=>S().perf.latency),'playback');assert.equal(await page.evaluate(()=>S().ly.mrQuality),'ultra');assert.equal(await page.evaluate(()=>lib.vizStyle),'wave');await settings();await page.screenshot({path:out+'/primary-preset-desktop.png'});
 });
 await qa('active button and explanatory text fit the supported minimum window, 980x640',async()=>{
  await page.setViewportSize({width:980,height:640});await page.waitForTimeout(1300);await page.locator('[data-sact="primary-preset"]').scrollIntoViewIfNeeded();await page.waitForTimeout(1000);const b=await page.locator('[data-sact="primary-preset"]').boundingBox();assert.ok(b.x>=0&&b.x+b.width<=980&&b.y>=0&&b.y+b.height<=640);await page.screenshot({path:out+'/primary-preset-minimum.png'});
 });
 assert.deepEqual(errors,[]);console.log('AUTHOR PRIMARY PRESET UI COMPLETE');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exit(1);});
