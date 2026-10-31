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

test('JSON input supports manual resizing and fullscreen editing',()=>{
  for(const id of ['json-editor-dialog','json-modal-text','json-modal-error','json-editor-format','json-editor-save','json-editor-cancel','expand-expected']){
    assert.match(html,new RegExp(`id="${id}"`),`Missing JSON editor control: ${id}`);
  }
  assert.match(styles,/\.input-item textarea\{min-height:150px;max-height:none;resize:vertical/);
  assert.match(script,/function editJson\(field,name\)/);
  assert.match(script,/function saveJsonEditor\(\)/);
  assert.match(script,/JSON input updated/);
});
test('Scenario explorer includes use-case grouping and complexity filtering',()=>{
  assert.match(html,/id="level-filter"/);
  assert.match(html,/id="scenario-description"/);
  assert.match(script,/import \{scenarios as examples\} from '\.\/scenarios\.js'/);
  assert.match(script,/function showScenarioDetails\(/);
});
test('Scenario switching clears old field DOM before rendering selected inputs',()=>{
  assert.match(script,/inputs=structuredClone\(example\.inputs\);\$\('input-fields'\)\.replaceChildren\(\)/);
  assert.match(script,/inputs=structuredClone\(scenario\.inputs\);\$\('input-fields'\)\.replaceChildren\(\)/);
});
