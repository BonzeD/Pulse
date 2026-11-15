/* Hidden playback must progress independently of suspended lyrics/visual RAFs. */
(()=>{'use strict';const watchdog=PulsePlaybackWatchdog();
 function poll(){
  const job=iframeJob,hidden=document.hidden||!!window.pulseWinHidden;
  if(!hidden||engine!=='yt'||!job||!audioWanted||!ready||['mapping','waiting'].includes(job.phase)){watchdog.reset();return;}
  let state,position,duration;try{if(!iframeEventMatches(job,{target:player})){watchdog.reset();return;}state=player.getPlayerState();position=player.getCurrentTime();duration=player.getDuration();}catch{return;}
  const action=watchdog.step({hidden,wanted:audioWanted,eligible:true,token:job.tok,started:job.started,state,position,duration},performance.now());
  if(!action||!currentIframeJob(job)||!audioWanted)return;
  if(action==='resume'){window.PulseAudioLog?.event('play',{engine:'embedded',reason:'background-resume'});try{player.playVideo();}catch{}}
  else if(action==='fallback'){window.PulseAudioLog?.event('stalled',{engine:'embedded',reason:'background-stall'});iframeFallback(job,'background-stall');}
  else if(action==='ended'){window.PulseAudioLog?.event('ended',{engine:'embedded',reason:'background-ended'});onEnded();}
 }
 const timer=setInterval(poll,1000);window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
 document.addEventListener('visibilitychange',()=>{watchdog.reset();if(document.hidden)poll();});
 window.addEventListener('pulse-window-visibility',()=>{watchdog.reset();if(window.pulseWinHidden)poll();});
 window.PulseBackgroundPlayback={poll};
})();
