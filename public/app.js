import {scenarios as examples} from './scenarios.js';
import {functionCatalog} from './function-catalog.js';
import {completionContext,functionMatches,csvSerialize,jsonTreeLabel,validateSuite} from './client-tools.js';
const $ = id => document.getElementById(id);
const formatJSON = v => JSON.stringify(v,null,2);
const parseVal = raw => JSON.parse(raw);
let found=[],inputs={},lastResult=null,history=[],selectedExample=-1,resultView='json',tab='inputs',analyzeTimer;
try { const persisted=JSON.parse(localStorage.getItem('powerfx-playground-history-v1')||'[]'); history=Array.isArray(persisted)?persisted.slice(0,15):[]; } catch {}
function saveHistory(){try{localStorage.setItem('powerfx-playground-history-v1',JSON.stringify(history.slice(0,15)));}catch{}}
function status(element,text,kind='neutral'){element.textContent=text;element.className='mini-status '+kind;}
function workspaceStatus(text='Ready',failed=false){$('workspace-status').textContent=text;$('workspace-status').style.color=failed?'#b10e1e':'#107c10';}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function highlightCode(source){
  // Presentational highlighting only. The formula is never executed as JavaScript.
  const re=/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|''|\\.)*'|\b[A-Za-z_][A-Za-z_0-9]*(?=\s*\()|\b(?:true|false|blank|null|ThisRecord|Self|Parent)\b|\b\d+(?:\.\d+)?\b|@|>=|<=|<>|&&|\|\||[+*\-/=<>])/gi;
  let out='',index=0,match;
  while((match=re.exec(source))!==null){
    out+=escapeHTML(source.slice(index,match.index)); const v=match[0];
    const cls=/^['"]/.test(v)?'tok-string':/^\d/.test(v)?'tok-number':v==='@'?'tok-at':/^(?:true|false|blank|null|ThisRecord|Self|Parent)$/i.test(v)?'tok-keyword':/^[A-Za-z_]/.test(v)?'tok-call':'tok-operator';
    out+=`<span class="${cls}">${escapeHTML(v)}</span>`;index=re.lastIndex;
  }
  return out+escapeHTML(source.slice(index));
}
function updateEditor(){
  const value=$('formula').value;
  $('syntax-highlight').innerHTML=highlightCode(value)+'\n';
  const count=value.split('\n').length;
  $('editor-lines').textContent=Array.from({length:Math.max(count,8)},(_,i)=>i+1).join('\n');
  $('characters').textContent=String(value.length);$('line-count').textContent=String(count);
}
function syncCodeScroll(){
  $('syntax-highlight').scrollTop=$('formula').scrollTop;
  $('syntax-highlight').scrollLeft=$('formula').scrollLeft;
  $('editor-lines').scrollTop=$('formula').scrollTop;
}
function activateTab(next){
  tab=next;
  for(const b of document.querySelectorAll('.inspector-tabs [data-tab]')){const active=b.dataset.tab===next;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));}
  for(const section of document.querySelectorAll('.inspector-pane'))section.hidden=section.id!==`tab-${next}`;
}
function selectResultView(next){
  resultView=next;
  for(const b of document.querySelectorAll('[data-result-view]')){const active=b.dataset.resultView===next;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));}
  $('result-json').hidden=next!=='json';$('result-table').hidden=next!=='table';$('result-tree').hidden=next!=='tree';
  if(next==='table')$('result-table').classList.toggle('table-empty',!$('result-table').querySelector('table'));
}
function preserveInputs(){
  for(const wrap of $('input-fields').querySelectorAll('[data-name]')){
    try{inputs[wrap.dataset.name]=parseVal(wrap.querySelector('textarea').value);}catch{}
  }
}
let modalTarget=null;
function jsonLineHeight(raw){return Math.max(160,Math.min(360,raw.split('\n').length*17+34));}
function editJson(field,name){
  modalTarget=field;
  $('json-dialog-title').textContent=name;
  $('json-modal-text').value=field.value;
  $('json-modal-error').textContent='';
  $('json-editor-dialog').showModal();
  $('json-modal-text').focus();
}
function closeJsonEditor(){
  $('json-editor-dialog').close();
  modalTarget=null;
}
function saveJsonEditor(){
  try{
    const value=parseVal($('json-modal-text').value);
    const content=formatJSON(value);
    if(!modalTarget||!modalTarget.isConnected){closeJsonEditor();return;}
    modalTarget.value=content;
    modalTarget.style.height=jsonLineHeight(content)+'px';
    modalTarget.dispatchEvent(new Event('input',{bubbles:true}));
    closeJsonEditor();workspaceStatus('JSON input updated');
  }catch(error){$('json-modal-error').textContent='Invalid JSON: '+error.message;}
}
function formatJsonEditor(){
  try{$('json-modal-text').value=formatJSON(parseVal($('json-modal-text').value));$('json-modal-error').textContent='';}
  catch(error){$('json-modal-error').textContent='Invalid JSON: '+error.message;}
}
function addInputField(name,kind='variable'){
  const wrapper=document.createElement('div');wrapper.className='input-item';wrapper.dataset.name=name;
  const header=document.createElement('div');header.className='input-item-header';
  const label=document.createElement('label');const key=document.createElement('span');key.textContent=name;
  const textarea=document.createElement('textarea');const fieldId=`json-field-${$('input-fields').children.length}`;
  textarea.id=fieldId;label.htmlFor=fieldId;label.append(key);
  const type=document.createElement('em');type.textContent=kind;
  const expand=document.createElement('button');expand.type='button';expand.className='input-expand';
  expand.textContent='Expand';expand.title=`Open large JSON editor for ${name}`;
  expand.setAttribute('aria-label',`Expand JSON input ${name}`);
  expand.addEventListener('click',()=>editJson(textarea,name));
  const actions=document.createElement('div');actions.className='input-item-actions';actions.append(type,expand);
  header.append(label,actions);
  textarea.spellcheck=false;textarea.setAttribute('aria-label',`JSON input value for ${name}`);
  textarea.value=formatJSON(inputs[name]!==undefined?inputs[name]:kind.includes('body')||name==='triggerbody'?{}:kind==='variable'&&/orders|items|records|table/i.test(name)?[]:null);
  textarea.style.height=jsonLineHeight(textarea.value)+'px';
  textarea.addEventListener('input',()=>{try{inputs[name]=parseVal(textarea.value);textarea.classList.remove('input-invalid');}catch{textarea.classList.add('input-invalid');}});
  wrapper.append(header,textarea);$('input-fields').append(wrapper);
}
function renderInputs(){preserveInputs();$('input-fields').replaceChildren();for(const item of found)addInputField(item.key,item.kind);$('input-count').textContent=String(found.length);}
let staticMode=location.hostname.endsWith('.github.io')||location.protocol==='file:';
let localModulePromise;
async function localRequest(path,data){
  localModulePromise ??= import('./core/evaluator.js');const core=await localModulePromise;
  try{return path.endsWith('/analyze')?core.inspect(data):core.evaluate(data);}
  catch(error){return path.endsWith('/analyze')?{valid:false,...core.safeError(error)}:core.safeError(error);}
}
async function request(path,data){
  if(staticMode)return localRequest(path,data);
  try{const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    if(response.status===404){staticMode=true;return localRequest(path,data);}
    return await response.json();
  }catch(error){return {success:false,valid:false,error:{message:'Evaluation server unavailable: '+error.message}};}
}
function showError(message,position){
  lastResult=null;renderTraces(null);$('export-csv').disabled=true;status($('execution-status'),'Error','fail');$('error-detail').hidden=false;
  $('error-detail').textContent=String(message)+(position!=null?` (position ${position})`:'');
  $('result-json').textContent='// Evaluation failed';$('result-type').textContent='Error';$('result-time').textContent='—';$('assertion').textContent='—';
  $('result-table').replaceChildren();$('result-tree').replaceChildren();workspaceStatus('Evaluation error',true);selectResultView('json');
}
async function analyze(silent=false){
  try{const data=await request('/api/analyze',{formula:$('formula').value,platform:$('platform').value});
    if(!data.valid){status($('formula-status'),data.error?.message||'Syntax error','fail');if(!silent)showError(data.error?.message||'Syntax error',data.error?.position);return false;}
    found=data.inputs||[];renderInputs();status($('formula-status'),'Syntax valid','ok');workspaceStatus('Analysis ready');return true;
  }catch(error){if(!silent)showError(error.message);return false;}
}
function readInputs(){
  const result=Object.create(null);
  for(const wrap of $('input-fields').querySelectorAll('[data-name]')){
    const textarea=wrap.querySelector('textarea');
    try{result[wrap.dataset.name]=parseVal(textarea.value);textarea.classList.remove('input-invalid');}
    catch{textarea.classList.add('input-invalid');activateTab('inputs');throw new Error(`Invalid JSON in input “${wrap.dataset.name}”`);}
  }
  return result;
}
function renderTable(data){
  const container=$('result-table');container.replaceChildren();
  if(!Array.isArray(data)||!data.length||!data.every(x=>x&&typeof x==='object'&&!Array.isArray(x))){
    const empty=document.createElement('p');empty.className='empty-hint';empty.textContent='Table view is available when an expression returns an array of records.';container.append(empty);return;
  }
  const keys=[...new Set(data.flatMap(x=>Object.keys(x)))].slice(0,20),table=document.createElement('table');const head=document.createElement('tr');
  for(const key of keys){const cell=document.createElement('th');cell.textContent=key;head.append(cell);}table.append(head);
  for(const row of data.slice(0,100)){const tr=document.createElement('tr');for(const key of keys){const cell=document.createElement('td'),value=row[key];cell.textContent=value&&typeof value==='object'?formatJSON(value):String(value??'');tr.append(cell);}table.append(tr);}
  container.append(table);
}
function renderTraces(result){
  const panel=$('trace-panel'),body=$('trace-events');
  panel.hidden=!result?.traces?.length;
  body.replaceChildren();
  if(!result?.traces?.length)return;
  $('trace-count').textContent=String(result.traces.length);
  for(const entry of result.traces.slice(0,40)){
    const item=document.createElement('article');item.className='trace-event';
    const head=document.createElement('strong');head.textContent=`${entry.severity} · ${entry.message}`;
    const payload=document.createElement('pre');payload.textContent=formatJSON(entry.customRecord);
    item.append(head,payload);body.append(item);
  }
}
function makeTree(value,parent,level=0,budget={remaining:250}){
  if(budget.remaining--<=0||level>8){const node=document.createElement('span');node.className='tree-truncated';node.textContent='… truncated';parent.append(node);return;}
  if(value!==null&&typeof value==='object'){
    const wrapper=document.createElement('details');wrapper.className='tree-branch';wrapper.open=level<2;
    const label=document.createElement('summary');label.textContent=jsonTreeLabel(value);wrapper.append(label);
    for(const [key,child] of Object.entries(value).slice(0,100)){
      const row=document.createElement('div');row.className='tree-leaf';
      const name=document.createElement('span');name.className='tree-key';name.textContent=key;
      row.append(name);const item=document.createElement('span');item.className='tree-value';row.append(item);
      makeTree(child,item,level+1,budget);wrapper.append(row);
    }
    parent.append(wrapper);
  }else{
    const text=document.createElement('span');text.className='tree-value';text.textContent=jsonTreeLabel(value);parent.append(text);
  }
}
function renderFunctionCatalog(){
  const target=$('function-list');target.replaceChildren();
  const query=$('function-search').value.trim().toLowerCase(),platform=$('platform').value;
  for(const item of functionCatalog.filter(x=>x.platform===platform&&(`${x.name} ${x.description} ${x.category}`.toLowerCase().includes(query))).slice(0,90)){
    const btn=document.createElement('button');btn.type='button';btn.className='function-item';
    const label=document.createElement('strong');label.textContent=item.name;
    const details=document.createElement('small');details.textContent=`${item.category} · ${item.signature}`;
    btn.append(label,details);btn.title=item.description;btn.addEventListener('click',()=>insertFunction(item));target.append(btn);
  }
}
function insertFunction(item){
  const field=$('formula'),start=field.selectionStart,end=field.selectionEnd;
  field.setRangeText(item.name+'(',start,end,'end');field.focus();field.dispatchEvent(new Event('input',{bubbles:true}));
  $('signature-hint').textContent=item.signature+' — '+item.description;$('signature-hint').hidden=false;
  $('completion-list').hidden=true;field.setAttribute('aria-expanded','false');
}
function renderCompletions(force=false){
  const field=$('formula'),context=completionContext(field.value,field.selectionStart,force),popup=$('completion-list');
  popup.replaceChildren();
  const matches=context?functionMatches(functionCatalog,$('platform').value,context.term,9):[];
  if(!matches.length){popup.hidden=true;field.setAttribute('aria-expanded','false');return;}
  for(const item of matches){
    const btn=document.createElement('button');btn.type='button';btn.className='completion-item';
    const strong=document.createElement('strong');strong.textContent=item.name;
    const small=document.createElement('small');small.textContent=item.description;
    btn.append(strong,small);btn.addEventListener('mousedown',e=>e.preventDefault());
    btn.addEventListener('click',()=>{field.setRangeText(item.name+'(',context.start,field.selectionStart,'end');field.focus();field.dispatchEvent(new Event('input',{bubbles:true}));popup.hidden=true;field.setAttribute('aria-expanded','false');});
    popup.append(btn);
  }
  popup.hidden=false;field.setAttribute('aria-expanded','true');
}
async function runSuite(){
  $('suite-results').replaceChildren();let cases;
  try{cases=validateSuite(JSON.parse($('suite-cases').value));}
  catch(error){$('suite-summary').textContent=error.message;return;}
  let passed=0;for(const [i,entry] of cases.entries()){
    const result=await request('/api/evaluate',{formula:$('formula').value,platform:$('platform').value,locale:$('locale').value,inputs:entry.inputs,expected:entry.expected});
    const success=result.success&&result.assertion?.passed===true;if(success)passed++;
    const row=document.createElement('div');row.className='suite-result '+(success?'passed':'failed');
    const title=document.createElement('strong');title.textContent=`${success?'✓':'✕'} ${entry.name||'Case '+(i+1)}`;
    const details=document.createElement('code');details.textContent=success?'Expected output matched':`Expected: ${formatJSON(entry.expected)}\nReceived: ${result.error?.message||formatJSON(result.value)}`;
    row.append(title,details);$('suite-results').append(row);
  }
  $('suite-summary').textContent=`${passed}/${cases.length} tests passed`;
}
async function run(){
  clearTimeout(analyzeTimer);status($('execution-status'),'Running…');$('error-detail').hidden=true;workspaceStatus('Running expression');
  try{
    const inputData=readInputs();inputs={...inputs,...inputData};
    const payload={formula:$('formula').value,platform:$('platform').value,inputs:inputData,locale:$('locale').value};
    if($('expected').value.trim())try{payload.expected=parseVal($('expected').value);}catch{activateTab('tests');throw new Error('Expected output must be valid JSON');}
    const result=await request('/api/evaluate',payload);lastResult=result;
    if(!result.success){showError(result.error?.message||'Evaluation error',result.error?.position);return;}
    const passed=result.assertion?.passed;
    status($('execution-status'),passed===false?'Assertion failed':'Success',passed===false?'fail':'ok');
    $('result-json').textContent=formatJSON(result.value)??'undefined';$('result-type').textContent=result.valueType;
    $('result-time').textContent=`${result.elapsedMs??0} ms`;
    $('assertion').textContent=result.assertion?(passed?'✓ Passed':'✕ Failed'):'Not set';
    $('error-detail').hidden=true;renderTable(result.value);$('result-tree').replaceChildren();makeTree(result.value,$('result-tree'));$('export-csv').disabled=!Array.isArray(result.value)||!result.value.length||!result.value.every(v=>v&&typeof v==='object'&&!Array.isArray(v));renderTraces(result);selectResultView(resultView);workspaceStatus(passed===false?'Assertion failed':'Run complete',passed===false);
    history.unshift({formula:payload.formula,platform:payload.platform,inputs:payload.inputs,expected:payload.expected,time:new Date().toISOString(),passed:passed??true});
    history=history.slice(0,15);saveHistory();renderHistory();
  }catch(error){showError(error.message);}
}
function renderHistory(){
  const parent=$('history-items');parent.replaceChildren();
  if(!history.length){const p=document.createElement('p');p.className='empty-hint';p.textContent='No runs yet. Your recent formulas are saved here in this browser.';parent.append(p);return;}
  for(const item of history){const div=document.createElement('div');div.className='history-item';
    const button=document.createElement('button');button.type='button';button.textContent=item.formula;button.title='Load this execution';
    button.addEventListener('click',async()=>{selectedExample=-1;inputs={...item.inputs};$('formula').value=item.formula;$('input-fields').replaceChildren();$('platform').value=item.platform;$('expected').value=item.expected===undefined?'':formatJSON(item.expected);setPlatform();showScenarioDetails();updateEditor();renderExamples();await analyze(true);});
    const info=document.createElement('span');info.textContent=`${item.passed?'✓':'✕'} · ${new Date(item.time).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}`;
    div.append(button,info);parent.append(div);
  }
}
function renderExamples(){
  const parent=$('examples');parent.replaceChildren();
  const filter=$('example-search').value.trim().toLowerCase();const level=$('level-filter').value;
  const filtered=examples.map((sample,index)=>({...sample,index})).filter(e=>
    (!filter||`${e.name} ${e.group} ${e.level} ${e.description} ${e.formula}`.toLowerCase().includes(filter))&&
    (level==='all'||e.level===level));
  $('example-count').textContent=String(filtered.length);
  if(!filtered.length){const el=document.createElement('p');el.className='empty-search';el.textContent='No matching scenarios. Try a different search or level.';parent.append(el);return;}
  for(const platform of ['canvas','flow']){
    const items=filtered.filter(s=>s.platform===platform);if(!items.length)continue;
    const group=document.createElement('div');group.className='example-group';group.dataset.platform=platform;
    const heading=document.createElement('div');heading.className='example-group-title';heading.textContent=platform==='canvas'?'Power Apps · Canvas':'Power Automate · Cloud';group.append(heading);
    const groups=new Map();
    for(const example of items){if(!groups.has(example.group))groups.set(example.group,[]);groups.get(example.group).push(example);}
    for(const [groupName,groupItems] of groups){
      const category=document.createElement('div');category.className='example-category-heading';category.textContent=groupName;group.append(category);
      for(const example of groupItems){
        const button=document.createElement('button');button.type='button';button.className='example-button'+(selectedExample===example.index?' active':'');
        button.setAttribute('aria-current',selectedExample===example.index?'true':'false');
        button.title=example.description;
        const icon=document.createElement('span');icon.className='example-icon';icon.textContent=example.platform==='canvas'?'ƒx':'{ }';
        const title=document.createElement('span');title.className='example-title';title.textContent=example.name;
        const levelBadge=document.createElement('span');levelBadge.className='example-level';levelBadge.textContent=example.level==='Advanced'?'Pro':example.level==='Intermediate'?'Mid':'Basic';
        button.append(icon,title,levelBadge);button.addEventListener('click',()=>loadExample(example));group.append(button);
      }
    }
    parent.append(group);
  }
}
function showScenarioDetails(example=null){
  $('scenario-level').textContent=example?.level??'Custom';
  $('scenario-description').textContent=example?.description??'Write or paste a formula, provide mock inputs, then execute it.';
  $('scenario-group').textContent=example?.group??'CUSTOM EXPRESSION';
}
function setPlatform(){
  const canvas=$('platform').value==='canvas';
  $('editor-description').textContent=canvas?'Power Fx · Canvas expression':'WDL · Cloud flow expression';
  $('editor-syntax').textContent=canvas?'Power Fx':'Workflow Definition Language';
  $('editor-platform-hint').textContent=canvas?'Canvas formula':'Cloud flow expression';
  $('locale').disabled=!canvas;
  for(const b of document.querySelectorAll('[data-platform]')){const active=b.dataset.platform===$('platform').value;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));}
  status($('formula-status'),'Not validated');
  renderFunctionCatalog();updateEditor();
}
async function loadExample(example){
  selectedExample=example.index??examples.indexOf(example);inputs=structuredClone(example.inputs);$('input-fields').replaceChildren();$('platform').value=example.platform;$('formula').value=example.formula;
  $('expected').value=example.expected===undefined?'':formatJSON(example.expected);setPlatform();showScenarioDetails(example);renderExamples();await analyze(true);
  $('result-json').textContent='// Run an expression to inspect the return value.';
  $('result-type').textContent='—';$('result-time').textContent='—';$('assertion').textContent='—';status($('execution-status'),'Ready');
  $('error-detail').hidden=true;$('result-table').replaceChildren();$('result-tree').replaceChildren();renderTraces(null);$('export-csv').disabled=true;selectResultView('json');activateTab('inputs');workspaceStatus('Scenario loaded');
}
async function init(){
  // Render the library first; later initialization errors must not hide samples.
  renderExamples();
  window.__powerFxWorkbenchReady = true;
  $('example-search').addEventListener('input',renderExamples);
  $('level-filter').addEventListener('change',renderExamples);
  $('example-search').addEventListener('keydown',e=>{if(e.key==='Escape'){$('example-search').value='';renderExamples();}});
  document.querySelectorAll('[data-platform]').forEach(b=>b.addEventListener('click',async()=>{
    if($('platform').value===b.dataset.platform)return;
    preserveInputs();selectedExample=-1;showScenarioDetails();$('platform').value=b.dataset.platform;setPlatform();renderExamples();await analyze(true);
  }));
  $('platform').addEventListener('change',async()=>{setPlatform();await analyze(true);});
  $('formula').addEventListener('input',()=>{
    renderCompletions(false);
    selectedExample=-1;showScenarioDetails();updateEditor();renderExamples();status($('formula-status'),'Edited');workspaceStatus('Unsaved changes');
    clearTimeout(analyzeTimer);analyzeTimer=setTimeout(()=>analyze(true),600);
  });
  $('formula').addEventListener('scroll',syncCodeScroll);
  $('formula').addEventListener('keydown',event=>{
    if((event.ctrlKey||event.metaKey)&&event.code==='Space'){event.preventDefault();renderCompletions(true);return;}
    if(event.key==='Escape'){$('completion-list').hidden=true;$('formula').setAttribute('aria-expanded','false');return;}
    if(event.key==='Tab'){event.preventDefault();const el=$('formula'),start=el.selectionStart;el.setRangeText('  ',start,el.selectionEnd,'end');el.dispatchEvent(new Event('input',{bubbles:true}));}
  });
  document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>activateTab(b.dataset.tab)));
  document.querySelectorAll('[data-result-view]').forEach(b=>b.addEventListener('click',()=>selectResultView(b.dataset.resultView)));
  $('json-editor-cancel').onclick=closeJsonEditor;
  $('json-editor-save').onclick=saveJsonEditor;
  $('json-editor-format').onclick=formatJsonEditor;
  $('expand-expected').onclick=()=>editJson($('expected'),'Expected output');
  $('json-editor-dialog').addEventListener('close',()=>{modalTarget=null;});
  $('json-modal-text').addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();saveJsonEditor();}});
  $('analyze-button').onclick=async()=>{const valid=await analyze();if(valid)activateTab('inputs');};
  $('run-button').onclick=run;
  $('function-search').addEventListener('input',renderFunctionCatalog);
  $('suite-run').onclick=runSuite;
  $('suite-template').onclick=()=>{
    try{
      const payload={name:'Current inputs',inputs:readInputs(),expected:$('expected').value.trim()?parseVal($('expected').value):null};
      $('suite-cases').value=formatJSON([payload]);activateTab('suite');
    }catch(error){$('suite-summary').textContent=error.message;}
  };
  $('export-csv').onclick=()=>{
    try{
      const csv=csvSerialize(lastResult?.value),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
      const link=document.createElement('a');link.href=url;link.download='powerfx-result.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
    }catch(error){workspaceStatus(error.message,true);}
  };
  $('add-input').onclick=()=>{const key=prompt('Input name (e.g. User, variables:count, outputs:Compose)');if(!key||key.length>120||['__proto__','constructor','prototype'].includes(key))return;preserveInputs();if(!found.some(x=>x.key===key))found.push({key,kind:'custom'});renderInputs();};
  $('clear-history').onclick=()=>{history=[];saveHistory();renderHistory();};
  $('copy-result').onclick=async()=>{
    if(!lastResult)return;
    try{await navigator.clipboard.writeText(formatJSON(lastResult));$('copy-result').textContent='Copied';setTimeout(()=>$('copy-result').textContent='Copy JSON',1250);}
    catch{workspaceStatus('Clipboard unavailable',true);}
  };
  $('format-button').onclick=()=>{$('formula').value=$('formula').value.trim();updateEditor();};
  $('export-button').onclick=()=>{
    try{const inputData=readInputs();const scenario={version:1,platform:$('platform').value,locale:$('locale').value,formula:$('formula').value,inputs:inputData,expected:$('expected').value.trim()?parseVal($('expected').value):undefined};
      const blob=new Blob([formatJSON(scenario)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='powerfx-test-scenario.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2500);workspaceStatus('Scenario exported');
    }catch(e){showError(e.message);}
  };
  $('import-button').onclick=()=>$('scenario-file').click();
  $('scenario-file').addEventListener('change',async event=>{
    const file=event.target.files?.[0];if(!file)return;
    try{if(file.size>1048576)throw new Error('Maximum file size is 1 MB');const scenario=JSON.parse(await file.text());
      if(!scenario||typeof scenario.formula!=='string'||!['canvas','flow'].includes(scenario.platform)||!scenario.inputs||typeof scenario.inputs!=='object'||Array.isArray(scenario.inputs))throw new Error('Invalid scenario format');
      selectedExample=-1;inputs=structuredClone(scenario.inputs);$('input-fields').replaceChildren();showScenarioDetails();$('platform').value=scenario.platform;$('locale').value=scenario.locale==='es-ES'?'es-ES':'en-US';$('formula').value=scenario.formula;
      $('expected').value=scenario.expected===undefined?'':formatJSON(scenario.expected);setPlatform();renderExamples();await analyze();activateTab('inputs');workspaceStatus('Scenario imported');
    }catch(error){showError('Import failed: '+error.message);}finally{event.target.value='';}
  });
  window.addEventListener('keydown',event=>{
    if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();run();}
    if(event.key==='/'&&!event.ctrlKey&&!event.altKey&&!event.metaKey&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){event.preventDefault();$('example-search').focus();}
  });
  renderHistory();renderExamples();renderFunctionCatalog();await loadExample(examples[0]);
  if(staticMode){$('backend-pill').innerHTML='<span class="status-dot"></span>Browser sandbox';$('engine-label').textContent='Browser compatibility subset';}
  else try{const res=await fetch('/api/status');if(!res.ok)throw new Error('No backend');const config=await res.json();
    $('backend-pill').innerHTML='<span class="status-dot"></span>'+(config.nativeCanvas?'Official Power Fx connected':'Local sandbox');
    $('engine-label').textContent=config.nativeCanvas?'Microsoft Power Fx SDK + local WDL':'Local compatibility subsets';
  }catch{$('backend-pill').textContent='● Server unavailable';}
}
init().catch(error => {
  console.error('Power Fx Playground failed to initialize:',error);
  const container=document.getElementById('examples');
  if(!window.__powerFxWorkbenchReady && container){
    const message=document.createElement('p');message.className='empty-hint load-failure';
    message.textContent='The scenario library could not initialize. Refresh the page to retry.';
    container.replaceChildren(message);
  }
});
