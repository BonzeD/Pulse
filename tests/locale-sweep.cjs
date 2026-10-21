// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8761,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || 'chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning'&& /GPU fallback|viz gpu|PulseGPU/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8761'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
 await page.addInitScript(()=>{
   const feed={shelves:[{title:'Тестовые треки',items:Array.from({length:14},(_,i)=>({kind:'song',id:String(i).padStart(11,'a'),title:'Тест переключения '+(i+1),author:'Pulse QA',dur:240,loaded:true}))}],chips:[]};
   const proxy=prefix=>new Proxy({}, {get(_t,k){return (...args)=>{
     if(String(k).startsWith('on'))return;
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
 await page.goto('http://127.0.0.1:8761');await page.waitForTimeout(1600);
 console.log('startup errors',errors);await page.screenshot({path:out+'/home.png'});


 const assertDOM=require('node:assert/strict');
 const switches=await page.evaluate(()=>{const box=document.createElement('div');box.innerHTML='<div class="card"><div class="cs"><span data-i18n-ui>2 трека</span></div><div class="ct">Моя песня</div></div>';document.body.append(box);const vals=[];for(const lang of ['en','ja','ru','en']){PulseI18n.setLanguage(lang,false);PulseI18n.walk(box);vals.push([box.querySelector('.cs').textContent,box.querySelector('.ct').textContent]);}box.remove();return vals;});
 assertDOM.deepEqual(switches,[['2 tracks','Моя песня'],['2 曲','Моя песня'],['2 трека','Моя песня'],['2 tracks','Моя песня']]);
 const results=[];
 for (const lang of ['en','ja']) {
  await page.evaluate(lang=>{S().app.language=lang;PulseI18n.setLanguage(lang);},lang);
  const report=await page.evaluate(()=>{
   const skip='script,style,textarea,pre,code,svg,[contenteditable],[data-i18n-skip],[data-set="app.language"],[data-language-list],#bTitle,#bArtist,#bSub,#lysT,#lysA,#lysMain,#lysRefl,#lysRefl2,.ly-line:not(.pv-ly .ly-line),.kara-line,.tr .tt,.tr .au,.tr .ar,.tr .al,.card .ct,.card .ca,.card .cs,.sl .n,.hi h1,.hi .strap,.dh-now .dh-tx>span:not(.dh-k),.dh-now .dh-tx b,#t,#a,#ll,#lc,#lp,#ln';
   const hits=[]; const inspect=(root,where)=>{PulseI18n.walk(root);const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(n.parentElement.closest(skip))continue;const t=n.nodeValue.trim();if(/[А-Яа-яЁё]/.test(t))hits.push({where,text:t});}for(const el of root.querySelectorAll('[title],[placeholder],[aria-label]')){if(el.closest(skip))continue;for(const a of ['title','placeholder','aria-label']){const t=el.getAttribute(a)||'';if(/[А-Яа-яЁё]/.test(t))hits.push({where,text:t,attribute:a});}}};
   const scratch=document.createElement('div');
   const scanTabs=(state)=>{for(const tb of allTabs()){scratch.innerHTML='<h3>'+esc(tb.title||'')+'</h3><p>'+esc(tb.desc||'')+'</p>'+(tb.full&&typeof tb.html==='function'?tb.html():tb.rows.map(rowHtml).join(''));inspect(scratch,'settings:'+tb.id+':'+state);}};
   const original=JSON.stringify(lib.settings);scanTabs('default');
   function invert(o){for(const k in o){if(typeof o[k]==='boolean')o[k]=!o[k];else if(o[k]&&typeof o[k]==='object'&&!Array.isArray(o[k]))invert(o[k]);}}
   invert(lib.settings);scanTabs('alternate');lib.settings=JSON.parse(original);
   for(const scope of ['widget','wall','discord','ly','viz','app']) {try{scratch.innerHTML=edPanelHtml(scope);inspect(scratch,'editor:'+scope);}catch(e){hits.push({where:'scan-error',text:scope+':'+e.message});}}
   for(const [name,fn] of [['dj',()=>djHtml()],['midi',()=>midiHtml()],['custom-help',()=>czHelpHtml()],['wave',()=>wavePageHtml()]]) {try{scratch.innerHTML=fn();inspect(scratch,name);}catch(e){hits.push({where:'scan-error',text:name+':'+e.message});}}
   for(const [scope,keys] of [...Object.keys(ED).map(scope=>[scope,Object.keys(ED[scope]())])])for(const key of keys){try{edSel[scope]=key;scratch.innerHTML=edPanelHtml(scope);inspect(scratch,'editor:'+scope+':'+key);}catch(e){hits.push({where:'scan-error',text:scope+':'+key+':'+e.message});}}
   S().dj.on=true;scratch.innerHTML=djHtml();inspect(scratch,'dj:enabled');S().dj.on=false;inspect(document.body,'shell');
   return hits;
  });
  results.push({lang,hits:report});
  for (const r of ['home','library','downloads','settings','plugins','keys','about']) {
   await page.evaluate(r=>go({r}),r);await page.waitForTimeout(550);
   const hits=await page.evaluate(()=>{const root=$('page');PulseI18n.walk(root);const skip='script,style,textarea,pre,code,svg,[data-i18n-skip],.tr .tt,.tr .au,.card .ct,.card .ca';const w=document.createTreeWalker(root,4),hits=[];let n;while(n=w.nextNode()){if(n.parentElement.closest(skip))continue;const t=n.nodeValue.trim();if(/[А-Яа-яЁё]/.test(t))hits.push(t);}return [...new Set(hits)];});
   results.push({lang,route:r,hits});
  }
 }
 fs.writeFileSync(path.join(out,'locale-audit.json'),JSON.stringify({results,errors},null,2));
 const assert=require('node:assert/strict');
 for(const r of results)for(const hit of r.hits){const value=typeof hit==='string'?hit:hit.text;assert.match(value,/^Тест переключения [1-5]$/,'Untranslated UI: '+value);}
 assert.deepEqual(errors,[]);
 for(const lang of ['en','ja']) {
  await page.setViewportSize({width:1366,height:768});
  await page.evaluate(lang=>{S().app.language=lang;S().ui.setMode='all';PulseI18n.setLanguage(lang);lib.setTab='about';go({r:'settings'});},lang);
  await page.waitForTimeout(700);await page.screenshot({path:out+'/locale-about-'+lang+'.png'});
  const section=page.locator('#about-thanks');await section.scrollIntoViewIfNeeded();await page.screenshot({path:out+'/locale-credits-'+lang+'.png'});
  if(lang==='en'){let html=await page.content();html=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace('<head>','<head><base href="file://'+root+'/">');fs.writeFileSync(out+'/about-preview.html',html);}
  await page.evaluate(()=>$('view').scrollTop=0);

 }
 await page.setViewportSize({width:980,height:640});await page.screenshot({path:out+'/locale-about-ja-980.png'});
 await page.evaluate(()=>{lib.setTab='app';rerenderSettings();});await page.waitForTimeout(300);await page.screenshot({path:out+'/locale-settings-ja-980.png'});
 await page.setViewportSize({width:1366,height:768});await page.evaluate(()=>{S().dj.on=true;go({r:'dj'});});await page.waitForTimeout(600);await page.screenshot({path:out+'/locale-dj-ja.png'});

 await browser.close();server.close();console.log('Locale sweep complete',results.reduce((n,r)=>n+r.hits.length,0));process.exit(0);
})().catch(e=>{console.error(e);server.close();process.exit(1)});
