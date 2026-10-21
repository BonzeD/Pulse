/* Pulse 1.0.0: scrolling is compositor work, not a second optical render loop.
   Only Home drops moving-backdrop SVG displacement; the cached rim and all
   settings remain intact. No permanent RAF, no preventDefault, no FPS cap. */
(()=>{
 'use strict';const B=document.body,V=document.getElementById('view');let idle=0;
 function reset(){clearTimeout(idle);idle=0;B.removeAttribute('data-home-scrolling');}
 function scroll(){if(B.dataset.page!=='home'||B.classList.contains('pp-open'))return;
  if(!B.hasAttribute('data-home-scrolling'))B.setAttribute('data-home-scrolling','');
  clearTimeout(idle);idle=setTimeout(reset,160);
 }
 V?.addEventListener('scroll',scroll,{passive:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
 window.addEventListener('blur',reset);
 window.PulseHomePerf={reset};
})();
