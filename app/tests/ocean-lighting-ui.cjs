/* Offline WebGL regression for the Black Sea lighting fix. No audio/account state. */
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../renderer'),out=process.env.PULSE_LIGHTING_ARTIFACTS||path.join(__dirname,'artifacts/ocean-lighting');
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
 const u=req.url.split('?')[0];
 if(u==='/favicon.ico'){res.writeHead(204);return res.end();}
 if(u==='/'){res.setHeader('Content-Type','text/html');return res.end('<style>body{margin:0;background:#02070c}canvas{display:block;width:100vw;height:100vh}</style><canvas></canvas><script src="immersion-scene.js"></script>');}
 const f=path.resolve(root,'.'+decodeURIComponent(u));
 if(!f.startsWith(root+path.sep)||!fs.existsSync(f)){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',({'.js':'text/javascript','.jpg':'image/jpeg','.png':'image/png'})[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:796,height:674}}),errors=[],external=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error'||m.type()==='warning'&&/texture unavailable|GL_INVALID|FRAMEBUFFER|shader error/i.test(m.text()))errors.push(m.text());});
  await page.route('**/*',r=>{if(r.request().url().startsWith(origin+'/'))return r.continue();external.push(r.request().url());return r.abort();});
  await page.goto(origin);
  await page.evaluate(()=>{window.scene=PulseImmersionScene.create(document.querySelector('canvas'));window.options={width:796,height:674,world:1,seed:15,time:7,audioTime:10,energy:0,bass:0,mid:0,treble:0,kick:0,calm:0,reduced:0,high:true,software:false,eco:false,accent:[108/255,230/255,245/255],pointer:{x:0,y:0}};scene.draw(options);});
  await page.waitForLoadState('networkidle');
  const results=[];
  for(const [width,height]of [[796,674],[1366,768],[390,844]]){
   await page.setViewportSize({width,height});
   await page.evaluate(({width,height})=>{Object.assign(options,{width,height,world:1,high:true,eco:false,software:false,pointer:{x:0,y:0}});scene.draw(options);scene.draw(options);},{width,height});
   const centre=await page.screenshot({path:path.join(out,'ocean-centre-'+width+'.png')});
   // Same light, same water time, different view. No track/tint transitions can
   // mask a frame-history or render-target state error in this round trip.
   for(let i=0;i<12;i++)await page.evaluate(i=>{options.pointer={x:Math.sin(i*Math.PI/6),y:Math.cos(i*Math.PI/6)};scene.draw(options);},i);
   if(width===796)for(const [name,x]of [['left',-1],['right',1]]){await page.evaluate(x=>{options.pointer={x,y:0};scene.draw(options);},x);await page.screenshot({path:path.join(out,'ocean-'+name+'.png')});}
   await page.evaluate(()=>{options.pointer={x:0,y:0};scene.draw(options);});
   assert.deepEqual(await page.screenshot(),centre,'returning to the same view must produce the identical frame');
   const data=await page.evaluate(()=>({stats:scene.stats(),glError:scene.gl.getError(),maxSamples:scene.gl.getParameter(scene.gl.MAX_SAMPLES)}));
   assert.equal(data.glError,0);assert.equal(data.stats.sceneSamples,Math.min(4,data.maxSamples));assert.equal(data.stats.width,width);assert.equal(data.stats.height,height);results.push({viewport:{width,height},...data});
  }
  for(const quality of ['balanced','eco','software']){
   const data=await page.evaluate(quality=>{Object.assign(options,{width:1366,height:768,high:false,eco:quality==='eco',software:quality==='software'});scene.draw(options);return{stats:scene.stats(),glError:scene.gl.getError()};},quality);
   assert.equal(data.glError,0);assert.equal(data.stats.quality,quality);results.push(data);
  }
  for(const world of [2,1,2,1]){
   await page.evaluate(world=>{Object.assign(options,{world,width:796,height:674,high:true,eco:false,software:false});scene.draw(options);},world);
   await page.waitForLoadState('networkidle');
   const data=await page.evaluate(()=>{scene.draw(options);return{stats:scene.stats(),glError:scene.gl.getError(),maxSamples:scene.gl.getParameter(scene.gl.MAX_SAMPLES)};});
   assert.equal(data.glError,0);assert.equal(data.stats.sceneSamples,world===1?Math.min(4,data.maxSamples):0);results.push(data);
  }
  await page.evaluate(()=>scene.destroy());
  assert.equal(await page.evaluate(()=>scene.stats().textures),0,'all texture/render target resources released');
  assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({results,errors,external},null,2));
  console.log('PASS offline Black Sea shaders, camera sweeps, identical round trips, 796/1366/390, all quality paths, ocean/orbit MSAA switching and resource cleanup');
 }finally{await browser.close();}
})().then(()=>server.close()).catch(e=>{console.error(e);server.close();process.exitCode=1;});
