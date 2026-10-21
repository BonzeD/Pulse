// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8767,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || 'chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning'&& /GPU fallback|viz gpu|PulseGPU/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8767'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
 await page.addInitScript(()=>{
   const feed={shelves:[{title:'Тестовые треки',items:Array.from({length:14},(_,i)=>({kind:'song',id:String(i).padStart(11,'a'),title:'Тест переключения '+(i+1),author:'Pulse QA',dur:240,loaded:true}))}],chips:[]};
   const proxy=prefix=>new Proxy({}, {get(_t,k){return (...args)=>{
     if(String(k).startsWith('on'))return;
     if(k==='saveLibrary'){localStorage.setItem('qa.clean.saved',JSON.stringify(args[0]));return;}
     if(k==='getLibrary'&&localStorage.getItem('qa.clean.saved'))return Promise.resolve(JSON.parse(localStorage.getItem('qa.clean.saved')));
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
 await page.goto('http://127.0.0.1:8767');await page.waitForTimeout(1600);


 const assert=require('node:assert/strict');
 await page.evaluate(()=>{S().app.language='ru';PulseI18n.setLanguage('ru');S().look.anim=false;S().ui.variant='clean';applySettings();});
 // Empty state and offline status remain explicit.
 await page.locator('#btnCleanActions').click();await page.locator('[data-clean="queue"]').click();assert.equal(await page.locator('body.clean-panel-only').count(),0);assert.ok((await page.locator('#toast').innerText()).includes('Сначала включи песню'));
 await page.evaluate(()=>{$('net').classList.add('off');$('net').textContent='офлайн';});assert.equal(await page.locator('#net').isVisible(),true);
 await page.screenshot({path:out+'/panel12-clean-empty-offline.png'});
 // Advanced disclosures open and stay navigable, including direct settings jumps.
 await page.evaluate(()=>{S().ui.setMode='all';lib.setTab='look';go({r:'settings'});});await page.waitForTimeout(250);
 const count=await page.locator('.clean-settings-group').count();assert.ok(count>0);await page.locator('.clean-settings-group>summary').first().click();assert.equal(await page.locator('.clean-settings-group').first().evaluate(e=>e.open),true);
 await page.locator('.clean-settings-group').first().scrollIntoViewIfNeeded();await page.screenshot({path:out+'/panel12-clean-settings-expanded.png'});
 const target=await page.evaluate(()=>{const row=document.querySelector('.clean-settings-group .set-row .set-l b');const title=PulseI18n.canonical(row.textContent.trim());document.querySelectorAll('details').forEach(d=>d.open=false);dsOpenSetting('look',title);return title;});await page.waitForTimeout(300);
 assert.equal(await page.evaluate(title=>{const b=[...document.querySelectorAll('#setBody .set-row .set-l b')].find(e=>PulseI18n.canonical(e.textContent.trim())===title);return b&&[...function*(e){for(let p=e;p;p=p.parentElement)if(p.tagName==='DETAILS')yield p;}(b)].every(d=>d.open);},target),true);
 await page.evaluate(()=>{S().ui.shell='classic';applyCustom();go({r:'home'});});await page.waitForTimeout(250);assert.equal(await page.locator('#btnCleanActions').isVisible(),true);await page.screenshot({path:out+'/panel12-clean-classic.png'});
 await page.evaluate(()=>{S().ui.shell='panels';applyCustom();document.body.classList.add('mini');});await page.locator('#cleanNavMore>summary').click();await page.screenshot({path:out+'/panel12-clean-mini.png'});assert.equal(await page.locator('#cleanNavMore [data-go="downloads"]').isVisible(),true);
 await page.locator('#cleanPlaylists>summary').click();assert.equal(await page.locator('#btnNewPl').isVisible(),true);await page.locator('#cleanPlaylists>summary').click();await page.locator('#cleanNavMore [data-go="downloads"]').focus();await page.keyboard.press('Enter');await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>route().r),'downloads');
 // Dialog remains usable at a narrow diagnostic viewport; native app min is 980px.
 await page.evaluate(()=>document.body.classList.remove('mini'));await page.setViewportSize({width:390,height:720});await page.evaluate(()=>CleanUI.open('tools'));await page.waitForTimeout(200);
 const r=await page.locator('.clean-dialog').boundingBox();assert.ok(r.x>=0&&r.x+r.width<=390&&r.y>=0&&r.y+r.height<=720);await page.screenshot({path:out+'/panel12-tools-narrow.png'});await page.keyboard.press('Escape');
 assert.deepEqual(errors,[]);console.log('Empty/offline, grouped settings, direct jumps, classic shell, mini navigation and narrow dialog passed');await browser.close();server.close();process.exit(0);
})().catch(e=>{console.error(e);server.close();process.exit(1)});
