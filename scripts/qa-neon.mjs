// Explicit real-DB verification. Creates only uniquely named QA data and cleans it.
import dotenv from 'dotenv';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createPool, transaction, inspectSchema } from '../server/database.js';
import { createStore } from '../server/store.js';
import { createApp } from '../server.js';
import { summarize } from '../js/calculations.js';
dotenv.config({path:process.env.TRIPSPLIT_ENV_FILE||'.env',quiet:true});
// Only this one-off QA bootstrap accepts the old misspelling. Runtime requires DATABASE_URL.
const pool=createPool(process.env.DATABASE_URL||process.env.DATABAST_URL);
const token=`TripSplit_QA_${randomUUID()}`;
const localId=randomUUID(), legacyId=`localStorage:tripsplit.v1:${localId}`;
const names=[token,`${token}_other`,`${token}_edited`,`${token}_import`,`${token}_rollback`];
const ids=new Set();let server;let baseline;
const digest=rows=>createHash('sha256').update(JSON.stringify(rows)).digest('hex');
async function snapshot(){
  const out={};
  for(const table of ['trips','members','expenses','expense_splits']) out[table]=digest((await pool.query(`SELECT * FROM public.${table} ORDER BY id`)).rows);
  return out;
}
try{
  if(process.argv.includes('--prepare')){
    const c=await pool.connect();
    try{await c.query(await readFile(new URL('../migrations/001-preserve-order-and-import.sql',import.meta.url),'utf8'));}
    catch(error){await c.query('ROLLBACK');throw error;}
    finally{c.release();}
    console.log('PASS: additive migration; existing tables and records retained');
  }
  await inspectSchema(pool);baseline=await snapshot();
  const store=createStore(pool);
  server=createApp({storeFactory:()=>store}).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const headers={'Content-Type':'application/json','X-Requested-With':'TripSplit'};
  async function api(path,method='GET',body,revision,status=200){
    const response=await fetch(`${base}/api${path}`,{method,headers:{...headers,...(revision?{'If-Match':revision}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const data=await response.json();assert.equal(response.status,status,data.error);return data;
  }
  const participants=[{id:randomUUID(),name:'윤주'},{id:randomUUID(),name:'서영'},{id:randomUUID(),name:'시우'}];
  const source={id:randomUUID(),name:token,startDate:'2026-10-21',endDate:'2026-10-23',participants,expenses:[]};
  let trip=await api('/trips','POST',source,undefined,201);ids.add(trip.id);
  const other=await api('/trips','POST',{...source,id:randomUUID(),name:names[1]},undefined,201);ids.add(other.id);
  assert.match(trip.id,/^\d+$/);assert.equal(trip.participants.length,3);
  const a=trip.participants[0].id,b=trip.participants[1].id,c=trip.participants[2].id;
  trip=await api(`/trips/${trip.id}/expenses`,'POST',{id:randomUUID(),name:'식사',date:'2026-10-22',category:'식비',amount:30000,payer:a,beneficiaries:[a,b,c]},trip.revision,201);
  trip=await api(`/trips/${trip.id}/expenses`,'POST',{id:randomUUID(),name:'KTX',date:'2026-10-22',category:'교통비',amount:96000,payer:b,beneficiaries:[a,b]},trip.revision,201);
  assert.deepEqual(summarize(trip).members.map(p=>p.owed),[58000,58000,10000]);
  const count=await pool.query('SELECT (SELECT count(*)::int FROM public.members WHERE trip_id::text=$1) AS members,(SELECT count(*)::int FROM public.expenses WHERE trip_id::text=$1) AS expenses,(SELECT count(*)::int FROM public.expense_splits s JOIN public.expenses e ON e.id=s.expense_id WHERE e.trip_id::text=$1) AS splits',[trip.id]);
  assert.deepEqual(count.rows[0],{members:3,expenses:2,splits:5});
  console.log('PASS: real API -> trips/members/expenses/expense_splits and exact settlement');
  const before=structuredClone(trip),expected=trip.revision;
  trip=await api(`/trips/${trip.id}`,'PUT',{name:names[2],startDate:'2026-10-20',endDate:'2026-10-24',participants:trip.participants.map((p,i)=>({...p,name:i===0?'윤주 수정':p.name}))},trip.revision);
  assert.equal(trip.participants[0].id,a);assert.deepEqual(trip.expenses,before.expenses);assert.deepEqual(summarize(trip).transfers,summarize(before).transfers);
  await api(`/trips/${trip.id}`,'PUT',{...trip,participants:trip.participants.filter(p=>p.id!==a)},trip.revision,409);
  await api(`/trips/${trip.id}`,'PUT',trip,expected,409);
  trip=await api(`/trips/${trip.id}`,'PUT',{...trip,participants:[...trip.participants,{id:randomUUID(),name:'새 참여자'}]},trip.revision);
  trip=await api(`/trips/${trip.id}`,'PUT',{...trip,participants:trip.participants.slice(0,3)},trip.revision);
  const expense=trip.expenses[0];
  trip=await api(`/trips/${trip.id}/expenses/${expense.id}`,'PUT',{...expense,shares:undefined,amount:10001,category:'카페·간식',beneficiaries:[a,b,c]},trip.revision);
  assert.deepEqual(Object.values(trip.expenses.find(e=>e.id===expense.id).shares).sort((a,b)=>b-a),[3334,3334,3333]);
  const reloaded=(await api('/trips')).trips.find(t=>t.id===trip.id);assert.deepEqual(reloaded,trip);
  trip=await api(`/trips/${trip.id}/expenses/${expense.id}`,'DELETE',undefined,trip.revision);assert.equal(trip.expenses.length,1);
  const remainingSplits=await pool.query('SELECT count(*)::int AS n FROM public.expense_splits WHERE expense_id::text=$1',[expense.id]);assert.equal(remainingSplits.rows[0].n,0);
  console.log('PASS: rename preserves IDs/shares, protected participant, conflict, expense update/delete, fresh reload');
  const local={...source,id:localId,name:names[3],expenses:[{id:randomUUID(),name:'가져오기',date:'2026-10-22',amount:10001,payer:participants[0].id,beneficiaries:participants.map(p=>p.id)}]};
  assert.deepEqual(await api('/import','POST',{trips:[local]}),{imported:1,skipped:0});
  assert.deepEqual(await api('/import','POST',{trips:[local]}),{imported:0,skipped:1});
  const imported=(await pool.query('SELECT id::text FROM public.trips WHERE legacy_id=$1',[legacyId])).rows[0];ids.add(imported.id);
  const restored=(await store.list()).find(t=>t.id===imported.id);assert.equal(restored.expenses[0].category,'기타');assert.deepEqual(summarize(restored).members.map(p=>p.owed),[3334,3334,3333]);
  console.log('PASS: explicit legacy import, ID mapping, no duplicate upload');
  await assert.rejects(()=>transaction(pool,async client=>{await client.query('INSERT INTO public.trips (name,start_date,end_date) VALUES ($1,$2,$3)',[names[4],'2026-10-21','2026-10-23']);throw Error('deliberate rollback');}));
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM public.trips WHERE name=$1',[names[4]])).rows[0].n,0);
  await api(`/trips/${trip.id}`,'DELETE',undefined,trip.revision);assert.ok((await store.list()).some(t=>t.id===other.id));
  console.log('PASS: transaction rollback and isolated trip deletion');
}catch(error){console.error(error.code?`FAIL (${error.code})`:error.status?`FAIL (${error.status}) ${error.message}`:error instanceof assert.AssertionError?`FAIL: ${error.message}`:'FAIL: connection or verification error; secrets omitted');process.exitCode=1;}
finally{
  try{
    await transaction(pool,async client=>{
      const rows=await client.query('SELECT id::text FROM public.trips WHERE id::text=ANY($1::text[]) OR name=ANY($2::text[]) OR legacy_id=$3',[Array.from(ids),names,legacyId]);
      const cleanup=rows.rows.map(t=>t.id);
      await client.query('DELETE FROM public.expense_splits WHERE expense_id IN (SELECT id FROM public.expenses WHERE trip_id::text=ANY($1::text[]))',[cleanup]);
      await client.query('DELETE FROM public.expenses WHERE trip_id::text=ANY($1::text[])',[cleanup]);
      await client.query('DELETE FROM public.members WHERE trip_id::text=ANY($1::text[])',[cleanup]);
      await client.query('DELETE FROM public.trips WHERE id::text=ANY($1::text[])',[cleanup]);
    });
    if(baseline){assert.deepEqual(await snapshot(),baseline);console.log('PASS: all QA rows removed; original four-table records unchanged');}
  }catch{console.error('QA CLEANUP NEEDS REVIEW. Run scripts/qa-neon.mjs only with managed test cleanup.');process.exitCode=1;}
  if(server)await new Promise(resolve=>server.close(resolve));await pool.end();
}
