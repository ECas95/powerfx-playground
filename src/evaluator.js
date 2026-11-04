import { parse, analyze, ExpressionError } from './parser.js';

const BLOCKED = new Set(['__proto__','prototype','constructor']);
const MAX_DEPTH=64, MAX_ROWS=10000;
function safeProp(value,key){
  if(value == null)return null;
  const name=String(key);
  if(BLOCKED.has(name))throw new ExpressionError('Propiedad no permitida');
  if(typeof value!=='object'&&typeof value!=='string')return null;
  if(Array.isArray(value)||typeof value==='string')return value[name]??null;
  const actual=Object.keys(value).find(k=>k.toLowerCase()===name.toLowerCase());
  return actual?value[actual]:null;
}
function getInput(inputs,key){
  const actual=Object.keys(inputs).find(k=>k.toLowerCase()===key.toLowerCase());
  return actual===undefined?undefined:inputs[actual];
}
function truthy(x){return Boolean(x);}
function cmp(a,b){return typeof a==='string'&&typeof b==='string'?a.localeCompare(b,undefined,{sensitivity:'accent'}):a<b?-1:a>b?1:0;}
// JSON record equality must not depend on insertion/key order; arrays remain ordered.
function jsonEqual(a,b,depth=0){
  if(a===b)return true;
  if(depth>MAX_DEPTH||a===null||b===null||typeof a!==typeof b)return false;
  if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((x,i)=>jsonEqual(x,b[i],depth+1));
  if(typeof a==='object'){
    const ak=Object.keys(a),bk=Object.keys(b);
    return ak.length===bk.length&&ak.every(k=>Object.hasOwn(b,k)&&jsonEqual(a[k],b[k],depth+1));
  }
  return false;
}
function number(x){const n=Number(x);if(!Number.isFinite(n))throw new ExpressionError(`Valor numérico inválido: ${String(x)}`);return n;}
function ensureArray(x){if(!Array.isArray(x))throw new ExpressionError('Esta función necesita una tabla o array JSON');if(x.length>MAX_ROWS)throw new ExpressionError('La tabla supera las 10 000 filas');return x;}
function typeOf(value){if(value===null||value===undefined)return 'Blank / null';if(Array.isArray(value))return 'Table / array';if(typeof value==='object')return 'Record / object';return {string:'Text',number:'Number',boolean:'Boolean'}[typeof value]||typeof value;}
function looksIdent(n,name){return n?.type==='identifier'&&n.name.toLowerCase()===name;}

const ENUMS=Object.freeze({
  matchoptions:{complete:'complete',contains:'contains',beginswith:'beginswith',endswith:'endswith',ignorecase:'ignorecase',multiline:'multiline',dotall:'dotall',numberedsubmatches:'numberedsubmatches'},
  traceseverity:{information:'Information',warning:'Warning',error:'Error',critical:'Critical'},
  traceoptions:{none:'None',ignoreunsupportedtypes:'IgnoreUnsupportedTypes'},
  sortorder:{ascending:'Ascending',descending:'Descending'},
  match:{digit:'\\d',multipledigits:'\\d+',letter:'[A-Za-z]',multipleletters:'[A-Za-z]+',any:'.',email:'[A-Za-z0-9._%+\\-]+@[A-Za-z0-9.\\-]+\\.[A-Za-z]{2,}',period:'\\.',optionalDigits:'\\d*',commA:',',hyphen:'-',space:' ',tab:'\\t'}
});
const MAX_REGEX_PATTERN=250,MAX_REGEX_TEXT=2048,MAX_MATCHES=250;
function regexPattern(pattern){
  if(typeof pattern!=='string'||pattern.length>MAX_REGEX_PATTERN)throw new ExpressionError('Patrón regex inválido o de más de 250 caracteres');
  // This browser sandbox runs regex synchronously: reject known high-risk constructs.
  if(/\\[1-9]|\(\?<([=!])|\(\?\(/.test(pattern))throw new ExpressionError('Regex con backreferences/lookbehind/condicionales no soportada');
  if(/\([^()]*[+*][^()]*\)[+*{]/.test(pattern)||/\((?:\?:)?[^)]*(?:\.\*|\.\+|\[[^\]]+\][*+]|\\[dws][*+])[^)]*\)[*+{]/.test(pattern)){
    throw new ExpressionError('Regex con cuantificadores anidados potencialmente costosos no soportada');
  }
  return pattern;
}
function regexFlags(options){
  const list=String(options??'').toLowerCase();
  const matchMode=['complete','beginswith','endswith','contains'].find(o=>list.includes(o))||null;
  return {mode:matchMode,flags:`u${list.includes('ignorecase')?'i':''}${list.includes('multiline')?'m':''}${list.includes('dotall')?'s':''}`,numbered:list.includes('numberedsubmatches')};
}
function makeMatcher(kind,text,pattern,options){
  if(typeof text!=='string'||text.length>MAX_REGEX_TEXT)throw new ExpressionError('Entrada regex demasiado larga (máximo 2048 caracteres)');
  const opts=regexFlags(options);const mode=opts.mode||(kind==='ismatch'?'complete':'contains');
  const p=regexPattern(pattern);
  const source=(mode==='complete'||mode==='beginswith'?'^(?:':'(?:')+p+(mode==='complete'||mode==='endswith'?(mode==='complete'?')$':')$'):')');
  let re;
  try{re=new RegExp(source,opts.flags+(kind==='matchall'?'g':''));}
  catch(e){throw new ExpressionError('Regex inválida: '+e.message);}
  const toRecord=m=>{
    const rec={FullMatch:m[0],StartMatch:m.index+1};
    if(opts.numbered)rec.SubMatches=m.slice(1).map(value=>({Value:value??''}));
    else for(const [name,value] of Object.entries(m.groups??{})){
      if(BLOCKED.has(name))throw new ExpressionError('Nombre de grupo regex no permitido');
      rec[name]=value??'';
    }
    return rec;
  };
  if(kind==='ismatch')return re.test(text);
  if(kind==='match'){const match=re.exec(text);return match?toRecord(match):null;}
  const out=[];for(const m of text.matchAll(re)){
    out.push(toRecord(m));if(out.length>=MAX_MATCHES)throw new ExpressionError('Demasiados resultados regex (máximo 250)');
  }
  return out;
}
// Column names in modern Canvas Power Fx are identifiers; older apps used quoted strings.
// Interpret these as schema names, never as external variable references or JS keys.
function columnName(node,label='Column'){
  const name=node?.type==='identifier'?node.name:node?.type==='literal'&&typeof node.value==='string'?node.value:null;
  if(!name||BLOCKED.has(name)||name.length>128)throw new ExpressionError(`${label}: use an unquoted column identifier or quoted column name`);
  return name;
}
function rowColumn(row,name,required=true){
  if(!row||typeof row!=='object'||Array.isArray(row))throw new ExpressionError('Se esperaba un registro JSON en la tabla');
  const found=Object.keys(row).find(k=>k.toLowerCase()===name.toLowerCase());
  if(found===undefined&&required)throw new ExpressionError(`La columna «${name}» no existe`);
  return found;
}
function validateColumnNames(names){
  if(new Set(names.map(n=>n.toLowerCase())).size!==names.length)throw new ExpressionError('Los nombres de columnas deben ser únicos');
}
function scopedRow(scope,row,alias){
  if(!row||typeof row!=='object'||Array.isArray(row))throw new ExpressionError('Se esperaba un registro JSON en la tabla');
  const result={...scope,...row,ThisRecord:row};
  if(alias)result[alias]=row;
  return result;
}

function evaluateNode(n,inputs,mode,scope={},depth=0,trace=[],meta={}){
  if(depth>MAX_DEPTH)throw new ExpressionError('Máxima profundidad de evaluación excedida');
  const go=(expr,extra=scope)=>evaluateNode(expr,inputs,mode,extra,depth+1,trace,meta);
  switch(n.type){
    case 'literal':return n.value;
    case 'sequence':{let value=null;for(const node of n.items)value=go(node);return value;}
    case 'alias':return go(n.base);
    case 'array':return n.items.map(x=>go(x));
    case 'record':return Object.fromEntries(n.fields.map(f=>{if(BLOCKED.has(f.key))throw new ExpressionError('Campo no permitido');return [f.key,go(f.value)];}));
    case 'identifier':{
      const s=getInput(scope,n.name);if(s!==undefined)return s;
      const i=getInput(inputs,n.name);if(i!==undefined)return i;
      if(n.name.toLowerCase()==='thisrecord')return scope.ThisRecord??scope;
      throw new ExpressionError(`Falta el input «${n.name}»`);
    }
    case 'member':{
      if(mode==='canvas'&&n.base.type==='identifier'){
        const enumName=n.base.name.toLowerCase();
        if(Object.hasOwn(ENUMS,enumName)){
          const key=String(n.key.value).toLowerCase();
          const value=Object.entries(ENUMS[enumName]).find(([k])=>k.toLowerCase()===key)?.[1];
          if(value===undefined)throw new ExpressionError(`Enum ${n.base.name}.${n.key.value} no implementada`);
          return value;
        }
      }
      const base=go(n.base);if(base==null){if(n.optional)return null;throw new ExpressionError('Intentas acceder a una propiedad de un valor vacío');}
      return safeProp(base,go(n.key));
    }
    case 'unary':{
      const v=go(n.right);return n.op==='not'||n.op==='!'?!truthy(v):n.op==='-'?-number(v):number(v);
    }
    case 'binary':{
      const op=n.op;
      if(op==='and'||op==='&&')return truthy(go(n.left))&&truthy(go(n.right));
      if(op==='or'||op==='||')return truthy(go(n.left))||truthy(go(n.right));
      const a=go(n.left),b=go(n.right);
      switch(op){
        case '+':return number(a)+number(b);case '-':return number(a)-number(b);
        case '*':return number(a)*number(b);case '/':if(number(b)===0)throw new ExpressionError('División por cero');return number(a)/number(b);
        case '%':return number(a)%number(b);case '^':return number(a)**number(b);case '&':return String(a??'')+String(b??'');
        case '=':case '==':return jsonEqual(a,b)||typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
        case '<>':case '!=':return !(jsonEqual(a,b)||typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase());
        case '<':return cmp(a,b)<0;case '>':return cmp(a,b)>0;case '<=':return cmp(a,b)<=0;case '>=':return cmp(a,b)>=0;
        case 'in':return typeof b==='string'?b.toLowerCase().includes(String(a).toLowerCase()):Array.isArray(b)&&b.includes(a);
        case 'exactin':return typeof b==='string'?b.includes(String(a)):Array.isArray(b)&&b.includes(a);
      }
      throw new ExpressionError('Operador no implementado: '+op);
    }
    case 'call':{
      if(n.callee.type!=='identifier')throw new ExpressionError('Solo se admiten llamadas a funciones nombradas');
      const fn=n.callee.name.toLowerCase(),args=n.args;
      const arg=(i)=>args[i]===undefined?null:go(args[i]);
      const all=()=>args.map(a=>go(a));
      const required=(count)=>{if(args.length<count)throw new ExpressionError(`${n.callee.name} necesita ${count} argumentos`);};
      if(mode==='canvas'){
        if(fn==='with'){
          required(2);if(args.length!==2)throw new ExpressionError('With necesita exactamente dos argumentos');
          const record=arg(0);
          if(!record||typeof record!=='object'||Array.isArray(record))throw new ExpressionError('With requiere un registro JSON');
          const extra={...scope,...record,ThisRecord:record};
          if(args[0]?.type==='alias')extra[args[0].alias]=record;
          return go(args[1],extra);
        }
        if(fn==='trace'){
          required(1);if(args.length>4)throw new ExpressionError('Trace admite hasta cuatro argumentos');
          const msg=arg(0),severity=args[1]?String(arg(1)):'Information';
          if(!['Information','Warning','Error','Critical'].includes(severity))throw new ExpressionError('TraceSeverity inválido');
          const payload=args[2]?arg(2):{};
          if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new ExpressionError('Trace requiere CustomRecord tipo registro');
          trace.push({message:String(msg??''),severity,customRecord:payload});
          meta.behaviorEmulated=true;
          return null; // Trace event, NOT a connector or actual Application Insights write.
        }
        if(['ismatch','match','matchall'].includes(fn)){
          required(2);if(args.length>3)throw new ExpressionError('Función regex admite hasta 3 argumentos');
          // Power Fx regex patterns and MatchOptions must be author-time constants.
          const constantPattern=node=>node?.type==='literal'||node?.type==='member'&&node.base.type==='identifier'&&node.base.name.toLowerCase()==='match'||node?.type==='binary'&&node.op==='&'&&constantPattern(node.left)&&constantPattern(node.right);
          const constantOptions=node=>node?.type==='literal'||node?.type==='member'&&node.base.type==='identifier'&&node.base.name.toLowerCase()==='matchoptions'||node?.type==='binary'&&node.op==='&'&&constantOptions(node.left)&&constantOptions(node.right);
          if(!constantPattern(args[1])||(args[2]&&!constantOptions(args[2])))throw new ExpressionError('Regex y MatchOptions deben ser constantes en Power Fx');
          return makeMatcher(fn,String(arg(0)??''),String(arg(1)),args[2]?arg(2):null);
        }
        if(fn==='startswith')return String(arg(0)??'').toLowerCase().startsWith(String(arg(1)??'').toLowerCase());
        if(fn==='endswith')return String(arg(0)??'').toLowerCase().endsWith(String(arg(1)??'').toLowerCase());
        if(fn==='isempty')return ensureArray(arg(0)).length===0;
        if(fn==='index'){required(2);return ensureArray(arg(0))[number(arg(1))-1]??null;}
        if(fn==='sequence'){
          required(1);const count=number(arg(0)),start=args[1]?number(arg(1)):1,step=args[2]?number(arg(2)):1;
          if(!Number.isInteger(count)||count<0||count>1000)throw new ExpressionError('Sequence necesita un tamaño entero entre 0 y 1000');
          return Array.from({length:count},(_,i)=>({Value:start+i*step}));
        }
        if(fn==='if'){required(2);for(let i=0;i+1<args.length;i+=2)if(truthy(arg(i)))return arg(i+1);return args.length%2===1?arg(args.length-1):null;}
        if(fn==='iferror'){required(2);try{return arg(0);}catch{return arg(1);}}
        if(fn==='switch'){required(3);const val=arg(0);for(let i=1;i+1<args.length;i+=2)if(val===arg(i))return arg(i+1);return args.length%2===0?arg(args.length-1):null;}
        if(fn==='blank')return null;
        if(fn==='isblank')return arg(0)==null||arg(0)==='';
        if(fn==='isblankorerror'){try{return arg(0)==null||arg(0)==='';}catch{return true;}}
        if(fn==='coalesce'){for(let i=0;i<args.length;i++){const v=arg(i);if(v!==null&&v!==undefined&&v!=='')return v;}return null;}
        if(['filter','lookup','countif','forall'].includes(fn)){
          required(2);
          const source=args[0],alias=source?.type==='alias'?source.alias:null;
          const rows=ensureArray(go(source?.type==='alias'?source.base:source));
          if(fn==='forall')return rows.map(row=>go(args[1],scopedRow(scope,row,alias)));
          const predicateArgs=fn==='lookup'?[args[1]]:args.slice(1);
          const matches=rows.filter(row=>predicateArgs.every(a=>truthy(go(a,scopedRow(scope,row,alias)))));
          if(fn==='filter')return matches;
          if(fn==='countif')return matches.length;
          return matches.length?(args[2]?go(args[2],scopedRow(scope,matches[0],alias)):matches[0]):null;
        }
        if(fn==='groupby'){
          required(3);
          const rows=ensureArray(arg(0)),names=args.slice(1,-1).map(n=>columnName(n));
          const groupColumn=columnName(args.at(-1),'GroupColumnName');
          validateColumnNames([...names,groupColumn]);
          const groups=new Map(),out=[];
          for(const row of rows){
            if(rowColumn(row,groupColumn,false)!==undefined)throw new ExpressionError(`La columna agrupada «${groupColumn}» ya existe`);
            const keys=names.map(name=>rowColumn(row,name));
            const values=keys.map(key=>row[key]);
            const serialized=JSON.stringify(values);
            let group=groups.get(serialized);
            if(!group){group=Object.fromEntries(names.map((name,i)=>[name,values[i]]));group[groupColumn]=[];groups.set(serialized,group);out.push(group);}
            const remaining=Object.fromEntries(Object.entries(row).filter(([key])=>!names.some(name=>name.toLowerCase()===key.toLowerCase())));
            group[groupColumn].push(remaining);
          }
          return out;
        }
        if(fn==='ungroup'){
          required(2);if(args.length!==2)throw new ExpressionError('Ungroup requiere exactamente dos argumentos');
          const rows=ensureArray(arg(0)),name=columnName(args[1]),out=[];
          for(const row of rows){
            const key=rowColumn(row,name);
            const nested=ensureArray(row[key]);
            const common=Object.fromEntries(Object.entries(row).filter(([k])=>k!==key));
            if(out.length+nested.length>MAX_ROWS)throw new ExpressionError('Ungroup supera las 10 000 filas permitidas');
            for(const record of nested){
              if(!record||typeof record!=='object'||Array.isArray(record))throw new ExpressionError('Ungroup requiere registros JSON anidados');
              out.push({...common,...record});
            }
          }
          return out;
        }
        if(fn==='renamecolumns'){
          required(3);if(args.length%2===0)throw new ExpressionError('RenameColumns necesita pares de columnas');
          const rows=ensureArray(arg(0)),pairs=[];
          for(let i=1;i<args.length;i+=2)pairs.push([columnName(args[i]),columnName(args[i+1])]);
          validateColumnNames(pairs.map(p=>p[0]));validateColumnNames(pairs.map(p=>p[1]));
          return rows.map(row=>{
            const sourceKeys=pairs.map(([old])=>rowColumn(row,old));
            for(const [,next] of pairs)if(Object.keys(row).some(k=>k.toLowerCase()===next.toLowerCase())&&!sourceKeys.some(k=>k.toLowerCase()===next.toLowerCase()))throw new ExpressionError(`La columna destino «${next}» ya existe`);
            const mapped=new Map(sourceKeys.map((old,i)=>[old,pairs[i][1]]));
            const out={};for(const [key,value] of Object.entries(row)){
              const name=mapped.get(key)??key;
              if(Object.keys(out).some(k=>k.toLowerCase()===name.toLowerCase()))throw new ExpressionError(`Nombre duplicado «${name}»`);
              out[name]=value;
            }return out;
          });
        }
        if(fn==='sortbycolumns'){
          required(2);const rows=ensureArray(arg(0)),rules=[];
          for(let i=1;i<args.length;){
            const name=columnName(args[i++]);let direction=1,order=null;
            if(i<args.length){
              const ast=args[i];
              const isEnum=ast.type==='member'&&ast.base?.type==='identifier'&&ast.base.name.toLowerCase()==='sortorder';
              if(isEnum){direction=String(arg(i)).toLowerCase()==='descending'?-1:1;i++;}
              else if(ast.type==='array'){order=ensureArray(arg(i)).map(x=>x&&typeof x==='object'&&'Value'in x?x.Value:x);i++;}
              else if(ast.type==='literal'&&typeof ast.value==='string'&&/^(ascending|descending)$/i.test(ast.value)){direction=ast.value.toLowerCase()==='descending'?-1:1;i++;}
              else if(i<args.length-1)throw new ExpressionError('Especifica SortOrder para cada columna salvo la última');
            }
            rules.push({name,direction,order});
            if(order&&i<args.length)throw new ExpressionError('El orden personalizado solo admite una columna');
          }
          validateColumnNames(rules.map(r=>r.name));
          // Cache sort keys once per row (rather than per comparator invocation).
          // Sorting remains stable even on runtimes without guaranteed stable Array.sort.
          const ranks=rules.map(r=>r.order?new Map(r.order.map((v,i)=>[JSON.stringify(v),i])):null);
          const keyed=rows.map((row,index)=>({row,index,keys:rules.map(rule=>row[rowColumn(row,rule.name)])}));
          return keyed.sort((a,b)=>{
            for(let i=0;i<rules.length;i++){
              const rule=rules[i],va=a.keys[i],vb=b.keys[i];let result;
              if(ranks[i])result=(ranks[i].get(JSON.stringify(va))??ranks[i].size)-(ranks[i].get(JSON.stringify(vb))??ranks[i].size);
              else result=cmp(va,vb)*rule.direction;
              if(result!==0)return result;
            }
            return a.index-b.index;
          }).map(x=>x.row);
        }
        if(fn==='addcolumns'){
          required(3);if(args.length%2===0)throw new ExpressionError('AddColumns requiere pares de nombre y fórmula');
          const source=args[0],alias=source?.type==='alias'?source.alias:null;
          return ensureArray(go(alias?source.base:source)).map(row=>{
            const extra={...row};
            for(let i=1;i<args.length;i+=2){
              const field=columnName(args[i]);
              extra[field]=go(args[i+1],scopedRow(scope,extra,alias));
            }
            return extra;
          });
        }
        if(fn==='distinct'){
          required(2);const source=args[0],alias=source?.type==='alias'?source.alias:null;
          const rows=ensureArray(go(alias?source.base:source));const seen=new Set(),out=[];
          for(const row of rows){const val=go(args[1],scopedRow(scope,row,alias));const key=JSON.stringify(val);
            if(!seen.has(key)){seen.add(key);out.push({Value:val});}}
          return out;
        }
        if(fn==='showcolumns'||fn==='dropcolumns'){
          required(2);const columns=args.slice(1).map(column=>columnName(column));
          return ensureArray(arg(0)).map(row=>Object.fromEntries(Object.entries(row).filter(([k])=>fn==='showcolumns'?columns.includes(k):!columns.includes(k))));
        }
        if(fn==='search'){
          required(3);const needle=String(arg(1)).toLowerCase();const columns=args.slice(2).map(column=>columnName(column));
          return ensureArray(arg(0)).filter(row=>columns.some(k=>String(safeProp(row,k)??'').toLowerCase().includes(needle)));
        }
        if(['sum','average','min','max'].includes(fn)&&args.length>1&&Array.isArray(arg(0))){
          const source=args[0],alias=source?.type==='alias'?source.alias:null;
          const values=ensureArray(go(alias?source.base:source)).map(row=>number(go(args[1],scopedRow(scope,row,alias))));
          if(fn==='sum')return values.reduce((a,b)=>a+b,0);
          if(fn==='average')return values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
          if(fn==='min')return values.length?Math.min(...values):null;
          return values.length?Math.max(...values):null;
        }
        if(fn==='table')return all();
        if(fn==='countrows')return ensureArray(arg(0)).length;
        if(fn==='first')return ensureArray(arg(0))[0]??null;
        if(fn==='last'){const t=ensureArray(arg(0));return t[t.length-1]??null;}
        if(fn==='firstn')return ensureArray(arg(0)).slice(0,number(arg(1)));
        if(fn==='lastn')return ensureArray(arg(0)).slice(-number(arg(1)));
        if(fn==='sort'){required(2);const source=args[0],alias=source?.type==='alias'?source.alias:null;const rows=ensureArray(go(alias?source.base:source));const descending=String(arg(2)??'ascending').toLowerCase().includes('descend');return [...rows].sort((a,b)=>cmp(go(args[1],scopedRow(scope,a,alias)),go(args[1],scopedRow(scope,b,alias)))*(descending?-1:1));}
      } else if(mode==='flow') {
        if(['variables','parameters','outputs','body','items','actions'].includes(fn)){
          required(1);const key=`${fn}:${arg(0)}`;const val=getInput(inputs,key);
          if(val===undefined)throw new ExpressionError(`Falta el input «${key}»`);
          return val;
        }
        if(['triggerbody','triggeroutputs','item'].includes(fn)){
          const val=getInput(inputs,fn);if(val===undefined)throw new ExpressionError(`Falta el input «${fn}»`);return val;
        }
        if(fn==='if'){required(3);return truthy(arg(0))?arg(1):arg(2);}
        if(fn==='and'){for(let i=0;i<args.length;i++)if(!truthy(arg(i)))return false;return true;}
        if(fn==='or'){for(let i=0;i<args.length;i++)if(truthy(arg(i)))return true;return false;}
        if(fn==='not')return !truthy(arg(0));
        if(fn==='coalesce'){for(let i=0;i<args.length;i++){const v=arg(i);if(v!=null)return v;}return null;}
        if(fn==='empty'){const v=arg(0);return v==null||v===''||Array.isArray(v)&&v.length===0||typeof v==='object'&&Object.keys(v).length===0;}
        if(fn==='equals')return arg(0)===arg(1);
        if(fn==='greater')return cmp(arg(0),arg(1))>0;
        if(fn==='greaterorequals')return cmp(arg(0),arg(1))>=0;
        if(fn==='less')return cmp(arg(0),arg(1))<0;
        if(fn==='lessorequals')return cmp(arg(0),arg(1))<=0;
        if(fn==='add')return number(arg(0))+number(arg(1));
        if(fn==='sub')return number(arg(0))-number(arg(1));
        if(fn==='mul')return number(arg(0))*number(arg(1));
        if(fn==='div'){if(number(arg(1))===0)throw new ExpressionError('División por cero');return number(arg(0))/number(arg(1));}
        if(fn==='mod')return number(arg(0))%number(arg(1));
        if(fn==='pow')return number(arg(0))**number(arg(1));
        if(fn==='int')return Math.trunc(number(arg(0)));
        if(fn==='float')return number(arg(0));
        if(fn==='bool')return arg(0)===true||String(arg(0)).toLowerCase()==='true';
        if(fn==='string')return typeof arg(0)==='object'?JSON.stringify(arg(0)):String(arg(0));
        if(fn==='json')return JSON.parse(String(arg(0)));
        if(fn==='createarray')return all();
        if(fn==='first')return arg(0)?.[0]??null;
        if(fn==='last'){const a=arg(0);return a?.[a.length-1]??null;}
        if(fn==='contains')return typeof arg(0)==='string'?arg(0).includes(String(arg(1))):Array.isArray(arg(0))?arg(0).includes(arg(1)):Object.hasOwn(arg(0)??{},String(arg(1)));
      }
      const v=all();
      switch(fn){
        case 'concat':return v.map(x=>String(x??'')).join('');
        case 'concatenate':return v.map(x=>String(x??'')).join('');
        case 'lower':case 'tolower':return String(v[0]??'').toLowerCase();
        case 'upper':case 'toupper':return String(v[0]??'').toUpperCase();
        case 'trim':case 'trimends':return String(v[0]??'').trim();
        case 'len':case 'length':return (v[0]??'').length;
        case 'left':return String(v[0]??'').slice(0,number(v[1]));
        case 'right':return String(v[0]??'').slice(-number(v[1]));
        case 'mid':return String(v[0]??'').slice(number(v[1])-1,number(v[1])-1+number(v[2]));
        case 'substring':return String(v[0]??'').slice(number(v[1]),v[2]===undefined?undefined:number(v[1])+number(v[2]));
        case 'replace':return String(v[0]??'').split(String(v[1])).join(String(v[2]));
        case 'substitute':return String(v[0]??'').split(String(v[1])).join(String(v[2]));
        case 'split':return String(v[0]??'').split(String(v[1]));
        case 'join':return ensureArray(v[0]).join(String(v[1]??','));
        case 'round':{const p=10**number(v[1]??0);return Math.round(number(v[0])*p)/p;}
        case 'rounddown':{const p=10**number(v[1]??0);return Math.trunc(number(v[0])*p)/p;}
        case 'abs':return Math.abs(number(v[0]));
        case 'min':return Math.min(...v.map(number));
        case 'max':return Math.max(...v.map(number));
        case 'sum':return v.reduce((a,b)=>a+number(b),0);
        case 'average':return v.reduce((a,b)=>a+number(b),0)/v.length;
        case 'value':return number(v[0]);
        case 'text':return String(v[0]??'');
        case 'isnumeric':return v[0]!==''&&Number.isFinite(Number(v[0]));
        case 'iserror':return false;
      }
      throw new ExpressionError(`Función «${n.callee.name}» no soportada en el evaluador ${mode==='canvas'?'local de Canvas':'WDL'}.`);
    }
    default:throw new ExpressionError('Nodo desconocido');
  }
}
export function evaluate({formula,platform='canvas',inputs={},expected,engine='local'}){
  const mode=platform==='flow'?'flow':'canvas';
  const started=performance.now();
  if(!inputs||typeof inputs!=='object'||Array.isArray(inputs))throw new ExpressionError('Los inputs deben ser un objeto JSON');
  const ast=parse(formula,mode);
  const missing=analyze(ast,mode).filter(i=>getInput(inputs,i.key)===undefined);
  if(missing.length)throw new ExpressionError('Inputs requeridos: '+missing.map(x=>x.key).join(', '));
  const traces=[],meta={};
  const result=evaluateNode(ast,inputs,mode,{},0,traces,meta);
  if(typeof result==='number'&&!Number.isFinite(result))throw new ExpressionError('Resultado numérico inválido');
  const output={success:true,platform,engine, value:result??null,valueType:typeOf(result),elapsedMs:Math.round((performance.now()-started)*100)/100};
  if(traces.length){output.traces=traces;output.warnings=['Trace is simulated locally. No Power Apps Live Monitor or Application Insights telemetry is sent. Trace requires a behavior formula in real Canvas apps.'];}
  if(expected!==undefined)output.assertion={passed:jsonEqual(result,expected),expected};
  return output;
}
export function inspect({formula,platform='canvas'}){
  const ast=parse(formula,platform==='flow'?'flow':'canvas');
  return {valid:true,inputs:analyze(ast,platform==='flow'?'flow':'canvas')};
}
export function safeError(error){return {success:false,error:{message:error?.message||'Error desconocido',position:error?.position??null,code:error instanceof ExpressionError?'EXPRESSION_ERROR':'RUNTIME_ERROR'}};}
