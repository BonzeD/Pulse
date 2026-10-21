/* Pulse 1.0.0: an in-window optical material, not Windows acrylic.
   Sized convex bezels refract ONLY the backdrop. Event driven, bounded cache, no RAF. */
(() => {
 'use strict';
 const B=document.body,NS='http://www.w3.org/2000/svg';
 const selector='#bar,#menu,.pulse-select-menu,.pulse-submenu,.pop-panel,.lyb-q,.modal-box,.clean-dialog,.ds-pal-box,.side,.search,.bar .ib,.glass-demo-panel';
 const reduce=matchMedia('(prefers-reduced-transparency: reduce)'),forced=matchMedia('(forced-colors: active)');
 const supported=typeof CSS!=='undefined'&&CSS.supports('backdrop-filter','url("#pulse-glass-probe") blur(1px)');
 let config=window.PulseGlassModel.defaults();const bases=new WeakMap();
 const maps=new Map(),observed=new Set();let serial=0,timer=null,svg=null,defs=null,scans=0;
 const enabled=()=>B.dataset.surfaceMaterial==='liquid'&&!B.classList.contains('perf-lite')&&!reduce.matches&&!forced.matches&&supported;
 function clearElement(el){el.removeAttribute('data-glass-lens');el.style.removeProperty('--glass-lens');el.style.removeProperty('--glass-rim');el.removeAttribute('data-glass-surface');el.style.removeProperty('--lg-radius');}
 function queue(){if(timer===null)timer=setTimeout(refresh,70);}
 const resize=new ResizeObserver(queue);
 function makeFilter(w,h,r){
  const opt=['refraction','strength','thickness','ior','rim','rimPower','rimWidth','rimSoftness','lightAngle','fresnel','fresnelPower','dispersion','dispersionPower','grain','grainPower'].map(k=>config[k]);const key=[w,h,r,...opt].join(':');if(maps.has(key))return maps.get(key);
  if(!defs){svg=document.createElementNS(NS,'svg');svg.setAttribute('aria-hidden','true');svg.setAttribute('width','0');svg.setAttribute('height','0');svg.style.cssText='position:fixed;pointer-events:none;overflow:hidden';defs=document.createElementNS(NS,'defs');svg.append(defs);B.append(svg);}
  const ratio=Math.min(1,960/w,480/h),cw=Math.max(2,Math.round(w*ratio)),ch=Math.max(2,Math.round(h*ratio));
  const c=document.createElement('canvas');c.width=cw;c.height=ch;const ctx=c.getContext('2d');if(!ctx)return null;
  const im=ctx.createImageData(cw,ch),rim=ctx.createImageData(cw,ch),bezel=Math.min(config.thickness,r*.95,w*.22,h*.46),strength=64;
  for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){
   const dx=(x+.5)/ratio-w/2,dy=(y+.5)/ratio-h/2,qx=Math.abs(dx)-w/2+r,qy=Math.abs(dy)-h/2+r;
   const ox=Math.max(qx,0),oy=Math.max(qy,0),len=Math.hypot(ox,oy),inside=-(len+Math.min(Math.max(qx,qy),0)-r);
   let nx=0,ny=0,shift=0;
   if(inside>=0&&inside<bezel){
    if(len>.001){nx=ox/len*Math.sign(dx);ny=oy/len*Math.sign(dy);}else if(qx>qy)nx=Math.sign(dx);else ny=Math.sign(dy);
    // Convex squircle height y=(1-(1-t)^4)^(1/4). Its derivative
    // gives the surface normal; Snell bends air into n=1.5 glass.
    // Flat centre, optically thick shoulder, not a blanket frosted blur.
    const t=Math.max(.015,inside/bezel),u=1-t;
    const slope=Math.pow(u,3)/Math.pow(Math.max(.00001,1-Math.pow(u,4)),.75);
    const a=Math.atan(slope),b=Math.asin(Math.sin(a)/config.ior);
    const depth=bezel*(.45+.55*Math.pow(1-Math.pow(u,4),.25));
    shift=(config.refraction?config.strength/100:0)*Math.min(strength/2-1,Math.tan(a-b)*depth)*Math.min(1,inside/.8);
   }
   const i=(y*cw+x)*4;im.data[i]=Math.round(Math.max(0,Math.min(255,127.5-nx*shift/strength*255)));im.data[i+1]=Math.round(Math.max(0,Math.min(255,127.5-ny*shift/strength*255)));im.data[i+2]=128;im.data[i+3]=255;
   // Analytic rim highlights, anchored to light at top-left. No texture loop.
   if(inside>=0&&inside<bezel){
    const angle=config.lightAngle*Math.PI/180,light=(nx*Math.cos(angle)+ny*Math.sin(angle)),edge=Math.exp(-Math.pow((inside-config.rimWidth)/config.rimSoftness,2));
    const shoulder=Math.exp(-Math.pow((inside-bezel*.38)/(bezel*.28),2));
    const back=Math.max(0,-light),shine=(config.rim?config.rimPower/100*(edge*.66*Math.max(0,light)+shoulder*.12*Math.max(0,light)):0)+(config.fresnel?edge*config.fresnelPower/100:0);
    const dark=config.rim?shoulder*.15*back*config.rimPower/100:0;
    rim.data[i]=rim.data[i+1]=rim.data[i+2]=shine>dark?255:5;
    rim.data[i+3]=Math.round(Math.min(1,Math.max(shine,dark))*255);
   }
  }
  if(config.grain)for(let i=0;i<rim.data.length;i+=4){const n=((Math.imul(i+1729,1664525)>>>9)%1000)/1000;if(rim.data[i+3]<n*config.grainPower*.5){rim.data[i]=rim.data[i+1]=rim.data[i+2]=n>.5?255:0;rim.data[i+3]=Math.round(n*config.grainPower*.5);}}
  ctx.putImageData(rim,0,0);const rimUrl=c.toDataURL();ctx.putImageData(im,0,0);
  const filter=document.createElementNS(NS,'filter'),id='pulse-glass-'+ ++serial;
  for(const [k,v] of Object.entries({id,x:0,y:0,width:w,height:h,filterUnits:'userSpaceOnUse','color-interpolation-filters':'sRGB'}))filter.setAttribute(k,v);
  const image=document.createElementNS(NS,'feImage');for(const [k,v] of Object.entries({href:c.toDataURL(),x:0,y:0,width:w,height:h,preserveAspectRatio:'none',result:'bezel'}))image.setAttribute(k,v);
  const displace=document.createElementNS(NS,'feDisplacementMap');for(const [k,v] of Object.entries({in:'SourceGraphic',in2:'bezel',scale:strength,xChannelSelector:'R',yChannelSelector:'G'}))displace.setAttribute(k,v);
  filter.append(image,displace);
  if(config.dispersion&&config.refraction&&config.dispersionPower>0){
   const channelResults=[];
   for(let ch=0;ch<3;ch++){
    const d=document.createElementNS(NS,'feDisplacementMap'),name='channel'+ch;
    for(const[k,v]of Object.entries({in:'SourceGraphic',in2:'bezel',scale:strength*(1+(1-ch)*config.dispersionPower*.0012),xChannelSelector:'R',yChannelSelector:'G',result:name}))d.setAttribute(k,v);
    const cm=document.createElementNS(NS,'feColorMatrix'),values=Array(20).fill(0);values[ch*5+ch]=1;values[18]=1;cm.setAttribute('in',name);cm.setAttribute('type','matrix');cm.setAttribute('values',values.join(' '));cm.setAttribute('result','rgb'+ch);filter.append(d,cm);channelResults.push('rgb'+ch);
   }
   for(let ch=1;ch<3;ch++){const blend=document.createElementNS(NS,'feBlend');blend.setAttribute('in',ch===1?'rgb0':'rg');blend.setAttribute('in2','rgb'+ch);blend.setAttribute('mode','screen');blend.setAttribute('result',ch===1?'rg':'prism');filter.append(blend);}
  }
  defs.append(filter);const entry={key,id,filter,rimUrl};maps.set(key,entry);return entry;
 }
 function refresh(){
  timer=null;scans++;const use=enabled(),alive=new Set(),used=new Set();
  for(const el of [...document.querySelectorAll(selector)].sort((a,b)=>Number(a.matches('.bar .ib'))-Number(b.matches('.bar .ib')))){
   const rect=el.getBoundingClientRect(),style=getComputedStyle(el),visible=el.isConnected&&rect.width>1&&rect.height>1&&style.display!=='none'&&style.visibility!=='hidden';
   if(!use||!visible){clearElement(el);delete el.dataset.glassOff;continue;}
   alive.add(el);if(!observed.has(el)){observed.add(el);resize.observe(el);}
   // Bound both work and GPU surfaces: large content panes use the CSS material.
   if(rect.width*rect.height>700000||alive.size>24){clearElement(el);continue;}
   const type=el.matches('.bar .ib')?'button':el.matches('#bar,.glass-demo-panel')?'bar':el.matches('.side')?'nav':el.matches('.search')?'search':'menu';
   const scope=type==='button'?'scopeButtons':type==='bar'?'scopeBar':type==='nav'?'scopeNav':type==='search'?'scopeSearch':'scopeMenus';
   if(!config[scope]){clearElement(el);el.dataset.glassOff='true';continue;}delete el.dataset.glassOff;
   el.dataset.glassSurface=type;
   const base=bases.get(el)??(parseFloat(style.borderTopLeftRadius)||16);if(!bases.has(el))bases.set(el,base);
   const w=el.offsetWidth,h=el.offsetHeight,r=Math.max(1,Math.round(Math.min(base*(config.rounding?config.roundness/100:1),w/2,h/2)));
   const alpha=type==='button'?config.buttonAlpha:type==='bar'?config.barAlpha:type==='nav'||type==='search'?config.navAlpha:config.menuAlpha;
   const blur=type==='button'?config.buttonBlur:type==='bar'?config.barBlur:type==='nav'||type==='search'?config.navBlur:config.menuBlur;
   const brightness=type==='button'?100:type==='bar'?config.barBrightness:type==='nav'||type==='search'?config.navBrightness:config.menuBrightness;
   el.style.setProperty('--lg-fill',config.tint?alpha/100:0);el.style.setProperty('--lg-diffusion',(config.blur?blur:0)+'px');el.style.setProperty('--lg-brightness',config.color?brightness/100:1);el.style.setProperty('--lg-radius',r+'px');
   const entry=makeFilter(w,h,r);if(!entry){clearElement(el);continue;}used.add(entry.key);
   if(el.dataset.glassLens!==entry.id){el.dataset.glassLens=entry.id;el.style.setProperty('--glass-lens',`url("#${entry.id}")`);el.style.setProperty('--glass-rim',`url("${entry.rimUrl}")`);}
  }
  for(const el of observed)if(!alive.has(el)){resize.unobserve(el);observed.delete(el);clearElement(el);}
  for(const [key,entry] of maps)if(!used.has(key)){entry.filter.remove();maps.delete(key);}
 }
 function apply(U={}){
  const material=U.surfaceMaterial==='liquid'?'liquid':'blur';
  config=window.PulseGlassModel.profile(U.glassFx);
  const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)).join(',');
  const vars={'--lg-edge':Math.min(.24,.07+(config.rim?config.rimPower*.001:0)),'--lg-tint':rgb(config.tintColor),'--lg-saturation':config.color?config.saturation/100:1,'--lg-contrast':config.color?config.contrast/100:1,'--lg-sheen':config.sheen?config.sheenPower/100:0,'--lg-angle':config.sheenAngle+'deg','--lg-shadow':`0 8px ${config.shadowSize}px rgba(0,0,0,${config.shadow?config.shadowPower/100:0})`,'--lg-inner':`inset 0 -2px ${config.innerSize}px rgba(0,0,0,${config.innerShadow?config.innerPower/100:0})`,'--lg-glow':`0 0 ${config.glowSize}px rgba(${rgb(config.glowColor)},${config.glow?config.glowPower/100:0})`};
  for(const[k,v]of Object.entries(vars))B.style.setProperty(k,String(v));
  B.dataset.surfaceMaterial=material;
  // Restore real translucency, but retain enough dimming for text over white artwork.
  const opacity=Number(U.glassOp??60)/100;
  B.style.setProperty('--surface-alpha',String(material==='liquid'?.52:Math.max(.64,Math.min(.85,Number.isFinite(opacity)?opacity:.6))));
  queue();
 }
 // Only the obstructing hide button changes the local lower bound, not every menu.
 function fitMenu(el){
  const bar=document.getElementById('bar'),button=document.getElementById('btnBarHide');
  if(!el||!bar||B.classList.contains('player-bar-hidden'))return;
  const br=bar.getBoundingClientRect(),visual=el.getBoundingClientRect(),left=parseFloat(el.style.left)||visual.left,topY=parseFloat(el.style.top)||visual.top,r={left,right:left+el.offsetWidth,top:topY,bottom:topY+el.offsetHeight};if(br.width<1||br.height<1)return;
  let bottom=br.top-8;
  if(button){const b=button.getBoundingClientRect();if(b.width>0&&r.left<b.right+4&&r.right>b.left-4)bottom=Math.min(bottom,b.top-4);}
  const top=typeof window.menuTop==='function'?window.menuTop():8;
  if(r.bottom>bottom){el.style.maxHeight=Math.max(44,bottom-top)+'px';el.style.top=Math.max(top,Math.min(r.top,bottom-el.offsetHeight))+'px';}
 }
 let flags='';
 const observer=new MutationObserver(records=>{
  for(const rec of records){
   if(rec.type==='attributes'){
    if(rec.target===B){const f=[B.dataset.surfaceMaterial,B.classList.contains('perf-lite')].join(':');if(f!==flags){flags=f;queue();}}
    else if(rec.target.matches?.(selector))queue();
   }else if([...rec.addedNodes,...rec.removedNodes].some(n=>n.nodeType===1&&(n.matches?.(selector)||n.querySelector?.(selector))))queue();
  }
 });
 observer.observe(B,{childList:true,subtree:true,attributes:true,attributeFilter:['class','data-surface-material']});
 for(const m of [reduce,forced])m.addEventListener('change',queue);
 window.addEventListener('resize',queue,{passive:true});
 window.PulseGlass={apply,fitMenu,refresh:queue,stats:()=>({material:B.dataset.surfaceMaterial,refraction:enabled(),filters:maps.size,observed:observed.size,scans})};
 apply(typeof S==='function'?S().ui:{});
})();
