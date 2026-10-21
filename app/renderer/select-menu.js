/* One event-driven dropdown surface for all native single selects and track submenus.
   Keep each real <select>: its values, labels, form behavior and existing change handlers survive. */
(() => {
 'use strict';
 let serial=0,active=null,sub=null,search='',searchAt=0;
 const native=s=>s?.tagName==='SELECT'&&!s.multiple&&s.size<=1&&!s.disabled;
 const check='<svg class="pulse-menu-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
 function enhance(root){const nodes=root.matches?.('select')?[root]:root.querySelectorAll?.('select')||[];for(const s of nodes)if(native(s)){s.classList.add('pulse-select');s.setAttribute('aria-haspopup','listbox');}}
 function close(){if(!active)return;active.select.setAttribute('aria-expanded','false');active.select.removeAttribute('aria-controls');active.select.removeAttribute('aria-activedescendant');if(window.PulseMotion)PulseMotion.remove(active.popup,'menu');else active.popup.remove();active=null;search='';}
 function closeSub(){document.getElementById('menu')?.classList.remove('pulse-parent-hidden');if(!sub)return;sub.anchor?.setAttribute('aria-expanded','false');if(window.PulseMotion)PulseMotion.remove(sub.popup,'menu');else sub.popup.remove();sub=null;}
 function place(popup,rect,side=false){
  const pad=8,minY=Math.max(pad,typeof window.menuTop==='function'?window.menuTop():pad),vw=innerWidth,vh=typeof window.menuBottom==='function'?window.menuBottom()+pad:innerHeight;
  const width=Math.min(vw-pad*2,Math.max(side?240:220,side?0:rect.width));popup.style.width=width+'px';
  if(side&&vw>560){let left=rect.right+6;if(left+width>vw-pad)left=rect.left-width-6;popup.style.left=Math.max(pad,Math.min(left,vw-width-pad))+'px';popup.style.maxHeight=Math.max(44,vh-minY-pad)+'px';popup.style.top=Math.max(minY,Math.min(rect.top,vh-popup.scrollHeight-pad))+'px';}
  else{const below=vh-rect.bottom-pad,above=rect.top-minY,up=below<Math.min(popup.scrollHeight,220)&&above>below,space=Math.max(44,up?above-6:below-6);popup.style.maxHeight=Math.min(420,space)+'px';popup.style.left=Math.max(pad,Math.min(rect.left,vw-width-pad))+'px';popup.style.top=(up?Math.max(minY,rect.top-Math.min(popup.scrollHeight,space,420)-6):Math.max(minY,rect.bottom+6))+'px';}
  window.PulseGlass?.fitMenu(popup);
 }
 function activate(index,scroll=true){if(!active)return;const list=active.rows;if(!list.length)return;index=(index+list.length)%list.length;active.index=index;for(let i=0;i<list.length;i++)list[i].classList.toggle('is-active',i===index);active.select.setAttribute('aria-activedescendant',list[index].id);if(scroll)list[index].scrollIntoView({block:'nearest'});}
 function choose(row){if(!active||row.disabled)return;const s=active.select,index=+row.dataset.option;close();if(!s.isConnected||s.disabled)return;const changed=s.selectedIndex!==index;s.selectedIndex=index;s.focus({preventScroll:true});if(changed){s.dispatchEvent(new Event('input',{bubbles:true}));s.dispatchEvent(new Event('change',{bubbles:true}));}}
 function open(s){
  if(!native(s))return;if(active?.select===s)return close();close();closeSub();window.hideMenu?.();
  window.PulseMotion?.flush('menu');enhance(s);const popup=document.createElement('div');popup.id='pulse-select-'+ ++serial;popup.className='menu pulse-select-menu';popup.setAttribute('role','listbox');popup.setAttribute('data-i18n-skip','');
  const name=s.getAttribute('aria-label')||[...(s.labels||[])].map(l=>l.textContent.trim()).join(' ')||s.title||'';if(name)popup.setAttribute('aria-label',name);
  const rows=[];let group=null;
  for(const [i,option]of [...s.options].entries()){
   const parent=option.parentElement;if(parent?.tagName==='OPTGROUP'&&group!==parent){group=parent;const h=document.createElement('div');h.className='pulse-select-group';h.textContent=parent.label;popup.append(h);}
   if(option.hidden)continue;
   const row=document.createElement('button');row.type='button';row.className='mi';row.id=popup.id+'-'+i;row.dataset.option=i;row.setAttribute('role','option');row.setAttribute('aria-selected',String(i===s.selectedIndex));row.disabled=option.disabled||!!(parent?.tagName==='OPTGROUP'&&parent.disabled);row.tabIndex=-1;
   const label=document.createElement('span');label.className='pulse-menu-label';label.textContent=option.label;row.append(label);row.insertAdjacentHTML('beforeend',check);popup.append(row);if(!row.disabled)rows.push(row);
   row.addEventListener('pointerdown',e=>e.preventDefault());row.onclick=e=>{e.preventDefault();e.stopPropagation();choose(row);};row.onpointermove=()=>{if(!row.disabled)activate(rows.indexOf(row),false);};
  }
  (s.closest('dialog[open]')||document.body).append(popup);active={select:s,popup,rows,index:0};s.setAttribute('aria-expanded','true');s.setAttribute('aria-controls',popup.id);s.focus({preventScroll:true});place(popup,s.getBoundingClientRect());activate(Math.max(0,rows.findIndex(r=>+r.dataset.option===s.selectedIndex)));
 }
 function children(item){return typeof item?.[3]==='function'?item[3]():item?.[3];}
 function openSub(anchor,item){
  const items=children(item);if(!items?.length)return;if(sub?.anchor===anchor)return;close();closeSub();
  window.PulseMotion?.flush('menu');const popup=document.createElement('div');popup.className='menu pulse-submenu';popup.setAttribute('role','menu');popup.setAttribute('aria-label',anchor.textContent.trim());anchor.setAttribute('aria-expanded','true');
  const add=(icon,label,run)=>{const b=document.createElement('button');b.type='button';b.className='mi';b.setAttribute('role','menuitem');if(typeof ico==='function')b.innerHTML=ico(icon);const span=document.createElement('span');span.className='pulse-menu-label';span.textContent=label;b.append(span);b.onclick=e=>{e.stopPropagation();closeSub();window.hideMenu?.();run?.();};popup.append(b);return b;};
  const small=innerWidth<=560;if(small){const back=add('back','Назад',()=>{});back.classList.add('pulse-menu-back');back.onclick=e=>{e.stopPropagation();closeSub();document.getElementById('menu')?.classList.remove('pulse-parent-hidden');};}
  for(const it of items)if(it==='-'){const line=document.createElement('div');line.className='mi sep';popup.append(line);}else add(it[0],it[1],it[2]);
  document.body.append(popup);sub={anchor,popup};if(small){const parent=document.getElementById('menu'),rect=parent.getBoundingClientRect();parent.classList.add('pulse-parent-hidden');popup.style.width=Math.min(innerWidth-16,Math.max(240,rect.width))+'px';popup.style.left=Math.max(8,Math.min(rect.left,innerWidth-popup.offsetWidth-8))+'px';const bottom=typeof window.menuBottom==='function'?window.menuBottom():innerHeight-8;popup.style.maxHeight=Math.max(44,bottom-rect.top)+'px';popup.style.top=Math.max(8,Math.min(rect.top,bottom-popup.offsetHeight))+'px';}else place(popup,anchor.getBoundingClientRect(),true);window.PulseGlass?.fitMenu(popup);
 }
 document.addEventListener('pointerdown',e=>{
  const s=e.target.closest?.('select');if(native(s)){e.preventDefault();e.stopPropagation();open(s);return;}
  if(active&&!active.popup.contains(e.target))close();if(sub&&!sub.popup.contains(e.target)&&!e.target.closest?.('#menu')){closeSub();document.getElementById('menu')?.classList.remove('pulse-parent-hidden');}
 },true);
 // Prevent Chromium's OS picker, including synthetic mouse activation and F4.
 document.addEventListener('mousedown',e=>{if(native(e.target.closest?.('select')))e.preventDefault();},true);
 document.addEventListener('click',e=>{if(native(e.target.closest?.('select'))){e.preventDefault();e.stopPropagation();}},true);
 document.addEventListener('keydown',e=>{
  const s=active?.select||e.target.closest?.('select');
  if(!native(s)){
   if(sub&&e.key==='Escape'){e.preventDefault();closeSub();document.getElementById('menu')?.classList.remove('pulse-parent-hidden');return;}
   if(sub&&sub.popup.contains(e.target)&&['ArrowDown','ArrowUp','Home','End','ArrowLeft'].includes(e.key)){e.preventDefault();e.stopPropagation();if(e.key==='ArrowLeft'){const a=sub.anchor;closeSub();document.getElementById('menu')?.classList.remove('pulse-parent-hidden');a.focus();return;}const rows=[...sub.popup.querySelectorAll('button.mi')],n=rows.indexOf(document.activeElement),i=e.key==='Home'?0:e.key==='End'?rows.length-1:(n+(e.key==='ArrowDown'?1:-1)+rows.length)%rows.length;rows[i]?.focus();}return;
  }
  if(e.key==='Tab'){close();return;}
  if(e.key==='Escape'){if(active){e.preventDefault();e.stopPropagation();close();}return;}
  const character=e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&e.key!==' ';
  if(!['ArrowDown','ArrowUp','Enter',' ','Home','End','PageDown','PageUp','F4'].includes(e.key)&&!character)return;
  e.preventDefault();e.stopPropagation();const wasOpen=!!active;if(!active)open(s);if(!active)return;
  if(character){const now=performance.now();search=now-searchAt>700?e.key.toLowerCase():search+e.key.toLowerCase();searchAt=now;const i=active.rows.findIndex(r=>r.textContent.trim().toLowerCase().startsWith(search));if(i>=0)activate(i);return;}
  if((e.key==='Enter'||e.key===' ')&&wasOpen){choose(active.rows[active.index]);return;}
  if(e.key==='F4'&&wasOpen)return close();
  if(e.key==='Home')activate(0);else if(e.key==='End')activate(active.rows.length-1);else if(wasOpen&&e.key.startsWith('Arrow'))activate(active.index+(e.key==='ArrowDown'?1:-1));else if(e.key==='PageDown'||e.key==='PageUp')activate(Math.max(0,Math.min(active.rows.length-1,active.index+(e.key==='PageDown'?8:-8))));
 },true);
 document.addEventListener('pointerover',e=>{if(innerWidth<=560)return;const row=e.target.closest?.('#menu [data-mi]');if(!row||row.contains(e.relatedTarget))return;const item=document.getElementById('menu')._items?.[+row.dataset.mi];if(children(item))openSub(row,item);else if(sub)closeSub();});
 document.addEventListener('keydown',e=>{const row=e.target.closest?.('#menu [data-mi]');if(!row)return;const parent=document.getElementById('menu'),item=parent._items?.[+row.dataset.mi];
  if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();const rows=[...parent.querySelectorAll('[data-mi]')],n=rows.indexOf(row),i=e.key==='Home'?0:e.key==='End'?rows.length-1:(n+(e.key==='ArrowDown'?1:-1)+rows.length)%rows.length;rows[i]?.focus();}
  else if(children(item)&&['ArrowRight','Enter',' '].includes(e.key)){e.preventDefault();e.stopPropagation();openSub(row,item);sub?.popup.querySelector('button')?.focus();}
  else if(['Enter',' '].includes(e.key)){e.preventDefault();e.stopPropagation();row.click();}
  else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();window.hideMenu?.();}
 },true);
 document.addEventListener('scroll',e=>{if(active&&!active.popup.contains(e.target)&&(e.target===document||e.target.contains?.(active.select)))place(active.popup,active.select.getBoundingClientRect());if(sub&&!sub.popup.contains(e.target)&&!e.target.closest?.('#menu')&&(e.target===document||e.target.contains?.(sub.anchor)))closeSub();},true);
 window.addEventListener('resize',()=>{close();closeSub();document.getElementById('menu')?.classList.remove('pulse-parent-hidden');});window.addEventListener('blur',()=>{close();closeSub();});
 const observer=new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes)if(n.nodeType===1)enhance(n);if(active&&!active.select.isConnected)close();if(sub&&!sub.anchor.isConnected)closeSub();});
 const start=()=>{enhance(document);observer.observe(document.documentElement,{subtree:true,childList:true});};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
 window.PulseSelect={open,close,enhance};window.PulseMenus={openSub,closeSub};
})();
