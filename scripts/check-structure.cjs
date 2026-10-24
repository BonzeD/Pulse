'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),app=path.join(root,'app');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const pkg=JSON.parse(read('package.json')),actual=JSON.parse(read('app/package.json'));
assert.match(pkg.version,/^\d+\.\d+\.\d+$/);assert.equal(actual.version,pkg.version);assert.equal(pkg.private,true);
assert.equal(actual.main,'main.js');assert.ok(fs.existsSync(path.join(app,actual.main)));
assert.equal(pkg.scripts.postinstall,'npm --prefix app ci');assert.equal(pkg.scripts.start,'npm --prefix app run start');
assert.equal(JSON.parse(read('package-lock.json')).version,pkg.version);
assert.equal(JSON.parse(read('app/package-lock.json')).version,pkg.version);
for(const dir of ['renderer','build','native','resources','tests','tools'])assert.ok(fs.statSync(path.join(app,dir)).isDirectory(),dir);
for(const name of ['main.js','renderer','build','native','resources','tests','tools'])assert.ok(!fs.existsSync(path.join(root,name)),'obsolete root entry '+name);
const workflow=read('.github/workflows/build.yml');assert.match(workflow,/working-directory: app/);assert.match(workflow,/cache-dependency-path: app\/package-lock\.json/);assert.match(workflow,/path: app\/dist\/\*\.exe/);
assert.match(read('.gitignore'),/app\/build\/installer-ui\/out\//);assert.match(read('.gitignore'),/!app\/resources\/media-bridge\/\.gitkeep/);
assert.equal(read('LICENSE'),read('app/LICENSE'));
for(const name of ['README.md','Logs/1.0.2.md','.maintenance/ai/oldlogs/REPOSITORY-LAYOUT.md','.maintenance/ai/oldlogs/development/FOR AI.md'])assert.ok(read(name).length>100,name);
const map=JSON.parse(read('.maintenance/ai/oldlogs/manifests/REORGANIZATION-MAP.json'));
assert.ok(!fs.existsSync(path.join(root,'AGENTS.md')));assert.ok(!fs.existsSync(path.join(root,'docs')));
for(const f of map.files){
 if(f.after==='AGENTS.md')continue;
 f.after=f.after.replace(/^docs\//,'.maintenance/ai/oldlogs/');
 assert.ok(fs.existsSync(path.join(root,f.after)),f.after);
 if(f.after.startsWith('.maintenance/ai/oldlogs/history/'))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f.after))).digest('hex'),f.sha256Before,'historical report changed: '+f.after);
}
for(const entry of actual.build.files.filter(s=>!s.includes('*')))assert.ok(fs.existsSync(path.join(app,entry)),'missing package input '+entry);
for(const entry of actual.build.extraResources)assert.ok(fs.existsSync(path.join(app,entry.from)),'missing extraResources input '+entry.from);
assert.ok(fs.existsSync(path.join(app,'resources/yt-dlp/_internal/base_library.zip')));
const entries=fs.readdirSync(root).filter(s=>!['node_modules','.git'].includes(s));assert.ok(entries.length<=12,'repository root is no longer compact');
console.log('PASS repository structure: '+entries.length+' top-level entries; '+map.files.length+' original paths retained; historical reports unchanged; npm/CI/package paths valid.');
