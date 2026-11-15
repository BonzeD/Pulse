/* Pulse 1.0.3 — cylindrical sidebar lyrics, no independent perpetual animation loop. */
(()=>{'use strict';
 const label='Барабан строк',help='Строки огибают цилиндр: текущая читается прямо, дальние уходят в перспективу';
 for(const [key,title,description]of [['PulseEnglish','Lyric drum','Lines wrap around a cylinder: the current line faces you, distant lines tilt away'],['PulseJapanese','歌詞ドラム','現在の行を正面に、前後の行を円筒状に表示します'],['PulseUkrainian','Барабан рядків','Поточний рядок прямо, віддалені рядки йдуть у перспективу']])if(window[key])Object.assign(window[key],{[label]:title,[help]:description});
 const reduce=matchMedia('(prefers-reduced-motion: reduce)'),contrast=matchMedia('(forced-colors: active)');
 let inner=null,rows=[],raf=0,until=0,dirty=true,active=new Set();
 const enabled=()=>S().ly.drum!==false&&!reduce.matches&&!contrast.matches&&!document.body.classList.contains('no-anim');
 const visible=()=>!document.hidden&&!window.pulseWinHidden&&document.body.classList.contains('pp-open')&&lib.tab==='lyrics';
 function reset(){if(inner){inner.classList.remove('ly-drum');for(const el of inner.children){for(const k of ['y','z','angle','opacity'])el.style.removeProperty('--drum-'+k);el.removeAttribute('data-drum-out');}}active.clear();}
 function measure(){const next=$('lyInner');if(next!==inner){reset();inner=next;dirty=true;}if(!inner)return false;if(dirty){rows=[...inner.children].map(el=>({el,center:el.offsetTop+el.offsetHeight/2}));dirty=false;active.clear();for(const {el}of rows)el.setAttribute('data-drum-out','');}return true;}
 function draw(){if(!enabled()){reset();return;}if(!measure())return;inner.classList.add('ly-drum');
  // offsetTop/Height are cached on layout changes; only the scrolling matrix is sampled during a transition.
  const y=new DOMMatrixReadOnly(getComputedStyle(inner).transform).m42;
  const radius=Math.max(180,Math.min(360,$('lyScroll').clientHeight*.52));
  let lo=0,hi=rows.length;while(lo<hi){const mid=(lo+hi)>>1;if(rows[mid].center < -y-radius*1.65)lo=mid+1;else hi=mid;}
  const now=new Set();for(let k=lo;k<rows.length&&rows[k].center+y<radius*1.65;k++){
   const {el,center}=rows[k],distance=center+y,angle=Math.max(-1.43,Math.min(1.43,distance/radius));now.add(el);el.removeAttribute('data-drum-out');
   el.style.setProperty('--drum-angle',(-angle*180/Math.PI).toFixed(2)+'deg');
   el.style.setProperty('--drum-y',(radius*Math.sin(angle)-distance).toFixed(2)+'px');
   el.style.setProperty('--drum-z',(radius*(Math.cos(angle)-1)).toFixed(2)+'px');
   el.style.setProperty('--drum-opacity',String(Math.max(.15,Math.cos(angle)**1.4)));
  }for(const el of active)if(!now.has(el))el.setAttribute('data-drum-out','');active=now;
 }
 function tick(now){raf=0;if(!visible())return;draw();if(now<until&&enabled())raf=requestAnimationFrame(tick);}
 function update(animate=true){if(!enabled()){cancelAnimationFrame(raf);raf=0;reset();return;}if(!visible())return;until=performance.now()+(animate?Math.max(900,(+S().ly.speed||70)*15):0);if(!raf)raf=requestAnimationFrame(tick);}
 for(const name of ['lyPlace','lyManual','lyResume']){const original=window[name];window[name]=function(){
  const el=$('lyInner'),smooth=!reduce.matches&&!document.body.classList.contains('no-anim')&&!lyState.drag;
  let firstY=null;if(name==='lyManual'&&el){if(!lyState.manual)firstY=new DOMMatrixReadOnly(getComputedStyle(el).transform).m42;else if(lyState.drag&&el.classList.contains('ly-manual-smooth'))lyState.manual.y=new DOMMatrixReadOnly(getComputedStyle(el).transform).m42;el.classList.toggle('ly-manual-smooth',smooth);}
  if(name==='lyResume')el?.classList.remove('ly-manual-smooth');const r=original.apply(this,arguments);
  if(firstY!==null&&lyState.manual&&el){lyState.manual.y=Math.max(-el.scrollHeight+40,Math.min(40,firstY-(+arguments[0]||0)));el.style.transform=`translateY(${lyState.manual.y}px)`;}
  update(name!=='lyManual'||smooth);return r;
 };}
 const baseShow=showLines;showLines=function(){const r=baseShow.apply(this,arguments);dirty=true;update(false);return r;};
 const baseSetting=settingChanged;settingChanged=function(path){const r=baseSetting.apply(this,arguments);if(/^ly\.|^look\.|^perf\./.test(path)){dirty=true;update();}return r;};
 new MutationObserver(()=>{dirty=true;update();}).observe($('lyScroll'),{childList:true});
 const resize=new ResizeObserver(()=>{dirty=true;update(false);});resize.observe($('lyScroll'));
 // UI state changes are sparse; do not observe per-word karaoke style mutations.
 new MutationObserver(()=>update()).observe(document.body,{attributes:true,attributeFilter:['class']});
 for(const q of [reduce,contrast])q.addEventListener('change',()=>{if(reduce.matches)$('lyInner')?.classList.remove('ly-manual-smooth');update(false);});
 window.addEventListener('pulse-window-visibility',()=>{cancelAnimationFrame(raf);raf=0;update(false);});
 document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(raf);raf=0;update(false);});
 document.fonts?.ready.then(()=>{dirty=true;update(false);});
 window.PulseLyricDrum={refresh:()=>{dirty=true;update(false);},stats:()=>({enabled:enabled(),raf:!!raf,rows:rows.length,projected:active.size})};
})();
