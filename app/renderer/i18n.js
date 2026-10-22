/* Pulse 1.0.0: reversible UI-only localization, shared by the main window and widgets. */
(function(){
 'use strict';
 const D=window.PulseEnglish||{}, J=window.PulseJapanese||{}, U=window.PulseUkrainian||{}, reverse=new Map([...Object.entries(D),...Object.entries(J),...Object.entries(U)].map(([k,v])=>[v,k]));
 const valid=v=>['en','ru','ja','uk'].includes(v)?v:'en';
 const folded=new Map(Object.keys(D).map(k=>[k.toLowerCase(),k]));
 let language='en';try{language=valid(localStorage.getItem('pulse.language'));}catch{}
 const sources=new WeakMap(), attributes=new WeakMap(), docs=new Set();
 const skip='script,style,textarea,pre,code,svg,[contenteditable],[data-i18n-skip],[data-set="app.language"],[data-language-list],#bTitle,#bArtist,#bSub,#lysT,#lysA,#lysMain,#lysRefl,#lysRefl2,.ly-line:not(.pv-ly .ly-line),.kara-line,.tr .tt,.tr .au,.tr .ar,.tr .al,.card .ct,.card .ca,.card .cs,.sl .n,.hi h1,.hi .strap,.dh-now .dh-tx>span:not(.dh-k),.dh-now .dh-tx b,#t,#a,#ll,#lc,#lp,#ln';
 const catalogAliases={"New Releases for You":"Новинки для вас","Playlists Made for You":"Плейлисты для вас","Playlists Made for {0}":"Плейлисты для {0}","Плейлисты для {0}":"Плейлисты для {0}","Recently Played":"Недавно слушал","Recently played":"Недавно слушал","Недавно прослушано":"Недавно слушал","New Releases and Favorites":"Новинки и любимые треки","Your favourites":"Любимые треки","From Your Library":"Из вашей библиотеки","Covers & Remixes":"Кавер-версии и ремиксы","Music Videos for You":"Видеоклипы для вас","Mixed for you":"Миксы для вас","Video Game Music":"Музыка из видеоигр","Made For You":"Плейлисты для вас","Рекомендуемые станции":"Рекомендованные станции","Похожее на: {0}":"Похоже на: {0}","Похоже на {0}":"Похоже на: {0}","More like: {0}":"Похоже на: {0}","Только для тебя, {0}":"Только для тебя, {0}","Made for {0}":"Только для тебя, {0}","Ещё больше открытий: {0}":"Еще больше открытий: {0}","Еще больше открытий: {0}":"Еще больше открытий: {0}","More like {0}":"Похоже на: {0}","Similar to {0}":"Похоже на: {0}","Альбомы с треками, которые тебе нравятся":"Альбомы с треками, которые тебе нравятся","Listen again today":"Послушай сегодня","Listen Again":"Вы давно не слушали","Your Top Mixes":"Твои лучшие миксы","Your Playlists":"Твои плейлисты","Top Tracks":"Лучшие треки","Soundtrack your Monday morning":"Музыка на утро понедельника","Soundtrack your Monday afternoon":"Музыка на день понедельника","Soundtrack your Monday evening":"Музыка на вечер понедельника","Soundtrack your Monday night":"Музыка на ночь понедельника","Soundtrack your Tuesday morning":"Музыка на утро вторника","Soundtrack your Tuesday afternoon":"Музыка на день вторника","Soundtrack your Tuesday evening":"Музыка на вечер вторника","Soundtrack your Tuesday night":"Музыка на ночь вторника","Soundtrack your Wednesday morning":"Музыка на утро среды","Soundtrack your Wednesday afternoon":"Музыка на день среды","Soundtrack your Wednesday evening":"Музыка на вечер среды","Soundtrack your Wednesday night":"Музыка на ночь среды","Soundtrack your Thursday morning":"Музыка на утро четверга","Soundtrack your Thursday afternoon":"Музыка на день четверга","Soundtrack your Thursday evening":"Музыка на вечер четверга","Soundtrack your Thursday night":"Музыка на ночь четверга","Soundtrack your Friday morning":"Музыка на утро пятницы","Soundtrack your Friday afternoon":"Музыка на день пятницы","Soundtrack your Friday evening":"Музыка на вечер пятницы","Soundtrack your Friday night":"Музыка на ночь пятницы","Soundtrack your Saturday morning":"Музыка на утро субботы","Soundtrack your Saturday afternoon":"Музыка на день субботы","Soundtrack your Saturday evening":"Музыка на вечер субботы","Soundtrack your Saturday night":"Музыка на ночь субботы","Soundtrack your Sunday morning":"Музыка на утро воскресенья","Soundtrack your Sunday afternoon":"Музыка на день воскресенья","Soundtrack your Sunday evening":"Музыка на вечер воскресенья","Soundtrack your Sunday night":"Музыка на ночь воскресенья"};
 function templatePattern(value){const ids=[];const re=value.split(/(\{\d+\})/).map(x=>{if(/^\{\d+\}$/.test(x)){ids.push(x.slice(1,-1));return '(.+?)';}return x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}).join('');return {ids,re:new RegExp('^'+re+'$')};}
 let sourcePatterns=[];
 function canonical(s){
  if(catalogAliases[s])return catalogAliases[s];
  if(reverse.has(s))return reverse.get(s);
  if(s.length<=4096)for(const p of sourcePatterns){const m=p.re.exec(s);if(m){const values=Object.fromEntries(p.ids.map((id,i)=>[id,m[i+1]]));return p.key.replace(/\{(\d+)\}/g,(_,id)=>values[id]);}}
  return s;
 }
 // 1.0.0: translate owned message templates, never their user-provided values.
 let patterns=[];
 function rebuildPatterns(){sourcePatterns=[...Object.entries(D),...Object.entries(J),...Object.entries(U),...Object.entries(catalogAliases).map(([value,key])=>[key,value])].filter(([key,value])=>/\{\d+\}/.test(key)&&/\{\d+\}/.test(value)).sort((a,b)=>b[1].replace(/\{\d+\}/g,'').length-a[1].replace(/\{\d+\}/g,'').length).map(([key,value])=>({key,...templatePattern(value)}));patterns=Object.keys(D).filter(k=>/\{\d+\}/.test(k)).sort((a,b)=>b.replace(/\{\d+\}/g,'').length-a.replace(/\{\d+\}/g,'').length).map(k=>{const ids=[],parts=k.split(/(\{\d+\})/);const re=parts.map(x=>{if(/^\{\d+\}$/.test(x)){ids.push(x.slice(1,-1));return '(.+?)';}return x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}).join('');return {key:k,ids,re:new RegExp('^'+re+'$')};});}
 rebuildPatterns();
 function template(source){if(source.length>4096||!/[А-Яа-яЁё]/.test(source))return null;for(const p of patterns){const m=p.re.exec(source);if(!m)continue;const values=Object.fromEntries(p.ids.map((id,i)=>[id,m[i+1]]));return (language==='uk'?(U[p.key]||D[p.key]):language==='ja'?(J[p.key]||D[p.key]):D[p.key]).replace(/\{(\d+)\}/g,(_,id)=>values[id]);}return null;}
 function t(s){
  s=String(s==null?'':s);const key=s.replace(/\s+/g,' ').trim(),source=canonical(key),lookup=folded.get(source.toLowerCase())||source;
  let result=language==='uk'?(U[lookup]||D[lookup]||source):language==='ja'?(J[lookup]||D[lookup]||source):language==='en'?(D[lookup]||source):source;
  if(language!=='ru'&&result===source){
   const dynamic=template(source);
   if(dynamic!==null)result=dynamic;
   else if(/^↳\s+/.test(source))result='↳ '+t(source.replace(/^↳\s+/,''));
   else if(/^[⏸♪]\s+/.test(source))result=source.slice(0,1)+' '+t(source.slice(1).trimStart());
   else if(source.includes(' • '))result=source.split(' • ').map(part=>t(part)).join(' • ');
   else if(source.includes(' · '))result=source.split(' · ').map(part=>t(part)).join(' · ');
   else if(language==='en')result=source.replace(/^(\d+) (?:треков|трека|трек)$/,(_,n)=>n==='1'?'1 track':n+' tracks').replace(/^(\d+) (?:настройка|настройки|настроек) по запросу «(.*)»$/,'$1 settings matching “$2”').replace(/^Сохранение (\d+)$/,'Save $1');
   else if(language==='uk')result=source.replace(/^(\d+) (?:треков|трека|трек)$/,(_,n)=>{const v=+n;return n+' '+(v%10===1&&v%100!==11?'трек':v%10>=2&&v%10<=4&&!(v%100>=12&&v%100<=14)?'треки':'треків');}).replace(/^(\d+) (?:настройка|настройки|настроек) по запросу «(.*)»$/,'$1 налаштувань за запитом «$2»').replace(/^Сохранение (\d+)$/,'Збереження $1');
   else result=source.replace(/^(\d+) (?:треков|трека|трек)$/,'$1 曲').replace(/^(\d+) (?:настройка|настройки|настроек) по запросу «(.*)»$/,'「$2」に一致する設定：$1 件').replace(/^Сохранение (\d+)$/,'保存 $1');
  }
  return result===source&&key===source?s:s.slice(0,s.length-s.trimStart().length)+result+s.slice(s.trimEnd().length);
 }
 function blocked(e){if(!e)return true;if(e.closest('script,style,textarea,pre,code,svg,[contenteditable],[data-i18n-skip]'))return true;return !e.closest('[data-i18n-ui]')&&!!e.closest(skip);}
 function text(n){if(blocked(n.parentElement))return;const old=sources.get(n),value=n.nodeValue;
  const source=old&&old.rendered===value?old.source:value;const next=t(source);sources.set(n,{source,rendered:next});if(next!==value)n.nodeValue=next;
 }
 function attrs(e){if(blocked(e))return;let state=attributes.get(e);if(!state){state={};attributes.set(e,state);}for(const a of ['title','placeholder','aria-label']){const value=e.getAttribute(a);if(value==null)continue;const old=state[a],source=old&&old.rendered===value?old.source:value,next=t(source);state[a]={source,rendered:next};if(next!==value)e.setAttribute(a,next);}}
 function walk(root){if(!root)return;if(root.nodeType===3){text(root);return;}if(root.nodeType===1){if(blocked(root))return;attrs(root);}const doc=root.ownerDocument||root;const tw=doc.createTreeWalker(root,4);let n;while(n=tw.nextNode())text(n);if(root.querySelectorAll)root.querySelectorAll('[title],[placeholder],[aria-label]').forEach(attrs);}
 // Mutation observers run at the microtask checkpoint before painting. Do not defer
 // localization to a timer: rapid renders otherwise expose source Russian for a frame.
 function attachDocument(doc){if(docs.has(doc))return;docs.add(doc);doc.documentElement.lang=language;walk(doc.documentElement);
  const mo=new MutationObserver(ms=>{const pending=new Set();for(const m of ms){if(m.type==='childList')m.addedNodes.forEach(n=>pending.add(n));else pending.add(m.target);}
   // A parent walk already covers its descendants. Removed nodes need no work.
   for(const root of pending){if(!root.isConnected)continue;let covered=false;for(let p=root.parentNode;p;p=p.parentNode)if(pending.has(p)){covered=true;break;}if(!covered)walk(root);}
  });mo.observe(doc.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','placeholder','aria-label']});
 }
 function setLanguage(value,persist=true){language=valid(value);if(persist)try{localStorage.setItem('pulse.language',language);}catch{}for(const doc of docs){doc.documentElement.lang=language;walk(doc.documentElement);}window.dispatchEvent(new CustomEvent('pulse-language',{detail:language}));}
 window.PulseI18n={t,canonical,walk,attachDocument,setLanguage,language:()=>language,locale:()=>({ru:'ru-RU',en:'en-US',ja:'ja-JP',uk:'uk-UA'})[language],add:entries=>{Object.assign(D,entries);for(const k of Object.keys(entries))folded.set(k.toLowerCase(),k);for(const[k,v]of Object.entries(entries))reverse.set(v,k);rebuildPatterns();}};
 for(const name of ['alert','confirm']){const native=window[name];if(native)window[name]=function(message){return native.call(window,t(message));};}
 attachDocument(document);window.addEventListener('storage',e=>{if(e.key==='pulse.language')setLanguage(e.newValue,false);});
})();
