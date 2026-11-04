import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {scenarios} from '../public/scenarios.js';
import {evaluate} from '../src/evaluator.js';

const from=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const html=from('../public/index.html'),app=from('../public/app.js'),server=from('../src/server.js');

test('Library QA exposes accessible controls with explicit local execution disclosure',()=>{
 for(const id of ['library-scope','library-run','library-cancel','library-progress','library-summary','library-download','library-results'])assert.match(html,new RegExp(`id="${id}"`));
 assert.match(html,/Local compatibility baseline only/);
 assert.match(app,/engine:'local'/);
 assert.match(server,/data\.engine!=='local'/);
 assert.match(html,/aria-live/); // error/status output remains live for screen readers
});
test('Library regression baseline is executable with shipped, immutable synthetic inputs',()=>{
 assert.equal(scenarios.length,99);
 const before=JSON.stringify(scenarios);
 const tally={canvas:{passed:0,failed:0},flow:{passed:0,failed:0}};
 for(const example of scenarios){
   const result=evaluate({formula:example.formula,platform:example.platform,inputs:example.inputs,expected:example.expected,engine:'local'});
   tally[example.platform][result.assertion?.passed?'passed':'failed']++;
 }
 assert.deepEqual(tally,{canvas:{passed:69,failed:0},flow:{passed:30,failed:0}});
 assert.equal(JSON.stringify(scenarios),before);
});
test('Library client has a cancellation and versioned report download path',()=>{
 assert.match(app,/libraryRunId\+\+/);
 assert.match(app,/if\(id!==libraryRunId\)return/);
 assert.match(app,/powerfx-library-regression\.json/);
 assert.match(app,/results\.filter\(row=>!row\.passed\)/);
 assert.match(html,/v=0\.7\.0/);
});
test('New business examples use the actual implemented table operations',()=>{
 for(const name of ['GroupBy','Ungroup','RenameColumns','SortByColumns']){
   assert.ok(scenarios.some(s=>s.platform==='canvas'&&s.formula.toLowerCase().includes(name.toLowerCase()+'(')),name);
 }
 assert.ok(scenarios.filter(s=>s.id.includes('group')).length>=7);
});
