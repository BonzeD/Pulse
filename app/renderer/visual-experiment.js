/* 1.0.0 panel9: isolated frame cadence for coverfield and optional Neon Circle GPU. No audio engine changes. */
const VisualExperiment = (() => {
  let raf=0,last=0,active=false,localBeat=0,prevBass=0;
  function eligible(){if(window.PulseImmersion?.active())return false;const V=S().viz;return ((V.directExperiment!==false&&lib.vizStyle==='coverfield')||(V.neonExperiment===true&&lib.vizStyle==='radial'))&&lib.mode==='visual'&&ppOpenNow&&!lyOnlyNow&&!mrOnNow&&!hiddenNow&&!document.hidden&&S().perf.gpu!==false&&Viz.canDirect(V.fx);}
  function sync(){const on=eligible();if(on&&!active){active=true;last=0;localBeat=0;prevBass=0;raf=requestAnimationFrame(tick);}else if(!on&&active){active=false;cancelAnimationFrame(raf);raf=0;Viz.hideDirect();}return on;}
  function tick(now){raf=0;if(!eligible()){active=false;Viz.hideDirect();return;}raf=requestAnimationFrame(tick);
    const P=S().perf,V=S().viz;let gap=P.mode==='eco'?32:P.fps>0?Math.max(0,1000/P.fps-2):0;
    if(P.bgSlow!==false&&P.mode!=='high'&&!winFocused)gap=Math.max(gap,32);
    if(now-last<gap)return;const dt=Math.min(.1,last?(now-last)/1000:1/60);last=now;
    const lag=V.lag||0,ht=heard(lag),fr=readSpectrum(now,outLat()*1000+lag),tempo=tempoAt(ht),ar=artRect();
    localBeat*=Math.exp(-dt/0.14);
    if(fr){const hz=fr.sampleRate/fr.fftSize;let b=0,n=0;for(let i=Math.max(1,Math.floor(40/hz));i<=Math.ceil(150/hz)&&i<fr.f.length;i++){b+=fr.f[i];n++;}b=n?b/(n*255):0;if(playing&&b>prevBass+.07)localBeat=Math.max(localBeat,Math.min(1,b*1.15));prevBass=b;}
    try{Viz.draw({direct:true,quality:P.mode,sens:V.sens/100,noBars:true,freq:fr?fr.f:null,wave:fr?fr.w:null,beat:(lib.vizStyle==='radial'?beat:Math.max(beat,localBeat))*(V.tempo?1:.6),playing,mode:'visual',style:lib.vizStyle,artRect:ar,center:ar?null:stageCenter(),tempo:V.tempo?tempo:{bpm:100,pos:now/600,conf:0},sr:fr?fr.sampleRate:actx?actx.sampleRate:48000,fx:V.fx,cover:coverImg,energy:beatState.an&&beatState.an.energy?beatState.an.energy(ht):null});}
    catch(e){console.error('visual experiment',e);}
  }
  return {sync,active:()=>active,stats:()=>Viz.stats()};
})();
