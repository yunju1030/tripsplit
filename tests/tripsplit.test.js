import test from 'node:test';
import assert from 'node:assert/strict';
import { splitExpense, summarize } from '../js/calculations.js';
import { createRepository, STORAGE_KEY } from '../js/storage.js';

const participants = [{ id: 'a', name: '윤주' }, { id: 'b', name: '서영' }, { id: 'c', name: '시우' }];
const expense = (id, amount, payer, beneficiaries) => ({ id, name: '경비', date: '2026-10-27', amount, payer, beneficiaries });
const trip = () => ({ id: 'trip1', name: '부산 여행', startDate: '2026-10-27', endDate: '2026-10-29', participants: structuredClone(participants), expenses: [] });
function memoryStorage() { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; }

test('3인 식사 및 2인 KTX의 부담액과 송금 후 잔액', () => {
  const t = trip(); t.expenses = [expense('1', 30000, 'a', ['a', 'b', 'c']), expense('2', 96000, 'b', ['a', 'b'])];
  const result = summarize(t);
  assert.equal(result.total, 126000);
  assert.deepEqual(result.members.map(p => p.owed), [58000, 58000, 10000]);
  assert.deepEqual(result.members.map(p => p.balance), [-28000, 38000, -10000]);
  const balances = Object.fromEntries(result.members.map(p => [p.id, p.balance]));
  for (const t of result.transfers) { balances[t.from] += t.amount; balances[t.to] -= t.amount; }
  assert.deepEqual(Object.values(balances), [0, 0, 0]);
});
test('1원 나머지 분배, 부분 부담, 소액, 정수 경계', () => {
  assert.deepEqual(splitExpense(10000, ['a', 'b', 'c']), { a: 3334, b: 3333, c: 3333 });
  assert.deepEqual(splitExpense(1, ['a', 'b', 'c']), { a: 1, b: 0, c: 0 });
  assert.deepEqual(splitExpense(96000, ['a', 'b']), { a: 48000, b: 48000 });
  for (const amount of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => splitExpense(amount, ['a']));
  assert.throws(() => splitExpense(10, []));
});
test('여러 여행 생성, 새 repository에서 복원, 지출 추가·수정·삭제 및 여행 간 분리', () => {
  const storage = memoryStorage(); let repo = createRepository(storage);
  const one = trip(), two = { ...trip(), id: 'trip2', name: '제주 여행' };
  repo.save(one); repo.save(two);
  one.expenses.push(expense('1', 10001, 'a', ['a', 'b', 'c'])); repo.save(one);
  repo = createRepository(storage);
  assert.equal(repo.list().length, 2);
  assert.equal(summarize(repo.get('trip1')).total, 10001);
  assert.equal(summarize(repo.get('trip2')).total, 0);
  one.expenses[0] = expense('1', 96000, 'b', ['a', 'b']); repo.save(one);
  assert.deepEqual(summarize(repo.get('trip1')).members.map(p => p.owed), [48000, 48000, 0]);
  one.expenses = []; repo.save(one);
  assert.equal(repo.get('trip1').expenses.length, 0);
});
test('여행 입력, 부담자, 날짜, 중복 이름 검증 및 저장 실패', () => {
  const repo = createRepository(memoryStorage());
  assert.throws(() => repo.save({ ...trip(), participants: [] }));
  assert.throws(() => repo.save({ ...trip(), endDate: '2026-10-01' }));
  assert.throws(() => repo.save({ ...trip(), startDate: '2026-02-30' }));
  assert.throws(() => repo.save({ ...trip(), participants: [{ id: 'a', name: '윤주' }, { id: 'b', name: '윤주' }] }));
  for (const e of [expense('1', 1, 'x', ['a']), expense('1', 1, 'a', []), expense('1', 1, 'a', ['x']), { ...expense('1', 1, 'a', ['a']), date: '2026-10-01' }]) assert.throws(() => repo.save({ ...trip(), expenses: [e] }));
  const blocked = createRepository({ getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } });
  assert.throws(() => blocked.save(trip()), /저장하지 못했습니다/);
});
test('손상 데이터는 덮어쓰지 않고 보존', () => {
  const storage = memoryStorage(); storage.setItem(STORAGE_KEY, '{broken');
  const repo = createRepository(storage);
  assert.throws(() => repo.list()); assert.throws(() => repo.save(trip()));
  assert.equal(storage.getItem(STORAGE_KEY), '{broken');
});
test('여러 정수 금액에서도 총 부담액과 송금 결과 일치', () => {
  for (let n = 1; n <= 200; n++) {
    const t = trip();
    t.expenses = [expense('1', n * 997, 'a', ['a', 'b', 'c']), expense('2', n * 31 + 1, 'c', ['b', 'c']), expense('3', n + 3, 'b', ['a'])];
    const s = summarize(t);
    assert.equal(s.members.reduce((sum, p) => sum + p.owed, 0), s.total);
    assert.equal(s.members.reduce((sum, p) => sum + p.balance, 0), 0);
    const balances = Object.fromEntries(s.members.map(p => [p.id, p.balance]));
    for (const transfer of s.transfers) { balances[transfer.from] += transfer.amount; balances[transfer.to] -= transfer.amount; }
    assert.ok(Object.values(balances).every(value => value === 0));
  }
});
