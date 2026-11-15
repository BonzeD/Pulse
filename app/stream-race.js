'use strict';
// Hedge slow metadata requests; the first usable URL wins. No audio bytes or quality changes.
function firstAvailable(jobs, {delay=350, signal}={}) {
 return new Promise(resolve=>{
  if(!jobs.length||signal?.aborted)return resolve(null);
  let done=false,left=jobs.length;const timers=[],controllers=jobs.map(()=>new AbortController());
  const finish=value=>{if(done)return;done=true;for(const t of timers)clearTimeout(t);signal?.removeEventListener('abort',abort);for(const c of controllers)c.abort();resolve(value);};
  const abort=()=>finish(null);signal?.addEventListener('abort',abort,{once:true});
  jobs.forEach((job,i)=>{const run=()=>{if(done)return;Promise.resolve().then(()=>job(controllers[i].signal)).then(value=>{if(done)return;if(value)return finish(value);if(!--left)finish(null);},()=>{if(!done&&!--left)finish(null);});};if(i)timers.push(setTimeout(run,i*delay));else run();});
 });
}

// Give direct clients a head start, not an unlimited veto over the backup.
// Both jobs must return a *verified* stream. A failed backup cannot cancel a
// slower working direct client. Hover requests can be promoted without restart.
function hedgedFallback(direct, backup, {delay=1500, signal, canBackup=()=>true}={}) {
 const controllers=[new AbortController(),new AbortController()];
 let settled=false,directDone=false,backupDone=false,backupStarted=false;
 let elapsed=false,timer,backupError,resolve,reject;
 const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
 const finish=(value,error)=>{
  if(settled)return;
  settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);
  for(const c of controllers)c.abort();
  if(error)reject(error);else resolve(value);
 };
 const abort=()=>finish(null,new Error('Audio preparation cancelled'));
 const complete=()=>{
  if(directDone&&backupDone)finish(null,backupError);
 };
 const startBackup=()=>{
  if(settled||backupStarted||!canBackup())return;
  backupStarted=true;clearTimeout(timer);
  Promise.resolve().then(()=>{
   if(settled)return null;
   return backup(controllers[1].signal);
  }).then(value=>{
   if(settled)return;
   backupDone=true;if(value)finish(value);else complete();
  },error=>{
   if(settled)return;
   backupDone=true;backupError=error;complete();
  });
 };
 const promote=()=>{if(elapsed||directDone)startBackup();};
 if(signal?.aborted){abort();return {promise,promote};}
 signal?.addEventListener('abort',abort,{once:true});
 timer=setTimeout(()=>{elapsed=true;startBackup();},delay);
 Promise.resolve().then(()=>{
  if(settled)return null;
  return direct(controllers[0].signal);
 }).then(value=>{
  if(settled)return;
  directDone=true;if(value)return finish(value);
  if(canBackup()){startBackup();complete();}else finish(null);
 },()=>{
  if(settled)return;
  directDone=true;
  if(canBackup()){startBackup();complete();}else finish(null);
 });
 return {promise,promote};
}
module.exports={firstAvailable,hedgedFallback};
