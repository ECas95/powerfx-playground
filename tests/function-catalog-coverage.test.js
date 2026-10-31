import test from 'node:test';
import assert from 'node:assert/strict';
import {functionCatalog} from '../public/function-catalog.js';
import {scenarios} from '../public/scenarios.js';
import {evaluate} from '../src/evaluator.js';
import {parse} from '../src/parser.js';

const samples={
  canvas:{
    switch:['Switch(4,1,"One",4,"Four","Other")',{},'Four'],
    iferror:['IfError(1/0,"recovered")',{},'recovered'],
    blank:['Blank()',{},null],
    isblank:['IsBlank(Blank())',{},true],
    isblankorerror:['IsBlankOrError(1/0)',{},true],
    startswith:['StartsWith("Northwind","north")',{},true],
    endswith:['EndsWith("Northwind","WIND")',{},true],
    average:['Average(Table({Total:10},{Total:30}),Total)',{},20],
    first:['First(Orders)',{Orders:[{Id:1},{Id:2}]},{Id:1}],
    last:['Last(Orders)',{Orders:[{Id:1},{Id:2}]},{Id:2}],
    firstn:['FirstN(Orders,1)',{Orders:[{Id:1},{Id:2}]},[{Id:1}]],
    lastn:['LastN(Orders,1)',{Orders:[{Id:1},{Id:2}]},[{Id:2}]],
    table:['Table({Value:1},{Value:2})',{},[{Value:1},{Value:2}]],
    min:['Min(20,8,30)',{},8],
    max:['Max(20,8,30)',{},30],
    rounddown:['RoundDown(7.891,2)',{},7.89],
    abs:['Abs(-13)',{},13],
    isnumeric:['IsNumeric("130.5")',{},true],
    concatenate:['Concatenate("A","-","B")',{},'A-B'],
    lower:['Lower("ABCD")',{},'abcd'],
    upper:['Upper("alpha")',{},'ALPHA'],
    trim:['Trim("  hello  ")',{},'hello'],
    len:['Len("abc")',{},3],
    left:['Left("ABCDE",2)',{},'AB'],
    right:['Right("ABCDE",2)',{},'DE'],
    mid:['Mid("ABCDE",2,2)',{},'BC'],
    substitute:['Substitute("Hi Bob","Bob","Alex")',{},'Hi Alex'],
    text:['Text(123)',{},'123'],
  },
  flow:{
    not:["@not(false)",{},true],
    actions:["@actions('Send')?['status']",{'actions:Send':{status:'Succeeded'}},'Succeeded'],
    items:["@items('Loop')?['Id']",{'items:Loop':{Id:102}},102],
    triggeroutputs:["@triggerOutputs()?['headers']?['X-Request']",{triggeroutputs:{headers:{'X-Request':'r-12'}}},'r-12'],
    length:["@length(createArray('A','B'))",{},2],
    substring:["@substring('INVOICE-2026',8,4)",{},'2026'],
    join:["@join(createArray('A','B'),'-')",{},'A-B'],
    add:["@add(10,3)",{},13],
    mod:["@mod(13,5)",{},3],
    pow:["@pow(2,4)",{},16],
    bool:["@bool('true')",{},true]
  }
};
function calls(ast,found){
  if(!ast||typeof ast!=='object')return;
  if(ast.type==='call'&&ast.callee?.type==='identifier')found.add(ast.callee.name.toLowerCase());
  for(const child of Object.values(ast)){
    if(Array.isArray(child))for(const e of child)calls(e,found);
    else if(child&&typeof child==='object')calls(child,found);
  }
}
for(const [platform, entries] of Object.entries(samples)){
  for(const [name,[formula,inputs,expected]] of Object.entries(entries)){
    test(`Function catalog individual ${platform}/${name}`,()=>{
      const result=evaluate({platform,formula,inputs,expected});
      assert.deepEqual(result.value,expected);
      assert.equal(result.assertion.passed,true);
    });
  }
}
test('Every function advertised as runnable has a passing scenario or standalone test',()=>{
  const covered={canvas:new Set(),flow:new Set()};
  for(const scenario of scenarios){calls(parse(scenario.formula,scenario.platform),covered[scenario.platform]);}
  for(const [platform,entries] of Object.entries(samples)){
    for(const [name,[formula]] of Object.entries(entries)){
      const seen=new Set();calls(parse(formula,platform),seen);
      assert.ok(seen.has(name)||platform==='flow'&&name==='not');for(const fn of seen)covered[platform].add(fn);covered[platform].add(name);
    }
  }
  const uncovered=functionCatalog.filter(item=>!covered[item.platform].has(item.name.toLowerCase()));
  assert.deepEqual(uncovered.map(x=>x.platform+'/'+x.name),[]);
});
