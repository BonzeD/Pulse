'use strict';
// 1.0.0: independent analysis of the embedded player's captured media stream.
// Never reroute, mute or pause the player's original audio. No system/microphone capture.
function installTap(options) {
  const key = '__pulseVisualAudioTap';
  if (!options.enable) { if (window[key]) window[key].stop(); return { ok: true }; }
  if (window[key] && window[key].token === options.token) return { ok: true };
  if (window[key]) window[key].stop();
  let context = null, stream = null, source = null, analyser = null, sink = null, media = null, closed = false, busy = false, lastAttempt = 0, lastStatus = '';
  const post = (data) => { if (!closed) window.parent.postMessage({ type: 'pulse-audio-spectrum', token: options.token, ...data }, options.origin); };
  function cleanup() {
    for (const n of [source, analyser, sink]) try { n && n.disconnect(); } catch {}
    if (stream) stream.getTracks().forEach(t => t.stop());
    if (context) context.close().catch(() => {});
    source = analyser = sink = context = stream = media = null;
  }
  function status(value) { if (value !== lastStatus) { lastStatus = value; post({ status: value }); } }
  async function attach() {
    if (busy || closed) return; busy = true;
    try {
      const element = [...document.querySelectorAll('video,audio')].find(e => !e.paused && e.readyState >= 2);
      if (!element) { status('waiting-for-media'); return; }
      if (media === element && stream && stream.getAudioTracks().some(t => t.readyState === 'live')) return;
      cleanup();
      const capture = element.captureStream || element.mozCaptureStream;
      if (!capture) { status('capture-unsupported'); return; }
      const captured = capture.call(element); captured.getVideoTracks().forEach(t => t.stop());
      const tracks = captured.getAudioTracks();
      if (!tracks.length) { captured.getTracks().forEach(t => t.stop()); status('no-audio-track'); return; }
      stream = captured; media = element;
      context = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'playback' });
      source = context.createMediaStreamSource(stream); analyser = context.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = .3;
      sink = context.createGain(); sink.gain.value = 0;
      source.connect(analyser); analyser.connect(sink); sink.connect(context.destination);
      await context.resume(); status('capturing');
    } catch (e) { cleanup(); status(e && e.name === 'SecurityError' ? 'capture-restricted' : 'capture-error'); }
    finally { busy = false; }
  }
  const timer = setInterval(() => {
    if (closed) return;
    const now = performance.now();
    if ((!stream || !stream.getAudioTracks().some(t => t.readyState === 'live') || !media || !media.isConnected || media.paused) && now - lastAttempt > 1000) { lastAttempt = now; attach(); }
    if (!analyser || !context || context.state !== 'running' || !media || media.paused) return;
    const f = new Uint8Array(analyser.frequencyBinCount), w = new Uint8Array(analyser.fftSize);
    analyser.getByteFrequencyData(f); analyser.getByteTimeDomainData(w);
    post({ status: 'capturing', f, w, sampleRate: context.sampleRate, fftSize: analyser.fftSize });
  }, 50);
  const onHide = () => window[key] && window[key].stop();
  window[key] = { token: options.token, stop() { closed = true; clearInterval(timer); window.removeEventListener('pagehide', onHide); cleanup(); if (window[key] === this) delete window[key]; } };
  window.addEventListener('pagehide', onHide, { once: true });
  attach(); return { ok: true };
}
function isPlayerFrame(frame) {
  try { const u = new URL(frame.url); return u.protocol === 'https:' && ['www.youtube.com','www.youtube-nocookie.com'].includes(u.hostname) && u.pathname.startsWith('/embed/'); } catch { return false; }
}
async function configureTap(win, event, options) {
  if (!win || win.isDestroyed() || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) return { ok: false, error: 'unauthorized' };
  if (!options || typeof options.enable !== 'boolean' || !/^[\w-]{16,96}$/.test(options.token || '')) return { ok: false, error: 'invalid-request' };
  const origin = new URL(win.webContents.getURL()).origin;
  const frame = win.webContents.mainFrame.framesInSubtree.find(isPlayerFrame);
  if (!frame || frame.isDestroyed()) return { ok: false, error: 'player-not-ready' };
  try { return await frame.executeJavaScript(`(${installTap.toString()})(${JSON.stringify({ enable: options.enable, token: options.token, origin })})`, true); }
  catch { return { ok: false, error: 'capture-unavailable' }; }
}
module.exports = { installTap, isPlayerFrame, configureTap };
