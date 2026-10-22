/* The only entry is the corrector's Custom lyrics pane. Keep renderer globals
   in this adapter; the editor/model do not own playback or library state. */
window.openLyricStudioFromFix=function(){
 if(!fixOpen||fix.tab!=='text'||!$('fxText')||!curTrack())return false;
 const track={...curTrack()},id=track.id;let playRevision=0,auditionRate=null;
 const identity=()=>String(curTrack()?.id)+'|'+loadTok+'|'+engine;
 const port={
  identity,time:()=>E.time(),duration:()=>E.dur(),isPlaying:()=>playing,
  snapshot:()=>({identity:identity(),element:audio,rate:audio.playbackRate,pitch:audio.preservesPitch,yt:ready?player:null,ytRate:ready&&player.getPlaybackRate?player.getPlaybackRate():1}),
  setRate(rate){auditionRate=rate;rate=Math.max(.25,Math.min(2,+rate||.5));if(engine==='audio'){audio.playbackRate=rate;audio.preservesPitch=true;return rate;}if(!ready||!player.setPlaybackRate)return false;const rates=player.getAvailablePlaybackRates?.()||[];if(!rates.length)return false;const actual=rates.reduce((a,b)=>Math.abs(b-rate)<Math.abs(a-rate)?b:a);player.setPlaybackRate(actual);return actual;},
  play(){const revision=++playRevision,currentIdentity=identity();E.play();if(auditionRate!=null)port.setRate(auditionRate);if(engine==='audio'){const target=audio;return target.play().then(()=>{if(identity()!==currentIdentity)return;if(playRevision!==revision)target.pause();else if(auditionRate!=null)port.setRate(auditionRate);});}},
  pause(){++playRevision;E.pause();},seek:time=>E.seek(time),
  restore(same,matching){auditionRate=null;++playRevision;if(!matching)return;if(same.element){same.element.playbackRate=same.rate;same.element.preservesPitch=same.pitch;}if(matching&&same.yt&&same.yt===player)try{same.yt.setPlaybackRate(same.ytRate);}catch{} }
 };
 const ended=e=>{if(PulseLyricStudio.active()){e.stopImmediatePropagation();E.pause();}};audio.addEventListener('ended',ended,true);
 const opened=PulseLyricStudio.open({track,duration:E.dur(),raw:$('fxText').value,parse:parseLRCRaw,audio:port,
  onDraft(raw){fixDrafts.set(id,raw);if(curTrack()?.id===id&&$('fxText'))$('fxText').value=raw;},
  onSave(raw){if(curTrack()?.id!==id)return;fix.tab='text';renderFix();$('fxText').value=raw;$('lyFix').querySelector('[data-fx="savetext"]').click();},
  onClose(reason){audio.removeEventListener('ended',ended,true);if(reason!=='track'&&curTrack()?.id===id&&fixOpen){fix.tab='text';renderFix();$('lyFix').querySelector('[data-fx="studio"]')?.focus();}},
  copy:raw=>copyText(raw,'LRC скопирован')
 });if(!opened)audio.removeEventListener('ended',ended,true);return opened;
};
PX.on('track',()=>{if(PulseLyricStudio.active()&&PulseLyricStudio.track()!==curTrack()?.id)PulseLyricStudio.close('track');});
