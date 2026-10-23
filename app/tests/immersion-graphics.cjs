const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const s=fs.readFileSync('renderer/graphics/immersion-scene.entry.mjs','utf8')+fs.readFileSync('renderer/graphics/orbital-dawn.mjs','utf8');
test('cinematic renderer is local, clipped, postprocessed and never controls music',()=>{for(const fragment of ["import {Reflector}",'clipBias:.003','UnrealBloomPass','FXAAShader','ACESFilmicToneMapping','CubeUVReflectionMapping'])assert.ok(s.includes(fragment),fragment);assert.doesNotMatch(s,/new Audio|toggle\(|E\.seek|https:\/\//);assert.ok(s.includes('renderer.dispose()'));assert.ok(s.includes('environment.dispose()'));});
test('offline cinema assets and third-party attribution ship with the app',()=>{for(const f of ['2k_earth_daymap.jpg','2k_earth_nightmap.jpg','2k_earth_clouds.jpg','2k_stars_milky_way.jpg','2k_moon.jpg','rock-color.jpg','rock-normal.jpg','asphalt-color.jpg','asphalt-normal.jpg','studio-env.png','THREE-LICENSE.txt','CREDITS.md'])assert.ok(fs.statSync(path.join('renderer/immersion-assets',f)).size>100,f);const c=fs.readFileSync('renderer/immersion-assets/CREDITS.md','utf8');for(const label of ['CC BY','CC0','Solar System Scope','Poly Haven','Three.js'])assert.ok(c.includes(label),label);});
test('manual cinema quality does not silently downgrade to software fallback',()=>{const ui=fs.readFileSync('renderer/immersion.js','utf8'),stage=fs.readFileSync('renderer/lystage.js','utf8');assert.match(ui,/software:scene.software && quality === 'auto'/);assert.match(ui,/quality === 'auto' && slow > 60/);assert.ok(stage.includes('data-scene="quality"'));assert.ok(ui.includes('renderer:scene?.stats?.()'));});
const C=require('../renderer/immersion-core.js');
test('cover color is bounded, deterministic and independent of UI accent settings',()=>{assert.deepEqual(C.coverColor([[255,20,80],[0,255,0]]),[1,20/255,80/255]);assert.deepEqual(C.coverColor([[.1,.5,.9]]),[.1,.5,.9]);for(const p of [null,[],[[NaN,1,2]],[[0,0,0]],'bad']){const c=C.coverColor(p);assert.equal(c.length,3);assert.ok(c.every(x=>Number.isFinite(x)&&x>=0&&x<=1));}});
test('ocean has displaced waves, multiscale normals and bounded rough reflection sampling',()=>{const w=fs.readFileSync('renderer/graphics/ocean-water.mjs','utf8');for(const x of ['swell(',"tex('water-normal.jpg'",'texture2D(uWaterNormal,uv0)','texture2D(uWaterNormal,uv1)','texture2D(uWaterNormal,uv2)','.02037','uReflectionSize','ggx(','vReflect'])assert.ok(w.includes(x),x);assert.doesNotMatch(w,/fetch\(|https:\/\//);assert.ok(fs.statSync('renderer/immersion-assets/water-normal.jpg').size>10000);});
test('cover analysis rejects stale asynchronous results and never inherits a fixed UI palette',()=>{const ui=fs.readFileSync('renderer/immersion.js','utf8');assert.match(ui,/Viz.palette\(artOf\(t, 544\)\)/);assert.match(ui,/request === token/);assert.match(ui,/accent:tint/);assert.doesNotMatch(ui,/basePal|fixedPalette\(/);assert.match(ui,/stop\(\); token\+\+/);});
test('ocean uses a detailed photographic galactic sky and a reflected moon halo',()=>{assert.ok(s.includes("sky(scene,false,true)"));assert.ok(s.includes("'eso-milky-way.jpg'"));assert.ok(fs.statSync('renderer/immersion-assets/eso-milky-way.jpg').size>1000000);assert.ok(s.includes('const moonHalo='));assert.ok(s.includes('c=modelViewMatrix*vec4(0.,0.,0.,1.)'));});
test('orbital audio controls segmented lamps and the reactor, not only a tiny uniform change',()=>{for(const x of ['audioCells','o.bass','o.mid','o.treble','reactor.scale.setScalar','stationFill.intensity','audio:()=>audioState'])assert.ok(s.includes(x),x);});

test('Orbital Dawn ships NASA maps, physical station materials and actual shadow rendering',()=>{for(const f of ['nasa-earth-day.jpg','nasa-earth-night.jpg','earth-clouds-8k.jpg','station-metal-nor_gl.jpg','station-metal-rough.jpg'])assert.ok(fs.statSync(path.join('renderer/immersion-assets',f)).size>100000,f);for(const x of ['createOrbitalDawn','PCFSoftShadowMap','One opaque planet pass','InstancedMesh','MeshPhysicalMaterial','castShadow=true',"cinema:'orbital-resonance'"])assert.ok(s.includes(x),x);const c=fs.readFileSync('renderer/immersion-assets/CREDITS.md','utf8');for(const x of ['ESO/S. Brunier','NASA','CC BY 4.0','metal_plate'])assert.ok(c.includes(x),x);});

test('only ocean and orbit remain reachable',()=>{assert.ok(s.includes('(o.world===1?ocean:orbit)'));assert.doesNotMatch(s,/createSakuraGlade|function sakura\(/);const stage=fs.readFileSync('renderer/lystage.js','utf8');assert.ok(stage.includes('<option value="ocean">Чёрное море</option>'));assert.ok(stage.includes('<option value="orbit">Орбитальная станция</option>'));assert.ok(!stage.includes('<option value="sakura">'));});
test('planet has one opaque cloud pass and guarded angular domains for bloom safety',()=>{const o=fs.readFileSync('renderer/graphics/orbital-dawn.mjs','utf8');assert.doesNotMatch(o,/const cloudShell|const cloudMat/);for(const x of ["precision:'highp'",'clamp(1.-facing,0.,1.)','atmosphere.renderOrder=10','if(a<.0001)discard'])assert.ok(o.includes(x),x);});
test('station visibly changes geometry and plasma from measured audio even in calm camera',()=>{const o=fs.readFileSync('renderer/graphics/orbital-dawn.mjs','utf8');for(const x of ['spectrumBars.setMatrixAt','scanMat.uniforms.uBass.value=bass','plasma.uniforms.uPower.value=response','barMax:bands.barMax','o.reduced?0:o.calm?.42:1'])assert.ok(o.includes(x),x);});
test('Immersion contains no separate song-text overlay, modal UI or lyric-state access',()=>{const ui=fs.readFileSync('renderer/immersion.js','utf8');assert.doesNotMatch(ui,/class="im-lyrics"|function syncText|lyState|aria-modal|im-top|im-worldbar/);assert.match(ui,/stage.prepend\(canvas\)/);assert.match(ui,/reduced = motion\(\)/);});

async function oceanRockFixture(){
 const T=await import('three'),{mergeVertices}=await import('three/addons/utils/BufferGeometryUtils.js');
 const {prepareRockSurface,filterRockSpecular}=await import('../renderer/graphics/ocean-rock-surface.mjs');
 const g=mergeVertices(new T.IcosahedronGeometry(1,5)),p=g.attributes.position;
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),h=1.+.22*Math.sin(x*3.+z*4.)*Math.cos(y*4.-z*2.)+.045*Math.sin(x*11.+y*7.+z*9.);p.setXYZ(i,x*h,y*h,z*h);}
 g.computeVertexNormals();
 return{T,g,prepareRockSurface,filterRockSpecular};
}
test('ocean rock lighting is continuous across UV seams, without welding away texture coordinates',async()=>{
 const {T,g,prepareRockSurface}=await oceanRockFixture(),p=g.attributes.position;
 const groups=new Map();
 for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e5)).join(',');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);}
 const a=new T.Vector3(),b=new T.Vector3();
 function largestJump(){let largest=0;for(const ids of groups.values())for(let j=1;j<ids.length;j++){a.fromBufferAttribute(g.attributes.normal,ids[0]);b.fromBufferAttribute(g.attributes.normal,ids[j]);largest=Math.max(largest,a.distanceTo(b));}return largest;}
 assert.ok(largestJump()>.9,'fixture reproduces the original ~62-degree seam');
 const positions=p.array.slice(),uvs=g.attributes.uv.array.slice(),indices=g.index.array.slice();
 assert.equal(prepareRockSurface(g),g);
 assert.ok(largestJump()<1e-6,'UV duplicate normals must agree exactly');
 assert.deepEqual(p.array,positions);assert.deepEqual(g.attributes.uv.array,uvs);assert.deepEqual(g.index.array,indices);
 assert.equal(p.count,389);assert.equal(g.index.count/3,720);
 g.dispose();
});
test('ocean rock tangents are finite, unit-length and orthogonal after deformation',async()=>{
 const {T,g,prepareRockSurface}=await oceanRockFixture();prepareRockSurface(g);
 const t=g.attributes.tangent,n=g.attributes.normal,a=new T.Vector3(),b=new T.Vector3();
 assert.equal(t.count,n.count);
 for(let i=0;i<t.count;i++){a.fromBufferAttribute(t,i);b.fromBufferAttribute(n,i);assert.ok(a.toArray().every(Number.isFinite));assert.ok(Math.abs(a.length()-1)<1e-5);assert.ok(Math.abs(a.dot(b))<1e-5);assert.ok(Math.abs(t.getW(i))===1);}
 g.dispose();
});
test('wet rock specular AA filters subpixel normals before physical lighting, not final image blur',async()=>{
 const {g,filterRockSpecular}=await oceanRockFixture();
 const shader={fragmentShader:'before\n#include <lights_physical_fragment>\nafter'};
 filterRockSpecular(shader);
 assert.match(shader.fragmentShader,/dFdx\(normal\).*dFdy\(normal\)/);
 assert.match(shader.fragmentShader,/roughnessFactor\*roughnessFactor/);
 assert.ok(shader.fragmentShader.indexOf('rockVariance')<shader.fragmentShader.indexOf('#include <lights_physical_fragment>'));
 assert.doesNotMatch(shader.fragmentShader,/discard|texture2D|uTime|cameraPosition/);
 g.dispose();
});
test('rock preparation runs once at world creation and retains the existing quality and camera paths',()=>{
 const entry=fs.readFileSync('renderer/graphics/immersion-scene.entry.mjs','utf8');
 assert.equal((entry.match(/prepareRockSurface\(rockGeo\)/g)||[]).length,1);
 assert.ok(entry.indexOf('prepareRockSurface(rockGeo)')<entry.indexOf('return{mirror,tint,update(o)'));
 assert.ok(entry.includes('filterRockSpecular(shader)'));
 for(const fragment of ['new T.IcosahedronGeometry(1,5)',"quality==='high'?2880:1920","quality==='high'?Math.min(devicePixelRatio||1,1.5):1",'camera.position.x+=o.pointer.x*.7','area.intensity=140+o.energy*200+o.kick*110'])assert.ok(entry.includes(fragment),fragment);
});
test('ocean geometry is multisampled before bloom, clamped to support, without changing orbit',()=>{
 const entry=fs.readFileSync('renderer/graphics/immersion-scene.entry.mjs','utf8');
 assert.ok(entry.includes('new EffectComposer(renderer,sceneTarget)'));
 assert.ok(entry.includes('o.world===1?Math.min(4,renderer.capabilities.maxSamples):0'));
 assert.ok(entry.includes('[composer.renderTarget1,composer.renderTarget2]'));
 assert.ok(entry.includes('target.samples=samples;target.dispose()'));
 assert.ok(entry.indexOf('composer.addPass(renderPass)')<entry.indexOf('composer.addPass(bloom)'));
 assert.ok(entry.indexOf('composer.addPass(bloom)')<entry.indexOf('composer.addPass(fxaa)'));
});
