/* Pulse ocean surface, original shader. References and normal-map attribution:
 * immersion-assets/CREDITS.md. Planar reflection is a deliberate approximation;
 * displaced swell + multi-scale normals + Fresnel/roughness model its small waves. */
import * as T from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';
const waves=`
vec3 swell(vec2 p,float t){
 vec3 s=vec3(0.);
 // Independent dispersive waves, not a single translating screen-space sine.
 vec2 d=normalize(vec2(.93,.36));float k=.185,f=dot(d,p)*k-t*1.35;s+=vec3(.19*sin(f),d*.19*k*cos(f));
 d=normalize(vec2(-.54,.84));k=.33;f=dot(d,p)*k-t*1.8;s+=vec3(.105*sin(f),d*.105*k*cos(f));
 d=normalize(vec2(.35,.94));k=.64;f=dot(d,p)*k-t*2.5;s+=vec3(.048*sin(f),d*.048*k*cos(f));
 d=normalize(vec2(-.9,-.23));k=1.19;f=dot(d,p)*k-t*3.4;s+=vec3(.021*sin(f),d*.021*k*cos(f));
 float shelter=.4+.6*smoothstep(12.,34.,length(p-vec2(5.,-65.)));
 return s*shelter;
}`;
export function createOceanWater(scene,{own,tex}){
 const normal=tex('water-normal.jpg',false,1);normal.wrapS=normal.wrapT=T.RepeatWrapping;
 const shader={uniforms:{tDiffuse:{value:null},textureMatrix:{value:new T.Matrix4()},color:{value:new T.Color()},uTime:{value:0},uEnergy:{value:0},uTint:{value:new T.Color(.1,.5,.7)},uReflectionSize:{value:new T.Vector2(1024,768)},uDetail:{value:1}},
 vertexShader:`uniform mat4 textureMatrix;uniform float uTime;varying vec4 vReflect;varying vec3 vWorld;
 ${waves}
 void main(){vec3 base=(modelMatrix*vec4(position,1.)).xyz;float h=swell(base.xz,uTime).x;
 vec3 displaced=position+vec3(0.,0.,h);vWorld=(modelMatrix*vec4(displaced,1.)).xyz;
 // Use the undisplaced reflection plane, then perturb its projection per pixel.
 vReflect=textureMatrix*vec4(position,1.);gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}`,
 fragmentShader:`uniform sampler2D tDiffuse,uWaterNormal;uniform float uTime,uEnergy,uDetail;uniform vec2 uReflectionSize;uniform vec3 uTint;
 varying vec4 vReflect;varying vec3 vWorld;${waves}
 float ggx(vec3 n,vec3 v,vec3 l,float rough){vec3 h=normalize(v+l);float nv=max(.025,dot(n,v)),nl=max(0.,dot(n,l)),nh=max(0.,dot(n,h)),vh=max(0.,dot(v,h));float a=rough*rough,a2=a*a,den=nh*nh*(a2-1.)+1.;float D=a2/(3.14159265*den*den);float k=(rough+1.)*(rough+1.)/8.;float G=nv/(nv*(1.-k)+k)*nl/(nl*(1.-k)+k);float F=.02037+.97963*pow(1.-vh,5.);return min(16.,D*G*F/(4.*nv*max(nl,.025)))*nl;}
 vec3 reflection(vec2 q,vec2 radius){vec2 lo=1.5/uReflectionSize,hi=1.-lo;
 vec3 c=texture2D(tDiffuse,clamp(q,lo,hi)).rgb*.28;
 c+=(texture2D(tDiffuse,clamp(q+vec2(radius.x,radius.y),lo,hi)).rgb+texture2D(tDiffuse,clamp(q-vec2(radius.x,radius.y),lo,hi)).rgb)*.16;
 c+=(texture2D(tDiffuse,clamp(q+vec2(-radius.x,radius.y),lo,hi)).rgb+texture2D(tDiffuse,clamp(q-vec2(-radius.x,radius.y),lo,hi)).rgb)*.12;
 if(uDetail>.5)c+=(texture2D(tDiffuse,clamp(q+vec2(0.,radius.y*2.2),lo,hi)).rgb+texture2D(tDiffuse,clamp(q-vec2(0.,radius.y*2.2),lo,hi)).rgb)*.08;
 else c+=texture2D(tDiffuse,clamp(q,lo,hi)).rgb*.16;
 return c;}
 void main(){vec2 p=vWorld.xz;float t=uTime;vec3 view=normalize(cameraPosition-vWorld);float dist=length(cameraPosition-vWorld);
 vec3 sw=swell(p,t);vec2 uv0=p*.031+vec2(t*.009,-t*.006),uv1=mat2(.8,-.6,.6,.8)*p*.073+vec2(-t*.013,t*.008);
 vec2 uv2=mat2(.36,.93,-.93,.36)*p*.19+vec2(t*.018,t*.012);
 vec2 n0=texture2D(uWaterNormal,uv0).rg*2.-1.,n1=texture2D(uWaterNormal,uv1).rg*2.-1.;
 vec2 micro=texture2D(uWaterNormal,uv2).rg*2.-1.;
 float farFade=1.-smoothstep(70.,450.,dist);vec2 slope=sw.yz+(n0*.50+n1*.30+micro*.15)*mix(.32,1.,farFade);
 vec3 N=normalize(vec3(-slope.x,1.,-slope.y));float nv=max(.001,dot(N,view));
 // Fresnel F0 for air/water (n≈1.333), using the actual perturbed surface normal.
 float F=.02037+.97963*pow(1.-nv,5.);
 vec3 nc=mat3(viewMatrix)*vec3(N.x,0.,N.z);float horizon=1.-smoothstep(250.,950.,dist);
 vec2 q=vReflect.xy/max(.001,vReflect.w);q+=nc.xy*(.027+.72/max(8.,dist))*horizon;
 float roughness=.13+min(.12,length(micro)*.12);vec2 radius=(vec2(1.2,2.1)+vec2(.4,2.)*roughness)/uReflectionSize;
 vec3 refl=reflection(q,radius);vec3 deep=vec3(.0017,.008,.014);vec3 scatter=vec3(.007,.023,.032)*(.5+.5*max(0.,dot(N,normalize(vec3(-.4,.7,-.6)))));
 vec3 col=mix(deep+scatter*(.55+.45*nv),refl,F*.96);
 vec3 moonDir=normalize(vec3(-190.,180.,-780.)-vWorld);col+=vec3(.21,.33,.45)*ggx(N,view,moonDir,.23)*.14;
 // Broad area approximation supplies small glints in addition to the real frame reflection.
 for(int i=0;i<3;i++){vec3 lp=i==0?vec3(-2.4,11.,-64.):i==1?vec3(12.4,11.,-66.):vec3(5.,22.,-65.);vec3 L=lp-vWorld;float d2=dot(L,L);col+=uTint*ggx(N,view,normalize(L),.26)*(20.+uEnergy*5.)/max(12.,d2);}
 float fog=1.-exp(-dist*.0018);col=mix(col,vec3(.022,.044,.068),fog*.36);
 gl_FragColor=vec4(max(col,vec3(0.)),1.);}`};
 shader.uniforms.uWaterNormal={value:normal};
 // Concentrate vertices near the viewer; sparse distant cells keep an unbroken horizon.
 const geometry=own(new T.PlaneGeometry(2,2,176,176));const a=geometry.attributes.position;
 for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i);a.setXYZ(i,Math.sign(x)*Math.pow(Math.abs(x),2.5)*900,Math.sign(y)*Math.pow(Math.abs(y),2.5)*900,0);}geometry.computeBoundingSphere();
 const surface=new Reflector(geometry,{clipBias:.003,textureWidth:1280,textureHeight:720,multisample:2,shader});surface.material.uniforms.uWaterNormal.value=normal;surface.rotation.x=-Math.PI/2;surface.position.y=.025;surface.frustumCulled=false;scene.add(surface);return surface;
}
