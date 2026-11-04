import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {lessons} from '../public/lessons.js';
const page=readFileSync(new URL('../public/learn.html',import.meta.url),'utf8');
const client=readFileSync(new URL('../public/learn.js',import.meta.url),'utf8');
const styles=readFileSync(new URL('../public/learn.css',import.meta.url),'utf8');
const workbench=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const server=readFileSync(new URL('../src/server.js',import.meta.url),'utf8');

test('Learning Lab is reachable through a visible workbench navigation link',()=>{
  assert.match(workbench,/href="\.\/learn\.html"/);
  assert.match(page,/href="\.\/"/);
  assert.match(page,/src="\.\/learn\.js\?v=0\.8\.0"/);
  assert.match(page,/src="\.\/learn-guard\.js\?v=0\.8\.0"/);
  assert.match(server,/pathname==='\/core\/evaluator\.js'/);
});
test('All referenced interactive controls exist and have IDs',()=>{
  const ids=[...client.matchAll(/\$\('([^']+)'\)/g)].map(x=>x[1]);
  for(const id of ids)assert.ok(page.includes(`id="${id}"`),`Missing learning UI element: ${id}`);
});
test('Both learning faces are independently present and accessible',()=>{
  for(const id of ['mode-challenge','mode-walkthrough','challenge-panel','walkthrough-panel','lesson-feedback','step-hint','run-walkthrough','check-step','challenge-dataset','walkthrough-dataset']){
    assert.match(page,new RegExp(`id="${id}"`));
  }
  assert.match(page,/role="tabpanel"/);
  assert.match(page,/aria-live="polite"/);
  assert.match(styles,/max-width:650px/);
});
test('Lessons have guidance and explanations instead of bare syntax samples',()=>{
  for(const l of lessons){
    for(const s of l.steps){
      assert.ok(s.instruction.length>20,l.id);
      assert.ok(s.why.length>20,l.id);
      assert.ok(s.hint.length>10,l.id);
    }
  }
});
