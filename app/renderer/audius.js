'use strict';
// Audius shares Pulse's existing media element, AudioContext, controls and state bus.
(() => {
 const native = t => /^ad:/.test(t?.id || ''), baseLoad = E.load, basePlay = E.play, basePause = E.pause;
 let session=null, seq=0;
 const mappings=()=>lib.audiusSources ||= {};
 const mode=()=>['auto','prefer'].includes(S().app.audioSource)?S().app.audioSource:'current';
 const hasTiming=t=>!!(lib.lyrics[t.id]?.user || lib.lyrics[t.id]?.picked || lib.offsets[t.id] != null || lib.stretch?.[t.id] != null || localStorage.getItem('pulse.lyricStudio.'+encodeURIComponent(t.id)) || typeof fixDrafts !== 'undefined' && fixDrafts.has(t.id));
 function cancel(){if(session){clearTimeout(session.timer);if(session.loaded)audio.removeEventListener('loadedmetadata',session.loaded);pulse.audius.cancel(session.key).catch(()=>{});}session=null;}
 function sourceControl(){
  const track=curTrack(),ad=session?.candidate,disabled=!track||track.id.startsWith('local-')||!!off[track.id];
  return `<button type="button" id="audiusSource" class="btn sm" data-ad-source-open${disabled?' disabled':''}>${ico('music')}<span>${ad||native(track)?'Audius':translateUiText('Текущий источник')}</span></button>`;
 }
 function sourceButton(){
  const el=$('audiusSource');if(!el)return;
  const track=curTrack(),ad=session?.candidate;el.disabled=!track||track.id.startsWith('local-')||!!off[track.id];
  el.innerHTML=ico('music')+`<span>${ad||native(track)?'Audius':translateUiText('Текущий источник')}</span>`;
 }

 function fail(s){
  if(session!==s||s.tok!==loadTok)return;
  clearTimeout(s.timer);setLoading(false);pulse.audius.cancel(s.key).catch(()=>{});
  if(!native(s.track)&&!s.started){session=null;baseLoad.call(E,s.track,s.want,s.start);sourceButton();}
  else{audio.pause();audio.removeAttribute('src');audio.load();session=null;toast('Audius недоступен — попробуй другой трек','alert');sourceButton();}
 }
 E.play=function(){if(session){session.want=true;if(session.pending)return;}return basePlay();};
 E.pause=function(){if(session)session.want=false;return basePause();};
 E.load=function(t,autoplay,start=0){
  cancel();sourceButton();
  const manual=mappings()[t.id], eligible=native(t)||(!off[t.id]&&!t.id.startsWith('local-')&&lib.mode!=='video'&&!fixOpen&&!hasTiming(t)&&(manual&&manual!=='current'||mode()!=='current'&&manual!=='current'));
  if(!eligible)return baseLoad.call(E,t,autoplay,start);
  if(!online())return baseLoad.call(E,t,autoplay,start);
  if(typeof djFinish==='function')djFinish(true);window.PulseFileVideo?.reset();
  if(ready&&engine==='yt')try{player.stopVideo();}catch{}
  audio.pause();audio.removeAttribute('src');audio.load();engine='audio';audioTrackId=t.id;
  const s=session={key:'play-'+(++seq),tok:++loadTok,track:t,want:!!autoplay,start,pending:true,started:false,candidate:null};
  setLoading(true);$('seekBuf').style.width='0';updateMode();
  s.timer=setTimeout(()=>fail(s),native(t)?8000:3500);
  pulse.audius.select(slim(t),mode(),manual,s.key).then(c=>{
   if(session!==s||s.tok!==loadTok)return;
   if(!c||c.error||!native(t)&&hasTiming(t))return fail(s);
   s.candidate=c;s.pending=false;
   if(native(t)){Object.assign(t,c);remember(t);healed(t);}
   if(!native(t)&&!c.confirmed){++lyTok;Object.assign(lyState,{lines:null,kind:null,cur:-1,curText:''});$('lyScroll').innerHTML=lyEmpty('lyrics','Текст другой записи не переносится автоматически');lySrc('Audius');sendLyrics();}
   const loaded=()=>{audio.removeEventListener('loadedmetadata',loaded);if(session===s&&s.tok===loadTok&&start>0)audio.currentTime=Math.min(start,audio.duration||start);};
   s.loaded=loaded;audio.addEventListener('loadedmetadata',loaded,{once:true});
   audio.src='/audius/audio/'+encodeURIComponent(c.id.slice(3));sourceButton();
   if(s.want)basePlay();else{clearTimeout(s.timer);setLoading(false);}
  }).catch(()=>fail(s));
  return true;
 };
 onA('playing',()=>{if(session&&session.tok===loadTok&&audio.getAttribute('src')?.startsWith('/audius/')){session.started=true;clearTimeout(session.timer);sourceButton();}});
 onA('loadedmetadata',()=>{if(session&&!session.want){clearTimeout(session.timer);setLoading(false);}});
 async function picker(){
  const t=curTrack();if(!t)return;
  const link=session?.candidate?.permalink||t.permalink;
  modal(`<h2>Источник звука</h2><div class="ad-source-info"><b data-i18n-skip>${esc(t.title)}</b><p>${translateUiText('Исходная платформа и идентификатор трека сохраняются.')}</p></div><div class="ad-actions"><button class="btn" data-ad="current">${ico('music')}Текущий источник</button><button class="btn" data-ad="reset">${ico('undo')}Сбросить соответствие</button>${link?`<button class="btn" data-ad="open">${ico('link')}Открыть в Audius</button>`:''}</div>${native(t)?'':`<p>Выбери запись Audius вручную. Проверь исполнителя, версию и начало вокала.</p><form id="adSearch"><input id="adQuery" aria-label="Поиск в Audius" value="${esc(t.author+' '+t.title)}" maxlength="200"><button class="btn" type="submit">${ico('search')}Найти</button></form><div id="adResults"></div>`}`);
  const box=$('modalBox');
  box.querySelectorAll('[data-ad]').forEach(b=>b.addEventListener('click',()=>{
   const act=b.dataset.ad;if(act==='open'){if(/^https:\/\/audius.co\//.test(link))pulse.openUrl(link);return;}
   if(act==='current')mappings()[t.id]='current';else delete mappings()[t.id];save();closeModal();
   // Source changes are explicit, never triggered by a background search.
   const at=E.time(),was=playing;E.load(t,was,at);
  }));
  const form=$('adSearch');if(!form)return;
  form.addEventListener('submit',async e=>{
   e.preventDefault();const target=$('adResults');target.textContent=translateUiText('Поиск…');
   const shelves=await pulse.audius.search($('adQuery').value).catch(()=>[]);if(!target.isConnected)return;
   const items=(Array.isArray(shelves)?shelves:[]).flatMap(x=>x.items||[]).filter(native);
   target.replaceChildren();
   if(!items.length){target.textContent=translateUiText('Ничего не нашлось');return;}
   for(const candidate of items){const b=document.createElement('button');b.className='ad-candidate';b.type='button';const strong=document.createElement('strong');strong.textContent=candidate.title;strong.dataset.i18nSkip='';const sub=document.createElement('span');sub.dataset.i18nSkip='';sub.textContent=candidate.author+' · '+fmt(candidate.dur);b.append(strong,sub);b.addEventListener('click',()=>{
    if(hasTiming(t)){toast('Сначала убери свою синхронизацию: другая запись может иметь другие тайминги.','alert');return;}
    if(!confirm('Использовать выбранную запись Audius? Убедись, что версия и тайминги совпадают.'))return;
    mappings()[t.id]=candidate.id;save();closeModal();const at=E.time(),was=playing;E.load(t,was,at);
   });target.append(b);}
  });
 }
 // Only metadata is prefetched, never audio. One worker and two nearby tracks, hard deadlines.
 let prefetchGeneration=0,prefetchKey=null;
 async function prefetch(){if(prefetchKey)pulse.audius.cancel(prefetchKey).catch(()=>{});const generation=++prefetchGeneration; if(mode()==='current'||!online())return;const q=lib.queue;
  for(const t of q.tracks.slice(q.idx+1,q.idx+3)){if(generation!==prefetchGeneration)return;if(native(t)||hasTiming(t)||off[t.id])continue;const key=prefetchKey='prefetch-'+generation;
   await pulse.audius.select(slim(t),'prefer',mappings()[t.id],key).catch(()=>{});if(generation!==prefetchGeneration)pulse.audius.cancel(key).catch(()=>{});
  }
 }
 const oldHeal=healTrack;healTrack=async function(t){if(!native(t))return oldHeal(t);if(!needsHeal(t)||healing.has(t.id)||!online())return;healing.add(t.id);try{const c=await pulse.audius.track(t.id);if(c&&!c.error){Object.assign(t,c);remember(t);healed(t);}}finally{healing.delete(t.id);}};
 // Rehydrate saved ID-only references lazily, one metadata request at a time.
 let hydrateGeneration=0;
 PX.on('page',()=>{const generation=++hydrateGeneration;setTimeout(async()=>{
  const rows=[...document.querySelectorAll('.tr[data-id^="ad:"]')];
  for(const row of rows){if(generation!==hydrateGeneration)return;const list=got(row.dataset.l),t=list?.tracks?.[+row.dataset.i];if(!native(t)||!needsHeal(t))continue;
   await healTrack(t).catch(()=>{});if(!row.isConnected||needsHeal(t))continue;
   const title=row.querySelector('.tt'),author=row.querySelector('.ar'),duration=row.querySelector('.du'),img=row.querySelector('.ta img');
   if(title)title.textContent=t.title;if(author)author.innerHTML=artistLinks(t);if(duration)duration.textContent=fmt(t.dur);if(img&&t.art)img.src=artOf(t,120);
  }
 },0);});
 const legal={terms:'https://audius.co/documents/ApiTerms.pdf',privacy:'https://audius.co/privacy',license:'https://audius.org/open-music-license.pdf'};
 document.addEventListener('click',e=>{const source=e.target.closest('[data-ad-source-open]');if(source&&!source.disabled){picker();return;}const b=e.target.closest('[data-ad-legal]');if(b&&legal[b.dataset.adLegal])pulse.openUrl(legal[b.dataset.adLegal]);});
 const oldTab=clientTab;clientTab=function(){const tab=oldTab();tab.rows.push(grp('Audius'),R('Источник текущего трека','Выбор записи, переход к оригиналу и сброс соответствия доступны во время воспроизведения.',sourceControl(),'источник запись audius'),R('Источник звука','Audius — только уверенные совпадения. При сомнении используется прежний источник.',sel('app.audioSource',[['current','Текущий источник'],['auto','Автоматически'],['prefer','Предпочитать Audius']]),'audius звук источник'),R('Audius — прямой звук без входа','Публичные треки, исполнители и плейлисты. Лайки и плейлисты сохраняются только в Pulse. Скачивание отключено.',''),R('Условия Audius','',`<button class="btn sm" data-ad-legal="terms">API Terms</button><button class="btn sm" data-ad-legal="privacy">Privacy Policy</button><button class="btn sm" data-ad-legal="license">Open Music License</button>`));return tab;};
 const oldChanged=clChanged;clChanged=function(path){if(path==='app.audioSource'){prefetchGeneration++;if(prefetchKey)pulse.audius.cancel(prefetchKey).catch(()=>{});save();return true;}return oldChanged(path);};
 const oldHome=PAGES.home.load;PAGES.home.load=async function(r,force){if(CL()!=='ad')return oldHome(r,force);const d=await cached('ad:home',()=>ytm('feed','FEmusic_home'),force);if(d.error)return emptyHtml('alert','Audius недоступен — попробуй другой трек','');return `<h1 class="pg-title">Audius</h1>`+clGreet()+shelves((d.shelves||[]).map(s=>({...s,list:false,items:s.items.slice(0,16)})));};
 const oldExplore=PAGES.explore.load;PAGES.explore.load=async function(r,force){if(CL()!=='ad')return oldExplore(r,force);const d=await cached('ad:explore',()=>ytm('feed','FEmusic_explore'),force);return shelves(d.shelves||[]);};
 const oldDownload=updateDlCur;updateDlCur=function(){oldDownload();const t=curTrack(),b=$('btnDlCur');if(b){b.hidden=native(t);b.style.display=native(t)?'none':'';}};
 const oldAccount=renderAccBtn;renderAccBtn=function(){const b=$('accBtn');if(CL()==='ad'){if(b){b.hidden=true;b.style.display='none';}return;}if(b){b.hidden=false;b.style.display='';}oldAccount();};
 PX.on('track',()=>{if(session&&session.track.id!==curTrack()?.id)cancel();sourceButton();prefetch();});
 const oldFix=openFix;openFix=function(...a){if(session?.candidate&&!native(session.track)){toast('Для правки текста верни текущий источник звука.','alert');return;}return oldFix(...a);};
 window.PulseAudius={actual:()=>session?.candidate?{source:'ad',id:session.candidate.id,url:session.candidate.permalink}:null,
  recover:()=>{if(!session||session.tok!==loadTok||!audio.getAttribute('src')?.startsWith('/audius/'))return false;if(session.started)return false;fail(session);return true;},
  library:tab=>{const tabs=`<div class="lib-tabs"><button class="chip ${tab==='songs'?'':'on'}" data-lib="pl">Плейлисты</button><button class="chip ${tab==='songs'?'on':''}" data-lib="songs">Треки</button></div>`;
   if(tab==='songs'){const songs=Object.keys(lib.likes||{}).filter(id=>id.startsWith('ad:')).map(id=>lib.known[id]).filter(Boolean);return tabs+trackList(songs,{name:'Audius'});}
   const items=lib.playlists.filter(p=>p.id!==MINE).map(p=>({kind:'local',id:p.id,title:p.name,sub:tr(p.tracks.length),art:p.art||p.tracks[0]?.art,icon:'list'}));return tabs+`<div class="cl-hint">Лайки и плейлисты Audius сохраняются только в Pulse.</div><div class="shelf">${cards(items,{grid:true})}</div>`;
  },picker,hasTiming};
})();
