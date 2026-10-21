/* User-owned, portable backgrounds. Raster files are decoded, downscaled and
   re-encoded locally; no paths, SVG, remote URLs or executable CSS are accepted. */
(() => {
 'use strict';
 const DEFAULT={mode:'default',first:'#13202c',second:'#28162d',angle:135,dim:65,blur:0,image:'',name:''};
 const color=(x,f)=>/^#[0-9a-f]{6}$/i.test(x||'')?x:f;
 const num=(x,min,max,f)=>Number.isFinite(+x)?Math.max(min,Math.min(max,+x)):f;
 const image=x=>typeof x==='string'&&x.length<=1500000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(x)?x:'';
 function normalize(v){v=v&&typeof v==='object'?v:{};return {mode:['default','solid','gradient','image'].includes(v.mode)?v.mode:'default',first:color(v.first,DEFAULT.first),second:color(v.second,DEFAULT.second),angle:num(v.angle,0,360,135),dim:num(v.dim,0,85,65),blur:num(v.blur,0,30,0),image:image(v.image),name:typeof v.name==='string'?v.name.slice(0,120):''};}
 const model={normalize,color,image,DEFAULT};
 if(typeof module==='object'&&module.exports){module.exports=model;return;}
 let layer,last='',busy=false,epoch=0;
 const get=()=>{const l=S().look;if(!l.background||typeof l.background!=='object'||Array.isArray(l.background))l.background={...DEFAULT};return normalize(l.background);};
 function apply(){
  const c=get(),active=c.mode!=='default',b=document.body;b.dataset.background=c.mode;
  if(!layer){layer=document.createElement('div');layer.id='pulseBackdrop';layer.setAttribute('aria-hidden','true');layer.innerHTML='<div class="pb-image"></div><div class="pb-shade"></div>';b.prepend(layer);}
  layer.hidden=!active;if(!active)return;
  const sig=JSON.stringify(c);if(sig===last)return;last=sig;
  const img=layer.firstElementChild;
  img.style.backgroundImage=c.mode==='gradient'?`linear-gradient(${c.angle}deg,${c.first},${c.second})`:c.mode==='image'&&c.image?`url("${c.image}")`:'none';
  img.style.backgroundColor=c.first;img.style.filter=c.blur&&c.mode==='image'?`blur(${c.blur}px)`:'none';
  layer.lastElementChild.style.background=`rgba(0,0,0,${c.mode==='solid'?0:c.dim/100})`;
 }
 function rows(){
  const c=get(),p='look.background.';
  const theme=`<div class="pb-themes">${PULSE_THEME_NAMES.map(([k,n])=>`<button class="chip ${S().look.theme===k?'on':''}" data-sact="cx:theme:${k}">${esc(n)}</button>`).join('')}</div>`;
  const content=[grp('Тема и фон'),R('Тема приложения','Готовые темы меняют цвета и форму интерфейса. Твой фон сохраняется.',theme,'тема theme фон background'),
   R('Задний фон','Выбери стандартный фон, цвет, градиент или своё изображение.',sel(p+'mode',[['default','Стандартный'],['solid','Сплошной цвет'],['gradient','Градиент'],['image','Своё изображение']]),'фон фото картинка градиент background wallpaper')];
  if(c.mode==='solid'||c.mode==='gradient')content.push(R(c.mode==='solid'?'Цвет фона':'Первый цвет','',colr(p+'first')));
  if(c.mode==='gradient')content.push(R('Второй цвет','',colr(p+'second')),R('Направление градиента','',rng(p+'angle',0,360,5,'°')));
  if(c.mode==='image')content.push(R('Изображение фона','JPG, PNG, WebP или AVIF, до 20 МБ. Копия хранится в настройках; исходный файл не меняется.',`<div class="pb-actions"><button class="btn" data-background-pick>${ico('folder')}Выбрать изображение</button>${c.image?'<button class="btn ghost" data-background-remove>Удалить изображение</button>':''}</div>`),{raw:`<p class="pb-file" data-i18n-skip>${esc(c.image?c.name:'')}</p>`,kw:'фон изображение'});
  if(c.mode==='gradient'||c.mode==='image')content.push(R('Затемнение фона','Для читаемости текста поверх ярких изображений.',rng(p+'dim',0,85,5,'%')));
  if(c.mode==='image')content.push(R('Размытие изображения','',rng(p+'blur',0,30,1,'px')));
  if(c.mode!=='default')content.push({raw:`<div class="pb-preview" role="img" aria-label="Предпросмотр фона"><span>Предпросмотр фона</span></div>`,kw:'фон предпросмотр'});
  return content;
 }
 function preview(){const e=document.querySelector('.pb-preview');if(!e)return;const c=get();e.style.background=c.mode==='solid'?c.first:c.mode==='gradient'?`linear-gradient(${c.angle}deg,${c.first},${c.second})`:c.image?`url("${c.image}") center/cover`:c.first;e.style.setProperty('--pb-dim',String(c.mode==='solid'?0:c.dim/100));}
 async function encode(file){
  if(!file||file.size>20*1024*1024||!['image/jpeg','image/png','image/webp','image/avif'].includes(file.type))throw Error('Выбери JPG, PNG, WebP или AVIF размером до 20 МБ.');
  const sig=new Uint8Array(await file.slice(0,32).arrayBuffer()),text=String.fromCharCode(...sig);
  const valid=file.type==='image/jpeg'?sig[0]===255&&sig[1]===216&&sig[2]===255:file.type==='image/png'?text.startsWith('\x89PNG\r\n\x1a\n'):file.type==='image/webp'?text.startsWith('RIFF')&&text.slice(8,12)==='WEBP':text.slice(4,8)==='ftyp'&&/avif|avis/.test(text.slice(8));
  if(!valid)throw Error('Изображение слишком большое или повреждено.');
  const url=URL.createObjectURL(file);try{
   const im=new Image();im.src=url;await im.decode();
   if(!im.naturalWidth||!im.naturalHeight||im.naturalWidth*im.naturalHeight>80000000)throw Error('Изображение слишком большое или повреждено.');
   let scale=Math.min(1,2048/Math.max(im.naturalWidth,im.naturalHeight));
   const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(im.naturalWidth*scale));canvas.height=Math.max(1,Math.round(im.naturalHeight*scale));
   const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#09090c';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(im,0,0,canvas.width,canvas.height);
   for(const q of [.88,.76,.62,.48]){const s=canvas.toDataURL('image/jpeg',q);if(image(s))return s;}
   throw Error('Не удалось подготовить изображение. Выбери файл поменьше.');
  }finally{URL.revokeObjectURL(url);}
 }
 async function pick(){
  if(busy)return;const input=document.createElement('input');input.type='file';input.accept='image/jpeg,image/png,image/webp,image/avif';
  input.onchange=async()=>{if(!input.files?.[0]||busy)return;busy=true;const key=++epoch,old=S().look.background;
   try{const f=input.files[0],data=await encode(f);if(key!==epoch||S().look.background!==old)return;
    S().look.background={...get(),mode:'image',image:data,name:f.name.slice(0,120)};apply();save();rerenderSettings();toast('Фон сохранён','check');
   }catch(e){toast(PulseI18n.t(e.message),'alert');}finally{busy=false;}
  };input.click();
 }
 document.addEventListener('click',e=>{if(e.target.closest('[data-background-pick]'))pick();if(e.target.closest('[data-background-remove]')){epoch++;S().look.background={...get(),image:'',name:''};apply();save();rerenderSettings();}});
 // Reflect live controls without replacing the DOM under an active slider.
 document.addEventListener('change',e=>{if(e.target.dataset.sel==='look.background.mode')epoch++;});
 document.addEventListener('input',e=>{if((e.target.dataset.rg||e.target.dataset.col||'').startsWith('look.background.'))requestAnimationFrame(preview);});
 const observer=new MutationObserver(rs=>{if(rs.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches?.('.pb-preview')||n.querySelector?.('.pb-preview')))))preview();});
 observer.observe(document.body,{childList:true,subtree:true});
 window.PulseBackground={...model,apply,rows,encode};
})();
