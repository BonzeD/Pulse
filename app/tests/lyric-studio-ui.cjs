// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const fixture=path.join(out,'lyric-studio-qa.wav');{const rate=22050,n=rate*30,b=Buffer.alloc(44+n*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);for(let i=0;i<n;i++)b.writeInt16LE(Math.round(10000*Math.sin(2*Math.PI*220*i/rate)),44+i*2);fs.writeFileSync(fixture,b);}
const server=http.createServer((req,res)=>{if(req.url==='/qa.wav'){const file=fixture,size=fs.statSync(file).size;res.setHeader('Content-Type','audio/wav');res.setHeader('Accept-Ranges','bytes');const m=/bytes=(\d+)-(\d*)/.exec(req.headers.range||'');if(m){const start=+m[1],end=m[2]?+m[2]:size-1;res.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${size}`,'Content-Length':end-start+1});return fs.createReadStream(file,{start,end}).pipe(res);}res.setHeader('Content-Length',size);return fs.createReadStream(file).pipe(res);}let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8786,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning'&& /GPU fallback|viz gpu|PulseGPU/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8786'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
 let stored=null;await page.exposeFunction('__readLib',()=>stored);await page.exposeFunction('__writeLib',v=>{stored=v;return true;});
 await page.addInitScript(()=>{
   const headings=['Новинки и любимые треки','Из вашей библиотеки','Кавер-версии и ремиксы','Вы давно не слушали','Видеоклипы для вас','Миксы для вас','Плейлисты других пользователей','Playlists Made for You','Recently Played','New Releases for You','Video Game Music','Рекомендуемые станции','Только для тебя, Bon zeD','Похоже на: Casey Edwards','Альбомы с треками, которые тебе нравятся','Soundtrack your Thursday morning','Еще больше открытий: Gareth Coker'];
   const feed={shelves:headings.map((title,j)=>({title,items:[{kind:'album',browseId:'MPRE'+j,title:'Моя песня / Bon zeD / 日本語',sub:'Мой исполнитель / 日本語',art:'/logo.png'}]})),chips:['Заряд энергии','Веселье','Релакс','Тренировки','В дороге','Концентрация','Романтика','Грусть','Сон'].map((title,i)=>({title,params:String(i)}))};
   window.__catalogCalls=[];
   const proxy=prefix=>new Proxy({}, {get(_t,k){return (...args)=>{
     if(String(k).startsWith('on'))return;
     if(k==='getLibrary')return __readLib().then(s=>s||{settings:{look:{splash:false},app:{language:'ja'},perf:{showFps:false},ui:{glass:true,glassOp:60}}});if(k==='saveLibrary'||k==='flushLibrary')return __writeLib(args[0]);
     if(k==='list'||k==='playlists'||k==='downloads'||k==='displays')return Promise.resolve([]);
     if(k==='offlineList')return Promise.resolve({});
     if(k==='status')return Promise.resolve({am:{},sp:{}});
     if(k==='info')return Promise.resolve(null);
     if(k==='version')return Promise.resolve('1.0.0');
     if(k==='lyrics')return Promise.resolve({none:true});
     if(k==='setClient'){window.__catalogLanguage=args[1]?.language;window.__catalogCalls.push(['set',args[0],args[1]?.language]);return Promise.resolve(args[0]);} if(k==='feed'){window.__catalogCalls.push(['feed',window.__catalogLanguage]);return Promise.resolve(feed);}
     if(k==='next')return Promise.resolve({tracks:[]});
     if(k==='resolve')return new Promise(()=>{});
     if(k==='prefetch')return Promise.resolve(true);
     if(k==='openUrl'){window.__opened=(window.__opened||[]).concat(args[0]);return Promise.resolve(true);}if(k==='getGlass')return Promise.resolve({});
     return Promise.resolve({});
   };}});
   window.pulse=proxy('');for(const n of ['plugins','account','svc','ytm','spicy','discord','custom','editor','wall','accounts']) Object.defineProperty(window.pulse,n,{value:proxy(n)});
   // replace proxy with explicit nested keys (proxy getter above does not read target).
   const p=proxy('');window.pulse=new Proxy({}, {get(t,k){if(['plugins','account','svc','ytm','spicy','discord','custom','editor','wall','accounts'].includes(k))return proxy(k);return p[k];}});
   localStorage.setItem('pulse.splash','off');
 });
 await page.goto('http://127.0.0.1:8786');await page.waitForFunction(()=>window.PulseGlass&&document.querySelector('.page'));await page.waitForTimeout(900);


 const assert=require('node:assert/strict');
 await page.evaluate(()=>{PulseI18n.setLanguage('ru');lib.queue={tracks:[{id:'abcdefghijk',title:'Hollowed Out',author:'Pulse QA',dur:30}],idx:0};engine='audio';audio.src='/qa.wav';lib.lyrics.abcdefghijk={user:'[00:02.00]<00:02.00>В эту<00:02.90> <00:03.00>ночь<00:03.60> <00:03.80>мы<00:04.10> <00:04.20>остаёмся<00:05.00>\n[00:07.00]И продолжаем наш путь'};updateNow();lyState.id='abcdefghijk';openFix('text');});
 await page.waitForFunction(()=>audio.readyState>=2);assert.equal(await page.evaluate(()=>openLyricStudioFromFix()),true);await page.waitForSelector('.lystudio');
 assert.equal(await page.locator('.ls-line').count(),2);assert.equal(await page.locator('.ls-token').count(),4);
 // Entire action targets are non-draggable, accessible icon buttons.
 const iconAudit=await page.locator('[data-ls]').evaluateAll(nodes=>nodes.map(n=>({action:n.dataset.ls,text:n.textContent.trim(),icon:!!n.querySelector('svg'),label:n.getAttribute('aria-label'),title:n.title,w:n.getBoundingClientRect().width,h:n.getBoundingClientRect().height,drag:getComputedStyle(n).webkitAppRegion})));
 for(const n of iconAudit){assert.equal(n.text,'',n.action);assert.equal(n.icon,true,n.action);assert.ok(n.label&&n.title,n.action);assert.ok(n.w>=44&&n.h>=44,n.action);assert.equal(n.drag,'no-drag',n.action);}
 assert.equal(await page.locator('[data-ls="close"]').getAttribute('aria-label'),'Готово');
 assert.match(await page.locator('[data-ls="stamp"]').getAttribute('title'),/по курсору; затем выбрать следующее/);
 assert.equal(await page.locator('.top').evaluate(n=>getComputedStyle(n).webkitAppRegion),'no-drag');
 // Actual pointer clicks over the label and all sides, with pending field edits.
 for(const [x,y] of [[.08,.5],[.5,.5],[.92,.5],[.5,.08],[.5,.92]]){
   const marker='Проверка'+x+'-'+y;await page.locator('#lsWordText').fill(marker);
   const box=await page.locator('[data-ls="save"]').boundingBox();
   await page.mouse.click(box.x+box.width*x,box.y+box.height*y);await page.waitForTimeout(70);
   assert.ok((await page.evaluate(()=>lib.lyrics.abcdefghijk.user)).includes(marker),'full hitbox '+x+','+y);
 }
 await page.locator('#lsWordText').fill('В эту');await page.keyboard.press('Control+s');await page.evaluate(()=>{fix.tab='text';renderFix();});

 await page.locator('#lsWordStart').fill('2.15');await page.locator('#lsWordStart').press('Tab');await page.waitForTimeout(60);assert.ok((await page.evaluate(()=>fixDrafts.get('abcdefghijk'))).includes('<00:02.15>'));
 await page.locator('[data-ls="undo"]').click();assert.ok((await page.evaluate(()=>fixDrafts.get('abcdefghijk'))).includes('<00:02.00>'));
 await page.locator('[data-ls="redo"]').click();
 // Drag a word and trim its end using actual pointer events.
 const clip=page.locator('[data-clip="1"]');let b=await clip.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+20);await page.mouse.down();await page.mouse.move(b.x+b.width/2+18,b.y+20,{steps:5});await page.mouse.up();assert.notEqual(await page.locator('#lsWordStart').inputValue(),'3.00');
 const beforeEnd=await page.locator('#lsWordEnd').inputValue();b=await page.locator('[data-clip="1"] [data-edge="e"]').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+20);await page.mouse.down();await page.mouse.move(b.x-15,b.y+20,{steps:4});await page.mouse.up();assert.notEqual(await page.locator('#lsWordEnd').inputValue(),beforeEnd);
 // Actual HTMLMediaElement/audio graph: hold at .5x, inspect clock and nonzero PCM analyser.
 await page.evaluate(()=>{audio.currentTime=10;audio.playbackRate=1.25;});await page.locator('#lsLane').focus();await page.keyboard.down('ArrowRight');await page.waitForTimeout(650);
 let audioProbe=await page.evaluate(()=>{const x=new Uint8Array(analyser.fftSize);analyser.getByteTimeDomainData(x);return{rate:audio.playbackRate,time:audio.currentTime,paused:audio.paused,signal:[...x].some(n=>Math.abs(n-128)>2)};});console.log("audio probe",audioProbe);assert.equal(audioProbe.rate,.5);assert.equal(audioProbe.paused,false);assert.ok(audioProbe.time>10.1&&audioProbe.time<11);assert.equal(audioProbe.signal,true);
 await page.keyboard.up('ArrowRight');assert.equal(await page.evaluate(()=>audio.paused),true);assert.equal(await page.evaluate(()=>audio.playbackRate),1.25);
 const backStart=await page.evaluate(()=>audio.currentTime);await page.keyboard.down('ArrowLeft');await page.waitForTimeout(750);await page.keyboard.up('ArrowLeft');assert.ok((await page.evaluate(()=>audio.currentTime))<backStart-.2);assert.equal(await page.evaluate(()=>audio.paused),true);
 // Key editing in a text field must never trigger transport or song shortcuts.
 await page.locator('#lsLineText').focus();const at=await page.evaluate(()=>audio.currentTime);await page.keyboard.press('ArrowRight');await page.keyboard.press('KeyW');assert.equal(await page.evaluate(()=>audio.currentTime),at);await page.locator('#lsLineText').fill('В эту ночь мы остаёмся');await page.locator('#lsLineText').press('Tab');await page.waitForTimeout(50);
 // Bidirectional draft sync, malformed LRC is retained but cannot be saved.
 await page.locator('.ls-lrc summary').click();await page.locator('#lsRaw').fill('[00:02.00]<00:02.00>Я<00:02.40> <00:02.50>здесь<00:03.00>');await page.waitForTimeout(600);assert.equal(await page.locator('.ls-token').count(),2);assert.equal(await page.evaluate(()=>document.querySelector('#fxText').value),await page.locator('#lsRaw').inputValue());
 await page.locator('#lsRaw').fill('[00:02.00]good\nbroken');await page.waitForTimeout(600);assert.ok(await page.locator('.ls-note').isVisible());await page.locator('[data-ls="save"]').click();assert.ok(await page.locator('.ls-note').isVisible());await page.locator('.ls-note').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/lyric-studio-error.png'});
 await page.locator('#lsRaw').fill('[00:02.00]<00:02.00>В эту<00:02.90> <00:03.00>ночь<00:03.60> <00:03.80>мы<00:04.10> <00:04.20>остаёмся<00:05.00>\n[00:07.00]И продолжаем наш путь');await page.waitForTimeout(600);
 await page.locator('[data-ls="save"]').click();assert.ok((await page.evaluate(()=>lib.lyrics.abcdefghijk.user)).includes('<00:03.00>ночь'));
 await page.locator('[data-ls="close"]').click();assert.equal(await page.locator('.lystudio').count(),0);assert.equal(await page.evaluate(()=>fix.tab),'text');
 await page.locator('[data-fx="studio"]').click();await page.locator('[data-ls="add"]').first().click();await page.locator('#lsLineText').fill('Новая строка на таймлайне');await page.locator('#lsLineText').press('Tab');await page.waitForTimeout(60);assert.equal(await page.locator('.ls-line').count(),3);
 await page.evaluate(()=>audio.currentTime=15);await page.locator('[data-ls="stamp"]').click();assert.ok((await page.evaluate(()=>fixDrafts.get('abcdefghijk'))).includes('<00:15.00>Новая'));await page.locator('[data-ls="undo"]').click();
 await page.locator('#lsSpeed').fill('0.75');await page.locator('#lsSpeed').press('Tab');await page.locator('[data-ls="hold-next"]').hover();await page.mouse.down();await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>audio.playbackRate),.75);await page.mouse.up();assert.equal(await page.evaluate(()=>audio.paused),true);await page.locator('#lsSpeed').fill('0.5');await page.locator('#lsSpeed').press('Tab');
 await page.locator('#lsWordStart').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/lyric-studio-word-controls.png'});await page.locator('.ls-work').evaluate(n=>n.scrollTop=0);
 await page.screenshot({path:out+'/lyric-studio-desktop.png'});
 for(const language of ['en','ja','uk','ru']){await page.evaluate(l=>PulseI18n.setLanguage(l),language);await page.waitForTimeout(50);assert.equal(await page.locator('.lystudio h1').innerText(),{en:'Lyrics editor',ja:'歌詞エディター',uk:'Редактор тексту',ru:'Редактор текста'}[language]);assert.equal(await page.locator('#lsLineText').inputValue(),'Новая строка на таймлайне');assert.equal(await page.locator('[data-ls="close"]').getAttribute('aria-label'),{en:'Done',ja:'完了',uk:'Готово',ru:'Готово'}[language]);assert.equal(await page.locator('[data-ls="save"] svg').count(),1);}
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);await page.screenshot({path:out+'/lyric-studio-mobile.png'});assert.equal(await page.evaluate(()=>document.querySelector('.lystudio').scrollWidth>innerWidth),false);
 await page.setViewportSize({width:1366,height:768});await page.evaluate(()=>PulseI18n.setLanguage('ja'));await page.screenshot({path:out+'/lyric-studio-ja.png'});
 // Explicit lyric silence: short gap, raw LRC sync, actual playback renderer, reopen.
 await page.evaluate(()=>{PulseI18n.setLanguage('ru');audio.currentTime=6;});
 await page.locator('[data-ls="add-silence"]').click();assert.equal(await page.locator('.ls-line').count(),4);assert.ok(await page.locator('.ls-silence-note').isVisible());assert.equal(await page.locator('#lsLineText').count(),0);assert.ok((await page.evaluate(()=>fixDrafts.get('abcdefghijk'))).includes('[00:06.00]\n'));
 await page.locator('[data-ls="save"]').click();await page.waitForFunction(()=>lyState.lines.some(l=>l.t===6&&l.gap===1));assert.equal(await page.locator('.ly-gap').filter({has:page.locator('i')}).count()>0,true);
 await page.screenshot({path:out+'/lyric-studio-silence.png'});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/lyric-studio-silence-mobile.png'});assert.equal(await page.evaluate(()=>document.querySelector('.lystudio').scrollWidth>innerWidth),false);
 await page.setViewportSize({width:1366,height:768});await page.locator('[data-ls="close"]').click();assert.ok((await page.locator('#fxText').inputValue()).includes('[00:06.00]\n'));await page.locator('[data-fx="studio"]').click();await page.locator('[data-ls-line="1"]').click();assert.ok(await page.locator('.ls-silence-note').isVisible());
 await page.locator('#lsLineStart').fill('6.25');await page.locator('#lsLineStart').press('Tab');await page.waitForTimeout(50);assert.ok((await page.evaluate(()=>fixDrafts.get('abcdefghijk'))).includes('[00:06.25]\n'));await page.locator('[data-ls="undo"]').click();assert.equal(await page.locator('#lsLineStart').inputValue(),'6.00');
 // Ending, actual renderer, persistence, literal metadata and no timed karaoke spans.
 await page.evaluate(()=>{audio.currentTime=20;});await page.locator('[data-ls="add-ending"]').click();assert.equal(await page.locator('#lsCredits').inputValue(),'');await page.locator('#lsCredits').fill('Текст: Bon zeD & A\nМузыка: <Composer> 日本語');await page.locator('[data-ls="save"]').click();await page.waitForFunction(()=>lyState.lines.some(l=>l.endCredits));assert.equal(await page.locator('.ly-credits .w').count(),0);assert.ok((await page.locator('.ly-credits span').innerText()).includes('<Composer> 日本語'));assert.equal(await page.locator('.ly-credits img').count(),0);
 for(const vis of ['classic','kinetic','stack','immersion']){const html=await page.evaluate(v=>lysBlockHtml(lyState.lines,lyState.lines.length-1,v,{}),vis);assert.ok(html.includes('lys-credits'));assert.ok(!html.includes('class="lw"'));assert.ok(html.includes('&lt;Composer&gt;'));}
 await page.waitForTimeout(400);await page.screenshot({path:out+'/lyric-ending-editor.png'});await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/lyric-ending-mobile.png'});await page.locator('#lsCredits').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/lyric-ending-mobile-form.png'});assert.equal(await page.evaluate(()=>document.querySelector('.lystudio').scrollWidth>innerWidth),false);
 await page.setViewportSize({width:1366,height:768});await page.locator('[data-ls="close"]').click();assert.ok((await page.locator('#fxText').inputValue()).includes('[pulse-end:'));await page.locator('[data-fx="studio"]').click();await page.locator('[data-ls-line]').last().click();assert.ok((await page.locator('#lsCredits').inputValue()).includes('Bon zeD'));
 await page.evaluate(()=>audio.currentTime=22);await page.locator('[data-ls="add-ending"]').click();assert.equal(await page.locator('.ls-line').filter({hasText:'Конец текста'}).count(),1);
 for(const lang of ['ja','en','uk','ru']){await page.evaluate(l=>PulseI18n.setLanguage(l),lang);assert.equal(await page.locator('[data-ls="add-ending"]').getAttribute('aria-label'),{ru:'Конец текста и авторство',en:'Lyrics ending and credits',ja:'歌詞の終了とクレジット',uk:'Кінець тексту та авторство'}[lang]);assert.ok((await page.locator('#lsCredits').inputValue()).includes('日本語'));}
 await page.locator('[data-ls="save"]').click();await page.locator('[data-ls="close"]').click();await page.evaluate(()=>{showLines(parseLRC(lib.lyrics.abcdefghijk.user),'user');audio.currentTime=22;closeFix();lyricsFrame(22);lyResume();});await page.waitForTimeout(600);await page.screenshot({path:out+'/lyric-ending-player.png'});await page.evaluate(()=>{lyY().vis='kinetic';lyStageOpen(true);lyricsFrame(22);lysSync(true);});await page.waitForTimeout(600);assert.ok(await page.locator('#lysMain .lys-credits').isVisible());assert.equal(await page.locator('#lysMain .lys-credits .lw').count(),0);await page.screenshot({path:out+'/lyric-ending-stage.png'});await page.evaluate(()=>{lyStageOpen(false);openFix('text');});await page.locator('[data-fx="studio"]').click();
 // Blur/track-change cleanup, no stuck playback or rate.
 await page.evaluate(()=>audio.playbackRate=1.25);await page.locator('#lsLane').focus();await page.keyboard.down('ArrowRight');await page.waitForTimeout(120);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal(await page.evaluate(()=>audio.paused),true);assert.equal(await page.evaluate(()=>audio.playbackRate),1.25);await page.keyboard.up('ArrowRight');
 await page.evaluate(()=>{lib.queue.tracks[0]={id:'other-song',title:'Other song',dur:20};PX.emit('track');});assert.equal(await page.locator('.lystudio').count(),0);
 await page.evaluate(()=>{PulseI18n.setLanguage('ru');lyState.id='other-song';lyState.lines=[];openFix('text');document.querySelector('#fxText').value='';openLyricStudioFromFix();});await page.screenshot({path:out+'/lyric-studio-empty.png'});assert.equal(await page.locator('.ls-line').count(),0);await page.locator('[data-ls="add"]').first().click();await page.locator('#lsLineText').fill('Сохранить без потери фокуса');await page.keyboard.press('Control+s');assert.ok((await page.evaluate(()=>lib.lyrics['other-song'].user)).includes('Сохранить'));await page.locator('#lsLineText').fill('Черновик после Escape');await page.keyboard.press('Escape');assert.ok((await page.evaluate(()=>fixDrafts.get('other-song'))).includes('Черновик'));await page.locator('[data-fx="studio"]').click();assert.equal(await page.locator('#lsLineText').inputValue(),'Черновик после Escape');await page.locator('[data-ls="close"]').click();
 assert.deepEqual(errors,[]);console.log('PASS lyric studio: model sync, drag/trim, undo/redo, real .5x audio + nonzero analyser, backward slices, rate restoration, text shortcuts, raw errors, save, add line, 4 locales, desktop/mobile, blur and track cleanup.');
 await browser.close();server.close();process.exit(0);
})().catch(e=>{console.error(e);server.close();process.exit(1);});
