// Localized tray captions. No audio or window-lifecycle changes.
module.exports=function({app,ipcMain,Menu,getTray,readStore}){
 let last=null;
 const japanese={'Регулятор Pulse':'Pulse の音量','Закрепить регулятор':'音量アイランドを固定','Открыть Pulse':'Pulse を開く','Виджет вкл/выкл':'ウィジェットの切り替え','Музыкальные обои вкл/выкл':'音楽壁紙の切り替え','Play / Pause':'再生 / 一時停止','Следующий':'次の曲','Предыдущий':'前の曲','Моя волна':'マイウェーブ','Выход':'終了'};
 const ukrainian={'Регулятор Pulse':'Регулятор Pulse','Закрепить регулятор':'Закріпити регулятор','Открыть Pulse':'Відкрити Pulse','Виджет вкл/выкл':'Увімкнути/вимкнути віджет','Музыкальные обои вкл/выкл':'Увімкнути/вимкнути музичні шпалери','Play / Pause':'Відтворити / Пауза','Следующий':'Наступний трек','Предыдущий':'Попередній трек','Моя волна':'Моя хвиля','Выход':'Вихід'};
 const labels={"Открыть Pulse":"Open Pulse","Виджет вкл/выкл":"Toggle widget","Музыкальные обои вкл/выкл":"Toggle music wallpaper","Play / Pause":"Play / Pause","Следующий":"Next track","Предыдущий":"Previous track","Моя волна":"My Wave","Выход":"Quit"};
 function refresh(){const tray=getTray();if(!tray)return;const language=(['en','ru','ja','uk'].includes(readStore().library?.settings?.app?.language)?readStore().library.settings.app.language:'en');if(last===language)return;last=language;const menu=tray.__pulseMenu;if(!menu)return;for(const item of menu.items){if(!item.__pulseRussian)item.__pulseRussian=item.label;item.label=language==='ru'?item.__pulseRussian:((language==='uk'?ukrainian:language==='ja'?japanese:labels)[item.__pulseRussian]||item.__pulseRussian);}tray.setContextMenu(menu);}
 app.on?.('pulse:tray-ready',()=>{last=null;refresh();});
 app.whenReady().then(()=>setTimeout(refresh,0));ipcMain.on('store:set',()=>setTimeout(refresh,0));
};
