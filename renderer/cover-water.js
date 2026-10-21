/* 1.0.0: mirrored artwork sampled in moving scanlines. No shifting SVG noise region or audio routing. */
(()=>{'use strict';let image=null,want='',revision=0,last=0,signature='';
 function install(){const art=$('lysArt');if(!art||!art.closest('#lyStage'))return;
  let wrap=art.parentElement;if(!wrap.classList.contains('lys-art-wrap')){wrap=document.createElement('div');wrap.className='lys-art-wrap';art.before(wrap);wrap.appendChild(art);const water=document.createElement('div');water.className='lys-cover-water';water.setAttribute('aria-hidden','true');water.innerHTML='<canvas class="lys-cover-mirror"></canvas>';wrap.appendChild(water);}
  const url=art.style.backgroundImage;if(url===want)return;want=url;image=null;signature='';const rev=++revision;const c=wrap.querySelector('canvas');c.getContext('2d').clearRect(0,0,c.width,c.height);
  const match=url.match(/^url\(["']?(.*?)["']?\)$/);if(!match||!match[1])return;
  const img=new Image();img.onload=()=>{if(rev!==revision)return;image=img;last=0;draw(lyY(),0,performance.now(),true);};img.onerror=()=>{if(rev===revision)image=null;};img.src=match[1];
 }
 function draw(Y,bass,now,force=false){const canvas=document.querySelector('#lyStage .lys-cover-mirror');if(!canvas||!lys.on||Y.kRefl===false||Y.kCover==='none'||document.body.classList.contains('mr-on')||!image||document.hidden)return;
  const reduced=document.body.classList.contains('no-anim')||matchMedia('(prefers-reduced-motion: reduce)').matches;
  const q=Y.kReflQ||'normal',rip=Math.max(0,Math.min(100,+Y.kRipple||0)),moving=!reduced&&q!=='simple'&&rip>0;
  const width=Math.max(1,Math.min(720,Math.round(canvas.parentElement.getBoundingClientRect().width))),height=Math.max(1,Math.round(width*.48));
  const artStyle=getComputedStyle($('lysArt')),artWidth=$('lysArt').getBoundingClientRect().width;
  const radius=(v)=>v.endsWith('%')?parseFloat(v)*width/100:parseFloat(v)*width/Math.max(1,artWidth);
  const radii=[artStyle.borderBottomLeftRadius,artStyle.borderBottomRightRadius,artStyle.borderTopRightRadius,artStyle.borderTopLeftRadius].map(radius);
  const sig=[width,height,q,rip,Y.kReflBlur,Y.kReflOp,moving,...radii].join('|');if(!force&&(!moving&&sig===signature||now-last<1000/24))return;last=now;signature=sig;
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  const ctx=canvas.getContext('2d'),iw=image.naturalWidth,ih=image.naturalHeight,side=Math.min(iw,ih),sx=(iw-side)/2,sy=(ih-side)/2;
  ctx.clearRect(0,0,width,height);ctx.save();ctx.beginPath();ctx.roundRect(0,0,width,width,radii);ctx.clip();const amp=moving?(rip/100)*(q==='glitch'?32:q==='ultra'?24:18)*(width/540):0,t=now/1000;
  // Preserve cover geometry at the horizon; displacement increases only with water depth.
  const opacity=Math.min(.8,Math.max(.1,(Y.kReflOp??32)/100)*1.35);
  ctx.filter=`blur(${q==='simple'?0:Math.min(2,(Y.kReflBlur??12)/30)}px)`;
  for(let y=0;y<height;y+=2){const depth=y/height,baseY=sy+side-(y+2)/width*side;
   const wave=moving?(Math.sin(y*.105-t*2.0)+.42*Math.sin(y*.23-t*1.3+1.2))*(.28+.72*depth):0;
   const vertical=wave*amp*.65*Math.sin(Math.PI*depth),sourceY=Math.max(sy,Math.min(sy+side-2/width*side,baseY+vertical/width*side));
   const shift=wave*amp*Math.sin(Math.PI*depth),glitch=q==='glitch'&&moving?Math.sin(Math.floor(y/6)*2.3+t*3)*amp*.18*depth:0;
   ctx.globalAlpha=opacity*(1-depth)**1.65;ctx.drawImage(image,sx,Math.max(sy,sourceY),side,2/width*side,shift+glitch,y,width,2.3);
  }
  ctx.restore();canvas.dataset.phase=moving?String(Math.round(now/42)):'static';
 }
 const meta=lysMeta;lysMeta=function(){const r=meta.apply(this,arguments);install();return r;};
 const frame=lysWaterFrame;lysWaterFrame=function(Y,b,now){frame.apply(this,arguments);draw(Y,b,now);};
 window.PulseCoverWater={draw,refresh:install};
})();
