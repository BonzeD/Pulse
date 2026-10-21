/* Pulse file player: local media only. One HTMLMediaElement supplies picture,
   sound, EQ, lyrics clocks and the existing transport — no iframe or second audio. */
window.PulseFileVideo = (() => {
 'use strict';
 let current=null, wanted=false, picture=false, loading=false, converted=false, text='';
 const stage=document.getElementById('stage'),art=document.getElementById('art');
 const note=document.createElement('div');note.className='file-video-note';note.setAttribute('role','status');note.setAttribute('aria-live','polite');stage.append(note);
 const controls=document.createElement('div');controls.className='file-video-controls';
 const play=document.createElement('button');play.type='button';play.className='file-video-toggle';
 const full=document.createElement('button');full.type='button';full.className='file-video-full';full.innerHTML=ico('expand');
 controls.hidden=true;note.hidden=true;controls.append(play,full);art.append(controls);
 controls.addEventListener('keydown',e=>{if(e.code==='Space'||e.code==='Enter')e.stopPropagation();});
 const tr=s=>window.PulseI18n?.t?.(s)||s;
 const valid=()=>current&&current.tok===loadTok&&curTrack()?.id===current.track.id&&lib.mode==='video';
 function render(){
  const visible=!!valid()&&picture;
  art.classList.toggle('file-video',visible);stage.classList.toggle('file-video-loading',!!valid()&&loading);
  for(const deck of decks)deck.classList.toggle('file-video-active',visible&&deck===audio);
  const show=!!valid()&&!!text;note.hidden=!show;note.textContent=show?tr(text):'';
  controls.hidden=!visible;play.innerHTML=ico(playing?'pause':'play');play.setAttribute('aria-label',tr(playing?'Пауза':'Воспроизвести'));full.setAttribute('aria-label',tr('Во весь экран'));
 }
 function reset(){current=null;wanted=false;picture=false;loading=false;converted=false;text='';render();}
 function mount(url,start){
  const request=current,deck=audio;deck.pause();
  deck.addEventListener('loadedmetadata',()=>{if(current!==request||!valid()||deck!==audio)return;if(start>0)deck.currentTime=Math.min(start,Number.isFinite(deck.duration)?Math.max(0,deck.duration-.01):start);if(deck.videoWidth>0)request.hasVideo=true;picture=deck.videoWidth>0;loading=false;text=picture||request.hasVideo?'': 'В этом файле нет видеодорожки — доступно только аудио';setLoading(false);updateMode();},{once:true});
  deck.addEventListener('loadeddata',()=>{if(current!==request||!valid()||deck!==audio)return;if(request.hasVideo&&!deck.videoWidth){recover();return;}picture=deck.videoWidth>0;if(picture){request.hasVideo=true;text='';}updateMode();},{once:true});
  deck.src=url;deck.load();if(wanted)E.play();else setLoading(false);
 }
 async function prepare(convert,start){
  const request=current;if(!request)return;
  loading=true;text=convert?'Подготавливаем совместимую копию видео…':'Открываем видео с устройства…';setLoading(true);render();
  try{
   const r=await pulse.media.playback(request.track.id,convert);
   if(current!==request||!valid())return;if(r?.error)throw Error(r.error);
   request.hasVideo=!!r.hasVideo;loading=false;
   const url=r?.url||fileAudioUrl(request.track);if(!/^\/(media|offline)\//.test(url))throw Error('Invalid local media URL');
   text=r.hasVideo?'':'В этом файле нет видеодорожки — доступно только аудио';mount(url,start);updateMode();
  }catch(e){if(current!==request||!valid())return;loading=false;picture=false;request.hasVideo=false;text='Не удалось открыть видео. Проверь файл или выбери другой формат.';setLoading(false);updateMode();}
 }
 function load(track,autoplay,start,tok){current={track,tok,hasVideo:false};wanted=!!autoplay;picture=false;converted=false;audio.pause();audio.removeAttribute('src');audio.load();prepare(false,start);}
 function recover(){
  if(!valid())return false;
  if(current.hasVideo&&!converted){converted=true;picture=false;prepare(true,E.time());return true;}
  loading=false;picture=false;text='Не удалось открыть видео. Проверь файл или выбери другой формат.';setLoading(false);playing=false;onPlayState();updateMode();return true;
 }
 play.onclick=e=>{e.stopPropagation();toggle();};full.onclick=e=>{e.stopPropagation();pulse.win('fs');};
 for(const deck of decks){deck.addEventListener('click',e=>{if(!valid()||!picture)return;e.stopPropagation();toggle();});for(const event of ['play','pause','playing'])deck.addEventListener(event,render);deck.addEventListener('dblclick',e=>{if(!valid())return;e.stopPropagation();pulse.win('fs');});}
 window.addEventListener('pulse-language',render);
 return {load,reset,recover,render,visible:()=>!!valid()&&picture,active:()=>!!current,pending:()=>!!valid()&&loading,intent:v=>{wanted=!!v;}};
})();
