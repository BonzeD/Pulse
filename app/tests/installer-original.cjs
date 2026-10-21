// Invert approved complete string literals; never rewrite NSIS identifiers or paths.
module.exports=s=>{s=require('./final-original.cjs')('build/installer.nsi',s);const map=require('./installer-english-map.json'),inv=Object.fromEntries(Object.entries(map).map(([ru,en])=>[en,ru]));return s.replace(/"[^"\n]*"/g,q=>inv[q]||q).replaceAll('/LANG=1033','/LANG=1049').replaceAll('werxapee','Bon_zeD');};
