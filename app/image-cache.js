'use strict';
// Public artwork only. No cookies, local URLs, unrestricted redirects or unbounded bodies.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const HOSTS=['ytimg.com','googleusercontent.com','ggpht.com','mzstatic.com','scdn.co','spotifycdn.com'];
function allowed(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&HOSTS.some(h=>u.hostname===h||u.hostname.endsWith('.'+h));}catch{return false;}}
const inflight=new Map();
async function download(url,fetcher=fetch){
 const signal=AbortSignal.timeout(10000);
 for(let hop=0;hop<4;hop++){
  if(!allowed(url))throw Error('artwork-host');
  const r=await fetcher(url,{redirect:'manual',signal,credentials:'omit',headers:{Accept:'image/avif,image/webp,image/*'}});
  if(r.status>=300&&r.status<400){await r.body?.cancel();url=new URL(r.headers.get('location'),url).href;continue;}
  const mime=(r.headers.get('content-type')||'').split(';')[0];
  if(!r.ok||!/^image\/(jpeg|png|webp|avif|gif)$/.test(mime)||+(r.headers.get('content-length')||0)>8*1024*1024){await r.body?.cancel();throw Error('artwork-response');}
  const reader=r.body.getReader(),chunks=[];let size=0;
  try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>8*1024*1024)throw Error('artwork-size');chunks.push(Buffer.from(value));}}finally{reader.cancel().catch(()=>{});}
  if(size<32)throw Error('artwork-empty');return {body:Buffer.concat(chunks),mime};
 }
 throw Error('artwork-redirects');
}
function create(getDir,{fetcher=fetch}={}){return async function serve(req,res){
 const u=new URL(req.url,'http://artwork.invalid').searchParams.get('u')||'';
 if(!allowed(u)){res.writeHead(400);return res.end();}
 const f=path.join(getDir(),crypto.createHash('sha1').update(u).digest('hex')+'.img');
 try{
  let data;try{data=await fs.promises.readFile(f);}catch{}
  if(!data?.length){
   let job=inflight.get(u);
   if(!job){if(inflight.size>=64){res.writeHead(503,{'Retry-After':'2','Cache-Control':'no-store'});return res.end();}job=download(u,fetcher).then(async x=>{await fs.promises.writeFile(f,x.body).catch(()=>{});return x.body;}).finally(()=>inflight.delete(u));inflight.set(u,job);}
   data=await job;
  }
  // Browser sniffs legacy .img cache. Explicitly never serve active/SVG content.
  const mime=data[0]===0x89?'image/png':data[0]===0xff?'image/jpeg':data.subarray(0,4).toString()==='RIFF'?'image/webp':data.subarray(4,8).toString()==='ftyp'?'image/avif':data.subarray(0,3).toString()==='GIF'?'image/gif':null;
  if(!mime){await fs.promises.unlink(f).catch(()=>{});throw Error('artwork-format');}
  res.writeHead(200,{'Content-Type':mime,'X-Content-Type-Options':'nosniff','Cache-Control':'public,max-age=604800'});res.end(data);
 }catch{if(!res.headersSent)res.writeHead(502,{'Cache-Control':'no-store'});res.end();}
};}
module.exports={allowed,download,create};
