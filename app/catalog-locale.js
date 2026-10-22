// Catalog language follows the UI, never the account's country/storefront.
'use strict';
const tags={en:'en-US',ru:'ru-RU',ja:'ja-JP',uk:'uk-UA'};
let language='en';
const normalize=v=>Object.hasOwn(tags,v)?v:'en';
function set(v){language=normalize(v);return language;}
function current(){const tag=tags[language];return {language,tag,accept:tag+','+language+';q=0.9'};}
function appleURL(pathq){
 const u=new URL(pathq,'https://amp-api.music.apple.com');
 // Do not alter lyric requests, writes, signed URLs, or an explicit language.
 if(u.origin==='https://amp-api.music.apple.com'&&!u.searchParams.has('l')&&
   (/^\/v1\/catalog\//.test(u.pathname)&&! /\/lyrics(?:\/|$)/.test(u.pathname)||/^\/v1\/me\/(recommendations|recent)(?:\/|$)/.test(u.pathname)))u.searchParams.set('l',current().tag);
 return u.href;
}
module.exports={set,current,normalize,appleURL};
