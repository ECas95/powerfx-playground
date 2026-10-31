import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluate,inspect} from '../src/evaluator.js';
import {parse,ExpressionError} from '../src/parser.js';

const run=(formula,inputs={})=>evaluate({formula,platform:'canvas',inputs});
const cases=[
  ['With inline record','With({Amount:180,TaxRate:0.18}, Round(Amount * (1 + TaxRate),2))',{},212.4],
  ['With nested shadowing','With({x:10}, With({x:3,y:2},x*y))',{},6],
  ['With scopes inherited','With({rate:0.18}, With({total:400}, Round(total*rate,2)))',{},72],
  ['With error fallback','IfError(With({d:0},100/d),"Fallback")',{},'Fallback'],
  ['With captures external input','With({threshold:Minimum}, If(Sales >= threshold, "Pass", "No"))',{Minimum:100,Sales:150},'Pass'],
  ['Regex email predefined','IsMatch("owner@example.com",Match.Email)',{},true],
  ['Regex valid postal code','IsMatch("LIM-0005", "[A-Z]{3}-\\d{4}")',{},true],
  ['Regex invalid postal code','IsMatch("LIM-05", "[A-Z]{3}-\\d{4}")',{},false],
  ['Regex optional ignore case','IsMatch("abC", "abc", MatchOptions.IgnoreCase)',{},true],
  ['Regex contains option','IsMatch("Ticket REF-1234 ok", "REF-\\d+", MatchOptions.Contains)',{},true],
  ['Regex begins with option','IsMatch("REF-1234 pending", "REF-\\d+", MatchOptions.BeginsWith)',{},true],
  ['Regex ends with option','IsMatch("Number REF-1234", "REF-\\d+", MatchOptions.EndsWith)',{},true],
  ['Regex named capture','Match("Billing INV-2401", "INV-(?<InvoiceNo>\\d+)")',{}, {FullMatch:'INV-2401',StartMatch:9,InvoiceNo:'2401'}],
  ['Regex no match','Match("Nothing here", "INV-(?<id>\\d+)")',{},null],
  ['Regex all matches','MatchAll("SKU-12 SKU-08", "SKU-(?<num>\\d+)")',{},[{FullMatch:'SKU-12',StartMatch:1,num:'12'},{FullMatch:'SKU-08',StartMatch:8,num:'08'}]],
  ['Regex numbered submatches','Match("INV-123", "([A-Z]+)-(\\d+)",MatchOptions.NumberedSubMatches)',{}, {FullMatch:'INV-123',StartMatch:1,SubMatches:[{Value:'INV'},{Value:'123'}]}],
  ['Regex and With extraction','With(Match("INV-2048", "INV-(?<id>\\d+)"),Value(id)+10)',{},2058],
  ['Filter multiple predicates','Filter(Orders, Status="Open", Total>200)',{Orders:[{Status:'Open',Total:240},{Status:'Open',Total:100},{Status:'Closed',Total:700}]},[{Status:'Open',Total:240}]],
  ['Filter with alias','Filter(Orders As o, o.Total>=100 And o.Status="Open")',{Orders:[{Status:'Open',Total:240},{Status:'Open',Total:20}]},[{Status:'Open',Total:240}]],
  ['Filter nested aliases','Filter(Customers As c, CountIf(Orders As o,o.CustomerId=c.Id)>1)',{Customers:[{Id:1,Name:'A'},{Id:2,Name:'B'}],Orders:[{CustomerId:1},{CustomerId:1},{CustomerId:2}]},[{Id:1,Name:'A'}]],
  ['With + multi-filter','With({MinTotal:150},Filter(Orders As o,o.Total>MinTotal,o.Status="Open"))',{Orders:[{Total:250,Status:'Open'},{Total:90,Status:'Open'},{Total:280,Status:'Closed'}]},[{Total:250,Status:'Open'}]],
  ['AddColumns alias','AddColumns(Orders As o,"Tax",Round(o.Total*0.18,2))',{Orders:[{Total:100},{Total:50}]},[{Total:100,Tax:18},{Total:50,Tax:9}]],
  ['Distinct as Value table','Distinct(Orders As o,o.Status)',{Orders:[{Status:'Open'},{Status:'Closed'},{Status:'Open'}]},[{Value:'Open'},{Value:'Closed'}]],
  ['ShowColumns','ShowColumns(Orders,"Id","Total")',{Orders:[{Id:1,Total:200,Internal:true}]},[{Id:1,Total:200}]],
  ['DropColumns','DropColumns(Orders,"Internal")',{Orders:[{Id:1,Total:200,Internal:true}]},[{Id:1,Total:200}]],
  ['Search multi column','Search(Orders,"pen","Status","Description")',{Orders:[{Status:'Open',Description:'Pending'},{Status:'Closed',Description:'shipped'}]},[{Status:'Open',Description:'Pending'}]],
  ['StartsWith ignore case','StartsWith("Power Apps","power")',{},true],
  ['EndsWith ignore case','EndsWith("Power Apps","APPS")',{},true],
  ['Sequence generates rows','Sequence(3,10,5)',{},[{Value:10},{Value:15},{Value:20}]],
  ['Index one-based','Index(Orders,2)',{Orders:[{Id:1},{Id:2}]},{Id:2}],
  ['IsEmpty for tables','IsEmpty(Filter(Orders,Status="Cancelled"))',{Orders:[{Status:'Open'}]},true],
  ['Trace statement chaining','Trace("Validated",TraceSeverity.Warning,{Step:"Approval"}); If(true,"Approved","Rejected")',{},'Approved'],
  ['Trace isolated','Trace("Info")',{},null],
  ['Trace inside With','With({Step:"Sent"},Trace(Step,TraceSeverity.Information,{Retries:2}))',{},null],
  ['ForAll regex Match extraction','ForAll(Codes As c,Match(c.Value,"(?<prefix>[A-Z]{2})-(?<id>\\d+)").id)',{Codes:[{Value:'AB-12'},{Value:'XY-23'}]},['12','23']],
  ['Complex With + Filter + Sum','With({Tax:0.18},Round(Sum(Filter(Orders As o,o.Status="Open"),Total)*(1+Tax),2))',{Orders:[{Total:200,Status:'Open'},{Total:100,Status:'Closed'},{Total:50,Status:'Open'}]},295],
];
for(const [title,formula,inputs,expected] of cases)test('Advanced Power Fx: '+title,()=>{
  const result=run(formula,inputs);
  assert.deepEqual(result.value,expected);
  assert.equal(result.success,true);
});

test('With analysis does not mistake lexical fields for inputs',()=>{
  assert.deepEqual(inspect({formula:'With({Subtotal:Amount,Tax:0.18}, Round(Subtotal*(1+Tax),2))'}).inputs.map(x=>x.key),['Amount']);
});
test('Aliased nested Filter detects referenced global variable',()=>{
  assert.deepEqual(inspect({formula:'Filter(Orders As o, o.Total>=Threshold)'}).inputs.map(x=>x.key),['Orders','Threshold']);
});
test('Regex patterns and MatchOptions must be compile-time constants',()=>{
  assert.throws(()=>run('IsMatch("ABC",Pattern)',{Pattern:'.*'}),/deben ser constantes/);
  assert.throws(()=>run('IsMatch("ABC","ABC",Options)',{Options:'IgnoreCase'}),/deben ser constantes/);
});
test('Regex rejects potential ReDoS and excessive input',()=>{
  assert.throws(()=>run('IsMatch("aaa", "(a+)+")'),/cuantificadores anidados/);
  assert.throws(()=>run('IsMatch("abc", "(?<=a)b")'),/no soportada/);
  assert.throws(()=>run('IsMatch(Text, "a+")',{Text:'a'.repeat(3000)}),/demasiado larga/);
});
test('Trace yields structured diagnostics, not actual telemetry',()=>{
  const result=run('Trace("sync",TraceSeverity.Critical,{Action:"save",Count:2})');
  assert.deepEqual(result.traces,[{message:'sync',severity:'Critical',customRecord:{Action:'save',Count:2}}]);
  assert.match(result.warnings[0],/simulated locally/);
});
test('Invalid trace severity rejected',()=>{
  assert.throws(()=>run('Trace("x","NotASeverity")'),/TraceSeverity inválido/);
});
test('Function names cannot execute arbitrary host JS',()=>{
  assert.throws(()=>run('constructor("return process")'),/Función|Inputs requeridos/);
  assert.throws(()=>run('With({value:3},value.constructor)'),/no permitida/);
});
