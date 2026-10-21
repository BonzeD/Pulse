// Discord Rich Presence без сторонних библиотек: локальный IPC-канал клиента Discord (\\?\pipe\discord-ipc-N).
// Протокол: [op:int32LE][len:int32LE][json]. op 0 — рукопожатие, 1 — команда/ответ, 2 — закрытие, 3/4 — ping/pong.
const net = require('net');
const crypto = require('crypto');

// Public Discord Application ID, not a token or secret. Obfuscation is not security.
const APP_ID = '1556326181421187152';
const {normalizeActivity}=require('./discord-safety');
function appKey(){return APP_ID;}
let generation=0,candidate=null;
let sock = null, ready = false, clientId = '', enabled = false, pending = undefined, lastSent = 0, sendT = null, retryT = null, buf = Buffer.alloc(0);
let status = { state: 'off', text: 'Выключено' }, onStatus = () => {}, user = null, lastJson = '';
const MIN_GAP = 4200; // Discord пропускает не больше 5 обновлений за 20 секунд

const setStatus = (state, text) => { status = { state, text:String(text||'').slice(0,500), user }; try { onStatus(status); } catch {} };
const pipePath = (i) => (process.platform === 'win32' ? `\\\\?\\pipe\\discord-ipc-${i}` : `${process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || '/tmp'}/discord-ipc-${i}`);
function frame(op, obj) { const d = Buffer.from(JSON.stringify(obj), 'utf8'), h = Buffer.alloc(8); h.writeInt32LE(op, 0); h.writeInt32LE(d.length, 4); return Buffer.concat([h, d]); }

function cleanup() { generation++;if(candidate){candidate.destroy();candidate=null;} ready = false; buf = Buffer.alloc(0); if (sock) { try { sock.removeAllListeners(); sock.destroy(); } catch {} } sock = null; }
function scheduleRetry(ms = 15000) { clearTimeout(retryT); if (enabled && clientId) retryT = setTimeout(() => connect(0), ms); }

function connect(i = 0) {
  if (!enabled || !clientId || sock) return;
  if (i > 9) { setStatus('wait', 'Discord не запущен — подключусь, когда он откроется'); return scheduleRetry(); }
  if (i === 0) setStatus('connecting', 'Подключаюсь к Discord…');
  const revision=generation; const s = net.createConnection(pipePath(i));candidate=s;
  s.setTimeout(10000,()=>s.destroy());
  let opened = false;
  s.once('connect', () => { if(!enabled||revision!==generation){s.destroy();return;}candidate=null;opened = true; sock = s; s.write(frame(0, { v: 1, client_id: clientId })); });
  s.on('data', (d) => { if(revision!==generation||sock!==s)return; if (buf.length + d.length > 2 * 1024 * 1024) { cleanup(); setStatus('error', 'Слишком большой ответ Discord'); scheduleRetry(); return; } buf = Buffer.concat([buf, d]); parse(); });
  s.once('error', () => { if (!opened && enabled && revision===generation) { try { s.destroy(); } catch {} candidate=null;connect(i + 1); } });
  s.once('close', () => { if (!opened) {if(candidate===s){candidate=null;if(enabled&&revision===generation)connect(i+1);}return;} if(sock!==s)return; cleanup(); if (enabled) { setStatus('wait', 'Связь с Discord потеряна — переподключаюсь'); scheduleRetry(5000); } });
}
function parse() {
  while (buf.length >= 8) {
    const op = buf.readInt32LE(0), len = buf.readInt32LE(4);
    // 1.0.1: a negative frame length could leave buf unchanged and freeze the main loop.
    if (len < 0 || len > 1024 * 1024) { cleanup(); setStatus('error', 'Некорректный ответ Discord'); scheduleRetry(); return; }
    if (buf.length < 8 + len) return;
    let msg = null; try { msg = JSON.parse(buf.slice(8, 8 + len).toString('utf8')); } catch {}
    buf = buf.slice(8 + len);
    if (op === 3 && sock) { sock.write(frame(4, msg || {})); continue; }
    if (op === 2) { const t = (msg && msg.message) || 'Discord закрыл соединение'; cleanup(); setStatus('error', /client_id|Invalid/i.test(t) ? 'Неверный Application ID' : t); scheduleRetry(30000); return; }
    if (!msg) continue;
    if (msg.evt === 'READY') { if(sock?.setTimeout)sock.setTimeout(0);ready = true; user = msg.data && msg.data.user ? { name: msg.data.user.global_name || msg.data.user.username, id: msg.data.user.id } : null; setStatus('ok', user ? `Подключено: ${user.name}` : 'Подключено'); lastJson = ''; flush(true); }
    else if (msg.evt === 'ERROR') setStatus('error', (msg.data && msg.data.message) || 'Ошибка Discord');
  }
}
function flush(force) {
  clearTimeout(sendT); sendT = null;
  if (!ready || !sock || pending === undefined) return;
  const json = JSON.stringify(pending || null); if (!force && json === lastJson) { pending = undefined; return; }
  const wait = lastSent + MIN_GAP - Date.now();
  if (wait > 0 && !force) { sendT = setTimeout(() => flush(true), wait); return; }
  lastSent = Date.now(); lastJson = json;
  const act = pending; pending = undefined;
  try { sock.write(frame(1, { cmd: 'SET_ACTIVITY', args: { pid: process.pid, activity: act || undefined }, nonce: crypto.randomUUID() })); } catch {}
}

module.exports = {
  configure(on, id) {
    id = String(id || '').slice(0,128).trim(); if (!/^\d{15,22}$/.test(id)) id = appKey(); const changed = id !== clientId;
    enabled = !!on; clientId = /^\d{15,22}$/.test(id) ? id : '';
    if (!enabled) { if (sock && ready) try { sock.write(frame(1, { cmd: 'SET_ACTIVITY', args: { pid: process.pid }, nonce: crypto.randomUUID() })); } catch {} cleanup();pending=undefined;clearTimeout(sendT);clearTimeout(retryT); return setStatus('off', 'Выключено'); }
    if (!clientId) { cleanup(); return setStatus('error', id ? 'Application ID — это число из 17–20 цифр' : 'Укажи Application ID'); }
    if (changed) cleanup();
    if (!sock && !candidate) connect(0);
  },
  set(activity) { if(!enabled)return;pending = normalizeActivity(activity); if (ready) flush(false); },
  status: () => status,
  onStatus(fn) { onStatus = fn || (() => {}); },
  destroy() { enabled = false; clearTimeout(retryT); clearTimeout(sendT); if (sock && ready) try { sock.write(frame(1, { cmd: 'SET_ACTIVITY', args: { pid: process.pid }, nonce: crypto.randomUUID() })); } catch {} cleanup(); }
};
