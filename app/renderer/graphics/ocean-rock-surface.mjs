/* UV seams must split texture coordinates, not the stone's lighting surface.
 * Prepare this shared geometry once, after deformation, never in the frame loop. */
import {Vector3} from 'three';

export function prepareRockSurface(geometry){
 const position=geometry.attributes.position,index=geometry.index;
 if(!index||!geometry.attributes.uv)throw new Error('Rock surface needs indexed UV geometry');
 const groups=new Map(),keys=new Array(position.count);
 for(let i=0;i<position.count;i++){
  const key=[position.getX(i),position.getY(i),position.getZ(i)].map(v=>Math.round(v*1e5)).join(',');
  keys[i]=key;if(!groups.has(key))groups.set(key,new Vector3());
 }
 // Accumulate area-weighted face normals by POSITION. computeVertexNormals alone
 // keeps the UV duplicates apart and leaves visible, moving specular seams.
 const a=new Vector3(),b=new Vector3(),c=new Vector3(),ab=new Vector3(),ac=new Vector3();
 for(let i=0;i<index.count;i+=3){
  const ia=index.getX(i),ib=index.getX(i+1),ic=index.getX(i+2);
  a.fromBufferAttribute(position,ia);b.fromBufferAttribute(position,ib);c.fromBufferAttribute(position,ic);
  ab.subVectors(b,a);ac.subVectors(c,a);ab.cross(ac);
  groups.get(keys[ia]).add(ab);groups.get(keys[ib]).add(ab);groups.get(keys[ic]).add(ab);
 }
 for(const normal of groups.values())normal.normalize();
 geometry.computeVertexNormals();
 const normal=geometry.attributes.normal;
 for(let i=0;i<position.count;i++){const n=groups.get(keys[i]);normal.setXYZ(i,n.x,n.y,n.z);}
 normal.needsUpdate=true;
 // Stable interpolated tangents, rather than a new screen-derivative basis per
 // triangle. Keep the existing UVs, texture resolution and triangle count.
 geometry.computeTangents();
 return geometry;
}

export function filterRockSpecular(shader){
 // Three's geometry roughness uses the unperturbed normal. Also filter normal-
 // map variance so subpixel detail cannot turn into sharp crawling highlights.
 // This is local specular AA, not temporal blur or a lower-quality render path.
 shader.fragmentShader=shader.fragmentShader.replace('#include <lights_physical_fragment>',`
vec3 rockDx=dFdx(normal),rockDy=dFdy(normal);
float rockVariance=max(dot(rockDx,rockDx),dot(rockDy,rockDy));
roughnessFactor=sqrt(min(1.,roughnessFactor*roughnessFactor+min(.18,2.*rockVariance)));
#include <lights_physical_fragment>`);
}