/* Pulse Immersion: deterministic worlds and a causal, live-audio director. No playback writes. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PulseImmersionCore=api;})(typeof window==='object'?window:globalThis,()=>{
 'use strict';
 const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:a));
 function hash(s){let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
 function world(id){const n=hash(id);return{seed:(n%100003)/137.0,world:n%3,hue:((n>>>8)%1000)/1000};}
 function create(){let key='',power=0,slow=0,kick=0,prevLow=0,age=0,lastHit=-10,lastCut=-30,worldId=0,phase='drift',mean=.08,prevRms=0,bass=0,mid=0,treble=0;
  return{reset(id){key=String(id);power=slow=kick=prevLow=prevRms=bass=mid=treble=age=0;lastHit=-10;lastCut=-30;phase='drift';mean=.08;worldId=world(key).world;},step({id='',dt=1/60,freq=null,wave=null,sampleRate=48000,fftSize=2048,playing=false,calm=false,position=0}={}){
   if(String(id)!==key)this.reset(id);dt=clamp(dt,.001,.5);age+=playing?dt:0;let low=0,rms=0,flux=0,midRaw=0,highRaw=0,midN=0,highN=0,signal=!!(playing&&freq&&freq.length>16);
   if(signal){let n=0,sum=0;const hz=sampleRate/Math.max(1,fftSize);for(let i=1;i<freq.length;i++){const v=clamp(freq[i]/255);if(i*hz>=40&&i*hz<=180){low+=v*v;n++;}if(i*hz>180&&i*hz<=2500){midRaw+=v*v;midN++;}if(i*hz>2500&&i*hz<=12000){highRaw+=v*v;highN++;}sum+=v*v;}low=Math.sqrt(low/Math.max(1,n));rms=Math.sqrt(sum/freq.length);if(wave&&wave.length){let r=0;for(let i=0;i<wave.length;i++){const v=(wave[i]-128)/128;r+=v*v;}rms=Math.sqrt(r/wave.length);}flux=Math.max(0,low-prevLow);}
   const hit=signal&&rms>.004&&age-lastHit>.21&&((flux>.025+mean*.10&&low>mean*.9)||rms-prevRms>.035);if(hit)lastHit=age;
   kick=Math.max(kick*Math.exp(-dt/0.32),hit?clamp(flux*3.5+(rms-prevRms)*2,.22,1):0);if(!signal)kick=0;
   const amplitude=rms>.0005?clamp(Math.sqrt(rms*3.0)):1;const bandEase=1-Math.exp(-dt/.1);bass+=(clamp(low*1.8)*amplitude-bass)*bandEase;mid+=(clamp(Math.sqrt(midRaw/Math.max(1,midN))*2)*amplitude-mid)*bandEase;treble+=(clamp(Math.sqrt(highRaw/Math.max(1,highN))*2.4)*amplitude-treble)*bandEase;
   const level=signal?clamp(1-Math.exp(-rms*5.5)):0;power+=(level-power)*(1-Math.exp(-dt/(level>power?.12:.5)));slow+=(power-slow)*(1-Math.exp(-dt/5));mean+=(low-mean)*(1-Math.exp(-dt/1.5));
   phase=!playing?'paused':!signal?'ambient':power<.14?'drift':power>slow+.11?'rise':power>.52?'impact':'flow';
   let cut=false;if(!calm&&phase==='impact'&&hit&&age-lastCut>20&&age>8){worldId=(worldId+1)%3;lastCut=age;cut=true;}
   prevLow=signal?low:0;prevRms=signal?rms:0;
   return{power:clamp(power),bass:signal?clamp(bass):0,mid:signal?clamp(mid):0,treble:signal?clamp(treble):0,slow:clamp(slow),kick:calm?0:clamp(kick),hit,signal,world:worldId,phase,cut,age,speed:!playing?0:calm?.06:signal?.12+power*.55:.07,position:clamp(position,0,864000)};
  }};
 }
 function lyric(lines,time){if(!Array.isArray(lines)||!Number.isFinite(time))return null;let lo=0,hi=lines.length-1,k=-1;while(lo<=hi){const m=(lo+hi)>>1;if(Number(lines[m].t)<=time){k=m;lo=m+1;}else hi=m-1;}const l=lines[k];if(!l||l.gap||!l.text||time>(Number(l.end)||Number(lines[k+1]?.t)||Number(l.t)+9))return null;return{index:k,text:String(l.text).slice(0,260),words:Array.isArray(l.words)?l.words.filter(w=>!w.bg).slice(0,80):null};}
 function coverColor(palette){const p=Array.isArray(palette)?palette.find(c=>Array.isArray(c)&&c.length>=3&&c.slice(0,3).every(Number.isFinite)):null;if(!p)return[.78,.83,.9];const mx=Math.max(...p.slice(0,3));if(mx<=0)return[.78,.83,.9];const k=mx>1?1/255:1;return p.slice(0,3).map(x=>clamp(x*k,0,1));}
 return{hash,world,create,lyric,clamp,coverColor};
});
