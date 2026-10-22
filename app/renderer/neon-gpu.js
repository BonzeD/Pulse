/* 1.0.0 panel9: opt-in screen-space GPU backend for the existing radial preset.
 * Geometry/spectrum formulae follow the Canvas renderer. Gaussian halo is an approximation,
 * not a claim of pixel-identical Canvas shadowBlur. No audio or MineRadio changes. */
const NeonGPU = (() => {
  const cache = new WeakMap();
  const vs = `#version 300 es
precision highp float;
layout(location=0) in vec2 aQ;
layout(location=1) in vec4 iA;
layout(location=2) in vec4 iS;
layout(location=3) in vec4 iC;
layout(location=4) in vec3 iG;
uniform vec2 uView;
out vec2 vP; flat out vec4 vA; flat out vec4 vS; flat out vec4 vC; flat out vec3 vG;
void main(){
  float ext=iS.x+1.5+iS.z*1.5+(iS.y>1.5?iS.w:0.);
  vec2 lo=min(iA.xy,iA.zw)-ext,hi=max(iA.xy,iA.zw)+ext;
  vec2 p=mix(lo,hi,aQ*.5+.5);
  vP=p;vA=iA;vS=iS;vC=iC;vG=iG;
  gl_Position=vec4(p.x/uView.x*2.-1.,1.-p.y/uView.y*2.,0.,1.);
}`;
  const fs = `#version 300 es
precision highp float;
in vec2 vP; flat in vec4 vA; flat in vec4 vS; flat in vec4 vC; flat in vec3 vG;
out vec4 o;
void main(){
  float d;
  if(vS.y<.5){vec2 ab=vA.zw-vA.xy;float t=clamp(dot(vP-vA.xy,ab)/max(dot(ab,ab),.0001),0.,1.);d=length(vP-vA.xy-ab*t)-vS.x;}
  else if(vS.y<1.5){vec2 q=abs(vP-vA.xy)-vec2(vS.x);d=length(max(q,0.))+min(max(q.x,q.y),0.);}
  else {d=abs(length(vP-vA.xy)-vS.x)-vS.w;}
  float core=clamp(.5-d,0.,1.)*vC.a;
  float sigma=max(.1,vS.z*.5),e=max(d,0.);
  float strength=min(1.,1.59577*vS.x/max(.1,vS.z));
  if(vS.y>.5&&vS.y<1.5)strength*=strength;
  float halo=vS.z>0.?exp(-e*e/(2.*sigma*sigma))*strength*vC.a:0.;
  float a=core+halo*(1.-core); if(a<.002)discard;
  o=vec4(vC.rgb*core+vG*halo*(1.-core),a);
}`;
  function shader(gl,type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
  function program(gl){
    let p=cache.get(gl);if(p&&gl.isProgram(p.program))return p;
    const program=gl.createProgram(),v=shader(gl,gl.VERTEX_SHADER,vs),f=shader(gl,gl.FRAGMENT_SHADER,fs);
    gl.attachShader(program,v);gl.attachShader(program,f);gl.linkProgram(program);gl.deleteShader(v);gl.deleteShader(f);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    const vao=gl.createVertexArray(),quad=gl.createBuffer(),data=gl.createBuffer();gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,8,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,data);let offset=0;[4,4,4,3].forEach((n,i)=>{gl.enableVertexAttribArray(i+1);gl.vertexAttribPointer(i+1,n,gl.FLOAT,false,60,offset);gl.vertexAttribDivisor(i+1,1);offset+=n*4;});
    gl.bindVertexArray(null);p={program,vao,data,view:gl.getUniformLocation(program,'uView'),buf:new Float32Array(4350)};cache.set(gl,p);return p;
  }
  // Keep a pure geometry builder for deterministic comparison with Canvas draw commands.
  function geometry(g,out,glow=1){
    const R=g.R*1.05,N=Math.round(72*Math.min(2,Math.max(.5,g.dens))),TAU=Math.PI*2;
    const tr=g.directTransform||{k:1,sx:0,sy:0},k=tr.k||1;
    const x=v=>g.cx+(v-g.cx)*k+(tr.sx||0),y=v=>g.cy+(v-g.cy)*k+(tr.sy||0);
    const shadow=g.col(g.bar*.3).map(v=>v/255);let n=0;
    function put(ax,ay,bx,by,r,type,blur,color,alpha,hw=0){let j=n++*15;
      out[j++]=x(ax);out[j++]=y(ay);out[j++]=x(bx);out[j++]=y(by);
      out[j++]=r*k;out[j++]=type;out[j++]=blur;out[j++]=hw*k;
      out[j++]=color[0]/255;out[j++]=color[1]/255;out[j++]=color[2]/255;out[j++]=alpha;
      out[j++]=shadow[0];out[j++]=shadow[1];out[j]=shadow[2];}
    for(let i=0;i<N;i++){
      const m=i<N/2?i/(N/2):(N-i)/(N/2),v=Math.pow(g.band(m*.85),1.3),pk=g.peaks[Math.floor(m*.85*(g.NB-1))];
      const a=i/N*TAU-Math.PI/2,c=Math.cos(a),s=Math.sin(a),r0=R+10,len=4+v*R*.9*(1+g.beat*.25);
      put(g.cx+c*r0,g.cy+s*r0,g.cx+c*(r0+len),g.cy+s*(r0+len),Math.max(2,TAU*R/N*.55)*g.lw/2,0,12*glow,g.col(m*.6+g.bar*.2),.95);
      const pr=r0+7+Math.pow(pk,1.3)*R*.9;
      put(g.cx+c*pr,g.cy+s*pr,g.cx+c*pr,g.cy+s*pr,1.2,1,12*glow,[255,255,255],.75);
    }
    put(g.cx,g.cy,g.cx,g.cy,R+4,2,0,g.col(g.bar),.25+g.beat*.6,(2+g.beat*4)*g.lw/2);
    return n;
  }
  function draw(g,R){const gl=R.gl,p=program(gl);
    const n=geometry(g,p.buf,g.neonGlow??1);
    gl.useProgram(p.program);gl.bindVertexArray(p.vao);gl.bindBuffer(gl.ARRAY_BUFFER,p.data);gl.bufferData(gl.ARRAY_BUFFER,p.buf.subarray(0,n*15),gl.STREAM_DRAW);
    gl.uniform2f(p.view,g.W,g.H);gl.drawArraysInstanced(gl.TRIANGLES,0,6,n);gl.bindVertexArray(null);
  }
  return {draw,geometry};
})();
