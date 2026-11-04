import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {scenarios} from '../public/scenarios.js';

const read = path => readFileSync(new URL(path,import.meta.url),'utf8');

class MockElement {
  constructor(tag='div') {
    this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.value='';this.style={};this.className='';this.textContent='';this.hidden=false;
    this.classList={add:()=>{},remove:()=>{},toggle:()=>{}};
  }
  addEventListener() {}
  setAttribute() {}
  append(...children) {this.children.push(...children);}
  replaceChildren(...children) {this.children=children;}
  querySelectorAll() {return [];}
}

function flatten(element) {
  return [element,...element.children.flatMap(x=>x instanceof MockElement?flatten(x):[])];
}

test('GitHub Pages delivers a self-contained classic script and reports missing startup',()=>{
  const html=read('../public/index.html');
  const bundle=read('../public/workbench.js');
  const guard=read('../public/boot-guard.js');
  assert.match(html,/<script defer src="\.\/workbench\.js\?v=0\.7\.0"><\/script>/);
  assert.match(html,/<script defer src="\.\/boot-guard\.js\?v=0\.7\.0"><\/script>/);
  assert.doesNotMatch(html,/<script type="module"/);
  assert.doesNotMatch(bundle,/^import \{scenarios as examples\} from/m);
  assert.match(bundle,/const scenarios = \[/);
  assert.match(guard,/Unable to load the scenario library/);
});

test('Browser entry actually renders all samples before async analysis',()=>{
  const elements=new Map();
  const element=id=>{if(!elements.has(id))elements.set(id,new MockElement());return elements.get(id);};
  element('level-filter').value='all';element('platform').value='canvas';element('locale').value='en-US';
  const window={addEventListener:()=>{}};
  const context={
    window, document:{getElementById:element,createElement:tag=>new MockElement(tag),querySelectorAll:()=>[]},
    location:{protocol:'https:',hostname:'localhost'},
    localStorage:{getItem:()=>null,setItem:()=>{}},
    fetch:async()=>({ok:true,json:async()=>({valid:true,inputs:[]})}),
    structuredClone,clearTimeout,setTimeout,console,
  };
  runInNewContext(read('../public/workbench.js'),context,{timeout:2500});
  assert.equal(window.__powerFxWorkbenchReady,true);
  assert.equal(element('example-count').textContent,String(scenarios.length));
  const rows=flatten(element('examples')).filter(x=>x.tagName==='BUTTON'&&x.className.includes('example-button'));
  assert.equal(rows.length,scenarios.length);
  assert.ok(rows.some(x=>flatten(x).some(y=>y.textContent==='Inventory to replenish')));
  assert.ok(rows.some(x=>flatten(x).some(y=>y.textContent==='Expense approval escalation')));
});
