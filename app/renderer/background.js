/* Hidden-window housekeeping only: never suspend/replace the audio graph or authenticated player. */
window.PulseBackgroundRuntime=(()=>{'use strict';let timer=0,trims=0;const hidden=()=>document.hidden||!!window.pulseWinHidden;
 function trim(){timer=0;if(!hidden())return;trims++;try{Viz.releaseSurfaces?.();}catch{}try{for(const id of Object.keys(pvInst)){pvInst[id].v.destroy();delete pvInst[id];}}catch{}try{blurCache.clear();}catch{}try{while(cache.size>4)cache.delete(cache.keys().next().value);}catch{}}
 function sync(){clearTimeout(timer);timer=0;if(hidden())timer=setTimeout(trim,15000);else{Viz.resize();if(typeof mainFrameRequest==='function')mainFrameRequest();}}
 document.addEventListener('visibilitychange',sync);window.addEventListener('pulse-window-visibility',sync);window.addEventListener('pagehide',()=>clearTimeout(timer));sync();
 return {stats:()=>({hidden:hidden(),mainRaf:!!mainRaf,mainFrames,trimScheduled:!!timer,trims,catalogPages:cache.size,blurEntries:blurCache.size})};
})();
