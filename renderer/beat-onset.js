/* Pulse: audio-onset envelope. Waveform dynamics preserve attacks when byte FFT bins clip. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PulseBeatOnset=api;})(typeof window==='object'?window:globalThis,function(){
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function create(){let prev=null,meanLow=0,meanSnap=0,last=-Infinity,age=0,pulse=0,key=null,meanWave=0,meanBody=0,prevWave=0,prevBody=0;
  return {reset(){prev=null;meanLow=meanSnap=age=pulse=meanWave=meanBody=prevWave=prevBody=0;last=-Infinity;key=null;},step(f,{sampleRate=48000,fftSize=2048,dt=1/60,playing=true,track='',wave=null}={}){
   dt=clamp(dt,.001,.5);if(track!==key){this.reset();key=track;}
   pulse*=Math.exp(-dt/.145);if(!playing||!f){this.reset();key=track;return{pulse:0,level:0,hit:false,body:0,rms:0};}
   if(prev&&prev.length!==f.length)prev=null;
   const hz=sampleRate/fftSize;let low=0,snap=0,lf=0,sf=0,nl=0,ns=0;
   for(let i=1;i<f.length;i++){const h=i*hz,v=f[i]/255,d=prev?Math.max(0,v-prev[i]/255):0;if(h>=40&&h<=180){low+=v*v;lf+=d;nl++;}else if(h>=700&&h<=5000){snap+=v*v;sf+=d;ns++;}}
   low/=Math.max(1,nl);snap/=Math.max(1,ns);lf/=Math.max(1,nl);sf/=Math.max(1,ns);age+=dt;
   let rms=0,body=0,weight=0;
   const validWave=wave&&wave.length>=256;
   if(validWave){let lp180=0,lp40=0;const a=1-Math.exp(-2*Math.PI*180/sampleRate),b=1-Math.exp(-2*Math.PI*40/sampleRate),N=wave.length;
    for(let i=0;i<N;i++){const x=(wave[i]-128)/128;lp180+=a*(x-lp180);lp40+=b*(x-lp40);const w=.5-.5*Math.cos(2*Math.PI*i/(N-1));rms+=x*x*w;body+=(lp180-lp40)**2*w;weight+=w;}
    rms=Math.sqrt(rms/weight);body=Math.sqrt(body/weight);
   }
   const kick=low>.012&&lf>.022&&low>meanLow*1.10+.006;
   const snare=snap>.010&&sf>.030&&snap>meanSnap*1.16+.007;
   const waveKick=validWave&&body>.002&&body-prevBody>Math.max(.001,meanBody*.075)&&body>meanBody*1.12+.0006;
   const waveAttack=validWave&&rms>.004&&rms-prevWave>Math.max(.002,meanWave*.10)&&rms>meanWave*1.16+.001;
   const hit=!!(prev&&age>.18&&age-last>.17&&(kick||snare||waveKick||waveAttack));
   if(hit){last=age;const waveStrength=Math.max((body-prevBody)/(meanBody+.006),(rms-prevWave)/(meanWave+.012));pulse=clamp(Math.max((kick?lf:sf)*4.2,waveStrength*1.6),.42,1);}
   const k=1-Math.exp(-dt/.42);meanLow+=(low-meanLow)*k;meanSnap+=(snap-meanSnap)*k;meanWave+=(rms-meanWave)*k;meanBody+=(body-meanBody)*k;
   const level=validWave&&rms>.004?clamp((body/(meanBody+.006)-.72)*.18,0,.25):0;
   prevBody=body;prevWave=rms;if(!prev||prev.length!==f.length)prev=new Uint8Array(f.length);prev.set(f);return{pulse,hit,level,low,snap,body,rms};
  }};
 }
 const detector=create();return{create,step:detector.step.bind(detector),reset:detector.reset.bind(detector)};
});
