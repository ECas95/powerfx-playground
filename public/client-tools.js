/** Pure helpers shared by browser interactions and Node regression tests. */
export function completionContext(source,cursor=source.length,force=false){
  const left=source.slice(0,cursor);
  let quote=null;for(let i=0;i<left.length;i++){
    const ch=left[i];
    if(quote){if(ch==='\\'&&i+1<left.length){i++;continue;}if(quote==="'"&&left[i+1]==="'"){i++;continue;}if(ch===quote)quote=null;}
    else if(ch==='"'||ch==="'")quote=ch;
  }
  if(quote)return null;
  const match=/([A-Za-z_][A-Za-z_0-9]*)$/.exec(left);
  if(!match && !force)return null;
  const term=match?.[1]??'';
  if(!force&&term.length<2)return null;
  if(left.slice(0,left.length-term.length).endsWith('.'))return null;
  return {term,start:cursor-term.length,end:cursor};
}
export function functionMatches(catalog,platform,prefix='',limit=8){
  const term=prefix.toLowerCase();
  return catalog.filter(item=>item.platform===platform&&item.name.toLowerCase().startsWith(term)).slice(0,limit);
}
export function csvSerialize(rows){
  if(!Array.isArray(rows)||rows.length===0||rows.length>5000||!rows.every(r=>r&&typeof r==='object'&&!Array.isArray(r)))throw Error('CSV export requires 1–5,000 records');
  const cols=[...new Set(rows.flatMap(r=>Object.keys(r)))].slice(0,40);
  const escapeCell=v=>{
    let s=v==null?'':typeof v==='object'?JSON.stringify(v):String(v);
    // Spreadsheet formula injection: prevent untrusted cells becoming formulas.
    if(/^[\s]*[=+@\-]/.test(s))s="'"+s;
    return '"'+s.replace(/"/g,'""')+'"';
  };
  return '\uFEFF'+[cols.map(escapeCell).join(','),...rows.map(r=>cols.map(c=>escapeCell(r[c])).join(','))].join('\r\n');
}
export function jsonTreeLabel(value){
  if(Array.isArray(value))return `Array (${value.length})`;
  if(value!==null&&typeof value==='object')return `Object (${Object.keys(value).length})`;
  return JSON.stringify(value)??'undefined';
}
export function validateSuite(cases){
  if(!Array.isArray(cases)||cases.length<1||cases.length>25)throw Error('Suite must contain 1–25 test cases');
  for(const [i,item] of cases.entries()){
    if(!item||typeof item!=='object'||Array.isArray(item)||!item.inputs||typeof item.inputs!=='object'||Array.isArray(item.inputs)||!Object.hasOwn(item,'expected'))throw Error(`Case ${i+1} requires inputs object and expected value`);
    if(item.name!==undefined&&typeof item.name!=='string')throw Error(`Case ${i+1} has an invalid name`);
  }
  return cases;
}
