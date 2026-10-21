const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/usr/local/bin/chromium'});
const [page,st,scale,out]=process.argv.slice(2);
const p=await b.newPage({viewport:{width:680,height:440},deviceScaleFactor:+scale});
await p.goto('file://'+__dirname+'/design.html?p='+page+'&st='+encodeURIComponent(st||'{}'));
await p.waitForTimeout(150);await p.screenshot({path:out});console.log(JSON.stringify(await p.evaluate(()=>RECTS)));await b.close();process.exit(0)})();
