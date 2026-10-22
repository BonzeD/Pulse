"use strict";
function parseOwnProfile(j) {
 const resource=j?.resources?.['personal-social-profiles']?.me;
 const identifier=(Array.isArray(j?.data)?j.data:[]).find(x=>x && (x.type==='personal-social-profiles'||x.type==='social-profiles'));
 const row=resource || (identifier?.attributes?identifier:j?.resources?.[identifier?.type]?.[identifier?.id]);
 const a=row?.attributes;
 const name=typeof a?.name==='string'?a.name.trim():'';
 if(!name||name.length>256)return null;
 const artwork=a.artwork?.url;
 const photo=typeof artwork==='string'&&/^https:\/\//.test(artwork)?artwork.replace(/\{w\}/g,'128').replace(/\{h\}/g,'128').replace(/\{f\}/g,'jpg'):null;
 return {name,photo};
}
module.exports={parseOwnProfile};
