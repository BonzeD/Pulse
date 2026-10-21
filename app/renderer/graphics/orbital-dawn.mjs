/* Orbital Dawn: original modular station, NASA day/night maps, real PBR metal.
 * This module only renders supplied live-audio values; it owns no transport. */
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
export function createOrbitalDawn(scene,{T,own,tex,mesh,material,emissive,geometries,camera,sky,renderer}){
 scene.environmentIntensity=1.15;sky(scene,true);
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
 const sunDir=new T.Vector3(-.93,.16,.33).normalize();
 const sun=new T.DirectionalLight(0xffdfb5,4.1);sun.position.set(-38,20,12);sun.castShadow=true;
 sun.shadow.mapSize.set(1536,1536);Object.assign(sun.shadow.camera,{left:-30,right:30,top:28,bottom:-28,near:1,far:130});sun.shadow.bias=-.00015;sun.shadow.normalBias=.025;sun.target.position.set(2,2,-4);scene.add(sun,sun.target);
 scene.add(new T.HemisphereLight(0xa6d7ff,0x071527,.48));
 const earthFill=new T.DirectionalLight(0x6ba4d4,1.45);earthFill.position.set(15,-25,35);scene.add(earthFill);
 const edgeFill=new T.DirectionalLight(0x94c9ed,.6);edgeFill.position.set(15,10,-35);scene.add(edgeFill);
 // One opaque planet pass. No almost-coplanar transparent cloud shell.
 // Clamp every dot product before fractional pow: NaNs otherwise spread into bloom tiles.
 const earthMat=own(new T.ShaderMaterial({precision:'highp',uniforms:{uDay:{value:tex('nasa-earth-day.jpg',true)},uNight:{value:tex('nasa-earth-night.jpg',true)},uCloud:{value:tex('earth-clouds-8k.jpg')},uSun:{value:sunDir},uDrift:{value:0}},
 vertexShader:`varying vec2 vUv;varying vec3 vN,vP;void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vP=w.xyz;vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*w;}`,
 fragmentShader:`uniform sampler2D uDay,uNight,uCloud;uniform vec3 uSun;uniform float uDrift;varying vec2 vUv;varying vec3 vN,vP;
 void main(){vec3 n=normalize(vN),v=normalize(cameraPosition-vP);float nl=clamp(dot(n,uSun),-1.,1.);float day=smoothstep(-.13,.22,nl);vec3 land=texture2D(uDay,vUv).rgb;vec2 cuv=vec2(fract(vUv.x+uDrift),vUv.y);
 float cloud=smoothstep(.15,.90,texture2D(uCloud,cuv).r);float shade=smoothstep(.15,.9,texture2D(uCloud,cuv+vec2(.0015,-.0005)).r);
 float diffuse=.018+max(0.,nl)*1.8;vec3 ground=land*diffuse*(1.-shade*.29);float sea=1.-smoothstep(.008,.055,max(max(land.r,land.g),land.b));sea=max(sea,smoothstep(.01,.06,land.b-land.r));ground+=vec3(.001,.006,.022)*sea*day;
 float spec=pow(clamp(dot(reflect(-uSun,n),v),0.,1.),72.);ground+=vec3(.98,.69,.38)*spec*sea*.35*(1.-cloud);
 vec3 cloudCol=vec3(.76,.85,.96)*(.025+max(0.,nl)*1.6);vec3 col=mix(ground,cloudCol,cloud*.89);
 vec3 cities=max(texture2D(uNight,vUv).rgb-vec3(.012),vec3(0.));col+=cities*vec3(1.8,1.0,.43)*pow(clamp(1.-day,0.,1.),2.)*2.3*(1.-cloud*.88);
 float facing=clamp(dot(n,v),0.,1.);float rim=pow(clamp(1.-facing,0.,1.),3.5);float dusk=pow(clamp(1.-abs(nl),0.,1.),14.);
 col+=mix(vec3(.013,.08,.29),vec3(.03,.24,.65),day)*rim;col+=vec3(.32,.085,.015)*rim*dusk;
 gl_FragColor=vec4(max(col,vec3(0.)),1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }` }));
 const earth=mesh(own(new T.SphereGeometry(1,160,96)),earthMat,scene,26,-108,-178,132);earth.rotation.set(.1,4.9,.18);
 // A distant, expanded atmosphere with an explicit order and safe angular domain.
 const air=own(new T.ShaderMaterial({precision:'highp',transparent:true,depthWrite:false,depthTest:true,side:T.BackSide,blending:T.AdditiveBlending,uniforms:{uSun:{value:sunDir}},
 vertexShader:`varying vec3 n,v;void main(){vec4 w=modelMatrix*vec4(position,1.);n=normalize(mat3(modelMatrix)*normal);v=normalize(cameraPosition-w.xyz);gl_Position=projectionMatrix*viewMatrix*w;}`,
 fragmentShader:`uniform vec3 uSun;varying vec3 n,v;void main(){vec3 N=normalize(n);float facing=clamp(abs(dot(N,normalize(v))),0.,1.);float rim=pow(clamp(1.-facing,0.,1.),5.);float nl=clamp(dot(N,uSun),-1.,1.);float lit=smoothstep(-.22,.45,nl);float dusk=pow(clamp(1.-abs(nl),0.,1.),10.);vec3 c=mix(vec3(.018,.09,.34),vec3(.06,.4,.85),lit);c=mix(c,vec3(.72,.24,.055),dusk*.42);float a=rim*(.15+.5*lit);if(a<.0001)discard;gl_FragColor=vec4(c,a);}` }));
 const atmosphere=mesh(earth.geometry,air,scene,26,-108,-178,133.7);atmosphere.renderOrder=10;atmosphere.rotation.copy(earth.rotation);
 const sunGlow=own(new T.ShaderMaterial({precision:'highp',transparent:true,depthWrite:false,depthTest:true,blending:T.AdditiveBlending,
 vertexShader:`varying vec2 uv0;void main(){uv0=uv;vec4 c=modelViewMatrix*vec4(0.,0.,0.,1.);c.xy+=position.xy*155.;gl_Position=projectionMatrix*c;}`,
 fragmentShader:`varying vec2 uv0;void main(){vec2 p=(uv0-.5)*2.;float r=length(p);if(r>.98)discard;float disk=1.-smoothstep(.024,.033,r);float halo=exp(-r*14.)*.5+exp(-r*r*11.)*.035;float streak=exp(-abs(p.y)*190.)*exp(-abs(p.x)*8.)*.022;float a=(disk+halo+streak)*(1.-smoothstep(.8,1.,r));if(a<.0001)discard;gl_FragColor=vec4(mix(vec3(1.1,.48,.17),vec3(4.,3.2,2.),disk),a);}` }));
 const solarGlow=mesh(own(new T.PlaneGeometry(1,1)),sunGlow,scene,-205,-50,-450);solarGlow.frustumCulled=false;solarGlow.renderOrder=2;
 // Shared assets and instanced architectural details keep draw count bounded.
 const normal=tex('station-metal-nor_gl.jpg',false,3),rough=tex('station-metal-rough.jpg',false,3);
 const alloy=material({color:0x687c8c,metalness:.86,roughness:.29,normalMap:normal,normalScale:new T.Vector2(.18,.18),roughnessMap:rough});
 const white=material({color:0x798a99,metalness:.8,roughness:.32,normalMap:normal,normalScale:new T.Vector2(.1,.1)});
 const graphite=material({color:0x101a24,metalness:.70,roughness:.40});
 const gold=material({color:0x91704b,metalness:.88,roughness:.31,normalMap:normal,normalScale:new T.Vector2(.22,.22)});
 const glass=material({color:0x12314c,metalness:.68,roughness:.16});
 const warm=emissive(0xffce90,.8),light=emissive(0x7bdfff,1.0);
 const rounded=own(new RoundedBoxGeometry(1,1,1,2,.055));
 const bodyGeo=own(new T.CylinderGeometry(1,1,1,48));
 const station=new T.Group();station.position.set(5,7,4);station.rotation.set(.57,-.55,-.24);scene.add(station);
 const wheel=new T.Group();station.add(wheel);
 const transforms={white:[],gold:[],dark:[],windows:[],ribs:[]};
 function pose(x,y,z,sx,sy,sz,rz=0,ry=0,rx=0){const d=new T.Object3D();d.position.set(x,y,z);d.rotation.set(rx,ry,rz);d.scale.set(sx,sy,sz);d.updateMatrix();return d.matrix.clone();}
 function batch(g,m,poses,cast=true){const b=new T.InstancedMesh(g,m,poses.length);for(let i=0;i<poses.length;i++)b.setMatrixAt(i,poses[i]);b.castShadow=cast;b.receiveShadow=true;wheel.add(b);return b;}
 function torus(r,t,mat,parent=wheel,z=0){const m=mesh(own(new T.TorusGeometry(r,t,16,192)),mat,parent,0,0,z);m.castShadow=true;m.receiveShadow=true;return m;}
 function cylinder(r,length,mat,parent,x=0,y=0,z=0){const m=mesh(bodyGeo,mat,parent,x,y,z,r,length,r);m.rotation.x=Math.PI/2;m.castShadow=true;m.receiveShadow=true;return m;}
 function beam(a,b,r,mat,parent=wheel){const d=new T.Vector3().subVectors(b,a),m=mesh(bodyGeo,mat,parent,0,0,0,r,d.length(),r);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());m.castShadow=true;m.receiveShadow=true;return m;}
 torus(10.6,.63,graphite);torus(10.6,.40,alloy,wheel,-.95);torus(11.45,.065,alloy,wheel,.75);torus(9.72,.065,alloy,wheel,.75);
 for(let i=0;i<64;i++){const a=i/64*Math.PI*2,c=Math.cos(a),s=Math.sin(a);const full=i%8===0;
  transforms[i%16===0?'gold':i%4===0?'dark':'white'].push(pose(c*10.6,s*10.6,0,full?1.75:1.40,full?1.6:.88,full?2.8:2.0,a));
  transforms.dark.push(pose(c*10.6,s*10.6,1.045,1.18,.12,.06,a));
  transforms.ribs.push(pose(c*11.5,s*11.5,.05,.07,.50,1.95,a));
  if(i%2===0)for(let j=-1;j<=1;j++){const r=10.6+j*.26;transforms.windows.push(pose(c*r,s*r,full?1.43:1.035,.12,.35,.04,a));}
 }
 batch(rounded,white,transforms.white);batch(rounded,gold,transforms.gold);batch(rounded,graphite,transforms.dark);batch(rounded,alloy,transforms.ribs);batch(rounded,warm,transforms.windows,false);
 // Six triangular load-bearing trusses, visible forward and aft.
 for(let i=0;i<6;i++){const a=i/6*Math.PI*2;for(const z of [-.78,.65]){
  const c=Math.cos(a),s=Math.sin(a),a0=new T.Vector3(c*1.5,s*1.5,z),b0=new T.Vector3(c*9.8,s*9.8,z);beam(a0,b0,.12,white);
  for(let j=0;j<4;j++){const r0=2.0+j*1.9,r1=r0+1.8;beam(new T.Vector3(c*r0,s*r0,-.78),new T.Vector3(c*r1,s*r1,.65),.045,alloy);}
 }}
 const spine=cylinder(1.32,7.5,alloy,station,0,0,.3);cylinder(1.40,1.1,gold,station,0,0,-2.8);cylinder(1.40,.95,white,station,0,0,2.9);
 for(const z of [-3.1,-1.9,1.8,3.45])torus(1.35,.065,graphite,station,z);
 cylinder(.93,.15,graphite,station,0,0,4.16);torus(.94,.14,alloy,station,4.20);torus(.74,.035,warm,station,4.22);
 const reactor=torus(1.43,.045,light,station,3.48);
 for(let i=0;i<8;i++){const a=i/8*Math.PI*2;mesh(rounded,alloy,station,Math.cos(a)*1.16,Math.sin(a)*1.16,4.22,.13,.13,.24).rotation.z=a;}
 // Auxiliary pressure modules, radiators, communications hardware.
 for(const side of [-1,1]){
  const module=cylinder(.78,4.5,white,station,0,side*4.7,-2.2);module.rotation.set(Math.PI/2,0,0);
  for(const z of [-3.8,-.6]){const h=mesh(own(new T.TorusGeometry(.78,.035,8,48)),gold,station,0,side*4.7,z);h.castShadow=true;}
  for(let i=0;i<5;i++)mesh(rounded,graphite,station,-1.05+i*.52,side*4.7,.12,.03,1.2,.05);
  beam(new T.Vector3(side*11.4,0,-.7),new T.Vector3(side*24.9,0,-.7),.13,alloy,station);
 }
 const solar=own(new T.MeshPhysicalMaterial({color:0x102f50,metalness:.52,roughness:.23,clearcoat:.65,clearcoatRoughness:.20}));
 solar.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 panelUv;').replace('#include <uv_vertex>','#include <uv_vertex>\npanelUv=uv;');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 panelUv;').replace('#include <color_fragment>',`#include <color_fragment>
 vec2 g=fract(panelUv*vec2(10.,48.));float seam=step(.91,g.x)+step(.92,g.y);diffuseColor.rgb*=.74+.26*step(.5,fract(panelUv.y*24.));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.075,.083,.074),clamp(seam,0.,1.));`);};
 const frames=[];
 for(const side of [-1,1])for(let i=0;i<4;i++){const x=side*(14.9+i*2.85);const p=mesh(rounded,solar,station,x,0,-.7,2.58,8.6,.12);p.rotation.y=side*.12;p.castShadow=true;p.receiveShadow=true;
  frames.push(pose(x,4.36,-.7,2.72,.075,.22),pose(x,-4.36,-.7,2.72,.075,.22),pose(x-1.34,0,-.7,.07,8.8,.22),pose(x+1.34,0,-.7,.07,8.8,.22));
 }
 const frameBatch=new T.InstancedMesh(rounded,alloy,frames.length);frames.forEach((p,i)=>frameBatch.setMatrixAt(i,p));frameBatch.castShadow=true;frameBatch.receiveShadow=true;station.add(frameBatch);
 // White thermal radiator, gold insulated equipment and a directional dish.
 const radiator=mesh(rounded,white,station,0,14,-2,7.2,3.0,.14);radiator.rotation.x=-.22;radiator.castShadow=true;
 for(let i=0;i<12;i++)mesh(rounded,graphite,station,-3.25+i*.59,14,-1.90,.035,2.85,.02);
 beam(new T.Vector3(0,11.4,-.5),new T.Vector3(0,14,-2),.10,alloy,station);
 const dish=mesh(own(new T.SphereGeometry(1.6,32,16,0,Math.PI*2,0,.75)),white,station,1.8,-5.7,2.0);dish.rotation.x=Math.PI*.8;dish.scale.y=.5;dish.castShadow=true;
 beam(new T.Vector3(1.8,-5.7,2),new T.Vector3(1.8,-5.7,4.0),.035,alloy,station);
 for(let i=0;i<8;i++)mesh(rounded,gold,station,Math.sin(i*2.1)*1.8,-1-i*.65,-3.8,.7,.42,.6);
 const navMat=emissive(0xf5aa72,1.2);for(const x of [-25.1,25.1])mesh(geometries.sphere,navMat,station,x,0,-.7,.10);
 // One draw call for every independently modulated light segment.
 const cellMat=own(new T.MeshBasicMaterial({color:new T.Color(.2,1.3,1.7),toneMapped:false}));
 const audioCells=new T.InstancedMesh(rounded,cellMat,64),dummy=new T.Object3D(),color=new T.Color();wheel.add(audioCells);
 for(let i=0;i<64;i++){const a=i/64*Math.PI*2;dummy.position.set(Math.cos(a)*9.94,Math.sin(a)*9.94,.84);dummy.rotation.z=a;dummy.scale.set(.075,.47,.07);dummy.updateMatrix();audioCells.setMatrixAt(i,dummy.matrix);audioCells.setColorAt(i,color.setRGB(.4,.4,.4));}
 const stationFill=new T.PointLight(0x68d0eb,15,28,2);stationFill.position.set(0,0,6);station.add(stationFill);
 // Sound becomes geometry: luminous radial bars, wide orbital tracks and visible core plasma.
 const bandMaterial=own(new T.MeshBasicMaterial({color:new T.Color(0.15,1.2,1.5),toneMapped:false}));
 const spectrumBars=new T.InstancedMesh(rounded,bandMaterial,64);wheel.add(spectrumBars);spectrumBars.frustumCulled=false;
 const scanMat=own(new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,uniforms:{uPower:{value:0},uBass:{value:0},uMid:{value:0},uTime:{value:0}},
 vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`varying vec2 vUv;uniform float uPower,uBass,uMid,uTime;void main(){float run=pow(.5+.5*sin(vUv.x*6.283185*3.-uTime*(1.+uMid*2.)),8.);float edge=1.-abs(vUv.y*2.-1.);float a=(.025+uPower*.3+run*(uBass*.65+uMid*.7))*smoothstep(0.,.3,edge);vec3 c=mix(vec3(.06,.7,1.2),vec3(.8,1.4,1.5),run*uBass);gl_FragColor=vec4(c,a);}` }));
 const track=mesh(own(new T.RingGeometry(8.9,9.55,192)),scanMat,wheel,0,0,1.12);track.renderOrder=20;
 const plasma=own(new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,blending:T.AdditiveBlending,side:T.DoubleSide,uniforms:{uPower:{value:0},uKick:{value:0},uTime:{value:0}},
 vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`varying vec2 vUv;uniform float uPower,uKick,uTime;void main(){vec2 p=vUv-.5;float r=length(p)*2.;if(r>1.)discard;float core=exp(-r*r*26.);float delta=(r-(.46+uKick*.18))*30.;float ring=exp(-delta*delta);float rays=pow(clamp(.5+.5*cos(atan(p.y,p.x)*12.-uTime*1.8),0.,1.),6.)*exp(-r*5.);float a=(core*.45+ring*.22+rays*.11)*(.08+uPower*1.5+uKick*.55);gl_FragColor=vec4(vec3(.13,.78,1.35),a);}` }));
 const corePlasma=mesh(own(new T.PlaneGeometry(7.5,7.5)),plasma,station,0,0,4.35);corePlasma.renderOrder=21;
 const innerTrim=torus(2.1,.045,light,station,3.9);const outerTrim=torus(3.1,.024,light,station,3.8);
 // Sparse navigation beacons avoid a fake starfield or arbitrary periodic beats.
 const bands={barMax:0,plasma:0};

 let audioState={power:0,kick:0,bass:0,mid:0,treble:0,range:0},lastShadow=0;
 return{audio:()=>audioState,cinema:'orbital-resonance',update(o){const t=o.time;
  camera.position.set(-1+Math.sin(t*.025)*1.3,6+Math.sin(t*.018)*.3,50+Math.max(0,1.25-camera.aspect)*44);camera.lookAt(2,1,-28);
  station.rotation.z=-.24+t*.009;earth.rotation.y=4.9+t*.0012;earthMat.uniforms.uDrift.value=t*.0002;
  const gain=o.reduced?0:o.calm?.42:1,bass=(o.bass||0)*gain,mid=(o.mid||0)*gain,treble=(o.treble||0)*gain,kick=(o.kick||0)*gain,power=(o.energy||0)*gain;
  warm.emissiveIntensity=.6+treble*.45;light.emissiveIntensity=.8+bass*2.2+kick*1.2;navMat.emissiveIntensity=1+treble*3.5+kick*.6;
  reactor.scale.setScalar(1+bass*.022+kick*.01);stationFill.intensity=12+power*42+kick*24;
  const at=o.audioTime||0;let minCell=Infinity,maxCell=0;
  for(let i=0;i<64;i++){const a=i/64*Math.PI*2,wave=.5+.5*Math.cos(a*3.-at*(.8+mid*2.));const v=.24+power*.45+wave*(bass*2.8+mid*1.8)+kick*1.8;audioCells.setColorAt(i,color.setRGB(v,v,v));minCell=Math.min(minCell,v);maxCell=Math.max(maxCell,v);}
  audioCells.instanceColor.needsUpdate=true;
  const response=Math.pow(Math.max(bass*.55,power),.64);bands.barMax=0;
  for(let i=0;i<64;i++){const a=i/64*Math.PI*2;const band=i%3===0?bass:i%3===1?mid:treble;const length=.12+(Math.pow(Math.max(0,band),.66)*1.65+kick*.85)*(.65+.35*Math.cos(a*3-at*1.2));const r=11.9+length*.5;dummy.position.set(Math.cos(a)*r,Math.sin(a)*r,.35);dummy.rotation.z=a;dummy.scale.set(length,.13,.11);dummy.updateMatrix();spectrumBars.setMatrixAt(i,dummy.matrix);bands.barMax=Math.max(bands.barMax,length);}
  spectrumBars.instanceMatrix.needsUpdate=true;bandMaterial.color.setRGB(.05+kick*.4,.25+response*1.1,.42+response*1.8);
  scanMat.uniforms.uPower.value=power;scanMat.uniforms.uBass.value=bass;scanMat.uniforms.uMid.value=mid;scanMat.uniforms.uTime.value=at;
  plasma.uniforms.uPower.value=response;plasma.uniforms.uKick.value=kick;plasma.uniforms.uTime.value=at;bands.plasma=response;
  innerTrim.scale.setScalar(1+response*.12);outerTrim.scale.setScalar(1+response*.07+kick*.03);
  audioState={power,kick,bass,mid,treble,range:maxCell-minCell,barMax:bands.barMax,plasma:bands.plasma};
  renderer.shadowMap.enabled=!o.software&&!o.eco;const shadowSize=o.high&&!o.eco?2048:1024;if(shadowSize!==lastShadow){lastShadow=shadowSize;sun.shadow.mapSize.set(shadowSize,shadowSize);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}}
 }};
}
