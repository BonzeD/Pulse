'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const M=require('../renderer/setup-model');
test('new profiles only; upgrades, resets, skipped/completed and read errors stay untouched',()=>{
 for(const s of [null,undefined,{}])assert.equal(M.classify(s),'new');
 for(const s of [{settings:{}},{settings:{app:{language:'ja'}}},{known:{a:{}}},{queue:{tracks:[]}},{_m194:1}])assert.equal(M.classify(s),'existing');
 for(const status of ['pending','complete','skipped','existing'])assert.equal(M.classify({onboarding:{version:1,status}}),status);
 assert.equal(M.classify(null,true),'unavailable');assert.equal(M.classify({onboarding:{version:1,status:'pending'}},true),'unavailable');
});
test('wizard edits only explicit allow-listed values, never data or credentials',()=>{
 const input={'app.language':'ru','app.client':'ad','perf.fps':60,'perf.gpu':false,'perf.dpr':100,'look.anim':'false','account.token':'secret','__proto__.polluted':true,known:{secret:true}};
 assert.deepEqual(M.validate(input),{'app.language':'ru','app.client':'ad','perf.fps':60,'perf.gpu':false});
 const settings={app:{language:'en',client:'yt'},perf:{fps:60,gpu:true},look:{anim:true}},before=JSON.stringify(settings),p=M.patch(settings,input);
 assert.equal(JSON.stringify(settings),before);assert.equal(p.length,3);assert.ok(p.every(c=>!['known','account.token'].includes(c.p)));assert.equal({}.polluted,undefined);
});
test('current graphics round trips, presets are explicit and do not mutate defaults',()=>{
 const settings={app:{language:'ja',client:'sp',start:'downloads',close:'tray'},perf:{mode:'high',fps:144,dpr:2,gpu:false,bgSlow:false,autoLite:false},look:{anim:false,splash:false}},d=M.draft(settings);assert.equal(M.patch(settings,d).length,0);
 const before=JSON.stringify(settings);M.patch(settings,{...d,...M.presets.eco});assert.equal(JSON.stringify(settings),before);assert.equal(d['perf.fps'],144);assert.equal(M.presets.balanced['perf.fps'],60);
});
test('renderer has distinct left/right gestures; no eval, secret export or destructive debug shortcuts',()=>{
 const s=fs.readFileSync('renderer/setup-debug.js','utf8'),p=fs.readFileSync('renderer/prism-live.js','utf8');
 assert.match(s,/addEventListener\('contextmenu'/);assert.match(s,/\+\+rights===5/);assert.match(s,/now-last>450/);assert.match(p,/addEventListener\('click'/);assert.match(p,/e.button>0/);
 assert.doesNotMatch(s,/\beval\(|new Function|factoryReset\(|logout\(|removeDownload\(|JSON.stringify\(lib/);assert.match(s,/pulse.flushLibrary\(lib\)!==true/);assert.match(s,/setP\(c.p,c.before\)/);assert.match(s,/getLibrary\(\)/);
});
test('cover colour is decoded once via existing palette; no per-frame image decode or global performance downgrade',()=>{
 const p=fs.readFileSync('renderer/prism-live.js','utf8'),a=fs.readFileSync('renderer/app.js','utf8'),css=fs.readFileSync('renderer/splash.css','utf8');
 assert.ok(a.indexOf('PulsePrism?.setCoverPalette(p)')<a.indexOf('p = fixedPalette() || p'));
 assert.match(p,/function setCoverPalette\(p\)/);assert.doesNotMatch(p,/new Image|setInterval/);assert.match(css,/spCoverFlow 12s/);assert.match(css,/forced-colors:active/);assert.match(p,/dblclick/);
});
test('new inverse captures only this change, retaining every older baseline unchanged',()=>{
 const manifest=require('./setup-debug-approved.json'),inverse=require('./setup-debug-original.cjs');for(const [file,m]of Object.entries(manifest)){const s=fs.readFileSync(file);assert.equal(crypto.createHash('sha256').update(s).digest('hex'),m.sha256,file);assert.equal(crypto.createHash('sha256').update(inverse(file,s)).digest('hex'),m.originalSha256,file);}
});
