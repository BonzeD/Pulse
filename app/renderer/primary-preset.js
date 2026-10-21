// Pulse 1.0.0: author's public preset. No accounts, library, API keys or machine paths.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PulsePrimaryPreset=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const data = {
  "pulse": 1,
  "settings": {
    "chorus": {
      "marks": true,
      "key": true,
      "only": false
    },
    "look": {
      "accent": "auto",
      "color": "#ff2d95",
      "ambient": true,
      "blurAmt": 90,
      "ambBright": 35,
      "scale": 100,
      "anim": true,
      "splash": true,
      "compact": false,
      "beat": true,
      "artShape": "round",
      "react": true,
      "reactAmt": 50,
      "ambAll": true,
      "ambAllOp": 45,
      "tint": 35,
      "artSize": 100
    },
    "ly": {
      "lineFx": "line",
      "kBar": "on",
      "mrPreset": 0,
      "mrReaction": 0.55,
      "mrMorph": true,
      "mrQuality": "ultra",
      "mrFps": 0,
      "mrLyrics": true,
      "mrShowTitle": false,
      "mrShelf": true,
      "mrKeep": false,
      "size": 100,
      "align": "left",
      "glow": true,
      "mode": "words",
      "blur": true,
      "visLine": false,
      "font": "default",
      "weight": 800,
      "color": "accent",
      "colorC": "#ffffff",
      "dimOp": 28,
      "spacing": 128,
      "speed": 70,
      "anim": "pop",
      "backDelay": 4,
      "lag": 0,
      "snap": true,
      "visSize": 100,
      "fill": true,
      "vis": "mineradio",
      "kFont": "app",
      "kSize": 100,
      "kAnim": "blur",
      "kRefl": true,
      "kRipple": 70,
      "kReflQ": "ultra",
      "kGrad": "cover",
      "kGradC1": "#ffffff",
      "kGradC2": "#4d7560",
      "kGradSeed": 0,
      "kParticles": false,
      "kGlow": 100,
      "kGlowCol": "accent",
      "kColor": "white",
      "kBeat": 0,
      "kShake": 0,
      "kChroma": false,
      "kOutline": false,
      "kReflOp": 54,
      "kReflBlur": 36,
      "kPtType": "dust",
      "kPtDens": 100,
      "kBgDim": 32,
      "kLayout": "left",
      "kCover": "right",
      "kCase": "upper",
      "kFit": true,
      "idleFs": false,
      "idleSec": 8,
      "src": "spicy",
      "bgVox": true,
      "svcColors": true,
      "credits": true
    },
    "viz": {
      "neonExperiment": true,
      "directExperiment": true,
      "sens": 100,
      "fps": 60,
      "coverBars": false,
      "tempo": true,
      "smooth": 30,
      "lag": 0,
      "react": 60,
      "fx": {
        "glow": 100,
        "trails": 0,
        "zoom": 30,
        "shake": 0,
        "flash": 0,
        "mirror": "off",
        "hue": 300,
        "thick": 100,
        "density": 100,
        "bass": 100,
        "coverPulse": 100,
        "bgDim": 0
      }
    },
    "ui": {
      "playerPanelWidth": 381,
      "playerBarHidden": false,
      "variant": "full",
      "shell": "panels",
      "barAll": true,
      "setMode": "simple",
      "liquid": false,
      "liquidMat": "acrylic",
      "liquidOp": 35,
      "font": "default",
      "fontSize": 14,
      "radius": 22,
      "bg": "#000000",
      "panel": "#000000",
      "txt": "#ffffff",
      "side": 240,
      "bar": 72,
      "glass": true,
      "glassOp": 10,
      "css": "",
      "hide": {
        "net": false,
        "widget": false,
        "like": false,
        "dislike": false,
        "dl": false,
        "more": false,
        "time": false,
        "dj": false,
        "vol": false,
        "shuffle": false,
        "repeat": false
      }
    },
    "audio": {
      "eqOn": true,
      "preset": "flat",
      "eq": [
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ],
      "preamp": 0,
      "speed": 1,
      "norm": false
    },
    "widget": {
      "calm": true,
      "size": "mini",
      "theme": "glass",
      "opacity": 100,
      "lyrics": true,
      "onTop": true,
      "autoHide": true,
      "onMin": false,
      "cover": true,
      "progress": true,
      "time": true,
      "extra": true,
      "vol": true,
      "radius": 22,
      "blur": 34,
      "scale": 100,
      "lock": false,
      "accent": "cover",
      "color": "#ff2d95",
      "hideIdle": false,
      "eq": true,
      "align": "left",
      "title": true,
      "marquee": false,
      "coverSize": 100,
      "coverShape": "round",
      "coverSide": "left",
      "coverSpin": false,
      "tSize": 100,
      "tColor": "",
      "tWeight": 700,
      "aSize": 100,
      "aColor": "",
      "lSize": 100,
      "lColor": "",
      "ctlScale": 100,
      "iconColor": "",
      "playStyle": "white",
      "playColor": "",
      "progH": 4,
      "progColor": "",
      "bgColor": "",
      "border": true,
      "shadow": true,
      "font": "default",
      "ctlOrder": [
        "like",
        "dislike",
        "shuffle",
        "prev",
        "play",
        "next",
        "repeat",
        "vol"
      ],
      "hideBtns": [],
      "rowsStd": [
        "info",
        "ctl",
        "prog"
      ],
      "rowsLarge": [
        "lyr",
        "prog",
        "ctl"
      ],
      "rowsMini": [
        "info",
        "ctl"
      ],
      "off": {},
      "free": {
        "standard": {}
      }
    },
    "app": {
      "language": "en",
      "start": "home",
      "close": "widget",
      "keepFs": true,
      "client": "yt",
      "amSf": "auto"
    },
    "sync": {
      "createInYtm": true,
      "autoDlAll": false,
      "interval": 15
    },
    "dj": {
      "on": false,
      "auto": false,
      "fade": 8,
      "style": "bass",
      "beat": true,
      "trim": true,
      "keylock": true,
      "iso": [
        0,
        0,
        0
      ],
      "filter": 0,
      "unit": "beats",
      "beats": 16,
      "range": 8,
      "curve": "smooth",
      "phrase": true,
      "glide": true,
      "echo": 0.75,
      "pick": "queue"
    },
    "perf": {
      "mode": "auto",
      "latency": "playback",
      "fps": 144,
      "dpr": 2,
      "bgSlow": true,
      "showFps": false,
      "gpu": true,
      "autoLite": false
    },
    "discord": {
      "on": true,
      "title": true,
      "tpl1": "{title}",
      "tpl2": "{artist}",
      "tplImg": "{album}",
      "pauseText": "Пауза",
      "btnLabel": "Слушать в YouTube Music",
      "btnCustom": false,
      "btnCustomLabel": "",
      "btnCustomUrl": "",
      "artist": true,
      "album": true,
      "cover": true,
      "time": true,
      "timeMode": "bar",
      "paused": "show",
      "buttons": false,
      "btnArtist": false,
      "type": "listen",
      "display": "name",
      "small": true,
      "lyric": true,
      "hideVideo": false,
      "idle": 10,
      "privacy": false
    },
    "wall": {
      "on": false,
      "motion": "off",
      "motionSpeed": 100,
      "style": "same",
      "fps": 30,
      "info": true,
      "infoPos": "bl",
      "infoSize": 100,
      "clock": true,
      "lyrics": true,
      "bg": "cover",
      "dim": 35,
      "display": 0,
      "idle": "calm",
      "glow": true,
      "progress": true,
      "scale": 100,
      "controls": true,
      "lyPos": "bottom",
      "cardOp": 42,
      "lySize": 100,
      "lyColor": "",
      "clockSize": 100,
      "clockPos": "top",
      "infoXY": null,
      "lyXY": null,
      "clockXY": null,
      "likeBtn": true,
      "clockStyle": "thin",
      "clockFont": "segoe",
      "clockSec": false,
      "clock12": false,
      "clockDate": true,
      "clockColor": "",
      "clockPlate": "none",
      "clockPlateOp": 40,
      "cardStyle": "glass",
      "cardRadius": 26,
      "artShape": "rounded",
      "cardFont": "segoe",
      "lyFont": "segoe",
      "lyWeight": 800,
      "lyGlow": true,
      "lyPlate": false
    },
    "studio": {
      "side": "right",
      "width": "normal",
      "look": "auto",
      "stage": "theme",
      "tips": true,
      "shade": true,
      "collapsed": {}
    },
    "cfg": {
      "autoSave": false
    },
    "spicy": {
      "on": false,
      "style": true,
      "stage": true,
      "src": true,
      "ppBg": false,
      "key": "",
      "bg": false,
      "blur": true
    },
    "wave": {
      "mood": "any",
      "char": "fav",
      "lang": "inst",
      "anim": true,
      "animQ": "high",
      "skipDis": true,
      "why": true,
      "keys": true,
      "learnAll": true,
      "hero": true
    },
    "layout": {
      "v": 1,
      "items": {},
      "objects": []
    }
  },
  "vizStyle": "wave",
  "mode": "visual",
  "tab": "lyrics",
  "mini": false
};
  const copy=value=>JSON.parse(JSON.stringify(value));
  const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
  const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
  freeze(data);
  function merge(base,value){
    if(Array.isArray(base))return Array.isArray(value)?copy(value):copy(base);
    if(object(base)){
      if(!Object.keys(base).length)return object(value)?copy(value):copy(base);
      const out={};for(const key of Object.keys(base))out[key]=merge(base[key],object(value)?value[key]:undefined);return out;
    }
    if(base===null)return value===undefined?null:copy(value);
    return typeof value===typeof base?value:base;
  }
  function settings(base){const out=merge(base,data.settings);if(out.spicy)out.spicy.key='';return out;}
  function state(){return {vizStyle:data.vizStyle,mode:data.mode,tab:data.tab,mini:data.mini};}
  function hasSettings(saved){return object(saved)&&object(saved.settings);}
  function initialize(lib,saved,base){
    if(hasSettings(saved))return false;
    lib.settings=settings(base);Object.assign(lib,state());return true;
  }
  function replace(lib,base){
    const key=typeof lib.settings?.spicy?.key==='string'?lib.settings.spicy.key:'';
    lib.settings=settings(base);if(lib.settings.spicy)lib.settings.spicy.key=key;
    Object.assign(lib,state());
    // Applying a factory preset must not silently overwrite an active user config.
    lib.cfgActive=null;
  }
  return Object.freeze({data,settings,state,hasSettings,initialize,replace});
});
