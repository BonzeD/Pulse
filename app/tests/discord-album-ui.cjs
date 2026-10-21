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


 const assert=require('node:assert/strict');page.setDefaultTimeout(10000);
 const qa=async(name,fn)=>{await fn();console.log('PASS',name);};
 try {

 const fixture=()=>page.evaluate(()=>{lib.queue={tracks:[{id:'qaDiscord',title:'Solitude',author:'juno, blindheart',album:{name:'Solitude'},art:'logo.png',dur:240}],idx:0};playing=true;Object.assign(S().discord,{on:true,cover:true,album:true,privacy:false,artist:true,title:true,paused:'show',tplImg:'{album}'});czPart('discord');});
 await qa('album line selects its own settings and hides without losing cover',async()=>{await fixture();await page.waitForTimeout(450);await page.locator('#czStage [data-ed="album"]').click();assert.equal(await page.evaluate(()=>edSel.discord),'album');assert.match(await page.locator('#czDock').innerText(),/Показывать подпись/);await page.screenshot({path:out+'/discord-album-selected.png'});await page.locator('#czDock [data-tg="discord.album"]').click();await page.waitForTimeout(800);assert.equal(await page.evaluate(()=>S().discord.album),false);assert.equal(await page.evaluate(()=>S().discord.cover),true);assert.equal(await page.locator('#czStage [data-ed="album"]').count(),0);assert.equal(await page.locator('#czStage .dc-art:not(.none)').count(),1);assert.equal(await page.evaluate(()=>discordActivity().assets.large_text),undefined);assert.ok(await page.evaluate(()=>discordActivity().assets.large_image));await page.screenshot({path:out+'/discord-album-hidden.png'});});
 await qa('hidden album layer can be restored by eye and toggled with undo/redo',async()=>{await page.locator('#czDock [data-czpeye="album"]').click();await page.waitForTimeout(800);assert.equal(await page.evaluate(()=>S().discord.album),true);assert.equal(await page.locator('#czStage [data-ed="album"]').count(),1);await page.locator('#czDock [data-cz="undo"]').click();assert.equal(await page.evaluate(()=>S().discord.album),false);await page.locator('#czDock [data-cz="redo"]').click();assert.equal(await page.evaluate(()=>S().discord.album),true);});
 await qa('cover and album have independent settings; template changes affect only caption',async()=>{await page.locator('#czDock [data-czpeye="img"]').click();await page.waitForTimeout(450);assert.equal(await page.evaluate(()=>S().discord.cover),false);assert.equal(await page.evaluate(()=>S().discord.album),true);await page.locator('#czDock [data-czpeye="img"]').click();await page.waitForTimeout(450);if(await page.evaluate(()=>edSel.discord)!=='album')await page.locator('#czDock [data-edpick="discord:album"]').click();const input=page.locator('#czDock [data-txt="discord.tplImg"]');await input.fill('{artist} — {album}');await input.dispatchEvent('change');await page.waitForTimeout(800);assert.equal(await page.evaluate(()=>discordActivity().assets.large_text),'juno, blindheart — Solitude');assert.equal(await page.evaluate(()=>discordActivity().details),'Solitude');await page.locator('#czDock .czd-foot [data-cz="done"]').click();});
 await qa('cancel restores album and cover to the session snapshot',async()=>{await fixture();await page.locator('#czDock [data-czpeye="album"]').click();await page.waitForTimeout(450);page.once('dialog',d=>d.accept());await page.locator('#czDock .czd-foot [data-cz="cancel"]').click();assert.equal(await page.evaluate(()=>S().discord.album),true);assert.equal(await page.evaluate(()=>S().discord.cover),true);});
 await qa('appearance explains its purpose and applies font/menu/player sizes live',async()=>{await page.evaluate(()=>czPart('app'));await page.waitForTimeout(500);assert.match(await page.locator('#czDock').innerText(),/Это не перемещение блоков/);for(const [prop,value,css] of [['ui.fontSize',18,'--uiFs'],['ui.side',300,'--side'],['ui.bar',90,'--bar']]){await page.locator(`#czDock [data-rg="${prop}"]`).evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},value);await page.waitForTimeout(300);assert.equal(await page.evaluate(css=>document.documentElement.style.getPropertyValue(css),css),value+'px');}await page.screenshot({path:out+'/discord-appearance-explained.png'});await page.locator('#czDock [data-sact="cx:cz.part:window"]').click();await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>czE.part),null);assert.equal(await page.evaluate(()=>czE.on),true);await page.evaluate(()=>czExit());});
 assert.deepEqual(errors,[]);
 } finally { await browser.close();server.close(); }
})().catch(e=>{console.error(e);server.close();process.exit(1);});
