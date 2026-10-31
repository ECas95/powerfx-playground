const $ = id => document.getElementById(id);
const examples = [
  {name:'Conditional pricing',category:'Power Apps · Canvas',platform:'canvas',formula:'If(Amount >= 1000, "High priority", "Standard")',inputs:{Amount:1250},expected:'High priority'},
  {name:'Filter a collection',category:'Power Apps · Canvas',platform:'canvas',formula:'Filter(Orders, ThisRecord.Status = "Open")',inputs:{Orders:[{Id:1,Status:'Open',Total:150},{Id:2,Status:'Closed',Total:90},{Id:3,Status:'Open',Total:230}]}},
  {name:'LookUp by ID',category:'Power Apps · Canvas',platform:'canvas',formula:'LookUp(Orders, ThisRecord.Id = 2, ThisRecord.Total)',inputs:{Orders:[{Id:1,Total:100},{Id:2,Total:225}]}},
  {name:'Sum a table',category:'Power Apps · Canvas',platform:'canvas',formula:'Sum(Orders, ThisRecord.Total)',inputs:{Orders:[{Total:25},{Total:75},{Total:60}]},expected:160},
  {name:'Workflow variables',category:'Power Automate · WDL',platform:'flow',formula:"@concat('Hello ', variables('customerName'), '!')",inputs:{'variables:customerName':'Alex'},expected:'Hello Alex!'},
  {name:'Trigger body',category:'Power Automate · WDL',platform:'flow',formula:"@if(greater(triggerBody()?['Amount'], 1000), 'Review', 'Approved')",inputs:{triggerbody:{Amount:1250}},expected:'Review'},
  {name:'Action output',category:'Power Automate · WDL',platform:'flow',formula:"@outputs('Compose')?['body']?['Total']",inputs:{'outputs:Compose':{body:{Total:450}}},expected:450}
];
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
  $('result-json').hidden=next!=='json';$('result-table').hidden=next!=='table';
  if(next==='table')$('result-table').classList.toggle('table-empty',!$('result-table').querySelector('table'));
}
function preserveInputs(){
  for(const wrap of $('input-fields').querySelectorAll('[data-name]')){
    try{inputs[wrap.dataset.name]=parseVal(wrap.querySelector('textarea').value);}catch{}
  }
}
function addInputField(name,kind='variable'){
  const wrapper=document.createElement('div');wrapper.className='input-item';wrapper.dataset.name=name;
  const label=document.createElement('label');const key=document.createElement('span');key.textContent=name;
  const type=document.createElement('em');type.textContent=kind;label.append(key,type);
  const textarea=document.createElement('textarea');textarea.spellcheck=false;textarea.setAttribute('aria-label',`JSON input value for ${name}`);
  textarea.value=formatJSON(inputs[name]!==undefined?inputs[name]:kind.includes('body')||name==='triggerbody'?{}:kind==='variable'&&/orders|items|records|table/i.test(name)?[]:null);
  textarea.addEventListener('input',()=>{try{inputs[name]=parseVal(textarea.value);textarea.classList.remove('input-invalid');}catch{textarea.classList.add('input-invalid');}});
  wrapper.append(label,textarea);$('input-fields').append(wrapper);
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
  lastResult=null;status($('execution-status'),'Error','fail');$('error-detail').hidden=false;
  $('error-detail').textContent=String(message)+(position!=null?` (position ${position})`:'');
  $('result-json').textContent='// Evaluation failed';$('result-type').textContent='Error';$('result-time').textContent='—';$('assertion').textContent='—';
  $('result-table').replaceChildren();workspaceStatus('Evaluation error',true);selectResultView('json');
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
    $('error-detail').hidden=true;renderTable(result.value);selectResultView(resultView);workspaceStatus(passed===false?'Assertion failed':'Run complete',passed===false);
    history.unshift({formula:payload.formula,platform:payload.platform,inputs:payload.inputs,expected:payload.expected,time:new Date().toISOString(),passed:passed??true});
    history=history.slice(0,15);saveHistory();renderHistory();
  }catch(error){showError(error.message);}
}
function renderHistory(){
  const parent=$('history-items');parent.replaceChildren();
  if(!history.length){const p=document.createElement('p');p.className='empty-hint';p.textContent='No runs yet. Your recent formulas are saved here in this browser.';parent.append(p);return;}
  for(const item of history){const div=document.createElement('div');div.className='history-item';
    const button=document.createElement('button');button.type='button';button.textContent=item.formula;button.title='Load this execution';
    button.addEventListener('click',async()=>{selectedExample=-1;inputs={...item.inputs};$('formula').value=item.formula;$('platform').value=item.platform;$('expected').value=item.expected===undefined?'':formatJSON(item.expected);setPlatform();updateEditor();renderExamples();await analyze(true);});
    const info=document.createElement('span');info.textContent=`${item.passed?'✓':'✕'} · ${new Date(item.time).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}`;
    div.append(button,info);parent.append(div);
  }
}
function renderExamples(){
  const parent=$('examples');parent.replaceChildren();const filter=$('example-search').value.trim().toLowerCase();
  const filtered=examples.map((sample,index)=>({...sample,index})).filter(e=>!filter||`${e.name} ${e.category} ${e.formula}`.toLowerCase().includes(filter));
  $('example-count').textContent=String(filtered.length);
  if(!filtered.length){const el=document.createElement('p');el.className='empty-search';el.textContent='No matching scenarios.';parent.append(el);return;}
  for(const platform of ['canvas','flow']){
    const items=filtered.filter(s=>s.platform===platform);if(!items.length)continue;
    const group=document.createElement('div');group.className='example-group';group.dataset.platform=platform;
    const heading=document.createElement('div');heading.className='example-group-title';heading.textContent=platform==='canvas'?'Power Apps · Canvas':'Power Automate · Cloud';group.append(heading);
    for(const example of items){const button=document.createElement('button');button.type='button';button.className='example-button'+(selectedExample===example.index?' active':'');button.setAttribute('aria-current',selectedExample===example.index?'true':'false');
      const icon=document.createElement('span');icon.className='example-icon';icon.textContent=example.platform==='canvas'?'ƒx':'{ }';
      const title=document.createElement('span');title.className='example-title';title.textContent=example.name;
      button.append(icon,title);button.addEventListener('click',()=>loadExample(example));group.append(button);
    }
    parent.append(group);
  }
}
function setPlatform(){
  const canvas=$('platform').value==='canvas';
  $('editor-description').textContent=canvas?'Power Fx · Canvas expression':'WDL · Cloud flow expression';
  $('editor-syntax').textContent=canvas?'Power Fx':'Workflow Definition Language';
  $('editor-platform-hint').textContent=canvas?'Canvas formula':'Cloud flow expression';
  $('locale').disabled=!canvas;
  for(const b of document.querySelectorAll('[data-platform]')){const active=b.dataset.platform===$('platform').value;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));}
  status($('formula-status'),'Not validated');
  updateEditor();
}
async function loadExample(example){
  selectedExample=example.index??examples.indexOf(example);inputs={...example.inputs};$('platform').value=example.platform;$('formula').value=example.formula;
  $('expected').value=example.expected===undefined?'':formatJSON(example.expected);setPlatform();renderExamples();await analyze(true);
  $('result-json').textContent='// Run an expression to inspect the return value.';
  $('result-type').textContent='—';$('result-time').textContent='—';$('assertion').textContent='—';status($('execution-status'),'Ready');
  $('error-detail').hidden=true;$('result-table').replaceChildren();selectResultView('json');activateTab('inputs');workspaceStatus('Scenario loaded');
}
async function init(){
  $('example-search').addEventListener('input',renderExamples);
  $('example-search').addEventListener('keydown',e=>{if(e.key==='Escape'){$('example-search').value='';renderExamples();}});
  document.querySelectorAll('[data-platform]').forEach(b=>b.addEventListener('click',async()=>{
    if($('platform').value===b.dataset.platform)return;
    preserveInputs();selectedExample=-1;$('platform').value=b.dataset.platform;setPlatform();renderExamples();await analyze(true);
  }));
  $('platform').addEventListener('change',async()=>{setPlatform();await analyze(true);});
  $('formula').addEventListener('input',()=>{
    selectedExample=-1;updateEditor();renderExamples();status($('formula-status'),'Edited');workspaceStatus('Unsaved changes');
    clearTimeout(analyzeTimer);analyzeTimer=setTimeout(()=>analyze(true),600);
  });
  $('formula').addEventListener('scroll',syncCodeScroll);
  $('formula').addEventListener('keydown',event=>{
    if(event.key==='Tab'){event.preventDefault();const el=$('formula'),start=el.selectionStart;el.setRangeText('  ',start,el.selectionEnd,'end');el.dispatchEvent(new Event('input',{bubbles:true}));}
  });
  document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>activateTab(b.dataset.tab)));
  document.querySelectorAll('[data-result-view]').forEach(b=>b.addEventListener('click',()=>selectResultView(b.dataset.resultView)));
  $('analyze-button').onclick=async()=>{const valid=await analyze();if(valid)activateTab('inputs');};
  $('run-button').onclick=run;
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
      selectedExample=-1;inputs={...scenario.inputs};$('platform').value=scenario.platform;$('locale').value=scenario.locale==='es-ES'?'es-ES':'en-US';$('formula').value=scenario.formula;
      $('expected').value=scenario.expected===undefined?'':formatJSON(scenario.expected);setPlatform();renderExamples();await analyze();activateTab('inputs');workspaceStatus('Scenario imported');
    }catch(error){showError('Import failed: '+error.message);}finally{event.target.value='';}
  });
  window.addEventListener('keydown',event=>{
    if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();run();}
    if(event.key==='/'&&!event.ctrlKey&&!event.altKey&&!event.metaKey&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){event.preventDefault();$('example-search').focus();}
  });
  renderHistory();renderExamples();await loadExample(examples[0]);
  if(staticMode){$('backend-pill').innerHTML='<span class="status-dot"></span>Browser sandbox';$('engine-label').textContent='Browser compatibility subset';}
  else try{const res=await fetch('/api/status');if(!res.ok)throw new Error('No backend');const config=await res.json();
    $('backend-pill').innerHTML='<span class="status-dot"></span>'+(config.nativeCanvas?'Official Power Fx connected':'Local sandbox');
    $('engine-label').textContent=config.nativeCanvas?'Microsoft Power Fx SDK + local WDL':'Local compatibility subsets';
  }catch{$('backend-pill').textContent='● Server unavailable';}
}
init();
