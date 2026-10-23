/* Read-only envelopes for Prism. No analyser/source, synthetic beat or audio IO. */
(function(root){
  'use strict';
  function create(){
    const bands=new Float32Array(9),lo=new Uint32Array(9),hi=new Uint32Array(9);
    const state={bass:0,mid:0,treble:0,kick:0,power:0,bands,signal:false};
    let key='',bassSlow=0,lastBass=0,cooldown=0;
    const clamp=v=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;
    const smooth=(prev,value,dt,attack=.045,release=.32)=>prev+(value-prev)*(1-Math.exp(-dt/(value>prev?attack:release)));
    function step(fr,elapsed){
      const dt=Math.max(0,Math.min(.1,Number.isFinite(elapsed)?elapsed:0)),f=fr?.f;
      const valid=!!f&&f.length>1&&Number.isFinite(fr.sampleRate)&&fr.sampleRate>0&&Number.isFinite(fr.fftSize)&&fr.fftSize>0;
      const format=valid?fr.sampleRate+':'+fr.fftSize+':'+f.length:'';
      if(format!==key){key=format;lastBass=bassSlow=0;state.kick=0;cooldown=0;
        if(valid){const hz=fr.sampleRate/fr.fftSize,nyquist=Math.min(12000,fr.sampleRate*.48),edges=[40,75,130,220,500,1100,2500,4500,7500,12000];
          for(let i=0;i<9;i++){lo[i]=Math.min(f.length-1,Math.max(1,Math.ceil(Math.min(nyquist,edges[i])/hz)));hi[i]=Math.min(f.length,Math.max(lo[i]+1,Math.ceil(Math.min(nyquist,edges[i+1])/hz)));}}
      }
      state.signal=valid;
      // The waveform keeps quiet/loud dynamics when byte FFT bins saturate.
      // Soft compression keeps quiet music visible, but silence stays zero.
      let level=1;
      if(valid&&fr.w?.length){let square=0,n=0;for(let i=0;i<fr.w.length;i+=2){const v=Number.isFinite(fr.w[i])?Math.max(-1,Math.min(1,(fr.w[i]-128)/128)):0;square+=v*v;n++;}level=Math.min(1,Math.sqrt(Math.sqrt(square/Math.max(1,n)))*1.8);}
      for(let i=0;i<9;i++){
        let sum=0;
        if(valid)for(let j=lo[i];j<hi[i];j++){const v=clamp(f[j]/255);sum+=v*v;}
        const value=valid?clamp((Math.sqrt(sum/Math.max(1,hi[i]-lo[i]))-.025)/.83)*level:0;
        bands[i]=smooth(bands[i],value,dt,.035,.27);
      }
      const bass=valid?(bands[0]+bands[1]+bands[2]) / 3:0;
      const mid=valid?(bands[3]+bands[4]+bands[5])/3:0;
      const high=valid?(bands[6]+bands[7]+bands[8])/3:0;
      state.bass=smooth(state.bass,bass,dt);state.mid=smooth(state.mid,mid,dt,.06,.4);state.treble=smooth(state.treble,high,dt,.035,.24);
      state.power=clamp(state.bass*.5+state.mid*.35+state.treble*.15);
      cooldown=Math.max(0,cooldown-dt);state.kick*=Math.exp(-dt/.38);
      // An onset must come from actual rising low-frequency energy; no clock-
      // based pulse on silence, pause, missing remote signal or constant tones.
      if(valid&&cooldown===0&&bass>.13&&bass-bassSlow>.075&&bass-lastBass>.012){state.kick=Math.max(state.kick,clamp((bass-bassSlow)*2.7));cooldown=.16;}
      bassSlow=smooth(bassSlow,bass,dt,.32,.5);lastBass=bass;
      if(!valid&&state.power<.0001){bands.fill(0);state.bass=state.mid=state.treble=state.power=state.kick=0;}
      return state;
    }
    return {step,state};
  }
  root.PulsePrismSignal={create};
  if(typeof module!=='undefined'&&module.exports)module.exports={create};
})(typeof window!=='undefined'?window:globalThis);
