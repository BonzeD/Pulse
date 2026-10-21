const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const c=vm.createContext({performance:{now:()=>1000},Float32Array,Math,console});
vm.runInContext(fs.readFileSync('renderer/neon-gpu.js','utf8')+'\n'+fs.readFileSync('renderer/viz.js','utf8')+'\nthis.neon=NeonGPU;this.preset=Viz.STYLES.find(s=>s.id==="radial");',c);
test('Neon GPU bars, square peaks and inner ring match original Canvas geometry',()=>{
 for(const dens of [.5,1,2])for(const beat of [0,.4,1])for(const lw of [.5,1,2]){
  const rows=[],ctx={lineWidth:1,beginPath(){},moveTo(x,y){this.a=[x,y]},lineTo(x,y){this.b=[x,y]},stroke(){rows.push(this.arcRow?{kind:2,r:this.arcRow[2],a:this.arcRow.slice(0,2),w:this.lineWidth}:{kind:0,a:this.a,b:this.b,w:this.lineWidth});this.arcRow=null},fillRect(x,y,w,h){rows.push({kind:1,a:[x+w/2,y+h/2],r:w/2})},arc(...a){this.arcRow=a}};
  const g={ctx,cx:330,cy:250,R:80,dens,beat,bar:.25,lw,NB:64,peaks:Array.from({length:64},(_,i)=>i/65),band:f=>.2+f*.65,mix:()=>'',col:f=>[100+f*20,125,210],glow(){},noGlow(){}};
  c.preset.draw(g);const out=new Float32Array(4350),n=c.neon.geometry(g,out);assert.equal(n,rows.length);
  const close=(a,b)=>assert.ok(Math.abs(a-b)<.0001,`${a} != ${b}`);
  rows.forEach((r,i)=>{const a=out.subarray(i*15,i*15+15);assert.equal(a[5],r.kind);close(a[0],r.a[0]);close(a[1],r.a[1]);if(r.kind===0){close(a[2],r.b[0]);close(a[3],r.b[1]);close(a[4]*2,r.w)}else{close(a[4],r.r);if(r.kind===2)close(a[7]*2,r.w)}});
 }
});
test('Canvas preset is byte-identical to panel8',()=>{const extract=s=>s.slice(s.indexOf("  B.push({ id: 'radial'"),s.indexOf("  B.push({ id: 'scope'"));assert.equal(extract(fs.readFileSync('renderer/viz.js','utf8')),extract(fs.readFileSync('tests/viz-panel8-reference.txt','utf8')))});
