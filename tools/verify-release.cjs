// 1.0.0: verify PE metadata, unsigned status, ASAR version and packed source equality.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function certificateSize(b){const pe=b.readUInt32LE(0x3c),opt=pe+24,is64=b.readUInt16LE(opt)===0x20b,dd=opt+(is64?112:96);return b.readUInt32LE(dd+4*8+4);}
(async()=>{const R=await import('resedit');const files=['win-unpacked/Pulse.exe','Pulse-1.0.0-portable.exe','Pulse-Setup-1.0.0.exe'];
 const report={version:require('../package.json').version,files:[],sourceMatches:0,normalizedDependencyMetadata:[]};assert.equal(report.version,'1.0.0');
 for(const f of files){const p=path.join(dist,f),buf=fs.readFileSync(p),nt=R.NtExecutable.from(buf),rs=R.NtExecutableResource.from(nt);const versions=R.Resource.VersionInfo.fromEntries(rs.entries);assert.ok(versions.length);
  const values=[];for(const v of versions){assert.equal(v.fixedInfo.fileVersionMS,65536);assert.equal(v.fixedInfo.fileVersionLS,0);assert.equal(v.fixedInfo.productVersionMS,65536);assert.equal(v.fixedInfo.productVersionLS,0);
   for(const l of v.getAllLanguagesForStringValues()){const s=v.getStringValues(l);assert.match(s.FileVersion,/^1\.0\.0(?:\.0)?$/);assert.match(s.ProductVersion,/^1\.0\.0(?:\.0)?$/);values.push({FileVersion:s.FileVersion,ProductVersion:s.ProductVersion,ProductName:s.ProductName});}}
  report.files.push({file:f,bytes:buf.length,sha256:hash(buf),signed:certificateSize(buf)>0,versions:values});
 }
 const asar=require('@electron/asar'),a=path.join(dist,'win-unpacked/resources/app.asar');assert.equal(JSON.parse(asar.extractFile(a,'package.json')).version,'1.0.0');
 for(const f of asar.listPackage(a)){const rel=f.replace(/^[/\\]/,''),p=path.join(root,rel);if(rel==='package.json'||!fs.existsSync(p)||!fs.statSync(p).isFile())continue;
  const packed=asar.extractFile(a,rel),current=fs.readFileSync(p);
  // electron-builder strips non-runtime npm metadata. Every code/asset file still
  // requires exact bytes; runtime package fields must remain structurally equal.
  if(hash(packed)!==hash(current)&&rel.startsWith('node_modules/')&&rel.endsWith('/package.json')){
   const expected=JSON.parse(current),actual=JSON.parse(packed),removed=[];
   for(const k of ['scripts','keywords','bugs','contributors','xo','ava','eslintConfig'])if(!(k in actual)&&k in expected){delete expected[k];removed.push(k);}
   assert.deepEqual(actual,expected,'Unexpected dependency metadata change: '+rel);
   report.normalizedDependencyMetadata.push({file:rel,removed});
  }else{assert.equal(hash(packed),hash(current),`Packed source differs: ${rel}`);report.sourceMatches++;}
 }
 assert.equal(fs.readFileSync(path.join(root,'build/installer-ui/out/.version'),'utf8').trim(),'1.0.0');
 console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exit(1);});
