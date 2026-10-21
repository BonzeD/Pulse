/* Reproducible, offline renderer build after npm ci. Bundled deps are dev-only. */
const esbuild=require('esbuild');const path=require('path');
esbuild.buildSync({entryPoints:[path.join(__dirname,'../renderer/graphics/immersion-scene.entry.mjs')],outfile:path.join(__dirname,'../renderer/immersion-scene.js'),bundle:true,minify:true,format:'iife',target:'chrome120',legalComments:'eof'});
console.log('Built local Three.js Immersion renderer');
