// Pulse 2.0.6 — графика на видеокарте (WebGL2).
// Что считает видеокарта: перспективная 3D-проекция, толщина и скругление линий, свечение (размытие ореолом в шейдере
// вместо ctx.shadowBlur — самой дорогой операции canvas), грани 3D-зданий, частицы «Только текст».
// JS только раскладывает числа в один Float32Array и делает один вызов отрисовки на тип объектов.
// Если WebGL2 нет или контекст потерян — вызывающий код рисует по-старому через canvas 2D.
const PulseGPU = (() => {
  'use strict';
  const VS_HEAD = `#version 300 es
precision highp float;
uniform vec2 uView;      // размер в CSS-пикселях
uniform vec4 uCam;       // yaw, pitch, dist, f
uniform vec4 uOrg;       // ox, oy, roll, mode (0 — 3D, 1 — экранные координаты)
// та же камера, что cam3() в viz.js: поворот вокруг Y, затем вокруг X, камера на расстоянии dist
vec3 viewOf(vec3 p) {
  float cy = cos(uCam.x), sy = sin(uCam.x), cp = cos(uCam.y), sp = sin(uCam.y);
  float xr = p.x * cy - p.z * sy, zr = p.x * sy + p.z * cy;
  return vec3(xr, p.y * cp - zr * sp, p.y * sp + zr * cp + uCam.z);
}
vec3 rotN(vec3 n) {
  float cy = cos(uCam.x), sy = sin(uCam.x), cp = cos(uCam.y), sp = sin(uCam.y);
  float xr = n.x * cy - n.z * sy, zr = n.x * sy + n.z * cy;
  return vec3(xr, n.y * cp - zr * sp, n.y * sp + zr * cp);
}
// экранная точка (px) и масштаб k = f / z; z < 0.2 — за камерой
vec3 scr(vec3 p) {
  if (uOrg.w > 0.5) return vec3(p.xy, 1.0);
  vec3 v = viewOf(p); if (v.z < 0.2) return vec3(-1e5, -1e5, -1.0);
  float k = uCam.w / v.z; vec2 s = vec2(uOrg.x + v.x * k, uOrg.y - v.y * k);
  if (uOrg.z != 0.0) { vec2 c = uView * 0.5, d = s - c; float cr = cos(uOrg.z), sr = sin(uOrg.z); s = c + vec2(d.x * cr - d.y * sr, d.x * sr + d.y * cr); }
  return vec3(s, k);
}
vec4 clip(vec2 s) { return vec4(s.x / uView.x * 2.0 - 1.0, 1.0 - s.y / uView.y * 2.0, 0.0, 1.0); }
`;
  // ---------- точки: диск или кольцо + ореол свечения ----------
  const PT_VS = VS_HEAD + `
layout(location=0) in vec2 aQ;
layout(location=1) in vec3 iP; layout(location=2) in vec2 iR; layout(location=3) in vec4 iC; layout(location=4) in vec2 iG;
uniform float uLW; uniform float uGlow;
out vec2 vL; out float vR; out vec4 vC; out float vS; out float vK;
void main() {
  vec3 s = scr(iP); if (s.z < 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float r = uOrg.w > 0.5 ? iR.x : max(iR.y, iR.x * s.z) * uLW;
  float g = iG.x * uGlow; float ext = r + 1.5 + g * 1.2;
  vL = aQ * ext; vR = r; vC = iC; vS = max(0.5, g * 0.36); vK = iG.y;
  gl_Position = clip(s.xy + vL);
}`;
  const PT_FS = `#version 300 es
precision highp float;
in vec2 vL; in float vR; in vec4 vC; in float vS; in float vK; out vec4 o;
void main() {
  float d = length(vL);
  float core = vK > 0.5 ? clamp(1.0 - abs(d - vR), 0.0, 1.0) : clamp(vR + 0.5 - d, 0.0, 1.0);
  float e = max(d - vR, 0.0), halo = vS > 0.51 ? exp(-(e * e) / (2.0 * vS * vS)) * 0.42 : 0.0;
  float a = vC.a * (core + (1.0 - core) * halo);
  if (a < 0.003) discard;
  o = vec4(vC.rgb * a, a);
}`;
  // ---------- отрезки: капсула заданной толщины + ореол ----------
  const SG_VS = VS_HEAD + `
layout(location=0) in vec2 aQ;
layout(location=1) in vec3 iA; layout(location=2) in vec3 iB; layout(location=3) in vec4 iW; layout(location=4) in vec4 iC;
uniform float uLW; uniform float uGlow;
out vec2 vU; out float vL; out float vH; out vec4 vC; out float vS; out float vHalo;
void main() {
  vec3 a = scr(iA), b = scr(iB); if (a.z < 0.0 || b.z < 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float w = (iW.x > 0.0 ? max(iW.y, iW.x * a.z) : iW.y) * (uOrg.w > 0.5 ? 1.0 : uLW);
  float hw = w * 0.5, g = iW.z * uGlow, ext = hw + 1.0 + g * 1.2;
  vec2 dvec = b.xy - a.xy; float L = length(dvec); vec2 dir = L > 1e-4 ? dvec / L : vec2(1.0, 0.0), nrm = vec2(-dir.y, dir.x);
  float u = aQ.x < 0.0 ? -ext : L + ext, v = aQ.y * ext;
  vU = vec2(u, v); vL = L; vH = hw; vC = iC; vS = max(0.5, g * 0.36); vHalo = iW.w;
  gl_Position = clip(a.xy + dir * u + nrm * v);
}`;
  const SG_FS = `#version 300 es
precision highp float;
in vec2 vU; in float vL; in float vH; in vec4 vC; in float vS; in float vHalo; out vec4 o;
void main() {
  float du = clamp(vU.x, 0.0, vL); float d = length(vec2(vU.x - du, vU.y));
  float core = vHalo > 0.5 ? 0.0 : clamp(vH + 0.5 - d, 0.0, 1.0);
  float e = max(d - vH, 0.0), halo = vS > 0.51 ? exp(-(e * e) / (2.0 * vS * vS)) * 0.42 : 0.0;
  float a = vC.a * (core + (1.0 - core) * halo);
  if (a < 0.003) discard;
  o = vec4(vC.rgb * a, a);
}`;
  // ---------- 3D-коробки (здания «3D-города»): видимые грани, освещение, светлая крыша ----------
  const BX_VS = VS_HEAD + `
layout(location=0) in vec3 aP; layout(location=1) in vec3 aN;
layout(location=2) in vec4 iB; layout(location=3) in vec4 iC; layout(location=4) in float iT;
out vec4 vC; out float vVis;
void main() {
  vec3 p = vec3(iB.x + aP.x * iB.w, aP.y * iB.z, iB.y + aP.z * iB.w);
  vec3 v = viewOf(p); vec3 n = rotN(aN);
  vVis = dot(n, -v);  // грань смотрит на камеру
  vec3 s = scr(p);
  float lit = aN.y > 0.5 ? 1.0 : 0.62 + 0.3 * abs(n.x) ;
  vec3 c = aN.y > 0.5 ? mix(iC.rgb, vec3(1.0), clamp(iT, 0.0, 1.0)) : iC.rgb * lit;
  vC = vec4(c, aN.y > 0.5 ? max(iC.a, iT) : iC.a);
  gl_Position = s.z < 0.0 ? vec4(2.0, 2.0, 2.0, 1.0) : clip(s.xy);
}`;
  const BX_FS = `#version 300 es
precision highp float;
in vec4 vC; in float vVis; out vec4 o;
void main() { if (vVis <= 0.0) discard; o = vec4(vC.rgb * vC.a, vC.a); }`;

  // ---------- 2.0.9: «Частицы обложки 3D» — сетка точек обложки, рельеф по яркости, волны спектра, разлёт на ударе ----------
  // Каждая точка — пиксель обложки (цвет и яркость считаются один раз на обложку, лежат в статическом буфере).
  // Видеокарта сама двигает точки: волна от центра по полосам спектра, «дыхание» на бите, плавный поворот, влёт при смене трека.
  const CV_VS = `#version 300 es
precision highp float;
layout(location=0) in vec4 aP;   // u, v, яркость, случайное 0..1
layout(location=1) in vec3 aC;   // цвет пикселя обложки
uniform vec2 uView; uniform vec4 uCam;   // yaw, pitch, dist, f
uniform vec4 uOrg;                       // ox, oy, размер точки, dpr
uniform vec4 uT;                         // время, бит, удар, энергия
uniform vec4 uK;                         // рельеф, сила волн, разброс, влёт 0..1
uniform vec2 uCoverFx; // glow, hue cycles
uniform float uB[16];                    // полосы спектра (бас → верх)
out vec4 vC;
out float vGlow;
float band(float x) { x = clamp(x, 0.0, 0.999) * 15.0; int i = int(x); float f = fract(x); return mix(uB[i], uB[min(i + 1, 15)], f); }
void main() {
  vec2 q = vec2(aP.x - 0.5, 0.5 - aP.y) * 2.0;
  float d = length(q), r = aP.w, t = uT.x;
  float a = band(d * 0.72);
  float z = (aP.z - 0.45) * uK.x * 0.55;                                   // рельеф обложки: светлое ближе
  z += a * uK.y * (0.55 + 0.45 * sin(d * 9.0 - t * 3.2));                   // волна спектра от центра
  z += uT.y * 0.35 * uK.y * (1.0 - d * 0.6);                                // «вдох» на бите
  vec3 p = vec3(q, z);
  float sc = uK.z * (0.04 + uT.w * 0.10 + uT.z * 0.22);                     // разброс: в громких местах и на ударе
  p += vec3(sin(t * 0.9 + r * 40.0), cos(t * 0.7 + r * 57.0), sin(t * 0.5 + r * 23.0)) * sc * (0.3 + d);
  float k0 = 1.0 - uK.w;                                                    // влёт: точки летят из облака к обложке
  if (k0 > 0.0) { float e = k0 * k0 * (1.0 + r); p += vec3(cos(r * 91.0), sin(r * 47.0), 1.6 + sin(r * 13.0)) * e * 2.2; }
  float cy = cos(uCam.x), sy = sin(uCam.x), cp = cos(uCam.y), sp = sin(uCam.y);
  float xr = p.x * cy - p.z * sy, zr = p.x * sy + p.z * cy;
  vec3 v = vec3(xr, p.y * cp - zr * sp, p.y * sp + zr * cp + uCam.z);
  if (v.z < 0.2) { gl_Position = vec4(2.0); gl_PointSize = 0.0; return; }
  float k = uCam.w / v.z;
  vec2 s = vec2(uOrg.x + v.x * k, uOrg.y - v.y * k);
  gl_Position = vec4(s.x / uView.x * 2.0 - 1.0, 1.0 - s.y / uView.y * 2.0, 0.0, 1.0);
  gl_PointSize = max(1.0, uOrg.z * k * uOrg.w * (1.0 + a * 0.9 + uT.z * 0.25));
  float lit = 0.72 + a * 0.9 + uT.y * 0.25;
  float angle=uCoverFx.y*6.2831853;float co=cos(angle),si=sin(angle);
  mat3 hue=mat3(.299+.701*co+.168*si,.587-.587*co+.330*si,.114-.114*co-.497*si,
 .299-.299*co-.328*si,.587+.413*co+.035*si,.114-.114*co+.292*si,
 .299-.300*co+1.250*si,.587-.588*co-1.050*si,.114+.886*co-.203*si);
  vGlow=uCoverFx.x;
  vC = vec4(min((hue*aC) * lit + a * a * 0.25, vec3(1.0)), clamp(0.55 + aP.z * 0.35 + a * 0.4, 0.0, 1.0) * uK.w);
}`;
  const CV_FS = `#version 300 es
precision highp float;
in vec4 vC; in float vGlow; out vec4 o;
void main() { vec2 c = gl_PointCoord - 0.5; float d = length(c); float a = vC.a * (smoothstep(0.5, 0.18, d)+vGlow*.3*exp(-d*d*14.0)); if (a < 0.004) discard; o = vec4(vC.rgb * a, a); }`;

  function sh(gl, type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  function prog(gl, vs, fs) {
    const p = gl.createProgram(); gl.attachShader(p, sh(gl, gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl, gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; for (const n of ['uView', 'uCam', 'uOrg', 'uLW', 'uGlow']) u[n] = gl.getUniformLocation(p, n); return { p, u };
  }
  // кубик [-.5,.5] × [0,1] × [-.5,.5] с нормалями граней
  function cube() {
    const F = [[[0, 1, 0], [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]]], [[0, 0, -1], [[-1, 0, -1], [1, 0, -1], [1, 1, -1], [-1, 1, -1]]], [[0, 0, 1], [[1, 0, 1], [-1, 0, 1], [-1, 1, 1], [1, 1, 1]]],
      [[-1, 0, 0], [[-1, 0, 1], [-1, 0, -1], [-1, 1, -1], [-1, 1, 1]]], [[1, 0, 0], [[1, 0, -1], [1, 0, 1], [1, 1, 1], [1, 1, -1]]]];
    const out = []; for (const [n, q] of F) for (const k of [0, 1, 2, 0, 2, 3]) { const v = q[k]; out.push(v[0] * 0.5, v[1], v[2] * 0.5, n[0], n[1], n[2]); }
    return new Float32Array(out);
  }

  function create(canvas, o = {}) {
    let gl = null, P = null, lost = false;
    const glo = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'high-performance', desynchronized: !!o.desync };
    try { gl = canvas.getContext('webgl2', glo); } catch { gl = null; }
    if (!gl) return null;
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; });
    canvas.addEventListener('webglcontextrestored', () => { lost = false; P = null; });
    let buf = new Float32Array(4096);
    function init() {
      const quad = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
      const mk = (vs, fs, attrs, base, baseStride) => {
        const pr = prog(gl, vs, fs), vao = gl.createVertexArray(), ib = gl.createBuffer(), bb = gl.createBuffer(); gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, bb); gl.bufferData(gl.ARRAY_BUFFER, base, gl.STATIC_DRAW);
        let off = 0; baseStride.forEach((n, i) => { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, n, gl.FLOAT, false, baseStride.reduce((a, b) => a + b, 0) * 4, off); off += n * 4; });
        gl.bindBuffer(gl.ARRAY_BUFFER, ib); const stride = attrs.reduce((a, b) => a + b, 0) * 4; off = 0;
        attrs.forEach((n, j) => { const i = baseStride.length + j; gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, n, gl.FLOAT, false, stride, off); gl.vertexAttribDivisor(i, 1); off += n * 4; });
        gl.bindVertexArray(null);
        return { ...pr, vao, ib, n: attrs.reduce((a, b) => a + b, 0), verts: base.length / baseStride.reduce((a, b) => a + b, 0) };
      };
      P = { pt: mk(PT_VS, PT_FS, [3, 2, 4, 2], quad, [2]), sg: mk(SG_VS, SG_FS, [3, 3, 4, 4], quad, [2]), bx: mk(BX_VS, BX_FS, [4, 4, 1], cube(), [3, 3]) };
    }
    let W = 1, H = 1, cam = [0, 0, 1, 1], org = [0, 0, 0, 1], LW = 1, GL0 = 1;
    const api = {
      ok: () => !!gl && !lost,
      // начало кадра: размер буфера в пикселях устройства, рисуем в CSS-пикселях
      begin(w, h, dpr, clear = true) {
        if (!gl || lost) return false; if (!P) { try { init(); } catch (e) { console.warn('PulseGPU', e); gl = null; return false; } }
        const pw = Math.max(1, Math.round(w * dpr)), ph = Math.max(1, Math.round(h * dpr));
        if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
        W = w; H = h; gl.viewport(0, 0, pw, ph);
        if (clear) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
        return true;
      },
      // камера как cam3(): yaw, pitch, dist, f, ox, oy; roll — наклон кадра; screen — координаты уже в пикселях
      camera(c) { cam = [c.yaw || 0, c.pitch || 0, c.dist || 1, c.f || 1]; org = [c.ox || 0, c.oy || 0, c.roll || 0, c.screen ? 1 : 0]; LW = c.lw ?? 1; GL0 = c.glow ?? 1; },
      // blend 'max' — для линий-полилиний: стыки соседних отрезков не дают «бусин» двойной яркости
      // массивы: точки — [x,y,z, r,rmin, R,G,B,A, glow,ring]; отрезки — [ax,ay,az, bx,by,bz, wk,wmin,glow,haloOnly, R,G,B,A]; коробки — [x,z,h,size, R,G,B,A, roof]
      draw(kind, data, count, blend) {
        if (!gl || lost || !P || !count) return; const p = P[kind];
        gl.useProgram(p.p); gl.uniform2f(p.u.uView, W, H); gl.uniform4f(p.u.uCam, cam[0], cam[1], cam[2], cam[3]); gl.uniform4f(p.u.uOrg, org[0], org[1], org[2], org[3]);
        if (p.u.uLW) gl.uniform1f(p.u.uLW, LW); if (p.u.uGlow) gl.uniform1f(p.u.uGlow, GL0);
        gl.bindVertexArray(p.vao); gl.bindBuffer(gl.ARRAY_BUFFER, p.ib); gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, count * p.n), gl.STREAM_DRAW);
        if (blend === 'max') gl.blendEquation(gl.MAX);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, p.verts, count); gl.bindVertexArray(null);
        if (blend === 'max') gl.blendEquation(gl.FUNC_ADD);
      },
      // общий буфер, чтобы не создавать массивы каждый кадр
      buf(n) { if (buf.length < n) buf = new Float32Array(Math.ceil(n * 1.5)); return buf; },
      // 2.0.9: поле частиц обложки. data — Float32Array [u,v,lum,rnd, r,g,b] × n; key меняется вместе с обложкой
      coverField(data, n, key, c) {
        if (!gl || lost || !n) return;
        if (!P.cv) { const pr = prog(gl, CV_VS, CV_FS), vao = gl.createVertexArray(), vb = gl.createBuffer(); gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, vb);
          gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 28, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 28, 16); gl.bindVertexArray(null);
          P.cv = { ...pr, vao, vb, key: null, n: 0, uT: gl.getUniformLocation(pr.p, 'uT'), uK: gl.getUniformLocation(pr.p, 'uK'), uB: gl.getUniformLocation(pr.p, 'uB'),uCoverFx:gl.getUniformLocation(pr.p,'uCoverFx') }; }
        const p = P.cv; gl.useProgram(p.p); gl.bindVertexArray(p.vao);
        if (p.key !== key) { p.key = key; p.n = n; gl.bindBuffer(gl.ARRAY_BUFFER, p.vb); gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, n * 7), gl.STATIC_DRAW); }
        gl.uniform2f(p.u.uView, W, H); gl.uniform4f(p.u.uCam, c.yaw, c.pitch, c.dist, c.f); gl.uniform4f(p.u.uOrg, c.ox, c.oy, c.size, c.dpr);
        gl.uniform4f(p.uT, c.t, c.beat, c.hit, c.energy); gl.uniform4f(p.uK, c.relief, c.wave, c.scatter, c.intro); gl.uniform1fv(p.uB, c.bands);gl.uniform2f(p.uCoverFx,c.glow??1,c.hue||0);
        gl.drawArrays(gl.POINTS, 0, p.n); gl.bindVertexArray(null);
      },
      canvas, get gl() { return gl; },
    };
    return api;
  }
  let probe = null;
  const supported = () => { if (probe != null) return probe; try { const c = document.createElement('canvas'); probe = !!c.getContext('webgl2'); } catch { probe = false; } return probe; };
  // имя видеокарты (для настроек): видно, что рисует именно она, а не процессор
  let nameC = null;
  function gpuName() {
    if (nameC != null) return nameC; nameC = '';
    try { const c = document.createElement('canvas'), g = c.getContext('webgl2') || c.getContext('webgl'); if (!g) return ''; const e = g.getExtension('WEBGL_debug_renderer_info'); const n = e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); const l = g.getExtension('WEBGL_lose_context'); if (l) l.loseContext(); return (nameC = String(n || '').replace(/^ANGLE \((.*)\)$/, '$1')); } catch { return ''; }
  }
  return { create, supported, gpuName };
})();
