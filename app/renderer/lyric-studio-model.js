/* Pure enhanced-LRC authoring model. No audio, network or library writes. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PulseLyricModel=api;})(typeof window==='object'?window:globalThis,()=>{
 'use strict';
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,Number.isFinite(+v)?+v:a));
 const round=v=>Math.round(v*100)/100;
 const format=v=>{const n=Math.round(Math.max(0,+v||0)*100);return String(Math.floor(n/6000)).padStart(2,'0')+':'+String(Math.floor(n/100)%60).padStart(2,'0')+'.'+String(n%100).padStart(2,'0');};
 function tokens(text,locale='ru'){text=String(text).trim();if(!text)return[];if(/\s/.test(text))return text.split(/\s+/);if(/[\u3040-\u30ff\u3400-\u9fff]/.test(text)&&typeof Intl.Segmenter==='function'){const out=[];for(const x of new Intl.Segmenter(locale,{granularity:'word'}).segment(text)){if(x.isWordLike||!out.length)out.push(x.segment);else out[out.length-1]+=x.segment;}return out;}return[text];}
 function distribute(row,text,locale){const parts=tokens(text,locale),end=Math.max(row.t+.01*parts.length,row.end);row.words=parts.map((s,i)=>({s,t:round(row.t+(end-row.t)*i/parts.length),e:round(row.t+(end-row.t)*(i+1)/parts.length)}));row.end=round(end);row.text=parts.join(' ');return row;}
 // Pulse extension: other LRC players ignore the metadata and see an empty final timestamp.
 function readEnding(raw,strict=false){const matches=[...String(raw||'').matchAll(/^\s*\[pulse-end:([^\]]*)\]\s*$/gmi)];if(!matches.length)return null;try{if(matches.length!==1)throw Error('ending');const value=JSON.parse(decodeURIComponent(matches[0][1]));if(!Number.isFinite(value.t)||value.t<0||typeof value.text!=='string'||value.text.length>2000)throw Error('ending');return{t:round(value.t),text:value.text};}catch(e){if(strict)throw Error('ending');return null;}}
 function ensureEnding(doc,duration=86400){const r=doc.rows.find(r=>r.ending);if(!r)return;const last=Math.max(0,...doc.rows.filter(x=>x!==r).map(x=>x.words?.at(-1)?.e??x.t+.01));r.t=round(clamp(r.t,last,duration));r.end=duration;r.words=[];doc.rows.sort((a,b)=>a.t-b.t);}
 function parse(raw,parseRaw,duration=86400,cursor=0,locale='ru'){
  raw=String(raw||'').replace(/\r/g,'');if(raw.length>2*1024*1024)throw Error('large');
  const source=raw.split('\n').filter(s=>s.trim()),timed=source.some(s=>/\[\d{1,3}:\d/.test(s));if(source.length>5000)throw Error('large');
  const ending=readEnding(raw,true);
  const metadata=source.filter(s=>/^\s*\[[a-z][a-z0-9_-]*:[^\]]*\]\s*$/i.test(s)&&!/^\s*\[(?:offset|pulse-end):/i.test(s));
  const lyricLines=source.filter(s=>!/^\s*\[[a-z][a-z0-9_-]*:[^\]]*\]\s*$/i.test(s));
  if(timed&&lyricLines.some(s=>!/^\s*\[\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?\]/.test(s)))throw Error('mixed');
  if(timed&&[...raw.matchAll(/[\[<]\d{1,3}:(\d{1,2}(?:[.:]\d{1,3})?)[\]>]/g)].some(m=>parseFloat(m[1])>=60))throw Error('invalid');
  const parsed=timed?parseRaw(raw):lyricLines.map((text,i)=>({t:cursor+i*3,text}));
  if(timed&&(!parsed.length||parsed.some(l=>!Number.isFinite(l.t))))throw Error('invalid');
  const rows=parsed.map((l,i)=>{const t=clamp(l.t,0,duration),next=parsed[i+1]?.t;const end=clamp(l.words?.at(-1)?.e??(next>t?next-.02:t+3),t+.01,duration);const row={id:'r'+i,t:round(t),end:round(end),text:l.text||'',words:[]};
   if(l.words?.length){row.words=l.words.map((w,k)=>({s:String(w.s),t:round(clamp(w.t,t,duration)),e:round(clamp(w.e??l.words[k+1]?.t??end,w.t,duration))}));for(let k=0;k<row.words.length;k++){const w=row.words[k];w.t=Math.max(t,k?row.words[k-1].t:0,w.t);w.e=Math.max(w.t,Math.min(w.e,row.words[k+1]?.t??duration));}row.end=Math.max(end,row.words.at(-1).e);}
   else if(timed&&!row.text.trim()){if(ending&&round(t)===ending.t){row.ending=true;row.text=ending.text;row.end=duration;}else{row.gap=true;row.end=round(next>t?next:duration);}}else distribute(row,row.text,locale);return row;});if(ending&&(!rows.some(r=>r.ending)||rows.some(r=>!r.ending&&r.t>=ending.t)))throw Error('ending');return{rows,metadata,estimated:!timed||parsed.some(l=>!l.words?.length)};
 }
 function serialize(doc){const ending=doc.rows.find(r=>r.ending);return[...(doc.metadata||[]),...(ending?['[pulse-end:'+encodeURIComponent(JSON.stringify({t:ending.t,text:ending.text}))+']']:[]),...doc.rows.slice().sort((a,b)=>a.t-b.t).filter(r=>r.ending||r.gap||r.words.length).map(r=>'['+format(r.t)+']'+(r.gap||r.ending?'':r.words.map(w=>'<'+format(w.t)+'>'+w.s+'<'+format(w.e)+'>').join(' ')))].join('\n');}
 function wordTime(row,index,value,edge='t',duration=86400){const w=row.words[index];if(!w)return;const prev=row.words[index-1],next=row.words[index+1];if(edge==='e'){w.e=round(clamp(value,w.t,next?.t??duration));row.end=row.words.at(-1).e;}
  else{const length=Math.max(.01,w.e-w.t),limit=Math.max(prev?.e??row.t,(next?.t??duration)-.01);w.t=round(clamp(value,prev?.e??row.t,limit));w.e=round(Math.min(next?.t??duration,Math.max(w.t+.01,w.t+length)));row.end=row.words.at(-1).e;}return w;}
 function moveWord(row,index,value,duration=86400){const w=row.words[index];if(!w)return;const prev=row.words[index-1],next=row.words[index+1],length=w.e-w.t,low=prev?prev.t+.01:row.t,high=(next?next.e-.01:duration)-length;w.t=round(clamp(value,low,Math.max(low,high)));w.e=round(Math.min(duration,w.t+length));if(prev)prev.e=round(Math.min(prev.e,w.t));if(next)next.t=round(Math.max(next.t,w.e));row.end=row.words.at(-1).e;return w;}
 function moveRow(row,value,duration=86400){const last=row.words.at(-1)?.e??row.end,delta=round(clamp(value,0,Math.max(0,duration-(last-row.t)))-row.t);row.t=round(row.t+delta);row.end=round(row.end+delta);row.words.forEach(w=>{w.t=round(w.t+delta);w.e=round(w.e+delta);});return row;}
 return{readEnding,ensureEnding,clamp,round,format,tokens,distribute,parse,serialize,wordTime,moveWord,moveRow};
});
