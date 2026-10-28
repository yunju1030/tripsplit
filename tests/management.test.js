import test from 'node:test';
import assert from 'node:assert/strict';
import { createRepository, STORAGE_KEY } from '../js/storage.js';
import { summarize } from '../js/calculations.js';
const trip = id => ({ id, name: '강릉', startDate: '2026-10-21', endDate: '2026-10-23', participants: [{ id:'a',name:'윤주' },{ id:'b',name:'서영' },{ id:'c',name:'시우' }], expenses:[{id:'e',name:'식사',date:'2026-10-22',amount:10001,payer:'a',beneficiaries:['a','b']}] });
function setup() { const values = new Map(); const storage = { getItem:k=>values.get(k)||null, setItem:(k,v)=>values.set(k,v) }; const repo = createRepository(storage); repo.save(trip('one')); repo.save(trip('two')); return {repo,storage}; }
test('여행 수정, ID·기존 지출·정산 보존 및 새 저장소에서 복원', () => {
  const {repo,storage} = setup(); const before=repo.get('one'); const other=repo.get('two');
  repo.update('one',{...before,name:'부산 여행',startDate:'2026-10-20',endDate:'2026-10-24',participants:[{id:'a',name:'윤주 수정'},before.participants[1],{id:'new',name:'새 참여자'}]});
  const reloaded=createRepository(storage).get('one');
  assert.equal(reloaded.name,'부산 여행'); assert.equal(reloaded.startDate,'2026-10-20'); assert.equal(reloaded.endDate,'2026-10-24');
  assert.deepEqual(reloaded.expenses,before.expenses);
  assert.deepEqual(summarize(reloaded).members.slice(0,2).map(p=>[p.paid,p.owed,p.balance]),summarize(before).members.slice(0,2).map(p=>[p.paid,p.owed,p.balance]));
  assert.deepEqual(repo.get('two'),other);
  reloaded.expenses.push({id:'new-expense',name:'추가 지출',date:'2026-10-22',amount:10,payer:'new',beneficiaries:['new']}); repo.save(reloaded);
  assert.equal(repo.get('one').expenses[1].payer,'new');
});
test('결제자·부담자 삭제, 최소 인원, 날짜 축소 방어 및 원본 보존', () => {
  const {repo,storage} = setup(); const before=storage.getItem(STORAGE_KEY), t=repo.get('one');
  for(const id of ['a','b']) assert.throws(()=>repo.update('one',{...t,participants:t.participants.filter(p=>p.id!==id)}),/관련 지출/);
  assert.throws(()=>repo.update('one',{...t,participants:[]}));
  assert.throws(()=>repo.update('one',{...t,endDate:'2026-10-21'}),/지출 날짜/);
  assert.equal(storage.getItem(STORAGE_KEY),before);
});
test('여행 삭제는 대상만 제거하고 새로고침 후에도 유지', () => {
  const {repo,storage}=setup(); const other=repo.get('two'); repo.remove('one');
  const restored=createRepository(storage); assert.equal(restored.get('one'),undefined); assert.deepEqual(restored.list(),[other]);
});
