/* Bounded hidden-player recovery. Pure clock/state machine, no DOM, RAF, network or identity data. */
(function(root,factory){const create=factory();if(typeof module==='object'&&module.exports)module.exports=create;else root.PulsePlaybackWatchdog=create;})(typeof window==='object'?window:globalThis,function(){'use strict';
 return function create(options={}){
  const timeout=options.timeout||10000;let token=null,at=0,position=0,retried=false,finished=false;
  return {reset(){token=null;finished=false;},step(s,now){
   if(!s||!s.hidden||!s.wanted||!s.eligible){token=null;return null;}
   if(s.token!==token){token=s.token;at=now;position=Number(s.position)||0;retried=false;finished=false;}
   if(finished)return null;
   const p=Number(s.position)||0;
   if(s.state===0&&s.started&&s.duration>0&&p>=s.duration-1){finished=true;return 'ended';}
   // A seek (including backwards) is progress, but repeated BUFFERING/PAUSED notifications are not.
   if(Math.abs(p-position)>.04){position=p;at=now;retried=false;return null;}
   if(now-at>=timeout){finished=true;return 'fallback';}
   if(!retried&&now-at>=2000&&(s.state===2||s.state===5||s.state===-1)){retried=true;return 'resume';}
   return null;
  }};
 };
});
