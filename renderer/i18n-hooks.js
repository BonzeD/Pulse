// Canonical text for existing settings navigation; keep the transport and shell unchanged.
(function(){
 window.addEventListener('pulse-language',()=>{if(typeof curTrack==='function'&&!curTrack()&&typeof updateNow==='function')updateNow();});
 if(typeof dsOpenSetting==='function'){
  const original=dsOpenSetting;
  dsOpenSetting=function(tab,title){return original(tab,title?PulseI18n.t(title):title);};
 }
 if(typeof dsPalItems==='function'){
  const original=dsPalItems;
  dsPalItems=function(q){
   if(!q||!q.trim())return original(q);
   const groups=['Разделы','Действия','Плейлисты','Настройки'];
   const items=groups.flatMap(g=>original(g==='Настройки'?'настройки':g==='Плейлисты'?'плейлист':g==='Разделы'?'раздел':'').filter(x=>x.g===g));
   // Every settings row has the Russian keyword “настройки”; fetch each tab's rows without a result cap.
   for(const tb of allTabs()) for(const r of tb.rows||[]) if(r&&r.t&&!r.h&&r.raw==null){const title=String(r.t).replace(/^↳ /,'');items.push({g:'Настройки',icon:tb.icon||'settings',t:title,sub:tb.title,k:title+' '+(r.s||''),run:()=>dsOpenSetting(tb.id,title)});}
   const words=q.toLowerCase().trim().split(/\s+/),seen=new Set();
   const hits=items.filter(x=>{const key=x.g+'|'+x.t+'|'+x.sub;if(seen.has(key))return false;seen.add(key);const text=[x.k,x.t,x.sub,PulseI18n.t(x.t),PulseI18n.t(x.sub)].join(' ').toLowerCase();return words.every(w=>text.includes(w));});
   const music=original(q).filter(x=>x.g==='Поиск музыки');return [...music,...hits].slice(0,60);
  };
 }
})();
