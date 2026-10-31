const $ = (id) => document.getElementById(id);
const examples = [
  {name:'Conditional pricing',category:'Power Apps · Canvas',platform:'canvas',formula:'If(Amount >= 1000, "High priority", "Standard")',inputs:{Amount:1250},expected:'High priority'},
  {name:'Filter a collection',category:'Power Apps · Canvas',platform:'canvas',formula:'Filter(Orders, ThisRecord.Status = "Open")',inputs:{Orders:[{Id:1,Status:'Open',Total:150},{Id:2,Status:'Closed',Total:90},{Id:3,Status:'Open',Total:230}]}},
  {name:'LookUp by ID',category:'Power Apps · Canvas',platform:'canvas',formula:'LookUp(Orders, ThisRecord.Id = 2, ThisRecord.Total)',inputs:{Orders:[{Id:1,Total:100},{Id:2,Total:225}]}},
  {name:'Sum a table',category:'Power Apps · Canvas',platform:'canvas',formula:'Sum(Orders, ThisRecord.Total)',inputs:{Orders:[{Total:25},{Total:75},{Total:60}]},expected:160},
  {name:'Workflow variables',category:'Power Automate · WDL',platform:'flow',formula:"@concat('Hello ', variables('customerName'), '!')",inputs:{'variables:customerName':'Alex'},expected:'Hello Alex!'},
  {name:'Trigger body',category:'Power Automate · WDL',platform:'flow',formula:"@if(greater(triggerBody()?['Amount'], 1000), 'Review', 'Approved')",inputs:{triggerbody:{Amount:1250}},expected:'Review'},
  {name:'Action output',category:'Power Automate · WDL',platform:'flow',formula:"@outputs('Compose')?['body']?['Total']",inputs:{'outputs:Compose':{body:{Total:450}}},expected:450}
];
let found=[],inputs={},lastResult=null,history=[];
try{history=JSON.parse(localStorage.getItem('powerfx-playground-history-v1')||'[]').slice(0,15);}catch{}
function saveHistory(){try{localStorage.setItem('powerfx-playground-history-v1',JSON.stringify(history.slice(0,15)));}catch{}}
const formatJSON=v=>JSON.stringify(v,null,2);
function parseVal(raw){return JSON.parse(raw);}
function preserveInputs(){for(const div of $('input-fields').querySelectorAll('[data-name]')){try{inputs[div.dataset.name]=parseVal(div.querySelector('textarea').value);}catch{}}}
function addInputField(name,kind='variable'){
  const wrapper=document.createElement('div');wrapper.className='input-item';wrapper.dataset.name=name;
  const label=document.createElement('label');const labelText=document.createElement('span');labelText.textContent=name;const type=document.createElement('em');type.textContent=kind;label.append(labelText,type);
  const textarea=document.createElement('textarea');textarea.spellcheck=false;textarea.setAttribute('aria-label',`Valor JSON para ${name}`);
  textarea.value=formatJSON(inputs[name]!==undefined?inputs[name]:kind.includes('body')||name==='triggerbody'?{}:kind==='variable'&&/orders|items|records|table/i.test(name)?[]:null);
  textarea.addEventListener('input',()=>{try{const val=parseVal(textarea.value);inputs[name]=val;textarea.classList.remove('input-invalid');}catch{textarea.classList.add('input-invalid');}});
  wrapper.append(label,textarea);$('input-fields').append(wrapper);
}
function renderInputs(){preserveInputs();$('input-fields').replaceChildren();for(const item of found)addInputField(item.key,item.kind);$('input-count').textContent=`${found.length} found`;}
let staticMode = location.hostname.endsWith('.github.io') || location.protocol === 'file:';
let localModulePromise;
async function localRequest(path,data){
  localModulePromise ??= import('./core/evaluator.js');
  const core=await localModulePromise;
  try {return path.endsWith('/analyze')?core.inspect(data):core.evaluate(data);}
  catch(error){return path.endsWith('/analyze')?{valid:false,...core.safeError(error)}:core.safeError(error);}
}
async function request(path,data){
  if(staticMode) return localRequest(path,data);
  try {
    const res=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    if(res.status===404){staticMode=true;return localRequest(path,data);}
    return await res.json();
  }catch(error){
    // Do not silently switch to a different engine when a configured API fails.
    return {success:false,valid:false,error:{message:'Servidor de evaluación no disponible: '+error.message}};
  }
}
function status(element,text,kind='neutral'){element.textContent=text;element.className='mini-status '+kind;}
function showError(message,position){status($('execution-status'),'Error','fail');$('error-detail').hidden=false;$('error-detail').textContent=message+(position!=null?` (position ${position})`:'');$('result-json').textContent='// Evaluation failed';$('result-type').textContent='Error';$('result-time').textContent='—';$('assertion').textContent='—';$('result-table').hidden=true;}
async function analyze(silent=false){try{
  const data=await request('/api/analyze',{formula:$('formula').value,platform:$('platform').value});
  if(!data.valid){status($('formula-status'),data.error?.message||'Parse error','fail');if(!silent)showError(data.error?.message||'Error de sintaxis',data.error?.position);return false;}
  found=data.inputs||[];renderInputs();status($('formula-status'),'Syntax valid','ok');return true;
}catch(e){if(!silent)showError(e.message);return false;}}
function readInputs(){const result={};for(const wrap of $('input-fields').querySelectorAll('[data-name]')){const text=wrap.querySelector('textarea');try{result[wrap.dataset.name]=parseVal(text.value);text.classList.remove('input-invalid');}catch{ text.classList.add('input-invalid');throw new Error(`JSON inválido en input «${wrap.dataset.name}»`);}}return result;}
function renderTable(data){const container=$('result-table');container.replaceChildren();container.hidden=true;if(!Array.isArray(data)||!data.length||!data.every(x=>x&&typeof x==='object'&&!Array.isArray(x)))return;
  const keys=[...new Set(data.flatMap(x=>Object.keys(x)))].slice(0,20);const table=document.createElement('table');const head=document.createElement('tr');for(const key of keys){const cell=document.createElement('th');cell.textContent=key;head.append(cell);}table.append(head);for(const row of data.slice(0,100)){const tr=document.createElement('tr');for(const key of keys){const cell=document.createElement('td'),v=row[key];cell.textContent=typeof v==='object'?formatJSON(v):String(v??'');tr.append(cell);}table.append(tr);}container.append(table);container.hidden=false;}
async function run(){status($('execution-status'),'Running...');$('error-detail').hidden=true;
  try{const inputData=readInputs();inputs={...inputs,...inputData};const payload={formula:$('formula').value,platform:$('platform').value,inputs:inputData,locale:$('locale').value};
    if($('expected').value.trim())try{payload.expected=parseVal($('expected').value);}catch{throw new Error('Expected output debe ser un valor JSON válido');}
    const result=await request('/api/evaluate',payload);lastResult=result;
    if(!result.success){showError(result.error?.message||'Evaluation error',result.error?.position);return;}
    status($('execution-status'),result.assertion&&!result.assertion.passed?'Assertion failed':'Success',result.assertion&&!result.assertion.passed?'fail':'ok');
    $('result-json').textContent=formatJSON(result.value);$('result-type').textContent=result.valueType;$('result-time').textContent=`${result.elapsedMs??0} ms`;
    $('assertion').textContent=result.assertion?(result.assertion.passed?'✓ Passed':'✕ Failed'):'Not set';$('error-detail').hidden=true;renderTable(result.value);
    history.unshift({formula:payload.formula,platform:payload.platform,inputs:payload.inputs,expected:payload.expected,time:new Date().toISOString(),passed:result.assertion?.passed??true});history=history.slice(0,15);saveHistory();renderHistory();
  }catch(e){showError(e.message);}}
function renderHistory(){const parent=$('history-items');parent.replaceChildren();if(!history.length){const empty=document.createElement('div');empty.className='empty-hint';empty.textContent='No executions yet. Your runs appear here.';parent.append(empty);return;}
  for(const h of history){const div=document.createElement('div');div.className='history-item';const button=document.createElement('button');button.textContent=h.formula.length>74?h.formula.slice(0,74)+'…':h.formula;button.title='Load this execution';button.addEventListener('click',async()=>{inputs={...h.inputs};$('formula').value=h.formula;$('platform').value=h.platform;$('expected').value=h.expected===undefined?'':formatJSON(h.expected);setPlatform();await analyze();window.scrollTo({top:0,behavior:'smooth'});});const info=document.createElement('span');info.textContent=`${h.passed?'✓':'✕'} ${new Date(h.time).toLocaleTimeString()}`;div.append(button,info);parent.append(div);}}
function setPlatform(){$('editor-description').textContent=$('platform').value==='canvas'?'Power Fx · Canvas expression':'Workflow Definition Language · Cloud flow expression';$('locale').disabled=$('platform').value==='flow';$('formula-status').textContent='Not validated';$('formula-status').className='mini-status neutral';}
async function loadExample(example){inputs={...example.inputs};$('platform').value=example.platform;$('formula').value=example.formula;$('expected').value=example.expected===undefined?'':formatJSON(example.expected);setPlatform();$('characters').textContent=$('formula').value.length;await analyze(true);$('result-json').textContent='// Click Run expression to evaluate this scenario';$('result-type').textContent='—';$('result-time').textContent='—';$('assertion').textContent='—';status($('execution-status'),'Ready');$('error-detail').hidden=true;$('result-table').hidden=true;}
async function init(){
  const list=$('examples');for(const example of examples){const b=document.createElement('button');b.className='example-button';const cat=document.createElement('span');cat.className='category';cat.textContent=example.category;const title=document.createElement('span');title.textContent=example.name;b.append(cat,title);b.onclick=()=>loadExample(example);list.append(b);}
  $('platform').addEventListener('change',async()=>{setPlatform();await analyze(true);});
  $('formula').addEventListener('input',()=>{$('characters').textContent=$('formula').value.length;status($('formula-status'),'Not validated');});
  $('analyze-button').onclick=()=>analyze();$('run-button').onclick=run;
  $('add-input').onclick=()=>{const key=prompt('Input name (e.g. User, variables:count, outputs:Compose)');if(!key||key.length>120||['__proto__','constructor','prototype'].includes(key))return;preserveInputs();if(!found.some(x=>x.key===key))found.push({key,kind:'custom'});renderInputs();};
  $('clear-history').onclick=()=>{history=[];saveHistory();renderHistory();};
  $('copy-result').onclick=async()=>{if(!lastResult)return;await navigator.clipboard.writeText(formatJSON(lastResult));$('copy-result').textContent='Copied';setTimeout(()=>$('copy-result').textContent='Copy JSON',1200);};
  $('format-button').onclick=()=>{$('formula').value=$('formula').value.trim();$('characters').textContent=$('formula').value.length;};
  $('export-button').onclick=()=>{try{
    const inputData=readInputs();const scenario={version:1,platform:$('platform').value,locale:$('locale').value,formula:$('formula').value,inputs:inputData,expected:$('expected').value.trim()?parseVal($('expected').value):undefined};
    const blob=new Blob([formatJSON(scenario)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='powerfx-test-scenario.json';a.click();URL.revokeObjectURL(url);
  }catch(e){showError(e.message);}};
  $('import-button').onclick=()=>$('scenario-file').click();
  $('scenario-file').addEventListener('change',async(event)=>{const file=event.target.files?.[0];if(!file)return;
    try {if(file.size>1048576)throw new Error('El archivo supera el máximo de 1 MB');
      const scenario=JSON.parse(await file.text());if(!scenario||typeof scenario.formula!=='string'||!['canvas','flow'].includes(scenario.platform)||!scenario.inputs||typeof scenario.inputs!=='object'||Array.isArray(scenario.inputs))throw new Error('El archivo no contiene un escenario válido');
      inputs=scenario.inputs;$('platform').value=scenario.platform;$('locale').value=scenario.locale==='es-ES'?'es-ES':'en-US';$('formula').value=scenario.formula;$('expected').value=scenario.expected===undefined?'':formatJSON(scenario.expected);setPlatform();$('characters').textContent=scenario.formula.length;await analyze();status($('execution-status'),'Imported');
    }catch(e){showError('Importación fallida: '+e.message);}finally{event.target.value='';}
  });
  window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();run();}});
  renderHistory();await loadExample(examples[0]);
  if(staticMode){$('backend-pill').textContent='● Browser sandbox active';$('engine-label').textContent='Canvas + Flow: browser compatibility subsets';}
  else try{const response=await fetch('/api/status');if(!response.ok)throw new Error('No backend');const config=await response.json();$('backend-pill').textContent=config.nativeCanvas?'● Official Power Fx connected':'● Local sandbox active';$('engine-label').textContent=config.nativeCanvas?'Canvas: Microsoft Power Fx SDK · Cloud: local WDL subset':'Canvas + Flow: local compatibility subsets';}catch{$('backend-pill').textContent='● Server unavailable';}
}
init();
