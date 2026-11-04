import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluate,inspect,safeError} from '../src/evaluator.js';

function run(formula,inputs={},expected){return evaluate({formula,platform:'canvas',inputs,expected});}
const rows=[
 {Id:1,Region:'North',Stage:'Open',Amount:100},
 {Id:2,Region:'South',Stage:'Open',Amount:50},
 {Id:3,Region:'North',Stage:'Paid',Amount:200},
 {Id:4,Region:'North',Stage:'Open',Amount:100},
];

test('GroupBy collects row data into nested tables, never mutates the input',()=>{
 const original=structuredClone(rows);
 const result=run('GroupBy(Orders,Region,Rows)',{Orders:rows});
 assert.deepEqual(result.value,[
   {Region:'North',Rows:[{Id:1,Stage:'Open',Amount:100},{Id:3,Stage:'Paid',Amount:200},{Id:4,Stage:'Open',Amount:100}]},
   {Region:'South',Rows:[{Id:2,Stage:'Open',Amount:50}]},
 ]);
 assert.deepEqual(rows,original);
});
test('GroupBy multi-key uses first-seen order with a stable nested table',()=>{
 assert.deepEqual(run('GroupBy(Orders,Region,Stage,Details)',{Orders:rows}).value.map(x=>[x.Region,x.Stage,x.Details.length]),[['North','Open',2],['South','Open',1],['North','Paid',1]]);
});
test('GroupBy legacy quoted column names are permitted',()=>{
 assert.equal(run('CountRows(GroupBy(Orders,"Region","Rows"))',{Orders:rows}).value,2);
});
test('Ungroup reverses schema and keeps the order within each group',()=>{
 assert.deepEqual(run('Ungroup(GroupBy(Orders,Region,Rows),Rows)',{Orders:rows}).value,[rows[0],rows[2],rows[3],rows[1]].map(r=>({Region:r.Region,Id:r.Id,Stage:r.Stage,Amount:r.Amount})));
});
test('AddColumns + GroupBy + Sum + DropColumns produce reporting aggregate',()=>{
 const result=run('DropColumns(AddColumns(GroupBy(Orders, Region, Rows), Total, Sum(Rows, Amount)), Rows)',{Orders:rows});
 assert.deepEqual(result.value,[{Region:'North',Total:400},{Region:'South',Total:50}]);
});
test('SortByColumns handles stable ties and 2-column comparison',()=>{
 const data=[{Name:'B',Rank:4,Id:1},{Name:'A',Rank:4,Id:2},{Name:'A',Rank:4,Id:3},{Name:'C',Rank:5,Id:4}];
 assert.deepEqual(run('SortByColumns(Items,"Rank",SortOrder.Descending,"Name",SortOrder.Ascending)',{Items:data}).value.map(x=>x.Id),[4,2,3,1]);
});
test('SortByColumns uses custom ordering for categories',()=>{
 assert.deepEqual(run('SortByColumns(Items,"Priority",["P0","P1","P2"])',{Items:[{Priority:'P2'},{Priority:'other'},{Priority:'P0'},{Priority:'P1'}]}).value.map(x=>x.Priority),['P0','P1','P2','other']);
});
test('RenameColumns handles paired swaps and prevents collision',()=>{
 assert.deepEqual(run('RenameColumns(Items,A,B,B,A)',{Items:[{A:'left',B:'right'}]}).value,[{B:'left',A:'right'}]);
 assert.throws(()=>run('RenameColumns(Items,A,B)',{Items:[{A:1,B:2}]}),/ya existe/);
});
test('Stable JSON assertion ignores object-key order but preserves array order',()=>{
 assert.equal(run('Ungroup(GroupBy(Orders, Region, Rows), Rows)',{Orders:rows},[rows[0],rows[2],rows[3],rows[1]]).assertion.passed,true);
 assert.equal(run('Table({A:1},{A:2})',{},[{A:2},{A:1}]).assertion.passed,false);
 assert.equal(run('{Name:"Ada",Age:30}',{}, {Age:30,Name:'Ada'}).assertion.passed,true);
});
test('Schema column identifiers are not incorrectly reported as external inputs',()=>{
 for(const formula of [
 'GroupBy(Orders,Region,Rows)',
 'RenameColumns(Orders,Region,Area)',
 'SortByColumns(Orders,"Total",SortOrder.Descending)',
 'ShowColumns(Orders,Region)',
 'Search(Orders,Query,Region)',
 ]){
   const keys=inspect({formula}).inputs.map(x=>x.key);
   assert.deepEqual(keys,formula.startsWith('Search')?['Orders','Query']:['Orders'],formula);
 }
});
test('Unknown and unsafe schema column names are rejected',()=>{
 for(const formula of [
 'GroupBy(Orders,Missing,Rows)',
 'GroupBy(Orders,Region,Region)',
 'GroupBy(Orders,Region,constructor)',
 'RenameColumns(Orders,Region,constructor)',
 'RenameColumns(Orders,Region,Area,Region,Other)',
 'SortByColumns(Orders,"Unknown")',
 'Ungroup(Orders,Rows)',
 ])assert.throws(()=>run(formula,{Orders:rows}), /columna|Column|Group|nombres|existe|únicos|permitido/i,formula);
});
test('Ungroup and GroupBy have bounded outputs and validate table records',()=>{
 assert.throws(()=>run('GroupBy(Orders,Region,Rows)',{Orders:[null]}),/registro JSON/);
 assert.throws(()=>run('Ungroup(Grouped,Rows)',{Grouped:[{Rows:[1,2]}]}),/registros JSON/);
 assert.throws(()=>run('GroupBy(Orders,Region,Rows)',{Orders:Array.from({length:10001},()=>({Region:'N'}))}),/10 000/);
 assert.throws(()=>run('Ungroup(Grouped,Rows)',{Grouped:[{Region:'N',Rows:Array.from({length:10001},()=>({Id:1}))}]}),/10 000/);
});
test('Synthetic mock data never performs a connector operation',()=>{
 const result=run('With({X:Sum(Orders,Amount)},X)',{Orders:rows});
 assert.equal(result.value,450);
 assert.equal(result.engine,'local');
});

test('GroupBy rejects an existing output group-column to avoid silent data loss',()=>{
 assert.throws(()=>run('GroupBy(Orders,Region,Rows)',{Orders:[{Region:'North',Rows:[{Id:1}],Total:10}]}),/ya existe/);
});
