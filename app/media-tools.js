'use strict';
const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const EXPORTS={mp3:{label:'MP3',ext:'mp3',codec:['-c:a','libmp3lame','-q:a','2']},flac:{label:'FLAC',ext:'flac',codec:['-c:a','flac']},m4a:{label:'M4A · AAC',ext:'m4a',codec:['-c:a','aac','-b:a','256k']},ogg:{label:'OGG · Vorbis',ext:'ogg',codec:['-c:a','libvorbis','-q:a','6']},opus:{label:'OPUS',ext:'opus',codec:['-c:a','libopus','-b:a','192k']},wav:{label:'WAV',ext:'wav',codec:['-c:a','pcm_s24le']}};
function binary(name){if(process.platform!=='win32')return name;const packaged=path.join(process.resourcesPath||'', 'media-tools',name+'.exe');return fs.existsSync(packaged)?packaged:path.join(__dirname,'resources','media-tools',name+'.exe');}
function run(exe,args,{timeout=30*60e3,maxOutput=2*1024*1024,signal}={}){return new Promise((resolve,reject)=>{
 if(signal?.aborted){const e=new Error('Обработка отменена');e.name='AbortError';reject(e);return;}
 const abort=()=>{p.kill();const e=new Error('Обработка отменена');e.name='AbortError';finish(e);};
 const p=spawn(exe,args,{windowsHide:true,stdio:['ignore','pipe','pipe'],shell:false});let stdout='',stderr='',done=false;const finish=(err)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);err?reject(err):resolve(stdout);};
 const timer=setTimeout(()=>{p.kill();finish(new Error('Обработка заняла слишком много времени. Файл не сохранён.'));},timeout);
 signal?.addEventListener('abort',abort,{once:true});
 p.stdout.on('data',b=>{stdout+=b;if(stdout.length>maxOutput){p.kill();finish(new Error('Слишком большой ответ медиаконвертера'));}});p.stderr.on('data',b=>{stderr=(stderr+b).slice(-6000);});
 p.on('error',()=>finish(new Error('Не удалось запустить медиаконвертер. Проверь установку Pulse.')));p.on('close',code=>finish(code===0?null:new Error('Не удалось обработать аудиофайл: '+stderr.trim().slice(-900))));
});}
async function probe(file){const j=JSON.parse(await run(binary('ffprobe'),['-v','error','-protocol_whitelist','file,pipe','-show_streams','-show_format','-of','json',file],{timeout:120000}));const a=(j.streams||[]).find(s=>s.codec_type==='audio'),v=(j.streams||[]).find(s=>s.codec_type==='video'&&!s.disposition?.attached_pic);if(!a&&!v)throw Error('В файле не найден аудиотрек или видео');return {...(a||v),hasAudio:!!a,hasVideo:!!v,video:v?{index:v.index,codec:v.codec_name,width:v.width,height:v.height,pixelFormat:v.pix_fmt}:null,duration:Number(a?.duration||v?.duration||j.format?.duration)||0,format:j.format?.format_name||''};}
const escaped=v=>String(v??'').replace(/\\/g,'\\\\').replace(/([=;#])/g,'\\$1').replace(/\r?\n/g,'\\\n');
function pictureBlock(bytes){const head=Buffer.alloc(8);head.writeUInt32BE(3);head.writeUInt32BE(10,4);const tail=Buffer.alloc(24);tail.writeUInt32BE(bytes.length,20);return Buffer.concat([head,Buffer.from('image/jpeg'),tail,bytes]).toString('base64');}
async function exportAudio({source,dest,format,fields,cover,work}){
 const f=EXPORTS[format];if(!f)throw Error('Неподдерживаемый формат экспорта');const data=await probe(source);
 const tags={title:fields.title,artist:fields.author,album:fields.albumName,album_artist:fields.albumArtist,date:fields.year,genre:fields.genre,track:fields.trackNumber,disc:fields.discNumber,composer:fields.composer,comment:fields.comment};
 if(cover&&['ogg','opus'].includes(format))tags.METADATA_BLOCK_PICTURE=pictureBlock(fs.readFileSync(cover));
 const meta=path.join(work,'tags.txt');fs.writeFileSync(meta,';FFMETADATA1\n'+Object.entries(tags).map(([k,v])=>`${k}=${escaped(v)}`).join('\n')+'\n');
 const args=['-nostdin','-v','error','-y','-protocol_whitelist','file,pipe','-i',source,'-f','ffmetadata','-i',meta];
 const attached=cover&&['mp3','flac','m4a'].includes(format);if(attached)args.push('-i',cover);
 args.push('-map','0:a:0','-map_metadata',format==='wav'?'-1':'1','-map_chapters','-1');
 const same=({mp3:['mp3'],flac:['flac'],m4a:['aac','alac'],ogg:['vorbis'],opus:['opus'],wav:['pcm_s16le','pcm_s24le','pcm_s32le','pcm_f32le','pcm_f64le']})[format].includes(data.codec_name);
 args.push(...(same?['-c:a','copy']:f.codec));
 if(attached)args.push('-map','2:v:0','-c:v','mjpeg','-disposition:v:0','attached_pic','-metadata:s:v:0','title=Album cover','-metadata:s:v:0','comment=Cover (front)');else args.push('-vn');
 if(format==='mp3')args.push('-id3v2_version','3');if(format==='m4a')args.push('-movflags','+faststart');
 args.push(dest);await run(binary('ffmpeg'),args);if(format==='wav')wavID3(dest,fields,cover);await probe(dest);return {copied:same,coverSidecar:!!cover&&format==='wav'};
}
module.exports={EXPORTS,binary,run,probe,exportAudio};

// RIFF INFO has no dependable Unicode encoding. Add a standard ID3v2.3 chunk
// with UTF-16 text instead; keep a JPEG sidecar for WAV players ignoring ID3.
function wavID3(file,fields,cover){
 const text=s=>Buffer.concat([Buffer.from([1,255,254]),Buffer.from(String(s||''),'utf16le')]);
 const frame=(id,data)=>{const h=Buffer.alloc(10);h.write(id);h.writeUInt32BE(data.length,4);return Buffer.concat([h,data]);};
 const tags={TIT2:fields.title,TPE1:fields.author,TALB:fields.albumName,TPE2:fields.albumArtist,TYER:fields.year,TCON:fields.genre,TRCK:fields.trackNumber,TPOS:fields.discNumber,TCOM:fields.composer};
 const frames=Object.entries(tags).filter(([,v])=>v).map(([k,v])=>frame(k,text(v)));
 if(fields.comment)frames.push(frame('COMM',Buffer.concat([Buffer.from([1]),Buffer.from('eng'),Buffer.from([255,254,0,0,255,254]),Buffer.from(fields.comment,'utf16le')])));
 if(cover)frames.push(frame('APIC',Buffer.concat([Buffer.from([0]),Buffer.from('image/jpeg\0'),Buffer.from([3,0]),fs.readFileSync(cover)])));
 const data=Buffer.concat(frames),h=Buffer.from([73,68,51,3,0,0,0,0,0,0]);for(let i=0;i<4;i++)h[9-i]=(data.length>>>(7*i))&127;
 const payload=Buffer.concat([h,data]),chunk=Buffer.alloc(8);chunk.write('id3 ');chunk.writeUInt32LE(payload.length,4);const old=fs.statSync(file).size,total=old+8+payload.length+(payload.length%2);
 if(total-8>0xffffffff)throw Error('Для WAV больше 4 ГБ выбери FLAC: качество сохранится без потерь');
 fs.appendFileSync(file,Buffer.concat([chunk,payload,payload.length%2?Buffer.alloc(1):Buffer.alloc(0)]));const fd=fs.openSync(file,'r+'),size=Buffer.alloc(4);size.writeUInt32LE(total-8);try{fs.writeSync(fd,size,0,4,4);}finally{fs.closeSync(fd);}
}
