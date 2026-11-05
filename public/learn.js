import {lessons as builtInLessons} from './lessons.js';
import {localizedLesson} from './lesson-locales.js';
import {initLearningExtras} from './learn-extras-ui.js';
import {evaluate} from './core/evaluator.js';
import {LEVELS,STORAGE_KEY,lessonFixtures,normalizeProgress,progressStats,unlockedStep,gradeStep,runWalkthrough} from './learn-core.js';

// Only a bounded local formula subset is evaluated: no connectors, eval(), or dynamic code execution.
const $=id=>document.getElementById(id);
let lessons=[...builtInLessons];
let extras=null;
const initialLang=()=>{try{return localStorage.getItem('powerfx-learning-lang')==='es'?'es':localStorage.getItem('powerfx-learning-lang')==='en'?'en':navigator.language.toLowerCase().startsWith('es')?'es':'en';}catch{return 'en';}};
const pretty=value=>JSON.stringify(value,null,2)??'null';
const run=args=>evaluate(args);
const initial=(()=>{try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');}catch{return {};}})();
const state={progress:normalizeProgress(initial,lessons),lessonId:null,index:0,mode:'challenge',drafts:new Map(),activeRequest:0,walkthrough:null,lang:initialLang()};
const displayLesson=(l)=>localizedLesson(l,state.lang);
const langText=(en,es)=>state.lang==='es'?es:en;
const getLesson=()=>lessons.find(item=>item.id===state.lessonId)||lessons[0];
const answers=()=>state.progress[state.lessonId]||[];
const persist=()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state.progress));}catch{/*Private browsing or quota restriction*/}};
const escapeHTML=value=>String(value).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
function make(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;}
function lessonStats(){const info=progressStats(lessons,state.progress);$('overview-count').textContent=`${info.completed}/${info.total} ${langText('steps','pasos')} · ${info.finished}/${lessons.length} ${langText('cases','casos')}`;$('overview-bar').style.width=info.percent+'%';$('learning-completed').textContent=`${info.completed} / ${info.total} ${langText('steps completed','pasos completados')}`;}
function renderList(){
  const q=$('lesson-search').value.trim().toLowerCase(),level=$('lesson-level').value,platform=$('lesson-platform').value;
  const target=$('lesson-list');target.replaceChildren();let matches=0;
  for(const tier of LEVELS){
    const entries=lessons.filter(l=>l.level===tier&&(level==='all'||l.level===level)&&(platform==='all'||l.platform===platform)&&(!q||[l.title,l.subtitle,displayLesson(l).title,displayLesson(l).subtitle,l.category,l.goal,displayLesson(l).goal,...l.skills].join(' ').toLowerCase().includes(q)));
    if(!entries.length)continue;matches+=entries.length;
    const heading=make('div','learn-list-group');heading.append(make('strong','',tier),make('span','',`${entries.length} ${langText(entries.length===1?'case':'cases',entries.length===1?'caso':'casos')}`));target.append(heading);
    for(const lesson of entries){
      const solved=(state.progress[lesson.id]||[]).length,complete=solved===lesson.steps.length;
      const button=make('button','learn-list-button'+(state.lessonId===lesson.id?' active':'')+(complete?' is-complete':''));button.type='button';button.setAttribute('aria-current',state.lessonId===lesson.id?'true':'false');
      button.append(make('strong','',displayLesson(lesson).title),make('small','',lesson.category));
      const meta=make('span','learn-item-meta');meta.append(make('span','',lesson.platform==='canvas'?'ƒx Power Fx':'{ } WDL'),make('span','',`· ${lesson.estimatedMinutes} min ·`),make('b','',complete?langText('✓ Completed','✓ Completado'):`${solved}/${lesson.steps.length} ${langText('steps','pasos')}`));button.append(meta);
      button.addEventListener('click',()=>selectLesson(lesson.id));target.append(button);
    }
  }
  if(!matches)target.append(make('p','learn-placeholder',langText('No learning cases match your search. Try a different level or function name.','No hay casos con este filtro. Prueba otro nivel o función.')));
  lessonStats();
}
function renderHeader(){
  const l=displayLesson(getLesson());
  $('lesson-category').textContent=l.category;$('lesson-level-chip').textContent=l.level;$('lesson-title').textContent=l.title;
  $('lesson-subtitle').textContent=l.subtitle;$('lesson-platform-chip').textContent=l.platform==='canvas'?'Power Fx · Canvas':'Power Automate · WDL';
  $('lesson-goal').textContent=l.goal;$('lesson-step-count').textContent=`${l.steps.length} ${langText('steps','pasos')} · ${lessonFixtures(l).length} datasets · ${l.estimatedMinutes} min`;
  $('lesson-skills').replaceChildren(...l.skills.map(s=>make('span','learn-skill',s)));
  $('inspector-overview').textContent=`${l.steps.length} ${langText('connected steps','pasos conectados')} · ${l.level}`;
  $('learn-editor-lang').textContent=l.platform==='canvas'?'Canvas Power Fx · local subset':'Power Automate WDL · local subset';
  $('learn-input-preview').textContent=pretty(l.inputs);
  $('learn-context-explainer').textContent=l.platform==='flow'
    ? langText("This lab simulates Compose outputs as outputs('Step1'), outputs('Step2'), etc. These are mock values.","Este laboratorio simula salidas Compose como outputs('Step1') y outputs('Step2'). Son datos ficticios.")
    : langText("Inputs are synthetic. Completed steps become Step1, Step2, etc., inside this local exercise.","Los datos son sintéticos. Los pasos completados se convierten en Step1, Step2, etc.");
  const select=$('walkthrough-dataset');select.replaceChildren(...lessonFixtures(l).map((f,i)=>{const option=make('option','',f.name);option.value=String(i);return option;}));
  const testSelect=$('challenge-dataset');testSelect.replaceChildren(...lessonFixtures(l).map((f,i)=>{const option=make('option','',f.name);option.value=String(i);return option;}));
  state.walkthrough=null;$('walkthrough-state').textContent='Ready to execute';renderWalkthroughCards();
}
function renderStepNav(){
  const l=displayLesson(getLesson()),done=answers().length;
  $('step-pills').replaceChildren(...l.steps.map((step,i)=>{
    const b=make('button',(state.index===i?'active ':'')+(i<done?'done':''),i<done?`✓ ${i+1}`:`${langText('Step','Paso')} ${i+1}`);
    b.type='button';b.disabled=i>done;b.title=step.title;b.setAttribute('aria-label',`Step ${i+1}: ${step.title}`);
    b.addEventListener('click',()=>selectStep(i));return b;
  }));
  $('learn-outline').replaceChildren(...l.steps.map((step,i)=>{
    const b=make('button',(state.index===i?'active ':'')+(i<done?'done':''));b.type='button';b.disabled=i>done;
    b.append(make('span','learn-outline-mark',i<done?'✓':String(i+1)),make('span','',step.title));
    b.addEventListener('click',()=>{setMode('challenge');selectStep(i);});return b;
  }));
  $('prev-step').disabled=state.index===0;
  $('next-step').disabled=state.index>=done||state.index>=l.steps.length-1;
  $('learn-progress-text').textContent=`${done} ${langText('of','de')} ${l.steps.length} ${langText('completed','completados')}`;
  $('learn-progress-track').style.width=`${100*done/l.steps.length}%`;
  lessonStats();
}
async function renderContextPreview(){
  const l=getLesson(),request=++state.activeRequest,context={...lessonFixtures(l)[Number($('challenge-dataset').value)||0].inputs};
  for(let i=0;i<state.index;i++){
    try{const result=run({formula:answers()[i],platform:l.platform,inputs:context});if(!result.success)break;context[`Step${i+1}`]=result.value;if(l.platform==='flow')context[`outputs:Step${i+1}`]=result.value;}
    catch{break;}
  }
  if(request===state.activeRequest&&state.lessonId===l.id)$('learn-input-preview').textContent=pretty(context);
}
function renderStep(){
  const l=displayLesson(getLesson()),step=l.steps[state.index],done=answers();
  $('step-number').textContent=`${langText('STEP','PASO')} ${state.index+1} / ${l.steps.length}`;
  $('step-title').textContent=step.title;
  $('step-instruction').textContent=step.instruction;

  $('learn-formula').value=state.drafts.get(`${l.id}:${state.index}`)??done[state.index]??'';
  $('step-hint').textContent=step.hint;$('step-hint').hidden=true;$('hint-button').textContent=langText('Show hint','Mostrar pista');
  $('lesson-feedback').className='learn-feedback';
  $('lesson-feedback').textContent=state.index<done.length?langText('This step has already passed. You can revise it; changing it will reset later steps.','Este paso ya fue aprobado. Si lo cambias, los pasos siguientes se reiniciarán.'):langText('Write your expression and check it against all datasets. Equivalent formulas can pass.','Escribe tu fórmula y compruébala con todos los datos. Se aceptan expresiones equivalentes.');
  renderStepNav();renderContextPreview();extras?.onStepChange();
}
function rememberDraft(){if(state.lessonId)state.drafts.set(`${state.lessonId}:${state.index}`,$('learn-formula').value);}
function selectStep(index){
  const l=getLesson();if(index<0||index>unlockedStep(l,state.progress))return;
  rememberDraft();state.index=index;renderStep();
}
function selectLesson(id){
  const l=lessons.find(x=>x.id===id);if(!l)return;
  rememberDraft();state.lessonId=l.id;state.index=unlockedStep(l,state.progress);
  try{history.replaceState(null,'',`#${encodeURIComponent(l.id)}`);}catch{}
  renderHeader();renderStep();renderList();extras?.onLessonChange();
}
function setMode(mode){
  state.mode=mode;
  for(const key of ['challenge','walkthrough']){
    const selected=key===mode;$(`mode-${key}`).classList.toggle('active',selected);$(`mode-${key}`).setAttribute('aria-selected',String(selected));$(`${key}-panel`).hidden=!selected;
  }
}
function showFeedback(grade){
  const box=$('lesson-feedback');box.className='learn-feedback '+(grade.passed?'pass':'fail');
  const report=[grade.passed?'✓ '+(state.lang==='es'?'Fórmula aprobada con todos los datasets.':grade.message):'✕ '+(state.lang==='es'?'La fórmula no coincide en todos los datasets.':grade.message)];
  for(const testCase of grade.cases){
    if(testCase.passed){report.push(`✓ ${testCase.name}: ${langText('expected output matched','resultado esperado correcto')}`);continue;}
    report.push(`✕ ${testCase.name}: ${testCase.error||langText('Result differs from the reference','El resultado difiere de la referencia')}`);
    if(testCase.name==='Primary dataset'&&testCase.actual)report.push(`Your output: ${pretty(testCase.actual.value).slice(0,900)}`);
  }
  if(!grade.passed)report.push(langText('Tip: review conditions, record scopes and null handling.','Consejo: revisa las condiciones, ámbitos de registro y valores nulos.'));
  box.textContent=report.join('\n');
}
async function checkStep(){
  const l=getLesson(),stepIndex=state.index,formula=$('learn-formula').value,prior=answers().slice(0,stepIndex);
  if(stepIndex>prior.length)return;
  const button=$('check-step');button.disabled=true;button.textContent='Checking…';
  try{
    const grade=await gradeStep({lesson:l,stepIndex,formula,previous:prior,run});
    if(l.id!==state.lessonId||stepIndex!==state.index)return;
    if(grade.passed){
      const old=answers();
      // Changing a previously completed step invalidates downstream formulas.
      state.progress[l.id]=old[stepIndex]===formula?old:[...prior,formula];
      state.drafts.set(`${l.id}:${stepIndex}`,formula);persist();renderStepNav();renderList();
    }
    showFeedback(grade);extras?.onGrade(grade,formula,stepIndex);
  }catch(error){showFeedback({passed:false,message:error?.message||String(error),cases:[]});}
  finally{button.disabled=false;button.innerHTML=langText('Check expression <kbd>Ctrl+Enter</kbd>','Evaluar expresión <kbd>Ctrl+Enter</kbd>');}
}
function renderWalkthroughCards(){
  const l=displayLesson(getLesson()),container=$('walkthrough-steps');container.replaceChildren();
  for(const [i,step] of l.steps.entries()){
    const card=make('article','learn-walk-card');card.dataset.index=String(i);
    const header=make('header','');header.append(make('span','',`${langText('STEP','PASO')} ${i+1}`),make('strong','',step.title));
    const copy=make('button','command-button learn-copy','Copy formula');copy.type='button';copy.addEventListener('click',async()=>{
      try{await navigator.clipboard.writeText(step.solution);copy.textContent='Copied';}catch{copy.textContent='Clipboard unavailable';}
    });
    const runOne=make('button','command-button','Run step');runOne.type='button';runOne.addEventListener('click',()=>executeWalkthrough(i));
    header.append(copy,runOne);card.append(header,make('p','',step.why),make('pre','learn-walk-code',step.solution));
    const output=make('div','learn-walk-result');output.hidden=true;
    output.append(make('strong','', langText('Result','Resultado')),make('pre','',''));card.append(output);container.append(card);
  }
}
async function executeWalkthrough(onlyStep=null){
  const l=getLesson(),button=$('run-walkthrough');button.disabled=true;button.textContent='Evaluating…';
  $('walkthrough-state').textContent='Executing local expressions';
  try{
    const all=await runWalkthrough(l,run);
    if(state.lessonId!==l.id)return;
    state.walkthrough=all;
    const selected=Number($('walkthrough-dataset').value)||0;
    const result=all[selected];
    for(const [i,card] of [...document.querySelectorAll('.learn-walk-card')].entries()){
      const box=card.querySelector('.learn-walk-result');
      if(onlyStep!==null&&i!==onlyStep){box.hidden=true;continue;}
      const stepResult=result.steps[i];box.hidden=false;
      box.querySelector('strong').textContent=stepResult.success?langText('✓ Executed · ','✓ Ejecutado · ')+stepResult.valueType:langText('✕ Evaluation error','✕ Error de evaluación');
      box.querySelector('pre').textContent=stepResult.success?pretty(stepResult.value)+(stepResult.traces?.length?`\n\nTrace events (simulated): ${pretty(stepResult.traces)}`:''):stepResult.error?.message||'Unknown error';
    }
    $('walkthrough-state').textContent=`${result.steps.filter(s=>s.success).length}/${l.steps.length} steps executed · ${result.name}`;
  }catch(error){$('walkthrough-state').textContent=`Evaluation error: ${error.message||error}`;}
  finally{button.disabled=false;button.textContent='Run full walkthrough';}
}
function downloadProgress(){
  const snapshot={schema:'powerfx-learning-progress/1',exportedAt:new Date().toISOString(),platform:'local playground',note:'Contains learner-written formulas stored in this browser; not a Microsoft certification.',progress:Object.fromEntries(Object.entries(state.progress))};
  const blob=new Blob([pretty(snapshot)],{type:'application/json'}),url=URL.createObjectURL(blob),a=make('a');
  a.href=url;a.download='powerfx-learning-progress.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const translatedIds={
'language-label':['Language','Idioma'],
'lab-kicker':['PRACTICE TOOLKIT','HERRAMIENTAS DE PRÁCTICA'],
'lab-heading':['Training tools','Herramientas de aprendizaje'],
'tutor-title':['Formula coach','Tutor de fórmulas'],
'tutor-intro':['Rule-based guidance. No AI service or tenant access.','Orientación basada en reglas, sin servicio de IA ni acceso al tenant.'],
'tutor-related-label':['Related exercises','Ejercicios relacionados'],
'clinic-title':['Delegation Clinic','Clínica de delegación'],
'clinic-intro':['Educational checks only. Verify in Power Apps Studio.','Análisis educativo. Valida en Power Apps Studio.'],
'clinic-source-label':['Data source','Origen de datos'],
'clinic-formula-label':['Formula to inspect','Fórmula para analizar'],
'dataset-title':['Challenge data generator','Generador de datasets'],
'dataset-intro':['Reproducible synthetic inputs with edge cases.','Datos sintéticos reproducibles con casos límite.'],
'dataset-mode-label':['Stress mode','Tipo de desafío'],
'dataset-seed-label':['Reproducible seed','Semilla reproducible'],
'packs-title':['Community Challenge Packs','Packs de la comunidad'],
'packs-intro':['Load a validated offline JSON pack. No third-party JavaScript is executed.','Carga un pack JSON validado sin ejecutar JavaScript de terceros.'],
'skills-title':['Skill progress','Progreso de habilidades'],
'skills-intro':['Based on locally completed exercises, not a certification.','Basado en ejercicios completados localmente; no es una certificación.'],
'skills-next-label':['Recommended next lessons','Próximas lecciones recomendadas'],
};
const translatedButtons={
'tutor-next-hint':['Reveal next hint','Mostrar siguiente pista'],
'clinic-analyze':['Analyze delegation','Analizar delegación'],
'dataset-generate':['Generate dataset','Generar dataset'],
'dataset-test':['Check my formula with this fixture','Evaluar fórmula con estos datos'],
'pack-import':['Import pack JSON','Importar pack JSON'],
'pack-template':['Download template','Descargar plantilla'],
'pack-remove':['Remove imported pack','Quitar pack importado'],
};
function applyLanguage(){
 for(const [id,options] of Object.entries(translatedIds))$(id).textContent=options[state.lang==='es'?1:0];
 for(const [id,options] of Object.entries(translatedButtons))$(id).textContent=options[state.lang==='es'?1:0];
 const labels={'lesson-search':['Search topics or functions','Buscar temas o funciones']};
 for(const [id,options] of Object.entries(labels))$(id).placeholder=options[state.lang==='es'?1:0];
 $('mode-challenge').innerHTML=langText('Challenge <span>Try it yourself</span>','Desafío <span>Resuélvelo</span>');
 $('mode-walkthrough').innerHTML=langText('Walkthrough <span>Solution & execution</span>','Solución <span>Paso a paso</span>');
 $('hint-button').textContent=langText('Show hint','Mostrar pista');
 $('check-step').innerHTML=langText('Check expression <kbd>Ctrl+Enter</kbd>','Evaluar expresión <kbd>Ctrl+Enter</kbd>');
 $('run-walkthrough').textContent=langText('Run full walkthrough','Ejecutar solución completa');
 const staticLabels=[
  ['.learn-explorer-heading h2','Practice cases','Casos prácticos'],
  ['.learn-explorer-heading p','Complete hands-on steps or study a fully executed solution.','Resuelve desafíos o estudia soluciones ejecutadas.'],
  ['.learn-contextbar strong','Practice complex expressions in a safe sandbox','Practica expresiones complejas en un entorno seguro'],
  ['.learn-goal strong','Your mission','Tu misión'],
  ['.learn-progress-heading strong','Step-by-step challenge','Desafío por etapas'],
  ['#step-prompt-type','Write a formula','Escribe una fórmula'],
  ['.learn-data-heading strong','Test context','Datos de prueba'],
  ['.learn-editor-title strong','Expression editor','Editor de expresiones'],
  ['.learn-solution-intro h2','Study each step and its result','Estudia cada paso y su resultado'],
  ['.learn-solution-intro p','See the complete reference implementation, why it works, and the output produced by each expression. All computations run in the local compatibility sandbox.','Consulta la implementación de referencia, su explicación y la salida de cada expresión. Todo se evalúa localmente.'],
  ['.learn-inspector-header h2','Lesson navigator','Navegador de lecciones'],
  ['.learn-inspector-header .panel-kicker','LEARNING GUIDE','GUÍA DE APRENDIZAJE'],
 ];
 for(const [selector,en,es] of staticLabels){const element=document.querySelector(selector);if(element)element.textContent=langText(en,es);}
 const buttons=[
  ['export-progress','Export','Exportar'],
  ['reset-formula','Clear','Limpiar'],
  ['prev-step','← Previous','← Anterior'],
  ['next-step','Next step →','Siguiente paso →'],
  ['reset-lesson','Reset this lesson','Reiniciar esta lección']
 ];
 for(const [id,en,es] of buttons)$(id).textContent=langText(en,es);

 $('learning-completed').textContent=langText('Progress saved locally','Progreso guardado localmente');
 for(const [el,en,es] of [
  ['lesson-search','Search topics or functions','Buscar temas o funciones'],
  ['learn-formula','Write your solution here…','Escribe tu fórmula aquí…']])$(el).placeholder=langText(en,es);
}
function initialize(){
  $('learn-language').value=state.lang;
  $('learn-language').addEventListener('change',()=>{
    state.lang=$('learn-language').value==='es'?'es':'en';
    try{localStorage.setItem('powerfx-learning-lang',state.lang);}catch{}
    applyLanguage();renderList();renderHeader();renderStep();extras?.onLanguageChange();
  });
  extras=initLearningExtras({$,state,run,getLesson,allLessons:()=>lessons,answers,gradeStep,runWalkthrough,lessonFixtures,
    selectLesson,renderList,
    addPack:(pack)=>{lessons=[...builtInLessons,...pack.lessons];state.progress=normalizeProgress(state.progress,lessons);persist();renderList();selectLesson(pack.lessons[0].id);},
    removePack:()=>{lessons=[...builtInLessons];state.progress=normalizeProgress(state.progress,lessons);persist();selectLesson(builtInLessons[0].id);renderList();},
  });
  applyLanguage();
  $('lesson-search').addEventListener('input',renderList);
  $('lesson-level').addEventListener('change',renderList);
  $('lesson-platform').addEventListener('change',renderList);
  $('mode-challenge').addEventListener('click',()=>setMode('challenge'));
  $('mode-walkthrough').addEventListener('click',()=>setMode('walkthrough'));
  $('learn-formula').addEventListener('input',rememberDraft);
  $('learn-formula').addEventListener('keydown',event=>{
    if(event.key==='Tab'){event.preventDefault();const el=event.currentTarget;el.setRangeText('  ',el.selectionStart,el.selectionEnd,'end');rememberDraft();}
    if((event.metaKey||event.ctrlKey)&&event.key==='Enter'){event.preventDefault();checkStep();}
  });
  $('check-step').addEventListener('click',checkStep);
  $('hint-button').addEventListener('click',()=>{const visible=$('step-hint').hidden;$('step-hint').hidden=!visible;$('hint-button').textContent=visible?langText('Hide hint','Ocultar pista'):langText('Show hint','Mostrar pista');});
  $('reset-formula').addEventListener('click',()=>{$('learn-formula').value='';rememberDraft();$('learn-formula').focus();});
  $('prev-step').addEventListener('click',()=>selectStep(state.index-1));
  $('next-step').addEventListener('click',()=>selectStep(state.index+1));
  $('run-walkthrough').addEventListener('click',()=>executeWalkthrough());
  $('walkthrough-dataset').addEventListener('change',()=>{if(state.walkthrough)executeWalkthrough();});
  $('challenge-dataset').addEventListener('change',renderContextPreview);
  $('export-progress').addEventListener('click',downloadProgress);
  $('reset-lesson').addEventListener('click',()=>{
    if(!confirm('Reset the completed steps in this lesson? This only affects your local browser progress.'))return;
    delete state.progress[state.lessonId];for(const key of [...state.drafts.keys()])if(key.startsWith(state.lessonId+':'))state.drafts.delete(key);
    persist();state.index=0;renderStep();renderList();
  });
  const target=decodeURIComponent(location.hash.slice(1));
  selectLesson(lessons.some(l=>l.id===target)?target:lessons[0].id);
  setMode('challenge');window.__powerFxLearningReady=true;
}
initialize();
