// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');if(req.url==='/qa-art.jpg'){res.setHeader('Content-Type','image/jpeg');fs.createReadStream(path.join(__dirname,'fixtures/water-art.jpg')).pipe(res);return;}
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8764,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || 'chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram|VALIDATE_STATUS/.test(m.text()))errors.push(m.text());});page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning'&& /GPU fallback|viz gpu|PulseGPU/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8764'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
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
 await page.goto('http://127.0.0.1:8764');await page.waitForTimeout(1600);



 const assert=require('node:assert/strict');
 await page.evaluate(()=>{lib.queue={tracks:[{id:'old',title:'Loveless',author:'Zynvx, KREZUS',art:'/qa-art.jpg',dur:240},{id:'new',title:'A Shine Upon Inkwater Marsh',author:'Gareth Coker',art:'/qa-art.jpg',dur:186}],idx:0};playing=true;E.time=()=>5;S().ly.vis='mineradio';S().ly.mrQuality='eco';S().ly.mrFps=20;S().ly.mrLyrics=true;S().ly.mrShelf=false;lyState.id='old';lyState.lines=null;lyStageOpen(true);updateNow();});
 await page.waitForFunction(()=>window.mrActive&&mrActive(),{},{timeout:120000});const frame=page.frames().find(f=>f.url().includes('/mineradio/index.html'));
 await frame.waitForFunction(()=>stageLyrics.currentText==='Loveless - Zynvx, KREZUS',{},{timeout:30000});
 await page.evaluate(()=>{lib.queue.idx=1;updateNow();});
 await frame.waitForFunction(()=>stageLyrics.currentText==='A Shine Upon Inkwater Marsh - Gareth Coker',{},{timeout:20000});
 assert.equal(await frame.evaluate(()=>lyricsLines.some(l=>l.text.includes('Loveless'))),false);console.log('Same null payload across two tracks does not freeze old fallback');
 // A delayed old result is not allowed to own the new track.
 await page.evaluate(()=>{lyState.id='old';lyState.lines=[{t:0,text:'OLD LYRICS MUST NOT APPEAR'}];PX.emit('lyrics',lyState.lines);});await page.waitForTimeout(700);assert.equal(await frame.evaluate(()=>lyricsLines.some(l=>l.text.includes('OLD LYRICS'))),false);
 await page.evaluate(()=>{lyState.id='new';lyState.lines=[{t:0,text:'NEW WORDS',words:[{t:0,s:'NEW'},{t:1,s:'WORDS'}]}];PX.emit('lyrics',lyState.lines);});await frame.waitForFunction(()=>stageLyrics.currentText==='NEW WORDS',{},{timeout:20000});
 // Replacement array retains line index zero: meshes must still be rebuilt.
 await page.evaluate(()=>{lyState.lines=[{t:0,text:'REPLACEMENT WORDS'}];PX.emit('lyrics',lyState.lines);});await frame.waitForFunction(()=>stageLyrics.currentText==='REPLACEMENT WORDS',{},{timeout:20000});
 // Same array, in-place refinement plus explicit event must also refresh.
 await page.evaluate(()=>{lyState.lines[0].text='REFINED WORDS';PX.emit('lyrics',lyState.lines);});await frame.waitForFunction(()=>stageLyrics.currentText==='REFINED WORDS',{},{timeout:20000});
 for(let i=0;i<8;i++){await page.evaluate(i=>{lib.queue.idx=i%2;lyState.id='old';lyState.lines=[{t:0,text:'STALE TRACK PAYLOAD'}];updateNow();PX.emit('lyrics',lyState.lines);},i);await page.waitForTimeout(100);}
 await page.evaluate(()=>{lib.queue.idx=1;lyState.id='new';lyState.lines=null;updateNow();PX.emit('lyrics',null);});await frame.waitForFunction(()=>stageLyrics.currentText==='A Shine Upon Inkwater Marsh - Gareth Coker',{},{timeout:20000});
 assert.equal(await frame.evaluate(()=>stageLyrics.outgoing.some(m=>m.userData&&/Loveless|STALE|REFINED/.test(m.userData.text||''))),false);
 await page.screenshot({path:out+'/panel8-mr-current-track.png'});
 await page.evaluate(()=>{toast('Для этой песни пока нет текста — покажу обложку','lyrics');});await page.waitForTimeout(500);await page.screenshot({path:out+'/panel8-mr-toast.png'});
 console.log('MineRadio lyric ownership / no-lyrics tracks / same-index replacement / in-place update / rapid switch passed',errors);assert.deepEqual(errors,[]);await browser.close();server.close();process.exit(0);
})().catch(e=>{console.error(e);server.close();process.exit(1)});
