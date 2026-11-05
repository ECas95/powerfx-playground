import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {lessons} from '../public/lessons.js';
import {evaluate} from '../src/evaluator.js';
import {gradeStep,runWalkthrough} from '../public/learn-core.js';
import {localizedLesson} from '../public/lesson-locales.js';
import {translate,diagnoseFormula,analyzeDelegation,delegationIllustration,generateStressFixture,normalizeCommunityPack,verifyCommunityPack,skillProgress,recommendLessons} from '../public/learning-extras.js';
const sample=JSON.parse(readFileSync(new URL('../public/packs/starter-pack.json',import.meta.url),'utf8'));

test('Bilingual curriculum translates all 12 lesson briefs, step titles, explanations, instructions and hints',()=>{
  for(const l of lessons){
    const translated=localizedLesson(l,'es');
    assert.notEqual(translated.title,l.title,l.id);
    assert.equal(translated.steps.length,l.steps.length);
    for(const [i,s] of translated.steps.entries()){
      assert.notEqual(s.title,l.steps[i].title,`${l.id} step ${i+1}`);
      assert.notEqual(s.instruction,l.steps[i].instruction,l.id);
      assert.notEqual(s.why,l.steps[i].why,l.id);
      assert.ok(s.hint.length>7);
      assert.equal(s.solution,l.steps[i].solution);
    }
    assert.equal(localizedLesson(l,'en'),l);
  }
  assert.match(translate('es','dataset.pass'),/fórmula/i);
  assert.match(translate('en','dataset.pass'),/formula/i);
});
test('Tutor provides progressive guidance by error category without returning the full solution',()=>{
  const step=lessons.find(l=>l.id==='invoice-correlation').steps[0];
  const broken=diagnoseFormula({formula:'Filter(',step,grade:{cases:[{passed:false,error:'Unexpected token'}]},lang:'es'});
  assert.equal(broken.code,'syntax');
  assert.equal(broken.hints.length,3);
  assert.equal(broken.error,'Unexpected token');
  assert.ok(!broken.hints.some(h=>h===step.solution));
  const literal=diagnoseFormula({formula:'true',step,grade:{cases:[{passed:false}]},lang:'en'});
  assert.equal(literal.code,'literal');
  const regex=diagnoseFormula({formula:'IsMatch(Email,"[")',step:lessons.find(l=>l.id==='data-quality-regex').steps[0],grade:{cases:[{passed:false}]},lang:'es'});
  assert.equal(regex.code,'regex');
});
test('Delegation Clinic handles source-specific risks conservatively and links official documentation',()=>{
  const g=analyzeDelegation('GroupBy(Filter(Orders,Total>10),Region,Rows)','dataverse');
  assert.equal(g.status,'risk');
  assert.ok(g.findings.some(f=>f.code==='nondelegable-family'));
  const sql=analyzeDelegation('Filter(Orders,IsBlank(Email))','sql');
  assert.equal(sql.status,'risk');
  assert.ok(sql.findings.some(f=>f.code==='sql-isblank'));
  const share=analyzeDelegation('Search(Orders,"foo",Title)','sharepoint');
  assert.equal(share.status,'risk');
  assert.ok(share.findings.some(f=>f.code==='sharepoint-search'));
  const candidate=analyzeDelegation('Filter(Orders, Total>100 && Status="Open")','dataverse');
  assert.equal(candidate.status,'candidate');
  assert.match(candidate.disclaimer,/Power Apps Studio/);
  assert.equal(candidate.docs.length,2);
  const membership=analyzeDelegation('Filter(Orders, "x" in Email)','dataverse');
  assert.ok(membership.findings.some(x=>x.code==='in-context'));
});
test('Truncation visualization explicitly models first-N row risk',()=>{
  const sample=delegationIllustration(650,500);
  assert.equal(sample.localMatches,0);
  assert.equal(sample.fullMatches,1);
  assert.equal(delegationIllustration(300,500).localMatches,1);
});
test('Generated fixtures are deterministic, bounded and do not mutate original lesson inputs',()=>{
  const l=lessons[0],before=JSON.stringify(l.inputs);
  const a=generateStressFixture(l,{seed:24,mode:'duplicates'});
  const b=generateStressFixture(l,{seed:24,mode:'duplicates'});
  assert.deepEqual(a,b);
  assert.equal(JSON.stringify(l.inputs),before);
  assert.ok(a.inputs.Tickets.length>l.inputs.Tickets.length);
  assert.notDeepEqual(generateStressFixture(l,{seed:25,mode:'boundaries'}).inputs,l.inputs);
  assert.throws(()=>generateStressFixture(l,{mode:'arbitrary'}),/Unknown/);
});
test('Generated stress fixtures are used as extra grading without awarding normal progress',async()=>{
 const l=lessons[0];
 const fixture=generateStressFixture(l,{seed:4,mode:'duplicates'});
 const grade=await gradeStep({lesson:l,stepIndex:0,formula:l.steps[0].solution,previous:[],run:evaluate,fixtures:[fixture]});
 assert.equal(grade.passed,true);
 assert.equal(grade.cases.length,1);
 assert.match(grade.cases[0].name,/Stress/);
});
test('Community example is schema-safe and executable on both datasets',async()=>{
 const pack=normalizeCommunityPack(sample,{existingIds:lessons.map(x=>x.id)});
 assert.equal(pack.lessons.length,1);
 assert.match(pack.lessons[0].id,/^community-/);
 assert.deepEqual(await verifyCommunityPack(pack,evaluate,runWalkthrough),{valid:true,lessons:1,steps:2});
 const g=await gradeStep({lesson:pack.lessons[0],stepIndex:0,formula:pack.lessons[0].steps[0].solution,previous:[],run:evaluate});
 assert.equal(g.passed,true);
});
test('Community input rejects reserved properties, oversized packs and missing variant data',()=>{
 const payload=JSON.parse(JSON.stringify(sample));
 payload.lessons[0].inputs=JSON.parse('{"__proto__":{"danger":true}}');
 assert.throws(()=>normalizeCommunityPack(payload),/Unsafe JSON property/);
 const big=JSON.parse(JSON.stringify(sample));big.title='x'.repeat(85000);
 assert.throws(()=>normalizeCommunityPack(big),/Fixture exceeds bounded/);
 const broken=JSON.parse(JSON.stringify(sample));broken.lessons[0].variants=[];
 assert.throws(()=>normalizeCommunityPack(broken),/1–4 alternate/);
 const js=JSON.parse(JSON.stringify(sample));js.lessons[0].steps[0].solution='UnknownExternalCall()';
 return verifyCommunityPack(normalizeCommunityPack(js),evaluate,runWalkthrough).then(()=>assert.fail('must fail'),error=>assert.match(error.message,/reference formula failed/i));
});
test('Skills show deficits and prioritize active lessons without external user data',()=>{
 const progress={[lessons[0].id]:[lessons[0].steps[0].solution]};
 const bars=skillProgress(lessons,progress);
 assert.ok(bars.length>0);
 assert.ok(bars.some(x=>x.done>0));
 const list=recommendLessons(lessons,progress,{limit:4});
 assert.equal(list[0].id,lessons[0].id);
 assert.ok(list.length<=4);
});
test('New Learning Lab modules and routes are wired to the browser without eval or external script sources',()=>{
 const html=readFileSync(new URL('../public/learn.html',import.meta.url),'utf8');
 const main=readFileSync(new URL('../public/learn.js',import.meta.url),'utf8');
 const extras=readFileSync(new URL('../public/learn-extras-ui.js',import.meta.url),'utf8');
 for(const id of ['learn-language','lab-tutor','lab-clinic','lab-dataset','lab-packs','lab-skills','pack-file','tutor-next-hint','clinic-analyze','dataset-generate','dataset-test','skills-metrics'])assert.ok(html.includes(`id="${id}"`),id);
 assert.match(main,/initLearningExtras/);
 assert.match(extras,/normalizeCommunityPack/);
 assert.doesNotMatch(extras,/(\beval\s*\(|new\s+Function\s*\()/);
 assert.match(html,/src="\.\/learn\.js\?v=0\.9\.0"/);
});
