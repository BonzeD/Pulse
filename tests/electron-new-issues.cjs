// Native Electron IPC/clipboard integration; no real account or user profile.
const {app,BrowserWindow,session,clipboard}=require('electron'),fs=require('fs'),os=require('os'),path=require('path'),assert=require('node:assert/strict');
const data=fs.mkdtempSync(path.join(os.tmpdir(),'pulse-clipboard-audit-'));app.setPath('userData',data);app.disableHardwareAcceleration();
const timeout=setTimeout(()=>{console.error('Native clipboard test timeout');app.exit(1);},45000);
app.whenReady().then(()=>{
 session.defaultSession.webRequest.onBeforeRequest((d,cb)=>cb({cancel:!/^http:\/\/(127\.0\.0\.1|widget\.localhost|wall\.localhost):\d+\//.test(d.url)&&!d.url.startsWith('data:')}));
 setTimeout(async()=>{try{
  const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('/index.html'));assert.ok(w);const wc=w.webContents;
  if(wc.isLoadingMainFrame())await new Promise(r=>wc.once('did-finish-load',r));
  assert.equal(await wc.executeJavaScript('pulse.version()'),'1.0.0');
  const result=await wc.executeJavaScript("pulse.copyText('https://music.youtube.com/watch?v=abcdefghijk')");assert.equal(result.ok,true);assert.equal(clipboard.readText(),'https://music.youtube.com/watch?v=abcdefghijk');
  assert.ok((await wc.executeJavaScript("pulse.copyText(null)")).error);assert.equal(clipboard.readText(),'https://music.youtube.com/watch?v=abcdefghijk');
  const widget=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('/widget.html'));assert.ok(widget);assert.equal(await widget.webContents.executeJavaScript("pulse.copyText('forbidden').then(()=>false,()=>true)"),true);
  assert.equal(clipboard.readText(),'https://music.youtube.com/watch?v=abcdefghijk');
  console.log('PASS actual Electron main/preload/native clipboard; invalid text and widget IPC blocked; runtime '+process.versions.electron);clearTimeout(timeout);app.exit(0);
 }catch(e){console.error(e);clearTimeout(timeout);app.exit(1);}},6000);
});
require('../main');
