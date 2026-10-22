/* Live lyric-particle backend switch; no settings or particle-state reset. */
window.PulseParticleCanvas=(()=>{
 const states=new WeakMap();
 function replace(cv,state){
  const next=cv.cloneNode(false);
  try{state?.gpu?.gl?.getExtension('WEBGL_lose_context')?.loseContext();}catch{}
  cv.replaceWith(next);return next;
 }
 function frame(cv,enabled,w,h,dpr){
  let state=states.get(cv);
  if(state && state.enabled!==enabled){cv=replace(cv,state);state=null;}
  if(!state){state={enabled,gpu:enabled&&typeof PulseGPU!=='undefined'?PulseGPU.create(cv):null};states.set(cv,state);}
  let renderer=state.gpu;
  if(renderer && (!renderer.ok()||!renderer.begin(w,h,dpr))){
   cv=replace(cv,state);state={enabled,gpu:null};states.set(cv,state);renderer=null;
  }
  const width=Math.round(w*dpr),height=Math.round(h*dpr);
  if(cv.width!==width)cv.width=width;if(cv.height!==height)cv.height=height;
  return {canvas:cv,renderer,context:renderer?null:cv.getContext('2d')};
 }
 return {frame};
})();
