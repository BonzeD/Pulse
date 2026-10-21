// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8793,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || chromium.executablePath(),headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&/Pulse Immersion|Shader|ERROR: 0:/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8793'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
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
 await page.goto('http://127.0.0.1:8793');await page.waitForTimeout(1600);


 const assert=require('node:assert/strict');page.setDefaultTimeout(15000);
 try {
 await page.evaluate(()=>{S().ui.variant='full';S().ui.setMode='all';lib.setTab='other';applyCustom();go({r:'settings'});});await page.waitForTimeout(800);
 await page.evaluate(()=>$('view').scrollTop=$('view').scrollHeight);console.log('LAYOUT',JSON.stringify(await page.evaluate(()=>['view','page','setBody'].map(id=>{const e=$(id),r=e.getBoundingClientRect(),c=getComputedStyle(e);return{id,y:r.y,h:r.height,scroll:e.scrollTop,overflow:c.overflow,transform:c.transform};}).concat([...document.querySelectorAll('.set-wrap,.set-side,.set-side .sh-title,.set-side nav')].map(e=>{const r=e.getBoundingClientRect(),c=getComputedStyle(e);return{cl:e.className,y:r.y,h:r.height,scroll:e.scrollTop,overflow:c.overflow,position:c.position,top:c.top,maxHeight:c.maxHeight};})))));await page.screenshot({path:out+'/settings-before.png'});
 for(const tab of ['widget','ui','app','audio','other']){const a=page.locator('.set-side [data-stab="'+tab+'"]');await a.scrollIntoViewIfNeeded();console.log('BEFORE',tab,await page.evaluate(()=>({tab:lib.setTab,route:route(),title:$('setBody')?.querySelector('h3')?.textContent,scroll:$('view').scrollTop})));await a.click();await page.waitForTimeout(300);console.log('AFTER',tab,await page.evaluate(()=>({tab:lib.setTab,route:route(),title:$('setBody')?.querySelector('h3')?.textContent,scroll:$('view').scrollTop})));}
 await page.screenshot({path:out+'/settings-after.png'});console.log('ERRORS',JSON.stringify(errors));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exit(1);});
