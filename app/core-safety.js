'use strict';
// 1.0.1: shared, dependency-free guards for local files, persistence and app origins.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
function inside(root, file) { const r = path.relative(root, file); return r !== '' && r !== '..' && !r.startsWith('..' + path.sep) && !path.isAbsolute(r); }
function childFile(root, rel) {
  if (typeof rel !== 'string' || /[\0\\:]/.test(rel)) return null;
  const f = path.resolve(root, rel.replace(/^\/+/, ''));
  if (!inside(path.resolve(root), f)) return null;
  try { if (!inside(fs.realpathSync(root), fs.realpathSync(f)) || !fs.statSync(f).isFile()) return null; } catch { return null; }
  return f;
}
function byteRange(header, size) {
  if (header == null) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!m || (!m[1] && !m[2]) || size <= 0) return false;
  let a = m[1] ? Number(m[1]) : null, b = m[2] ? Number(m[2]) : size - 1;
  if ((a != null && !Number.isSafeInteger(a)) || !Number.isSafeInteger(b)) return false;
  if (a == null) { if (b <= 0) return false; a = Math.max(0, size - b); b = size - 1; }
  if (a >= size || b < a) return false;
  return { start: a, end: Math.min(b, size - 1) };
}
function readJSON(file, fallback = {}, backup = false) {
  for (const f of backup ? [file, file + '.bak'] : [file]) {
    try { const d = JSON.parse(fs.readFileSync(f, 'utf8')); if (d && typeof d === 'object' && !Array.isArray(d)) return d; } catch {}
  }
  return fallback;
}
function atomicJSON(file, data, backup = false) {
  const text = JSON.stringify(data), tmp = file + '.' + crypto.randomBytes(6).toString('hex') + '.tmp';
  let fd;
  try {
    fd = fs.openSync(tmp, 'wx', 0o600); fs.writeFileSync(fd, text); fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined;
    if (backup) { try { const old = fs.readFileSync(file, 'utf8'); JSON.parse(old); atomicJSON(file + '.bak', JSON.parse(old)); } catch (e) { if (e.code !== 'ENOENT' && !(e instanceof SyntaxError)) throw e; } }
    fs.renameSync(tmp, file);
  } finally { if (fd !== undefined) fs.closeSync(fd); try { fs.unlinkSync(tmp); } catch {} }
}
function appURL(url, port, host = '127.0.0.1', pathname = '/index.html') {
  try { const u = new URL(url); return u.protocol === 'http:' && u.hostname === host && u.port === String(port) && u.pathname === pathname && !u.username && !u.password; } catch { return false; }
}
function lockNavigation(wc, allowed) {
  for (const name of ['will-navigate', 'will-redirect']) wc.on(name, (e, url) => { if (!allowed(url)) e.preventDefault(); });
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));
}
module.exports = { childFile, byteRange, readJSON, atomicJSON, appURL, lockNavigation };
