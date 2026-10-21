// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),os=require('os'),tools=require('../media-tools'),{createLocalLibrary}=require('../local-library');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'pulse-local-ui-')),inputs=path.join(tmp,'inputs'),exportsDir=path.join(tmp,'exports');fs.mkdirSync(inputs);fs.mkdirSync(exportsDir);
let model,files,exportNumber=0;
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{if(req.url.startsWith('/media/')){const [id,kind]=req.url.split('?')[0].slice(7).split('/');return model.serve(req,res,id,kind);}let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{
 for(const [ext,codec]of [['wav','pcm_s16le'],['flac','flac'],['m4a','aac']])await tools.run('ffmpeg',['-v','error','-y','-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t','1','-metadata','title=Midnight · Локальный трек','-metadata','artist=Pulse QA','-c:a',codec,path.join(inputs,'track.'+ext)]);
 files=['wav','flac'].map(ext=>path.join(inputs,'track.'+ext));
 model=createLocalLibrary({userData:tmp,resolveDownloaded:id=>id==='download123'?{file:path.join(inputs,'track.m4a'),cover:path.join(__dirname,'fixtures/media-cover.jpg')}:null,getKnown:id=>id==='download123'?{title:'Скачанный трек',author:'Pulse QA'}:null,imageToJpeg:async()=>fs.readFileSync(path.join(__dirname,'fixtures/media-cover.jpg'))});
 await new Promise(r=>server.listen(8760,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || chromium.executablePath(),headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning'&& /GPU fallback|viz gpu|PulseGPU/.test(m.text()))errors.push(m.text());});
 await page.exposeFunction('qaMedia',async(action,...args)=>{try{if(action==='import')return model.importFiles(files);if(action==='pickCover')return model.pickCover(path.join(__dirname,'fixtures/media-cover.jpg'));if(action==='export'){const dest=path.join(exportsDir,'draft-'+(++exportNumber)+'.'+args[1]);return model.exportFile(args[0],args[1],dest,args[2],args[3]);}return model[action](...args);}catch(e){return {error:e.message};}});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8760'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
 await page.addInitScript(()=>{
   const feed={shelves:[{title:'Тестовые треки',items:Array.from({length:14},(_,i)=>({kind:'song',id:String(i).padStart(11,'a'),title:'Тест переключения '+(i+1),author:'Pulse QA',dur:240,loaded:true}))}],chips:[]};
   const proxy=prefix=>new Proxy({}, {get(_t,k){return (...args)=>{
     if(String(k).startsWith('on'))return;
     if(k==='getLibrary')return Promise.resolve({settings:{app:{language:'ru'},look:{splash:false},perf:{showFps:false},ui:{panels:true}}});
     if(k==='list'||k==='playlists'||k==='downloads'||k==='displays')return Promise.resolve([]);
     if(k==='offlineList')return Promise.resolve({download123:{file:'download.m4a'}});
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
   const p=proxy('');window.pulse=new Proxy({}, {get(t,k){if(k==='media')return new Proxy({}, {get:(_t,n)=>n==='onProgress'?()=>()=>{}:(...args)=>window.qaMedia(n,...args)});if(['plugins','account','svc','ytm','spicy','discord','custom','editor','wall','accounts'].includes(k))return proxy(k);return p[k];}});
   localStorage.setItem('pulse.splash','off');
 });
 await page.goto('http://127.0.0.1:8760');await page.waitForTimeout(1600);


 page.setDefaultTimeout(10000);page.on('dialog',d=>d.accept());
 const qa=async(name,fn)=>{await fn();console.log('PASS',name);};
 try{
 await qa('local collection is separate, empty and reachable without account',async()=>{await page.click('[data-local="__local"]');await page.waitForTimeout(400);assert.match(await page.locator('#view').innerText(),/Добавь свою музыку/);assert.equal(await page.evaluate(()=>offlineTracks().length),1);await page.screenshot({path:out+'/local-collection-empty.png'});});
 await qa('native import action integrates real WAV and FLAC into the local playlist',async()=>{await page.locator('[data-media-import]').first().click();await page.waitForSelector('#mediaImportDone');await page.screenshot({path:out+'/local-import-done.png'});await page.click('#mediaImportDone');assert.equal(await page.locator('#view .tr').count(),2);assert.equal(await page.evaluate(()=>MediaLibrary.tracks().length),2);assert.equal(await page.evaluate(()=>offlineTracks().length),1);await page.screenshot({path:out+'/local-collection.png'});});
 await qa('local audio uses its local HTTP range route, never the YouTube resolver',async()=>{await page.evaluate(()=>{const tracks=MediaLibrary.tracks();playList(tracks,0,'Локальные треки');});await page.waitForFunction(()=>audio.currentTime>0.05);assert.equal(await page.evaluate(()=>engine),'audio');assert.match(await page.evaluate(()=>audio.src),/\/media\/local-/);await page.evaluate(()=>E.pause());});
 await page.locator('#view [data-media-edit]').first().click();await page.waitForSelector('#media-title');
 await qa('editor edits all tags, previews artwork and saves without closing',async()=>{await page.fill('#media-title','Ночной маршрут');await page.fill('#media-author','Мой исполнитель');await page.fill('#media-albumName','Домашняя коллекция');await page.fill('#media-year','2026');await page.fill('#media-genre','Electronic');await page.fill('#media-comment','Мой комментарий');await page.click('#mediaPickCover');await page.waitForSelector('#mediaCoverPreview img');await page.locator('.media-editor-body').evaluate(e=>e.scrollTop=0);await page.screenshot({path:out+'/metadata-editor-desktop.png'});await page.click('#mediaSave');await page.waitForFunction(()=>document.getElementById('mediaEditorStatus').textContent.startsWith('Сохранено'));assert.equal(await page.locator('#media-title').inputValue(),'Ночной маршрут');assert.equal(await page.evaluate(()=>curTrack().title),'Ночной маршрут');});
 await qa('export includes unsaved draft and artwork without silently committing it',async()=>{await page.fill('#media-title','Отдельный экспорт');await page.selectOption('#mediaExportFormat','flac');await page.click('#mediaExport');await page.waitForFunction(()=>document.getElementById('mediaEditorStatus').textContent.startsWith('Файл сохранён'));const mm=await import('music-metadata'),r=await mm.parseFile(path.join(exportsDir,'draft-1.flac'));assert.equal(r.common.title,'Отдельный экспорт');assert.ok(r.common.picture?.length);assert.equal(model.list().tracks[0].title,'Ночной маршрут');});
 await qa('reset restores original tags and artwork; editor handles invalid fields',async()=>{await page.click('#mediaReset');await page.waitForFunction(()=>document.getElementById('mediaEditorStatus').textContent==='Исходные метаданные восстановлены');assert.match(await page.locator('#media-title').inputValue(),/Midnight/);await page.fill('#media-year','bad');await page.click('#mediaSave');await page.waitForFunction(()=>document.getElementById('mediaEditorStatus').getAttribute('role')==='alert');await page.screenshot({path:out+'/metadata-editor-error.png'});await page.fill('#media-year','');});
 await qa('editor is usable at 390px and action buttons remain in the viewport',async()=>{await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);const box=await page.locator('#mediaEditor').boundingBox(),save=await page.locator('#mediaSave').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=391);assert.ok(save.y>=0&&save.y+save.height<=844);assert.ok(await page.locator('#mediaEditor').evaluate(e=>e.scrollWidth<=e.clientWidth));await page.screenshot({path:out+'/metadata-editor-mobile.png'});await page.click('#mediaSave');await page.waitForFunction(()=>document.getElementById('mediaEditorStatus').textContent.startsWith('Сохранено'));await page.keyboard.press('Escape');assert.equal(await page.locator('#mediaEditor').isVisible(),false);});
 await page.setViewportSize({width:1366,height:768});
 await qa('downloaded metadata uses the same editor and original reset',async()=>{await page.evaluate(()=>MediaLibrary.open({id:'download123',title:'Скачанный трек',author:'Pulse QA'}));await page.waitForSelector('#media-title');await page.screenshot({path:out+'/metadata-editor-downloaded.png'});assert.equal(await page.locator('.media-eyebrow').last().innerText(),'СКАЧАННЫЙ ТРЕК');await page.fill('#media-title','Новая версия скачанного');await page.click('#mediaSave');await page.waitForFunction(()=>document.getElementById('mediaEditorStatus').textContent.startsWith('Сохранено'));assert.equal(model.list().edited[0].title,'Новая версия скачанного');await page.evaluate(()=>{lib.queue={tracks:[{id:'download123',title:'Старое сетевое название',author:'Старый исполнитель',dur:1}],idx:0};updateNow();});assert.equal(await page.locator('#bTitle').innerText(),'Новая версия скачанного');await page.click('#mediaReset');await page.waitForFunction(()=>document.getElementById('mediaEditorStatus').textContent==='Исходные метаданные восстановлены');assert.equal(await page.locator('#media-title').inputValue(),'Скачанный трек');await page.click('#mediaEditorClose');});
 await qa('reloading restores local collection and keeps edits in the backend catalog',async()=>{await page.reload();await page.waitForTimeout(1400);await page.click('[data-local="__local"]');await page.waitForTimeout(300);assert.equal(await page.locator('#view .tr').count(),2);});
 await qa('Clean mode can open local collection and editor, Escape does not close its page',async()=>{await page.evaluate(()=>{S().ui.variant='clean';settingChanged('ui.variant');go({r:'local',id:'__local'});});await page.waitForTimeout(500);await page.locator('#view .tr').first().hover();await page.locator('#view [data-more]').first().click();await page.getByText('Редактировать метаданные…',{exact:true}).click();await page.waitForSelector('#media-title');await page.screenshot({path:out+'/metadata-editor-clean.png'});await page.keyboard.press('Escape');assert.equal(await page.locator('#mediaEditor').isVisible(),false);assert.equal(await page.evaluate(()=>route().id),'__local');});
 assert.deepEqual(errors,[]);console.log('LOCAL MEDIA UI QA COMPLETE');
 }finally{await browser.close();server.close();fs.rmSync(tmp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);server.close();fs.rmSync(tmp,{recursive:true,force:true});process.exit(1);});
