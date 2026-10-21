'use strict';
// Never select an incomplete PyInstaller directory: the exe alone cannot run Python.
const fs = require('fs'), path = require('path');
function complete(dir) {
  try {
    const internal=path.join(dir,'_internal');
    return ['yt-dlp.exe','_internal/base_library.zip','_internal/_socket.pyd','_internal/_ssl.pyd'].every(f=>fs.statSync(path.join(dir,f)).size>0)
      && fs.readdirSync(internal).some(f=>/^python3\d+\.dll$/i.test(f)&&fs.statSync(path.join(internal,f)).size>0);
  } catch { return false; }
}
function environment(source=process.env) {
  const env={...source,ELECTRON_RUN_AS_NODE:'1'};
  // A globally installed Python must not override the interpreter bundled with yt-dlp.
  for(const k of Object.keys(env))if(/^PYTHON(?:HOME|PATH|STARTUP|EXECUTABLE|USERBASE)$/i.test(k))delete env[k];
  return env;
}
const psQuote=s=>"'"+String(s).replace(/'/g,"''")+"'";
function probe(exe,spawn=require('child_process').spawn) {
  return new Promise(resolve=>{
    let p,done=false,t;const finish=ok=>{if(done)return;done=true;clearTimeout(t);resolve(ok);};
    try{p=spawn(exe,['--version'],{windowsHide:true,env:environment()});}catch{return finish(false);}
    let output='';p.stdout.on('data',b=>{output=(output+b).slice(-512);});p.stderr.on('data',()=>{});
    p.on('error',()=>finish(false));p.on('close',code=>finish(code===0&&/^\d{4}\.\d{2}\.\d{2}/m.test(output)));
    t=setTimeout(()=>{try{p.kill();}catch{}finish(false);},15000);
  });
}
module.exports={complete,environment,psQuote,probe};
