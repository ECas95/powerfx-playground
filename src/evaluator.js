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
function number(x){const n=Number(x);if(!Number.isFinite(n))throw new ExpressionError(`Valor numérico inválido: ${String(x)}`);return n;}
function ensureArray(x){if(!Array.isArray(x))throw new ExpressionError('Esta función necesita una tabla o array JSON');if(x.length>MAX_ROWS)throw new ExpressionError('La tabla supera las 10 000 filas');return x;}
function typeOf(value){if(value===null||value===undefined)return 'Blank / null';if(Array.isArray(value))return 'Table / array';if(typeof value==='object')return 'Record / object';return {string:'Text',number:'Number',boolean:'Boolean'}[typeof value]||typeof value;}
function looksIdent(n,name){return n?.type==='identifier'&&n.name.toLowerCase()===name;}
function evaluateNode(n,inputs,mode,scope={},depth=0,trace=[]){
  if(depth>MAX_DEPTH)throw new ExpressionError('Máxima profundidad de evaluación excedida');
  const go=(expr,extra=scope)=>evaluateNode(expr,inputs,mode,extra,depth+1,trace);
  switch(n.type){
    case 'literal':return n.value;
    case 'array':return n.items.map(x=>go(x));
    case 'record':return Object.fromEntries(n.fields.map(f=>{if(BLOCKED.has(f.key))throw new ExpressionError('Campo no permitido');return [f.key,go(f.value)];}));
    case 'identifier':{
      const s=getInput(scope,n.name);if(s!==undefined)return s;
      const i=getInput(inputs,n.name);if(i!==undefined)return i;
      if(n.name.toLowerCase()==='thisrecord')return scope;
      throw new ExpressionError(`Falta el input «${n.name}»`);
    }
    case 'member':{
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
        case '=':case '==':return JSON.stringify(a)===JSON.stringify(b)||typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
        case '<>':case '!=':return !(JSON.stringify(a)===JSON.stringify(b)||typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase());
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
        if(fn==='if'){required(2);for(let i=0;i+1<args.length;i+=2)if(truthy(arg(i)))return arg(i+1);return args.length%2===1?arg(args.length-1):null;}
        if(fn==='iferror'){required(2);try{return arg(0);}catch{return arg(1);}}
        if(fn==='switch'){required(3);const val=arg(0);for(let i=1;i+1<args.length;i+=2)if(val===arg(i))return arg(i+1);return args.length%2===0?arg(args.length-1):null;}
        if(fn==='blank')return null;
        if(fn==='isblank')return arg(0)==null||arg(0)==='';
        if(fn==='isblankorerror'){try{return arg(0)==null||arg(0)==='';}catch{return true;}}
        if(fn==='coalesce'){for(let i=0;i<args.length;i++){const v=arg(i);if(v!==null&&v!==undefined&&v!=='')return v;}return null;}
        if(fn==='filter'||fn==='lookup'||fn==='countif'||fn==='forall'){
          required(2);const rows=ensureArray(arg(0));
          if(fn==='forall')return rows.map(row=>go(args[1],{...scope,...row,ThisRecord:row}));
          const matches=rows.filter(row=>truthy(go(args[1],{...scope,...row,ThisRecord:row})));
          if(fn==='filter')return matches;
          if(fn==='countif')return matches.length;
          return matches.length?(args[2]?go(args[2],{...scope,...matches[0],ThisRecord:matches[0]}):matches[0]):null;
        }
        if(['sum','average','min','max'].includes(fn)&&args.length>1&&Array.isArray(arg(0))){
          const values=ensureArray(arg(0)).map(row=>number(go(args[1],{...scope,...row,ThisRecord:row})));
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
        if(fn==='sort'){required(2);const rows=ensureArray(arg(0));const descending=String(arg(2)??'ascending').toLowerCase().includes('descend');return [...rows].sort((a,b)=>cmp(go(args[1],{...scope,...a,ThisRecord:a}),go(args[1],{...scope,...b,ThisRecord:b}))*(descending?-1:1));}
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
  const result=evaluateNode(ast,inputs,mode);
  if(typeof result==='number'&&!Number.isFinite(result))throw new ExpressionError('Resultado numérico inválido');
  const output={success:true,platform,engine, value:result??null,valueType:typeOf(result),elapsedMs:Math.round((performance.now()-started)*100)/100};
  if(expected!==undefined)output.assertion={passed:JSON.stringify(result)===JSON.stringify(expected),expected};
  return output;
}
export function inspect({formula,platform='canvas'}){
  const ast=parse(formula,platform==='flow'?'flow':'canvas');
  return {valid:true,inputs:analyze(ast,platform==='flow'?'flow':'canvas')};
}
export function safeError(error){return {success:false,error:{message:error?.message||'Error desconocido',position:error?.position??null,code:error instanceof ExpressionError?'EXPRESSION_ERROR':'RUNTIME_ERROR'}};}
