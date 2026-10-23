'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(require('node:path').join(__dirname,'..',p),'utf8');
test('preview resources are released after their canvas is removed or replaced',()=>{
 const source=read('renderer/extras.js'),body=source.match(/function pvCleanup\(\)\{[\s\S]*?\n\}/)[0];
 let releases=0;const live={},replacement={},nodes={live,replaced:replacement},instances={live:{cv:live,v:{destroy(){throw Error('live preview destroyed');}}},gone:{cv:{},v:{destroy(){releases++;}}},replaced:{cv:{},v:{destroy(){releases++;}}}};
 const ctx={document:{getElementById:id=>nodes[id]||null},pvInst:instances};vm.runInNewContext(body+';pvCleanup();pvCleanup();',ctx);
 assert.equal(releases,2);assert.deepEqual(Object.keys(instances),['live']);
 assert.match(source,/function extFrame\([^)]*\)\s*\{\s*pvCleanup\(\);/);
});
test('1.0.2 graphics deltas reverse exactly to reviewed historical inputs',()=>{
 const inverse=require('./graphics-102-original.cjs'),manifest=require('./graphics-102-approved.json');
 for(const path of Object.keys(manifest)){const source=read(path);assert.notEqual(inverse(path,source),source,path);assert.equal(inverse(path,inverse(path,source)),inverse(path,source));}
});
test('panels keep one real DOM, bounded cleanup and no new frame loop',()=>{
 const s=read('renderer/surface-motion.js');assert.match(s,/function panel\(/);assert.match(s,/el\.inert=true/);assert.match(s,/if\(p\.clear&&!el\.classList\.contains\('on'\)\)el\.replaceChildren/);assert.doesNotMatch(s,/requestAnimationFrame|setInterval|cloneNode|will-change/);
 const css=read('renderer/motion.css').split('/* 1.0.2:')[1];assert.match(css,/@starting-style/);assert.match(css,/allow-discrete/);assert.doesNotMatch(css,/filter:|transition:all|will-change/);
});
test('2D audit retains FPS settings, full sharp DPR and uncapped star connections',()=>{
 const s=read('renderer/viz.js');assert.match(s,/heads\.length\s*<\s*cols\*rows/);assert.match(s,/WEBGL_lose_context/);assert.match(s,/if\(cv\)cv\.style\.visibility=''/);assert.match(s,/layer\.width=1;layer\.height=1/);
 assert.match(read('renderer/app.js'),/const visualCenter\s*=/);
});
