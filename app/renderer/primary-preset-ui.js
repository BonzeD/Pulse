'use strict';
// Full settings include startup-only AudioContext latency and client selection.
// Flush atomically, then relaunch rather than leaving half of the app on old settings.
function applyPrimaryPreset() {
  if(window.__pulsePresetApplying)return false;
  if(!confirm('Применить основной пресет?\n\nВсе настройки заменятся настройками автора. Треки, плейлисты, аккаунты и ключи доступа сохранятся.\nPulse перезапустится.'))return false;
  if(typeof pulse.flushLibrary!=='function'||typeof pulse.relaunch!=='function'){
    toast('Не удалось применить пресет: сохранение или перезапуск недоступны', 'alert');return false;
  }
  const keys=['settings','vizStyle','mode','tab','mini','cfgActive'];
  const previous=keys.map(key=>[key,Object.hasOwn(lib,key),lib[key]]);
  const restore=()=>{for(const [key,exists,value]of previous){if(exists)lib[key]=value;else delete lib[key];}};
  window.__pulsePresetApplying=true;
  clearTimeout(saveT);
  if(typeof cfgAutoT!=='undefined')clearTimeout(cfgAutoT);
  try {
    PulsePrimaryPreset.replace(lib,LEGACY_SETTINGS);
    if(pulse.flushLibrary(lib)!==true)throw Error('Не удалось сохранить настройки');
  } catch(e) {
    restore();window.__pulsePresetApplying=false;
    toast('Не удалось применить пресет: '+(e.message||'ошибка сохранения'), 'alert');return false;
  }
  // No delayed unload save may race with the already committed preset.
  window.__pulseResetting=true;
  try{pulse.relaunch();}catch(e){window.__pulseResetting=false;window.__pulsePresetApplying=false;toast('Пресет сохранён. Перезапусти Pulse, чтобы применить все настройки', 'settings');return true;}
  toast('Основной пресет сохранён. Перезапускаю Pulse…', 'settings');return true;
}
