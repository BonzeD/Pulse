const { childFile, byteRange } = require('./core-safety');
const ytdRuntime = require('./ytd-runtime');
// Офлайн: скачивание аудио через yt-dlp, обложки.
// 2.0.3: yt-dlp используется ТОЛЬКО для офлайн-загрузок; прослушивание — прямой запрос к YouTube (см. resolveStream)
const { app } = require('electron');
const fs = require('fs'); const path = require('path'); const { spawn } = require('child_process');

const dirs = () => {
  const off = path.join(app.getPath('userData'), 'offline'), bin = path.join(app.getPath('userData'), 'bin');
  fs.mkdirSync(off, { recursive: true }); fs.mkdirSync(bin, { recursive: true });
  return { off, bin };
};
const acc = () => require('./account');
const AUDIO = /\.(m4a|webm|opus|mp3|ogg|aac|mp4|m4v|mov|mkv)$/i;

function offlineCatalog() {
  const { off } = dirs(), map = {};
  for (const name of fs.readdirSync(off).sort()) {
    const m=/^([\w-]+)(?:\.(audio|video))?\.(m4a|webm|opus|mp3|ogg|aac|mp4|m4v|mov|mkv)$/i.exec(name);
    if(!m)continue; // Do not expose .part files, separate .fNNN streams, or work folders.
    if(!fs.statSync(path.join(off,name)).isFile())continue;
    const [,id,kind,ext0]=m,ext=ext0.toLowerCase(),row=map[id]||(map[id]={files:[],videoCandidates:[]});
    row.files.push(name);
    if(kind==='video')row.videoCandidates.unshift(name);
    else if(['mp4','m4v','mov','mkv','webm'].includes(ext))row.videoCandidates.push(name);
    if(kind==='audio'||['m4a','opus','mp3','ogg','aac'].includes(ext))row.audioFile=name;
  }
  for(const row of Object.values(map)){
    row.videoCandidates.sort((a,b)=>Number(/\.video\./i.test(b))-Number(/\.video\./i.test(a)));
    row.videoFile=row.videoCandidates.find(f=>/\.video\./i.test(f))||null;
    row.file=row.videoFile||row.videoCandidates.find(f=>/\.(mp4|m4v|mov|mkv)$/i.test(f))||row.audioFile||row.files[0];
  }
  return map;
}
function listOffline(){return Object.fromEntries(Object.entries(offlineCatalog()).map(([id,row])=>[id,row.file]));}

// yt-dlp: «распакованная» сборка (yt-dlp_win.zip) стартует за ~0.3 с вместо 2–4 с у одиночного exe,
// который при каждом запуске распаковывает себя во временную папку. Обновляем её сами раз в 2 дня.
let ytdRun = 0, ytdUpd = null; const ytdHealth = new Map();
function ytdDirs() { const { bin } = dirs(); return { cur: path.join(bin, 'ytd'), next: path.join(bin, 'ytd-next') }; }
function ytdSwap() {
  const { cur, next } = ytdDirs();
  if (!ytdRuntime.complete(next) || ytdRun > 0) return;
  try { fs.rmSync(cur + '-old', { recursive: true, force: true }); if (fs.existsSync(cur)) fs.renameSync(cur, cur + '-old'); fs.renameSync(next, cur); ytdHealth.clear(); fs.rmSync(cur + '-old', { recursive: true, force: true }); } catch {}
}
const ytdVer = (d) => { try { return fs.readFileSync(path.join(d, 'version'), 'utf8').trim(); } catch { return ''; } };
function ytdUpdate() {
  if (process.platform !== 'win32' || ytdUpd) return; const { bin } = dirs(); const stamp = path.join(bin, 'updated');
  const last = fs.existsSync(stamp) ? +fs.readFileSync(stamp, 'utf8') : 0; if (Date.now() - last < 2 * 864e5) return;
  ytdUpd = (async () => {
    // Only mark a successful update; a broken extraction must not suppress recovery.
    const j = await (await fetch('https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest', { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'Pulse' } })).json();
    const tag = j && j.tag_name; if (!/^\d{4}\.\d{2}\.\d{2}(?:\.[\w.-]+)?$/.test(tag || '')) return;
    const { cur, next } = ytdDirs(), have = ytdVer(cur) || ytdVer(path.join(process.resourcesPath || '', 'yt-dlp'));
    if (have && have >= tag && (ytdRuntime.complete(cur) || ytdRuntime.complete(path.join(process.resourcesPath || '', 'yt-dlp')))) { fs.writeFileSync(stamp,String(Date.now())); return; }
    const r = await fetch(`https://github.com/yt-dlp/yt-dlp/releases/download/${tag}/yt-dlp_win.zip`, { signal: AbortSignal.timeout(180000) }); if (!r.ok) return;
    const zip = path.join(bin, 'ytd.zip'), bytes=Buffer.from(await r.arrayBuffer());
    const sums=await fetch(`https://github.com/yt-dlp/yt-dlp/releases/download/${tag}/SHA2-256SUMS`,{signal:AbortSignal.timeout(15000)});
    if(!sums.ok)return; const expected=(await sums.text()).split(/\r?\n/).map(l=>l.trim().split(/\s+/)).find(a=>a[1]?.replace(/^\*/, '')==='yt-dlp_win.zip')?.[0];
    if(!expected || require('crypto').createHash('sha256').update(bytes).digest('hex')!==expected.toLowerCase())return;
    fs.writeFileSync(zip, bytes);
    fs.rmSync(next, { recursive: true, force: true }); fs.mkdirSync(next, { recursive: true });
    await new Promise((res) => { const p = spawn('tar', ['-xf', zip, '-C', next], { windowsHide: true }); p.on('error', res); p.on('close', res); });
    if (!ytdRuntime.complete(next)) await new Promise((res) => { const p = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', `Expand-Archive -Force -LiteralPath ${ytdRuntime.psQuote(zip)} -DestinationPath ${ytdRuntime.psQuote(next)}`], { windowsHide: true }); p.on('error', res); p.on('close', res); });
    try { fs.unlinkSync(zip); } catch {}
    if (ytdRuntime.complete(next) && await ytdRuntime.probe(path.join(next,'yt-dlp.exe'))) { fs.writeFileSync(path.join(next, 'version'), tag); fs.writeFileSync(stamp,String(Date.now())); ytdSwap(); }
    else fs.rmSync(next,{recursive:true,force:true});
  })().catch(() => {}).finally(() => (ytdUpd = null));
}
async function ytdlpPath() {
  const { bin } = dirs(); ytdSwap(); setTimeout(ytdUpdate, 20000);
  const fast = [path.join(ytdDirs().cur, 'yt-dlp.exe'), path.join(process.resourcesPath || '', 'yt-dlp', 'yt-dlp.exe'), path.join(__dirname, 'resources', 'yt-dlp', 'yt-dlp.exe')];
  if (process.platform === 'win32') for (const f of fast) if (ytdRuntime.complete(path.dirname(f))) { if(!ytdHealth.has(f))ytdHealth.set(f,ytdRuntime.probe(f)); if(await ytdHealth.get(f))return f; }
  if (process.platform !== 'win32') return 'yt-dlp';
  const exe = path.join(bin, 'yt-dlp.exe');
  if (!fs.existsSync(exe)) {
    const bundled = path.join(process.resourcesPath || '', 'yt-dlp.exe');
    if (fs.existsSync(bundled)) fs.copyFileSync(bundled, exe);
    else {
      const r = await fetch('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe');
      if (!r.ok) throw new Error('yt-dlp download failed');
      fs.writeFileSync(exe, Buffer.from(await r.arrayBuffer()));
    }
  }
  if(!await ytdRuntime.probe(exe))throw Error('Не удалось запустить загрузчик Pulse. Обнови Pulse из нового полного установщика: встроенный Python повреждён или заблокирован системой');
  return exe;
}

async function saveThumb(id, art) {
  const { off } = dirs(); const out = path.join(off, `${id}.jpg`);
  if (fs.existsSync(out) && (!art || fs.existsSync(out + '.sq'))) return;
  if (art && /^https:\/\/([\w-]+\.)*(googleusercontent\.com|ggpht\.com|ytimg\.com)\//.test(art)) {
    try { const u = art.replace(/=w\d+-h\d+[^&?]*$/, '=w544-h544-l90-rj').replace(/=s\d+[^&?]*$/, '=s544'); const r = await fetch(u); if (r.ok) { fs.writeFileSync(out, Buffer.from(await r.arrayBuffer())); fs.writeFileSync(out + '.kind', 'square'); fs.writeFileSync(out + '.sq', '1'); return; } } catch {}
  }
  for (const q of ['maxresdefault', 'hqdefault']) {
    try {
      const r = await fetch(`https://i.ytimg.com/vi/${id}/${q}.jpg`);
      if (r.ok) { fs.writeFileSync(out, Buffer.from(await r.arrayBuffer())); fs.writeFileSync(out + '.kind', q); return; }
    } catch {}
  }
}

const queue = []; let active = 0; const MAX = 2; let notify = () => {}; const arts = {};
const procs = {}; const videoJobs = new Set(); const controllers = new Map(), repairs = new Map();
function setNotifier(fn) { notify = fn; }
function enqueue(id, art, video=false) { if(typeof id!=='string'||!/^[-_a-zA-Z0-9]{11}$/.test(id))return; if (art) arts[id] = art; if (queue.includes(id) || procs[id]) return; if(video)videoJobs.add(id);else videoJobs.delete(id);queue.push(id); notify({ id, status: 'queued', pct: 0 }); pump(); }
function cancel(id) { controllers.get(id)?.abort(); videoJobs.delete(id); const i = queue.indexOf(id); if (i >= 0) queue.splice(i, 1); if (procs[id]) procs[id].kill(); notify({ id, status: 'none' }); }

async function pump() {
  while (active < MAX && queue.length) {
    const id = queue.shift(); active++;
    run(id).catch((e) => { if(e.name!=='AbortError')notify({ id, status: 'error', error: String(e.message || e) }); }).finally(() => { active--; delete procs[id]; pump(); });
  }
}

function checkCancelled(signal) { if(signal?.aborted){ const e=new Error('Загрузка отменена');e.name='AbortError';throw e; } }
// Publish exactly one MP4 with BOTH streams. Never discard old audio before validation.
async function finalizeVideo(id, work, signal) {
  const tools=require('./media-tools'),{off}=dirs(),old=offlineCatalog()[id];
  const staged=fs.readdirSync(work).filter(f=>f.startsWith(id+'.')&&AUDIO.test(f)).map(f=>path.join(work,f));
  const candidates=[...new Set([...staged,...(old?.files||[]).map(f=>childFile(off,f)).filter(Boolean)])],probed=[];
  for(const file of candidates){checkCancelled(signal);try{probed.push({file,info:await tools.probe(file)});}catch{}}
  const video=probed.find(x=>x.info.hasVideo);if(!video)throw Error('Загрузчик вернул только аудио — видео не сохранено');
  const audio=video.info.hasAudio?video:probed.find(x=>x.info.hasAudio);if(!audio)throw Error('У видео нет звуковой дорожки. Файлы сохранены без изменений; повтори загрузку вместе с видео.');
  checkCancelled(signal);
  const output=path.join(work,id+'.complete.mp4'),args=['-nostdin','-v','error','-y','-protocol_whitelist','file,pipe','-i',video.file];
  if(audio.file!==video.file)args.push('-i',audio.file);
  args.push('-map','0:'+video.info.video.index,'-map',(audio.file===video.file?'0':'1')+':a:0',
    ...(video.info.video.codec==='h264'?['-c:v','copy']:['-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-threads','2']),
    ...(audio.info.codec_name==='aac'?['-c:a','copy']:['-c:a','aac','-b:a','192k']),'-movflags','+faststart',output);
  await tools.run(tools.binary('ffmpeg'),args,{signal});
  const result=await tools.probe(output);if(!result.hasVideo||!result.hasAudio)throw Error('Не удалось объединить звук и видео. Исходные файлы сохранены.');
  checkCancelled(signal);const file=id+'.video.mp4';fs.renameSync(output,path.join(off,file));
  for(const name of old?.files||[])if(name!==file){try{fs.unlinkSync(path.join(off,name));}catch(error){if(error.code!=='ENOENT')throw Error('Звук и видео объединены, но старый файл занят плеером. Останови воспроизведение и повтори загрузку.');}}
  return file;
}
function notifyComplete(id){const row=offlineCatalog()[id];notify({id,status:'done',file:row.file,audioFile:row.audioFile||null,videoFile:row.videoFile||null,hasVideo:!!row.videoFile,pct:100});}
// Repair the previous split download without internet when both tracks are already present.
async function repairVideo(id){
  if(typeof id!=='string'||!/^[-_a-zA-Z0-9]{11}$/.test(id)||procs[id])return false;
  if(repairs.has(id))return repairs.get(id);
  const row=offlineCatalog()[id];if(!row||row.files.length<2)return false;
  const job=(async()=>{const {off}=dirs(),tools=require('./media-tools');let hasVideo=false,hasAudio=false;
    for(const name of row.files){try{const p=await tools.probe(path.join(off,name));hasVideo ||= p.hasVideo;hasAudio ||= p.hasAudio;}catch{}}
    if(!hasVideo||!hasAudio)return false;
    const work=fs.mkdtempSync(path.join(off,'.video-work-'));
    try{await finalizeVideo(id,work);notifyComplete(id);return true;}finally{fs.rmSync(work,{recursive:true,force:true});}
  })();repairs.set(id,job);try{return await job;}finally{repairs.delete(id);}
}

async function run(id) {
  if(repairs.has(id))await repairs.get(id);
  const video=videoJobs.has(id);videoJobs.delete(id);
  const { off } = dirs();
  notify({ id, status: 'downloading', pct: 0 });
  const controller=new AbortController();controllers.set(id,controller);let work;
  try {
  const exe = await ytdlpPath();
  await saveThumb(id, arts[id]);checkCancelled(controller.signal);
  work=video?fs.mkdtempSync(path.join(off,'.video-work-')):off;
  await new Promise((resolve, reject) => {
    const args = [...acc().cookieArgs(), '-f', video?'bestvideo[ext=mp4][vcodec^=avc1][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4][height<=1080]/best[height<=1080]':'bestaudio[ext=m4a]/bestaudio', ...(video?['--merge-output-format','mp4','--ffmpeg-location',require('./media-tools').binary('ffmpeg')]:[]), '-o', path.join(work, '%(id)s.%(ext)s'), '--no-playlist', '--newline',
      '--no-mtime', '--progress-template', 'download:PCT %(progress._percent_str)s',
      '--js-runtimes', `node:${process.execPath}`, '--remote-components', 'ejs:github', `https://www.youtube.com/watch?v=${id}`];
    const p = spawn(exe, args, { windowsHide: true, env: ytdRuntime.environment() });
    procs[id] = p; let err = ''; ytdRun++; let fin = false; const finish = () => { if (!fin) { fin = true; ytdRun--; ytdSwap(); } };
    const onData = (b) => {
      const s = b.toString();
      const m = s.match(/PCT\s+([\d.]+)%/g);
      if (m) notify({ id, status: 'downloading', pct: parseFloat(m[m.length - 1].replace(/[^\d.]/g, '')) });
      if (/ERROR/.test(s)) err += s;
    };
    p.stdout.on('data', onData); p.stderr.on('data', (b) => { err += b.toString(); onData(b); });
    p.on('error', (e) => { finish(); reject(e); });
    p.on('close', async (code) => {
      finish();
      if(controller.signal.aborted){try{checkCancelled(controller.signal);}catch(e){reject(e);}return;}
      let file=video?null:listOffline()[id],verifiedVideo=false;
      if(code===0&&video){
        try{
          file=await finalizeVideo(id,work,controller.signal);verifiedVideo=true;
        }catch(error){reject(error);return;}
      }
      if (code === 0 && file && (!video||verifiedVideo)) { notifyComplete(id); resolve(); }
      else {
        const msg = /Failed to start embedded python|Failed to load Python|base_library|PYI-.*ERROR/i.test(err) ? 'Не удалось запустить встроенный Python. Установи новую полную сборку Pulse; проверь журнал защиты, если файлы загрузчика заблокированы' : /not a bot|Sign in/i.test(err) ? 'YouTube просит подтвердить, что ты не бот. Попробуй позже' : (err.split('\n').find((l) => /ERROR/.test(l)) || 'Ошибка загрузки').slice(0, 160);
        reject(new Error(msg));
      }
    });
  }); } finally { controllers.delete(id);if(video&&work)fs.rmSync(work,{recursive:true,force:true}); }
}

function remove(id) {
  const { off } = dirs();
  for (const f of fs.readdirSync(off)) if (f.startsWith(id + '.')) try { fs.unlinkSync(path.join(off, f)); } catch {}
}

function serveOffline(req, res, rel) {
  const { off } = dirs();
  const f = childFile(off, rel);
  if (!f) { res.writeHead(404); return res.end(); }
  let size; try { size = fs.statSync(f).size; } catch { res.writeHead(404); return res.end(); }
  const ext = path.extname(f).toLowerCase();
  const type = { '.m4a': 'audio/mp4', '.webm': 'audio/webm', '.opus': 'audio/ogg', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.aac': 'audio/aac', '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.mkv': 'video/x-matroska', '.jpg': 'image/jpeg' }[ext] || 'application/octet-stream';
  const range = byteRange(req.headers.range, size);
  if (range === false) { res.writeHead(416, { 'Content-Range': `bytes */${size}`, 'Content-Length': 0 }); return res.end(); }
  const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': range ? range.end - range.start + 1 : size };
  if (range) headers['Content-Range'] = `bytes ${range.start}-${range.end}/${size}`;
  res.writeHead(range ? 206 : 200, headers);
  if (req.method === 'HEAD') return res.end();
  const stream = fs.createReadStream(f, range || {});
  stream.on('error', () => res.destroy()); res.on('close', () => stream.destroy()); stream.pipe(res);
}

function thumbKind(id) { try { return fs.readFileSync(path.join(dirs().off, `${id}.jpg.kind`), 'utf8'); } catch { return null; } }

// 2.0: тексты песен переехали в lyrics.js

// ---------- стриминг (без встраивания YouTube) ----------
const { Readable } = require('stream');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';
const VR_UA = 'com.google.android.apps.youtube.vr.oculus/1.62.27 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip';
// кэш ссылок на звук живёт ~6 часов — сохраняем на диск, чтобы после перезапуска треки стартовали сразу
const streamsFile = () => path.join(app.getPath('userData'), 'streams.json');
const streams = {}; let sLoaded = false;
function loadStreams() { if (sLoaded) return; sLoaded = true; try { const o = JSON.parse(fs.readFileSync(streamsFile(), 'utf8')), now = Date.now(); for (const k in o) if (o[k].url && o[k].exp > now + 300e3 && !streams[k]) streams[k] = o[k]; } catch {} }
let saveT = null;
function saveStreams() { clearTimeout(saveT); saveT = setTimeout(() => { try { const o = {}; for (const k in streams) if (streams[k].url) o[k] = { url: streams[k].url, exp: streams[k].exp, ua: streams[k].ua, ci: streams[k].ci }; fs.writeFileSync(streamsFile(), JSON.stringify(o)); } catch {} }, 1500); }
// 2.0.3: звук для прослушивания берётся ТОЛЬКО прямым запросом к плееру YouTube (InnerTube, ~0.3–0.8 с).
// yt-dlp для воспроизведения больше не запускается вообще (он стартовал 4–8 с и тормозил загрузку треков) —
// он нужен для офлайн-загрузок (2.0.4: и как последний запасной путь, см. ytdlpResolve). Если ни один клиент YouTube не отдал звук, плеер сам переключается
// на встроенный YouTube (как и раньше при ошибке потока).
// Несколько клиентов по очереди: если один сломается или не отдаст конкретный трек — пробуем следующий.
const CLIENTS = [
  { name: 'ANDROID_VR', id: '28', ver: '1.62.27', ua: 'com.google.android.apps.youtube.vr.oculus/1.62.27 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip',
    ctx: { deviceMake: 'Oculus', deviceModel: 'Quest 3', androidSdkVersion: 32, osName: 'Android', osVersion: '12L' } },
  { name: 'ANDROID_VR', id: '28', ver: '1.65.10', ua: 'com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip',
    ctx: { deviceMake: 'Oculus', deviceModel: 'Quest 3', androidSdkVersion: 32, osName: 'Android', osVersion: '12L' } },
  { name: 'IOS', id: '5', ver: '20.10.4', ua: 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)',
    ctx: { deviceMake: 'Apple', deviceModel: 'iPhone16,2', osName: 'iPhone', osVersion: '18.3.2.22D82' } }
];
const clientBad = {}; // id трека → номера клиентов, ссылки которых не открылись (403)
const clientDown = CLIENTS.map(() => 0); // клиент временно выключен (сеть/YouTube его сломал) до этого времени
const clientFails = CLIENTS.map(() => 0);
let visitor = '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 2.0.4: при «подтвердите, что вы не бот» / LOGIN_REQUIRED сбрасываем visitorData и пробуем ещё раз «чистым» гостем —
// часто YouTube помечает именно идентификатор гостя, а не адрес. Таймауты увеличены: при замедлении YouTube
// (например, в России) запрос к плееру и проверка ссылки иногда шли дольше 4 с, и треки ошибочно считались «без звука».
async function tryClient(ci, id, fresh) {
  const C = CLIENTS[ci], vis = fresh ? '' : visitor;
  const r = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
    method: 'POST', signal: AbortSignal.timeout(9000),
    headers: { 'Content-Type': 'application/json', 'User-Agent': C.ua, 'X-YouTube-Client-Name': C.id, 'X-YouTube-Client-Version': C.ver, ...(vis ? { 'X-Goog-Visitor-Id': vis } : {}) },
    body: JSON.stringify({ context: { client: { clientName: C.name, clientVersion: C.ver, hl: 'ru', gl: 'RU', ...(vis ? { visitorData: vis } : {}), ...C.ctx } }, videoId: id, contentCheckOk: true, racyCheckOk: true })
  });
  if (!r.ok) throw new Error('net');
  const j = await r.json();
  const vd = j.responseContext && j.responseContext.visitorData; if (vd) visitor = vd;
  const st = j.playabilityStatus && j.playabilityStatus.status;
  if (st !== 'OK') return st === 'LOGIN_REQUIRED' || st === 'UNPLAYABLE' ? { retry: !fresh } : null;
  const a = ((j.streamingData || {}).adaptiveFormats || []).filter((f) => f.url && /^audio\//.test(f.mimeType || ''));
  const m4a = a.filter((f) => /^audio\/mp4/.test(f.mimeType));
  const f = m4a.find((x) => x.itag === 140) || m4a.sort((x, y) => (y.bitrate || 0) - (x.bitrate || 0))[0] || a.sort((x, y) => (y.bitrate || 0) - (x.bitrate || 0))[0];
  if (!f) return null;
  // ссылка действительно открывается (иначе YouTube отдаёт 403 уже в плеере). 2.0.4: если проверка просто не успела
  // (медленная сеть) — ссылку всё равно берём: отказ бывает только с явным 403/410
  let ok = true;
  try {
    const t = await fetch(f.url, { headers: { Range: 'bytes=0-1', 'User-Agent': C.ua }, signal: AbortSignal.timeout(6000) });
    try { await t.body?.cancel(); } catch {}
    ok = t.status === 206 || t.status === 200;
  } catch {}
  if (!ok) return null;
  const exp = +((f.url.match(/[?&]expire=(\d+)/) || [])[1] || 0) * 1000 || Date.now() + 3 * 3600e3;
  return { url: f.url, exp, ua: C.ua, ci };
}
async function fastResolve(id) {
  const bad = clientBad[id] || new Set();
  let retry = false;
  for (let ci = 0; ci < CLIENTS.length; ci++) {
    if (bad.has(ci) || Date.now() < clientDown[ci]) continue;
    try {
      const r = await tryClient(ci, id); clientFails[ci] = 0;
      if (r && r.url) return r;
      if (r && r.retry) retry = true;
    } catch { if (++clientFails[ci] >= 4) { clientDown[ci] = Date.now() + 3 * 60e3; clientFails[ci] = 0; } }
  }
  // 2.0.4: второй круг — новым гостем (без старого visitorData)
  if (retry) for (let ci = 0; ci < CLIENTS.length; ci++) {
    if (bad.has(ci)) continue;
    try { const r = await tryClient(ci, id, true); if (r && r.url) return r; } catch {}
  }
  // все клиенты «на паузе» из-за сбоев сети — даём им ещё один шанс, а не молчим 5 минут
  if (CLIENTS.every((_, ci) => Date.now() < clientDown[ci])) clientDown.fill(0);
  return null;
}
// 2.0.4: последний запасной путь — yt-dlp (с куками входа, если ты вошёл в YouTube). Запускается ТОЛЬКО когда все
// быстрые клиенты не справились, поэтому обычные треки по-прежнему стартуют за доли секунды.
function ytdlpResolve(id) {
  return ytdlpPath().then((exe) => new Promise((res, rej) => {
    const bundledEjs = /[\\/](ytd|yt-dlp)[\\/]yt-dlp\.exe$/i.test(exe);
    const pr = spawn(exe, [...acc().cookieArgs(), '-g', '-f', 'bestaudio[ext=m4a]/bestaudio', '--no-playlist', '--no-warnings', '--socket-timeout', '10', '--retries', '2',
      '--js-runtimes', `node:${process.execPath}`, ...(bundledEjs ? [] : ['--remote-components', 'ejs:github']), `https://www.youtube.com/watch?v=${id}`],
    { windowsHide: true, env: ytdRuntime.environment() });
    ytdRun++; let out = '', err = '', done = false;
    const to = setTimeout(() => { try { pr.kill(); } catch {} }, 30000);
    pr.stdout.on('data', (b) => (out += b)); pr.stderr.on('data', (b) => (err += b));
    const fin = () => { done = true; ytdRun--; clearTimeout(to); ytdSwap(); };
    pr.on('error', (e) => { if (!done) { fin(); rej(e); } });
    pr.on('close', () => {
      if (done) return; fin();
      const url = out.trim().split(/\r?\n/).find((l) => l.startsWith('http'));
      if (url) return res({ url, exp: +((url.match(/[?&]expire=(\d+)/) || [])[1] || 0) * 1000 || Date.now() + 3 * 3600e3, ua: UA });
      rej(new Error(/not a bot|Sign in to confirm/i.test(err) ? 'YouTube просит подтвердить, что ты не бот — войди в аккаунт YouTube в Pulse'
        : /age|inappropriate/i.test(err) ? 'Трек с ограничением по возрасту — войди в аккаунт YouTube'
        : /Private|unavailable|removed|not available/i.test(err) ? 'Видео недоступно на YouTube' : 'YouTube не отдал звук этого трека'));
    });
  }));
}
function resolveStream(id, low) {
  loadStreams(); const c = streams[id];
  if (c && c.url && c.exp > Date.now() + 120e3) return Promise.resolve(c.url);
  if (c && c.p) { if (!low) c.low = false; return c.p; }
  const ent = { low: !!low };
  // предзагрузка в фоне yt-dlp не запускает (лишняя нагрузка); если трек включили — запасной путь подключится
  const p = fastResolve(id).then((r) => r || (ent.low ? null : ytdlpResolve(id))).then((r) => {
    if (!r) throw new Error('YouTube не отдал звук этого трека');
    streams[id] = r; saveStreams(); return r.url;
  });
  ent.p = p; streams[id] = ent; p.catch(() => { if (streams[id] === ent) delete streams[id]; });
  return p;
}
const prefetch = (id) => resolveStream(id, true).then(() => true, () => false);
function upstream(url, req, ua) {
  const ac = new AbortController(); const h = { 'User-Agent': ua || UA };
  let range = req.headers.range || 'bytes=0-';
  const m = range.match(/bytes=(\d+)-(\d*)/);
  if (m && !m[2]) range = `bytes=${m[1]}-${+m[1] + 10 * 1024 * 1024 - 1}`; // куски по 10 МБ — YouTube режет большие
  h.Range = range;
  const to = setTimeout(() => ac.abort(), 15000); // нет ответа за 15 с — пробуем заново
  return fetch(url, { headers: h, signal: ac.signal }).then((r) => { clearTimeout(to); r._ac = ac; return r; }, (e) => { clearTimeout(to); throw e; });
}
async function proxyStream(req, res, id) {
  try {
    let url = await resolveStream(id); let r = await upstream(url, req, streams[id] && streams[id].ua).catch(() => null);
    if (!r) { delete streams[id]; url = await resolveStream(id); r = await upstream(url, req, streams[id] && streams[id].ua); }
    if (r.status === 403 || r.status === 410) { r.body?.cancel().catch(() => {}); const ci = streams[id] && streams[id].ci; delete streams[id]; if (ci != null) (clientBad[id] = clientBad[id] || new Set()).add(ci); url = await resolveStream(id); r = await upstream(url, req, streams[id] && streams[id].ua); }
    const h = { 'Content-Type': r.headers.get('content-type') || 'audio/mp4', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' };
    for (const k of ['content-length', 'content-range']) if (r.headers.get(k)) h[k] = r.headers.get(k);
    res.writeHead(r.status, h);
    res.on('close', () => r._ac.abort());
    if (!r.body || req.method === 'HEAD') { r.body?.cancel().catch(() => {}); return res.end(); }
    Readable.fromWeb(r.body).on('error', () => res.destroy()).pipe(res);
  } catch (e) { if (!res.headersSent) res.writeHead(502); res.end(String(e.message || e)); }
}

module.exports = { ytdlpPath, resolveStream, prefetch, proxyStream, listOffline, offlineCatalog, repairVideo, enqueue, cancel, remove, serveOffline, setNotifier, thumbKind };
