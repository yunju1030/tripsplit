import { createHash } from 'node:crypto';
import { transaction, inspectSchema } from './database.js';
import { AppError } from './errors.js';
import { validateTrip } from '../js/storage.js';
import { splitExpense, summarize } from '../js/calculations.js';
import { CATEGORIES, categoryOf } from '../js/categories.js';

const idPattern = /^[a-zA-Z0-9_-]{1,100}$/;
export function validId(id) { if (typeof id !== 'string' || !idPattern.test(id)) throw new AppError(400, '올바른 데이터 ID가 필요합니다.'); return id; }
export const revision = trip => createHash('sha256').update(JSON.stringify({ ...trip, revision: undefined })).digest('hex');
const withRevision = trip => ({ ...trip, revision: revision(trip) });
function number(value) { const n = Number(value); if (!Number.isSafeInteger(n) || n < 0) throw new AppError(422, 'DB 금액이 원 단위 정수 범위를 벗어났습니다.'); return n; }
export function validate(trip, schema) {
  try { validateTrip(trip); } catch (error) { throw new AppError(400, error.message); }
  if (trip.name.length > 100 || trip.participants.length > 100 || trip.expenses.length > 10000) throw new AppError(400, '여행 이름은 100자, 참여자는 100명, 지출은 10,000건 이내로 입력해 주세요.');
  for (const [table, objects] of [['trips',[trip]],['members',trip.participants],['expenses',trip.expenses]]) for (const obj of objects) {
    validId(obj.id);
  }
  if (trip.participants.some(p => p.name.length > 50) || trip.expenses.some(e => e.name.length > 100 || e.amount > 2147483647 || (e.category != null && !CATEGORIES.includes(e.category)))) throw new AppError(400, '참여자 이름(50자), 지출 이름(100자), 카테고리와 금액(최대 2,147,483,647원)을 확인해 주세요.');
}
export function createStore(pool, userId) {
  if(typeof userId!=='string'||!/^\d+$/.test(userId))throw new AppError(401,'로그인이 필요합니다.');
  async function load(client, id) {
    const trips = await client.query("SELECT id::text,name,to_char(start_date,'YYYY-MM-DD') AS start_date,to_char(end_date,'YYYY-MM-DD') AS end_date FROM public.trips WHERE owner_id=$2 AND ($1::text IS NULL OR id::text=$1) ORDER BY created_at,id", [id || null,userId]);
    if (!trips.rows.length) return [];
    const ids = trips.rows.map(t => t.id);
    const members = await client.query('SELECT id::text,trip_id::text,name,position FROM public.members WHERE trip_id::text=ANY($1::text[]) ORDER BY position,id', [ids]);
    const expenses = await client.query("SELECT id::text,trip_id::text,to_char(date,'YYYY-MM-DD') AS date,item,category,amount,paid_by::text FROM public.expenses WHERE trip_id::text=ANY($1::text[]) ORDER BY date,id", [ids]);
    const splits = await client.query('SELECT s.expense_id::text,s.member_id::text,s.share_amount FROM public.expense_splits s JOIN public.expenses e ON e.id=s.expense_id WHERE e.trip_id::text=ANY($1::text[]) ORDER BY s.member_id', [ids]);
    return trips.rows.map(t => {
      const trip = { id:t.id, name:t.name, startDate:t.start_date, endDate:t.end_date, participants:members.rows.filter(m=>m.trip_id===t.id).map(m=>({id:m.id,name:m.name})), expenses:expenses.rows.filter(e=>e.trip_id===t.id).map(e=>{
        const rows=splits.rows.filter(s=>s.expense_id===e.id);
        return {id:e.id,name:e.item,date:e.date,category:categoryOf(e),amount:number(e.amount),payer:e.paid_by,beneficiaries:members.rows.filter(m=>m.trip_id===t.id && rows.some(s=>s.member_id===m.id)).map(m=>m.id),shares:Object.fromEntries(rows.map(s=>[s.member_id,number(s.share_amount)]))};
      }) };
      try { validateTrip(trip); summarize(trip); } catch { throw new AppError(422, '기존 DB 데이터의 참여자·부담 금액·여행 기간을 확인해 주세요. 데이터는 변경하지 않았습니다.'); }
      return withRevision(trip);
    });
  }
  async function write(callback) { return transaction(pool,async client=>callback(client,await inspectSchema(client))); }
  async function locked(client,id,expected) {
    validId(id);
    const result=await client.query('SELECT id FROM public.trips WHERE id::text=$1 AND owner_id=$2 FOR UPDATE',[id,userId]);
    if (!result.rows.length) throw new AppError(404,'여행을 찾을 수 없습니다.');
    const [trip]=await load(client,id);
    if (!expected || expected !== trip.revision) throw new AppError(409,'다른 창에서 기록이 변경되었습니다. 새로고침 후 다시 수정해 주세요.');
    return trip;
  }
  async function insertExpense(client,schema,trip,expense,existingId) {
    let expenseId=existingId;
    if(existingId) await client.query('UPDATE public.expenses SET date=$3,item=$4,category=$5,amount=$6,paid_by=$7 WHERE id::text=$1 AND trip_id::text=$2',[existingId,trip.id,expense.date,expense.name,categoryOf(expense),expense.amount,expense.payer]);
    else {
      const inserted=await client.query('INSERT INTO public.expenses (trip_id,date,item,category,amount,paid_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id::text',[trip.id,expense.date,expense.name,categoryOf(expense),expense.amount,expense.payer]);
      expenseId=inserted.rows[0].id;
    }
    const shares=splitExpense(expense.amount,trip.participants.filter(p=>expense.beneficiaries.includes(p.id)).map(p=>p.id));
    for(const [member,share] of Object.entries(shares)) {
      await client.query('INSERT INTO public.expense_splits (expense_id,member_id,share_amount) VALUES ($1,$2,$3)',[expenseId,member,share]);
    }
  }
  async function insertTrip(client,schema,trip,legacyId=null) {
    validate(trip,schema);
    const {rows:[created]}=await client.query('INSERT INTO public.trips (name,start_date,end_date,legacy_id,owner_id) VALUES ($1,$2,$3,$4,$5) RETURNING id::text',[trip.name,trip.startDate,trip.endDate,legacyId,userId]);
    const mapped=new Map(), participants=[];
    for(const [position,p] of trip.participants.entries()) {
      const {rows:[member]}=await client.query('INSERT INTO public.members (trip_id,name,position) VALUES ($1,$2,$3) RETURNING id::text',[created.id,p.name,position]);
      mapped.set(p.id,member.id);participants.push({id:member.id,name:p.name});
    }
    const next={...trip,id:created.id,participants};
    for(const expense of trip.expenses) await insertExpense(client,schema,next,{...expense,payer:mapped.get(expense.payer),beneficiaries:expense.beneficiaries.map(id=>mapped.get(id))});
    return created.id;
  }
  return {
    async list() {return transaction(pool,async client=>{await inspectSchema(client);return load(client);},true);},
    async create(trip) {return write(async(client,schema)=>{
      if (!Array.isArray(trip?.expenses) || trip.expenses.length) throw new AppError(400,'새 여행의 지출은 지출 API에서 추가해 주세요.');
      const id=await insertTrip(client,schema,trip); return (await load(client,id))[0];
    });},
    async update(id,changes,expected) {return write(async(client,schema)=>{
      if(!changes || typeof changes!=='object') throw new AppError(400,'여행 수정 정보를 확인해 주세요.');
      const latest=await locked(client,id,expected);
      const next={...latest,name:changes.name,startDate:changes.startDate,endDate:changes.endDate,participants:changes.participants};
      if (!Array.isArray(next.participants)) throw new AppError(400,'참여자를 확인해 주세요.');
      const removed=latest.participants.filter(p=>!next.participants.some(n=>n.id===p.id));
      for(const p of removed) if(latest.expenses.some(e=>e.payer===p.id || e.beneficiaries.includes(p.id))) throw new AppError(409,`${p.name}님은 기존 지출에 연결되어 있습니다. 해당 지출의 결제자·부담자를 먼저 수정해 주세요.`);
      validate(next,schema);
      await client.query('UPDATE public.trips SET name=$2,start_date=$3,end_date=$4 WHERE id::text=$1',[id,next.name,next.startDate,next.endDate]);
      for(const [position,p] of next.participants.entries()) {
        if(latest.participants.some(old=>old.id===p.id)) await client.query('UPDATE public.members SET name=$3,position=$4 WHERE id::text=$1 AND trip_id::text=$2',[p.id,id,p.name,position]);
        else await client.query('INSERT INTO public.members (trip_id,name,position) VALUES ($1,$2,$3)',[id,p.name,position]);
      }
      for(const p of removed) await client.query('DELETE FROM public.members WHERE id::text=$1 AND trip_id::text=$2',[p.id,id]);
      return (await load(client,id))[0];
    });},
    async remove(id,expected) {return write(async(client)=>{
      await locked(client,id,expected);
      await client.query('DELETE FROM public.expense_splits WHERE expense_id IN (SELECT id FROM public.expenses WHERE trip_id::text=$1)',[id]);
      await client.query('DELETE FROM public.expenses WHERE trip_id::text=$1',[id]);
      await client.query('DELETE FROM public.members WHERE trip_id::text=$1',[id]);
      await client.query('DELETE FROM public.trips WHERE id::text=$1',[id]);
      return {ok:true};
    });},
    async expense(id,expense,expenseId,method,expected) {return write(async(client,schema)=>{
      const trip=await locked(client,id,expected);
      const previous=trip.expenses.find(e=>e.id===expenseId);
      if(method!=='POST' && !previous) throw new AppError(404,'지출을 찾을 수 없습니다.');
      if(method==='POST' && trip.expenses.some(e=>e.id===expense?.id)) throw new AppError(409,'이미 저장된 지출입니다. 새로고침해 주세요.');
      if(method==='PUT' && expense?.id!==expenseId) throw new AppError(400,'지출 ID가 일치하지 않습니다.');
      const expenses=method==='DELETE'?trip.expenses.filter(e=>e.id!==expenseId):method==='POST'?[...trip.expenses,expense]:trip.expenses.map(e=>e.id===expenseId?expense:e);
      validate({...trip,expenses},schema);
      if(previous){
        await client.query('DELETE FROM public.expense_splits WHERE expense_id::text=$1',[expenseId]);
        if(method==='DELETE') await client.query('DELETE FROM public.expenses WHERE id::text=$1 AND trip_id::text=$2',[expenseId,id]);
      }
      if(method!=='DELETE') await insertExpense(client,schema,trip,expense,method==='PUT'?expenseId:undefined);
      return (await load(client,id))[0];
    });},
    async import(trips) {return write(async(client,schema)=>{
      if(!Array.isArray(trips) || !trips.length || trips.length>100 || new Set(trips.map(t=>t?.id)).size!==trips.length) throw new AppError(400,'가져올 여행은 중복 없이 1~100개여야 합니다.');
      await client.query("SELECT pg_advisory_xact_lock(hashtext('tripsplit-import'))");
      let imported=0,skipped=0;
      for(const trip of trips){
        validate(trip,schema);
        const legacyId=`account:${userId}:localStorage:tripsplit.v1:${trip.id}`;
        const found=await client.query('SELECT id FROM public.trips WHERE legacy_id=$1',[legacyId]);
        if(found.rows.length){skipped++;continue;}
        await insertTrip(client,schema,trip,legacyId);imported++;
      }
      return {imported,skipped};
    });}
  };
}
