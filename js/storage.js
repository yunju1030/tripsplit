// UI는 이 모듈만 통해 데이터를 읽고 씁니다. DB 연결 시 이 경계를 교체합니다.
import { summarize } from './calculations.js';
import { categoryOf } from './categories.js';
export const STORAGE_KEY = 'tripsplit.v1';
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
export function validateTrip(trip) {
  if (!trip || typeof trip.id !== 'string' || typeof trip.name !== 'string' || !trip.name.trim() || !validDate(trip.startDate) || !validDate(trip.endDate) || trip.startDate > trip.endDate) throw new Error('여행 이름과 여행 기간을 확인해 주세요.');
  if (!Array.isArray(trip.participants) || !trip.participants.length || trip.participants.some(p => !p || typeof p.id !== 'string' || typeof p.name !== 'string' || !p.name.trim()) || new Set(trip.participants.map(p => p.id)).size !== trip.participants.length) throw new Error('참여자를 한 명 이상 등록해 주세요.');
  if (new Set(trip.participants.map(p => p.name.trim())).size !== trip.participants.length) throw new Error('참여자 이름은 서로 다르게 입력해 주세요. 동명이인은 별명을 사용해 주세요.');
  if (!Array.isArray(trip.expenses) || new Set(trip.expenses.map(e => e.id)).size !== trip.expenses.length) throw new Error('지출 데이터가 올바르지 않습니다.');
  const ids = trip.participants.map(p => p.id);
  for (const e of trip.expenses) {
    if (typeof e.id !== 'string' || typeof e.name !== 'string' || !e.name.trim() || !validDate(e.date) || e.date < trip.startDate || e.date > trip.endDate || !ids.includes(e.payer) || !Array.isArray(e.beneficiaries) || !e.beneficiaries.length || new Set(e.beneficiaries).size !== e.beneficiaries.length || e.beneficiaries.some(id => !ids.includes(id)) || !Number.isSafeInteger(e.amount) || e.amount <= 0) throw new Error('지출 항목, 여행 기간 내 날짜, 정수 금액, 결제자와 부담자를 확인해 주세요.');
  }
  summarize(trip);
  return trip;
}
export function createRepository(storage) {
  function list() {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      const data = JSON.parse(raw);
      if (data.version !== 1 || !Array.isArray(data.trips) || new Set(data.trips.map(t => t.id)).size !== data.trips.length) throw new Error();
      return data.trips.map(validateTrip).map(trip => ({ ...trip, expenses: trip.expenses.map(e => ({ ...e, category: categoryOf(e) })) }));
    } catch { throw new Error('저장된 데이터를 읽을 수 없습니다. 원본 데이터는 보존되어 있습니다. 브라우저 저장소를 확인해 주세요.'); }
  }
  function save(trip) {
    validateTrip(trip);
    trip = { ...trip, expenses: trip.expenses.map(e => ({ ...e, category: categoryOf(e) })) };
    const trips = list();
    const index = trips.findIndex(t => t.id === trip.id);
    if (index === -1) trips.push(trip); else trips[index] = trip;
    try { storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, trips })); }
    catch { throw new Error('저장하지 못했습니다. 브라우저 저장 공간과 저장소 허용 설정을 확인해 주세요.'); }
    return trip;
  }
  function update(id, changes) {
    const latest = list().find(t => t.id === id);
    if (!latest) throw new Error('여행을 찾을 수 없습니다. 목록에서 다시 선택해 주세요.');
    const removed = latest.participants.filter(p => !changes.participants.some(next => next.id === p.id));
    for (const p of removed) {
      if (latest.expenses.some(e => e.payer === p.id || e.beneficiaries.includes(p.id))) throw new Error(`${p.name}님은 지출의 결제자 또는 부담자입니다. 관련 지출을 먼저 수정한 뒤 참여자를 삭제해 주세요.`);
    }
    if (latest.expenses.some(e => e.date < changes.startDate || e.date > changes.endDate)) throw new Error('기존 지출 날짜가 새 여행 기간 밖에 있습니다. 여행 기간을 넓히거나 관련 지출 날짜를 먼저 수정해 주세요.');
    return save({ ...latest, name: changes.name, startDate: changes.startDate, endDate: changes.endDate, participants: changes.participants });
  }
  function remove(id) {
    const trips = list().filter(t => t.id !== id);
    try { storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, trips })); }
    catch { throw new Error('삭제 내용을 저장하지 못했습니다. 브라우저 저장소 설정을 확인해 주세요.'); }
  }
  return { list, save, update, remove, get: id => list().find(t => t.id === id) };
}
