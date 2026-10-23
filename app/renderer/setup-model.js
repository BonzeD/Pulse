/* Pure, allow-listed onboarding state. No credentials, profile replacement or IO. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PulseSetupModel=api;})(typeof window==='object'?window:globalThis,()=>{
 'use strict';
 const choices={'app.language':['en','ru','ja','uk'],'app.client':['yt','am','sp','ad'],'app.start':['home','library','downloads'],'app.close':['widget','tray','quit'],'perf.mode':['auto','eco','high'],'perf.fps':[0,30,60,120,144],'perf.dpr':[1,1.5,2],'perf.gpu':[true,false],'perf.bgSlow':[true,false],'perf.autoLite':[true,false],'look.anim':[true,false],'look.splash':[true,false]};
 const presets={balanced:{'perf.mode':'auto','perf.fps':60,'perf.dpr':1.5,'perf.bgSlow':true,'perf.autoLite':true},eco:{'perf.mode':'eco','perf.fps':30,'perf.dpr':1,'perf.bgSlow':true,'perf.autoLite':true},high:{'perf.mode':'high','perf.fps':0,'perf.dpr':2,'perf.bgSlow':true,'perf.autoLite':false}};
 const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
 function classify(saved,failed=false){
  if(failed)return 'unavailable';
  if(saved?.onboarding?.version===1&&['pending','complete','skipped','existing'].includes(saved.onboarding.status))return saved.onboarding.status;
  if(!object(saved))return 'new';
  // Any real pre-existing profile is an upgrade, including reset settings.
  if(Object.keys(saved).some(k=>k!=='onboarding'))return 'existing';
  return 'new';
 }
 function draft(settings){const out={};for(const [p,values]of Object.entries(choices)){const [a,b]=p.split('.'),v=settings?.[a]?.[b];if(values.includes(v))out[p]=v;}return out;}
 function validate(input){const out={};for(const [p,values]of Object.entries(choices))if(values.includes(input?.[p]))out[p]=input[p];return out;}
 function patch(settings,input){const changes=[];for(const [p,v]of Object.entries(validate(input))){const [a,b]=p.split('.');if(object(settings[a])&&settings[a][b]!==v)changes.push({p,before:settings[a][b],value:v});}return changes;}
 return {classify,draft,validate,patch,presets};
});
