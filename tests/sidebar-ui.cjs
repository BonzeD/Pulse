// 1.0.0: UI smoke test. Needs npm install --no-save playwright and a Chromium executable.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..','renderer');
const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(req.url==='/')p=path.join(root,'index.html');
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>server.listen(8760,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || 'chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1}); const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning'&& /GPU fallback|viz gpu|PulseGPU/.test(m.text()))errors.push(m.text());});
 await page.route('**/*',r=>{if(r.request().url().startsWith('http://127.0.0.1:8760'))return r.continue(); if(r.request().resourceType()==='image')return r.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/logo.png')});return r.fulfill({body:'',contentType:'text/javascript'});});
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
 await page.goto('http://127.0.0.1:8760');await page.waitForTimeout(1600);


 const assert=require('node:assert/strict');
 for(const size of [{width:980,height:640},{width:1366,height:768},{width:1678,height:974}]){
  await page.setViewportSize(size);await page.evaluate(()=>{S().app.client='am';svcSt.am={user:{name:'QA'}};svcLists.am=[{browseId:'testWork',title:'Work Music',sub:'My Library'}];renderSide();});await page.waitForTimeout(300);
  const one=await page.locator('#sideList').evaluate(el=>{const list=el.getBoundingClientRect(),row=el.querySelector('.sl').getBoundingClientRect(),sub=el.querySelector('.s').getBoundingClientRect(),style=getComputedStyle(el);return{list:{y:list.y,bottom:list.bottom,height:list.height},row:{y:row.y,bottom:row.bottom},sub:sub.bottom,margin:style.marginBottom,padding:style.paddingBottom};});console.log('Single Apple Music playlist',size,one);assert.equal(one.margin,'0px');assert.ok(one.row.bottom<=one.list.bottom+1);assert.ok(one.sub<=one.list.bottom+1);await page.screenshot({path:out+'/panel6-sidebar-'+size.width+'.png'});
  await page.evaluate(()=>{svcLists.am=Array.from({length:30},(_,i)=>({browseId:'list'+i,title:'Playlist '+(i+1),sub:'Apple Music'}));renderSide();$('sideList').scrollTop=1e6;});await page.waitForTimeout(200);
  const last=await page.locator('#sideList .sl').last().evaluate(el=>{const r=el.getBoundingClientRect(),l=el.parentElement.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;return{bottom:r.bottom,listBottom:l.bottom,visible:el.contains(document.elementFromPoint(x,y))};});assert.ok(last.bottom<=last.listBottom+1);assert.equal(last.visible,true,'Last playlist must be clickable above floating bar');
 }
 assert.deepEqual(errors,[]);console.log('Sidebar tests passed');await browser.close();server.close();process.exit(0);
})().catch(e=>{console.error(e);server.close();process.exit(1)});
