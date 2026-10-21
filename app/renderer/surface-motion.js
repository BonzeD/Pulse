/* Event-driven surface motion. No DOM-wide observer or permanent animation loop. */
(() => {
 'use strict';const reduced=matchMedia('(prefers-reduced-motion: reduce)'),pending=new Set(),running=new Set(),entrances=new WeakMap();
 const enabled=()=>!reduced.matches&&!document.body.classList.contains('no-anim');
 function enter(el,stage=false){if(!el||!enabled()||!el.animate)return;entrances.get(el)?.cancel();const a=el.animate(stage?[{opacity:0},{opacity:1}]:[{opacity:0,transform:'translateY(6px) scale(.99)'},{opacity:1,transform:'none'}],{duration:220,easing:'cubic-bezier(.16,1,.3,1)'});entrances.set(el,a);running.add(a);a.finished.catch(()=>{}).finally(()=>running.delete(a));return a;}
 function flush(group){for(const p of [...pending])if(!group||p.group===group){clearTimeout(p.timer);p.animation?.cancel();p.el.remove();pending.delete(p);}}
 function remove(el,group='menu'){
  if(!el)return;if(!enabled()||!el.animate){el.remove();return;}
  flush(group);const visual=getComputedStyle(el),opacity=visual.opacity,transform=visual.transform;el.inert=true;el.setAttribute('aria-hidden','true');el.removeAttribute('id');el.dataset.motionLeaving='true';el.style.pointerEvents='none';
  const p={el,group};pending.add(p);const done=()=>{if(!pending.delete(p))return;clearTimeout(p.timer);p.animation?.cancel();el.remove();};
  p.animation=el.animate([{opacity,transform},{opacity:0,transform}],{duration:140,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'});p.animation.finished.then(done,done);p.timer=setTimeout(done,200);
 }
 function stop(){flush();for(const a of running)a.cancel();running.clear();}
 reduced.addEventListener('change',()=>{if(!enabled())stop();});
 new MutationObserver(()=>{if(!enabled())stop();}).observe(document.body,{attributes:true,attributeFilter:['class']});
 document.addEventListener('pointerdown',()=>flush(),true);addEventListener('pagehide',stop);document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 window.PulseMotion={enter,remove,flush,stop,enabled,stats:()=>({pending:pending.size,running:running.size})};
})();
