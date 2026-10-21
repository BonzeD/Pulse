// 1.0.1: real Electron boot + preload/IPC integration. Run with Electron, not node.
const {app,BrowserWindow,session}=require('electron');
const fs=require('fs'),os=require('os'),path=require('path'),assert=require('node:assert/strict');
const data=fs.mkdtempSync(path.join(os.tmpdir(),'pulse-electron-audit-'));
app.setPath('userData',data);app.disableHardwareAcceleration();
const timeout=setTimeout(()=>{console.error('Electron audit timed out');app.exit(1);},60000);
app.on('web-contents-created',(_e,w)=>{w.on('render-process-gone',(_e,d)=>console.log('RENDERER EXIT',w.id,JSON.stringify(d)));w.on('did-fail-load',(_e,c,d,u)=>console.log('LOAD FAILED',w.id,c,d,u));w.on('did-finish-load',()=>console.log('LOADED',w.id,w.getURL()));});
app.whenReady().then(()=>{
 session.defaultSession.webRequest.onBeforeRequest((d,cb)=>cb({cancel:!/^http:\/\/(127\.0\.0\.1|widget\.localhost|wall\.localhost):\d+\//.test(d.url)&&!d.url.startsWith('data:')}));
 setTimeout(async()=>{try{
  const main=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('/index.html'));
  assert.ok(main,'main window exists');const wc=main.webContents;
  if (wc.isLoadingMainFrame()) await new Promise((resolve,reject)=>{ wc.once('did-finish-load',resolve); wc.once('render-process-gone',(_e,d)=>reject(Error('renderer exited: '+d.reason))); });
  console.log('MAIN CHECK',wc.id,wc.getURL(),wc.getOSProcessId());
  const version=await wc.executeJavaScript('pulse.version()');assert.equal(version,'1.0.1');
  const lib=await wc.executeJavaScript('pulse.getLibrary()');assert.ok(lib===null||typeof lib==='object');
  const flushed=await wc.executeJavaScript('pulse.flushLibrary({queue:{tracks:[],idx:-1},settings:{audit:true}})');assert.equal(flushed,true);
  assert.equal(JSON.parse(fs.readFileSync(path.join(data,'library.json'))).library.settings.audit,true);
  await wc.executeJavaScript("lib.__auditPending='flushed-on-unload'; save(); window.dispatchEvent(new Event('beforeunload'));");
  assert.equal(JSON.parse(fs.readFileSync(path.join(data,'library.json'))).library.__auditPending,'flushed-on-unload');
  const widgets=BrowserWindow.getAllWindows().filter(w=>w.webContents.getURL().includes('/widget.html'));assert.equal(widgets.length,1);
  const forbidden=await widgets[0].webContents.executeJavaScript('pulse.getLibrary().then(()=>false,()=>true)');assert.equal(forbidden,true);
  await widgets[0].webContents.executeJavaScript("pulse.command('toggle')");
  await wc.executeJavaScript("location.href='https://navigation-test.invalid/'; void 0");
  await new Promise(r=>setTimeout(r,200)); assert.ok(wc.getURL().includes('/index.html'));
  console.log('Electron boot/preload/main IPC/save/widget restricted IPC passed; runtime='+process.versions.electron);
  clearTimeout(timeout);app.exit(0);
 }catch(e){console.error(e);app.exit(1);}},7000);
});
require('../main');
