import test from 'node:test';
import assert from 'node:assert/strict';
import { createRepository, STORAGE_KEY } from '../js/storage.js';
import { CATEGORIES, categoryOf } from '../js/categories.js';
import { summarize } from '../js/calculations.js';
test('기존 카테고리 없는 데이터 읽기, 정산 보존, 등록·수정·새로고침', () => {
  const trip = { id:'t', name:'강릉', startDate:'2026-10-21', endDate:'2026-10-23', participants:[{id:'a',name:'윤주'},{id:'b',name:'서영'}], expenses:[{id:'e',name:'식사',date:'2026-10-22',amount:10001,payer:'a',beneficiaries:['a','b']}] };
  const values=new Map([[STORAGE_KEY,JSON.stringify({version:1,trips:[trip]})]]);
  const storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
  const raw=storage.getItem(STORAGE_KEY), before=summarize(trip);
  let repo=createRepository(storage); const loaded=repo.get('t');
  assert.equal(loaded.expenses[0].category,'기타'); assert.equal(storage.getItem(STORAGE_KEY),raw);
  for(const category of CATEGORIES){loaded.expenses[0].category=category;repo.save(loaded);repo=createRepository(storage);assert.equal(repo.get('t').expenses[0].category,category);assert.deepEqual(summarize(repo.get('t')),before);}
  loaded.expenses.push({...trip.expenses[0],id:'new',category:'교통비'});repo.save(loaded);
  assert.equal(createRepository(storage).get('t').expenses[1].category,'교통비');
  assert.equal(categoryOf({category:'unknown'}),'기타');
});
