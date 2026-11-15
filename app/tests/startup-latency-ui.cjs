'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),{fixture}=require('./direct-stream-fixture.cjs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/chromium',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 const results=[];
 try{
  for(const beforeStartup of [true,false]){
   const h=await fixture({beforeStartup,backup:true,backupDelay:20,behavior:[{apiDelay:3500},{apiDelay:3500},{apiDelay:3500}]});
   const page=await browser.newPage();
   try{
    await page.goto(h.origin);
    const started=await page.evaluate(async()=>{
     const audio=document.querySelector('audio'),ctx=new AudioContext(),source=ctx.createMediaElementSource(audio),an=ctx.createAnalyser();
     source.connect(an);an.connect(ctx.destination);await ctx.resume();window.ctx=ctx;window.an=an;
     const start=performance.now();const response=await fetch('/resolve');if(!response.ok)throw Error('resolution failed');
     const playing=new Promise((resolve,reject)=>{
      audio.addEventListener('playing',()=>resolve(performance.now()-start),{once:true});
      audio.addEventListener('error',()=>reject(Error('decode failed')),{once:true});
     });
     audio.src='/stream/abcdefghijk';await audio.play();return await playing;
    });
    await page.waitForFunction(()=>document.querySelector('audio').currentTime>.25);
    const decoded=await page.evaluate(()=>{const a=document.querySelector('audio'),bins=new Uint8Array(an.frequencyBinCount);an.getByteFrequencyData(bins);return {paused:a.paused,error:a.error?.message||null,peak:Math.max(...bins)};});
    assert.equal(decoded.paused,false);assert.equal(decoded.error,null);assert.ok(decoded.peak>0);
    assert.ok(h.api.streams.abcdefghijk.url.includes(beforeStartup?'/cdn/0':'/cdn/3'));
    await page.evaluate(()=>{const a=document.querySelector('audio');a.pause();a.currentTime=1;});
    await page.waitForFunction(()=>Math.abs(document.querySelector('audio').currentTime-1)<.1);
    assert.equal(await page.evaluate(()=>document.querySelector('audio').paused),true);
    results.push({variant:beforeStartup?'original AdaptiveAudio':'startup fix',clickToPlayingMs:Math.round(started),...decoded});
   }finally{await page.close();await h.close();}
  }
  assert.ok(results[1].clickToPlayingMs<results[0].clickToPlayingMs);
  const report={environment:'Linux Chromium; local HTTP fixtures, synthetic 3.5 s player API delay, 20 ms mock backup process, actual WAV decoding; NOT live YouTube or Windows measurements',results};
  fs.mkdirSync(path.join(__dirname,'results'),{recursive:true});fs.writeFileSync(path.join(__dirname,'results/startup-local.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
