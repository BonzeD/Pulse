/* Read-only transport observations. This module never changes playback, fetching or auth. */
(()=>{'use strict';const api=pulse.dev;if(!api?.audioEvent)return;let active=false,start=0,load=0,id=null;
 const source=t=>t?.id?.startsWith('am:')?'am':t?.id?.startsWith('sp:')?'sp':t?.id?.startsWith('ad:')?'ad':t?.id?.startsWith('local-')?'local':'yt';
 function event(stage,data={}){if(!active)return;try{api.audioEvent({stage,data:{id:id||curTrack()?.id,load,source:source(curTrack()),engine:engine==='yt'?'embedded':'audio',elapsedMs:performance.now()-start,...data}});}catch{}}
 function enabled(v){active=!!v?.active;if(active){start=performance.now();id=curTrack()?.id;event('capture',{outcome:'start'});}}
 api.onAudioState?.(enabled);Promise.resolve(api.audioState?.()).then(enabled).catch(()=>{});
 for(const name of ['load','play','pause','seek']){const base=E[name];E[name]=function(...args){if(active){if(name==='load'){const previousId=id;load++;id=args[0]?.id;start=performance.now();if(previousId&&previousId!==id)event('load-switch',{id,previousId,reason:'replaced-selection'});}event(name,{...(name==='load'?{id:args[0]?.id,source:source(args[0]),autoplay:!!args[1]}:{}),...(name==='seek'?{position:args[0]}:{})});}return base.apply(this,args);};}
 const names={loadedmetadata:'metadata',loadeddata:'data',canplay:'canplay',playing:'playing',waiting:'waiting',stalled:'stalled',seeking:'seeking',seeked:'seeked',ended:'ended',error:'media-error'};
 for(const deck of decks)for(const [ev,stage]of Object.entries(names))deck.addEventListener(ev,()=>{if(deck!==audio)return;event(stage,{readyState:deck.readyState,networkState:deck.networkState,position:deck.currentTime,duration:deck.duration,code:deck.error?.code});});
 window.PulseAudioLog={event,enabled:()=>active};
})();
