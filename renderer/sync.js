'use strict';
// Плейлисты: создание в YouTube Music, добавление/удаление треков, синхронизация и офлайн-кэш
const SY = { busy: false, at: 0, err: null, timer: null };
const isAccList = (bid) => (accLists || lib.accCache || []).some((p) => (p.browseId || 'VL' + p.listId) === bid) || !!(lib.ytc && lib.ytc[bid]);
function cacheList(bid, d) {
  lib.ytc = lib.ytc || {};
  const h = d.header || {};
  lib.ytc[bid] = { title: h.title || (lib.ytc[bid] || {}).title || 'Плейлист', sub: h.sub || '', art: h.art || null, strap: h.strap || '', editable: !!d.editable,
    tracks: (d.tracks || []).map((t) => { remember(t); return { ...slim(t), setVid: t.setVid || null }; }), at: Date.now() };
}
function cachedPage(bid) {
  const c = lib.ytc && lib.ytc[bid]; if (!c) return null;
  return { type: 'playlist', browseId: bid, editable: c.editable, cached: c.at, header: { title: c.title, sub: c.sub, art: c.art, strap: c.strap }, tracks: c.tracks.map((t) => ({ ...t })), shelves: [] };
}
function syncLabel() {
  const el = $('syncSt'); if (!el) return;
  if (!account && !(lib.accCache || []).length) { el.innerHTML = ''; return; }
  const tm = SY.at || lib.syncAt;
  el.innerHTML = SY.busy ? `${ico('sync', 'spin')}<span>Синхронизация… ${SY.prog || ''}</span>` : SY.err ? `${ico('alert')}<span>${esc(SY.err)}</span>` : tm ? `${ico('cloud')}<span>${online() ? 'Синхронизировано' : 'Офлайн-копия'} · ${new Date(tm).toLocaleTimeString().slice(0, 5)}</span>` : '';
  el.title = 'Нажми, чтобы синхронизировать плейлисты с YouTube Music';
}
async function syncAll(force) {
  if (SY.busy || !account || !online()) return syncLabel();
  SY.busy = true; SY.err = null; syncLabel();
  try {
    const lists = (accLists || []).slice(0, 80); let n = 0;
    for (const p of lists) {
      const bid = p.browseId || 'VL' + p.listId; n++; SY.prog = `${n}/${lists.length}`; syncLabel();
      const c = lib.ytc && lib.ytc[bid];
      if (!force && c && Date.now() - c.at < 10 * 60e3) continue;
      const d = await pulse.ytm.browse(bid).catch(() => null);
      if (!d || d.error) continue;
      cacheList(bid, d); if (!d.header || !d.header.title) lib.ytc[bid].title = p.name;
      autoDl(bid);
    }
    SY.at = lib.syncAt = Date.now(); save();
  } catch (e) { SY.err = 'Синхронизация не удалась'; }
  finally { SY.busy = false; SY.prog = ''; syncLabel(); }
}
function autoDl(bid) {
  const c = lib.ytc && lib.ytc[bid]; if (!c) return;
  if (!(S().sync.autoDlAll || (lib.autoDl || []).includes(bid))) return;
  const need = c.tracks.filter((t) => !off[t.id] && !(dl[t.id] && /queued|downloading/.test(dl[t.id].status)));
  if (need.length) download(need);
}
function scheduleSync() {
  clearInterval(SY.timer); const m = +S().sync.interval || 0;
  if (m > 0) SY.timer = setInterval(() => syncAll(false), m * 60e3);
}
// ---------- создание плейлиста ----------
function newPlaylistModal(tracks = []) {
  // 2.0.2: треки Apple Music / Spotify в плейлист YouTube Music не добавить — только на устройство
  const ytOk = !!account && online() && !tracks.some((t) => isSvcId(t.id)||t.id?.startsWith('local-')), toYt = ytOk && S().sync.createInYtm;
  modal(`<h2>Новый плейлист</h2><p>${tracks.length ? `Добавится ${tr(tracks.length)}. ` : ''}${ytOk ? 'Плейлист появится в YouTube Music на всех устройствах и будет доступен в Pulse офлайн.' : account ? 'Нет интернета — плейлист создастся на устройстве, позже можно загрузить в YouTube Music.' : 'Войди в YouTube Music, чтобы плейлисты создавались в аккаунте.'}</p>
    <input class="inp" id="plName" placeholder="Название" value="Новый плейлист">
    <textarea class="field" id="plDesc" placeholder="Описание (необязательно)" style="min-height:60px;font-family:inherit"></textarea>
    <div class="pl-opts"><span>Где создать</span><div class="seg" id="plWhere">${[['ytm', 'YouTube Music', !ytOk], ['local', 'На устройстве', false]].map(([v, n, dis]) => `<button data-plw="${v}" class="${(toYt ? 'ytm' : 'local') === v ? 'on' : ''}" ${dis ? 'disabled' : ''}>${ico(v === 'ytm' ? 'cloud' : 'library')}${n}</button>`).join('')}</div></div>
    <div class="pl-opts" id="plPrivBox" style="${toYt ? '' : 'display:none'}"><span>Доступ</span><div class="seg" id="plPriv">${[['PRIVATE', 'Только я'], ['UNLISTED', 'По ссылке'], ['PUBLIC', 'Все']].map(([v, n], i) => `<button data-plp="${v}" class="${i ? '' : 'on'}">${n}</button>`).join('')}</div></div>
    <div class="mrow"><button class="btn" data-act="closeModal">Отмена</button><button class="btn w" id="plCreate">${ico('plus')}Создать</button></div>`);
  const box = $('modalBox'); let where = toYt ? 'ytm' : 'local', priv = 'PRIVATE';
  box.querySelectorAll('[data-plw]').forEach((b) => (b.onclick = () => { where = b.dataset.plw; box.querySelectorAll('[data-plw]').forEach((x) => x.classList.toggle('on', x === b)); $('plPrivBox').style.display = where === 'ytm' ? '' : 'none'; }));
  box.querySelectorAll('[data-plp]').forEach((b) => (b.onclick = () => { priv = b.dataset.plp; box.querySelectorAll('[data-plp]').forEach((x) => x.classList.toggle('on', x === b)); }));
  setTimeout(() => { $('plName').focus(); $('plName').select(); }, 40);
  $('plName').onkeydown = (e) => { if (e.key === 'Enter') $('plCreate').click(); };
  $('plCreate').onclick = async () => {
    const name = $('plName').value.trim() || 'Новый плейлист', desc = $('plDesc').value.trim();
    if (where === 'ytm') {
      $('plCreate').disabled = true; toast('Создаю в YouTube Music…', 'cloud');
      const r = await pulse.ytm.createPlaylist(name, desc, priv, tracks.map((t) => t.id)).catch((e) => ({ error: String(e) }));
      if (!r || r.error) { $('plCreate').disabled = false; return toast('YouTube Music не создал плейлист: ' + (r ? r.error : 'нет ответа')); }
      closeModal(); await refreshAccount(); cache.delete('b:' + r.browseId);
      toast(`Плейлист «${name}» создан в YouTube Music`, 'cloud'); goBrowse(r.browseId); return;
    }
    lib.playlists.push({ id: Date.now().toString(36), name, desc, tracks: tracks.map(slim) }); save(); renderSide(); closeModal();
    toast(`Плейлист «${name}» создан`, 'plus'); go({ r: 'local', id: lib.playlists[lib.playlists.length - 1].id });
  };
}
// ---------- «Добавить в плейлист» ----------
async function addToModal(tracks) {
  tracks = [].concat(tracks).filter(Boolean); if (!tracks.length) return;
  const locals = lib.playlists.filter((p) => p.id !== MINE);
  const acct = account && !tracks.some((t) => isSvcId(t.id)||t.id?.startsWith('local-')) ? account : null; // 2.0.2: треки сервисов — только в плейлисты на устройстве
  const draw = (yt, loading) => modal(`<h2>Добавить в плейлист</h2><p>${tracks.length > 1 ? tr(tracks.length) : esc(tracks[0].title)}</p>
    <button class="opt" data-addnew>${ico('plus')}<div><b>Новый плейлист</b><span>${acct ? 'Создать в YouTube Music или на устройстве' : 'Создать на устройстве'}</span></div></button>
    ${acct ? `<div class="pl-h">${ico('cloud')}YouTube Music</div>${loading ? loadingHtml : !online() ? '<p>Нет интернета</p>' : (yt || []).length ? yt.map((p, i) => `<button class="pl-it" data-addyt="${i}" ${p.has ? 'disabled' : ''}>${ico(p.has ? 'check' : 'list')}<span>${esc(p.title)}</span>${p.has ? '<em>уже есть</em>' : ''}</button>`).join('') : '<p>Нет своих плейлистов</p>'}` : ''}
    ${locals.length ? `<div class="pl-h">${ico('library')}На устройстве</div>${locals.map((p, i) => `<button class="pl-it" data-addloc="${i}">${ico('list')}<span>${esc(p.name)}</span><em>${tr(p.tracks.length)}</em></button>`).join('')}` : ''}`);
  const bind = (yt) => {
    const box = $('modalBox');
    box.querySelector('[data-addnew]').onclick = () => newPlaylistModal(tracks);
    box.querySelectorAll('[data-addyt]').forEach((b) => (b.onclick = async () => { const p = yt[+b.dataset.addyt]; closeModal(); await ytmAdd(p.playlistId, tracks, p.title); }));
    box.querySelectorAll('[data-addloc]').forEach((b) => (b.onclick = () => { const p = locals[+b.dataset.addloc]; let n = 0; tracks.forEach((t) => { if (!p.tracks.some((x) => x.id === t.id)) { p.tracks.push(slim(t)); n++; } }); save(); renderSide(); closeModal(); toast(n ? `Добавлено в «${p.name}»` : 'Уже в плейлисте', 'plus'); if (route().r === 'local' && route().id === p.id) renderRoute(true); }));
  };
  draw(null, !!acct && online()); bind([]);
  if (acct && online()) { const r = await pulse.ytm.addToOptions(tracks.map((t) => t.id)).catch(() => null); if (!$('modal').classList.contains('show')) return; const yt = Array.isArray(r) ? r : []; draw(yt, false); bind(yt); }
}
async function ytmAdd(pid, tracks, title) {
  if (!online()) return toast('Нет интернета');
  const r = await pulse.ytm.addToPlaylist(pid, tracks.map((t) => t.id)).catch((e) => ({ error: String(e) }));
  if (!r || r.error) return toast('Не удалось добавить: ' + (r ? r.error : 'нет ответа'));
  const bid = 'VL' + pid.replace(/^VL/, ''); cache.delete('b:' + bid);
  const c = lib.ytc && lib.ytc[bid]; if (c) { tracks.forEach((t) => { if (!c.tracks.some((x) => x.id === t.id)) c.tracks.push(slim(t)); }); save(); }
  toast(`Добавлено в «${title || 'плейлист'}» в YouTube Music`, 'cloud');
  if (route().r === 'browse' && route().id === bid) renderRoute(true);
  setTimeout(() => pulse.ytm.browse(bid).then((d) => { if (d && !d.error) { cacheList(bid, d); save(); autoDl(bid); } }), 1500);
}
async function ytmRemove(bid, t) {
  if (!online()) return toast('Нет интернета');
  const r = await pulse.ytm.removeFromPlaylist(bid, [{ id: t.id, setVid: t.setVid }]).catch((e) => ({ error: String(e) }));
  if (!r || r.error) return toast('Не удалось убрать: ' + (r ? r.error : ''));
  cache.delete('b:' + bid); const c = lib.ytc && lib.ytc[bid]; if (c) { c.tracks = c.tracks.filter((x) => x.id !== t.id); save(); }
  toast('Убрано из плейлиста', 'x'); renderRoute(true);
}
async function uploadLocal(id) {
  if(lib.playlists.find(p=>p.id===id)?.tracks.some(t=>t.id.startsWith('local-')))return toast('Локальные файлы можно добавлять только в плейлисты на устройстве');
  const p = lib.playlists.find((x) => x.id === id); if (!p) return;
  if (!account) return openLogin(); if (!online()) return toast('Нет интернета');
  toast('Загружаю в YouTube Music…', 'cloud');
  const r = await pulse.ytm.createPlaylist(p.name, p.desc || 'Создано в Pulse', 'PRIVATE', p.tracks.map((t) => t.id)).catch((e) => ({ error: String(e) }));
  if (!r || r.error) return toast('Не удалось: ' + (r ? r.error : 'нет ответа'));
  p.browseId = r.browseId; p.synced = true; save(); await refreshAccount();
  if (confirm(`«${p.name}» теперь в YouTube Music. Убрать локальную копию, чтобы не было дубля?`)) { lib.playlists = lib.playlists.filter((x) => x !== p); save(); renderSide(); goBrowse(r.browseId); }
  else renderRoute(true);
  toast('Плейлист загружен в YouTube Music', 'cloud');
}
function playlistMenu(bid, d, x, y) {
  const c = lib.ytc && lib.ytc[bid], name = (d.header || {}).title || (c || {}).title || 'Плейлист', pid = bid.replace(/^VL/, '');
  const items = [];
  if (d.editable) {
    items.push(['edit', 'Переименовать', async () => { const n = prompt('Новое название', name); if (!n || n === name) return; const r = await pulse.ytm.renamePlaylist(pid, n); if (r && r.error) return toast('Ошибка: ' + r.error); cache.delete('b:' + bid); await refreshAccount(); renderRoute(true); toast('Переименовано', 'edit'); }]);
    items.push(['trash', 'Удалить из YouTube Music', async () => { if (!confirm(`Удалить «${name}» из YouTube Music насовсем?`)) return; const r = await pulse.ytm.deletePlaylist(pid); if (r && r.error) return toast('Ошибка: ' + r.error); if (lib.ytc) delete lib.ytc[bid]; save(); await refreshAccount(); go({ r: 'library', tab: 'pl' }); toast('Плейлист удалён', 'trash'); }]);
  }
  items.push(['link', 'Копировать ссылку', () => copyText(`https://music.youtube.com/playlist?list=${encodeURIComponent(pid)}`)]);
  showMenu(x, y, items);
}
$('btnNewPl').onclick = () => newPlaylistModal([]);
document.addEventListener('click', (e) => { if (!e.target.closest || !e.target.closest('#syncSt')) return; if (!account) return openLogin(); toast('Синхронизирую плейлисты…', 'sync'); syncAll(true); });
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-autodl],[data-plmenu],[data-upload],[data-addto],[data-newpl]'); if (!el) return; e.stopPropagation();
  if (el.dataset.autodl) { const b = el.dataset.autodl; lib.autoDl = lib.autoDl || []; const on = !lib.autoDl.includes(b); lib.autoDl = on ? lib.autoDl.concat(b) : lib.autoDl.filter((x) => x !== b); save(); if (on) { autoDl(b); toast('Новые треки будут скачиваться автоматически', 'download'); } el.classList.toggle('on', on); return; }
  if (el.dataset.plmenu) { const k = got(el.dataset.plmenu); const r = el.getBoundingClientRect(); if (k) playlistMenu(k.id, k.d, r.left, r.bottom + 6); return; }
  if (el.dataset.upload) return uploadLocal(el.dataset.upload);
  if (el.dataset.addto) { const L = got(el.dataset.addto); if (L) addToModal(L.tracks); return; }
  if (el.dataset.newpl != null) return newPlaylistModal([]);
}, true);
window.addEventListener('online', () => setTimeout(() => syncAll(false), 4000));
