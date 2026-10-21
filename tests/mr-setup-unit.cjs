const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(p,'utf8');
function wakeFixture(){
 const s=read('renderer/mineradio-host.js'),a=s.indexOf('wake: (x, y) => {')+6,b=s.indexOf('\n    ready:',a),calls=[];
 const ctx={MR:{frame:{clientWidth:1000,clientHeight:500,getBoundingClientRect:()=>({left:20,top:40,width:500,height:250})}},Number,PointerEvent:class{constructor(type,options){Object.assign(this,{type},options);}},document:{dispatchEvent:e=>calls.push(e)},lysWake:()=>calls.push('wake')};
 return {ctx,calls,fn:vm.runInNewContext('('+s.slice(a,b).trim().replace(/,$/,'')+')',ctx)};
}
test('MineRadio pointer coordinates translate from scaled iframe into parent viewport',()=>{const {fn,calls}=wakeFixture();fn(800,400);assert.equal(calls[0].clientX,420);assert.equal(calls[0].clientY,240);assert.equal(calls[0].bubbles,true);assert.equal(calls[1],'wake');});
test('MineRadio no-argument wake and malformed coordinates never invent a pointer at zero',()=>{const {fn,calls}=wakeFixture();for(const p of [[],[NaN,10],[20,Infinity],['30',40]])fn(...p);assert.deepEqual(calls,['wake','wake','wake','wake']);});
test('MineRadio zero-sized unloaded frame is safe, and fast final moves are not throttled',()=>{const {fn,ctx,calls}=wakeFixture();ctx.MR.frame.clientWidth=0;fn(1,1);assert.deepEqual(calls,['wake']);ctx.MR.frame=null;fn(1,1);assert.equal(calls.length,2);const src=read('renderer/mineradio/pulse-bridge.js'),line=src.split('\n').find(l=>l.includes("W.addEventListener('pointermove'"));let listener;const points=[];vm.runInNewContext(line,{W:{addEventListener:(_n,f)=>listener=f},H:{wake:(...p)=>points.push(p)}});for(const [x,y] of [[100,100],[200,200],[680,740]])listener({clientX:x,clientY:y});assert.deepEqual(points,[[100,100],[200,200],[680,740]]);});

// Source-driven model: execute the real validation function's NSIS commands/LogicLib
// branches. Only GetFullPathName and Windows shell-folder expansion are modeled.
// This is NOT a native Windows installer runtime test.
function validate(input){
 const vars={InstallPath:input,WINDIR:'C:\\Windows',SYSDIR:'C:\\Windows\\System32',PROFILE:'C:\\Users\\QA',DESKTOP:'C:\\Users\\QA\\Desktop',DOCUMENTS:'C:\\Users\\QA\\Documents',PROGRAMFILES:'C:\\Program Files',PROGRAMFILES64:'C:\\Program Files',LOCALAPPDATA:'C:\\Users\\QA\\AppData\\Local',APPDATA:'C:\\Users\\QA\\AppData\\Roaming',1:'clobbered',2:'0'};
 const value=t=>String(t).replace(/\$\{NSIS_MAX_STRLEN\}/g,'1024').replace(/^"|"$/g,'').replace(/\$([\w]+)/g,(_,k)=>vars[k]??'');
 const cond=s=>{const m=s.match(/^(\S+) (==|!=|<=|>=) (.+)$/);assert.ok(m,s);const a=value(m[1]),b=value(m[3]);return m[2]==='=='?a.toLowerCase()===b.toLowerCase():m[2]==='!='?a.toLowerCase()!==b.toLowerCase():m[2]==='<='?+a<=+b:+a>=+b;};
 const lines=read('build/install-path.nsh').split('\n').map(s=>s.trim()).filter(s=>s&&!s.startsWith(';'));
 let pc=lines.findIndex(l=>l==='Function ValidateInstallPath')+1,steps=0,loop=-1;
 const skipIf=()=>{let depth=0;for(;pc<lines.length;pc++){if(lines[pc].startsWith('${If}'))depth++;if(lines[pc]==='${EndIf}'){if(!depth){pc++;return;}depth--;}if(!depth&&lines[pc]==='${Else}'){pc++;return;}}};
 while(pc<lines.length&&++steps<1000){const l=lines[pc++];
  if(l==='Return'||l==='FunctionEnd')break;
  if(l.startsWith("System::Call 'kernel32::GetFullPathNameW")){vars[0]=path.win32.resolve(vars.InstallPath);vars[1]=String(vars[0].length);continue;}
  if(l.startsWith('Goto ')){pc=lines.indexOf(l.slice(5)+':')+1;continue;}
  if(l==='${Do}'){loop=pc;continue;}if(l==='${Loop}'){pc=loop;continue;}
  if(l==='${ExitDo}'){pc=lines.indexOf('${Loop}',pc)+1;continue;}
  if(l.startsWith('${If}')){let ok=cond(l.slice(6));while(lines[pc]?.startsWith('${OrIf}')){ok=cond(lines[pc++].slice(8))||ok;}if(!ok)skipIf();continue;}
  if(l==='${Else}'){while(lines[pc++]!=='${EndIf}'){}continue;}if(l==='${EndIf}'||l==='ClearErrors'||l.startsWith('IfErrors '))continue;
  let m;if((m=l.match(/^StrCpy \$(\w+) ("[^"]*"|\S+)(?: (-?\d+))?(?: (-?\d+))?$/))){let v=value(m[2]);const len=m[3]==null?null:+m[3],offset=m[4]==null?0:+m[4];if(offset)v=offset<0?v.slice(offset):v.slice(offset);if(len!==null)v=len<0?v.slice(0,len):v.slice(0,len);vars[m[1]]=v;continue;}
  if((m=l.match(/^StrLen \$(\w+) (.+)$/))){vars[m[1]]=String(value(m[2]).length);continue;}
  if((m=l.match(/^GetFullPathName \$(\w+) (.+)$/))){vars[m[1]]=path.win32.resolve(value(m[2]));continue;}
  throw Error('Unsupported NSIS command: '+l);
 }
 assert.ok(steps<1000,'validator terminates');return vars;
}
test('Real NSIS validation source accepts dedicated C/D folders, spaces, Cyrillic and non-existent directories (modeled Windows paths)',()=>{for(const p of ['D:\\Apppp\\Pulse','D:\\Pulse','D:\\Музыка\\Мой Pulse','C:\\Program Files\\Pulse','C:\\Users\\QA\\AppData\\Local\\Programs\\Pulse','D:\\Apps\\Pulse\\  ']){const r=validate(p);assert.equal(r.InstallPathPart,'',p);assert.ok(+r.InstallPathLength>3);}});
test('Real NSIS validation source rejects drive roots, traversal into roots, shell directories and relative paths (model)',()=>{for(const p of ['','D:','D:\\','D:\\Apps\\..','C:\\','C:\\Windows','c:\\windows','C:\\Windows\\System32','C:\\Users\\QA','C:\\Users\\QA\\Downloads','C:\\Program Files','C:\\Users\\QA\\Desktop','C:\\Users\\QA\\Documents','C:\\Users\\QA\\AppData\\Local','Pulse','Apps\\Pulse'])assert.notEqual(validate(p).InstallPathPart,'',p);});
test('installer design/logic from supplied archive is retained (only requested English copy and author rename), with owned-file uninstall and current path validation',()=>{const s=read('build/installer.nsi');assert.equal(require('node:crypto').createHash('sha256').update(require('./installer-original.cjs')(s)).digest('hex'),'e35330644c1e6870cc06862510a1d07ea7bedd07cab849f74bcc931c68ec2aaa');assert.doesNotMatch(s,/!include "MUI2\.nsh"|RMDir \/r "\$INSTDIR"/);assert.match(s,/CreateMutex\(/);assert.match(s,/GetTempFileName \$InstallProbe "\$InstallPath"/);assert.match(s,/FileWrite \$InstallProbeHandle/);assert.match(s,/Call ValidateInstallPath/);assert.match(s,/File \/r "\$\{APPDIR\}\\\*\.\*"\s+IfErrors install_copy_failed/);assert.ok(s.includes('!include "uninstall-files.nsh"'));});

test('Installer normalizes missing target folders through Windows API, never legacy NSIS GetFullPathName opcode',()=>{const s=read('build/install-path.nsh');assert.match(s,/kernel32::GetFullPathNameW/);assert.doesNotMatch(s,/^\s*GetFullPathName /m);});
