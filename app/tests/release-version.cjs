// 1.0.0: own application versions must agree; dependency/client versions are unrelated.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
test('Pulse package, lockfile, plugin API, Mineradio host and installer defaults are 1.0.0',()=>{
 const read=f=>fs.readFileSync(path.join(root,f),'utf8');const pkg=JSON.parse(read('package.json')),lock=JSON.parse(read('package-lock.json'));
 assert.equal(pkg.version,'1.0.0');assert.equal(lock.version,pkg.version);assert.equal(lock.packages[''].version,pkg.version);
 for(const file of ['renderer/api.js','renderer/mineradio-host.js'])assert.match(read(file),/version: '1\.0\.0'/);
 assert.match(read('build/installer.nsi'),/!define VERSION "1\.0\.0"/);
 assert.match(read('build/make-setup.sh'),/require\('..\/package.json'\).version/);
 assert.equal(pkg.devDependencies.electron,'44.8.0');assert.equal(pkg.devDependencies.resedit,'^2.0.3');
});
// Generated artwork is gitignored and does not exist in a clean GitHub checkout.
// Validate it after a build; source/version checks above always run.
test('generated installer artwork matches 1.0.0 at every DPI', {skip: !fs.existsSync(path.join(root,'build/installer-ui/out/.version'))}, ()=>{
 const read=f=>fs.readFileSync(path.join(root,f),'utf8');
 assert.equal(read('build/installer-ui/out/.version').trim(),'1.0.0');
 for(const scale of [100,125,150,175,200]){const b=fs.readFileSync(path.join(root,'build/installer-ui/out',String(scale),'wel_bg.bmp'));assert.equal(b.toString('ascii',0,2),'BM');assert.equal(b.readInt32LE(18),680*scale/100);assert.equal(b.readInt32LE(22),440*scale/100);}
});
test('all first-party JavaScript files parse after version-label replacement',()=>{
 const vm=require('node:vm');
 const dirs=['','renderer','build','build/installer-ui'];let checked=0;
 for(const dir of dirs){const full=path.join(root,dir);for(const name of fs.readdirSync(full)){
  if(!name.endsWith('.js')||!fs.statSync(path.join(full,name)).isFile())continue;
  new vm.Script(fs.readFileSync(path.join(full,name),'utf8'),{filename:path.join(dir,name)});checked++;
 }}assert.ok(checked>45);
});
