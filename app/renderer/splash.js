'use strict';
/* Pulse COSMOS entrance (1.0.10) + legacy prism easter egg.
 * Shared bounded glass renderer. No second player, audio graph, network or Three.js. */
(function () {
  // Export before the startup opt-out: the explicitly opened easter egg also works
  // when launch art is disabled. No GPU resources are created by this export.
  window.PulsePrismArt = createPrism;
  const el = document.getElementById('splash'); if (!el) return;
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let off = preference.matches;
  try { off = off || localStorage.getItem('pulse.motion') === 'off' || localStorage.getItem('pulse.splash') === 'off' || sessionStorage.getItem('pulse.splashShown') === '1'; sessionStorage.setItem('pulse.splashShown', '1'); } catch {}
  if (off) { el.remove(); return; }
  // -- Pulse COSMOS splash (1.0.10) --
  // Arrival from hyperspace into a quiet deep-space field. A constellation
  // named PULSE draws itself (same language as Atlas: the playing star glows
  // rose and breathes with the bass). Three exits: fly into the playing star
  // (default), dissolve into the app, or a calm fade. Keys 1/2/3 pick one. Signal is synthesised locally or read
  // passively from the running player.
  el.dataset.style = 'cosmos';
  el.innerHTML = '<canvas class="cs-gl" aria-hidden="true"></canvas>'
    + '<div class="cs-core"><h1 class="cs-word" aria-label="Pulse" data-i18n-skip>' + 'PULSE'.split('').map((c, i) => `<span style="--i:${[2, 0, 4, 1, 3][i]}">${c}</span>`).join('') + '</h1>'
    + '<p class="cs-tag" data-i18n-skip></p><p class="cs-coord" aria-hidden="true">\u03b1 Lyr \u00b7 18h 36m 56s \u00b7 +38\u00b0 47\u2032</p></div>';
  const captions = {en:'Music in your rhythm',ru:'\u041c\u0443\u0437\u044b\u043a\u0430 \u0432 \u0442\u0432\u043e\u0451\u043c \u0440\u0438\u0442\u043c\u0435',ja:'\u3042\u306a\u305f\u306e\u30ea\u30ba\u30e0\u3067\u97f3\u697d\u3092',uk:'\u041c\u0443\u0437\u0438\u043a\u0430 \u0443 \u0442\u0432\u043e\u0454\u043c\u0443 \u0440\u0438\u0442\u043c\u0456'};
  const caption = () => {
    const l = window.PulseI18n?.language?.();
    el.querySelector('.cs-tag').textContent = captions[l] || captions.en;
  };
  caption(); window.addEventListener('pulse-language', caption);

  const EXITS = ['star', 'dissolve', 'calm'];
  let exitMode = (() => { try { const v = localStorage.getItem('pulse.splashExit'); return EXITS.includes(v) ? v : 'star'; } catch { return 'star'; } })();
  // Initial tray startup waits for visibility. Settings/reload/reduced-motion
  // skip above happens BEFORE any context, frame loop or resize listener exists.
  let t0 = 0, started = false, loaded = document.readyState === 'complete', done = false, lastMove = -1e9;
  let startRaf = 0, removal = 0, art = null;
  window.PulseCosmos = () => art;
  const timers = [], MIN = 1800, MAX = 4500, CAP = 10000;
  const schedule = (fn, delay) => { const id = setTimeout(fn, delay); timers.push(id); return id; };
  const onKey = e => { const n = ['1','2','3'].indexOf(e.key); if ((n >= 0 || ['Escape',' ','Enter'].includes(e.key)) && started) { e.preventDefault(); e.stopPropagation(); if (n >= 0) { exitMode = EXITS[n]; try { localStorage.setItem('pulse.splashExit', exitMode); } catch {} } end(); } };
  const onLoad = () => { loaded = true; if (started) tryEnd(); };
  const onMotion = () => { if (preference.matches) end(true); };
  const hidden = () => document.hidden || !!window.pulseWinHidden;
  const onVisibility = () => { if (done) return; if (!started && !hidden()) start(); else if (started) { el.classList.toggle('wait', hidden()); art?.visible(!hidden()); } };
  const onClick = e => { if (started) end(false, e); };
  function cleanup() {
    cancelAnimationFrame(startRaf); timers.forEach(clearTimeout);
    window.removeEventListener('load', onLoad); window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('pulse-language', caption); document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pulse-window-visibility', onVisibility);
    preference.removeEventListener?.('change', onMotion); el.removeEventListener('click', onClick);
  }
  function remove() { clearTimeout(removal); art?.destroy(); art = null; el.remove(); document.body.classList.remove('sp-intro', 'cs-in', 'cs-star', 'cs-dissolve', 'cs-calm'); }
  function end(immediate = false, from = null) {
    if (done) return; done = true; cleanup();
    if (immediate) { remove(); return; }
    try { const f = art?.exit(from, exitMode); if (f) { el.style.setProperty('--fx', f.x.toFixed(1) + 'px'); el.style.setProperty('--fy', f.y.toFixed(1) + 'px'); } } catch {}
    el.classList.add('bye', 'x-' + exitMode);
    const T = { star: [380, 1500], dissolve: [60, 1450], calm: [180, 1050] }[exitMode];
    const reveal = () => document.body.classList.add('sp-intro', 'cs-in', 'cs-' + exitMode);
    if (art) setTimeout(reveal, T[0]); else reveal();
    removal = setTimeout(remove, art ? T[1] : 700);
  }
  // 1800ms minimum and 4500ms cap stay; while the pointer plays with the scene
  // the intro waits (bounded by CAP).
  function tryEnd() {
    if (done || !started) return;
    const n = performance.now() - t0, busy = performance.now() - lastMove < 1500;
    if (n >= MIN - 20 && (loaded || n >= MAX - 20) && (!busy || n >= CAP)) end(); else schedule(tryEnd, 250);
  }
  function begin() {
    if (started || done || hidden()) return;
    started = true; t0 = performance.now(); el.classList.remove('wait');
    try { art = createCosmos(el.querySelector('canvas'), el, { onMove: () => { lastMove = performance.now(); } }); }
    catch { art = null; el.classList.add('cs-fallback'); }
    schedule(tryEnd, MIN); schedule(tryEnd, MAX);
  }
  function start() { if (started || done) return; cancelAnimationFrame(startRaf); startRaf = requestAnimationFrame(() => { startRaf = requestAnimationFrame(begin); }); }
  window.addEventListener('load', onLoad); window.addEventListener('keydown', onKey, true);
  window.addEventListener('pulse-window-visibility', onVisibility);
  document.addEventListener('visibilitychange', onVisibility); preference.addEventListener?.('change', onMotion);
  el.addEventListener('click', onClick);
  if (hidden()) el.classList.add('wait'); else start();

  function createCosmos(canvas, host, options = {}) {
    const prefs = (() => { try { return typeof S === 'function' ? S() : null; } catch { return null; } })();
    if (prefs?.perf?.gpu === false || window.matchMedia('(forced-colors: active)').matches) { host.classList.add('cs-fallback'); return null; }
    const gl = canvas.getContext('webgl', {alpha:true,antialias:false,depth:false,stencil:false,premultipliedAlpha:true,powerPreference:'high-performance'});
    if (!gl) { host.classList.add('cs-fallback'); return null; }
    const warn = (...a) => { try { globalThis.console?.warn?.('[splash]', ...a); } catch {} };
    const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { warn(gl.getShaderInfoLog(s)); gl.deleteShader(s); return null; } return s; };
    const link = (vsSrc, fsSrc) => {
      const v = compile(gl.VERTEX_SHADER, vsSrc), f = compile(gl.FRAGMENT_SHADER, fsSrc); if (!v || !f) return null;
      const p = gl.createProgram(); gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p); gl.deleteShader(v); gl.deleteShader(f);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { warn(gl.getProgramInfoLog(p)); gl.deleteProgram(p); return null; }
      return p;
    };
    // Deep space: faint milky-way band with dust lanes, dark nebulae, warp glow.
    const BG_VS = 'precision highp float;attribute vec2 aP;void main(){gl_Position=vec4(aP,0.,1.);}';
    const BG_FS = `precision highp float;
      uniform vec2 uRes,uCam,uFoc;uniform float uT,uFade,uWarp,uFlash,uBass,uZoom,uBgA;uniform vec4 uRip;
      float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+1.),f.x),f.y);}
      float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*vn(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s;}
      void main(){vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y;p=uFoc+(p-uFoc)/uZoom;vec2 q=p-uCam*.12;
        vec3 col=vec3(.004,.005,.012);
        vec2 r=mat2(.87,-.5,.5,.87)*q;
        float band=exp(-pow(r.y*2.4+.09*sin(r.x*2.3),2.));
        float n=fbm(r*vec2(1.5,4.2)+vec2(uT*.003,0.)),dust=fbm(r*vec2(3.2,9.)+7.3);
        float mw=band*(.25+.75*n)*(1.-.8*smoothstep(.42,.72,dust)*smoothstep(.2,.9,band));
        col+=mix(vec3(.035,.045,.10),vec3(.11,.085,.10),smoothstep(.35,.85,n))*mw*.5;
        col+=vec3(.045,.015,.07)*smoothstep(.5,.95,fbm(q*1.2+vec2(3.,uT*.006)))*.7;
        col+=vec3(.0,.03,.045)*smoothstep(.55,.95,fbm(q*1.05-5.1))*.7;
        for(int k=0;k<2;k++){float sc=k==0?90.:170.;vec2 g=(q*(1.+float(k)*.15))*sc,ci=floor(g);float hh=h2(ci+float(k)*17.);vec2 f=fract(g)-.5-(vec2(h2(ci+3.),h2(ci+9.))-.5)*.7;
          float d=length(f)*uRes.y/sc;col+=mix(vec3(.75,.82,1.),vec3(1.,.9,.8),h2(ci+5.))*smoothstep(1.3,.2,d)*step(.93+float(k)*.03,hh)*(.18+.5*mw)*(.75+.25*sin(uT*1.7+hh*80.));}
        float L=length(p);
        float rd=length(p-uRip.xy),ring=exp(-pow((rd-uRip.z*.7)*14.,2.))*uRip.w*exp(-uRip.z*1.4);
        col+=vec3(.25,.32,.55)*ring*.35;
        col+=vec3(.16,.20,.36)*uWarp*exp(-L*2.6)*.4;
        col+=vec3(.55,.66,1.)*uFlash*exp(-L*1.3);
        col*=uFade*(1.+uBass*.06);
        vec2 v=gl_FragCoord.xy/uRes-.5;col*=1.-dot(v,v)*1.1;
        col+=(h2(gl_FragCoord.xy+fract(uT*7.)*91.)-.5)*.012;
        gl_FragColor=vec4(max(col,0.)*uBgA,uBgA);}`;
    // Stars + constellation: every item is an anti-aliased capsule (dot or streak).
    const ST_VS = `precision highp float;
      attribute vec4 aA,aB,aC;
      uniform vec2 uRes,uCam,uFoc;uniform float uT,uTravel,uStreak,uMode,uHigh,uBass,uFade,uZoom;
      varying vec2 vL;varying float vLen,vR,vHalo;varying vec4 vC;
      void main(){vec2 h,t;float r,halo=.16,I=aC.a;
        if(uMode<.5){float z=.05+fract(aA.z-uTravel)*.95,zt=z+uStreak;
          h=(aA.xy-uCam)/z*.5;t=(aA.xy-uCam)/zt*.5;
          r=clamp(mix(.6,1.7,aB.z)*.3/z,.9,3.4);
          float tw=.72+.28*sin(uT*(1.3+aB.w*2.7)+aB.w*61.)*(.5+uHigh);
          I*=smoothstep(1.,.8,z)*smoothstep(.05,.15,z)*tw*(1.+uBass*.25)*clamp(.3/z,.22,1.5);
        }else{h=aA.xy;t=aA.zw;r=aB.z;halo=aB.w;}
        h=uFoc+(h-uFoc)*uZoom;t=uFoc+(t-uFoc)*uZoom;
        vec2 hp=h*uRes.y,tp=t*uRes.y,d=hp-tp;float len=length(d);
        vec2 dir=len>.001?d/len:vec2(1.,0.),nrm=vec2(-dir.y,dir.x);
        float R=r*(halo>.3?8.:4.5),ax=aB.x>.5?len+R:-R,sy=aB.y*R;
        gl_Position=vec4((tp+dir*ax+nrm*sy)/(.5*uRes),0.,1.);
        vL=vec2(ax,sy);vLen=len;vR=r;vHalo=halo;
        vC=vec4(aC.rgb,I*uFade*(uMode<.5?sqrt(min(1.,3.*r/(len+3.*r))):1.));}`;
    const ST_FS = `precision highp float;
      varying vec2 vL;varying float vLen,vR,vHalo;varying vec4 vC;
      void main(){float d=length(vec2(vL.x-clamp(vL.x,0.,vLen),vL.y));
        float c=clamp(1.-d/vR,0.,1.);c*=c;
        float a=(c+exp(-d/(vR*2.2))*vHalo)*vC.a;
        gl_FragColor=vec4(vC.rgb*a,min(a,1.));}`;
    const lose = () => { gl.getExtension('WEBGL_lose_context')?.loseContext(); host.classList.add('cs-fallback'); return null; };
    const program = link(BG_VS, BG_FS), stars = program && link(ST_VS, ST_FS);
    if (!program || !stars) { if (program) gl.deleteProgram(program); return lose(); }
    const uni = (p, names) => { const o = {}; for (const n of names) o[n] = gl.getUniformLocation(p, n); return o; };
    const UB = uni(program, ['uRes','uCam','uT','uFade','uWarp','uFlash','uBass','uRip','uFoc','uZoom','uBgA']);
    const US = uni(stars, ['uRes','uCam','uT','uTravel','uStreak','uMode','uHigh','uBass','uFade','uFoc','uZoom']);
    const LB = gl.getAttribLocation(program, 'aP'), LA = ['aA','aB','aC'].map(n => gl.getAttribLocation(stars, n));

    const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
    const CORN = [[0,-1],[1,-1],[1,1],[0,-1],[1,1],[0,1]];
    let seed = 9137; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const N = 2400, field = new Float32Array(N * 6 * 12);
    for (let i = 0, o = 0; i < N; i++) {
      const x = (rnd()*2-1)*2.1, y = (rnd()*2-1)*1.4, z = rnd(), sz = Math.pow(rnd(), 3), sd = rnd(), tc = rnd();
      const c = tc < .16 ? [1, .83, .64] : tc < .58 ? [.93, .95, 1] : [.66, .78, 1];
      const I = .5 + sz*.95;
      for (const [al, si] of CORN) { field.set([x, y, z, 0, al, si, sz, sd, c[0], c[1], c[2], I], o); o += 12; }
    }
    const starBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, starBuf); gl.bufferData(gl.ARRAY_BUFFER, field, gl.STATIC_DRAW);
    // Constellation PULSE: drawn around the wordmark; star 4 is the "playing" star.
    const CS = [[-.62,.05],[-.47,.24],[-.22,.30],[.04,.27],[.29,.33],[.55,.22],[.66,.02],[.40,-.08],[-.33,-.07]];
    const ED = [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[0,8]];
    const MAXI = CS.length + ED.length, over = new Float32Array(MAXI * 6 * 12);
    const overBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, overBuf); gl.bufferData(gl.ARRAY_BUFFER, over.byteLength, gl.DYNAMIC_DRAW);
    let oc = 0;
    const item = (hx, hy, tx, ty, r, halo, c, I) => { if (I <= .002) return; for (const [al, si] of CORN) { over.set([hx, hy, tx, ty, al, si, r, halo, c[0], c[1], c[2], I], oc*12); oc++; } };
    let enabled = [];
    const attrs = (buf, list) => {
      for (const l of enabled) gl.disableVertexAttribArray(l); enabled = [];
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      for (const [l, n, off, stride] of list) { if (l < 0) continue; gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, stride, off); enabled.push(l); }
    };
    const starAttrs = buf => attrs(buf, [[LA[0], 4, 0, 48], [LA[1], 4, 16, 48], [LA[2], 4, 32, 48]]);

    let W = 1, H = 1, gw = 1, gh = 1, raf = 0, last = 0, age = 0, frames = 0, dead = false, failed = false, hiddenNow = false, exitAt = -1, realOn = false, travel = 0, jolt = -9, foc = [.29, .33], mode = 'star';
    const A = { b: 0, m: 0, h: 0, k: 0 }, rip = { x: 0, y: 0, t: -9, s: 0 };
    const m = { x: 0, y: 0, tx: 0, ty: 0, z: 0, on: false, cx: 0, cy: 0 };
    function resize() {
      const r = host.getBoundingClientRect(); W = Math.max(1, r.width || innerWidth); H = Math.max(1, r.height || innerHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(6e6/(W*H))); gw = Math.max(1, Math.round(W*dpr)); gh = Math.max(1, Math.round(H*dpr));
      if (canvas.width !== gw || canvas.height !== gh) { canvas.width = gw; canvas.height = gh; }
      gl.viewport(0, 0, gw, gh);
    }
    const toP = (cx, cy) => [(cx-W/2)/H, (H/2-cy)/H];
    const onMoveP = e => { [m.tx, m.ty] = toP(e.clientX, e.clientY); if (!m.on) { m.x = m.tx; m.y = m.ty; } m.on = true; options.onMove?.(); };
    const onLeave = () => { m.on = false; };
    const ripple = (cx, cy, s) => { [rip.x, rip.y] = toP(cx, cy); rip.t = age; rip.s = s; };
    const onDown = e => { ripple(e.clientX, e.clientY, 1); jolt = age; };
    const onLost = e => { e.preventDefault?.(); failed = true; cancelAnimationFrame(raf); raf = 0; host.classList.add('cs-fallback'); };
    host.addEventListener('pointermove', onMoveP); host.addEventListener('pointerleave', onLeave); host.addEventListener('pointerdown', onDown);
    canvas.addEventListener('webglcontextlost', onLost); window.addEventListener('resize', resize);

    const band = (s, lo, hi) => { const sr = s.sampleRate || 44100, fft = s.fftSize || s.f.length*2; const i0 = Math.max(0, Math.floor(lo*fft/sr)), i1 = Math.min(s.f.length, Math.max(i0+1, Math.ceil(hi*fft/sr))); let sum = 0; for (let i = i0; i < i1; i++) sum += s.f[i]; return sum/(i1-i0)/255; };
    function listen(dt) {
      let b, md, h, k, s = null;
      try { s = window.PulseAudioSignal?.read?.(); } catch {}
      if (s && s.f && s.f.length) { realOn = true; b = Math.pow(band(s, 30, 160), 1.4)*1.3; md = band(s, 300, 2000)*1.2; h = band(s, 4000, 12000)*1.6; k = Math.max(0, b-A.b)*4; }
      else { realOn = false; const bt = age/(60/88), ph = bt-Math.floor(bt), kick = Math.exp(-ph*5); b = .25+.12*Math.sin(age*.6)+kick*.45; md = .35+.2*Math.sin(age*.4+1); h = .3+.2*Math.exp(-((bt*2)%1)*8); k = kick; }
      const ease = (cur, v, up, down) => cur+(v-cur)*(1-Math.exp(-dt*(v > cur ? up : down)));
      A.b = ease(A.b, Math.min(1.2, b), 14, 3.5); A.m = ease(A.m, Math.min(1.5, md), 4, 1.5); A.h = ease(A.h, Math.min(1, h), 16, 5); A.k = ease(A.k, Math.min(1, k), 30, 6);
    }
    const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x-a)/(b-a))); return t*t*(3-2*t); };
    const ROSE = [1, .36, .42], ICE = [.68, .8, 1], LINE = [.55, .66, .95];
    function constellation(cf, e, cp = cf, grow = 1) {
      oc = 0; const sx = Math.min(1, (W/H)/1.78), ox = -m.cx*.35, oy = -m.cy*.35 + Math.sin(age*.25)*.006;
      const P = CS.map(([x, y], i) => [x*sx+ox+Math.sin(age*.3+i)*.002, y+oy+Math.cos(age*.27+i*1.7)*.002]);
      if (exitAt < 0) foc = P[4]; else P[4] = foc;
      ED.forEach(([a, b], k) => {
        const g = sm(1.6+k*.14, 2.05+k*.14, age)*cf; if (g <= 0) return;
        const [ax, ay] = P[a], [bx, by] = P[b], ex = ax+(bx-ax)*g, ey = ay+(by-ay)*g;
        const mx = (ax+bx)/2-m.x, my = (ay+by)/2-m.y, near = Math.exp(-(mx*mx+my*my)*30)*m.z;
        item(ex, ey, ax, ay, .72, .08, LINE, (.3+A.b*.12+near*.45)*cf);
      });
      P.forEach(([x, y], i) => {
        const t = age-(1.15+i*.11); if (t <= 0) return;
        const pop = 1+Math.exp(-t*7)*Math.sin(t*16)*.6*Math.min(1, t*9), dx = x-m.x, dy = y-m.y, near = Math.exp(-(dx*dx+dy*dy)*90)*m.z;
        const play = i === 4, I = Math.min(1, t*4)*(play ? cp : cf)*(1+near*.8);
        const r = (play ? 2.4+A.b*2.2+A.k*1.2 : 1.6+near*.8+.25*Math.sin(age*2.1+i*3))*pop*(play ? grow : 1);
        item(x, y, x, y, r, play ? .55+A.b*.35 : .34, play ? ROSE : ICE, play ? I*(1.05+A.k*.4) : I*.9);
      });
      return oc;
    }

    function frame(now) {
      raf = 0; if (dead || failed || hiddenNow) return;
      const dt = last ? Math.min(.05, (now-last)/1000) : 1/60; last = now; age += dt; frames++;
      try {
        listen(dt);
        const k = 1-Math.exp(-dt*4); m.x += (m.tx-m.x)*k; m.y += (m.ty-m.y)*k; m.z += ((m.on ? 1 : 0)-m.z)*(1-Math.exp(-dt*3));
        const ck = exitAt < 0 ? 1-Math.exp(-dt*2.2) : 0;
        m.cx += (m.x*m.z*.09+Math.sin(age*.07)*.02-m.cx)*ck; m.cy += (m.y*m.z*.07+Math.cos(age*.05)*.012-m.cy)*ck;
        const e = exitAt < 0 ? -1 : age-exitAt;
        const wi = 1-sm(0, 1.9, age), we = e < 0 ? 0 : sm(.08, .85, e), jo = age >= jolt ? Math.exp(-(age-jolt)*3.2) : 0;
        let speed = .018+A.m*.004+wi*wi*2.6+jo*.45, fade = sm(0, .6, age), cf = 1, cp = 1, grow = 1, zoom = 1, bgA = 1; void we;
        if (e >= 0) {
          if (mode === 'star') { const z = sm(0, 1.2, e); zoom = 1+z*z*z*5; cf = 1-sm(0, .4, e); cp = 1-sm(.95, 1.25, e); grow = 1+sm(0, .8, e)*5; speed += sm(0, .9, e)*.2; }
          else if (mode === 'dissolve') { cf = 1-sm(0, .3, e); cp = cf; bgA = 1-sm(.05, .85, e); const w = sm(0, .9, e); speed += w*w*1.1; fade *= 1-sm(.8, 1.35, e); }
          else { cf = 1-sm(0, .5, e); cp = cf; speed *= 1-sm(0, .6, e)*.75; fade *= 1-sm(.15, .85, e); }
        }
        travel = (travel+speed*dt) % 1;
        gl.disable(gl.BLEND); gl.useProgram(program); attrs(buffer, [[LB, 2, 0, 0]]);
        gl.uniform2f(UB.uRes, gw, gh); gl.uniform2f(UB.uCam, m.cx, m.cy); gl.uniform1f(UB.uT, age); gl.uniform1f(UB.uFade, fade);
        gl.uniform1f(UB.uWarp, wi*wi); gl.uniform1f(UB.uFlash, 0); gl.uniform2f(UB.uFoc, foc[0], foc[1]); gl.uniform1f(UB.uZoom, zoom); gl.uniform1f(UB.uBgA, bgA); gl.uniform1f(UB.uBass, A.b);
        gl.uniform4f(UB.uRip, rip.x, rip.y, age-rip.t, age-rip.t < 4 ? rip.s : 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.useProgram(stars); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
        gl.uniform2f(US.uRes, gw, gh); gl.uniform2f(US.uCam, m.cx, m.cy); gl.uniform1f(US.uT, age); gl.uniform1f(US.uTravel, travel);
        gl.uniform1f(US.uStreak, Math.min(.45, speed*.05)); gl.uniform1f(US.uHigh, A.h); gl.uniform1f(US.uBass, A.b); gl.uniform1f(US.uFade, fade); gl.uniform2f(US.uFoc, foc[0], foc[1]); gl.uniform1f(US.uZoom, zoom);
        gl.uniform1f(US.uMode, 0); starAttrs(starBuf); gl.drawArrays(gl.TRIANGLES, 0, N*6);
        const n = constellation(cf, e, cp, grow);
        if (n) { gl.bindBuffer(gl.ARRAY_BUFFER, overBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, over.subarray(0, n*12)); gl.uniform1f(US.uMode, 1); gl.uniform1f(US.uFade, Math.min(1, fade*1.2)); starAttrs(overBuf); gl.drawArrays(gl.TRIANGLES, 0, n); }
        host.style.setProperty('--pulse', A.k.toFixed(3));
        host.style.setProperty('--mx', (m.cx*8).toFixed(3)); host.style.setProperty('--my', (-m.cy*8).toFixed(3));
      } catch (err) { warn(err); failed = true; host.classList.add('cs-fallback'); return; }
      raf = requestAnimationFrame(frame);
    }
    function exit(from, md) {
      if (exitAt >= 0) return; exitAt = age; mode = md || 'star';
      rip.s = 0; return { x: W/2+foc[0]*H, y: H/2-foc[1]*H };
    }
    function visible(v) {
      hiddenNow = !v;
      if (v && !raf && !dead && !failed) { last = 0; raf = requestAnimationFrame(frame); }
      else if (!v && raf) { cancelAnimationFrame(raf); raf = 0; }
    }
    function destroy() {
      if (dead) return; dead = true; cancelAnimationFrame(raf); raf = 0;
      host.removeEventListener('pointermove', onMoveP); host.removeEventListener('pointerleave', onLeave); host.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('webglcontextlost', onLost); window.removeEventListener('resize', resize);
      try { gl.deleteBuffer(buffer); gl.deleteBuffer(starBuf); gl.deleteBuffer(overBuf); gl.deleteProgram(program); gl.deleteProgram(stars); gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch {}
    }
    resize(); host.classList.add('cs-ready'); raf = requestAnimationFrame(frame);
    return { exit, visible, destroy, measure() {}, stats: () => ({ kind: 'cosmos', frames, raf, failed, age, w: gw, h: gh, real: realOn }) };
  }

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
