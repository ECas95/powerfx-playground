/** Small, deliberately bounded expression parser. Never evaluates user code as JavaScript. */
export class ExpressionError extends Error {
  constructor(message, position = null) { super(message); this.name = 'ExpressionError'; this.position = position; }
}

export function tokenize(expression, mode = 'canvas') {
  const tokens = []; let i = 0;
  while (i < expression.length) {
    const ch = expression[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '/' && expression[i + 1] === '/' && mode === 'canvas') {
      while (i < expression.length && expression[i] !== '\n') i++;
      continue;
    }
    if ((ch === '"' || ch === "'") && !(mode === 'canvas' && ch !== '"')) {
      const start = i, quote = ch; let value = ''; i++;
      let closed = false;
      while (i < expression.length) {
        if (expression[i] === quote) {
          if (expression[i + 1] === quote) { value += quote; i += 2; continue; }
          i++; closed = true; break;
        }
        if (mode === 'flow' && expression[i] === '\\' && i + 1 < expression.length) {
          const escapes = {n:'\n',r:'\r',t:'\t'};
          value += escapes[expression[i+1]] ?? expression[i+1]; i += 2; continue;
        }
        value += expression[i++];
      }
      if (!closed) throw new ExpressionError('Cadena sin cerrar', start);
      tokens.push({type:'string', value, pos:start}); continue;
    }
    if (mode === 'canvas' && ch === "'") {
      const start = i; let value = ''; i++;
      let closed = false;
      while (i < expression.length) {
        if (expression[i] === "'") {
          if (expression[i+1] === "'") {value += "'"; i += 2; continue;}
          i++; closed = true; break;
        }
        value += expression[i++];
      }
      if (!closed) throw new ExpressionError('Identificador sin cerrar', start);
      tokens.push({type:'id',value,pos:start}); continue;
    }
    if (/\d/.test(ch) || (ch === '.' && /\d/.test(expression[i+1] || ''))) {
      const start=i, m=expression.slice(i).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
      i+=m[0].length; tokens.push({type:'number', value:Number(m[0]),pos:start}); continue;
    }
    if (/[\p{L}_$]/u.test(ch)) {
      const start=i;
      while (i<expression.length && /[\p{L}\p{N}_$]/u.test(expression[i])) i++;
      tokens.push({type:'id',value:expression.slice(start,i),pos:start}); continue;
    }
    const double = expression.slice(i,i+2);
    if (['<=','>=','<>','!=','==','&&','||','??','?.'].includes(double)) {
      tokens.push({type:'op',value:double,pos:i}); i+=2; continue;
    }
    if ('()+-*/^&%=<>,.:;?![]{}'.includes(ch)) {
      tokens.push({type:'op',value:ch,pos:i}); i++; continue;
    }
    throw new ExpressionError(`Carácter no reconocido: ${ch}`,i);
  }
  tokens.push({type:'eof',value:'<eof>',pos:i}); return tokens;
}

const PRECEDENCE = {or:1,'||':1,and:2,'&&':2,'=':3,'==':3,'<>':3,'!=':3,'<':3,'>':3,'<=':3,'>=':3,in:3,exactin:3,'&':4,'+':5,'-':5,'*':6,'/':6,'%':6,'^':7};

export function parse(source, mode='canvas') {
  if (typeof source !== 'string' || !source.trim()) throw new ExpressionError('Ingresa una expresión');
  if (source.length > 12000) throw new ExpressionError('Expresión demasiado larga (máximo 12 000 caracteres)');
  let input = source.trim();
  if (mode === 'flow') {
    if (input.startsWith('@{') && input.endsWith('}')) input = input.slice(2,-1);
    else if (input.startsWith('@')) input = input.slice(1);
  }
  const tokens = tokenize(input,mode), argSep = mode==='canvas' ? [',',';'] : [',']; let pos=0;
  const peek=()=>tokens[pos]; const next=()=>tokens[pos++];
  const match=v=>String(peek().value).toLowerCase()===String(v).toLowerCase();
  const eat=v=>{if(!match(v)) throw new ExpressionError(`Se esperaba '${v}' y se encontró '${peek().value}'`,peek().pos); return next();};
  const expression=(min=0)=>{
    let t=next(), node;
    if (t.type==='number'||t.type==='string') node={type:'literal',value:t.value};
    else if (t.type==='id') {
      const lower=t.value.toLowerCase();
      if (lower==='true') node={type:'literal',value:true};
      else if (lower==='false') node={type:'literal',value:false};
      else if (lower==='null'||(lower==='blank'&&peek().value!=='(')) node={type:'literal',value:null};
      else if (lower==='not') node={type:'unary',op:'not',right:expression(8)};
      else node={type:'identifier',name:t.value};
    } else if (t.value==='(') { node=expression(); eat(')'); }
    else if (t.value==='-'||t.value==='+'||t.value==='!') node={type:'unary',op:t.value,right:expression(8)};
    else if (t.value==='[') {
      const items=[];
      if(!match(']')) do {items.push(expression()); if(!argSep.includes(peek().value))break; next();}while(!match(']'));
      eat(']'); node={type:'array',items};
    } else if (t.value==='{') {
      const fields=[];
      if(!match('}')) do {
        const key=next(); if(!['id','string'].includes(key.type)) throw new ExpressionError('Nombre de campo inválido',key.pos);
        eat(':'); fields.push({key:key.value,value:expression()});
        if(!argSep.includes(peek().value))break; next();
      }while(!match('}'));
      eat('}'); node={type:'record',fields};
    } else throw new ExpressionError(`Expresión inesperada: ${t.value}`,t.pos);
    while (true) {
      const v=String(peek().value).toLowerCase();
      if (mode==='canvas' && v==='as' && min<=9) {
        next(); const alias=next();
        if(alias.type!=='id')throw new ExpressionError('Se esperaba un alias después de As',alias.pos);
        node={type:'alias',base:node,alias:alias.value}; continue;
      }
      if (v==='(' && min<=9) {
        next(); const args=[];
        if(!match(')')) do {args.push(expression()); if(!argSep.includes(peek().value))break; next();}while(!match(')'));
        eat(')'); node={type:'call',callee:node,args}; continue;
      }
      if ((v==='.'||v==='?.'||v==='['||v==='?') && min<=9) {
        if(v==='?' ){next(); eat('[');const key=expression();eat(']');node={type:'member',base:node,key,optional:true};continue;}
        if(v==='.'||v==='?.'){next();const key=next();if(key.type!=='id'&&key.type!=='string')throw new ExpressionError('Propiedad inválida',key.pos);node={type:'member',base:node,key:{type:'literal',value:key.value},optional:v==='?.'};continue;}
        next();const key=expression();eat(']');node={type:'member',base:node,key,optional:false};continue;
      }
      const prec=PRECEDENCE[v]||0;
      if(!prec||prec<min)break;
      next();const right=expression(v==='^'?prec:prec+1);
      node={type:'binary',op:v,left:node,right};
    }
    return node;
  };
  let root=expression();
  // Formula chaining in a Canvas behavior property; semicolons inside calls
  // remain argument separators for supported locales.
  if(mode==='canvas'&&match(';')){
    const items=[root];
    while(match(';')){next();if(peek().type==='eof')break;items.push(expression());}
    root={type:'sequence',items};
  }
  if(peek().type!=='eof')throw new ExpressionError(`Token inesperado: ${peek().value}`,peek().pos);
  return root;
}

export function analyze(ast,mode='canvas') {
  const inputs=new Map();
  const builtin=new Set(['thisrecord','self','parent','app','match','matchoptions','traceseverity','traceoptions','sortorder']);
  const add=(key,kind='variable')=>{if(key&&!inputs.has(key))inputs.set(key,{key,kind});};
  const walk=(n,local=false,bound=new Set())=>{
    if(!n)return;
    switch(n.type){
      case 'literal':return;
      case 'identifier':
        if(!local&&!builtin.has(n.name.toLowerCase())&&!bound.has(n.name.toLowerCase()))add(n.name);
        return;
      case 'alias':walk(n.base,local,bound);return;
      case 'sequence':n.items.forEach(a=>walk(a,local,bound));return;
      case 'call':{
        const name=n.callee.type==='identifier'?n.callee.name.toLowerCase():'';
        if(mode==='flow'&&['variables','parameters','outputs','body','items','actions'].includes(name)&&n.args[0]?.type==='literal'){
          add(`${name}:${n.args[0].value}`,name);n.args.slice(1).forEach(a=>walk(a,local,bound));return;
        }
        if(mode==='flow'&&['triggerbody','triggeroutputs','item'].includes(name)){add(name,name);return;}
        if(!name)walk(n.callee,local,bound);
        if(mode==='canvas'&&name==='with'&&n.args.length>=2){
          walk(n.args[0]?.type==='alias'?n.args[0].base:n.args[0],local,bound);
          const b=new Set(bound);
          if(n.args[0]?.type==='record')n.args[0].fields.forEach(f=>b.add(f.key.toLowerCase()));
          if(n.args[0]?.type==='alias')b.add(n.args[0].alias.toLowerCase());
          // Fields of records coming from Match or an input cannot be statically inferred.
          walk(n.args[1],n.args[0]?.type!=='record'&&n.args[0]?.type!=='alias',b);
          return;
        }
        const rowFunctions=new Set(['filter','lookup','sum','average','forall','addcolumns','countif','sort','distinct','min','max']);
        if(mode==='canvas'&&rowFunctions.has(name)&&n.args.length>1){
          const source=n.args[0],alias=source?.type==='alias'?source.alias:null;
          walk(source?.type==='alias'?source.base:source,local,bound);
          const b=new Set(bound);if(alias)b.add(alias.toLowerCase());
          for(let i=1;i<n.args.length;i++){
            // Without explicit alias, unqualified fields can be row columns.
            // With an alias, regular external variables are detectable.
            const rowSelector= name==='lookup'?i<=2:name==='addcolumns'?i>=2&&i%2===0:name==='sort'?i===1:name==='filter'||name==='countif'?true:i===1;
            const columnName=name==='addcolumns'&&i%2===1;
            walk(n.args[i],local||rowSelector&&!alias||columnName,b);
          }
          return;
        }
        n.args.forEach(a=>walk(a,local,bound));return;
      }
      case 'member':walk(n.base,local,bound);if(n.key.type!=='literal')walk(n.key,true,bound);return;
      case 'binary':walk(n.left,local,bound);walk(n.right,local,bound);return;
      case 'unary':walk(n.right,local,bound);return;
      case 'record':n.fields.forEach(f=>walk(f.value,local,bound));return;
      case 'array':n.items.forEach(a=>walk(a,local,bound));return;
    }
  };
  walk(ast);return [...inputs.values()];
}
