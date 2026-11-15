'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path'),os=require('os');
const cookie=(extra={})=>({domain:'.youtube.com',path:'/',secure:true,httpOnly:true,name:'SAPISID',value:'synthetic-secret',...extra});
function fixture({legacy=false,delivered=false,dir=fs.mkdtempSync(path.join(os.tmpdir(),'pulse-session-')),initial=[],saved=true,expired=false}={}){
 let cookies=structuredClone(initial),flushes=0,clears=0,response=async()=>({ok:true,status:200,json:async()=>({activeAccountHeaderRenderer:{accountName:{simpleText:'Local Fixture'},accountPhoto:{thumbnails:[{url:'fixture-photo'}]}}})});
 const safeStorage={isEncryptionAvailable:()=>true,encryptString:s=>Buffer.from(s),decryptString:b=>b.toString()};
 if(saved&&!fs.existsSync(path.join(dir,'accounts.json')))fs.writeFileSync(path.join(dir,'accounts.json'),JSON.stringify({active:'saved',list:[{id:'saved',name:'Local Fixture',enc:Buffer.from(JSON.stringify([cookie(expired?{expirationDate:1}:{})])).toString('base64')}]}));
 const session={cookies:{get:async()=>structuredClone(cookies),set:async c=>{cookies=cookies.filter(x=>x.name!==c.name||x.domain!==c.domain);cookies.push({...c});},flushStore:async()=>{flushes++;}},flushStorageData(){},clearStorageData:async()=>{cookies=[];clears++;}};
 const c={require:p=>p==='electron'?{session:{fromPartition:()=>session},safeStorage,app:{getPath:()=>dir}}:p==='./catalog-locale'?{current:()=>({accept:'en',language:'en'})}:p==='./core-safety'?{atomicJSON:(p,o)=>fs.writeFileSync(p,JSON.stringify(o))}:require(p),module:{exports:{}},process,Buffer,console,setTimeout,clearTimeout,setInterval,clearInterval,URL,AbortSignal,fetch:(...a)=>response(...a)};
 let source=fs.readFileSync(path.join(__dirname,'../account.js'),'utf8');if(delivered)source=require('./adaptive-audio-original.cjs')('account.js',source);if(legacy)source=require('./session-stream-original.cjs')('account.js',source);
 vm.runInNewContext(source+'\nthis.verifyLogin=verifyLogin;',c);
 return{api:c.module.exports,verify:()=>c.verifyLogin(),dir,cookies:()=>cookies,flushes:()=>flushes,clears:()=>clears,response:f=>response=f,cleanup:()=>fs.rmSync(dir,{recursive:true,force:true})};
}
module.exports={fixture,cookie};
