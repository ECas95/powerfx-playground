import test from 'node:test';
import assert from 'node:assert/strict';
import {lessons} from '../public/lessons.js';
import {evaluate} from '../src/evaluator.js';
import {gradeStep,runWalkthrough,normalizeProgress,progressStats,unlockedStep,structurallyEqual,lessonFixtures,LEVELS} from '../public/learn-core.js';

const ids = new Set();
test('Learning library has progressive levels and unique multi-step lessons',()=>{
  assert.ok(lessons.length>=12);
  assert.ok(lessons.reduce((n,l)=>n+l.steps.length,0)>=40);
  for(const lesson of lessons){
    assert.ok(!ids.has(lesson.id));ids.add(lesson.id);
    assert.ok(LEVELS.includes(lesson.level));
    assert.ok(lesson.steps.length>=3);
    assert.ok(lesson.goal&&lesson.title&&lesson.subtitle&&lesson.skills.length>=2);
    assert.ok(lessonFixtures(lesson).length>=2);
    for(const step of lesson.steps)assert.ok(step.title&&step.instruction&&step.hint&&step.why&&step.solution);
  }
  assert.ok(lessons.some(x=>x.level==='Boss'));
  assert.ok(lessons.some(x=>x.platform==='flow'));
});
test('Structural comparison ignores record field order but not array order',()=>{
  assert.ok(structurallyEqual([{a:2,b:1}], [{b:1,a:2}]));
  assert.equal(structurallyEqual([1,2],[2,1]),false);
  assert.equal(structurallyEqual({a:1},{a:2}),false);
  assert.equal(structurallyEqual({a:1},{a:1,b:2}),false);
});
test('Progress loading validates contiguous answered prefix and rejects arbitrary keys',()=>{
  const l=lessons[0];const dirty={[l.id]:['Filter(Tickets, Status="Open")',32],badid:['foo']};
  const result=normalizeProgress(dirty,lessons);
  assert.equal(result[l.id].length,1);assert.equal(Object.hasOwn(result,'badid'),false);
  assert.equal(unlockedStep(l,result),1);
  assert.equal(progressStats(lessons,result).completed,1);
});
for(const lesson of lessons){
  test(`Official walkthrough executes every step and fixture: ${lesson.id}`,async()=>{
    const runs=await runWalkthrough(lesson,evaluate);
    assert.equal(runs.length,lessonFixtures(lesson).length);
    for(const item of runs){assert.equal(item.steps.length,lesson.steps.length);for(const s of item.steps)assert.equal(s.success,true,`${lesson.id} ${item.name} step ${s.index+1}: ${s.error?.message}`);}
  });
  test(`Learner can pass all steps through progressive grading: ${lesson.id}`,async()=>{
    const prior=[];
    for(const [i,step] of lesson.steps.entries()){
      const grade=await gradeStep({lesson,stepIndex:i,formula:step.solution,previous:prior,run:evaluate});
      assert.equal(grade.passed,true,`${lesson.id} step ${i+1} ${JSON.stringify(grade.cases)}`);
      prior.push(step.solution);
    }
  });
}
test('Incorrect formula must fail on divergent primary/alternate fixtures',async()=>{
  const lesson=lessons.find(x=>x.id==='queue-triage');
  const g=await gradeStep({lesson,stepIndex:0,formula:'Filter(Tickets, Status="Closed")',previous:[],run:evaluate});
  assert.equal(g.passed,false);assert.ok(g.cases.some(x=>!x.passed));
});
test('Bare literal does not pass condition-sensitive challenge variants',async()=>{
  const lesson=lessons.find(x=>x.id==='flow-idempotency');
  const g=await gradeStep({lesson,stepIndex:0,formula:'true',previous:[],run:evaluate});
  assert.equal(g.passed,false);
});
test('Trace training requires event payload and severity, not only a null result',async()=>{
  const lesson=lessons.find(x=>x.id==='trace-decisions');
  const prior=lesson.steps.slice(0,2).map(x=>x.solution);
  const g=await gradeStep({lesson,stepIndex:2,formula:'Blank()',previous:prior,run:evaluate});
  assert.equal(g.passed,false);
  assert.equal(g.cases[0].actual.value,null);
  assert.equal(g.cases[0].actual.traces.length,0);
});
test('Errors show feedback without throwing and do not unlock',async()=>{
  const lesson=lessons[0];
  const g=await gradeStep({lesson,stepIndex:0,formula:'Filter(',previous:[],run:evaluate});
  assert.equal(g.passed,false);assert.ok(g.cases[0].error);
});
test('Learning progress cannot bypass prerequisites',async()=>{
  const g=await gradeStep({lesson:lessons[0],stepIndex:2,formula:'true',previous:[],run:evaluate});
  assert.equal(g.passed,false);assert.match(g.message,/earlier/i);
});
