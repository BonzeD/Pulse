// 1.0.0: spectrum from the embedded YouTube player, separate from playback/loading.
(() => {
  const origins = new Set(['https://www.youtube.com','https://www.youtube-nocookie.com']);
  let token = '', active = false, pending = false, lastTry = 0, sample = null, lastAt = 0, status = 'idle';
  const wanted = () => engine === 'yt' && playing && !window.pulseWinHidden;
  window.addEventListener('message', e => {
    const frame = document.getElementById('ytPlayer'), d = e.data;
    if (!active || !origins.has(e.origin) || !frame || e.source !== frame.contentWindow || !d || d.type !== 'pulse-audio-spectrum' || d.token !== token) return;
    status = typeof d.status === 'string' ? d.status.slice(0,64) : status;
    if (!(d.f instanceof Uint8Array) || !(d.w instanceof Uint8Array) || d.f.length !== 1024 || d.w.length !== 2048 || !(d.sampleRate >= 8000 && d.sampleRate <= 192000) || d.fftSize !== 2048) return;
    sample = { f: d.f, w: d.w, sampleRate: d.sampleRate, fftSize: d.fftSize }; lastAt = performance.now();
  });
  async function sync() {
    const want = wanted();
    if (!want) {
      if (active) { active = false; sample = null; lastAt = 0; status = 'idle'; if (pulse.visualizerTap) Promise.resolve(pulse.visualizerTap({ enable: false, token })).catch(() => {}); }
      return;
    }
    if (!active) { active = true; token = crypto.randomUUID(); lastTry = 0; }
    const now = performance.now();
    if (pending || now - lastAt < 600 || (lastTry && now - lastTry < 2000) || !pulse.visualizerTap) return;
    pending = true; lastTry = now;
    try { const r = await pulse.visualizerTap({ enable: true, token }); if (r && r.error) status = r.error; } catch { status = 'bridge-error'; }
    finally { pending = false; }
  }
  window.PulseAudioSignal = { read(now = performance.now()) { return wanted() && sample && now - lastAt < 500 ? sample : null; }, diagnostics() { return { engine, playing, context: actx ? actx.state : 'none', source: engine === 'audio' ? 'local' : 'youtube-capture', status, ageMs: lastAt ? Math.round(performance.now()-lastAt) : null }; }, sync };
  setInterval(sync, 250);
})();
