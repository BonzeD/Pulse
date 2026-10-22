/* A cancellable audition controller. Reverse = forward-playing short slices at
   progressively earlier positions, NOT fictitious negative playbackRate. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PulseLyricAudition=api;})(typeof window==='object'?window:globalThis,()=>{
 'use strict';
 function create(port,clock={now:()=>performance.now(),set:(f,n)=>setInterval(f,n),clear:id=>clearInterval(id)}){
  let session=null,timer=null,revision=0;
  function stop(options={}){revision++;if(timer!==null)clock.clear(timer);timer=null;const old=session;session=null;if(!old)return;if(port.identity()!==old.id){port.restore(old.snapshot,false);return;}port.pause();if(old.direction<0&&!options.noSeek)port.seek(old.cursor);port.restore(old.snapshot,true);}
  function start(direction,rate){stop();const id=port.identity(),snapshot=port.snapshot();rate=port.setRate(rate);if(!rate){port.restore(snapshot,true);return false;}const rev=++revision;session={id,snapshot,direction,rate,anchor:port.time(),cursor:port.time(),at:clock.now(),sliceAt:clock.now()};
   const play=()=>Promise.resolve(port.play()).catch(()=>{if(rev===revision)stop();});play();
   timer=clock.set(()=>{const s=session;if(!s)return;if(port.identity()!==id){stop({noSeek:true});return;}if(direction<0){s.cursor=Math.max(0,s.anchor-(clock.now()-s.at)/1000*rate);if(clock.now()-s.sliceAt>=220){s.sliceAt=clock.now();port.seek(s.cursor);play();}if(s.cursor<=0)stop();}else if(port.time()>=port.duration()-.02)stop();},30);return rate;
  }
  return{start,stop,get active(){return!!session;},get cursor(){return session?.direction<0?session.cursor:port.time();}};
 }
 return{create};
});
