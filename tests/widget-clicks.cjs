// Actual DOM pointer interactions with a stubbed desktop API; not a Windows native hit-test.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'../renderer');
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/chromium',args:['--no-sandbox']});const p=await browser.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('https://**',r=>r.abort());
await p.addInitScript(()=>{window.__calls=[];window.__handlers={};window.pulse={onWidgetVisibility:f=>__handlers.visible=f,onState:f=>__handlers.state=f,onWidgetConfig:f=>__handlers.cfg=f,onLyrics:f=>__handlers.lyrics=f,command:(...a)=>__calls.push(['cmd',...a]),win:(...a)=>__calls.push(['win',...a])};});
await p.goto('http://127.0.0.1:'+server.address().port+'/widget.html');await p.waitForFunction(()=>!!document.querySelector('#play').onclick);let checks=0;
for(const [size,[width,height]] of Object.entries({mini:[320,84],standard:[420,156],large:[460,300]}))for(const lock of [false,true]){
 await p.setViewportSize({width,height});await p.evaluate(({size,lock})=>{__handlers.cfg({size,lock,theme:'glass',extra:true,vol:true,ctlScale:100});__handlers.state({has:true,id:'test',title:'Widget interaction test',author:'Pulse',playing:false,cur:42,dur:240,volume:60});},{size,lock});await p.waitForTimeout(100);
 for(const [id,channel,command] of [['play','cmd','toggle'],['next','cmd','next'],['prev','cmd','prev'],['open','win','open'],['edit','win','edit-widget'],['hide','win','widget-hide'],['like','cmd','like'],['dislike','cmd','dislike'],['shuffle','cmd','shuffle'],['repeat','cmd','repeat'],['size','cmd','widgetSize']]){
  const el=p.locator('#'+id);if(!await el.isVisible())continue;await p.mouse.move(width/2,height/2);await el.hover();await p.evaluate(()=>__calls.length=0);await el.click();const calls=await p.evaluate(()=>__calls);assert.equal(calls.length,1,size+': '+id+' fires once');assert.equal(calls[0][0],channel);assert.equal(calls[0][1],command);assert.equal(await el.evaluate(e=>getComputedStyle(e).webkitAppRegion),'no-drag');checks++;
 }
 for(const [id,cmd] of [['bar','seek'],['vbar','volume']]){const el=p.locator('#'+id);if(!await el.isVisible())continue;await p.evaluate(()=>__calls.length=0);await el.click();const c=await p.evaluate(()=>__calls);assert.equal(c.length,1);assert.equal(c[0][1],cmd);assert.ok(Number.isFinite(c[0][2]));checks++;}
 const background=p.locator('.drag-region');assert.equal(await background.evaluate(e=>getComputedStyle(e).webkitAppRegion),lock?'no-drag':'drag');
 assert.equal(await p.locator('#w').evaluate(e=>getComputedStyle(e).webkitAppRegion),lock?'no-drag':'none','container must not subtract the whole background region');
 for(const selector of ['.info','#t','#a']){
  assert.equal(await p.locator(selector).evaluate(e=>getComputedStyle(e).webkitAppRegion),lock?'no-drag':'drag');checks++;
 }
 if(!lock){const hit=await p.locator('#t').evaluate(e=>{const r=e.getBoundingClientRect();return getComputedStyle(document.elementFromPoint(r.x+Math.min(4,r.width/2),r.y+r.height/2)).webkitAppRegion;});assert.equal(hit,'drag','visible title must be an actual drag hit target');checks++;}

}
// Changes from the layout editor must not turn nested icons back into drag regions.
await p.setViewportSize({width:420,height:156});for(const ctlScale of [70,150]){await p.evaluate(ctlScale=>__handlers.cfg({size:'standard',ctlScale,cover:false,free:{standard:{play:{x:8,y:0,s:110}}}}),ctlScale);await p.waitForTimeout(100);await p.evaluate(()=>__calls.length=0);await p.locator('#play svg').click();assert.equal((await p.evaluate(()=>__calls))[0][1],'toggle');assert.equal(await p.locator('#play svg path').first().evaluate(e=>getComputedStyle(e).webkitAppRegion),'no-drag');checks++;}

// Embedded editor preview must never move the native window, even over text.
await p.goto('http://127.0.0.1:'+server.address().port+'/widget.html?pv=1');await p.waitForFunction(()=>!!document.querySelector('#play').onclick);
await p.evaluate(()=>__handlers.cfg({size:'standard',lock:false}));
for(const selector of ['#w','.drag-region','.info','#t','#a','.lyr']){assert.equal(await p.locator(selector).evaluate(e=>getComputedStyle(e).webkitAppRegion),'no-drag');checks++;}
await p.goto('http://127.0.0.1:'+server.address().port+'/widget.html');await p.waitForFunction(()=>!!document.querySelector('#play').onclick);
await p.evaluate(()=>{__handlers.cfg({size:'standard',motion:true});__handlers.visible(true);for(const a of $('w').getAnimations()){a.pause();a.currentTime=110;}});assert.ok(await p.locator('#w').evaluate(e=>{const o=+getComputedStyle(e).opacity;return o>0&&o<1;}));checks++;
await p.evaluate(()=>__handlers.visible(false));await p.waitForTimeout(0);assert.equal(await p.evaluate(()=>PulseMotion.stats().running),0);checks++;
await p.evaluate(()=>{__handlers.cfg({size:'standard',motion:false});__handlers.visible(true);});assert.equal(await p.locator('#w').evaluate(e=>e.getAnimations().length),0);checks++;
await p.evaluate(()=>__handlers.cfg({size:'standard',motion:true}));await p.emulateMedia({reducedMotion:'reduce'});await p.evaluate(()=>__handlers.visible(true));assert.equal(await p.locator('#w').evaluate(e=>e.getAnimations().length),0);checks++;
assert.deepEqual(errors,[]);fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});await p.screenshot({path:path.join(__dirname,'artifacts/widget-clicks.png'),omitBackground:true});await browser.close();await new Promise(r=>server.close(r));console.log('Passed',checks,'widget pointer/command checks across 3 sizes, lock states and scaled controls. Windows native hit testing remains unverified.');process.exit(0);
})().catch(e=>{console.error(e);server.close();process.exit(1)});
