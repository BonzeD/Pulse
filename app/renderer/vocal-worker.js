// Выделение голоса для распознавания (в отдельном потоке, чтобы не тормозил интерфейс).
// 1) центр стереопанорамы: вокал почти всегда по центру, а синты/ревербы/подпевки разнесены по сторонам;
// 2) полоса голоса 150–5000 Гц; 3) автоусиление тихих фраз (AGC), чтобы распознавание «слышало» шёпот и бубнёж под битом.
const N = 1024, HOP = 512;
const rev = new Uint32Array(N), cs = new Float32Array(N / 2), sn = new Float32Array(N / 2);
for (let i = 0, b = Math.log2(N); i < N; i++) { let r = 0; for (let k = 0; k < b; k++) r |= ((i >> k) & 1) << (b - 1 - k); rev[i] = r; }
for (let i = 0; i < N / 2; i++) { cs[i] = Math.cos((2 * Math.PI * i) / N); sn[i] = -Math.sin((2 * Math.PI * i) / N); }
function fft(re, im) {
  for (let i = 0; i < N; i++) { const j = rev[i]; if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let size = 2; size <= N; size <<= 1) {
    const h = size >> 1, st = N / size;
    for (let i = 0; i < N; i += size) for (let j = 0, k = 0; j < h; j++, k += st) {
      const a = i + j, b = a + h, tr = re[b] * cs[k] - im[b] * sn[k], ti = re[b] * sn[k] + im[b] * cs[k];
      re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
    }
  }
}
const win = new Float32Array(N); for (let i = 0; i < N; i++) win[i] = Math.sqrt(0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
function focus(L, R, sr) {
  const len = L.length, out = new Float32Array(len), re = new Float32Array(N), im = new Float32Array(N);
  const wB = new Float32Array(N / 2 + 1); for (let k = 0; k <= N / 2; k++) { const f = (k * sr) / N; wB[k] = f < 110 ? 0.05 : f < 180 ? 0.4 : f < 5200 ? 1 : f < 7000 ? 0.5 : 0.2; }
  const mono = L === R;
  for (let pos = -HOP; pos < len; pos += HOP) {
    for (let i = 0; i < N; i++) { const p = pos + i, ok = p >= 0 && p < len; re[i] = ok ? L[p] * win[i] : 0; im[i] = ok ? R[p] * win[i] : 0; }
    fft(re, im); // Z = FFT(L + iR)
    const Mr = new Float32Array(N / 2 + 1), Mi = new Float32Array(N / 2 + 1);
    for (let k = 0; k <= N / 2; k++) {
      const nk = (N - k) % N, zr = re[k], zi = im[k], cr = re[nk], ci = -im[nk];
      const lr = (zr + cr) / 2, li = (zi + ci) / 2, ar = zr - cr, ai = zi - ci, rr = ai / 2, ri = -ar / 2;
      let m = 1;
      if (!mono) { const pl = lr * lr + li * li, pr = rr * rr + ri * ri, x = lr * rr + li * ri, psi = (2 * x) / (pl + pr + 1e-12); const c = Math.max(0, Math.min(1, (psi - 0.35) / 0.55)); m = 0.12 + 0.88 * c * c; }
      const g = m * wB[k] * 0.5; Mr[k] = (lr + rr) * g; Mi[k] = (li + ri) * g;
    }
    // обратное преобразование: IFFT(X) = conj(FFT(conj(X))) / N
    for (let k = 0; k <= N / 2; k++) { re[k] = Mr[k]; im[k] = -Mi[k]; if (k && k < N / 2) { re[N - k] = Mr[k]; im[N - k] = Mi[k]; } }
    fft(re, im);
    for (let i = 0; i < N; i++) { const p = pos + i; if (p >= 0 && p < len) out[p] += (re[i] / N) * win[i]; }
  }
  return agc(out, sr);
}
function agc(x, sr) {
  const hop = Math.round(sr * 0.05), n = Math.ceil(x.length / hop), env = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0, c = 0; for (let j = i * hop, e = Math.min(x.length, j + hop * 6); j < e; j++, c++) s += x[j] * x[j]; env[i] = Math.sqrt(s / Math.max(1, c)); }
  const sorted = Array.from(env).sort((a, b) => a - b), floor = sorted[Math.floor(n * 0.15)] || 0, loud = sorted[Math.floor(n * 0.95)] || 1e-3, target = loud * 0.7;
  const gain = new Float32Array(n);
  for (let i = 0; i < n; i++) gain[i] = env[i] < floor * 1.6 ? 1 : Math.max(0.6, Math.min(6, target / (env[i] + 1e-6)));
  for (let i = 1; i < n; i++) gain[i] = gain[i - 1] * 0.7 + gain[i] * 0.3; // сглаживание
  let peak = 0; for (let i = 0; i < x.length; i++) { const k = i / hop, a = Math.floor(k), f = k - a, g = gain[Math.min(n - 1, a)] * (1 - f) + gain[Math.min(n - 1, a + 1)] * f; x[i] *= g; peak = Math.max(peak, Math.abs(x[i])); }
  if (peak > 0) { const k = 0.95 / peak; for (let i = 0; i < x.length; i++) x[i] *= k; }
  return x;
}
onmessage = (e) => { const { L, R, sr } = e.data; try { const out = focus(L, R || L, sr); postMessage({ out }, [out.buffer]); } catch (err) { postMessage({ error: String(err) }); } };
