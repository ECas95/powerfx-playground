import test from 'node:test';
import assert from 'node:assert/strict';
import {scenarios} from '../public/scenarios.js';
import {evaluate,inspect} from '../src/evaluator.js';

const ids=new Set();
for(const scenario of scenarios){
  test(`Scenario executes: ${scenario.platform}/${scenario.id}`,()=>{
    assert.equal(ids.has(scenario.id),false,`Duplicate scenario ID ${scenario.id}`);ids.add(scenario.id);
    assert.ok(scenario.name && scenario.group && scenario.description && scenario.level);
    assert.ok(['canvas','flow'].includes(scenario.platform));
    const analysis=inspect({platform:scenario.platform,formula:scenario.formula});
    assert.equal(analysis.valid,true);
    for(const dependency of analysis.inputs){assert.ok(Object.hasOwn(scenario.inputs,dependency.key),`Missing mock ${dependency.key}`);}
    const result=evaluate({platform:scenario.platform,formula:scenario.formula,inputs:scenario.inputs,expected:scenario.expected});
    assert.equal(result.success,true);
    assert.equal(result.assertion.passed,true,`${scenario.id}: expected ${JSON.stringify(scenario.expected)} got ${JSON.stringify(result.value)}`);
  });
}
test('Includes substantive real-world scenarios for both languages',()=>{
  assert.ok(scenarios.length>=30);
  for(const platform of ['canvas','flow']){
    assert.ok(scenarios.filter(e=>e.platform===platform&&e.level==='Advanced').length>=5);
  }
});
