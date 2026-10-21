/* Pulse cinematic worlds. Three.js r180 / MIT. All textures are bundled locally.
 * The water uses a clipped planar reflection camera, never a second SDF raymarch.
 * Audio/transport are read-only inputs supplied by immersion.js. */
import * as T from 'three';
import {createOrbitalDawn} from './orbital-dawn.mjs';
import {createOceanWater} from './ocean-water.mjs';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {FXAAShader} from 'three/addons/shaders/FXAAShader.js';
// The entry is bundled at renderer/immersion-scene.js (not in graphics/).
const ASSETS=new URL('immersion-assets/',document.currentScript?.src||location.href).href;
const vertex=`varying vec3 vWorld;varying vec3 vNormal;varying vec2 vTex;
void main(){vTex=uv;vec4 p=vec4(position,1.);vNormal=normalize(mat3(modelMatrix)*normal);
#ifdef USE_INSTANCING
p=instanceMatrix*p;vNormal=normalize(mat3(modelMatrix*instanceMatrix)*normal);
#endif
vWorld=(modelMatrix*p).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}`;
const noise=`float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}float fbm(vec2 p){float f=0.;float a=.5;for(int i=0;i<4;i++){f+=a*noise(p);p=p*2.07+17.3;a*=.5;}return f;}`;
function rng(seed){let n=(Math.floor(seed*137)^0x9e3779b9)>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
function create(canvas){
 const renderer=new T.WebGLRenderer({canvas,alpha:false,antialias:true,powerPreference:'high-performance',stencil:false});
 renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
 const gl=renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');const software=/swiftshader|llvmpipe|software/i.test(ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'');
 const camera=new T.PerspectiveCamera(54,1,.15,1600);const loader=new T.TextureLoader();let destroyed=false,active=null,key='',lastW=0,lastH=0,lastQuality='',frame=0;
 const textures=new Set(),resources=new Set();const own=x=>(resources.add(x),x);const geometries={box:own(new T.BoxGeometry(1,1,1)),sphere:own(new T.SphereGeometry(1,96,64))};
 function tex(name,color=false,repeat=0){const t=loader.load(ASSETS+name,loaded=>{if(destroyed)loaded.dispose();else if(name==='studio-env.png'&&active)active.scene.environment=loaded;},undefined,e=>console.warn('Immersion texture unavailable',name));if(color)t.colorSpace=T.SRGBColorSpace;if(repeat){t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(repeat,repeat);}t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());textures.add(t);return t;}
 function mesh(g,m,parent,x=0,y=0,z=0,sx=1,sy=sx,sz=sx){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);parent.add(o);return o;}
 function material(o){return own(new T.MeshStandardMaterial(o));}
 function emissive(color,power=3){return material({color,emissive:color,emissiveIntensity:power,roughness:.35,metalness:.3});}
 const environment=tex('studio-env.png');environment.mapping=T.CubeUVReflectionMapping;environment.generateMipmaps=false;environment.minFilter=environment.magFilter=T.LinearFilter;textures.delete(environment);
 const composer=new EffectComposer(renderer);const renderPass=new RenderPass(new T.Scene(),camera);composer.addPass(renderPass);const bloom=new UnrealBloomPass(new T.Vector2(1,1),.48,.7,1.05);composer.addPass(bloom);const fxaa=new ShaderPass(FXAAShader);composer.addPass(fxaa);composer.addPass(new OutputPass());
 function sky(scene,space=false,milky=false){const m=own(new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{uTime:{value:0},uSpace:{value:space?1:0},uMilky:{value:milky?1:0},uStars:{value:tex(milky?'eso-milky-way.jpg':'2k_stars_milky_way.jpg',true)}},vertexShader:`varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 vDir;uniform float uTime,uSpace,uMilky;uniform sampler2D uStars;${noise}
void main(){vec3 d=normalize(vDir);vec2 st=vec2(atan(d.z,d.x)/6.2831853+.5,asin(d.y)/3.14159265+.5);vec3 stars=texture2D(uStars,st).rgb;float h=pow(max(0.,1.-abs(d.y)),6.);vec3 col=mix(vec3(.002,.006,.017),vec3(.055,.105,.17),h);float cloud=fbm(d.xz/max(.15,abs(d.y)+.12)*1.3+vec2(uTime*.002,0.));col+=vec3(.035,.05,.075)*smoothstep(.37,.85,cloud)*smoothstep(-.1,.35,d.y);col+=stars*.20*smoothstep(.08,.6,d.y)*(1.-cloud*.7);col=mix(col,stars*.48+vec3(.0005,.001,.003),uSpace);if(uMilky>.5){
 // ESO/S. Brunier GigaGalaxy panorama: a different, naturally coloured galactic core.
 vec3 q=normalize(vec3(dot(d,vec3(0.,.40,-.9165)),dot(d,vec3(-.46,.814,.355)),dot(d,vec3(.888,.422,.184))));
 vec2 gal=vec2(atan(q.z,q.x)/6.2831853+.5,asin(clamp(q.y,-1.,1.))/3.14159265+.5);
 vec3 photo=texture2D(uStars,gal).rgb;
 vec3 galaxy=pow(photo,vec3(1.06))*.72;
 float horizon=smoothstep(-.04,.18,d.y);
 col=mix(vec3(.008,.018,.032),vec3(.001,.002,.006)+galaxy,horizon);
 }gl_FragColor=vec4(col,1.);}` }));const s=mesh(geometries.sphere,m,scene,0,0,0,1100);s.frustumCulled=false;return m;}
 function water(scene,ocean){if(ocean)return createOceanWater(scene,{own,tex});const shader={uniforms:{tDiffuse:{value:null},textureMatrix:{value:new T.Matrix4()},color:{value:new T.Color()},uTime:{value:0},uOcean:{value:ocean?1:0},uEnergy:{value:0},uRoad:{value:tex('asphalt-color.jpg',true)},uNormal:{value:tex('asphalt-normal.jpg')}},vertexShader:`uniform mat4 textureMatrix;varying vec4 vUv;varying vec3 vWorld;void main(){vUv=textureMatrix*vec4(position,1.);vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform sampler2D tDiffuse,uRoad,uNormal;uniform float uTime,uOcean,uEnergy;varying vec4 vUv;varying vec3 vWorld;${noise}
void main(){vec3 view=normalize(cameraPosition-vWorld);float distanceToCamera=length(cameraPosition-vWorld);vec2 p=vWorld.xz;float t=uTime;float a=sin(p.x*.35+p.y*.26-t*.6)+sin(p.x*.75-p.y*.35+t*.45)*.45;float b=cos(p.y*.47-t*.42)+sin(p.x*1.65+p.y*.62+t*.5)*.25;float fine=noise(p*3.4+vec2(t*.1));a+=sin(p.x*3.1+p.y*1.7-t*.7)*.12;b+=sin(p.x*1.4-p.y*4.2+t*.8)*.1;float fade=1.-smoothstep(20.,180.,distanceToCamera);vec2 distortion=vec2(a,b)*mix(.00065,.0042,uOcean)*fade;vec2 uv=vUv.xy/vUv.w;if(uOcean<.5)distortion+=(texture2D(uNormal,p*.09).rg-.5)*.005*fade;uv+=distortion;vec3 reflection=texture2D(tDiffuse,clamp(uv,vec2(.001),vec2(.999))).rgb;
// Reflection is sampled once in projective space. No discontinuous world-space stepping.
float fresnel=.06+.94*pow(1.-max(0.,view.y),4.);vec3 deep=vec3(.004,.012,.023);float puddle=mix(.10,.82,smoothstep(.36,.72,fbm(p*.19)));float refl=mix(puddle,.9,uOcean)*(.35+.65*fresnel);vec3 road=texture2D(uRoad,p*.09).rgb*vec3(.05,.07,.09);vec3 col=mix(mix(road,deep,uOcean),reflection,refl);if(uOcean<.5){vec3 blur=(texture2D(tDiffuse,uv+vec2(.002,0)).rgb+texture2D(tDiffuse,uv-vec2(.002,0)).rgb+texture2D(tDiffuse,uv+vec2(0,.002)).rgb+texture2D(tDiffuse,uv-vec2(0,.002)).rgb)*.25;col=mix(col,mix(road,blur,refl),.55);}float ripples=pow(max(0.,sin(p.y*2.1+fbm(p*.7)*6.+t*.8)),18.);col+=vec3(.004,.008,.012)*ripples*fade*uOcean;col+=vec3(.02,.055,.075)*pow(max(0.,a*.3+b*.15),5.)*fade*uOcean;col*=.94+.06*fine;
if(uOcean<.5){float edge=1.-smoothstep(.025,.055,abs(abs(p.x)-.22));float segment=step(.5,fract(p.y/9.));col+=vec3(.12,.18,.21)*edge*segment*.35;col+=vec3(.004)*noise(p*18.);}
float fog=1.-exp(-distanceToCamera*mix(.004,.0015,uOcean));col=mix(col,vec3(.018,.034,.055),fog*.7);gl_FragColor=vec4(col,1.);}`};
 const plane=new Reflector(own(new T.PlaneGeometry(1800,1800)),{clipBias:.003,textureWidth:1024,textureHeight:768,multisample:2,shader});plane.rotation.x=-Math.PI/2;plane.position.y=.025;scene.add(plane);return plane;}
 function ocean(scene,random){const skyMat=sky(scene,false,true);scene.fog=new T.FogExp2(0x0b1726,.0014);scene.add(new T.HemisphereLight(0x8ebfdf,0x080f1d,1.3));const moonLight=new T.DirectionalLight(0x83b7e2,3.8);moonLight.position.set(-40,70,-40);scene.add(moonLight);
 const moon=mesh(geometries.sphere,own(new T.MeshBasicMaterial({map:tex('2k_moon.jpg',true),color:new T.Color(2.8,3.0,3.3),fog:false})),scene,-190,180,-780,19);
 // A camera-facing optical halo, also visible to the planar reflection camera.
 const moonHalo=own(new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,
 vertexShader:`varying vec2 vUv;void main(){vUv=uv;vec4 c=modelViewMatrix*vec4(0.,0.,0.,1.);c.xy+=position.xy*110.;gl_Position=projectionMatrix*c;}`,
 fragmentShader:`varying vec2 vUv;void main(){float r=length(vUv-.5)*2.;float a=exp(-r*r*9.)*.14+exp(-r*r*32.)*.16;a*=1.-smoothstep(.65,1.,r);gl_FragColor=vec4(vec3(.52,.71,1.25),a);}`}));
 const halo=mesh(own(new T.PlaneGeometry(1,1)),moonHalo,scene,-190,180,-780);halo.frustumCulled=false;
 const rock=material({color:0x7c8a94,roughness:.88,metalness:.05,map:tex('rock-color.jpg',true,1),normalMap:tex('rock-normal.jpg',false,1)});
 // Salt-wet stone is darker and smoother at the waterline; upper faces stay dry.
 rock.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vRockWorld;').replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvRockWorld=(modelMatrix*vec4(transformed,1.)).xyz;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vRockWorld;').replace('#include <color_fragment>','#include <color_fragment>\nfloat rockWet=1.-smoothstep(.15,2.2,vRockWorld.y);diffuseColor.rgb*=mix(1.,.60,rockWet);').replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.26,rockWet);');};
 const island=new T.Group();scene.add(island);const rockGeo=own(mergeVertices(new T.IcosahedronGeometry(1,5)));const rp=rockGeo.attributes.position;for(let i=0;i<rp.count;i++){const x=rp.getX(i),y=rp.getY(i),z=rp.getZ(i);const h=1.+.22*Math.sin(x*3.+z*4.)*Math.cos(y*4.-z*2.)+.045*Math.sin(x*11.+y*7.+z*9.);rp.setXYZ(i,x*h,y*h,z*h);}rockGeo.computeVertexNormals();for(let i=0;i<15;i++){const a=random()*6.28,r=7+random()*10;const b=mesh(rockGeo,rock,island,5+Math.cos(a)*r,-1.9,-65+Math.sin(a)*r*.38,3+random()*4,1.7+random()*1.4,3+random()*3);b.rotation.set(random(),random(),random());}
 const structure=new T.Group();structure.position.set(5,0,-65);structure.rotation.y=-.16;scene.add(structure);
 const metal=material({color:0x2d3b4e,metalness:.85,roughness:.27});const bronze=material({color:0x6b5949,metalness:.8,roughness:.28});const light=emissive(0x6ce6f5,4.8);const amber=emissive(0xffb16c,2.4);
 // A built object: dark frame, recessed luminous seam, visible bevels and separate base.
 for(const s of [-1,1]){mesh(own(new RoundedBoxGeometry(1.1,22,1.8,3,.10)),metal,structure,s*7.5,11,0);mesh(geometries.box,bronze,structure,s*7.5,11,.96,.72,21,.14);mesh(geometries.box,light,structure,s*6.91,11,-.15,.09,20.4,.28);for(let j=0;j<11;j++)mesh(geometries.box,metal,structure,s*7.5,1.2+j*1.9,1.09,.95,.04,.06);}
 mesh(own(new RoundedBoxGeometry(16.1,1.15,1.8,3,.10)),metal,structure,0,22,0);mesh(geometries.box,bronze,structure,0,22,.96,15.5,.72,.14);mesh(geometries.box,light,structure,0,21.4,-.15,13.8,.09,.28);mesh(geometries.box,metal,structure,0,.2,0,19,.6,5);mesh(geometries.box,amber,structure,0,.55,2.56,15,.04,.05);
 const area=new T.PointLight(0x64d3ef,220,48,2);area.position.set(5,10,-60);scene.add(area);
 // Distant vertical silhouettes supply scale without a glowing placeholder block.
 for(let i=0;i<18;i++){const x=(random()-.5)*360,z=-170-random()*280;mesh(rockGeo,rock,scene,x,2,z,4+random()*8,3+random()*6,6+random()*7);}
 const mirror=water(scene,true);const tint=new T.Color(0x6ce6f5),targetTint=new T.Color();let tintTime=performance.now();
 return{mirror,tint,update(o){const t=o.time;camera.position.set(-10+Math.sin(t*.035)*2.4,3.7+Math.sin(t*.07)*.13,-4+Math.sin(t*.03)*1.8);camera.lookAt(0,8,-66);skyMat.uniforms.uTime.value=t;mirror.material.uniforms.uTime.value=t*2.8;mirror.material.uniforms.uEnergy.value=o.energy;const now=performance.now(),dt=Math.min(.2,(now-tintTime)/1000);tintTime=now;const rgb=o.accent||[.5,.75,.9];targetTint.setRGB(rgb[0],rgb[1],rgb[2],T.SRGBColorSpace);tint.lerp(targetTint,1.-Math.exp(-dt/0.5));light.color.copy(tint);light.emissive.copy(tint);amber.color.copy(tint);amber.emissive.copy(tint);area.color.copy(tint);area.intensity=140+o.energy*200+o.kick*110;mirror.material.uniforms.uTint.value.copy(tint);const glowGain=Math.min(2.2,Math.max(1.,.38/(tint.r*.2126+tint.g*.7152+tint.b*.0722+.025)));light.emissiveIntensity=(2.7+o.energy*3.8+o.kick*2.4)*glowGain;amber.emissiveIntensity=2.4*glowGain;}};
 }
 function orbit(scene,random){return createOrbitalDawn(scene,{T,own,tex,mesh,material,emissive,geometries,camera,sky,random,renderer});}
 function disposeWorld(){if(!active)return;renderer.shadowMap.enabled=false;active.scene.traverse(n=>{if(n.isLight&&n.shadow?.map)n.shadow.map.dispose();});active.scene.traverse(n=>{if(n.isReflector)n.dispose();if(n.isInstancedMesh)n.dispose();});for(const r of resources)r.dispose?.();resources.clear();for(const t of textures)t.dispose();textures.clear();active=null;geometries.box=own(new T.BoxGeometry(1,1,1));geometries.sphere=own(new T.SphereGeometry(1,96,64));renderer.renderLists.dispose();}
 function load(o){disposeWorld();const scene=new T.Scene();scene.environment=environment.image?environment:null;scene.environmentIntensity=1.52;const random=rng(o.seed);const w=(o.world===1?ocean:orbit)(scene,random);active={scene,...w};renderPass.scene=scene;lastQuality='';}
 return{software,draw(o){if(destroyed||gl.isContextLost())return false;const k=String(o.world); // Track changes update audio/tint without recompiling the world.
if(k!==key){key=k;load(o);}const quality=o.software?'software':o.eco?'eco':o.high?'high':'balanced';const max=quality==='software'?1000:quality==='eco'?1280:quality==='high'?2880:1920;const dpr=quality==='high'?Math.min(devicePixelRatio||1,1.5):1;const scale=Math.min(dpr,max/Math.max(1,o.width),1600/Math.max(1,o.height));const w=Math.max(2,Math.round(o.width*scale)),h=Math.max(2,Math.round(o.height*scale));if(w!==lastW||h!==lastH||quality!==lastQuality){lastW=w;lastH=h;lastQuality=quality;renderer.setPixelRatio(1);renderer.setSize(w,h,false);composer.setSize(w,h);camera.aspect=o.width/o.height;camera.updateProjectionMatrix();fxaa.material.uniforms.resolution.value.set(1/w,1/h);if(active.mirror){const rw=Math.min(w,quality==='high'?1920:quality==='eco'||software?768:1280);const rh=Math.max(2,Math.round(rw*h/w));active.mirror.getRenderTarget().setSize(rw,rh);active.mirror.material.uniforms.uReflectionSize?.value.set(rw,rh);if(active.mirror.material.uniforms.uDetail)active.mirror.material.uniforms.uDetail.value=quality==='eco'||quality==='software'?0:1;}bloom.strength=quality==='eco'?.28:(o.world===1?.48:o.world===2?.66:.40);bloom.threshold=o.world===1?.55:o.world===2?.90:1.05;}
 active.update(o);
 // Camera is reset by the world each frame: bounded offsets never accumulate.
 if(o.pointer&&!o.reduced){camera.position.x+=o.pointer.x*.7;camera.position.y-=o.pointer.y*.35;camera.rotateY(-o.pointer.x*.012);camera.rotateX(-o.pointer.y*.008);}
 composer.render();frame++;return true;},destroy(){if(destroyed)return;destroyed=true;disposeWorld();for(const r of resources)r.dispose?.();resources.clear();bloom.dispose();fxaa.dispose();for(const p of composer.passes)if(p!==bloom&&p!==fxaa)p.dispose?.();composer.dispose();environment.dispose();renderer.dispose();},stats:()=>({engine:'three-r180',width:lastW,height:lastH,quality:lastQuality,frames:frame,drawCalls:renderer.info.render.calls,textures:renderer.info.memory.textures,portalColor:active?.tint?.getHexString()||null,audio:active?.audio?.()||null,cinema:active?.cinema||null,milkyWay:key==='1',moonHalo:key==='1'}),gl};
}
window.PulseImmersionScene={create};
