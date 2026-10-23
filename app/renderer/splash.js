'use strict';
/* Pulse prism entrance: original procedural glass, inspired by the Mineradio
 * reference. Shared bounded glass renderer. No second player, audio graph, network or Three.js. */
(function () {
  // Export before the startup opt-out: the explicitly opened easter egg also works
  // when launch art is disabled. No GPU resources are created by this export.
  window.PulsePrismArt = createPrism;
  const el = document.getElementById('splash'); if (!el) return;
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let off = preference.matches;
  try { off = off || localStorage.getItem('pulse.motion') === 'off' || localStorage.getItem('pulse.splash') === 'off' || sessionStorage.getItem('pulse.splashShown') === '1'; sessionStorage.setItem('pulse.splashShown', '1'); } catch {}
  if (off) { el.remove(); return; }
  el.dataset.style = 'prism';
  el.innerHTML = '<div class="sp-prism-static"></div><canvas class="sp-prism" aria-hidden="true"></canvas><div class="sp-vig"></div><div class="sp-grain"></div><div class="sp-core"><div class="sp-word" aria-label="Pulse" data-i18n-skip><b>P</b><b>u</b><b>l</b><b>s</b><b>e</b></div><div class="sp-signal" aria-hidden="true"><i></i></div><p class="sp-tagline" data-i18n-skip></p></div>';
  const captions = {en:'Music in your rhythm',ru:'Музыка в твоём ритме',ja:'あなたのリズムで音楽を',uk:'Музика у твоєму ритмі'};
  const caption = () => { el.querySelector('.sp-tagline').textContent = captions[window.PulseI18n?.language?.()] || captions.en; };
  caption(); window.addEventListener('pulse-language', caption);

  // Initial tray startup waits for visibility. Settings/reload/reduced-motion
  // skip above happens BEFORE any context, frame loop or resize listener exists.
  let t0 = 0, started = false, loaded = document.readyState === 'complete', done = false;
  let startRaf = 0, removal = 0, art = null;
  const timers = [], MIN = 1800, MAX = 4500;
  const schedule = (fn, delay) => { const id = setTimeout(fn, delay); timers.push(id); return id; };
  const onKey = e => { if (['Escape',' ','Enter'].includes(e.key) && started) { e.preventDefault(); e.stopPropagation(); end(); } };
  const onLoad = () => { loaded = true; if (started) tryEnd(); };
  const onMotion = () => { if (preference.matches) end(true); };
  const hidden = () => document.hidden || !!window.pulseWinHidden;
  const onVisibility = () => { if (done) return; if (!started && !hidden()) start(); else if (started) { el.classList.toggle('wait', hidden()); art?.visible(!hidden()); } };
  const onClick = () => { if (started) end(); };
  function cleanup() {
    cancelAnimationFrame(startRaf); timers.forEach(clearTimeout);
    art?.destroy(); art = null;
    window.removeEventListener('load', onLoad); window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('pulse-language', caption); document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pulse-window-visibility', onVisibility);
    preference.removeEventListener?.('change', onMotion); el.removeEventListener('click', onClick);
  }
  function remove() { clearTimeout(removal); el.remove(); document.body.classList.remove('sp-intro'); }
  function end(immediate = false) {
    if (done) return; done = true; cleanup();
    if (immediate) { remove(); return; }
    el.classList.add('bye'); document.body.classList.add('sp-intro');
    removal = setTimeout(remove, 650);
  }
  function tryEnd() { if (loaded && performance.now() - t0 >= MIN - 20) end(); }
  function begin() {
    if (started || done || hidden()) return;
    started = true; t0 = performance.now(); el.classList.remove('wait');
    try { art = createPrism(el.querySelector('canvas'), el); } catch { el.classList.add('sp-prism-fallback'); }
    schedule(tryEnd, MIN); schedule(end, MAX);
  }
  function start() { if (started || done) return; cancelAnimationFrame(startRaf); startRaf = requestAnimationFrame(() => { startRaf = requestAnimationFrame(begin); }); }
  window.addEventListener('load', onLoad); window.addEventListener('keydown', onKey, true);
  window.addEventListener('pulse-window-visibility', onVisibility);
  document.addEventListener('visibilitychange', onVisibility); preference.addEventListener?.('change', onMotion);
  el.addEventListener('click', onClick);
  if (hidden()) el.classList.add('wait'); else start();

  function createPrism(canvas, host, options = {}) {
    const live = options.live === true;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const colors = window.matchMedia('(forced-colors: active)');
    const settings = () => { try { return typeof S === 'function' ? S() : null; } catch { return null; } };
    const calm = () => motion.matches || (live && settings()?.look?.anim === false);
    if (settings()?.perf?.gpu === false || colors.matches || calm()) { host.classList.add('sp-prism-fallback'); return null; }
    const gl = canvas.getContext('webgl', {alpha:false,antialias:false,depth:false,stencil:false,powerPreference:'low-power'});
    if (!gl) { host.classList.add('sp-prism-fallback'); return null; }
    let program = null, buffer = null, raf = 0, dead = false, failed = false, last = 0, lastDraw = 0, age = 0, frames = 0;
    let px = 0, py = 0, tx = 0, ty = 0, width = 1, height = 1;
    const precision = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)?.precision ? 'highp' : 'mediump';
    const vertex = 'attribute vec2 aPosition;varying vec2 vUv;void main(){vUv=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}';
    // Trigonometry/tints that depend only on time/lane are prepared once per
    // frame on CPU, not nine times for each of two million fragments. Near-lane
    // rejection precedes the expensive optical terms. Still nine glass vanes.
    const fragment = `precision ${precision} float;
      varying vec2 vUv;uniform vec2 uResolution,uPointer;uniform float uTime,uLive;
      uniform vec4 uVanes[9];uniform vec3 uTints[9];uniform vec2 uShine[9];
      uniform vec4 uAudio;uniform float uBands[9];
      void main(){
        vec2 p=(vUv-.5)*vec2(uResolution.x/uResolution.y,1.);p-=uPointer*vec2(.035,.018);
        float t=uTime,aa=1.5/uResolution.y,bass=uAudio.x,mid=uAudio.y,air=uAudio.z,kick=uAudio.w;
        vec3 col=vec3(.012,.013,.020);
        float sy=sin(p.y*2.8+t*.42),cy=cos(p.y*2.8+t*.42);
        float ss=sin(p.y*2.1),cs=cos(p.y*2.1);
        float breath=1.+uLive*(bass*.14+kick*.035);
        for(int i=0;i<9;i++){
          vec4 v=uVanes[i];float band=uBands[i]*uLive;
          float curve=.19*p.y+(.12+mid*.075)*(sy*v.w+cy*v.z);
          float q=p.x/breath+curve-v.x;
          float width=v.y*(1.+band*.18);
          if(abs(q)>width+.14)continue;
          float inside=1.-smoothstep(width-aa,width+aa,abs(q));
          float fold=clamp((q/width+1.)*.5,0.,1.);float f2=fold*fold;
          float sheen=max(0.,ss*uShine[i].y+cs*uShine[i].x);sheen*=sheen;sheen*=sheen;sheen*=sheen;
          vec3 tint=uTints[i];
          col=mix(col,col*.48,inside*.62);
          col+=tint*(.016+f2*f2*fold*.09+band*.055)*inside;
          float edge=exp(-abs(q-width*.77)*42.)+exp(-abs(q+width*.88)*83.)*.28;
          col+=mix(tint,vec3(.91,.92,.95),.54)*edge*(.055+.68*sheen+band*.32)*inside;
          col+=tint*exp(-q*q*18.)*sheen*(.033+band*.025);
        }
        if(uLive>.5){
          // Chromatic caustics, not a flashing equalizer. Bass opens the lens;
          // mids braid its edge, high frequencies reveal fine spectral threads.
          vec2 lens=p*vec2(.88,1.25);float r=length(lens),a=atan(lens.y,lens.x);
          float bend=sin(a*3.+t*.24)*(.018+mid*.027)+sin(a*5.-t*.17)*.009;
          float radius=.37+bass*.075+kick*.025;
          float d=r-radius-bend;
          float caustic=exp(-abs(d)*100.)*.48+exp(-d*d*210.)*.12;
          float arc=.3+.7*pow(.5+.5*sin(a*2.-t*.35+mid),2.);
          vec3 chroma=mix(vec3(.28,.71,.92),vec3(.78,.42,.85),.5+.5*sin(a+t*.12));
          col+=chroma*caustic*arc*(.28+bass*.72+kick*.2);
          float filament=abs(d+.035+sin(a*7.+t*.48)*(.005+air*.009));
          col+=mix(chroma,vec3(.87,.91,1.),.45)*exp(-filament*230.)*(.035+air*.16);
          float veil=exp(-pow((r-.52-bass*.04)*5.,2.));
          col+=chroma*veil*(.012+mid*.055)*(.5+.5*sin(a*2.+t*.19));
        }
        vec2 centreP=p*vec2(1.3,2.);float centre=exp(-dot(centreP,centreP)*3.);
        col*=1.-centre*.46;
        float vignette=1.-smoothstep(.20,1.15,length(p*vec2(.65,1.)));col*=.22+.78*vignette;
        // Stable interleaved gradient dither: no per-pixel trigonometric hash.
        float grain=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
        col+=(grain-.5)*.003;gl_FragColor=vec4(max(col,vec3(0.)),1.);
      }`;
    function compile(type, source) {
      const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); return null; }
      return shader;
    }
    const vs = compile(gl.VERTEX_SHADER, vertex), fs = compile(gl.FRAGMENT_SHADER, fragment);
    if (vs && fs) { program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program); }
    if (vs) gl.deleteShader(vs); if (fs) gl.deleteShader(fs);
    if (!program || !gl.getProgramParameter(program, gl.LINK_STATUS)) {
      if (program) gl.deleteProgram(program); gl.getExtension('WEBGL_lose_context')?.loseContext();
      host.classList.add('sp-prism-fallback'); return null;
    }
    buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
    const loc = name => gl.getUniformLocation(program, name);
    const uniforms = {resolution:loc('uResolution'),time:loc('uTime'),pointer:loc('uPointer'),live:loc('uLive'),vanes:loc('uVanes[0]'),tints:loc('uTints[0]'),shine:loc('uShine[0]'),audio:loc('uAudio'),bands:loc('uBands[0]')};
    gl.useProgram(program); const position = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    const style = getComputedStyle(document.documentElement);
    const color = (key, fallback) => { const values = style.getPropertyValue(key).trim().split(/[ ,]+/).map(Number); return values.length===3 && values.every(Number.isFinite) ? values.map(v=>Math.max(0,Math.min(255,v))/255) : fallback; };
    const rose=color('--a1',[1,.19,.49]),violet=color('--a2',[.49,.34,1]),ice=color('--a3',[.25,.84,.9]);
    const vanes=new Float32Array(36),tints=new Float32Array(27),shine=new Float32Array(18),zeroBands=new Float32Array(9);
    // Cached lane constants and reusable uniform arrays; no per-frame buffers.
    const laneConstants=Array.from({length:9},(_,i)=>({lane:(i-4)*.225,width:.072+.012*Math.sin(i*1.8),sp:Math.sin(i*.18),cp:Math.cos(i*.18),ice:.5+.5*Math.sin(i*.42+2)}));
    function resize() {
      if (dead || failed) return;
      const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight),dpr=Math.min(devicePixelRatio||1,1.5,Math.sqrt(2000000/(w*h)));
      width=Math.max(1,Math.round(w*dpr));height=Math.max(1,Math.round(h*dpr));
      if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
      gl.viewport(0,0,width,height); gl.uniform2f(uniforms.resolution,width,height);
    }
    function draw(dt, now) {
      const audio=live?options.sample?.(now,dt):null;
      for(let i=0;i<9;i++){
        const c=laneConstants[i],j=i*4,k=i*3,l=i*2,mix=.5+.5*Math.sin(i*.8+age*.12);
        vanes[j]=c.lane+.055*Math.sin(age*.30+i*.61);vanes[j+1]=c.width;vanes[j+2]=c.sp;vanes[j+3]=c.cp;
        shine[l]=Math.sin(i*.72-age*.68);shine[l+1]=Math.cos(i*.72-age*.68);
        for(let ch=0;ch<3;ch++)tints[k+ch]=(rose[ch]*(1-mix)+violet[ch]*mix)*(1-c.ice)+ice[ch]*c.ice;
      }
      gl.uniform4fv(uniforms.vanes,vanes);gl.uniform3fv(uniforms.tints,tints);gl.uniform2fv(uniforms.shine,shine);
      gl.uniform4f(uniforms.audio,audio?.bass||0,audio?.mid||0,audio?.treble||0,audio?.kick||0);
      gl.uniform1fv(uniforms.bands,audio?.bands||zeroBands);gl.uniform1f(uniforms.live,live?1:0);
      gl.uniform1f(uniforms.time,age);gl.uniform2f(uniforms.pointer,px,py);gl.drawArrays(gl.TRIANGLES,0,3);frames++;
    }
    function tick(now) {
      raf=0;if(dead||failed||document.hidden||window.pulseWinHidden||gl.isContextLost())return;
      if(calm()||colors.matches){if(!live)end(true);else options.onCalm?.();return;}
      // Display-cadence scheduling with phase preserved; never render 144/240
      // copies of a slow decorative field. This does not alter main viz settings.
      const perf=settings()?.perf,requested=perf?.fps>0?perf.fps:60;
      const gap=1000/Math.min(60,requested,perf?.mode==='eco'?30:60);
      if(last&&now-last<gap-.7){raf=requestAnimationFrame(tick);return;}
      const dt=lastDraw?Math.min(.1,(now-lastDraw)/1000):1/60;lastDraw=now;
      last=now-((last?now-last:0)%gap);age+=dt;
      px+=(tx-px)*(1.-Math.exp(-dt*6.));py+=(ty-py)*(1.-Math.exp(-dt*6.));
      draw(dt,now);raf=requestAnimationFrame(tick);
    }
    const move=e=>{tx=Math.max(-1,Math.min(1,e.clientX/Math.max(1,host.clientWidth)*2-1));ty=Math.max(-1,Math.min(1,e.clientY/Math.max(1,host.clientHeight)*2-1));};
    const leave=()=>{tx=ty=0;};
    const lost=e=>{e.preventDefault();failed=true;cancelAnimationFrame(raf);raf=0;host.classList.remove('sp-prism-ready');host.classList.add('sp-prism-fallback');options.onLoss?.();};
    canvas.addEventListener('webglcontextlost',lost);window.addEventListener('resize',resize);host.addEventListener('pointermove',move);host.addEventListener('pointerleave',leave);
    resize();draw(0,performance.now());host.classList.add('sp-prism-ready');
    if(!document.hidden&&!window.pulseWinHidden)raf=requestAnimationFrame(tick);
    return {visible(value){cancelAnimationFrame(raf);raf=0;last=lastDraw=0;if(value&&!dead&&!failed)raf=requestAnimationFrame(tick);},stats:()=>({frames,width,height,raf:!!raf,failed}),destroy(){if(dead)return;dead=true;cancelAnimationFrame(raf);window.removeEventListener('resize',resize);host.removeEventListener('pointermove',move);host.removeEventListener('pointerleave',leave);canvas.removeEventListener('webglcontextlost',lost);gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext();canvas.width=canvas.height=1;}};
  }
})();
