// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8774,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || 'chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning'&& /GPU fallback|viz gpu|PulseGPU/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8774'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
 await page.addInitScript(()=>{
   const feed={shelves:[{title:'Тестовые треки',items:Array.from({length:14},(_,i)=>({kind:'song',id:String(i).padStart(11,'a'),title:'Тест переключения '+(i+1),author:'Pulse QA',dur:240,loaded:true}))}],chips:[]};
   const proxy=prefix=>new Proxy({}, {get(_t,k){return (...args)=>{
     if(String(k).startsWith('on'))return;
     if(k==='saveLibrary'){localStorage.setItem('qa.saved',JSON.stringify(args[0]));return;}
     if(k==='getLibrary'&&localStorage.getItem('qa.saved'))return Promise.resolve(JSON.parse(localStorage.getItem('qa.saved')));
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
 await page.goto('http://127.0.0.1:8774');await page.waitForTimeout(1600);



 const assert=require('node:assert/strict');
 await page.evaluate(()=>{S().app.language='ru';PulseI18n.setLanguage('ru');S().ui.variant='clean';settingChanged('ui.variant');go({r:'home'});});await page.waitForTimeout(500);
 assert.equal(await page.locator('.ds-hero').count(),0);assert.equal(await page.locator('#btnNav').isVisible(),false);assert.equal(await page.locator('#btnCleanTools').isVisible(),true);assert.equal(await page.evaluate(()=>document.body.innerText.includes('null')),false);
 await page.screenshot({path:out+'/panel13-clean-home-ru.png'});
 await page.evaluate(()=>{lib.setTab='app';go({r:'settings'});});await page.waitForTimeout(250);
 assert.deepEqual(await page.locator('[data-language-list] option').evaluateAll(es=>es.map(e=>[e.value,e.textContent])),[['en','English'],['ru','Русский'],['ja','日本語']]);
 await page.selectOption('[data-language-list]','ja');await page.waitForTimeout(500);
 assert.equal(await page.evaluate(()=>document.documentElement.lang),'ja');assert.equal(await page.evaluate(()=>PulseI18n.locale()),'ja-JP');assert.equal(await page.evaluate(()=>PulseI18n.t('Настройки')),'設定');
 assert.equal(await page.locator('[data-language-list]').inputValue(),'ja');await page.screenshot({path:out+'/panel13-language-ja.png'});
 const remaining=await page.evaluate(()=>{const a=new Set();for(const tab of allTabs()){lib.setTab=tab.id;rerenderSettings();PulseI18n.walk(document.body);const root=document.getElementById('setBody'),tw=document.createTreeWalker(root,4);let n;while(n=tw.nextNode()){if(n.parentElement.closest('script,style,textarea,pre,code,[data-i18n-skip],[data-language-list]'))continue;if(/[А-Яа-яЁё]/.test(n.nodeValue)&&n.parentElement.getBoundingClientRect().height)a.add(n.nodeValue.trim());}}return [...a];});fs.writeFileSync(out+'/panel13-ja-remaining.json',JSON.stringify(remaining,null,2));console.log('Remaining Cyrillic UI strings:',remaining);
 await page.waitForTimeout(900);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('qa.saved')).settings.app.language),'ja');await page.reload();await page.waitForTimeout(1300);assert.equal(await page.evaluate(()=>document.documentElement.lang),'ja');assert.equal(await page.locator('#btnNav').isVisible(),false);
 await page.evaluate(()=>{lib.queue={tracks:[{id:'qa',title:'Главная',author:'Настройки',dur:240,art:'/logo.png'}],idx:0};updateNow();go({r:'home'});});await page.waitForTimeout(200);assert.equal(await page.locator('#bTitle').innerText(),'Главная');assert.ok((await page.locator('#bSub').innerText()).includes('Настройки'));assert.equal(await page.locator('.ds-hero').count(),0);await page.screenshot({path:out+'/panel13-clean-home-ja.png'});
 await page.evaluate(()=>{S().ui.variant='full';settingChanged('ui.variant');});assert.equal(await page.locator('#btnNav').isVisible(),true);assert.equal(await page.locator('.ds-hero').count(),1);await page.evaluate(()=>{S().ui.variant='clean';settingChanged('ui.variant');});assert.equal(await page.locator('.ds-hero').count(),0);
 await page.evaluate(()=>{lib.setTab='app';go({r:'settings'});});await page.waitForTimeout(250);for(const l of ['en','ru','ja']){await page.selectOption('[data-language-list]',l);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>document.documentElement.lang),l);assert.equal(await page.locator('#bTitle').innerText(),'Главная');}
 for(const size of [{width:980,height:640},{width:1680,height:960}]){await page.setViewportSize(size);await page.waitForTimeout(200);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:out+'/panel13-settings-ja-'+size.width+'.png'});}
 await page.setViewportSize({width:1366,height:768});
 await page.evaluate(()=>{S().app.language='ru';PulseI18n.setLanguage('ru');lib.queue={tracks:[{id:'mrtitle',title:'Solitude',author:'juno, blindheart',dur:240,art:'/logo.png'}],idx:0};playing=true;E.time=()=>10;E.dur=()=>240;S().ly.vis='mineradio';S().ly.mrQuality='eco';S().ly.mrFps=20;S().ly.mrLyrics=true;S().ly.mrShowTitle=true;S().ly.mrKeep=true;lyState.id='mrtitle';lyState.lines=[];lyStageOpen(true);updateNow();});
 await page.waitForFunction(()=>window.mrActive&&mrActive(),{},{timeout:120000});const frame=page.frames().find(f=>f.url().includes('/mineradio/index.html'));await frame.waitForFunction(()=>window.__pulse&&window.currentLyricFallbackText,{},{timeout:120000});
 assert.equal(await frame.evaluate(()=>currentLyricFallbackText()),'Solitude - juno, blindheart');assert.ok(await frame.evaluate(()=>lyricsLines.some(l=>l.fallback)));
 await page.evaluate(()=>mrConsole(true));await page.waitForTimeout(400);await frame.evaluate(()=>__pulse.applyCfg());await frame.locator('[data-fx-tab="lyrics"]').click();await page.waitForTimeout(150);
 assert.equal(await frame.locator('#pulse-track-title-toggle').count(),1);await frame.locator('#pulse-track-title-toggle').click();await page.waitForTimeout(300);
 assert.equal(await page.evaluate(()=>S().ly.mrShowTitle),false);assert.equal(await frame.evaluate(()=>currentLyricFallbackText()),'');assert.equal(await frame.evaluate(()=>lyricsLines.length),0);assert.equal(await frame.evaluate(()=>!!stageLyrics.current),false);assert.equal(await page.evaluate(()=>S().ly.mrLyrics),true);
 await page.screenshot({path:out+'/panel13-mr-title-off-ru.png'});
 await page.evaluate(()=>{lyState.id='mrtitle';lyState.lines=[{t:0,text:'Настройки',words:null},{t:20,text:'Actual lyric'}];});await frame.evaluate(()=>__pulse.syncLyrics(true));assert.equal(await frame.evaluate(()=>lyricsLines[0].text),'Настройки');
 // Even with title off, actual lyrics remain and are not translated.
 await page.evaluate(()=>{S().app.language='ja';settingChanged('app.language');});await page.waitForTimeout(300);assert.equal(await frame.locator('#pulse-track-title-toggle').innerText(),'シーン内の曲名');assert.equal(await frame.evaluate(()=>lyricsLines[0].text),'Настройки');assert.equal(await frame.evaluate(()=>presetMeta[0].name),'アートワーク');
 await page.screenshot({path:out+'/panel13-mr-console-ja.png'});
 await page.evaluate(()=>{S().app.language='en';settingChanged('app.language');});await page.waitForTimeout(150);assert.equal(await frame.locator('#pulse-track-title-toggle').innerText(),'Track title in scene');await page.evaluate(()=>{S().app.language='ru';settingChanged('app.language');});await page.waitForTimeout(150);assert.equal(await frame.locator('#pulse-track-title-toggle').innerText(),'Название трека в сцене');
 // Toggling back restores the fallback; a new song never resurrects a hidden title.
 await frame.locator('#pulse-track-title-toggle').click();await page.evaluate(()=>{lyState.lines=[];});await frame.evaluate(()=>__pulse.syncLyrics(true));assert.equal(await frame.evaluate(()=>lyricsLines[0].text),'Solitude - juno, blindheart');
 await page.evaluate(()=>PulseMR.setShowTitle(false));await page.evaluate(()=>{lib.queue.tracks.push({id:'second',title:'Second',author:'Artist',dur:200,art:'/logo.png'});lib.queue.idx=1;updateNow();});await frame.evaluate(()=>__pulse.syncTrack(true));assert.equal(await frame.evaluate(()=>currentLyricFallbackText()),'');assert.equal(await frame.evaluate(()=>lyricsLines.length),0);
 await page.waitForTimeout(900);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('qa.saved')).settings.ly.mrShowTitle),false);
 await page.evaluate(()=>{lyStageOpen(false);lib.setTab='lyrics';go({r:'settings'});});await page.waitForTimeout(200);
 assert.deepEqual(errors,[]);console.log('Panel13: banner/menu, three-language list, Japanese persistence/metadata, MineRadio title toggle and real lyrics passed');await browser.close();server.close();process.exit(0);
})().catch(e=>{console.error(e);server.close();process.exit(1)});
