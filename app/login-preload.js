// Панель окна входа Google: кнопки «назад», «вперёд», «обновить», «заново»
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('bar', {
  cmd: (c) => ipcRenderer.send('lb:cmd', c),
  onState: (fn) => ipcRenderer.on('lb:state', (_e, s) => fn(s))
});
