/* Settings-only, bounded transitions. Keep old content until commit; never clone live previews. */
(()=>{'use strict';
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),states=new WeakMap(),active=new Set();
 const enabled=()=>!reduced.matches&&!document.body.classList.contains('no-anim');
 function cancel(s){clearTimeout(s.timer);s.animation?.cancel();s.animation=null;active.delete(s);s.root.inert=s.inert;s.root.removeAttribute('aria-busy');}
 function enter(s){s.phase='in';s.animation=s.root.animate([{opacity:.72,transform:'translateY(7px)'},{opacity:1,transform:'none'}],{duration:260,easing:'cubic-bezier(.16,1,.3,1)'});const a=s.animation;a.finished.catch(()=>{}).finally(()=>{if(s.animation===a){s.animation=null;active.delete(s);}});active.add(s);}
 function commit(s,animate=true){clearTimeout(s.timer);s.animation?.cancel();s.animation=null;s.root.inert=s.inert;s.root.removeAttribute('aria-busy');if(!s.root.isConnected){active.delete(s);return;}s.commit();if(s.focus&&document.activeElement===document.body)document.querySelector('.set-side nav [data-stab="'+CSS.escape(s.key)+'"]')?.focus({preventScroll:true});s.focus=false;s.phase='idle';if(animate&&enabled())enter(s);else active.delete(s);}
 function render(root,key,draw){
  let s=states.get(root);if(!s){s={root,inert:root.inert,phase:'idle'};states.set(root,s);}
  if(!enabled()||!root.animate){cancel(s);s.commit=draw;s.key=key;commit(s,false);return;}
  if(s.phase==='out'&&s.key===key){s.commit=draw;return;}
  if(root.dataset.tab===key&&s.phase!=='out'){draw();return;}
  const opacity=getComputedStyle(root).opacity,transform=getComputedStyle(root).transform;cancel(s);s.focus=!!s.focus||root.contains(document.activeElement)||!!document.activeElement?.closest('.set-side nav [data-stab]');s.key=key;s.commit=draw;s.phase='out';root.inert=true;root.setAttribute('aria-busy','true');
  s.animation=root.animate([{opacity,transform},{opacity:.72,transform:'translateY(-3px)'}],{duration:90,easing:'ease-in',fill:'forwards'});s.animation.finished.catch(()=>{});active.add(s);s.timer=setTimeout(()=>commit(s),90);
 }
 function settle(){for(const s of [...active]){if(s.phase==='out')commit(s,false);else cancel(s);}}
 reduced.addEventListener('change',()=>{if(!enabled())settle();});new MutationObserver(()=>{if(!enabled())settle();}).observe(document.body,{attributes:true,attributeFilter:['class']});addEventListener('pagehide',()=>{for(const s of [...active])cancel(s);});
 window.PulseSettingsMotion={render,settle,stats:()=>({active:active.size})};
})();
