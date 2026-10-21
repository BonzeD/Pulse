'use strict';
// 1.0.1: never recursively delete an arbitrary user-selected installation directory.
const fs=require('fs'),path=require('path');
function manifest(root){
 const files=[],dirs=[];
 function walk(dir,rel=''){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(rel,e.name);if(e.isDirectory()){dirs.push(p);walk(path.join(dir,e.name),p);}else if(e.isFile())files.push(p);else throw Error('Unexpected symlink/special file: '+p);}}
 walk(root);const quote=s=>s.replace(/\$/g,'$$$$').replace(/"/g,'$\\"').replace(/\//g,'\\');
 return '; 1.0.1: generated package-owned files only; preserve unrelated user files.\n'+files.sort().map(f=>'Delete /REBOOTOK "$INSTDIR\\'+quote(f)+'"').join('\n')+'\n'+
 'Delete /REBOOTOK "$INSTDIR\\Uninstall Pulse.exe"\n'+dirs.sort((a,b)=>b.split(path.sep).length-a.split(path.sep).length||b.localeCompare(a)).map(d=>'RMDir "$INSTDIR\\'+quote(d)+'"').join('\n')+'\nRMDir "$INSTDIR"\n';
}
if(require.main===module)fs.writeFileSync(path.join(__dirname,'uninstall-files.nsh'),manifest(process.argv[2]||path.resolve(__dirname,'../dist/win-unpacked')));
module.exports={manifest};
