import {translate,diagnoseFormula,analyzeDelegation,delegationIllustration,generateStressFixture,normalizeCommunityPack,verifyCommunityPack,skillProgress,recommendLessons} from './learning-extras.js';
import {localizedLesson} from './lesson-locales.js';

const DOC_PREFIX='https://github.com/ECas95/powerfx-playground/';
const limitText=(value,n=260)=>String(value??'').slice(0,n);
function make(tag,cls,txt){
  const item=document.createElement(tag);if(cls)item.className=cls;if(txt!==undefined)item.textContent=txt;return item;
}
function downloadJSON(data,name){
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const a=make('a');a.download=name;a.href=url;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function sampleTemplate(lesson){
  return {schema:'powerfx-community-pack/1',id:'team-practice',title:'Team practice challenges',author:'Power Platform community',lessons:[{
    id:'open-high-priority',level:'Foundation',platform:'canvas',title:'Filter a support queue',
    subtitle:'Practice connected steps',goal:'Extract urgent tickets and sort by age',
    category:'Operations',estimatedMinutes:10,skills:['Filter','SortByColumns'],
    inputs:{Tickets:[{Id:1,Status:'Open',Priority:5},{Id:2,Status:'Closed',Priority:2},{Id:3,Status:'Open',Priority:9}]},
    variants:[{name:'Alternate dataset',inputs:{Tickets:[{Id:4,Status:'Open',Priority:7},{Id:5,Status:'Closed',Priority:8}]}}],
    steps:[
      {title:'Filter open',instruction:'Return all open tickets',hint:'Use Filter(Tickets, ...)',why:'Filter selects records whose condition is true.',solution:'Filter(Tickets,Status="Open")'},
      {title:'Sort descending',instruction:'Sort open tickets by Priority descending',hint:'Use SortByColumns(Step1,...)',why:'SortByColumns returns a sorted table.',solution:'SortByColumns(Step1,"Priority",SortOrder.Descending)'}
    ]
  }]};
}
export function initLearningExtras({$,state,run,getLesson,allLessons,answers,gradeStep,runWalkthrough,lessonFixtures,selectLesson,renderList,addPack,removePack}){
 let currentTab='tutor',currentHints=0,currentGrade=null,currentFormula='',fixture=null,pack=null;
 const lang=()=>state.lang,tt=(key,vals)=>translate(lang(),key,vals);
 function getVisibleLesson(){return localizedLesson(getLesson(),lang());}
 function showStatus(id,text,kind=''){const el=$(id);el.textContent=text;el.className='learn-tool-status '+kind;}
 function showTab(next){
  currentTab=next;
  for(const btn of document.querySelectorAll('[data-lab-tab]')){const on=btn.dataset.labTab===next;btn.classList.toggle('active',on);btn.setAttribute('aria-selected',String(on));}
  for(const panel of document.querySelectorAll('.learn-tool-content'))panel.hidden=panel.id!==`lab-${next}`;
  if(next==='skills')showSkills();
  if(next==='clinic'&&!$('clinic-formula').value.trim())$('clinic-formula').value=$('learn-formula').value||getLesson().steps[state.index]?.solution||'';
 }
 function tutor(){
  const section=$('tutor-hints');section.replaceChildren();
  const step=getVisibleLesson().steps[state.index],d=diagnoseFormula({formula:currentFormula,step,grade:currentGrade,lang:lang()});
  $('tutor-diagnosis').textContent=d.title;
  for(let i=0;i<Math.min(currentHints,d.hints.length);i++)section.append(make('p','tutor-hint-item',`${i+1}. ${d.hints[i]}`));
  $('tutor-next-hint').disabled=!currentGrade||currentHints>=d.hints.length;
  const container=$('tutor-related');container.replaceChildren();
  const l=getLesson();const alternatives=allLessons().filter(x=>x.id!==l.id&&x.skills.some(s=>l.skills.some(b=>b.toLowerCase()===s.toLowerCase()))).slice(0,3);
  if(!alternatives.length){container.append(make('p','learn-placeholder',tt('skills.empty')));return;}
  for(const related of alternatives){
   const btn=make('button','learn-related',localizedLesson(related,lang()).title);
   btn.type='button';btn.addEventListener('click',()=>selectLesson(related.id));container.append(btn);
  }
 }
 function clinic(){
  const form=$('clinic-formula').value.trim(),source=$('clinic-source').value;
  const target=$('clinic-findings');target.replaceChildren();
  if(!form){showStatus('clinic-result',lang()==='es'?'Escribe una fórmula para analizar.':'Enter a formula to inspect.','warn');return;}
  const l=getLesson();
  if(l.platform!=='canvas'){
    showStatus('clinic-result',lang()==='es'?'Las reglas de delegación analizan fórmulas Power Fx de Canvas, no expresiones WDL.':'Delegation rules target Canvas Power Fx, not cloud flow WDL.','warn');
    $('clinic-links').replaceChildren();$('clinic-illustration').textContent='';return;
  }
  const analysis=analyzeDelegation(form,source),kind=analysis.status==='risk'?'fail':analysis.status==='candidate'?'pass':'warn';
  showStatus('clinic-result',tt(`clinic.${analysis.status}`),kind);
  for(const finding of analysis.findings){
   const box=make('div','clinic-finding');box.append(make('strong','',finding.code),make('p','',finding.summary));target.append(box);
  }
  if(!analysis.findings.length)target.append(make('p','clinic-finding',lang()==='es'?'No se detectó un patrón de riesgo en estas reglas. Esto no garantiza delegación.':'No known risk pattern detected by these rules. Delegation is not guaranteed.'));
  const pic=delegationIllustration(650,500);
  $('clinic-illustration').textContent=tt('clinic.previewText',{limit:pic.limit,total:pic.total});
  const urls=$('clinic-links');urls.replaceChildren();
  for(const link of analysis.docs){const a=make('a','learn-doc-link',`${tt('common.docs')} ↗`);a.href=link;a.target='_blank';a.rel='noopener noreferrer';urls.append(a);}
 }
 function generate(){
  try{
   fixture=generateStressFixture(getLesson(),{mode:$('dataset-mode').value,seed:Number($('dataset-seed').value)});
   $('dataset-preview').value=JSON.stringify(fixture.inputs,null,2);
   showStatus('dataset-result',lang()==='es'?'Dataset generado; evalúa tu fórmula para comparar resultados.':'Fixture ready; check your expression against the reference.');
  }catch(error){fixture=null;$('dataset-preview').value='';showStatus('dataset-result',error.message,'fail');}
 }
 async function testGenerated(){
  if(!fixture){generate();if(!fixture)return;}
  const l=getLesson(),formula=$('learn-formula').value;
  const result=await gradeStep({lesson:l,stepIndex:state.index,formula,previous:answers().slice(0,state.index),run,fixtures:[fixture]});
  if(result.ungradable)showStatus('dataset-result',tt('dataset.invalid')+' '+limitText(result.message,200),'warn');
  else showStatus('dataset-result',result.passed?tt('dataset.pass'):tt('dataset.fail')+(result.cases[0]?.error?` ${limitText(result.cases[0].error)}`:''),result.passed?'pass':'fail');
  // Stress-only results cannot unlock curricular steps.
 }
 function showSkills(){
  const target=$('skills-metrics');target.replaceChildren();
  const stats=skillProgress(allLessons(),state.progress).slice(0,12);
  for(const skill of stats){
   const row=make('div','skill-row');const line=make('div','skill-head');
   line.append(make('span','',skill.name),make('strong','',`${skill.done}/${skill.total} · ${skill.percent}%`));
   const bar=make('div','skill-meter'),fill=make('span');fill.style.width=skill.percent+'%';bar.append(fill);
   row.append(line,bar);target.append(row);
  }
  const rec=$('skills-recs');rec.replaceChildren();
  for(const related of recommendLessons(allLessons(),state.progress,{limit:3})){
   const btn=make('button','learn-related',`${localizedLesson(related,lang()).title} · ${related.level}`);
   btn.type='button';btn.addEventListener('click',()=>selectLesson(related.id));rec.append(btn);
  }
 }
 async function importPack(file){
  if(!file||file.size>85000)throw Error('Pack exceeds 85 KB limit');
  const raw=JSON.parse(await file.text());
  const n=normalizeCommunityPack(raw,{existingIds:allLessons().filter(x=>!pack?.lessons.some(s=>s.id===x.id)).map(x=>x.id)});
  await verifyCommunityPack(n,run,runWalkthrough);
  pack=n;addPack(n);$('pack-remove').disabled=false;
  showStatus('pack-status',`${tt('packs.loaded')} ${n.title} · ${n.lessons.length} ${lang()==='es'?'casos':'lessons'}`,'pass');
 }
 async function onPackInput(){
  const input=$('pack-file'),file=input.files?.[0];if(!file)return;
  $('pack-import').disabled=true;
  showStatus('pack-status',lang()==='es'?'Validando todas las soluciones…':'Validating all reference expressions…');
  try{await importPack(file);}
  catch(error){showStatus('pack-status',`${tt('packs.invalid')}: ${limitText(error.message,300)}`,'fail');}
  finally{input.value='';$('pack-import').disabled=false;}
 }
 function onGrade(grade,formula,index){
  currentGrade=grade;currentFormula=formula;currentHints=0;tutor();showSkills();
 }
 function onStepChange(){
  currentGrade=null;currentFormula='';currentHints=0;fixture=null;
  $('dataset-preview').value='';showStatus('dataset-result',tt('dataset.intro'));
  tutor();$('clinic-formula').value=$('learn-formula').value||getLesson().steps[state.index]?.solution||'';
 }
 function onLessonChange(){onStepChange();showSkills();}
 function onLanguageChange(){
  const labels={
   'clinic-result':'clinic.intro','dataset-result':'dataset.intro','packs-intro':'packs.intro','tutor-intro':'tutor.intro','clinic-intro':'clinic.intro','dataset-intro':'dataset.intro','skills-intro':'skills.intro'
  };
  for(const [id,key] of Object.entries(labels))$(id).textContent=tt(key);
  const tabs={clinic:lang()==='es'?'Delegación':'Delegation',dataset:lang()==='es'?'Datos':'Data lab',skills:lang()==='es'?'Habilidades':'Skills',tutor:'Tutor',packs:'Packs'};
  for(const item of document.querySelectorAll('[data-lab-tab]'))item.textContent=tabs[item.dataset.labTab];
  const el=$('dataset-mode');
  const names=lang()==='es'?['Filas duplicadas','Campos de texto nulos','Valores límite y reordenación']:['Duplicate rows','Missing / null text','Numeric boundaries + reorder'];
  [...el.options].forEach((option,i)=>option.textContent=names[i]);
  tutor();showSkills();
 }
 document.querySelectorAll('[data-lab-tab]').forEach(btn=>btn.addEventListener('click',()=>showTab(btn.dataset.labTab)));
 $('tutor-next-hint').addEventListener('click',()=>{currentHints++;tutor();});
 $('clinic-analyze').addEventListener('click',clinic);$('clinic-source').addEventListener('change',clinic);
 $('dataset-generate').addEventListener('click',generate);
 $('dataset-test').addEventListener('click',testGenerated);
 $('pack-import').addEventListener('click',()=>$('pack-file').click());
 $('pack-file').addEventListener('change',onPackInput);
 $('pack-template').addEventListener('click',()=>downloadJSON(sampleTemplate(getLesson()),'powerfx-community-pack-template.json'));
 $('pack-remove').addEventListener('click',()=>{
   if(!pack)return;pack=null;removePack();$('pack-remove').disabled=true;showStatus('pack-status',lang()==='es'?'Pack eliminado de la sesión.':'Pack removed from this session.');
 });
 onLanguageChange();showTab('tutor');onStepChange();
 return {onGrade,onStepChange,onLessonChange,onLanguageChange,showTab};
}
