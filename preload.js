const { contextBridge, ipcRenderer, webFrame } = require('electron');
contextBridge.exposeInMainWorld('pulse', {
  spicy: { lyrics: (t) => ipcRenderer.invoke('spicy:lyrics', t) }, // 2.0.4: Spicy Lyrics
  media: {
    list:()=>ipcRenderer.invoke('media:list'), import:()=>ipcRenderer.invoke('media:import'),
    playback:(id,convert=false)=>ipcRenderer.invoke('media:playback',id,convert),
    inspect:(id,known)=>ipcRenderer.invoke('media:inspect',id,known), pickCover:()=>ipcRenderer.invoke('media:cover'),
    update:(id,fields,cover)=>ipcRenderer.invoke('media:update',id,fields,cover), reset:id=>ipcRenderer.invoke('media:reset',id),
    remove:id=>ipcRenderer.invoke('media:remove',id), export:(id,format,fields,cover)=>ipcRenderer.invoke('media:export',id,format,fields,cover),
    onProgress:fn=>{const cb=(_e,p)=>fn(p);ipcRenderer.on('media:progress',cb);return()=>ipcRenderer.removeListener('media:progress',cb);},
  },
  copyText: text => ipcRenderer.invoke('clipboard:write', text),
  getLibrary: () => ipcRenderer.invoke('store:get'),
  saveLibrary: (lib) => ipcRenderer.send('store:set', lib),
  flushLibrary: (lib) => ipcRenderer.sendSync('store:flush', lib),
  playlist: (listId) => ipcRenderer.invoke('yt:playlist', listId),
  offlineList: () => ipcRenderer.invoke('dl:list'),
  download: (ids) => ipcRenderer.send('dl:start', ids),
  cancelDownload: (id) => ipcRenderer.send('dl:cancel', id),
  removeDownload: (id) => ipcRenderer.invoke('dl:remove', id),
  onDownload: (fn) => ipcRenderer.on('dl', (_e, ev) => fn(ev)),
  lyrics: (q) => ipcRenderer.invoke('lyrics:get', q),
  lyricsSearch: (q) => ipcRenderer.invoke('lyrics:search', q),
  plugins: { list: () => ipcRenderer.invoke('plugins:list'), open: () => ipcRenderer.send('plugins:open') },
  resolve: (id) => ipcRenderer.invoke('yt:resolve', id),
  visualizerTap: (options) => ipcRenderer.invoke('visualizer:tap', options),
  prefetch: (id) => ipcRenderer.invoke('yt:prefetch', id),
  search: (q) => ipcRenderer.invoke('yt:search', q),
  mix: (v, list) => ipcRenderer.invoke('yt:mix', v, list),
  video: (id) => ipcRenderer.invoke('yt:video', id),
  account: {
    login: (mode) => ipcRenderer.invoke('acc:login', mode), browsers: () => ipcRenderer.invoke('acc:browsers'), viaBrowser: (b, site) => ipcRenderer.invoke('acc:viaBrowser', b, site), cancelExt: () => ipcRenderer.invoke('acc:cancelExt'), logout: () => ipcRenderer.invoke('acc:logout'),
    browser: (b, site) => ipcRenderer.invoke('acc:browser', b, site),
    info: () => ipcRenderer.invoke('acc:info'), playlists: () => ipcRenderer.invoke('acc:playlists'), tracks: (id) => ipcRenderer.invoke('acc:tracks', id)
  },
  // 2.0.2: клиенты Apple Music / Spotify
  svc: {
    setClient: (c, o) => ipcRenderer.invoke('cl:set', c, o), login: (s) => ipcRenderer.invoke('svc:login', s), logout: (s) => ipcRenderer.invoke('svc:logout', s),
    status: () => ipcRenderer.invoke('svc:status'), playlists: (s) => ipcRenderer.invoke('svc:playlists', s), playlistArtwork: (id) => ipcRenderer.invoke('svc:playlist-art', id), link: (id) => ipcRenderer.invoke('svc:link', id)
  },
  ytm: {
    feed: (id, p) => ipcRenderer.invoke('ytm:feed', id, p), browse: (id, p) => ipcRenderer.invoke('ytm:browse', id, p), search: (q, f) => ipcRenderer.invoke('ytm:search', q, f),
    suggest: (q) => ipcRenderer.invoke('ytm:suggest', q), next: (v, l) => ipcRenderer.invoke('ytm:next', v, l), related: (id) => ipcRenderer.invoke('ytm:related', id),
    lyrics: (id) => ipcRenderer.invoke('ytm:lyrics', id), like: (id, on) => ipcRenderer.invoke('ytm:like', id, on), dislike: (id, on) => ipcRenderer.invoke('ytm:dislike', id, on), subscribe: (id, on) => ipcRenderer.invoke('ytm:subscribe', id, on),
    addToOptions: (ids) => ipcRenderer.invoke('ytm:addTo', ids), createPlaylist: (t, d, p, ids) => ipcRenderer.invoke('ytm:plCreate', t, d, p, ids),
    addToPlaylist: (pid, ids) => ipcRenderer.invoke('ytm:plAdd', pid, ids), removeFromPlaylist: (pid, items) => ipcRenderer.invoke('ytm:plRemove', pid, items),
    deletePlaylist: (pid) => ipcRenderer.invoke('ytm:plDelete', pid), renamePlaylist: (pid, n) => ipcRenderer.invoke('ytm:plRename', pid, n)
  },
  widgetConfig: (c) => ipcRenderer.send('widget:cfg', c),
  sendLyrics: (l) => ipcRenderer.send('lyrics', l),
  onLyrics: (fn) => ipcRenderer.on('lyrics', (_e, l) => fn(l)),
  onWidgetVisibility: (fn) => ipcRenderer.on('widget-visible', (_e, v) => fn(v === true)),
  onWidgetConfig: (fn) => ipcRenderer.on('wcfg', (_e, c) => fn(c)),
  closeMode: (m) => ipcRenderer.send('app:closeMode', m),
  zoom: (f) => webFrame.setZoomFactor(Math.max(0.6, Math.min(1.6, f || 1))),
  version: () => ipcRenderer.invoke('app:version'),
  meta: (url) => ipcRenderer.invoke('yt:meta', url),
  sendState: (st) => ipcRenderer.send('state', st),
  command: (name, arg) => ipcRenderer.send('cmd', name, arg),
  win: (action) => ipcRenderer.send('win', action),
  onCommand: (fn) => ipcRenderer.on('cmd', (_e, n, a) => fn(n, a)),
  onState: (fn) => ipcRenderer.on('state', (_e, s) => fn(s)),
  onMaximized: (fn) => ipcRenderer.on('win:maximized', (_e, v) => fn(v)),
  onFullscreen: (fn) => ipcRenderer.on('win:fs', (_e, v) => fn(v)),
  // 1.9
  material: (m) => ipcRenderer.send('win:material', m),
  glassMode: (c) => ipcRenderer.invoke('win:glassMode', c), relaunch: () => ipcRenderer.send('app:relaunch'), materialOk: () => ipcRenderer.invoke('win:materialOk'),
  openUrl: (u) => ipcRenderer.send('app:openUrl', u),
  // 1.9.6: полный сброс (настройки или все данные) с перезапуском
  factoryReset: (o) => ipcRenderer.invoke('app:reset', o),
  widgetSnap: (c) => ipcRenderer.send('widget:snap', c),
  wall: {
    enable: (c) => ipcRenderer.invoke('wall:enable', c), disable: () => ipcRenderer.invoke('wall:disable'), displays: () => ipcRenderer.invoke('wall:displays'),
    frame: (d) => ipcRenderer.send('wall:frame', d), meta: (d) => ipcRenderer.send('wall:meta', d),
    onFrame: (fn) => ipcRenderer.on('wall:frame', (_e, d) => fn(d)), onMeta: (fn) => ipcRenderer.on('wall:meta', (_e, d) => fn(d)),
    onPointer: (fn) => ipcRenderer.on('wall:pointer', (_e, d) => fn(d)), act: (n, a) => ipcRenderer.send('wall:act', n, a)
  },
  discord: { config: (on, id) => ipcRenderer.send('discord:cfg', on, id), set: (a) => ipcRenderer.send('discord:set', a), status: () => ipcRenderer.invoke('discord:status'), onStatus: (fn) => ipcRenderer.on('discord:status', (_e, s) => fn(s)) },
  accounts: {
    // 2.0.3: s — сервис ('yt' | 'sp' | 'am'), у каждого свой список аккаунтов
    list: (s) => ipcRenderer.invoke('accm:list', s), snapshot: (s) => ipcRenderer.invoke('accm:snapshot', s), switchTo: (id, s) => ipcRenderer.invoke('accm:switch', id, s),
    addNew: (s) => ipcRenderer.invoke('accm:add', s), restore: (s) => ipcRenderer.invoke('accm:restore', s), remove: (id, s) => ipcRenderer.invoke('accm:remove', id, s), rename: (id, n, s) => ipcRenderer.invoke('accm:rename', id, n, s)
  }
});
