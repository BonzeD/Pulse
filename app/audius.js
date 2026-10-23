'use strict';
// Official public Audius API. Metadata/redirects live only for this process session.
const https = require('node:https');
const dns = require('node:dns').promises;
const net = require('node:net');
const BASE = 'https://api.audius.co/v1';
const ID = /^[a-zA-Z0-9_-]{1,80}$/;
const isAudius = id => /^ad:/.test(String(id || ''));
const rawId = id => { const s = String(id || '').replace(/^ad:(?:(?:artist|playlist):)?/, ''); if (!ID.test(s)) throw new Error('AUDIUS_ID'); return s; };
function publicIP(ip) {
  if (net.isIP(ip) === 4) { const a = ip.split('.').map(Number); return !(a[0] === 0 || a[0] === 10 || a[0] === 127 || a[0] >= 224 || a[0] === 169 && a[1] === 254 || a[0] === 172 && a[1] >= 16 && a[1] <= 31 || a[0] === 192 && [0,168].includes(a[1]) || a[0] === 100 && a[1] >= 64 && a[1] <= 127 || a[0] === 198 && [18,19].includes(a[1])); }
  // Reject IPv4-mapped, local, multicast and documentation IPv6. Only global unicast.
  return net.isIP(ip) === 6 && /^[23]/i.test(ip) && !/^2001:db8:/i.test(ip);
}
async function open(url, { signal, headers = {}, redirects = 5 } = {}) {
  if (signal?.aborted) throw new Error('AUDIUS_CANCELLED');
  const u = new URL(url);
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443') || net.isIP(u.hostname)) throw new Error('AUDIUS_URL');
  const addresses = await dns.lookup(u.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(a => !publicIP(a.address))) throw new Error('AUDIUS_ADDRESS');
  if (signal?.aborted) throw new Error('AUDIUS_CANCELLED');
  const pin = addresses.find(a => a.family === 4) || addresses[0];
  return new Promise((resolve, reject) => {
    const req = https.get(u, { agent: false, signal, headers: { 'User-Agent': 'Pulse/1.0.2 Audius', ...headers }, lookup: (_h, opts, cb) => opts.all ? cb(null, [pin]) : cb(null, pin.address, pin.family) }, res => {
      clearTimeout(deadline);
      if ([301,302,303,307,308].includes(res.statusCode)) {
        res.resume();
        if (!redirects || !res.headers.location) return reject(new Error('AUDIUS_REDIRECT'));
        open(new URL(res.headers.location, u).href, { signal, headers, redirects: redirects - 1 }).then(resolve, reject);
      } else resolve(res);
    });
    const deadline = setTimeout(() => req.destroy(new Error('AUDIUS_TIMEOUT')), 6000);
    req.setTimeout(15000, () => req.destroy(new Error('AUDIUS_TIMEOUT')));
    req.on('error', e => { clearTimeout(deadline); reject(e); });
  });
}
const norm = s => String(s || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
function version(s) {
  const n = norm(s), tags = ['remix','cover','live','instrumental','slowed','sped up','nightcore','acoustic','remaster','radio edit','extended','clean','explicit'];
  return tags.filter(t => new RegExp('(?:^| )' + t + '(?: |$)').test(n)).join('|');
}
function matchRecording(a, b) {
  if (!a || !b || !a.title || !a.author || !b.title || !b.author || !(a.dur > 0 && b.dur > 0)) return false;
  if (b.isCover || b.isRemix || a.versionWarning && b.versionWarning && a.versionWarning !== b.versionWarning) return false;
  if (norm(a.title) !== norm(b.title) || norm(a.author) !== norm(b.author) || version(a.title) !== version(b.title)) return false;
  if (Math.abs(a.dur - b.dur) > Math.min(2, a.dur * .01)) return false;
  // An unknown explicit flag is not evidence that two versions are identical.
  if (typeof a.explicit === 'boolean' && typeof b.explicit === 'boolean') { if(a.explicit !== b.explicit) return false; }
  else if (!a.isrc || !b.isrc || norm(a.isrc) !== norm(b.isrc)) return false;
  if (a.isrc && b.isrc && norm(a.isrc) !== norm(b.isrc)) return false;
  return true;
}
// Persist user references, not an API-content cache. Hydrate titles/art again next session.
function libraryReferences(value) {
  if (typeof value === 'string' && value.startsWith('/audius/art/')) return null;
  if (Array.isArray(value)) return value.map(libraryReferences);
  if (!value || typeof value !== 'object') return value;
  if (/^ad:[^:]+$/.test(value.id || '')) return {id:value.id,kind:'song',platform:'ad',title:value.id,author:'',dur:0,loaded:false};
  return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,libraryReferences(v)]));
}
function create({ request = open, now = Date.now } = {}) {
  const cache = new Map(), art = new Map(), tracks = new Map(), selections = new Map(), inflight = new Map();
  let cooldown = 0, nextRequest = 0;
  function bounded(m, k, v, max = 400) { if (m.size >= max && !m.has(k)) m.delete(m.keys().next().value); m.set(k, v); return v; }
  async function api(path, params = {}, signal) {
    const u = new URL(BASE + path); for (const [k,v] of Object.entries({ ...params, app_name: 'Pulse' })) if (v !== undefined) u.searchParams.set(k, v);
    const key = u.href, old = cache.get(key); if (old && now() - old.at < 60000) return old.data;
    if (now() < cooldown) throw new Error('AUDIUS_RATE_LIMIT');
    // <= 5 metadata requests/sec, serialized reservations, including foreground searches.
    const wait = Math.max(0, nextRequest - now()); nextRequest = Math.max(now(), nextRequest) + 220;
    if (wait > 5000) throw new Error('AUDIUS_BUSY');
    if (wait) await new Promise((r,j) => { const t = setTimeout(r,wait); signal?.addEventListener('abort', () => {clearTimeout(t);j(new Error('AUDIUS_CANCELLED'));},{once:true}); });
    if (signal?.aborted) throw new Error('AUDIUS_CANCELLED');
    if (now() < cooldown) throw new Error('AUDIUS_RATE_LIMIT');
    const res = await request(key, { signal });
    if (res.statusCode === 429) { cooldown = now() + Math.min(120000, Math.max(1000, Number(res.headers['retry-after']) * 1000 || 10000)); res.resume(); throw new Error('AUDIUS_RATE_LIMIT'); }
    if (res.statusCode !== 200) { res.resume(); throw new Error('AUDIUS_UNAVAILABLE'); }
    let size = 0; const chunks = []; for await (const c of res) { size += c.length; if (size > 4 * 1024 * 1024) { res.destroy(); throw new Error('AUDIUS_RESPONSE'); } chunks.push(c); }
    const data = JSON.parse(Buffer.concat(chunks).toString()).data;
    bounded(cache, key, { at: now(), data }); return data;
  }
  function artwork(obj, kind = "track") {
    const a = obj?.artwork || obj?.profile_picture, u = a?.['480x480'] || a?.['150x150'];
    if (typeof u !== 'string' || !u.startsWith('https://')) return null;
    const key = kind + '/' + rawId(obj.id); bounded(art,key,u,800); return '/audius/art/' + key;
  }
  const playable = t => t && t.is_available !== false && t.is_streamable !== false && t.is_stream_gated !== true && !t.access_authorities?.length && t.access?.stream !== false && !t.stream_conditions && !t.allowed_api_keys?.length;
  function song(t) {
    if (!t?.id || !ID.test(t.id) || !playable(t)) return null;
    const s = { kind:'song', id:'ad:'+t.id, title:String(t.title || ''), author:String(t.user?.name || ''), dur:Number(t.duration)||0, art:artwork(t), artistId:t.user?.id ? 'ad:artist:'+t.user.id : null, isrc:t.isrc || null, explicit: t.parental_warning_type === 'Explicit' ? true : ['Not Explicit','Cleaned'].includes(t.parental_warning_type) ? false : undefined, versionWarning:t.parental_warning_type||null, isCover:!!(t.cover_original_song_title||t.cover_original_artist), isRemix:!!t.remix_of?.tracks?.length, permalink: typeof t.permalink === 'string' && t.permalink.startsWith('/') ? 'https://audius.co'+t.permalink : null, platform:'ad', loaded:true };
    bounded(tracks,s.id,s); return s;
  }
  const artist = u => ({ kind:'artist',browseId:'ad:artist:'+u.id,title:u.name,sub:'Audius',art:artwork(u,'artist') });
  const playlist = p => ({ kind:'playlist',browseId:'ad:playlist:'+p.id,title:p.playlist_name,sub:p.user?.name||'Audius',art:artwork(p,'playlist') });
  async function getTrack(id, signal) { const t = await api('/tracks/'+rawId(id),{},signal); return song(t); }
  async function search(q, filter = 'all', signal) {
    filter = filter || 'all';
    q = String(q || '').trim().slice(0,200); if (!q) return [];
    const out=[];
    if (['all','songs','videos'].includes(filter)) { const a=await api('/tracks/search',{query:q,limit:30},signal); const items=(a||[]).map(song).filter(Boolean); if(items.length)out.push({title:'Треки',items,list:true}); }
    if (['all','artists'].includes(filter)) { const a=await api('/users/search',{query:q,limit:15},signal); if(a?.length)out.push({title:'Исполнители',items:a.map(artist)}); }
    if (['all','playlists','albums'].includes(filter)) { const a=await api('/playlists/search',{query:q,limit:20},signal); if(a?.length)out.push({title:'Плейлисты',items:a.map(playlist)}); }
    return out;
  }
  async function feed(id) {
    if (!['FEmusic_home','FEmusic_explore','FEmusic_new_releases','FEmusic_charts','FEmusic_moods_and_genres'].includes(id)) return {shelves:[]};
    const [t,p]=await Promise.all([api('/tracks/trending',{limit:30,time:'week'}),api('/playlists/trending',{limit:15,time:'week',omit_tracks:true}).catch(()=>[])]);
    return { shelves:[{title:'Популярные треки',items:(t||[]).map(song).filter(Boolean),list:true},{title:'Популярные плейлисты',items:(p||[]).map(playlist)}] };
  }
  async function browse(id) {
    const k=String(id).split(':')[1], rid=rawId(id);
    if(k==='artist') { const [u,t]=await Promise.all([api('/users/'+rid),api('/users/'+rid+'/tracks',{limit:100})]); return {type:'artist',browseId:id,header:{title:u.name,art:artwork(u,'artist'),desc:u.bio,sub:'Audius'},shelves:[{title:'Треки',list:true,items:(t||[]).map(song).filter(Boolean)}]}; }
    if(k==='playlist') { const [p,t]=await Promise.all([api('/playlists/'+rid),api('/playlists/'+rid+'/tracks',{limit:100})]); const v=Array.isArray(p)?p[0]:p; return {type:'playlist',browseId:id,header:{title:v?.playlist_name||'Audius',sub:v?.user?.name||'Audius',art:artwork(v,'playlist')},tracks:(t||[]).map(song).filter(Boolean),shelves:[]}; }
    throw new Error('AUDIUS_ID');
  }
  async function related(id) { const t=await getTrack(id); if(!t?.artistId)return []; const d=await browse(t.artistId);return d.shelves.flatMap(x=>x.items).filter(x=>x.id!==id); }
  async function choose(t, mode, manual, signal) {
    if(isAudius(t?.id))return getTrack(t.id,signal);
    if(manual==='current'||mode==='current'&&!manual)return null;
    if(manual && isAudius(manual)) { const candidate=await getTrack(manual,signal); return candidate ? {...candidate,manual:true,confirmed:matchRecording(t,candidate)} : null; }
    const key=JSON.stringify([t.id,t.title,t.author,t.dur,t.isrc,t.explicit]);
    const cached=selections.get(key);if(cached && now()-cached.at<60000)return cached.value;
    if(mode==='auto')return null; // Auto never holds Play for a fresh catalog search.
    const shelves=await search(`${t.author} ${t.title}`,'songs',signal);
    const matches=shelves.flatMap(s=>s.items).filter(c=>matchRecording(t,c));
    // Duplicates are ambiguous; never silently pick one.
    const value=matches.length===1?{...matches[0],confirmed:true}:null;bounded(selections,key,{at:now(),value});return value;
  }
  async function select(t, mode, manual, key) {
    if(typeof key!=='string'||key.length>100)throw new Error('AUDIUS_REQUEST');
    if(inflight.size>=12&&!inflight.has(key))throw new Error('AUDIUS_BUSY');
    cancel(key);const c=new AbortController();inflight.set(key,c);const timer=setTimeout(()=>c.abort(),2500);
    try{return await choose(t,mode,manual,c.signal);}finally{clearTimeout(timer);if(inflight.get(key)===c)inflight.delete(key);}
  }
  function cancel(key) { const c=inflight.get(key);if(c){c.abort();inflight.delete(key);} }
  async function proxy(req,res,path) {
    const c=new AbortController();res.on('close',()=>c.abort());
    try {
      let url, isAudio=false;
      if(path.startsWith('/audius/audio/')) { const id=rawId(path.slice(14));const t=await getTrack(id,c.signal);if(!t)throw new Error('AUDIUS_UNAVAILABLE');url=BASE+'/tracks/'+id+'/stream?app_name=Pulse';isAudio=true; }
      else { const key=path.slice('/audius/art/'.length);url=art.get(key);if(!url){const m=/^(track|artist|playlist)\/([A-Za-z0-9_-]{1,80})$/.exec(key);if(m){const v=await api('/'+({track:'tracks',artist:'users',playlist:'playlists'}[m[1]])+'/'+m[2],{},c.signal);artwork(Array.isArray(v)?v[0]:v,m[1]);url=art.get(key);}}if(!url){res.writeHead(404);return res.end();} }
      const headers={}; if(req.headers.range){if(!/^bytes=\d+-\d*$/.test(req.headers.range)){res.writeHead(416);return res.end();}headers.Range=req.headers.range;}
      const upstream=await request(url,{signal:c.signal,headers});
      const type=String(upstream.headers['content-type']||'');
      if(![200,206].includes(upstream.statusCode)||!(isAudio?/^(audio\/|application\/octet-stream)/i:/^image\/(jpeg|png|webp|avif)(?:;|$)/i).test(type)){upstream.resume();throw new Error('AUDIUS_STREAM');}
      const h={'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
      for(const n of ['content-length','content-range','accept-ranges'])if(upstream.headers[n])h[n]=upstream.headers[n];
      res.writeHead(upstream.statusCode,h);
      if(req.method==='HEAD'){upstream.destroy();return res.end();}
      let size=0;upstream.on('data',chunk=>{size+=chunk.length;if(size>(isAudio?1024*1024*1024:8*1024*1024)){upstream.destroy();res.destroy();}});upstream.on('error',()=>res.destroy());upstream.pipe(res);
    }catch{if(!res.headersSent)res.writeHead(502,{'Cache-Control':'no-store'});res.end();}
  }
  return {api,search,feed,browse,related,getTrack,select,cancel,proxy,link:async id=>{ if(/^ad:(artist|playlist):/.test(id)){const d=await api('/'+(id.split(':')[1]==='artist'?'users/':'playlists/')+rawId(id));const v=Array.isArray(d)?d[0]:d;return v?.permalink?.startsWith('/')?'https://audius.co'+v.permalink:'https://audius.co';}return (await getTrack(id))?.permalink||'https://audius.co';},clear:()=>{cache.clear();art.clear();tracks.clear();selections.clear();for(const k of inflight.keys())cancel(k);}};
}
module.exports={create,isAudius,rawId,matchRecording,publicIP,open,libraryReferences};
