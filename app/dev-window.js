'use strict';
/* Dedicated, sandboxed developer companion. It never receives the app preload. */
module.exports=function createDeveloper({app,BrowserWindow,ipcMain,clipboard,path,safety,getMain,getPort}){
 let win=null,pending=new Map(),sequence=0;
 const commands=new Set(['snapshot','checks','frames','cancelFrames','outlines','guides','inspect','setup','prism','settings']);
 function valid(e,w,url){return !!w&&!w.isDestroyed()&&e.sender===w.webContents&&e.senderFrame===w.webContents.mainFrame&&e.senderFrame.url===url;}
 const url=()=>`http://127.0.0.1:${getPort()}/dev.html`;
 function main(e){const w=getMain();return !!w&&!w.isDestroyed()&&e.sender===w.webContents&&e.senderFrame===w.webContents.mainFrame&&safety.appURL(e.senderFrame.url,getPort())&&new URL(e.senderFrame.url).pathname==='/index.html';}
 function clear(){for(const [,p]of pending){clearTimeout(p.timer);p.resolve({error:'disconnected'});}pending.clear();const w=getMain();if(w&&!w.isDestroyed())w.webContents.send('dev:closed');}
 function open(){
  const parent=getMain();if(!parent||parent.isDestroyed())return false;
  if(win&&!win.isDestroyed()){win.show();win.focus();return true;}
  win=new BrowserWindow({width:920,height:740,minWidth:560,minHeight:480,parent,alwaysOnTop:true,show:false,backgroundColor:'#0b0b0e',title:'Pulse / Developer',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'dev-preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  const created=win;const parentClosed=()=>{if(!created.isDestroyed())created.destroy();};safety.lockNavigation(win.webContents,u=>u===url());win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.once('ready-to-show',()=>{if(win===created){win.show();win.focus();}});win.on('closed',()=>{parent.removeListener('closed',parentClosed);if(win===created){win=null;clear();}});
  win.webContents.on('render-process-gone',clear);
  parent.once('closed',parentClosed);win.loadURL(url());return true;
 }
 ipcMain.handle('dev:open',e=>{if(!main(e))throw Error('Untrusted developer opener');return open();});
 ipcMain.handle('dev:request',async(e,action)=>{
  if(!valid(e,win,url()))throw Error('Untrusted developer window');
  const w=getMain();if(!w||w.isDestroyed())return {error:'disconnected'};
  if(action==='runtime')return {version:app.getVersion(),electron:process.versions.electron,chromium:process.versions.chrome,node:process.versions.node,platform:process.platform,gpu:app.getGPUFeatureStatus(),processes:app.getAppMetrics().map(p=>({type:p.type,cpuPercent:p.cpu.percentCPUUsage,memoryKB:p.memory?.workingSetSize||0}))};
  if(action==='devtools'){w.webContents.openDevTools({mode:'detach',activate:true});return {ok:true};}
  if(action==='screenshot'){const image=await w.webContents.capturePage();clipboard.writeImage(image);return {ok:true,width:image.getSize().width,height:image.getSize().height};}
  if(action==='focus'){w.show();w.focus();return {ok:true};}
  if(!commands.has(action))return {error:'unknown-command'};
  if(pending.size>=8)return {error:'busy'};
  const id=++sequence;return new Promise(resolve=>{const timer=setTimeout(()=>{pending.delete(id);resolve({error:'timeout'});},action==='frames'?8500:5000);pending.set(id,{resolve,timer});w.webContents.send('dev:command',{id,action});});
 });
 ipcMain.on('dev:response',(e,message)=>{if(!main(e)||!message||!Number.isSafeInteger(message.id))return;const p=pending.get(message.id);if(!p)return;let data;try{const json=JSON.stringify(message.data);if(json.length>65536)return;data=JSON.parse(json);}catch{return;}clearTimeout(p.timer);pending.delete(message.id);p.resolve(data);});
 ipcMain.on('dev:inspect',(e,point)=>{if(!main(e)||!win||win.isDestroyed()||!Number.isFinite(point?.x)||!Number.isFinite(point?.y))return;const w=getMain(),size=w.getContentSize();w.webContents.inspectElement(Math.round(Math.max(0,Math.min(size[0],point.x))),Math.round(Math.max(0,Math.min(size[1],point.y))));});
 ipcMain.handle('dev:copy',(e,text)=>{if(!valid(e,win,url())||typeof text!=='string'||text.length>65536)return false;clipboard.writeText(text);return true;});
 ipcMain.on('dev:close',e=>{if(valid(e,win,url()))win.close();});
 app.on('before-quit',()=>{clear();if(win&&!win.isDestroyed())win.destroy();});
 return {open};
};
