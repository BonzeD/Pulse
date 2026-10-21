'use strict';
// 2.0.2: Pulse как клиент YouTube Music, Apple Music и Spotify.
// Переключатель в боковом меню меняет, чей каталог, поиск, рекомендации и медиатеку показывает Pulse.
// Звук треков Apple Music и Spotify берётся из той же записи в YouTube Music (их собственный звук защищён DRM и доступен
// только в их приложениях). Тексты песен можно брать из любого сервиса — см. lySrcRows() и меню у подписи источника.
const CL_NAME = { yt: 'YouTube Music', am: 'Apple Music', sp: 'Spotify' };
const CL_ICO = { yt: 'ytm', am: 'apple', sp: 'spotify' };
const svcSt = { am: { user: false }, sp: { user: false } }; // вход в Apple Music / Spotify (узнаём у главного процесса)
const svcLists = { am: null, sp: null }; // плейлисты медиатеки
// 2.0.4: список плейлистов сервиса запоминается — боковая панель и «Медиатека» показываются сразу, а свежий список подтягивается в фоне
try { const o = JSON.parse(localStorage.getItem('pulse.svcLists') || '{}'); for (const k of ['am', 'sp']) if (Array.isArray(o[k])) svcLists[k] = o[k]; } catch {}
window.PulseRememberPlaylistArt=(id,art)=>{if(!/^am:(?:lib|playlist):/.test(id)||typeof art!=='string')return;let changed=false;for(const p of svcLists.am||[])if(p.browseId===id&&p.art!==art){p.art=art;p.icon=null;changed=true;}if(changed)svcListsSave();};
function svcListsSave() { try { localStorage.setItem('pulse.svcLists', JSON.stringify(svcLists)); } catch {} }
const svcListsP = {};
function svcListsLoad(c) {
  if (svcListsP[c]) return svcListsP[c];
  return (svcListsP[c] = pulse.svc.playlists(c).catch(() => null).then((l) => { if (l && !l.error && Array.isArray(l)) { svcLists[c] = l; svcListsSave(); } return svcLists[c]; }).finally(() => { delete svcListsP[c]; }));
}
const LY_SRC = [['auto', 'Все источники'], ['yt', 'YouTube Music'], ['am', 'Apple Music'], ['sp', 'Spotify'], ['lr', 'LRCLIB'], ['spicy', 'Spicy Lyrics']]; // 2.0.4: Spicy Lyrics — нужен свой ключ // 2.0.4-fix: LRCLIB — отдельный источник
const lySrcMode = () => (['yt', 'am', 'sp', 'lr', 'spicy'].includes(S().ly.src) ? S().ly.src : 'auto');
const svcUrl = (id) => {
  const [s, k, ...r] = String(id).split(':'); const x = r.join(':');
  if (s === 'sp') return r.length ? `https://open.spotify.com/${k}/${x}` : `https://open.spotify.com/track/${k}`;
  if (s === 'am') return r.length ? `https://music.apple.com/${k === 'lib' ? 'library/playlist' : k === 'artist' ? 'artist' : k === 'playlist' ? 'playlist' : 'album'}/${x}` : `https://music.apple.com/song/${k}`;
  return `https://music.youtube.com/watch?v=${id}`;
};

// ---------- переключатель клиента ----------
// 2.0.2: только логотипы; выбранный сервис подсвечивает «плашка», которая плавно переезжает к нему
const CL_KEYS = ['yt', 'am', 'sp'];
function renderClSw() {
  const el = $('clSw'); if (!el) return; const c = CL();
  if (!el.querySelector('.cl-ind')) el.innerHTML = '<i class="cl-ind"></i>' + CL_KEYS.map((k) => `<button data-cl="${k}" title="${CL_NAME[k]}" aria-label="${CL_NAME[k]}">${ico(CL_ICO[k])}</button>`).join('');
  el.style.setProperty('--i', CL_KEYS.indexOf(c));
  el.querySelectorAll('button').forEach((b) => { const on = b.dataset.cl === c; if (on && !b.classList.contains('on') && el.dataset.ready) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); } b.classList.toggle('on', on); });
  el.dataset.c = c; requestAnimationFrame(() => (el.dataset.ready = '1'));
  document.body.dataset.client = c;
  const q = $('gq'); if (q) q.placeholder = c === 'yt' ? 'Поиск песен, альбомов, исполнителей' : `Поиск в ${CL_NAME[c]}`;
}
async function clInit() {
  renderClSw();
  try { await pulse.svc.setClient(CL(), { amSf: S().app.amSf || 'auto' }); } catch {}
  if (online()) svcRefresh();
}
async function svcRefresh() {
  const st = await pulse.svc.status().catch(() => null);
  if (st && !st.error) { Object.assign(svcSt.am, st.am || {}); Object.assign(svcSt.sp, st.sp || {}); }
  const c = CL();
  if (c !== 'yt' && svcSt[c].user) { if (svcLists[c]) renderSide(); await svcListsLoad(c); }
  renderSide();
  if (route().r === 'settings' && ['client', 'ly'].includes(lib.setTab)) deferRerender(0);
}
async function setClient(c) {
  c = ['am', 'sp'].includes(c) ? c : 'yt';
  if (S().app.client !== c) { S().app.client = c; save(); }
  renderClSw(); // анимация переключения — сразу, не дожидаясь главного процесса
  // 2.0.4: «прыжок» страницы (cl-anim) убран — снятие класса через 0,6 с перезапускало анимацию появления, и страница моргала второй раз
  if (route().r !== 'settings' && typeof pageLeave === 'function') pageLeave(); // 2.0.4: старая Главная начинает таять сразу по клику
  await pulse.svc.setClient(c, { amSf: S().app.amSf || 'auto' }).catch(() => {});
  // с новой Главной: стек навигации прежнего клиента больше не нужен
  if (route().r !== 'settings') { navS.stack = [{ r: 'home' }]; navS.pos = 0; renderRoute(); }
  renderSide(); { const sl = $('sideList'); if (sl) { sl.classList.remove('sl-in'); void sl.offsetWidth; sl.classList.add('sl-in'); } } // 2.0.4: список плейлистов сменяется плавно
  toast(CL_NAME[c], c === 'yt' ? 'ytm' : CL_ICO[c]); // 2.0.4: без предупреждения «звук — из YouTube Music»
  if (online()) svcRefresh();
}
// 2.0.2: Spotify — через то же окно входа, что и YouTube Music (браузер по умолчанию / готовый вход из браузера);
// inner = встроенное окно (почта и пароль)
async function svcLogin(s, inner) {
  if (!online()) return toast('Нет интернета');
  if (s === 'sp' && !inner) return openLogin('sp');
  toast(`Открываю вход в ${CL_NAME[s]}…`, 'user');
  const r = await pulse.svc.login(s).catch((e) => ({ error: String(e) }));
  if (r && r.ok) { toast(`Вход в ${CL_NAME[s]} выполнен`, 'check'); cache.clear(); await svcRefresh(); lyRecheckSvc(s); if (CL() === s && ['home', 'library'].includes(route().r)) renderRoute(true); }
  else if (r && r.error) toast(r.error);
}
// 2.0.2: после входа тексты, которые раньше взяли «из запасных баз» (сервис без входа текст не отдавал), перепроверяются
function lyRecheckSvc(s) {
  for (const id in lib.lyrics) { const L = lib.lyrics[id]; if (L && !L.user && !L.picked && (L.none || L.fallback || (L.srcMode || 'auto') === 'auto')) L.recheck = true; }
  save(); const t = curTrack(); if (t) loadLyricsFor(t);
}
async function svcLogout(s) {
  if (!confirm(`Выйти из ${CL_NAME[s]}?`)) return;
  { const id = accmS[s] && accmS[s].active; if (id && pulse.accounts) accSet(s, await pulse.accounts.remove(id, s).catch(() => null)); } // 2.0.3
  await pulse.svc.logout(s).catch(() => {}); svcSt[s] = { user: false }; svcLists[s] = null; svcListsSave(); cache.clear();
  toast(`Ты вышел из ${CL_NAME[s]}`, 'logout'); renderSide(); renderAccBtn(); if (CL() === s) renderRoute(true); svcRefresh();
}
const clLoginCard = (big) => {
  const c = CL(), why = c === 'am' ? 'Войди в Apple Music, чтобы видеть свою медиатеку, плейлисты и рекомендации. Каталог, поиск и чарты работают и без входа.' : 'Войди в Spotify, чтобы видеть свои плейлисты, «Любимые треки» и рекомендации. Каталог и поиск работают и без входа.';
  return `<div class="sl-login cl-login" style="margin:0 0 28px;max-width:560px;font-size:14px">${big ? `<b style="font-size:17px;display:block;margin-bottom:4px;color:#fff">Войди в ${CL_NAME[c]}</b>` : ''}${why}<button data-clact="login:${c}">${ico(CL_ICO[c])}Войти в ${CL_NAME[c]}</button></div>`;
};
function clGreet() {
  const c = CL(), st = svcSt[c];
  if (st.user) return `<div class="sh-strap cl-strap">${ico(CL_ICO[c])}${st.name ? `Привет, ${esc(String(st.name).split(' ')[0])}` : CL_NAME[c]}</div>`;
  return `<div class="cl-hint">${ico(CL_ICO[c])}<span>${CL_NAME[c]} без входа: каталог, чарты и поиск.</span><button class="btn sm" data-clact="login:${c}">Войти</button></div>`;
}
function clSideLists() {
  const c = CL();
  if (!svcSt[c].user) return `<div class="sl-login cl-side">${ico(CL_ICO[c])} Твоя медиатека ${CL_NAME[c]} появится здесь после входа<button data-clact="login:${c}">${ico(CL_ICO[c])}Войти</button></div>`;
  return (svcLists[c] || []).map((p) => `<a class="sl" data-b="${esc(p.browseId)}"><div class="n">${p.icon === 'heart' ? ico('heart-f') : ''}${esc(p.title)}</div><div class="s">${esc(p.sub || CL_NAME[c])}</div></a>`).join('');
}
// медиатека сервиса: плейлисты, треки («Нравится»), альбомы, исполнители
async function clLibrary(r, tab, force) {
  const c = CL();
  const tabs = `<div class="lib-tabs">${[['pl', 'Плейлисты'], ['songs', 'Треки'], ['albums', 'Альбомы'], ['artists', 'Исполнители']].map(([k, n]) => `<button class="chip ${tab === k ? 'on' : ''}" data-lib="${k}">${n}</button>`).join('')}</div>`;
  if (tab === 'pl') {
    const items = [{ kind: 'local', id: '__off', title: 'Скачанное', sub: tr(offlineTracks().length), icon: 'offline' }]; // 2.0.3: «Мои треки» убран
    if (svcSt[c].user) {
      if (!svcLists[c]) await svcListsLoad(c);
      else if (force || !clLibrary.at || Date.now() - clLibrary.at > 60e3) { clLibrary.at = Date.now(); const was = JSON.stringify(svcLists[c]); svcListsLoad(c).then(() => { if (JSON.stringify(svcLists[c]) === was) return; renderSide(); if (route().r === 'library' && CL() === c) renderRoute(false, true); }); } // обновляем в фоне
      (svcLists[c] || []).forEach((p) => items.push({ ...p, icon: p.art ? null : p.icon || 'list' }));
    }
    lib.playlists.filter((p) => p.id !== MINE).forEach((p) => items.push({ kind: 'local', id: p.id, title: p.name, sub: `${tr(p.tracks.length)} · на устройстве`, art: p.art || (p.tracks[0] && artOf(p.tracks[0], 300)), icon: p.art || p.tracks[0] ? null : 'list' }));
    return tabs + (svcSt[c].user ? '' : clLoginCard()) + `<div class="shelf">${cards(items, { grid: true })}</div>`;
  }
  if (!svcSt[c].user) return tabs + clLoginCard(true);
  if (tab === 'songs') {
    const d = await cached('b:' + c + ':liked', () => ytm('browse', c + ':liked'), force);
    const name = c === 'am' ? 'Песни в медиатеке' : 'Любимые треки';
    return tabs + `<div class="hb" style="display:flex;gap:10px;margin-bottom:20px"><button class="btn w" data-play="${reg({ tracks: d.tracks, name })}">${ico('play')}Слушать</button><button class="btn" data-shuf="${reg({ tracks: d.tracks, name })}">${ico('shuffle')}Перемешать</button></div>` + (d.tracks && d.tracks.length ? trackList(d.tracks, { name }) : emptyHtml('heart', 'Пока пусто', ''));
  }
  const id = tab === 'albums' ? 'FEmusic_liked_albums' : 'FEmusic_library_corpus_track_artists';
  const d = await cached('f:' + id, () => ytm('feed', id), force);
  const it = (d.shelves || []).flatMap((s) => s.items);
  return tabs + (it.length ? `<div class="shelf">${cards(it, { grid: true })}</div>` : emptyHtml('library', 'Пока пусто', ''));
}

// ---------- настройки: вкладка «Клиент» ----------
const AM_REGIONS = [['auto', 'Как в аккаунте / системе'], ['ru', 'Россия'], ['ua', 'Украина'], ['kz', 'Казахстан'], ['by', 'Беларусь'], ['us', 'США'], ['gb', 'Великобритания'], ['de', 'Германия'], ['fr', 'Франция'], ['pl', 'Польша'], ['tr', 'Турция'], ['jp', 'Япония'], ['kr', 'Корея']];
function clientTab() {
  const st = (s) => svcSt[s].user ? `<span class="ok">${ico('check')}Вход выполнен${svcSt[s].name ? ' · ' + esc(svcSt[s].name) : ''}</span> <button class="btn sm" data-clact="logout:${s}">${ico('logout')}Выйти</button>` : `<button class="btn sm acc" data-clact="login:${s}">${ico(CL_ICO[s])}Войти</button>`;
  return { id: 'client', icon: 'swap', title: 'Клиент', rows: [
    R('Откуда звук', 'Apple Music и Spotify отдают звук только своим приложениям (защита DRM). Pulse находит ту же запись в YouTube Music — по коду ISRC, названию, исполнителю и длительности — и играет её. Скачивание для офлайна работает так же', '', 'звук drm качество'),
    grp('Apple Music'),
    R('Аккаунт Apple Music', 'Медиатека, плейлисты, «Нравится» и тексты песен Apple Music (тексты — только с подпиской)', st('am'), 'apple вход аккаунт'),
    R('Регион каталога', 'Страна магазина Apple Music: от неё зависят чарты и доступные релизы', sel('app.amSf', AM_REGIONS), 'apple регион страна'),
    grp('Spotify'),
    R('Аккаунт Spotify', 'Плейлисты, «Любимые треки», рекомендации и тексты песен Spotify. Вход — в браузере по умолчанию (работает и через Google) или готовый вход из браузера', st('sp'), 'spotify вход аккаунт'),
    grp('YouTube Music'),
    R('Аккаунт YouTube Music', account ? `Вошёл как <b data-i18n-skip>${esc(account.name)}</b>` : 'Не выполнен вход', account ? '' : `<button class="btn sm acc" data-act="login">${ico('google')}Войти</button>`, 'youtube google')] };
}
// ---------- настройки: «Текст песен» → откуда брать текст ----------
function lySrcRows() {
  const need = [];
  if (!svcSt.am.user) need.push('Apple Music — нужен вход и подписка');
  if (!svcSt.sp.user) need.push('Spotify — нужен вход');
  return [grp('Откуда брать текст'),
    R('Источник текста', 'Все источники — лучший вариант: сначала пословная синхронизация, потом построчная. Выбранный сервис — первым, а если в нём текста нет — из Musixmatch / NetEase / LRCLIB. LRCLIB — только открытая база текстов, без сервисов.' + (need.length ? ` <em>${esc(need.join(' · '))}</em>` : ''), seg('ly.src', LY_SRC), 'источник текст apple spotify youtube'),
    R('Бэк-вокал Apple Music', 'Подпевки — в скобках, своим цветом и с собственными таймингами', tg('ly.bgVox'), 'бэк вокал подпевки'),
    R('Цвета текста Spotify', 'Фон и подсветка текста — как в Spotify для этой песни', tg('ly.svcColors'), 'цвет spotify'),
    R('Авторы песни', 'Показывать авторов под текстом, если сервис их отдаёт (Apple Music)', tg('ly.credits'), 'авторы songwriter')];
}
function clChanged(path) {
  if (path === 'app.client') { setClient(S().app.client); return true; }
  if (path === 'app.amSf') { pulse.svc.setClient(CL(), { amSf: S().app.amSf }).then(() => { cache.clear(); }); return true; }
  if (path === 'ly.src' || path === 'ly.bgVox') {
    if (path === 'ly.bgVox') for (const id in lib.lyrics) { const L = lib.lyrics[id]; if (L && L.provider === 'am' && !L.user) L.recheck = true; }
    updVizLySrc(); const t = curTrack(); if (t) loadLyricsFor(t); return true;
  }
  if (path === 'ly.svcColors' || path === 'ly.credits') { lySrcDecor(); return true; }
  return false;
}
async function setLySrc(v) {
  if (v === 'spicy' && !String((S().spicy || {}).key || '').trim()) { lib.setTab = 'ly'; toast('Для Spicy Lyrics нужен свой ключ — вставь его в «Текст песен → Spicy Lyrics»', 'lyrics'); if (document.body.classList.contains('pp-open') && typeof closePP === 'function') closePP(); go({ r: 'settings' }); return; }
  S().ly.src = v; save(); updVizLySrc();
  const t = curTrack(); if (t) { const L = lib.lyrics[t.id]; if (L && L.picked) { delete L.picked; } loadLyricsFor(t); }
  toast('Текст: ' + LY_SRC.find((x) => x[0] === v)[1], 'lyrics');
  if (route().r === 'settings') deferRerender(0);
}
function lySrcMenu(x, y) {
  const cur = lySrcMode();
  const items = LY_SRC.map(([v, n]) => [v === cur ? 'check' : v === 'auto' ? 'sparkle' : CL_ICO[v] || 'lyrics', n + (v === 'am' && !svcSt.am.user ? ' · нужен вход' : v === 'sp' && !svcSt.sp.user ? ' · нужен вход' : v === 'spicy' && !String((S().spicy || {}).key || '').trim() ? ' · нужен ключ' : ''), () => setLySrc(v)]);
  items.push('-', ['tune', 'Найти другой текст…', () => openFix()]);
  showMenu(x, y, items);
  const m = $('menu'); if (m) m.style.top = Math.max(typeof menuTop === 'function' ? menuTop() : 40, y - m.offsetHeight) + 'px'; // над подписью
}
function updVizLySrc() { const n = $('vizLySrcN'); if (n) n.textContent = LY_SRC.find((x) => x[0] === lySrcMode())[1]; }

// ---------- эффекты текста из сервисов ----------
const lyRec = () => (lyState.id ? lib.lyrics[lyState.id] : null);
// дуэт: строки второго голоса (Apple Music) — справа
function lyDuet(l) {
  const L = lyRec(); const d = L && !L.user && L.fx && L.fx.duet; if (!d || !d.length || !l || l.gap) return false;
  return d.some((x) => Math.abs(x - l.t) < 0.03);
}
// слова; бэк-вокал в скобках получает класс bgv
function lyWordsHtml(words) {
  let depth = 0, wasBg = false;
  return words.map((w) => {
    const s = String(w.s || ''); const opens = /^[([]/.test(s); if (opens) depth++;
    const bg = depth > 0; if (/[)\]][,.!?…]*$/.test(s) && depth > 0) depth--;
    // 2.0.4: бэк-вокал Spicy Lyrics — отдельной строкой под основным голосом (как в Spicy), со своими таймингами
    const br = w.bg && !wasBg ? '<span class="bgbr"></span>' : ''; wasBg = !!w.bg;
    return `${br}<span class="w${bg || w.bg ? ' bgv' : ''}${w.bg ? ' sbg' : ''}">${esc(wtxt(s))}</span>`;
  }).join('');
}
// подпись источника: кликабельна (выбор источника), авторы и цвета Spotify
function lySrcDecor() {
  const el = $('lySrc'); if (!el) return;
  el.classList.add('pick'); el.title = 'Откуда брать текст — нажми, чтобы выбрать';
  const L = lyRec(); const ly = $('lyrics');
  const col = L && !L.user && L.fx && L.fx.colors && S().ly.svcColors !== false ? L.fx.colors : null;
  [ly, $('stage')].forEach((n) => { if (!n) return; n.classList.toggle('svc-col', !!col); if (col) { n.style.setProperty('--svc-bg', col.bg || '#000'); n.style.setProperty('--svc-hi', col.hi || '#fff'); n.style.setProperty('--svc-tx', col.text || '#000'); } });
  if (L && !el.querySelector('.ly-cred')) {
    const extra = [];
    if (L.autoOff != null && lib.offsets[lyState.id] === L.autoOff) extra.push('сдвиг подогнан под эту запись'); // 2.0.4-fix
    if (L.fallback && L.srcMode && L.srcMode !== 'auto') extra.push(`в ${L.srcMode === 'spicy' ? 'Spicy Lyrics' : CL_NAME[L.srcMode] || 'LRCLIB'} текста нет`);
    if (L.fx && L.fx.credits && L.fx.credits.length && S().ly.credits !== false && !L.user) extra.push('Авторы: ' + L.fx.credits.slice(0, 4).join(', '));
    if (extra.length) el.insertAdjacentHTML('beforeend', `<span class="ly-cred">${esc(extra.join(' · '))}</span>`);
  }
}
document.addEventListener('click', (e) => {
  const sw = e.target.closest('[data-cl]'); if (sw && sw.closest('#clSw')) { e.stopPropagation(); if (sw.dataset.cl !== CL()) setClient(sw.dataset.cl); else { navS.stack = [{ r: 'home' }]; navS.pos = 0; renderRoute(); } return; }
  const a = e.target.closest('[data-clact]');
  if (a) { e.stopPropagation(); e.preventDefault(); const [act, s] = a.dataset.clact.split(':'); if (act === 'login') svcLogin(s); if (act === 'logout') svcLogout(s); return; }
  if (e.target.closest('#lySrc')) { const r = e.target.closest('#lySrc').getBoundingClientRect(); e.stopPropagation(); lySrcMenu(r.left, r.top - 8); return; }
}, true);
updVizLySrc();

// 2.0.3: аккаунты Apple Music / Spotify запоминаются в их собственном менеджере аккаунтов (extras.js), аватарка — по открытому сервису
const accSnapAt = {};
{ const base = svcRefresh; svcRefresh = async function (...a) { const r = await base.apply(this, a); for (const s of ['am', 'sp']) if (svcSt[s].user && pulse.accounts && (!accmS[s].active || performance.now() - (accSnapAt[s] || 0) > 600e3) && (accSnapAt[s] = performance.now())) pulse.accounts.snapshot(s).then((x) => { accSet(s, x); renderAccBtn(); }).catch(() => {}); renderAccBtn(); if (svcSt.am.user || svcSt.sp.user) flushLikes(); for (const s of ['am', 'sp']) if (svcSt[s].user) likePullT(s); return r; }; }
{ const base = setClient; setClient = async function (...a) { const p = base.apply(this, a); renderAccBtn(); accPopClose(); return p; }; }
