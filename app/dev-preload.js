'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('pulseDev',Object.freeze({
 request:action=>ipcRenderer.invoke('dev:request',action),
 copy:text=>ipcRenderer.invoke('dev:copy',text),close:()=>ipcRenderer.send('dev:close')
}));
