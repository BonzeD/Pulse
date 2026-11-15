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
async function ytdlpPath(diag) {
  const { bin } = dirs(); ytdSwap(); setTimeout(ytdUpdate, 20000);
  const fast = [path.join(ytdDirs().cur, 'yt-dlp.exe'), path.join(process.resourcesPath || '', 'yt-dlp', 'yt-dlp.exe'), path.join(__dirname, 'resources', 'yt-dlp', 'yt-dlp.exe')];
  if (process.platform === 'win32') for (const f of fast) if (ytdRuntime.complete(path.dirname(f))) { const runtime=f===fast[0]?'updated':'bundled',cacheHit=ytdHealth.has(f),health=diag?.child('backup-health',{runtime,cacheHit});if(!cacheHit)ytdHealth.set(f,ytdRuntime.probe(f));const ok=await ytdHealth.get(f);health?.({outcome:ok?'ok':'error',reason:ok?'runtime-ready':'runtime-unhealthy'});if(ok){if(diag?.operation)diag.event('backup-runtime',{outcome:'ok',runtime,toolVersion:ytdVer(path.dirname(f))});return f;} }
  if (process.platform !== 'win32') {diag?.event('backup-runtime',{outcome:'ok',runtime:'path'});return 'yt-dlp';}
  const exe = path.join(bin, 'yt-dlp.exe');
  if (!fs.existsSync(exe)) {
    const bundled = path.join(process.resourcesPath || '', 'yt-dlp.exe');
    if (fs.existsSync(bundled)) fs.copyFileSync(bundled, exe);
    else {
      const download=diag?.child('backup-download',{reason:'runtime-missing'});let r;
      try{r=await fetch('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe');if(!r.ok)throw new Error('yt-dlp download failed');const bytes=Buffer.from(await r.arrayBuffer());fs.writeFileSync(exe,bytes);download?.({outcome:'ok',status:r.status,bytes:bytes.length});}
      catch(e){download?.({outcome:'error',status:r?.status,reason:r&&!r.ok?'http-error':require('./audio-diagnostics').classifyFailure(e)});throw e;}
    }
  }
  const health=diag?.child('backup-health',{runtime:'single-exe',cacheHit:false});const healthy=await ytdRuntime.probe(exe);health?.({outcome:healthy?'ok':'error',reason:healthy?'runtime-ready':'runtime-unhealthy'});if(!healthy)throw Error('Не удалось запустить загрузчик Pulse. Обнови Pulse из нового полного установщика: встроенный Python повреждён или заблокирован системой');
  diag?.event('backup-runtime',{outcome:'ok',runtime:'single-exe'});return exe;
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
const streams = Object.create(null); let sLoaded = false;
const streamId = id => typeof id === 'string' && /^[-_a-zA-Z0-9]{11}$/.test(id);
const {firstAvailable,hedgedFallback} = require('./stream-race');
function loadStreams() { if (sLoaded) return; sLoaded = true; try { const o = JSON.parse(fs.readFileSync(streamsFile(), 'utf8')), now = Date.now(); for (const k of Object.keys(o).slice(-200)) if (streamId(k) && o[k]?.url && o[k].verified === 4 && o[k].exp > now + 300e3 && !streams[k]) streams[k] = o[k]; } catch {} }
let saveT = null;
function saveStreams() { clearTimeout(saveT); saveT = setTimeout(() => { try { const o = {}; for (const k in streams) if (streams[k].url) o[k] = { url: streams[k].url, exp: streams[k].exp, ua: streams[k].ua, ci: streams[k].ci, headers: mediaHeaders(streams[k].headers), verified: streams[k].verified }; fs.writeFileSync(streamsFile(), JSON.stringify(o)); } catch {} }, 1500); }
// 2.0.3: звук для прослушивания берётся ТОЛЬКО прямым запросом к плееру YouTube (InnerTube, ~0.3–0.8 с).
// yt-dlp для воспроизведения больше не запускается вообще (он стартовал 4–8 с и тормозил загрузку треков) —
// он нужен для офлайн-загрузок (2.0.4: и как последний запасной путь, см. ytdlpResolve). Если ни один клиент YouTube не отдал звук, плеер сам переключается
// на встроенный YouTube (как и раньше при ошибке потока).
// Staggered candidates race through BOTH metadata and a real media-byte check. An API URL alone is not playable proof.
const CLIENTS = [
  { name: 'ANDROID_VR', id: '28', ver: '1.62.27', ua: 'com.google.android.apps.youtube.vr.oculus/1.62.27 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip',
    ctx: { deviceMake: 'Oculus', deviceModel: 'Quest 3', androidSdkVersion: 32, osName: 'Android', osVersion: '12L' } },
  { name: 'ANDROID_VR', id: '28', ver: '1.65.10', ua: 'com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip',
    ctx: { deviceMake: 'Oculus', deviceModel: 'Quest 3', androidSdkVersion: 32, osName: 'Android', osVersion: '12L' } },
  { name: 'IOS', id: '5', ver: '20.10.4', ua: 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)',
    ctx: { deviceMake: 'Apple', deviceModel: 'iPhone16,2', osName: 'iPhone', osVersion: '18.3.2.22D82' } }
];
const clientBad = Object.create(null); // id трека → номера клиентов, ссылки которых не открылись (403)
const clientDown = CLIENTS.map(() => 0); // клиент временно выключен (сеть/YouTube его сломал) до этого времени
const clientFails = CLIENTS.map(() => 0);
let visitor = '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 2.0.4: при «подтвердите, что вы не бот» / LOGIN_REQUIRED сбрасываем visitorData и пробуем ещё раз «чистым» гостем —
// часто YouTube помечает именно идентификатор гостя, а не адрес. Таймауты увеличены: при замедлении YouTube
// (например, в России) запрос к плееру и проверка ссылки иногда шли дольше 4 с, и треки ошибочно считались «без звука».
// The previous optimization raced API metadata only. Some clients return valid-looking URLs
// whose CDN responds 403: selecting one canceled the genuinely playable alternatives.
const audioTrace=require('./audio-diagnostics');
const streamPolicy=require('./stream-policy').create();
let audioSessionRevision, nextWarm=null, activeWarm=null, backupTail=Promise.resolve(), foregroundBackups=0;
function resetStreamPolicy(){streamPolicy.reset();for(const k of Object.keys(clientBad))delete clientBad[k];rejectedAt.clear();directRejected.clear();clientDown.fill(0);clientFails.fill(0);cancelNextWarm();activeWarm?.ent.controller.abort();}
function syncStreamSession(){const revision=acc().sessionRevision?.()||0;if(audioSessionRevision!==undefined&&revision!==audioSessionRevision){resetStreamPolicy();for(const k of Object.keys(streams)){streams[k].controller?.abort();delete streams[k];}saveStreams();}audioSessionRevision=revision;}
function cancelNextWarm(){if(nextWarm){clearTimeout(nextWarm.timer);nextWarm.done(false);nextWarm=null;}}
async function backupResolve(id,ent,signal=ent.controller.signal){
 const warming=ent.low&&ent.warm;let release;const queue=ent.diag.child('backup-queue',{prefetch:ent.low,activeBackups:foregroundBackups});
 if(warming){const previous=backupTail;backupTail=new Promise(r=>release=r);await previous;}else{foregroundBackups++;await backupTail;}
 queue({outcome:'ok'});try{if(warming&&foregroundBackups)throw Error('Foreground audio has priority');
  // 1.0.2 renewed a rejected URL in the proxy. Keep that bounded recovery BEFORE
  // reporting resolution failure, otherwise the renderer can fall into a forbidden embed.
  for(let attempt=1;attempt<=2;attempt++){
   if(signal.aborted)throw Error('Audio preparation cancelled');const end=ent.diag.child('backup',{id,source:'yt',prefetch:ent.low,attempt});let r;
   try{r=await ytdlpResolve(id,signal,end);end({outcome:'ok'});}catch(e){end({outcome:signal.aborted?'cancelled':'error',reason:audioTrace.classifyFailure(e)});throw e;}
   let status;
   if(await probeAudio(r.url,r.ua,signal,{id,engine:'backup',source:'yt',prefetch:ent.low,attempt},s=>status=s,ent.diag,r.headers)){streamPolicy.backupSuccess();return {...r,verified:4};}
   if(signal.aborted)throw Error('Audio preparation cancelled');
   if(attempt===2||![401,403,410].includes(status))throw Error('YouTube не отдал рабочий аудиопоток');
   ent.diag.event('resolve-path',{reason:'backup-retry',status,attempt:attempt+1,prefetch:ent.low});
  }
 }finally{if(warming)release();else foregroundBackups--;}
}

// Probe the same bounded range as normal playback; consume one chunk then cancel.
function audioRange(range='bytes=0-') {
  const m=range.match(/^bytes=(\d+)-(\d*)$/);
  return m&&!m[2]?`bytes=${m[1]}-${+m[1]+10*1024*1024-1}`:range;
}
const rejectedAt=new Map(), directRejected=new Map();
function badClients(id) {
  if(Date.now()-(rejectedAt.get(id)||0)>15*60e3){delete clientBad[id];directRejected.delete(id);rejectedAt.delete(id);}
  return clientBad[id]||new Set();
}
function rejectClient(id,ci) {
  badClients(id);(clientBad[id]||=new Set()).add(ci);rejectedAt.set(id,Date.now());
  directRejected.set(id,(directRejected.get(id)||0)+1);
  while(rejectedAt.size>200){const k=rejectedAt.keys().next().value;rejectedAt.delete(k);directRejected.delete(k);delete clientBad[k];}
}
// Only per-format media request headers, never cookies/auth tokens or arbitrary headers.
function mediaHeaders(value){
 const out={};if(!value||typeof value!=='object')return out;
 for(const [k,v]of Object.entries(value)){const key=k.toLowerCase();if(!['user-agent','referer','origin','accept-language'].includes(key)||typeof v!=='string'||!v||v.length>2048||/[\r\n]/.test(v))continue;out[key]=v;}
 return out;
}
function mediaResponseReason(response,allowEmpty=false){
 const type=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
 if(![200,206].includes(response.status))return 'http-error';
 if(!/^(audio\/|video\/|application\/octet-stream$)/.test(type))return 'invalid-content';
 if(!allowEmpty&&(!response.body||response.headers.get('content-length')==='0'))return 'empty-body';
 if(response.status===206){
  const m=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('content-range')||'');
  if(!m)return 'invalid-range';const start=Number(m[1]),end=Number(m[2]),total=Number(m[3]),length=response.headers.get('content-length');
  if(![start,end,total].every(Number.isSafeInteger)||end<start||end>=total||total<=0||(length!==null&&(!/^\d+$/.test(length)||Number(length)!==end-start+1)))return 'invalid-range';
 }
 return null;
}
function staticAudioFormat(f){
 // A live/DVR fragment can have an audio MIME and even serve bytes while Chromium
 // reports a millions-of-seconds timestamp. It is not a seekable song file.
 if(!f?.url||!/^audio\//.test(f.mimeType||'')||f.targetDurationSec!=null)return false;
 let url;try{url=new URL(f.url);}catch{return false;}
 if(!['http:','https:'].includes(url.protocol)||url.searchParams.get('source')==='yt_live_broadcast'||url.searchParams.get('live')==='1'||url.searchParams.has('sq'))return false;
 return Number.isFinite(Number(f.contentLength))&&Number(f.contentLength)>0&&Number.isFinite(Number(f.approxDurationMs))&&Number(f.approxDurationMs)>0;
}
async function probeAudio(url, ua, signal, traceData={},onStatus,observation,headers) {
  const end=observation?observation.child('probe',traceData):audioTrace.begin('probe',traceData);let outcome='error',reason='unknown';
  let response, reader;
  try {
    const timeout = AbortSignal.timeout(6000);
    response = await fetch(url, {headers:{...mediaHeaders(headers),'user-agent':ua || UA, Range:audioRange('bytes=0-')}, signal:signal ? AbortSignal.any([signal,timeout]) : timeout});
    const invalid=mediaResponseReason(response);if(invalid){reason=invalid;return false;}
    reader = response.body.getReader();
    const chunk = await reader.read();
    const valid=!chunk.done && chunk.value?.byteLength > 0;outcome=valid?'ok':'error';reason=valid?undefined:'empty-body';return valid;
  } catch(e) {reason=audioTrace.classifyFailure(e);return false; }
  finally { onStatus?.(response?.status);end({outcome:signal?.aborted?'cancelled':outcome,status:response?.status,reason:signal?.aborted?'aborted':reason});if(reader)await reader.cancel().catch(()=>{});else await response?.body?.cancel().catch(()=>{}); }
}
async function tryClient(ci, id, fresh, signal, observation) {
  const end=observation?observation.child('player-api',{id,client:ci,source:'yt'}):audioTrace.begin('player-api',{id,client:ci,source:'yt'});
  try{return await tryClientObserved(ci,id,fresh,signal,end);}catch(e){end({outcome:signal?.aborted?'cancelled':'error',reason:audioTrace.classifyFailure(e)});throw e;}
}
async function tryClientObserved(ci, id, fresh, signal, apiEnd) {
  const C = CLIENTS[ci], vis = fresh ? '' : visitor;
  const r = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
    method: 'POST', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(9000)]) : AbortSignal.timeout(9000),
    headers: { 'Content-Type': 'application/json', 'User-Agent': C.ua, 'X-YouTube-Client-Name': C.id, 'X-YouTube-Client-Version': C.ver, ...(vis ? { 'X-Goog-Visitor-Id': vis } : {}) },
    body: JSON.stringify({ context: { client: { clientName: C.name, clientVersion: C.ver, hl: 'ru', gl: 'RU', ...(vis ? { visitorData: vis } : {}), ...C.ctx } }, videoId: id, contentCheckOk: true, racyCheckOk: true })
  });
  if (!r.ok) {apiEnd({outcome:'error',status:r.status,reason:'http-error'});throw new Error('net');}
  const j = await r.json();apiEnd({outcome:j.playabilityStatus?.status==='OK'?'ok':'denied',status:r.status,playability:j.playabilityStatus?.status,formats:j.streamingData?.adaptiveFormats?.length});
  const vd = j.responseContext && j.responseContext.visitorData; if (vd) visitor = vd;
  const st = j.playabilityStatus && j.playabilityStatus.status;
  if(st==='LOGIN_REQUIRED')streamPolicy.reject(ci,id);
  if (st !== 'OK') return st === 'LOGIN_REQUIRED' || st === 'UNPLAYABLE' ? { retry: !fresh && !streamPolicy.blocked(ci) } : null;
  const a = ((j.streamingData || {}).adaptiveFormats || []).filter(staticAudioFormat);
  if(!a.length)apiEnd.event('format-policy',{outcome:'skipped',reason:'unsupported-format'});
  const m4a = a.filter((f) => /^audio\/mp4/.test(f.mimeType));
  const f = m4a.find((x) => x.itag === 140) || m4a.sort((x, y) => (y.bitrate || 0) - (x.bitrate || 0))[0] || a.sort((x, y) => (y.bitrate || 0) - (x.bitrate || 0))[0];
  if (!f) return null;
  // Keep candidates racing until one actually serves audio, not merely an API URL.
  let probeStatus;
  if (!await probeAudio(f.url, C.ua, signal,{id,client:ci,source:'yt'},status=>probeStatus=status,apiEnd)) {if(!signal?.aborted&&[401,403,410].includes(probeStatus))streamPolicy.reject(ci,id);return null;}
  streamPolicy.success(ci);
  const exp = +((f.url.match(/[?&]expire=(\d+)/) || [])[1] || 0) * 1000 || Date.now() + 3 * 3600e3;
  return { url: f.url, exp, ua: C.ua, ci, verified: 4 };
}
async function fastResolve(id, signal, diag) {
  const bad = badClients(id);
  const retry = new Set();
  const run = (ci, fresh) => async signal => {
    try {
      const r = await tryClient(ci, id, fresh, signal,diag);
      if (signal.aborted) return null;
      clientFails[ci] = 0;
      if (r?.retry) retry.add(ci);
      return r?.url ? r : null;
    } catch {
      if (!signal.aborted && ++clientFails[ci] >= 4) { clientDown[ci] = Date.now() + 3 * 60e3; clientFails[ci] = 0; }
      return null;
    }
  };
  const candidates = CLIENTS.map((_,ci)=>ci).filter(ci=>{const reason=bad.has(ci)?'track-rejected':streamPolicy.blocked(ci)?'policy-cooldown':Date.now()<clientDown[ci]?'network-cooldown':'eligible';(diag?.event||audioTrace.event)('client-policy',{id,client:ci,outcome:reason==='eligible'?'ok':'skipped',reason,cooldownMs:reason==='network-cooldown'?Math.max(0,clientDown[ci]-Date.now()):undefined});return reason==='eligible';});
  if(!candidates.length)(diag?.event||audioTrace.event)('resolve-path',{id,reason:'no-candidates',outcome:'skipped'});
  const result = await firstAvailable(candidates.map(ci=>run(ci,false)),{signal});
  if (result || signal?.aborted) return result;
  return retry.size ? firstAvailable([...retry].map(ci=>run(ci,true)),{signal}) : null;
}
// yt-dlp (with the existing account cookies) is a hedged backup: foreground
// requests give direct clients 1.5 s, then race both verified paths. Hover never spawns it.
function ytdlpResolve(id, signal, observation) {
  const diag=observation||audioTrace.begin('backup',{id,source:'yt'});
  const runtime=diag.child('backup-runtime');
  return ytdlpPath(runtime).then((exe) => {
    runtime({outcome:'ok'});
    return new Promise((res, rej) => {
      const bundledEjs = /[\\/](ytd|yt-dlp)[\\/]yt-dlp\.exe$/i.test(exe);
      if(signal?.aborted)return rej(new Error('Audio preparation cancelled'));
      const cookies=acc().cookieArgs();
      const proc=diag.child('backup-process',{authCookies:cookies.length>0,runtime:bundledEjs?'bundled-ejs':'remote-ejs'});
      let pr;
      try{pr=spawn(exe, [...cookies, '--dump-single-json', '-f', 'bestaudio[ext=m4a]/bestaudio', '--no-playlist', '--no-warnings', '--socket-timeout', '10', '--retries', '2',
        '--js-runtimes', `node:${process.execPath}`, ...(bundledEjs ? [] : ['--remote-components', 'ejs:github']), `https://www.youtube.com/watch?v=${id}`],
        { windowsHide: true, env: ytdRuntime.environment() });}
      catch(e){proc({outcome:'error',reason:audioTrace.classifyFailure(e)});return rej(e);}
      ytdRun++; let out = '', err = '', done = false,firstOutput=false,firstErrorOutput=false,firstUrl=false;
      const info=()=>{try{const data=JSON.parse(out.trim());return data&&typeof data==='object'?data:null;}catch{return null;}};
      const markUrl=()=>{if(!firstUrl&&typeof info()?.url==='string'){firstUrl=true;proc.event('backup-url',{outcome:'ok'});}};
      const to = setTimeout(() => { if(done)return; try { pr.kill(); } catch {} fin();proc({outcome:'timeout',reason:'process-deadline'});rej(new Error('Истекло время получения аудиопотока')); }, 30000);
      pr.once('spawn',()=>proc.event('backup-spawned',{outcome:'ok'}));
      pr.stdout.on('data', (b) => {if(done)return;if(!firstOutput){firstOutput=true;proc.event('backup-output',{outcome:'ok',channel:'stdout'});}out = (out + b).slice(-2*1024*1024);markUrl();});
      pr.stderr.on('data', (b) => {if(done)return;if(!firstErrorOutput){firstErrorOutput=true;proc.event('backup-output',{outcome:'ok',channel:'stderr'});}err = (err + b).slice(-65536);});
      const fin = () => { done = true; ytdRun--; clearTimeout(to);signal?.removeEventListener('abort',abort); ytdSwap(); };
      const abort=()=>{if(done)return;try{pr.kill();}catch{}fin();proc({outcome:'cancelled',reason:'aborted'});rej(new Error('Audio preparation cancelled'));};
      signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
      pr.on('error', (e) => { if (!done) { fin();proc({outcome:'error',reason:audioTrace.classifyFailure(e)});rej(e); } });
      pr.on('close', (code,exitSignal) => {
        if (done) return; fin();
        const data=info(),candidate=typeof data?.url==='string'?data.url:'',supported=!data?.is_live&&!/m3u8|dash_segments|f4m/i.test(data?.protocol||'');
        const url=/^https?:\/\//.test(candidate)&&supported?candidate:null,headers=mediaHeaders(data?.http_headers);
        if(url&&!firstUrl)proc.event('backup-url',{outcome:'ok'});
        proc({outcome:url?'ok':'error',exitCode:code,exitSignal:['SIGTERM','SIGKILL','SIGINT'].includes(exitSignal)?exitSignal:undefined,urlFound:!!url,reason:url?undefined:!supported?'unsupported-format':err?audioTrace.classifyFailure(err):out.trim()?'invalid-output':'no-url'});
        if (url) return res({ url, exp: +((url.match(/[?&]expire=(\d+)/) || [])[1] || 0) * 1000 || Date.now() + 3 * 3600e3, ua:headers['user-agent']||UA, headers });
        rej(new Error(/not a bot|Sign in to confirm/i.test(err) ? 'YouTube просит подтвердить, что ты не бот — войди в аккаунт YouTube в Pulse'
          : /age|inappropriate/i.test(err) ? 'Трек с ограничением по возрасту — войди в аккаунт YouTube'
          : /Private|unavailable|removed|not available/i.test(err) ? 'Видео недоступно на YouTube' : 'YouTube не отдал звук этого трека'));
      });
    });
  },e=>{runtime({outcome:signal?.aborted?'cancelled':'error',reason:audioTrace.classifyFailure(e)});throw e;});
}

function resolveStream(id, low, warm=false) {
  const end=audioTrace.begin('resolve',{id,source:'yt',prefetch:!!low});
  const promise=resolveStreamObserved(id,low,warm,end);promise.then(()=>end({outcome:'ok'}),e=>end({outcome:'error',reason:audioTrace.classifyFailure(e)}));return promise;
}
function resolveStreamObserved(id, low, warm=false, diag) {
  if (!streamId(id)) return Promise.reject(new Error('Invalid audio ID'));
  syncStreamSession();
  if(!low){cancelNextWarm();if(activeWarm?.ent.low&&activeWarm.id!==id)activeWarm.ent.controller.abort();}
  loadStreams(); const c = streams[id];
  audioTrace.event('cache',{id,source:'yt',prefetch:!!low,outcome:c?.url&&c.exp>Date.now()+120e3?'hit':c?.p?'pending':'miss'});
  if (c && c.url && c.exp > Date.now() + 120e3) return Promise.resolve(c.url);
  if (c && c.p) { diag.event('resolve-shared',{sharedOperation:c.diag?.operation,reason:low?'shared-prefetch':'shared-foreground'});if (!low) {c.low=false;c.warm=false;c.promote?.();} return c.p; }
  const ent = {low:!!low,warm,controller:new AbortController(),diag};
  if(warm)activeWarm={id,ent};
  // Hover remains lightweight; only an explicitly scheduled next track may prepare a verified backup.
  badClients(id);
  const race = hedgedFallback(
    signal => {const skip=(directRejected.get(id)||0)>=2&&!ent.low;diag.event('resolve-path',{reason:skip?'repeated-upstream-rejection':'direct-start',outcome:skip?'skipped':'start'});return skip?null:fastResolve(id,signal,diag);},
    signal => {diag.event('resolve-path',{reason:'backup-start',prefetch:ent.low,outcome:'start'});return backupResolve(id,ent,signal);},
    {signal:ent.controller.signal,canBackup:()=>!ent.low||ent.warm}
  );
  ent.promote=race.promote;
  const p = race.promise.then((r) => {
    if(ent.controller.signal.aborted)throw Error('Audio preparation cancelled');
    if (!r) throw new Error('YouTube не отдал звук этого трека');
    diag.event('resolve-path',{outcome:'ok',reason:r.ci==null?'winner-backup':'winner-direct'});streams[id] = r;
    for (const key of Object.keys(streams)) { if (Object.keys(streams).length <= 200) break; if (!streams[key].p && key !== id) { delete streams[key]; delete clientBad[key]; } }
    saveStreams(); return r.url;
  });
  ent.p = p; streams[id] = ent;const clearWarm=()=>{if(activeWarm?.ent===ent)activeWarm=null;};p.then(clearWarm,clearWarm); p.catch(() => { if (streams[id] === ent) delete streams[id]; });
  return p;
}
function prefetch(id,next=false){
 syncStreamSession();
 audioTrace.event('prefetch-policy',{id,source:'yt',prefetch:true,next,reason:!next?'hover-direct-only':!streamId(id)?'target-cancelled':'next-request'});
 if(next&&!streamId(id)){cancelNextWarm();if(activeWarm?.ent.low)activeWarm.ent.controller.abort();return Promise.resolve(false);}
 if(next){if(nextWarm&&nextWarm.id!==id)cancelNextWarm();if(activeWarm?.ent.low&&activeWarm.id!==id)activeWarm.ent.controller.abort();}
 if(!next||!streamPolicy.canWarm()){if(next)audioTrace.event('prefetch-policy',{id,next,reason:'next-direct-only'});return resolveStream(id,true).then(()=>true,()=>next&&streamPolicy.canWarm()?prefetch(id,true):false);}
 audioTrace.event('prefetch-policy',{id,next,reason:'next-backup-eligible'});
 if(!streamId(id))return Promise.resolve(false);
 if(streams[id]?.url&&streams[id].exp>Date.now()+120e3)return Promise.resolve(true);
 if(nextWarm?.id===id)return nextWarm.promise;
 cancelNextWarm();if(activeWarm?.ent.low&&activeWarm.id!==id)activeWarm.ent.controller.abort();
 audioTrace.event('prefetch-policy',{id,next:true,reason:'next-warm-scheduled'});
 const job={id};job.promise=new Promise(done=>job.done=done);nextWarm=job;
 job.timer=setTimeout(()=>{if(nextWarm!==job)return;nextWarm=null;
  if(!streamPolicy.canWarm()||Object.values(streams).some(x=>x.p&&!x.low)){job.done(false);return;}
  resolveStream(id,true,true).then(()=>job.done(true),()=>job.done(false));
 },1200);job.timer.unref?.();return job.promise;
}
function upstream(url, req, ua, signal, headers) {
  const h = { ...mediaHeaders(headers), 'user-agent': ua || UA };
  h.Range = audioRange(req.headers.range || 'bytes=0-');
  const deadline=new AbortController(),timer=setTimeout(()=>deadline.abort(),15000);
  return fetch(url,{headers:h,signal:signal?AbortSignal.any([signal,deadline.signal]):deadline.signal}).finally(()=>clearTimeout(timer));
}
function rangeDiagnostic(value) {
 if(!value)return {rangeKind:'none'};
 const m=/^bytes=(\d*)-(\d*)$/.exec(value);
 if(!m||(!m[1]&&!m[2]))return {rangeKind:'invalid'};
 return {rangeKind:!m[1]?'suffix':!m[2]?'open':'bounded',rangeStart:m[1]?Number(m[1]):undefined,rangeEnd:m[2]?Number(m[2]):undefined};
}
async function proxyStream(req, res, id) {
  const purpose=req.headers['x-pulse-audio-purpose']==='analysis'?'analysis':['audio','video'].includes(req.headers['sec-fetch-dest'])?'playback':'unknown';let streamBytes=0;const streamEnd=audioTrace.begin('stream',{id,source:'yt',purpose,method:req.method,...rangeDiagnostic(req.headers.range)});res.once('finish',()=>streamEnd({outcome:res.statusCode>=400?'error':'ok',status:res.statusCode,bytes:streamBytes}));res.once('close',()=>streamEnd({outcome:res.writableFinished?(res.statusCode>=400?'error':'ok'):'cancelled',status:res.statusCode,bytes:streamBytes,reason:res.writableFinished?undefined:'consumer-closed'}));
  const controller = new AbortController(), abort = () => controller.abort();
  res.once('close', abort);
  const closed = () => controller.signal.aborted || res.destroyed;
  let response;
  try {
    for (let attempt=0;attempt<3;attempt++) {
      const url = await resolveStream(id);
      if (closed()) return;
      const entry = streams[id];
      const headersEnd=streamEnd.child('upstream',{id,source:'yt',client:entry?.ci,attempt:attempt+1,...rangeDiagnostic(audioRange(req.headers.range||'bytes=0-'))});
      try { response = await upstream(url, req, entry?.ua, controller.signal, entry?.headers);headersEnd({outcome:response.ok?'ok':'error',status:response.status,contentLength:Number(response.headers.get('content-length'))||undefined,rangeTotal:Number((response.headers.get('content-range')||'').match(/\/(\d+)$/)?.[1])||undefined}); }
      catch (e) {headersEnd({outcome:closed()?'cancelled':'error',reason:audioTrace.classifyFailure(e)}); if(closed())return; if(attempt>=2)throw e; }
      if (closed()) { await response?.body?.cancel().catch(()=>{}); return; }
      const invalid=response?.ok?mediaResponseReason(response,req.method==='HEAD'):null;
      if(invalid)streamEnd.event('format-policy',{outcome:'error',reason:invalid,attempt:attempt+1});
      const rejected = response && ([401,403,410].includes(response.status)||!!invalid);
      if (response && !rejected) break;
      await response?.body?.cancel().catch(()=>{});
      if (rejected && entry?.ci != null) {rejectClient(id,entry.ci);streamPolicy.reject(entry.ci,id);}
      // Concurrent range requests must not erase a newer recovered URL.
      if (streams[id] === entry) { delete streams[id]; saveStreams(); }
      response = null;
    }
    if (!response || ![200,206,416].includes(response.status)) throw Error('Не удалось открыть аудиопоток');
    if(response.ok&&streams[id]?.ci==null)streamPolicy.backupSuccess();
    const h = {'Content-Type':response.headers.get('content-type')||'audio/mp4','Accept-Ranges':'bytes','Cache-Control':'no-store'};
    for (const k of ['content-length','content-range']) if(response.headers.get(k))h[k]=response.headers.get(k);
    res.writeHead(response.status,h);
    if (!response.body || req.method === 'HEAD') { await response.body?.cancel().catch(()=>{}); return res.end(); }
    const body = Readable.fromWeb(response.body);
    body.on('error',()=>{if(!res.destroyed)res.destroy();});
    const firstByteEnd=streamEnd.child('first-byte',{id,source:'yt'});
    body.pipe(res);
    body.once('data',chunk=>firstByteEnd({outcome:'ok',bytes:chunk.length}));
    if(streamEnd.operation)body.on('data',chunk=>{streamBytes+=chunk.length;});
    body.once('error',e=>firstByteEnd({outcome:'error',reason:audioTrace.classifyFailure(e)}));
    res.once('close',()=>firstByteEnd({outcome:'cancelled',reason:'consumer-closed'}));
  } catch (e) {
    await response?.body?.cancel().catch(()=>{});
    if (!closed()) { if(!res.headersSent){res.writeHead(502,{'Cache-Control':'no-store'});res.end(String(e.message||e));}else res.destroy(); }
  }
}

module.exports = { resetStreamPolicy, ytdlpPath, resolveStream, prefetch, proxyStream, listOffline, offlineCatalog, repairVideo, enqueue, cancel, remove, serveOffline, setNotifier, thumbKind };
