'use strict';
// 1.0.0: owned child process + bounded JSON-lines protocol; no shell/remote commands.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const COMMANDS = new Set(['play', 'pause', 'next', 'prev', 'seekSeconds']);
function normalizeState(st, origin) {
  const number = n => Number.isFinite(n) ? Math.max(0, Math.min(604800, n)) : 0;
  const text = n => typeof n === 'string' ? n.slice(0, 2048) : '';
  let artwork = '';
  try { const u = new URL(st.art, origin); if (u.origin === origin && (u.pathname === '/img' || u.pathname.startsWith('/offline/'))) artwork = u.href; } catch {}
  const dur = number(st.dur);
  return { type: 'state', has: st.has === true, id: text(st.id), title: text(st.title), author: text(st.author), album: text(st.album), artwork, playing: st.has === true && st.playing === true, dur, cur: Math.min(dur, number(st.cur)) };
}
function createMediaBridge({ executable, origin, onCommand, onStatus = () => {}, spawnProcess = spawn, exists = fs.existsSync, platform = process.platform }) {
  let child = null, ready = false, stopped = false, failures = 0, retry = null, timeout = null, latest = null, pending = null, blocked = false;
  const status = (state, detail = '') => { ready = state === 'ready'; onStatus({ state, detail }); };
  function write(value) {
    if (!child || !ready || !child.stdin.writable) return;
    if (blocked) { pending = value; return; }
    try { blocked = !child.stdin.write(JSON.stringify(value) + '\n'); } catch { child.kill(); }
  }
  function start() {
    if (stopped || platform !== 'win32') return;
    if (!exists(executable)) return status('unavailable', 'helper-missing');
    let buffer = '', failed = false;
    status('starting');
    const proc = spawnProcess(executable, [], { windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] }); child = proc;
    function lost(detail) {
      if (failed || child !== proc) return; failed = true;
      clearTimeout(timeout); ready = false; child = null; blocked = false; pending = null;
      status('unavailable', detail); proc.kill();
      // 1.0.0: finite retries, with the most recent state replayed after handshake.
      if (!stopped && failures++ < 3) { retry = setTimeout(start, 1000 * failures); retry.unref?.(); }
    }
    proc.on('error', e => lost(e.code || 'spawn-error')); proc.on('exit', code => lost('exit-' + code));
    proc.stdin.on('error', () => lost('pipe-error'));
    proc.stdin.on('drain', () => { blocked = false; const value = pending; pending = null; if (value) write(value); });
    proc.stderr.on('data', () => {}); // Never allow an unread stderr pipe to stall the child.
    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', data => {
      if (child !== proc) return;
      buffer += data;
      if (buffer.length > 65536) return lost('oversized-frame');
      let at;
      while ((at = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, at).replace(/^\uFEFF/, ''); buffer = buffer.slice(at + 1);
        let msg; try { msg = JSON.parse(line); } catch { continue; }
        if (!msg || typeof msg !== 'object') continue;
        if (msg.type === 'ready' && msg.protocol === 1) { clearTimeout(timeout); status('ready'); if (latest) write(latest); }
        else if (msg.type === 'error') { lost(String(msg.message || 'native-error').slice(0, 120)); return; }
        else if (ready && msg.type === 'command' && COMMANDS.has(msg.command)) {
          if (msg.command === 'seekSeconds' && (!Number.isFinite(msg.value) || msg.value < 0 || msg.value > 604800)) continue;
          onCommand(msg.command, msg.value);
        }
      }
    });
    timeout = setTimeout(() => lost('handshake-timeout'), 10000); timeout.unref?.();
  }
  return {
    start,
    update(st) { latest = normalizeState(st, origin); write(latest); },
    destroy() { stopped = true; clearTimeout(retry); clearTimeout(timeout); ready = false; if (child) { const proc = child; child = null; try { proc.stdin.end('{"type":"quit"}\n'); } catch {} const timer = setTimeout(() => proc.kill(), 1000); timer.unref?.(); proc.once('exit', () => clearTimeout(timer)); } },
    get ready() { return ready; }
  };
}
module.exports = { createMediaBridge, normalizeState };
