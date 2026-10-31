import {cp,mkdir,rm,writeFile} from 'node:fs/promises';
const output=new URL('../dist/',import.meta.url);
await rm(output,{recursive:true,force:true});
await mkdir(new URL('./core/',output),{recursive:true});
await cp(new URL('../public/',import.meta.url),output,{recursive:true});
await cp(new URL('../src/parser.js',import.meta.url),new URL('./core/parser.js',output));
await cp(new URL('../src/evaluator.js',import.meta.url),new URL('./core/evaluator.js',output));
await writeFile(new URL('./.nojekyll',output),'');
console.log('Static GitHub Pages bundle ready in dist/ (local, restricted evaluators only)');
