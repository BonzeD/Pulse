// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8764,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || 'chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning'&& /GPU fallback|viz gpu|PulseGPU/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8764'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
 await page.addInitScript(()=>{
   if(window.top!==window)return;
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
   localStorage.setItem('pulse.splash','off');localStorage.setItem('pulse.language','ja');
 });
 await page.goto('http://127.0.0.1:8764');await page.waitForTimeout(1600);
 console.log('startup errors',errors);await page.screenshot({path:out+'/home.png'});

 const assert=require('node:assert/strict');
 const frames=await page.evaluate(async()=>{
  PulseI18n.setLanguage('ja',false);
  const root=document.createElement('div');root.id='localeFrameProbe';document.body.append(root);const seen=[];
  for(let i=0;i<20;i++)await new Promise(resolve=>{
   requestAnimationFrame(()=>{root.innerHTML='<button title="Настройки">Настройки</button>';});
   requestAnimationFrame(()=>{seen.push({text:root.textContent,title:root.firstElementChild.title});resolve();});
  });root.remove();return seen;
 });
 console.log('Frame probe:',JSON.stringify(frames));
 assert.ok(frames.every(f=>f.text==='設定'&&f.title==='設定'),'No Russian source text may reach the rendering opportunity');

 // Exercise the real settings click handlers in consecutive rendering opportunities.
 const audit=[];
 for(const lang of ['en','ja']){
  await page.evaluate(lang=>{S().app.language=lang;PulseI18n.setLanguage(lang);S().ui.setMode='all';go({r:'settings'});},lang);await page.waitForTimeout(700);
  await page.evaluate(()=>{
   account={name:'Настройки'};off=Object.fromEntries(Array.from({length:8},(_,i)=>['qa'+i,{title:'Не переводить'}]));
   lib.ytc=Object.fromEntries(Array.from({length:10},(_,i)=>['off'+i,{tracks:[]}]));
   for(const svc of ACC_S)accSet(svc,{active:'active',list:[{id:'active',name:'Настройки',active:true,used:Date.now()},{id:'older',name:'Главная',active:false,used:Date.now()-10000}]});
  });
  const samples=await page.evaluate(async()=>{
   const bad=[];const sections=['app','accounts','sync'];
   for(let i=0;i<45;i++)await new Promise(resolve=>{
    const section=sections[i%sections.length];
    requestAnimationFrame(()=>{for(const svc of ACC_S)accmAtS[svc]=performance.now();document.querySelector('[data-stab="'+section+'"]').click();});
    requestAnimationFrame(()=>{
     const w=document.createTreeWalker($('setBody'),NodeFilter.SHOW_TEXT);let n;
     while(n=w.nextNode()){if(n.parentElement.closest('script,style,svg,[data-i18n-skip],[data-language-list]'))continue;if(/[А-Яа-яЁё]/.test(n.nodeValue))bad.push({section,text:n.nodeValue});}
     for(const el of $('setBody').querySelectorAll('[title],[placeholder],[aria-label]')){if(el.closest('[data-i18n-skip],[data-language-list]'))continue;for(const a of ['title','placeholder','aria-label']){const v=el.getAttribute(a)||'';if(/[А-Яа-яЁё]/.test(v))bad.push({section,attribute:a,text:v});}}
     resolve();
    });
   });return bad;
  });audit.push({lang,renderFrames:45,untranslated:samples});assert.deepEqual(samples,[],'Settings text is localized before paint: '+lang);
  for(const section of ['accounts','sync','app']){
   await page.evaluate(section=>{for(const svc of ACC_S)accmAtS[svc]=performance.now();lib.setTab=section;rerenderSettings();$('view').scrollTop=0;},section);await page.waitForTimeout(280);
   if(section==='app')await page.locator('.toggle[data-tg="perf.gpu"]').scrollIntoViewIfNeeded();
   await page.screenshot({path:out+'/locale-hotfix-'+lang+'-'+section+'.png'});
   if(lang==='ja'&&section==='sync'){let html=await page.content();html=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace('<head>','<head><base href="file://'+root+'/">');fs.writeFileSync(out+'/hotfix-preview.html',html);}
   if(section==='accounts')assert.deepEqual(await page.locator('.acc-card:not(.add)>b').allTextContents(),['Настройки','Главная','Настройки','Главная','Настройки','Главная']);
  }
  // Same observer contract applies to late-attached same-origin documents (widget use).
  const sub=await page.evaluate(async()=>{const f=document.createElement('iframe');document.body.append(f);await new Promise(r=>setTimeout(r,0));const d=f.contentDocument;PulseI18n.attachDocument(d);const e=d.createElement('button');d.body.append(e);return await new Promise(resolve=>{requestAnimationFrame(()=>{e.textContent='Настройки';e.title='Настройки';});requestAnimationFrame(()=>{const value={text:e.textContent,title:e.title};f.remove();resolve(value);});});});
  const expected=lang==='ja'?'設定':'Settings';assert.deepEqual(sub,{text:expected,title:expected});
 }
 await page.evaluate(()=>{PulseI18n.setLanguage('ru');lib.setTab='sync';rerenderSettings();});await page.waitForTimeout(100);assert.ok((await page.locator('#setBody').innerText()).includes('Синхронизировать'));
 assert.deepEqual(errors,[]);fs.writeFileSync(out+'/locale-hotfix-frame-audit.json',JSON.stringify({syntheticFrames:frames.length,audit,errors},null,2));
 console.log('Real repeated-click settings and attached-document localization passed:',JSON.stringify(audit));
 await browser.close();server.close();process.exit(0);
})().catch(e=>{console.error(e);server.close();process.exit(1)});
