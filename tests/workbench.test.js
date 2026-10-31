import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const script=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const styles=readFileSync(new URL('../public/styles.css',import.meta.url),'utf8');

test('Workbench retains functional evaluator selectors',()=>{
  const required=['formula','platform','locale','run-button','analyze-button','formula-status','input-fields','input-count','expected','result-json','result-table','result-type','result-time','assertion','error-detail','scenario-file','import-button','export-button','copy-result','history-items'];
  for(const id of required)assert.match(html,new RegExp(`id="${id}"`),`Missing required element: ${id}`);
});
test('Workbench uses independent repo and no Visualizer imports',()=>{
  assert.match(html,/https:\/\/github\.com\/ECas95\/powerfx-playground/);
  assert.doesNotMatch(script,/canvas-app-visualizer/);
  assert.match(styles,/\.workbench-grid/);
});
test('Workbench supports keyboard-friendly inspector and output views',()=>{
  assert.match(html,/data-result-view="json"/);
  assert.match(html,/data-result-view="table"/);
  assert.match(html,/data-tab="inputs"/);
  assert.match(html,/data-tab="tests"/);
  assert.match(html,/data-tab="help"/);
  assert.match(script,/event\.key==='Tab'/);
});
