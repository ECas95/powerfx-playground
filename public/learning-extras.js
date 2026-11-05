/**
 * Learning Lab extensions: deterministic offline tutor, bounded stress fixtures,
 * source-aware delegation hints, and untrusted community pack validation.
 * Not a server-side LLM, production query planner, or substitute for Power Apps Studio.
 */
export const SUPPORTED_LANGUAGES = ['en','es'];
const safeWord = value => String(value??'').slice(0,200);
export const copy = (value) => JSON.parse(JSON.stringify(value));
const M = {
 en:{
  'tutor.title':'Formula coach','tutor.intro':'Local, rule-based hints; no AI service or tenant connection.',
  'tutor.why':'What went wrong','tutor.next':'Try this','tutor.related':'Practice next',
  'tutor.ready':'Write and check a formula to receive tailored guidance.',
  'tutor.syntax':'The expression did not parse or execute. Check separators, parentheses, and referenced names.',
  'tutor.mismatch':'Your expression ran, but its output did not match the reference on all datasets.',
  'tutor.literal':'A constant result may fit one sample but usually fails alternate datasets.',
  'tutor.scope':'Pay attention to record scope. A nested Filter or CountIf may require As aliases and qualified column names.',
  'tutor.regex':'Check anchors (^ and $), escaped characters, and missing or null strings in the regular expression.',
  'tutor.null':'An empty value is different from a missing field. Consider explicit blank checks in supported formulas.',
  'tutor.other':'Compare the failed fixture with the reference behavior; use the data viewer to inspect fields and types.',
  'clinic.title':'Delegation Clinic','clinic.intro':'Educational rule checks — not a guarantee that a production query delegates.',
  'clinic.candidate':'Candidate for delegation; check the actual connector, column types, and Power Apps Studio.',
  'clinic.review':'Connector-specific behavior needs verification in Power Apps Studio and Live Monitor.',
  'clinic.risk':'Possible nondelegable expression; large datasets may return incomplete results.',
  'clinic.preview':'Illustration','clinic.previewText':'If processing stops at the first {limit} of {total} rows, a matching row near the end is missed. This is a conceptual demo, not an actual connector query.',
  'dataset.title':'Challenge data generator','dataset.intro':'Synthetic stress fixtures to test more than the provided examples.',
  'dataset.run':'Test generated case','dataset.build':'Generate fixture','dataset.invalid':'Reference expression could not evaluate on this stress fixture; no grade assigned.',
  'dataset.pass':'Your formula matched the reference on the generated dataset.','dataset.fail':'Your formula differs from the reference on the generated dataset.',
  'packs.title':'Community Challenge Packs','packs.intro':'Import an offline JSON lesson pack with strict validation. Pack code is never executed as JavaScript.',
  'packs.loaded':'Community pack loaded.','packs.invalid':'Invalid challenge pack',
  'skills.title':'Skill progress','skills.intro':'Based on local step completion, not a Microsoft certification.',
  'skills.next':'Recommended next lesson','skills.empty':'Finish exercises to build your skill profile.',
  'common.docs':'Microsoft Learn','common.notVerified':'For real connectors, verify in Power Apps Studio.',
 },
 es:{
  'tutor.title':'Tutor de fórmulas','tutor.intro':'Pistas locales basadas en reglas, sin servicio de IA ni acceso al tenant.',
  'tutor.why':'Qué ocurrió','tutor.next':'Qué probar','tutor.related':'Practica después',
  'tutor.ready':'Escribe y evalúa una fórmula para recibir orientación contextual.',
  'tutor.syntax':'La expresión no pudo analizarse o ejecutarse. Revisa separadores, paréntesis y referencias.',
  'tutor.mismatch':'La expresión se ejecutó, pero el resultado no coincide con la referencia en todos los datasets.',
  'tutor.literal':'Un resultado constante puede servir para un ejemplo, pero no suele funcionar con otros datos.',
  'tutor.scope':'Revisa el contexto de registro. Los filtros y CountIf anidados pueden necesitar alias As y nombres completos.',
  'tutor.regex':'Revisa los anclajes (^ y $), los caracteres escapados y los textos vacíos o nulos.',
  'tutor.null':'Un valor vacío no equivale a un campo inexistente. Usa comprobaciones de Blank cuando correspondan.',
  'tutor.other':'Compara el caso fallido con el comportamiento esperado y revisa los campos y tipos del dataset.',
  'clinic.title':'Clínica de delegación','clinic.intro':'Revisión educativa de reglas, no garantía de delegación en producción.',
  'clinic.candidate':'Posible delegación. Comprueba conector, tipos de columna y Power Apps Studio.',
  'clinic.review':'El comportamiento depende del conector. Verifícalo en Power Apps Studio y Live Monitor.',
  'clinic.risk':'Posible expresión no delegable. Los datasets extensos pueden dar resultados incompletos.',
  'clinic.preview':'Simulación','clinic.previewText':'Si solo se procesan las primeras {limit} de {total} filas, se pierde una coincidencia al final. Es una ilustración, no una consulta real.',
  'dataset.title':'Generador de desafíos','dataset.intro':'Datasets sintéticos con casos límite, además de los ejemplos iniciales.',
  'dataset.run':'Evaluar dataset generado','dataset.build':'Generar dataset','dataset.invalid':'La expresión de referencia no pudo ejecutarse con este caso extremo; no se asignó nota.',
  'dataset.pass':'La fórmula coincide con la referencia en los datos generados.','dataset.fail':'La fórmula difiere de la referencia en los datos generados.',
  'packs.title':'Packs comunitarios','packs.intro':'Importa un pack JSON offline con validación estricta. Ningún código del pack se ejecuta como JavaScript.',
  'packs.loaded':'Pack comunitario cargado.','packs.invalid':'Pack de desafíos no válido',
  'skills.title':'Progreso de habilidades','skills.intro':'Basado en los pasos completados localmente; no es una certificación de Microsoft.',
  'skills.next':'Siguiente caso recomendado','skills.empty':'Completa ejercicios para crear tu perfil de habilidades.',
  'common.docs':'Microsoft Learn','common.notVerified':'Valida los conectores reales con Power Apps Studio.'
 }
};
export function translate(lang,key,values={}){
 let out=(M[lang==='es'?'es':'en'][key]||M.en[key]||key);
 for(const [k,v] of Object.entries(values))out=out.replaceAll(`{${k}}`,String(v));
 return out;
}

export function diagnoseFormula({formula='',step={},grade=null,lang='en'}={}){
 const text=String(formula).slice(0,10000),reason=grade?.cases?.find(c=>!c.passed);
 let code='other';
 if(!text.trim()||!grade)return {code:'ready',title:translate(lang,'tutor.ready'),hints:[]};
 if(reason?.error||/[()]$/.test(text)===false && /\b(Filter|With|If)\s*\(/i.test(text)&&text.trim().endsWith(','))code='syntax';
 else if(/^\s*(?:true|false|\d+|"[^"]*")\s*$/i.test(text))code='literal';
 else if(/\b(Match|MatchAll|IsMatch)\s*\(/i.test(text)||/regex/i.test(step.title||''))code='regex';
 else if(/(?:\bAs\b|\bCountIf\s*\(|\bWith\s*\()/i.test(step.solution||'')||/\b(Filter|CountIf)\s*\(/i.test(text)&&/\bFilter\s*\(/i.test(text.replace(/^\s*Filter\s*\(/i,'')))code='scope';
 else if(/\b(IsBlank|Blank)\s*\(/i.test(text))code='null';
 else if(grade && !grade.passed)code='mismatch';
 const category=translate(lang,'tutor.'+code);
 const hint = String(step.hint||'').slice(0,500);
 const signatures=[...new Set([...String(step.solution||'').matchAll(/\b([A-Za-z]\w*)\s*\(/g)].map(m=>m[1]))].slice(0,5);
 const tier1=category;
 const tier2=hint||translate(lang,'tutor.other');
 const tier3=signatures.length ? (lang==='es'?'Funciones útiles: ':'Relevant functions: ')+signatures.join(', ') : translate(lang,'tutor.other');
 return {code,title:category,hints:[tier1,tier2,tier3],error:safeWord(reason?.error),functions:signatures};
}

const DOCS={
 overview:'https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/delegation-overview',
 dataverse:'https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/connections/connection-common-data-service',
 sharepoint:'https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/connections/connection-sharepoint-online',
 sql:'https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/connections/connection-azure-sqldatabase'
};
export const DELEGATION_SOURCES=['dataverse','sharepoint','sql'];
const riskRules=[
 {re:/\b(?:GroupBy|Ungroup|Distinct|FirstN|LastN|Collect|ClearCollect|Concat|MatchAll|IsMatch|Match|AddColumns|ForAll)\s*\(/i,code:'nondelegable-family',summary:'Contains a function normally processed locally.'},
 {re:/\bSearch\s*\(/i,source:'sharepoint',code:'sharepoint-search',summary:'Search on SharePoint text columns is not delegable; consider a StartsWith filter.'},
 {re:/\bIsBlank\s*\(/i,source:'sql',code:'sql-isblank',summary:'IsBlank on SQL columns is not delegated; compare to Blank() only if semantics are acceptable.'},
 {re:/\bStartsWith\s*\(\s*\w+\.(?:Value|Title)\s*,/i,source:'sharepoint',code:'sharepoint-complex',summary:'StartsWith on SharePoint Choice/Lookup subfields is not delegable.'}
];
export function analyzeDelegation(formula,source='dataverse'){
 const value=String(formula||'').slice(0,10000),src=DELEGATION_SOURCES.includes(source)?source:'dataverse';
 const found=[];
 for(const rule of riskRules){
  if((!rule.source||rule.source===src)&&rule.re.test(value))found.push({code:rule.code,summary:rule.summary,severity:'risk'});
 }
 if(/\bin\b/i.test(value))found.push({code:'in-context',summary:`The in operator has source and column-scope restrictions; verify ${src} column types and record scope.`,severity:'review'});
 if(/\b(?:CountRows|CountIf)\s*\(/i.test(value))found.push({code:'aggregate-delegation',summary:'Counting and aggregates depend on source, table size and features; verify in the connector.',severity:'review'});
 if(/\bWith\s*\(/i.test(value))found.push({code:'with-scope',summary:'With is a local scope; verify that the enclosed data-source query remains delegable.',severity:'review'});
 if(/\b(?:StartsWith|EndsWith)\s*\(/i.test(value))found.push({code:'string-direction',summary:'String predicates can require a column as the first argument; verify connector and column type.',severity:'review'});
 if(/\b(?:Filter|LookUp)\s*\(/i.test(value)===false)found.push({code:'outside-query',summary:'No Filter or LookUp data-source query detected. Delegation may not apply.',severity:'review'});
 const risk=found.some(x=>x.severity==='risk');
 const candidate=/\b(?:Filter|LookUp)\s*\(/i.test(value)&&!risk&&found.length===0;
 return {source:src,status:risk?'risk':candidate?'candidate':'review',findings:found,docs:[DOCS.overview,DOCS[src]],disclaimer:'Static educational heuristic; verify delegation in Power Apps Studio, column schema, connector and Live Monitor. Never execute tenant queries here.'};
}
export function delegationIllustration(total=650,limit=500){
 const all=Math.max(1,Math.min(10000,Math.floor(Number(total)||650)));
 const bound=Math.max(1,Math.min(all,Math.floor(Number(limit)||500)));
 const matchIndex=all-1;
 return {total:all,limit:bound,matchingRow:matchIndex+1,foundLocally:matchIndex<bound,fullMatches:1,localMatches:matchIndex<bound?1:0};
}

function random(seed){let value=(Number(seed)||1)>>>0;return ()=>((value=(1664525*value+1013904223)>>>0)/4294967296);}
function validateSize(obj,max=150000){const as=JSON.stringify(obj);if(!as||as.length>max)throw Error('Fixture exceeds bounded JSON size');return as;}
function rewriteLeaf(value,mode,rng,depth=0){
 if(depth>10)return value;
 if(Array.isArray(value)){
  const arr=value.slice(0,150).map(v=>rewriteLeaf(v,mode,rng,depth+1));
  if(mode==='duplicates'&&arr.length&&arr.length<150){const which=Math.floor(rng()*arr.length);arr.splice(Math.floor(rng()*(arr.length+1)),0,copy(arr[which]));}
  if(mode==='boundaries'&&arr.length)arr.reverse();
  return arr;
 }
 if(value&&typeof value==='object'){
  const result=Object.create(null);
  for(const [key,v] of Object.entries(value)){
   if(['__proto__','constructor','prototype'].includes(key))continue;
   result[key]=rewriteLeaf(v,mode,rng,depth+1);
  }
  if(mode==='nulls'&&depth>=1){
   const k=Object.keys(result).find(k=>typeof result[k]==='string'&&rng()<0.33);
   if(k)result[k]=null;
  }
  if(mode==='boundaries'&&depth>=1){
   const k=Object.keys(result).find(k=>typeof result[k]==='number'&&rng()<0.35);
   if(k)result[k]=Math.abs(result[k])<10000?0:result[k];
  }
  return result;
 }
 return value;
}
export function generateStressFixture(lesson,{mode='duplicates',seed=1}={}){
 if(!['duplicates','nulls','boundaries'].includes(mode))throw Error('Unknown stress mode');
 if(!lesson?.inputs||typeof lesson.inputs!=='object'||Array.isArray(lesson.inputs))throw Error('Missing lesson inputs');
 const rng=random(seed),data=rewriteLeaf(copy(lesson.inputs),mode,rng);
 // Guarantee at least one real edge-case when suitable leaves exist.
 const walk=(node,condition,transform)=>{
   if(!node||typeof node!=='object')return false;
   for(const [key,val] of Object.entries(node)){
     if(val!==null&&condition(val,key)){node[key]=transform(val);return true;}
     if(walk(val,condition,transform))return true;
   }
   return false;
 };
 const has=(node,pred)=>{
   if(pred(node))return true;
   return Boolean(node&&typeof node==='object'&&Object.values(node).some(v=>has(v,pred)));
 };
 if(mode==='nulls'&&!has(data,v=>v===null))walk(data,v=>typeof v==='string',()=>null);
 if(mode==='boundaries'&&!has(data,v=>v===0))walk(data,v=>typeof v==='number',()=>0);
 validateSize(data);
 return {name:`Stress: ${mode} (seed ${Number(seed)||1})`,inputs:data,generated:true,seed:Number(seed)||1,mode};
}
const MAX_PACK_BYTES=85000;
const keyAllowed=/^[a-z0-9][a-z0-9-]{1,50}$/;
function checkPlain(value,depth=0){
 if(depth>15)throw Error('Input nesting exceeds 15 levels');
 if(value&&typeof value==='object'){
  for(const [key,child] of Object.entries(value)){
   if(['__proto__','prototype','constructor'].includes(key))throw Error('Unsafe JSON property');
   if(key.length>70)throw Error('Input key too long');
   checkPlain(child,depth+1);
  }
 }
}
const string=(s,name,max=1500)=>{
 if(typeof s!=='string'||!s.trim()||s.length>max)throw Error(`${name}: required text (max ${max})`);
 return s;
};
export function normalizeCommunityPack(raw,{existingIds=[]}={}){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid pack object');
 const bytes=validateSize(raw,MAX_PACK_BYTES);
 checkPlain(raw);
 if(raw.schema!=='powerfx-community-pack/1')throw Error('Unsupported pack schema');
 const id=string(raw.id,'pack id',50);
 if(!keyAllowed.test(id))throw Error('Pack id must be a lowercase slug');
 if(!Array.isArray(raw.lessons)||raw.lessons.length<1||raw.lessons.length>8)throw Error('Pack must contain 1–8 lessons');
 const ids=new Set(existingIds);
 const lessons=raw.lessons.map((l,i)=>{
  if(!l||typeof l!=='object'||Array.isArray(l))throw Error('Lesson must be an object');
  const lessonId=string(l.id,`lesson ${i+1} id`,50);
  if(!keyAllowed.test(lessonId))throw Error('Lesson id must be a lowercase slug');
  const scopedId=`community-${id}-${lessonId}`;
  if(ids.has(scopedId))throw Error('Duplicate lesson id');ids.add(scopedId);
  const platform=l.platform;if(!['canvas','flow'].includes(platform))throw Error('Invalid platform');
  if(!['Foundation','Intermediate','Advanced','Expert','Boss'].includes(l.level))throw Error('Invalid level');
  if(!Array.isArray(l.skills)||!l.skills.length||l.skills.length>8||!l.skills.every(x=>typeof x==='string'&&x.length<=45))throw Error('Invalid skills');
  const inputs=copy(l.inputs);if(!inputs||Array.isArray(inputs)||typeof inputs!=='object')throw Error('Invalid inputs');
  validateSize(inputs,18000);
  if(!Array.isArray(l.variants)||l.variants.length<1||l.variants.length>4)throw Error('Provide 1–4 alternate datasets');
  const variants=l.variants.map(v=>{
   if(!v||typeof v!=='object'||!v.inputs||Array.isArray(v.inputs)||typeof v.inputs!=='object')throw Error('Invalid variant dataset');
   validateSize(v.inputs,18000);
   return {name:string(v.name,'variant name',80),inputs:copy(v.inputs)};
  });
  if(!Array.isArray(l.steps)||l.steps.length<2||l.steps.length>8)throw Error('Each lesson must have 2–8 steps');
  const steps=l.steps.map((s,j)=>({
   title:string(s.title,`step ${j+1} title`,120),
   instruction:string(s.instruction,'instruction',1200),
   hint:string(s.hint,'hint',700),
   why:string(s.why,'explanation',1500),
   solution:string(s.solution,'solution',4000)
  }));
  return {id:scopedId,sourcePack:id,level:l.level,platform,category:string(l.category,'category',80),estimatedMinutes:Math.min(90,Math.max(3,Number(l.estimatedMinutes)||15)),title:string(l.title,'title',120),subtitle:string(l.subtitle,'subtitle',300),goal:string(l.goal,'goal',1200),skills:l.skills.slice(),inputs,variants,steps};
 });
 return {schema:raw.schema,id,title:string(raw.title,'pack title',120),author:string(raw.author||'Community','author',80),lessons,bytes:bytes.length};
}
export async function verifyCommunityPack(pack,run,walkthrough){
 if(typeof run!=='function'||typeof walkthrough!=='function')throw Error('Runner unavailable');
 let steps=0;
 for(const lesson of pack.lessons){
  const fixtures=await walkthrough(lesson,run);
  for(const fixture of fixtures)for(const step of fixture.steps){
   if(!step.success)throw Error(`${lesson.id}: reference formula failed in ${fixture.name} (step ${step.index+1}: ${step.error?.message})`);
  }
  steps+=lesson.steps.length;
 }
 return {valid:true,lessons:pack.lessons.length,steps};
}
export function skillProgress(lessons,progress){
 const skills=new Map();
 for(const lesson of lessons){
  const done=Math.min(lesson.steps.length,progress?.[lesson.id]?.length||0);
  for(const name of lesson.skills){
   const entry=skills.get(name)||{name,done:0,total:0};
   entry.done+=done;entry.total+=lesson.steps.length;skills.set(name,entry);
  }
 }
 return [...skills.values()].map(s=>({...s,percent:Math.round(100*s.done/s.total)})).sort((a,b)=>a.percent-b.percent||a.name.localeCompare(b.name));
}
export function recommendLessons(lessons,progress,{limit=3,platform='all'}={}){
 const ranked=lessons.filter(l=>platform==='all'||l.platform===platform).map(lesson=>{
  const done=Math.min(lesson.steps.length,progress?.[lesson.id]?.length||0);
  const incomplete=lesson.steps.length-done;
  const levelScore=['Foundation','Intermediate','Advanced','Expert','Boss'].indexOf(lesson.level);
  return {lesson,done,score:incomplete===0?-100:done>0?100+done:40-levelScore*6};
 }).filter(s=>s.score>=0).sort((a,b)=>b.score-a.score||a.lesson.title.localeCompare(b.lesson.title));
 return ranked.slice(0,Math.max(1,Math.min(10,limit))).map(x=>x.lesson);
}
