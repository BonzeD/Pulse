'use strict';
// 2.0.4: «Моя волна» — бесконечный личный поток, как у Яндекс Музыки.
// Учится на лайках, дизлайках, пропусках и дослушанных треках. Профиль хранится только на этом компьютере (lib.wave).
// Рекомендации — из сервиса текущего клиента (YouTube Music / Apple Music / Spotify), звук — как обычно. Без интернета — из скачанного.
const WV = { busy: false, again: false, tok: 0, rev: 0, loading: false, cv: null, cx: null, vis: false, io: null, ro: null, w: 0, h: 0, chk: 0, last: 0, ph: 0, lvl: 0, sess: null, sq: new Map() };
const wS = () => S().wave;
const W_MOOD = [['any', 'Любое'], ['up', 'Бодрое'], ['calm', 'Спокойное'], ['fun', 'Весёлое'], ['sad', 'Грустное'], ['focus', 'Для фокуса']];
const W_CHAR = [['fav', 'Любимое'], ['new', 'Незнакомое'], ['pop', 'Популярное']];
const W_LANG = [['any', 'Любой'], ['ru', 'Русский'], ['foreign', 'Иностранный'], ['inst', 'Без слов']];
const W_MQ = {
  up: { any: 'бодрая музыка', ru: 'бодрые русские песни', foreign: 'energetic upbeat songs', inst: 'energetic instrumental music' },
  calm: { any: 'спокойная музыка', ru: 'спокойные русские песни', foreign: 'chill calm songs', inst: 'calm piano ambient' },
  fun: { any: 'весёлые песни', ru: 'весёлые русские песни', foreign: 'happy feel good songs', inst: 'happy upbeat instrumental' },
  sad: { any: 'грустные песни', ru: 'грустные русские песни', foreign: 'sad songs', inst: 'sad piano instrumental' },
  focus: { any: 'музыка для концентрации', ru: 'музыка для концентрации', foreign: 'focus music study', inst: 'lofi beats to study' }
};
const W_LQ = { ru: 'русские хиты', foreign: 'top hits', inst: 'instrumental music' };
const W_CYR = /[а-яё]/i;
// Genres, artists and search provenance cannot prove that a recording has no voice.
const W_INST = /(?:\binstrumental\b|инструментальн|[иі]нструментал(?![а-яёіїє])|без\s+(?:слов|вокала)|\bno\s+vocals?\b|\bvocal[- ]?free\b|インスト(?:ゥルメンタル)?|純音楽|純音樂)/i;
const W_VOCAL = /(?:\b(?:with\s+vocals?|vocal\s+(?:mix|version)|lyrics?|acappella|a\s+cappella)\b|со\s+словами|с\s+вокалом)/i;
function wInstrumental(t) {
  const cached=lib.lyrics?.[t.id];
  // Known lyrics take priority over a title, genre, or stale search flag.
  if ([cached?.user,cached?.synced,cached?.plain,t.synced,t.plain,t.lyrics].some(x=>typeof x==='string'&&x.trim())) return false;
  const title=String(t.title||'');
  if(W_VOCAL.test(title))return false;
  return t.instrumental===true||cached?.instrumental===true||W_INST.test(title);
}
TAB_RESET.wave = ['wave'];

// ---------- профиль ----------
function WP() { let w = lib.wave; if (!w || w.v !== 1) w = lib.wave = { v: 1, a: {}, t: {}, near: {}, hist: [], ah: [], seeds: [], n: 0 }; return w; }
const wName = (s) => String(s || '').split(/\s*(?:,|&|\/|×|\bfeat\.?|\bft\.?|\sx\s|\sи\s)\s*/i)[0].trim();
const wKey = (s) => wName(s).toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, '');
const wClamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wA = (t) => { const e = t && WP().a[wKey(t.author)]; return e ? e.s : 0; };
function wAddA(t, d) { if (!t || !d) return; const k = wKey(t.author); if (!k) return; const A = WP().a; const e = A[k] || (A[k] = { n: wName(t.author), s: 0 }); e.s = +wClamp(e.s + d, -20, 30).toFixed(2); }
function wAddT(id, d, box = 't', lim = 10) { if (!id || !d) return; const B = WP()[box]; B[id] = +wClamp((B[id] || 0) + d, -lim, lim).toFixed(2); }
function wSeed(t) { if (!t || !t.id) return; remember(t); const w = WP(); w.seeds = w.seeds.filter((x) => x !== t.id); w.seeds.push(t.id); if (w.seeds.length > 80) w.seeds.shift(); }
// чтобы профиль не разрастался бесконечно — держим только самое заметное
function wPrune() {
  const w = WP(), cut = (o, n) => { const k = Object.keys(o); if (k.length <= n) return; k.sort((a, b) => Math.abs((o[a].s ?? o[a])) - Math.abs((o[b].s ?? o[b]))).slice(0, k.length - n).forEach((x) => delete o[x]); };
  cut(w.a, 600); cut(w.t, 1500); cut(w.near, 800);
}
const wWeight = (s) => (s.wave ? 1 : wS().learnAll !== false ? 0.5 : 0);

// ---------- обучение: что слушал, что пропустил ----------
function wClose() {
  const s = WV.sess; WV.sess = null; if (!s || s.done || (lib.dislikes && lib.dislikes[s.t.id])) return;
  const k = wWeight(s); if (!k) return;
  if (s.heard < 30 && s.dur > 45) { wAddA(s.t, -0.6 * k); wAddT(s.t.id, -1 * k); } // пропуск — слабый минус
  else if (s.dur && s.heard / s.dur > 0.7) { wAddA(s.t, 0.6 * k); wAddT(s.t.id, 0.5 * k); }
  save();
}
PX.on('track', (t) => {
  if (WV.sess && t && WV.sess.id === t.id) return;
  wClose(); if (!t || !t.id) return;
  WV.sess = { id: t.id, t: { ...t }, heard: 0, dur: 0, last: -1, done: false, wave: !!lib.queue.wave };
  const w = WP(); w.hist = w.hist.filter((x) => x !== t.id); w.hist.push(t.id); if (w.hist.length > 300) w.hist.splice(0, w.hist.length - 300);
  const ak = wKey(t.author); if (ak) { w.ah.push(ak); if (w.ah.length > 30) w.ah.shift(); }
  if (lib.queue.wave) w.n = (w.n || 0) + 1;
  updDis(); wUpNext(); save();
});
setInterval(() => {
  const s = WV.sess, c = curTrack(); if (!s || !c || c.id !== s.id) return;
  if (lib.queue.wave) s.wave = true;
  const x = E.time(), d = E.dur(); if (d) s.dur = d;
  if (playing && x > s.last && x - s.last < 3) s.heard++;
  s.last = x;
}, 1000);
PX.on('ended', (t) => {
  const s = WV.sess; if (!s || !t || s.id !== t.id || s.done) return; s.done = true;
  const k = wWeight(s); if (!k) return;
  wAddA(t, 1 * k); wAddT(t.id, 1 * k); if (k >= 1) wSeed(t); save();
});
PX.on('like', ({ t, on }) => {
  if (!t) return; const k = lib.queue.wave ? 1 : wS().learnAll !== false ? 0.7 : 0; if (!k) return;
  if (on) { wAddA(t, 3 * k); wAddT(t.id, 3); wSeed(t); if (lib.dislikes && lib.dislikes[t.id]) { delete lib.dislikes[t.id]; updDis(); } }
  else wAddA(t, -1 * k);
  save();
  // лайк в волне — сразу пара похожих треков следом
  if (on && lib.queue.wave && online()) nextInfo(t.id).then((r) => {
    const q = lib.queue; if (!q.wave || !r || !r.tracks) return;
    const add = wPick(r.tracks.filter((x) => x.id !== t.id).map((x) => ({ ...x, _why: `Похоже на «${t.title}», который понравился`, _whyId: t.id })), 2, {});
    if (!add.length) return; q.tracks.splice(q.idx + 1, 0, ...add); renderQueue(); save(); wUpNext();
  });
});

// ---------- «Не нравится» ----------
const waveSkip = (t) => !!(t && wS().skipDis !== false && lib.dislikes && lib.dislikes[t.id]);
function updDis() {
  const t = curTrack(), on = !!(t && lib.dislikes && lib.dislikes[t.id]), b = $('btnDislike'); if (!b) return;
  b.classList.toggle('on', on); b.innerHTML = ico(on ? 'dislike-f' : 'dislike'); b.title = on ? 'Убрать «Не нравится»' : 'Не нравится — пропустить и реже такое (X)';
}
function toggleDislike(t) {
  if (!t || !t.id) return; lib.dislikes = lib.dislikes || {}; lib.disQ = lib.disQ || [];
  const on = !lib.dislikes[t.id], sv = likeSvc(t.id); remember(t);
  if (on) {
    lib.dislikes[t.id] = 1;
    // лайк снимаем только у себя: сервер сам заменит лайк дизлайком (отдельное «снять лайк» могло бы стереть дизлайк)
    if (isLiked(t.id)) { delete lib.likes[t.id]; lib.likeQ = (lib.likeQ || []).filter((x) => x.id !== t.id); updateLike(); document.querySelectorAll(`[data-like="${CSS.escape(t.id)}"]`).forEach((b) => { b.classList.remove('liked'); b.innerHTML = ico('heart'); }); }
    wAddA(t, -5); wAddT(t.id, -10);
    // похожие на него — тоже реже
    if (online()) nextInfo(t.id).then((r) => { if (!r || !r.tracks) return; r.tracks.slice(1, 16).forEach((x) => { wAddT(x.id, -1.5, 'near', 5); }); save(); });
  } else { delete lib.dislikes[t.id]; wAddA(t, 3); wAddT(t.id, 10); }
  lib.disQ = lib.disQ.filter((x) => x.id !== t.id);
  if (sv !== 'sp') lib.disQ.push({ id: t.id, on, n: 0 });
  if (sv === 'sp') toast(on ? 'Не нравится — Spotify не умеет дизлайки, Pulse запомнит сам' : 'Дизлайк убран', 'dislike');
  else if (!likeUser(sv)) toast(`${on ? 'Не нравится' : 'Дизлайк убран'} — отправлю в ${likeName(sv)} после входа в аккаунт`, 'dislike');
  else toast(on ? `Не нравится · больше не попадётся${lib.queue.wave ? ' в волне' : ''}` : 'Дизлайк убран', 'dislike');
  save(); updDis(); flushDis(); sendState();
  if (!on) return;
  const q = lib.queue, ak = wKey(t.author);
  if (q.wave && ak) { for (let i = q.tracks.length - 1; i > q.idx; i--) if (q.tracks[i].wv && wKey(q.tracks[i].author) === ak) q.tracks.splice(i, 1); renderQueue(); }
  if (curTrack() && curTrack().id === t.id && wS().skipDis !== false) next();
  else if (q.wave) waveExtend(false);
}
let disBusy = false;
async function flushDis() {
  if (disBusy || !online() || !lib.disQ || !lib.disQ.length || !pulse.ytm.dislike) return; disBusy = true;
  try {
    for (const x of [...lib.disQ]) {
      const sv = likeSvc(x.id); if (!likeUser(sv)) continue;
      const r = await pulse.ytm.dislike(x.id, x.on).catch((e) => ({ error: String(e) }));
      if (r && r.error && ++x.n < 6) continue;
      lib.disQ = lib.disQ.filter((q) => q !== x);
    }
  } finally { disBusy = false; save(); }
}
setInterval(() => { if (lib.disQ && lib.disQ.length) flushDis(); }, 60e3);

// ---------- подбор треков ----------
async function wSearch(q, tag) {
  const k = CL() + '|' + q, c = WV.sq.get(k); if (c && Date.now() - c.at < 20 * 60e3) return c.v.map(t=>({...t,...tag}));
  let v = [];
  try { const x = await ytm('search', q, 'songs'); v = (x || []).flatMap((s) => s.items || []).filter((t) => t && t.kind === 'song' && t.id).slice(0, 30); } catch {}
  if(v.length)WV.sq.set(k, { v, at: Date.now() });if(WV.sq.size>80)WV.sq.delete(WV.sq.keys().next().value);return v.map(t=>({...t,...tag}));
}
// _whyId — трек, на который похоже (по клику на подпись он сыграет), _whyB — страница исполнителя / альбома / плейлиста
const wRadio = async (id, why, list, tag) => { const r = await nextInfo(id, list); return r && r.tracks ? r.tracks.map((t) => ({ ...t, _why: why, ...(tag || (id ? { _whyId: id } : {})) })) : []; };
const wShuf = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
async function wPool(seed) {
  if (!online()) return offlineTracks().filter(playable).map((t) => ({ ...t, _why: 'Из скачанного — нет интернета' }));
  const s = wS(), w = WP(), cl = CL(), jobs = [];
  if (seed) {
    const nm = seed.name || '';
    let tracks = seed.tracks || [];
    if (seed.kind === 'track') { if (seed.t) remember(seed.t); jobs.push(wRadio(seed.id, `Волна по треку «${nm}»`)); }
    else {
      if (!tracks.length || (seed.kind === 'artist' && !seed.radio)) {
        try { const d = await ytm('browse', seed.id); const sh = (d.shelves || []).find((x) => x.items && x.items.length && x.items.every((y) => y.kind === 'song'));
          tracks = (d.tracks && d.tracks.length ? d.tracks : sh ? sh.items : []).map(slim); seed.tracks = tracks.slice(0, 60); if (d.header && d.header.radio) seed.radio = d.header.radio; } catch {}
      }
      const why = { artist: `Волна по исполнителю ${nm}`, album: `Волна по альбому «${nm}»`, playlist: `Волна по плейлисту «${nm}»` }[seed.kind];
      const tag = { _whyB: seed.id };
      jobs.push(Promise.resolve(tracks.map((t) => ({ ...t, _why: why, _seed: 1, ...tag }))));
      if (seed.radio) jobs.push(wRadio(undefined, why, seed.radio, tag));
      wShuf(tracks).slice(0, seed.kind === 'artist' ? 1 : 2).forEach((t) => jobs.push(wRadio(t.id, why, undefined, tag)));
    }
  } else {
    // «зёрна» — лайки и дослушанные треки этого же сервиса; любимые исполнители выпадают чаще
    const mine = (id) => likeSvc(id) === cl;
    const cand = [...new Set([...w.seeds.slice(-40), ...Object.keys(lib.likes || {})])].filter(mine).map((id) => lib.known[id]).filter((t) => t && !(lib.dislikes || {})[t.id]);
    // Sample each seed once; a random sort comparator was inconsistent and favoured a few radios.
    const used = new Set(), round=(w.round||0)+1;w.round=round;
    const picks=cand.map(t=>({t,score:Math.log(Math.max(1e-6,Math.random()))/Math.max(.2,1+Math.max(0,wA(t))*.12+(isLiked(t.id)?1:0))-(w.lastSeeds||[]).includes(t.id)*2}))
      .sort((a,b)=>b.score-a.score).filter(({t})=>{const k=wKey(t.author)||t.id;if(used.has(k))return false;used.add(k);return true;}).slice(0,s.char==='new'?2:3).map(x=>x.t);
    w.lastSeeds=picks.map(t=>t.id);
    picks.forEach((t) => jobs.push(wRadio(t.id, `Похоже на «${t.title}»`)));
    if (!picks.length || s.char==='new' || (w.round||0)%3===0) jobs.push(cached('home', () => ytm('feed', 'FEmusic_home')).then(async (d) => {
      const songs = (d && d.shelves || []).flatMap((x) => x.items || []).filter((t) => t && t.kind === 'song' && t.id).map((t) => ({ ...t, _why: 'Из твоей главной' }));
      const more = await Promise.all(wShuf(songs).slice(0, 2).map((t) => { remember(t); return wRadio(t.id, `Похоже на «${t.title}»`); }));
      return songs.concat(...more);
    }).catch(() => []));
    if (s.char === 'pop') jobs.push(wSearch((s.lang === 'foreign' || s.lang === 'inst' ? 'top hits ' : 'хиты ') + new Date().getFullYear(), { _pop: 1, _why: 'Популярное сейчас' }));
    if (s.char === 'new') jobs.push(wSearch((s.lang === 'foreign' ? 'new music ' : 'новинки музыки ') + new Date().getFullYear(), { _new: 1, _why: 'Что-то новое для тебя' }));
  }
  if (s.mood !== 'any' && W_MQ[s.mood]) jobs.push(wSearch(W_MQ[s.mood][s.lang] || W_MQ[s.mood].any, { _m: 1, _ru: s.lang === 'ru' ? 1 : 0, _inst: s.lang === 'inst' || s.mood === 'focus' ? 1 : 0, _why: `Настроение: ${W_MOOD.find((x) => x[0] === s.mood)[1].toLowerCase()}` }));
  if (s.lang !== 'any' && (!seed || s.lang === 'inst')) jobs.push(wSearch(W_LQ[s.lang], { _ru: s.lang === 'ru' ? 1 : 0, _inst: s.lang === 'inst' ? 1 : 0, _why: `Язык: ${W_LANG.find((x) => x[0] === s.lang)[1].toLowerCase()}` }));
  const all = (await Promise.all(jobs.map((p) => new Promise(resolve=>{const timer=setTimeout(()=>resolve([]),12000);Promise.resolve(p).then(v=>{clearTimeout(timer);resolve(v);},()=>{clearTimeout(timer);resolve([]);});})))).flat();
  return all.filter((t) => t && t.id && (seed || likeSvc(t.id) === cl));
}
const wLang = (t, l) => { const txt = `${t.title} ${t.author}`; return l === 'ru' ? !!t._ru || W_CYR.test(txt) : l === 'foreign' ? !W_CYR.test(txt) && !t._ru : l === 'inst' ? wInstrumental(t) : true; };
function wPlays(p) { const m = String(p || '').replace(',', '.').match(/([\d.]+)\s*(млрд|b|млн|m|тыс|k)?/i); if (!m) return 0; const u = (m[2] || '').toLowerCase(); return +m[1] * (/млрд|b/.test(u) ? 1e9 : /млн|m/.test(u) ? 1e6 : /тыс|k/.test(u) ? 1e3 : 1); }
// выбор: без повторов за 200 треков, не больше 2 треков одного исполнителя на 10, дизлайки и «нелюбимые» исполнители — мимо
// Same recording can arrive under multiple service IDs/album editions.
function wRecording(t){return wKey(t.author)+'|'+String(t.title||t.id).toLowerCase().replace(/\b(official (audio|video)|lyrics? video|audio only)\b/gi,'').replace(/[^\p{L}\p{N}]+/gu,'');}
function wPick(pool, n, o) {
  const s=wS(),w=WP(),q=lib.queue,dis=lib.dislikes||{};
  const inQ=new Set(q.tracks.slice(o.offline?q.idx:Math.max(0,q.idx-30)).map(t=>t.id)),seen=new Set(),recordings=new Set();
  const blocked=new Set(Object.keys(dis).map(id=>lib.known[id]).filter(Boolean).map(wRecording));
  let c=pool.filter(t=>{if(!t?.id||seen.has(t.id)||inQ.has(t.id)||dis[t.id]||blocked.has(wRecording(t))||wA(t)<=-6||o.offline&&!playable(t))return false;seen.add(t.id);const rec=wRecording(t);if(recordings.has(rec))return false;recordings.add(rec);return true;});
  // Explicit language/instrumental choices must not silently fall back to another language.
  if(s.lang!=='any')c=c.filter(t=>wLang(t,s.lang));
  const recent=new Set(w.hist.slice(-200)),fresh=c.filter(t=>!recent.has(t.id));
  // Small offline libraries may cycle only after exhaustion, never repeat current/upcoming.
  c=fresh.length?fresh:o.offline?c:[];
  const fav=s.char==='fav',nw=s.char==='new',pop=s.char==='pop';
  if(nw){const unknown=c.filter(t=>!isLiked(t.id)&&!w.hist.includes(t.id)&&w.t[t.id]==null);if(unknown.length)c=unknown;}
  const sc=c.map(t=>{const a=wA(t),tt=w.t[t.id]||0,nr=w.near[t.id]||0;
    let v=Math.random()*1.2+a*.35+nr*.8+tt*.3+(t._m?2:0);
    if(fav)v+=Math.max(0,a)*.4+(isLiked(t.id)?1.5:0);
    if(nw)v+=(Math.abs(a)>1?-2.5:1)+(t._new?1.5:0);
    if(pop)v+=(t._pop?2:0)+Math.min(3,Math.log10(wPlays(t.plays)+1)/3);
    return {t,v};}).sort((a,b)=>b.v-a.v);
  const cap=o.cap??2,out=[],history=w.ah.slice(-9);
  while(out.length<n&&sc.length){
    const seq=history.concat(out.map(t=>wKey(t.author))).slice(-9),last=seq.at(-1);
    const allowed=sc.filter(x=>{const k=wKey(x.t.author);return !k||seq.filter(a=>a===k).length<cap;});
    if(!allowed.length)break;
    // Do not place the same artist back-to-back if another valid artist is available.
    const chosen=allowed.find(x=>!wKey(x.t.author)||wKey(x.t.author)!==last)||allowed[0];
    out.push(chosen.t);sc.splice(sc.indexOf(chosen),1);
  }
  return out.map(t=>{const x={...t,wv:1};delete x.auto;delete x._seed;return x;});
}
async function wBatch(n, seed) {
  const rev=WV.rev,settings=JSON.stringify([wS().lang,wS().mood,wS().char]);
  const pool = await wPool(seed), off0 = !online();
  if(rev!==WV.rev||settings!==JSON.stringify([wS().lang,wS().mood,wS().char]))return [];
  const cap = seed && (seed.kind === 'artist' || seed.kind === 'album') ? 99 : seed && seed.kind === 'playlist' ? 3 : 2;
  return wPick(pool, n, { offline: off0, cap });
}

// ---------- запуск, продолжение, перестройка ----------
async function startWave(seed) {
  if (!online() && !offlineTracks().length) return toast('Нет интернета и скачанных треков — волне не из чего собраться', 'offline');
  const tok = ++WV.tok; WV.loading = true; heroRefresh(true);
  toast(seed ? `Собираю волну по: ${seed.name}…` : 'Собираю волну…', 'wave2');
  let batch = [];
  try { batch = await wBatch(10, seed); } catch (e) { console.error(e); }
  if (tok !== WV.tok) return;
  WV.loading = false;
  if (seed && seed.kind === 'track' && seed.t && wLang(seed.t,wS().lang)) batch = [{ ...seed.t, wv: 1, _why: 'С этого трека начинается волна', _whyId: null }, ...batch.filter((x) => x.id !== seed.t.id)];
  if (!batch.length) { heroRefresh(true); return toast(online() ? 'Не удалось собрать волну — попробуй другое настроение' : 'Мало скачанных треков для волны', 'alert'); }
  setQueue(batch, 0, seed ? `Волна по: ${seed.name}` : 'Моя волна', { r: 'wave' });
  lib.queue.wave = { seed: seed ? { ...seed, tracks: (seed.tracks || []).slice(0, 60) } : null, at: Date.now() };
  if (WV.sess) WV.sess.wave = true;
  save(); renderQueue(); heroRefresh(true); sendState();
}
async function waveExtend(playAfter, force) {
  const q = lib.queue; if (!q.wave) return;
  if (WV.busy) { if (force) WV.again = true; return; }
  if (!playAfter && !force && q.tracks.length - 1 - q.idx > 3) return;
  WV.busy = true;
  try {
    const add = await wBatch(10, q.wave.seed);
    if (lib.queue !== q || !q.wave) return;
    if (add.length) { q.tracks.push(...add); if (q.tracks.length > 400) { const cut = Math.min(q.idx - 20, q.tracks.length - 400); if (cut > 0) { q.tracks.splice(0, cut); q.idx -= cut; hist = []; } } renderQueue(); save(); if (playAfter) playIdx(q.tracks.length - add.length); }
    else if (playAfter) toast(online() ? 'Волна не нашла новых треков — смени настроение или характер' : 'Скачанные треки закончились — нужен интернет', 'alert');
  } catch (e) { console.error(e); }
  finally { WV.busy = false; wUpNext(); if (WV.again) { WV.again = false; waveExtend(false, true); } }
}
// смена настроения / характера / языка: текущий трек доигрывает, дальше — уже новая волна
function waveRebuild() {
  // Invalidate in-flight starts/refills before a new choice can change the queue.
  ++WV.rev;++WV.tok;WV.loading=false;
  const q = lib.queue; if (!q.wave) return;
  q.tracks.splice(q.idx + 1); renderQueue(); save();
  toast('Волна перестроится после этого трека', 'wave2');
  waveExtend(false, true);
}
function waveToggle() {
  if (lib.queue.wave && curTrack()) { toggle(); setTimeout(() => heroRefresh(true), 60); return; }
  startWave(null);
}
function waveChanged(path) {
  if (!/^wave\./.test(path)) return false;
  if (/^wave\.(mood|char|lang)$/.test(path)) { waveRebuild(); heroRefresh(true); }
  if (path === 'wave.anim') { WV.cv = null; document.querySelectorAll('.wave-hero').forEach((h) => h.classList.toggle('anim', wS().anim !== false)); }
  return true;
}

// ---------- разметка ----------
function waveMenuItems(t) {
  const dis = !!(lib.dislikes && lib.dislikes[t.id]), nm = wName(t.author);
  return [[dis ? 'dislike-f' : 'dislike', dis ? 'Убрать «Не нравится»' : 'Не нравится', () => toggleDislike(t)],
    ['wave2', 'Волна по треку', () => startWave({ kind: 'track', id: t.id, name: t.title, t: slim(t) })],
    ...(t.artistId ? [['wave2', `Волна по исполнителю${nm ? ' ' + nm : ''}`, () => startWave({ kind: 'artist', id: t.artistId, name: nm || 'исполнитель' })]] : []),
    ...(t.album && t.album.id ? [['wave2', 'Волна по альбому', () => startWave({ kind: 'album', id: t.album.id, name: t.album.name || 'альбом' })]] : [])];
}
const waveBtn = (kind, id, name, k, radio) => `<button class="btn wv-by" data-wby="${reg({ kind, id, name, k, radio })}" title="Бесконечная волна, похожая на это">${ico('wave2')}Волна</button>`;
const waveChipsHtml = (key, list, cur) => `<div class="wh-g"><span>${{ mood: 'Занятие', char: 'Характер', lang: 'Язык' }[key]}</span>${list.map(([v, n]) => `<button class="wh-c ${cur === v ? 'on' : ''}" data-wset="${key}:${v}">${n}</button>`).join('')}</div>`;
function waveHeroHtml(big) {
  const s = wS(), q = lib.queue, on = !!q.wave, t = on ? curTrack() : null;
  return `<section class="wave-hero ${s.anim !== false ? 'anim' : ''} ${big ? 'big' : ''} ${on && playing ? 'playing' : ''} ${WV.loading ? 'loading' : ''}"><canvas class="wh-cv"></canvas>
    <div class="wh-in"><div class="wh-k">${ico('wave2')}<span>${on && q.wave.seed ? esc(q.name) : 'Моя волна'}</span></div>
    <button class="wh-play" data-wact="toggle" title="Моя волна (W)">${ico(on && playing ? 'pause' : 'play')}<i class="wh-sp"></i></button>
    <div class="wh-t">${t ? esc(t.title) + ` <em>${esc(t.author || '')}</em>` : 'Бесконечный поток музыки под тебя'}</div>
    <div class="wh-why">${t ? wWhyHtml(t) : on ? '' : 'Учится на лайках, дизлайках и пропусках'}</div>
    ${on ? `<div class="wh-acts"><button class="ib" data-wact="dislike" title="Не нравится (X)">${ico('dislike')}</button>${q.wave.seed ? `<button class="btn sm" data-wact="mine">${ico('wave2')}Вернуться в Мою волну</button>` : ''}</div>` : ''}
    <div class="wh-chips">${waveChipsHtml('mood', W_MOOD, s.mood)}${waveChipsHtml('char', W_CHAR, s.char)}${waveChipsHtml('lang', W_LANG, s.lang)}</div></div></section>`;
}
// подпись «Похоже на …» кликабельна: открывает (включает) ту самую песню, а «Волна по …» — страницу исполнителя / альбома
function wWhyHtml(t) {
  if (!t || wS().why === false || !t._why) return '';
  const src = t._whyId && lib.known[t._whyId];
  if (src) return `<a class="wh-wl" data-wact="why" title="Включить «${esc(src.title)}»">${ico('play')}${esc(t._why)}</a>`;
  if (t._whyB && !/^__/.test(t._whyB)) return `<a class="wh-wl" data-wact="why" title="Открыть">${esc(t._why)}</a>`;
  return esc(t._why);
}
function heroRefresh(full) {
  const q = lib.queue, on = !!q.wave, live = on && playing;
  document.querySelectorAll('.nv-wave').forEach((n) => n.classList.toggle('live', live));
  const h = document.querySelector('.wave-hero'); if (!h) return;
  const t = on ? curTrack() : null, s = wS();
  const sig = [on, live, WV.loading, t && t.id, s.mood, s.char, s.lang, q.name].join('|');
  if (h._on === undefined) h._on = on;
  if (!full && sig === h._sig) return; h._sig = sig;
  h.classList.toggle('playing', live); h.classList.toggle('is-loading', WV.loading);
  if (full || h._on !== on) { const c = h.querySelector('canvas'); const tmp = document.createElement('div'); tmp.innerHTML = waveHeroHtml(h.classList.contains('big')); const n = tmp.firstElementChild; n.replaceChild(c, n.querySelector('canvas')); n._on = on; n._sig = sig; h.replaceWith(n); return; }
  h.querySelector('.wh-play').innerHTML = ico(live ? 'pause' : 'play') + '<i class="wh-sp"></i>';
  h.querySelector('.wh-t').innerHTML = t ? esc(t.title) + ` <em>${esc(t.author || '')}</em>` : 'Бесконечный поток музыки под тебя';
  h.querySelector('.wh-why').innerHTML = t ? wWhyHtml(t) : '';
}
setInterval(() => heroRefresh(false), 700);
// страница «Моя волна»: что дальше + что волна о тебе знает
function wUpHtml() {
  const q = lib.queue; if (!q.wave) return '';
  const key = reg({ tracks: q.tracks, queue: true });
  return `<div class="sh-head"><div class="tt"><div class="sh-title">Дальше в волне</div></div></div><div class="tl">${q.tracks.slice(q.idx, q.idx + 12).map((t, j) => trackRow(t, q.idx + j, key, { stack: true, noAlbum: true })).join('')}</div>`;
}
// 2.0.4: список обновляется на месте и без анимации строк — страница сразу собирается целиком
function wUpNext() { const box = $('wvUp'); if (box) box.innerHTML = wUpHtml(); }
function wavePageHtml() {
  const w = WP(), A = Object.entries(w.a);
  const top = A.filter(([, e]) => e.s > 0.5).sort((a, b) => b[1].s - a[1].s).slice(0, 18);
  const bad = A.filter(([, e]) => e.s <= -4).sort((a, b) => a[1].s - b[1].s).slice(0, 12);
  const chip = ([k, e], back) => `<span class="wv-a">${esc(e.n)}<button data-wact="${back ? 'unban' : 'forget'}:${esc(k)}" title="${back ? 'Снова предлагать' : 'Забыть — реже предлагать'}">${ico(back ? 'refresh' : 'x')}</button></span>`;
  const nDis = Object.keys(lib.dislikes || {}).length, nLike = Object.keys(lib.likes || {}).length;
  return `${waveHeroHtml(true)}<div class="shelf" id="wvUp">${wUpHtml()}</div>
    <div class="shelf wv-prof"><div class="sh-head"><div class="tt"><div class="sh-title">Что волна знает о тебе</div></div></div>
    <div class="wv-stats"><div><b>${w.n || 0}</b><span>треков в волне</span></div><div><b>${nLike}</b><span>лайков</span></div><div><b>${nDis}</b><span>дизлайков</span></div><div><b>${A.length}</b><span>исполнителей в профиле</span></div></div>
    ${top.length ? `<div class="wv-h">Любимые исполнители</div><div class="wv-as">${top.map((x) => chip(x)).join('')}</div>` : `<div class="wv-note">Пока пусто — слушай волну, ставь лайки и дизлайки, и она начнёт понимать твой вкус</div>`}
    ${bad.length ? `<div class="wv-h">Реже предлагаю</div><div class="wv-as">${bad.map((x) => chip(x, true)).join('')}</div>` : ''}
    <div class="wv-btns"><button class="btn" data-wact="settings">${ico('settings')}Настройки волны</button><button class="btn danger" data-wact="reset">${ico('refresh')}Сбросить волну</button></div>
    <div class="wv-note">Профиль хранится только на этом компьютере. Сброс не трогает лайки и дизлайки.</div></div>`;
}
PAGES.wave = { sync: () => wavePageHtml() };
PX.on('page', (r) => { if (r && r.r === 'wave') WV.chk = 0; }); // холст волны подхватываем сразу, а не через 0,4 с
function waveTab() {
  return { id: 'wave', icon: 'wave2', title: 'Моя волна', desc: 'Бесконечный поток под твой вкус. Учится на лайках, дизлайках, пропусках и дослушанных треках', rows: [
    grp('Что играть'),
    R('Занятие и настроение', '', seg('wave.mood', W_MOOD), 'волна настроение бодрое спокойное'),
    R('Характер', 'Любимое — больше знакомого, Незнакомое — новые исполнители, Популярное — хиты', seg('wave.char', W_CHAR), 'волна характер'),
    R('Язык', '', seg('wave.lang', W_LANG), 'волна язык русский'),
    grp('Обучение'),
    R('Пропускать дизлайкнутые', 'Треки с «Не нравится» не играют ни в волне, ни в плейлистах', tg('wave.skipDis'), 'дизлайк пропуск'),
    R('Учиться на всём, что слушаю', 'Не только в волне, но и в плейлистах и альбомах (с половинным весом)', tg('wave.learnAll'), 'волна обучение'),
    R('Подписи «почему этот трек»', 'Под названием в волне: «Похоже на …», «Настроение: …»', tg('wave.why'), 'волна почему'),
    R('Клавиши W и X', 'W — запустить / пауза волны, X — «Не нравится»', tg('wave.keys'), 'клавиши горячие'),
    grp('Вид'),
    R('Живая анимация', 'Волны в цветах обложки, качаются под бит', tg('wave.anim'), 'анимация волна'),
    ...(wS().anim !== false ? [R('↳ Качество', 'Авто — проще в режиме «Экономно»', seg('wave.animQ', [['auto', 'Авто'], ['high', 'Высокое'], ['low', 'Низкое']]), 'качество')] : []),
    grp('Профиль'),
    R('Что волна знает о тебе', 'Любимые исполнители, статистика', `<button class="btn sm" data-wact="page">${ico('wave2')}Открыть</button>`),
    R('Сбросить волну', 'Забыть вкус и историю волны. Лайки и дизлайки останутся', `<button class="btn sm" data-wact="reset">${ico('refresh')}Сбросить</button>`, 'сброс волна')] };
}

// ---------- клики ----------
document.addEventListener('click', (e) => {
  const el = e.target.closest && e.target.closest('[data-wset],[data-wact],[data-wby]'); if (!el) return;
  e.stopPropagation(); e.preventDefault();
  if (el.dataset.wset) {
    const [k, v] = el.dataset.wset.split(':'); if (wS()[k] === v) return; wS()[k] = v;
    document.querySelectorAll(`[data-wset^="${k}:"]`).forEach((b) => b.classList.toggle('on', b === el || b.dataset.wset === el.dataset.wset));
    waveChanged('wave.' + k); save(); if (route().r === 'settings') rerenderSettings();
    if (!lib.queue.wave) startWave(null);
    return;
  }
  if (el.dataset.wby) {
    const o = got(el.dataset.wby); if (!o) return; const L = o.k && got(o.k);
    startWave({ kind: o.kind, id: o.id, name: o.name, radio: o.radio || null, tracks: L && L.tracks ? L.tracks.slice(0, 60).map(slim) : [] }); return;
  }
  const [a, arg] = el.dataset.wact.split(':');
  if (a === 'toggle') waveToggle();
  if (a === 'dislike') toggleDislike(curTrack());
  if (a === 'why') {
    const c = curTrack(); if (!c) return; const src = c._whyId && lib.known[c._whyId];
    if (src) { const q = lib.queue, ex = q.tracks.findIndex((x, i) => i > q.idx && x.id === src.id); if (ex > 0) q.tracks.splice(ex, 1); q.tracks.splice(q.idx + 1, 0, { ...src, wv: 1, _why: 'Ты открыл его из подписи «Похоже на…»' }); renderQueue(); playIdx(q.idx + 1); save(); }
    else if (c._whyB) goBrowse(c._whyB);
  }
  if (a === 'mine') startWave(null);
  if (a === 'page') go({ r: 'wave' });
  if (a === 'settings') { lib.setTab = 'wave'; go({ r: 'settings' }); }
  if (a === 'forget' || a === 'unban') { const e2 = WP().a[arg]; if (e2) e2.s = a === 'forget' ? -2 : 0; save(); if (route().r === 'wave') renderRoute(true); toast(a === 'forget' ? `${e2 ? e2.n : 'Исполнитель'} — буду предлагать реже` : 'Снова буду предлагать', 'wave2'); }
  if (a === 'reset') {
    if (!confirm('Сбросить «Мою волну»?\n\nВолна забудет твой вкус и историю. Лайки и дизлайки останутся.')) return;
    lib.wave = null; WP(); WV.sq.clear(); save(); toast('Волна сброшена — начинаем с чистого листа', 'refresh');
    if (route().r === 'wave' || route().r === 'home') renderRoute(true);
  }
}, true);
const wDisBtn = () => { const b = $('btnDislike'); if (b && !b._wv) { b._wv = 1; b.onclick = () => toggleDislike(curTrack()); } updDis(); };
wDisBtn();
PX.on('ready', () => {
  wDisBtn(); WP(); wPrune();
  const wc = S().widget; if (wc && Array.isArray(wc.ctlOrder) && !wc.ctlOrder.includes('dislike')) { const i = wc.ctlOrder.indexOf('like'); wc.ctlOrder.splice(i < 0 ? 0 : i + 1, 0, 'dislike'); save(); }
  setTimeout(flushDis, 5000);
});

// ---------- живая волна ----------
const W_NEON = ['255,45,149', '120,80,255', '0,200,255'];
function wSetCanvas(c) {
  if (WV.io) WV.io.disconnect(); if (WV.ro) WV.ro.disconnect();
  WV.cv = c; WV.cx = c ? c.getContext('2d') : null; WV.vis = false; if (!c) return;
  WV.io = new IntersectionObserver((es) => { WV.vis = es[es.length - 1].isIntersecting; }); WV.io.observe(c);
  WV.ro = new ResizeObserver(() => { WV.w = 0; }); WV.ro.observe(c);
}
function waveFrame(now, f, beat, tempo) {
  const s = wS(); if (s.anim === false || hiddenNow || ppOpenNow) return;
  if (now - WV.chk > 400 || (WV.cv && !WV.cv.isConnected)) { WV.chk = now; const c = document.querySelector('.wave-hero.anim .wh-cv'); if (c !== WV.cv) wSetCanvas(c); }
  if (!WV.cv || !WV.vis) return;
  const low = s.animQ === 'low' || (s.animQ !== 'high' && S().perf.mode === 'eco');
  const live = !!(playing && lib.queue.wave);
  if (now - WV.last < (playing ? (low ? 32 : 15) : 33)) return;
  const dt = Math.min(100, now - (WV.last || now)); WV.last = now;
  const c = WV.cv, x = WV.cx;
  if (!c._on) { c._on = 1; requestAnimationFrame(() => c.classList.add('on')); } // волны проявляются плавно, а не выскакивают
  if (!WV.w) { const r = c.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, low ? 1 : 1.25); WV.w = Math.max(1, Math.round(r.width * d)); WV.h = Math.max(1, Math.round(r.height * d)); c.width = WV.w; c.height = WV.h; }
  const W = WV.w, H = WV.h;
  let en = 0; if (f && playing) { let a = 0; for (let i = 2; i < 64; i++) a += f[i]; en = a / (62 * 255); } else if (playing) en = 0.35;
  WV.lvl += ((en + (beat || 0) * 0.5) - WV.lvl) * Math.min(1, dt / 120);
  const bpm = tempo && tempo.conf ? tempo.bpm : 110;
  WV.ph += dt * 0.001 * (playing ? 0.5 + (bpm / 120) * (live ? 0.7 : 0.4) : 0.18);
  const pal = (basePal && basePal.length ? basePal : W_NEON).map(String);
  x.clearRect(0, 0, W, H); x.globalCompositeOperation = 'lighter';
  const N = low ? 3 : 5, step = Math.max(6, Math.round(W / (low ? 40 : 90))), mid = H * 0.7, lv = 0.35 + WV.lvl * 1.4;
  for (let i = 0; i < N; i++) {
    const A = H * (0.07 + 0.035 * i) * lv, th = H * (0.05 + 0.02 * ((i + 1) % 3)) * (0.7 + WV.lvl), k1 = (1.6 + i * 0.45) * Math.PI / W, k2 = (3.1 + i * 0.7) * Math.PI / W, sp = 1 + i * 0.23, o = i * 1.7;
    const y = (px, d) => mid + (i - (N - 1) / 2) * H * 0.045 + Math.sin(px * k1 + WV.ph * sp + o) * A + Math.sin(px * k2 - WV.ph * 0.8 * sp + o * 2) * A * 0.45 + d;
    x.beginPath(); x.moveTo(0, y(0, 0));
    for (let px = step; px <= W + step; px += step) x.lineTo(px, y(px, 0));
    for (let px = W + step; px >= -step; px -= step) x.lineTo(px, y(px, th * (0.6 + 0.4 * Math.sin(px * k1 * 0.7 + WV.ph + i))));
    x.closePath();
    x.fillStyle = `rgba(${pal[i % pal.length]},${(live ? 0.26 : 0.16) + 0.04 * (i % 2)})`; x.fill();
  }
  x.globalCompositeOperation = 'source-over';
}
