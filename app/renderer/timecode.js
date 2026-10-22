/* Clickable hundredths for lyric authoring; uses the existing player clock/RAF. */
window.PulseTimecode=(()=>{
 'use strict';
 const key='pulse.preciseTime';let precise=false,options=null,node=null,last=0;
 try{precise=localStorage.getItem(key)==='true';}catch{}
 function format(value){
  const n=Number(value),s=Number.isFinite(n)?Math.max(0,n):0;
  const ticks=Math.floor(s*100+1e-7),seconds=Math.floor(ticks/100),hours=Math.floor(seconds/3600);
  const pad=n=>String(n).padStart(2,'0');
  return (hours?pad(hours)+':':'')+pad(Math.floor(seconds/60)%60)+':'+pad(seconds%60)+'.'+pad(ticks%100);
 }
 function display(value){return precise?format(value):options.legacy(value);}
 function update(current,duration){
  if(!options)return;
  for(const [el,value] of [[options.currentNode,current],[options.durationNode,duration]]){const text=display(value);if(el.textContent!==text)el.textContent=text;}
 }
 function refresh(){if(options)update(options.current(),options.duration());}
 function syncButton(){
  const label=precise?'Обычный таймкод':'Точный таймкод (сотые секунды)';
  node.setAttribute('aria-pressed',String(precise));node.setAttribute('title',label);node.setAttribute('aria-label',label);
 }
 function toggle(){precise=!precise;last=0;try{localStorage.setItem(key,String(precise));}catch{}syncButton();refresh();}
 function mount(o){
  if(node)return;options=o;node=o.currentNode.parentElement;
  node.setAttribute('role','button');node.setAttribute('tabindex','0');node.dataset.preciseTime='';
  node.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();toggle();});
  node.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();if(!e.repeat)toggle();}});
  syncButton();refresh();
 }
 function tick(now){if(!precise||!options||document.hidden||now-last<16)return;last=now;refresh();}
 return {format,display,mount,update,tick,get precise(){return precise;}};
})();
