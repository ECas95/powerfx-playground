import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeCommunityPack,verifyCommunityPack} from '../public/learning-extras.js';
import {runWalkthrough} from '../public/learn-core.js';
import {evaluate} from '../src/evaluator.js';

const directory=fileURLToPath(new URL('../public/packs/',import.meta.url));
const files=(await readdir(directory)).filter(name=>name.endsWith('.json')).sort();
if(!files.length)throw Error('No community JSON packs found.');
let count=0;
for(const name of files){
  const data=JSON.parse(await readFile(path.join(directory,name),'utf8'));
  const pack=normalizeCommunityPack(data);
  const result=await verifyCommunityPack(pack,evaluate,runWalkthrough);
  count+=result.lessons;
  console.log(`✓ ${name}: ${result.lessons} lesson(s), ${result.steps} step(s)`);
}
console.log(`Community packs verified: ${files.length} file(s), ${count} lesson(s)`);
