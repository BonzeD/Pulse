/* Pulse 1.0.0: reversible UI-only localization, shared by the main window and widgets. */
(function(){
 'use strict';
 const D=window.PulseEnglish||{}, J=window.PulseJapanese||{}, U=window.PulseUkrainian||{}, reverse=new Map([...Object.entries(D),...Object.entries(J),...Object.entries(U)].map(([k,v])=>[v,k]));
 const valid=v=>['en','ru','ja','uk'].includes(v)?v:'en';
 const folded=new Map(Object.keys(D).map(k=>[k.toLowerCase(),k]));
 let language='en';try{language=valid(localStorage.getItem('pulse.language'));}catch{}
 const sources=new WeakMap(), attributes=new WeakMap(), docs=new Set();
 const skip='script,style,textarea,pre,code,svg,[contenteditable],[data-i18n-skip],[data-set="app.language"],[data-language-list],#bTitle,#bArtist,#bSub,#lysT,#lysA,#lysMain,#lysRefl,#lysRefl2,.ly-line:not(.pv-ly .ly-line),.kara-line,.tr .tt,.tr .au,.tr .ar,.tr .al,.card .ct,.card .ca,.card .cs,.sl .n,.hi h1,.hi .strap,.dh-now .dh-tx>span:not(.dh-k),.dh-now .dh-tx b,#t,#a,#ll,#lc,#lp,#ln';
 function canonical(s){return reverse.get(s)||s;}
 // 1.0.0: translate owned message templates, never their user-provided values.
 let patterns=[];
 function rebuildPatterns(){patterns=Object.keys(D).filter(k=>/\{\d+\}/.test(k)).sort((a,b)=>b.replace(/\{\d+\}/g,'').length-a.replace(/\{\d+\}/g,'').length).map(k=>{const ids=[],parts=k.split(/(\{\d+\})/);const re=parts.map(x=>{if(/^\{\d+\}$/.test(x)){ids.push(x.slice(1,-1));return '(.+?)';}return x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}).join('');return {key:k,ids,re:new RegExp('^'+re+'$')};});}
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
