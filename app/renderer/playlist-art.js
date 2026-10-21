/* Visible missing covers only; at most two metadata lookups. Apple never downloads tracks here. */
(()=>{'use strict';const cache=new Map(),failed=new Map(),pending=[],queued=new WeakSet(),jobs=new Map();let active=0;
 async function metadata(id){if(jobs.has(id))return jobs.get(id);const job=(async()=>{
  if(/^am:(lib|playlist):/.test(id)&&pulse.svc?.playlistArtwork){const d=await pulse.svc.playlistArtwork(id);if(d?.error)throw Error(d.error);return d?.art||null;}
  const d=await ytm('browse',id);return d?.header?.art||d?.tracks?.find(t=>t.art)?.art||d?.shelves?.flatMap(s=>s.items||[]).find(t=>t.art)?.art||null;
 })();jobs.set(id,job);try{return await job;}finally{if(jobs.get(id)===job)jobs.delete(id);}}
 async function repair(card){const id=card?.dataset.playlistArt;if(!id||!card.isConnected||queued.has(card)||!online())return;const img=card.querySelector('.ca img');if(img?.naturalWidth&&img.style.opacity!=='0')return;if(failed.has(id)&&Date.now()-failed.get(id)<60000)return;queued.add(card);pending.push({card,id});run();}
 function run(){while(active<2&&pending.length){const {card,id}=pending.shift();if(!card.isConnected){queued.delete(card);continue;}active++;
  (async()=>{try{const entry=cache.get(id);let art=entry&&Date.now()-entry.at<180000?entry.art:null;
   if(!art)art=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('artwork-timeout')),10000);metadata(id).then(v=>{clearTimeout(timer);resolve(v);},e=>{clearTimeout(timer);reject(e);});});
   if(!art){failed.set(id,Date.now());return;}if(!card.isConnected||card.dataset.playlistArt!==id)return;
   const ca=card.querySelector('.ca');if(!ca)return;const old=ca.querySelector('img'),image=new Image();image.decoding='async';
   image.onload=()=>{if(!card.isConnected||card.dataset.playlistArt!==id||!ca.isConnected)return;cache.set(id,{art,at:Date.now()});if(cache.size>100)cache.delete(cache.keys().next().value);failed.delete(id);ca.querySelector('.ca-ico')?.remove();old?.remove();image.alt='';image.style.width='100%';image.style.height='100%';image.style.objectFit='cover';ca.prepend(image);ca.classList.remove('noimg');
    const item=got(card.dataset.c)?.items?.[+card.dataset.i];if(item?.browseId===id){item.art=art;item.icon=null;}window.PulseRememberPlaylistArt?.(id,art);
   };image.onerror=()=>{cache.delete(id);failed.set(id,Date.now());};image.src=pimg(art);
  }catch{failed.set(id,Date.now());}finally{active--;queued.delete(card);run();}})();
 }}
 const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){io.unobserve(e.target);repair(e.target);}}),{rootMargin:'80px'});
 function scan(){document.querySelectorAll('[data-playlist-art]:not([data-art-observed])').forEach(c=>{c.dataset.artObserved='1';if(!c.querySelector('.ca img'))io.observe(c);});}
 let scheduled=false;const mo=new MutationObserver(()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;scan();});});mo.observe(document.getElementById('page'),{childList:true,subtree:true});addEventListener('online',()=>{failed.clear();document.querySelectorAll('[data-playlist-art]').forEach(c=>{if(c.getBoundingClientRect().bottom>0&&c.getBoundingClientRect().top<innerHeight)repair(c);});});scan();window.PulsePlaylistArt={repair,stats:()=>({active,pending:pending.length,cache:cache.size})};
})();
