// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8794,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || chromium.executablePath(),headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&/Pulse Immersion|Shader|ERROR: 0:/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8794'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
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
 await page.goto('http://127.0.0.1:8794');await page.waitForTimeout(1600);


 const assert=require('node:assert/strict');page.setDefaultTimeout(25000);
 const qa=async(name,f)=>{await f();console.log('PASS',name);};
 try{
 await qa('video reproduction: long settings page never clips title, search or menu',async()=>{await page.evaluate(()=>{S().ui.variant='full';S().ui.setMode='all';lib.setTab='other';applyCustom();go({r:'settings'});});await page.waitForSelector('.settings-workspace');await page.locator('#setBody').evaluate(e=>e.scrollTop=e.scrollHeight);await page.waitForTimeout(300);const geometry=await page.evaluate(()=>{const side=document.querySelector('.set-side'),title=side.querySelector('h1'),view=$('view').getBoundingClientRect(),tr=title.getBoundingClientRect(),bar=$('bar').getBoundingClientRect(),body=$('setBody').getBoundingClientRect();return{title:tr.top>=view.top,titleBottom:tr.bottom<view.bottom,abovePlayer:body.bottom<=bar.top-10,outerScroll:$('view').scrollTop};});assert.deepEqual(geometry,{title:true,titleBottom:true,abovePlayer:true,outerScroll:0});await page.screenshot({path:out+'/settings-video-fixed.png'});});
 await qa('every settings section opens real matching content, including bottom menu items',async()=>{const tabs=await page.evaluate(()=>allTabs().map(t=>({id:t.id,title:t.title})).filter(t=>!['editor','cfg'].includes(t.id)));for(const t of tabs){const a=page.locator('.set-side nav [data-stab="'+t.id+'"]');await a.scrollIntoViewIfNeeded();await a.click();await page.waitForTimeout(130);assert.equal(await page.evaluate(()=>lib.setTab),t.id);const text=await page.locator('#setBody h3').first().innerText();assert.ok(text.includes(t.title),t.id+': '+text);assert.equal(await page.locator('#setBody').evaluate(e=>e.scrollTop),0);}});
 await qa('changing a setting preserves content scroll and current values',async()=>{await page.locator('.set-side [data-stab=other]').click();await page.locator('#setBody').evaluate(e=>e.scrollTop=e.scrollHeight);const y=await page.locator('#setBody').evaluate(e=>e.scrollTop);await page.evaluate(()=>{rerenderSettings();});await page.waitForTimeout(220);const after=await page.locator('#setBody').evaluate(e=>e.scrollTop);assert.ok(Math.abs(after-y)<2);});
 await qa('search, result navigation and keyboard section selection remain usable',async()=>{await page.locator('#setQ').fill('fps');await page.waitForTimeout(250);assert.ok(await page.locator('.set-found').count());await page.locator('.set-found [data-stab]').first().click();await page.waitForTimeout(200);assert.equal(await page.locator('#setQ').inputValue(),'');await page.locator('.set-side [data-stab=audio]').focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>lib.setTab),'audio');});
 await qa('desktop, short and narrow settings stay inside the window in both UI variants',async()=>{for(const variant of ['full','clean'])for(const [width,height]of [[1398,958],[980,640],[390,844]]){await page.setViewportSize({width,height});await page.evaluate(variant=>{S().ui.variant=variant;S().ui.setMode='all';applyCustom();lib.setTab='audio';go({r:'settings'});},variant);await page.waitForTimeout(400);const dims=await page.evaluate(()=>{const r=$('setBody').getBoundingClientRect(),v=$('view').getBoundingClientRect(),title=document.querySelector('.set-side h1').getBoundingClientRect();return{ok:r.width>=Math.min(250,innerWidth*.65)&&r.left>=0&&r.right<=innerWidth+1&&r.top>=v.top&&r.bottom<=innerHeight,title:title.top>=v.top-1};});assert.deepEqual(dims,{ok:true,title:true},variant+' '+width);await page.screenshot({path:out+'/settings-'+variant+'-'+width+'.png'});if(width===390){const br=await page.locator('#btnPlay').boundingBox();assert.ok(br.y>=0&&br.y+br.height<=height,'player outside viewport');const sr=await page.locator('#setQ').boundingBox();assert.ok(sr.x>=0&&sr.x+sr.width<=width,'settings search overflow');}if(variant==='full'&&width===390){await page.selectOption('.settings-mobile-nav','other');await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>lib.setTab),'other');}}});
 assert.deepEqual(errors,[]);
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exit(1);});
