// Рендерит экраны установщика (design.html) во всех масштабах DPI → out/raw/*.png + rects.json
// 1.0.0: + кадры анимаций (эквалайзер, блик логотипа, нажатие кнопок, ход переключателей, значок «готово»)
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const V=process.argv[2]||require('../../package.json').version, SIZE=process.argv[3]||'420';
const SCALES=[100,125,150,175,200];
const exe=[process.env.CHROMIUM,'/usr/local/bin/chromium','/usr/bin/chromium','/usr/bin/chromium-browser'].find(p=>p&&fs.existsSync(p));
// каждая работа: имя → {st, q}; q — доп. параметры кадра
const J=(st,q)=>({st:st||{},q:q||{}});
const head=pg=>{const o={};for(let i=0;i<12;i++){o['c'+i]=J({},{wf:i,lf:i<8?i:0});o['x'+i]=J({},{wf:i,wx:1})}return o};
const JOBS={
 wel:{0:J(),1:J({go:'h',browse:'h',t1:'on h',t2:'on h'}),2:J({t1:'off',t2:'off'}),3:J({t1:'off h',t2:'off h'}),p:J({go:'p',browse:'p'}),k1:J({t1:'k1',t2:'k1'}),k2:J({t1:'k2',t2:'k2'}),k3:J({t1:'k3',t2:'k3'}),...head()},
 upd:{0:J(),1:J({go:'h'}),p:J({go:'p'}),...head()},
 prog:{0:J()}, uprog:{0:J()},
 fin:{0:J(),1:J({run:'h',close:'h'}),p:J({run:'p',close:'p'}),...Object.fromEntries([0,1,2,3,4,5,6,7].map(i=>['s'+i,J({},{lf:i})])),...Object.fromEntries([0,.35,.7,1,1.22,1.12,.96,1].map((b,i)=>['b'+i,J({},{bd:b})]))},
 udone:{0:J(),1:J({close:'h'}),p:J({close:'p'}),...Object.fromEntries([0,1,2,3,4,5,6,7].map(i=>['s'+i,J({},{lf:i})]))},
 ucf:{0:J(),1:J({cancel:'h',go:'h',u1:'on h',u2:'off h'}),2:J({u1:'off',u2:'on'}),3:J({u1:'off h',u2:'on h'}),p:J({cancel:'p',go:'p'}),k1:J({u1:'k1',u2:'k1'}),k2:J({u1:'k2',u2:'k2'}),k3:J({u1:'k3',u2:'k3'}),...head()},
};
(async()=>{const b=await chromium.launch(exe?{executablePath:exe}:{});
fs.mkdirSync(path.join(__dirname,'out/raw'),{recursive:true});const rects={};
for(const s of SCALES){const p=await b.newPage({viewport:{width:680,height:440},deviceScaleFactor:s/100});
 for(const [pg,jobs] of Object.entries(JOBS)) for(const [k,j] of Object.entries(jobs)){
  const q=new URLSearchParams({p:pg,v:V,size:SIZE,st:JSON.stringify(j.st),...j.q});
  await p.goto('file://'+__dirname+'/design.html?'+q);
  await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(30);
  await p.screenshot({path:path.join(__dirname,`out/raw/${pg}_${k}_${s}.png`)});
  if(s===100&&k==='0') rects[pg]=await p.evaluate(()=>RECTS);
 } await p.close();}
fs.writeFileSync(path.join(__dirname,'out/rects.json'),JSON.stringify(rects,null,1));await b.close();process.exit(0)})();
