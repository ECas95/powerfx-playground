/** Deterministic evaluation and progress helpers for the local Learning Lab.
 * The runner is injected so the same tests run in Node, on GitHub Pages and locally. */
const INPUT_LIMIT = 10000;
export const LEVELS = ['Foundation','Intermediate','Advanced','Expert','Boss'];
export const STORAGE_KEY = 'powerfx-playground-learning-v1';

export function lessonFixtures(lesson){
  return [{name:'Primary dataset',inputs:lesson.inputs},...(lesson.variants||[])];
}
export function structurallyEqual(a,b,depth=0){
  if(Object.is(a,b))return true;
  if(depth>35||a===null||b===null||typeof a!==typeof b)return false;
  if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>structurallyEqual(v,b[i],depth+1));
  if(typeof a==='object'){
    const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&structurallyEqual(a[k],b[k],depth+1));
  }
  return false;
}
export function comparableResult(result){return {value:result.value??null,traces:result.traces??[]};}
export function normalizeProgress(value,lessons){
  const result=Object.create(null);
  if(!value||typeof value!=='object'||Array.isArray(value))return result;
  for(const lesson of lessons){
    const entry=value[lesson.id];
    if(!Array.isArray(entry))continue;
    const prefix=[];
    for(let i=0;i<Math.min(entry.length,lesson.steps.length);i++){
      if(typeof entry[i]!=='string'||!entry[i].trim()||entry[i].length>INPUT_LIMIT)break;
      prefix.push(entry[i]);
    }
    if(prefix.length)result[lesson.id]=prefix;
  }
  return result;
}
export function unlockedStep(lesson,progress){return Math.min(progress?.[lesson.id]?.length??0,lesson.steps.length-1);}
export function progressStats(lessons,progress){
  const total=lessons.reduce((n,l)=>n+l.steps.length,0);
  const completed=lessons.reduce((n,l)=>n+Math.min(l.steps.length,progress?.[l.id]?.length||0),0);
  const finished=lessons.filter(l=>(progress?.[l.id]?.length||0)>=l.steps.length).length;
  return {total,completed,finished,percent:Math.round(100*completed/total)};
}
function runSafely(run,args){
  try{return Promise.resolve(run(args)).then(result=>result?.success?result:{success:false,error:result?.error||{message:'Evaluation failed'}}).catch(e=>({success:false,error:{message:e.message||String(e)}}));}
  catch(e){return Promise.resolve({success:false,error:{message:e.message||String(e)}});}
}
async function expectedAt(lesson,at,fixture,run){
  const context={...fixture.inputs};
  let reference;
  for(let i=0;i<=at;i++){
    reference=await runSafely(run,{formula:lesson.steps[i].solution,platform:lesson.platform,inputs:context});
    if(!reference.success)throw Error(`Lesson ${lesson.id}, step ${i+1} reference fails: ${reference.error?.message}`);
    context[`Step${i+1}`]=reference.value;
    if(lesson.platform==='flow')context[`outputs:Step${i+1}`]=reference.value;
  }
  return reference;
}
export async function gradeStep({lesson,stepIndex,formula,previous=[],run}){
  if(!lesson||!Number.isInteger(stepIndex)||stepIndex<0||stepIndex>=lesson.steps.length)throw Error('Invalid lesson step');
  if(typeof formula!=='string'||!formula.trim()||formula.length>INPUT_LIMIT)return {passed:false,message:'Enter a formula (up to 10,000 characters).',cases:[]};
  if(previous.length!==stepIndex||!previous.every(x=>typeof x==='string'&&x.trim()))return {passed:false,message:'Finish earlier steps before evaluating this one.',cases:[]};
  const cases=[];
  for(const fixture of lessonFixtures(lesson)){
    const expected=await expectedAt(lesson,stepIndex,fixture,run);
    const context={...fixture.inputs};
    for(let i=0;i<stepIndex;i++){
      const prior=await runSafely(run,{formula:previous[i],platform:lesson.platform,inputs:context});
      if(!prior.success)return {passed:false,message:`Previous step ${i+1} failed on ${fixture.name}: ${prior.error?.message}`,cases};
      context[`Step${i+1}`]=prior.value;
      if(lesson.platform==='flow')context[`outputs:Step${i+1}`]=prior.value;
    }
    const actual=await runSafely(run,{formula,platform:lesson.platform,inputs:context});
    const passed=actual.success&&structurallyEqual(comparableResult(actual),comparableResult(expected));
    cases.push({name:fixture.name,passed,actual:actual.success?comparableResult(actual):null,expected:comparableResult(expected),error:actual.error?.message||null});
  }
  const passed=cases.every(x=>x.passed);
  return {passed,cases,message:passed?`Passed all ${cases.length} datasets. ${stepIndex+1===lesson.steps.length?'Lesson complete!':'Next step unlocked.'}`:`${cases.filter(x=>!x.passed).length} of ${cases.length} datasets did not match. Review the formula and try again.`};
}
export async function runWalkthrough(lesson,run){
  const fixtures=lessonFixtures(lesson),runs=[];
  for(const fixture of fixtures){
    const context={...fixture.inputs},steps=[];
    for(const [i,step] of lesson.steps.entries()){
      const result=await runSafely(run,{formula:step.solution,platform:lesson.platform,inputs:context});
      steps.push({index:i,title:step.title,formula:step.solution,why:step.why,...result});
      if(!result.success)break;
      context[`Step${i+1}`]=result.value;
      if(lesson.platform==='flow')context[`outputs:Step${i+1}`]=result.value;
    }
    runs.push({name:fixture.name,steps});
  }
  return runs;
}
