import dotenv from 'dotenv';
import assert from 'node:assert/strict';
import { randomUUID,randomBytes,createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createPool,transaction } from '../server/database.js';
import { createStore } from '../server/store.js';
import { createAccounts,tokenHash } from '../server/accounts.js';
import { createApp } from '../server.js';
import { summarize } from '../js/calculations.js';
dotenv.config({path:process.env.TRIPSPLIT_ENV_FILE||'.env',quiet:true});
const pool=createPool(process.env.DATABASE_URL),tag=randomBytes(6).toString('hex');
const names=[`qa_a_${tag}`,`qa_b_${tag}`],password=randomUUID(),ip=`qa-${tag}`;
let server,baseline;
async function snapshot(){const result={};for(const table of ['trips','members','expenses','expense_splits'])result[table]=createHash('sha256').update(JSON.stringify((await pool.query(`SELECT * FROM public.${table} ORDER BY id`)).rows)).digest('hex');return result;}
try{
  if(process.argv.includes('--prepare')){const c=await pool.connect();try{await c.query(await readFile(new URL('../migrations/002-personal-accounts.sql',import.meta.url),'utf8'));}catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}console.log('PASS: additive personal-account schema, existing trips kept without automatic assignment');}
  baseline=await snapshot();
  server=createApp({storeFactory:id=>createStore(pool,id),accountFactory:()=>createAccounts(pool),config:{VERCEL:'1'}}).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  async function api(path,method='GET',body,cookie,revision,status=200){const r=await fetch(base+'/api'+path,{method,headers:{'Content-Type':'application/json','X-Requested-With':'TripSplit','x-forwarded-for':ip,...(cookie?{Cookie:cookie}:{}),...(revision?{'If-Match':revision}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});const data=await r.json();assert.equal(r.status,status,data.error);return {data,cookie:r.headers.get('set-cookie')?.split(';')[0],headers:r.headers};}
  await api('/trips','GET',undefined,undefined,undefined,401);
  const a=await api('/auth/register','POST',{username:names[0],password},undefined,undefined,201);
  const b=await api('/auth/register','POST',{username:names[1],password},undefined,undefined,201);
  assert.ok(a.headers.get('set-cookie').includes('HttpOnly'));assert.ok(a.headers.get('set-cookie').includes('Secure'));assert.ok(!JSON.stringify(a.data).includes(password));
  const hash=(await pool.query('SELECT password_hash FROM public.app_users WHERE username=$1',[names[0]])).rows[0].password_hash;assert.ok(hash.startsWith('scrypt$'));assert.ok(!hash.includes(password));
  await api('/auth/register','POST',{username:names[0],password},undefined,undefined,409);
  await api('/auth/login','POST',{username:names[0],password:'wrong-password-123'},undefined,undefined,401);
  const source={id:randomUUID(),name:`QA private ${tag}`,startDate:'2026-10-21',endDate:'2026-10-23',participants:[{id:randomUUID(),name:'가'},{id:randomUUID(),name:'나'},{id:randomUUID(),name:'다'}],expenses:[],owner_id:b.data.user.id};
  let trip=(await api('/trips','POST',source,a.cookie,undefined,201)).data;
  assert.equal((await pool.query('SELECT owner_id::text FROM public.trips WHERE id::text=$1',[trip.id])).rows[0].owner_id,a.data.user.id);
  assert.deepEqual((await api('/trips','GET',undefined,b.cookie)).data.trips,[]);
  assert.equal((await api('/trips','GET',undefined,a.cookie)).data.trips.length,1);
  for(const method of ['PUT','DELETE'])await api(`/trips/${trip.id}`,method,method==='PUT'?trip:undefined,b.cookie,trip.revision,404);
  const ids=trip.participants.map(p=>p.id);
  const expense={id:randomUUID(),date:'2026-10-22',name:'식사',category:'식비',amount:92000,payer:ids[0],beneficiaries:ids};
  await api(`/trips/${trip.id}/expenses`,'POST',expense,b.cookie,trip.revision,404);
  trip=(await api(`/trips/${trip.id}/expenses`,'POST',expense,a.cookie,trip.revision,201)).data;
  const e=trip.expenses[0];assert.deepEqual(summarize(trip).members.map(p=>p.owed),[30667,30667,30666]);
  for(const method of ['PUT','DELETE'])await api(`/trips/${trip.id}/expenses/${e.id}`,method,method==='PUT'?{...e,shares:undefined}:undefined,b.cookie,trip.revision,404);
  const previous=structuredClone(trip);trip=(await api(`/trips/${trip.id}`,'PUT',{...trip,name:`QA edited ${tag}`,participants:trip.participants.map((p,i)=>({...p,name:i===0?'이름 수정':p.name}))},a.cookie,trip.revision)).data;
  assert.deepEqual(trip.expenses,previous.expenses);assert.deepEqual(summarize(trip).transfers,summarize(previous).transfers);
  await api(`/trips/${trip.id}`,'PUT',{...trip,participants:trip.participants.slice(1)},a.cookie,trip.revision,409);
  trip=(await api(`/trips/${trip.id}/expenses/${e.id}`,'PUT',{...e,shares:undefined,amount:10001,category:'카페·간식'},a.cookie,trip.revision)).data;assert.deepEqual(summarize(trip).members.map(p=>p.owed),[3334,3334,3333]);
  await api('/auth/logout','POST',{},a.cookie);await api('/trips','GET',undefined,a.cookie,undefined,401);
  const login=await api('/auth/login','POST',{username:names[0].toUpperCase(),password});assert.deepEqual((await api('/trips','GET',undefined,login.cookie)).data.trips,[trip]);
  const device=await api('/auth/login','POST',{username:names[0],password});assert.deepEqual((await api('/trips','GET',undefined,device.cookie)).data.trips,[trip]);
  const fresh=createStore(pool,a.data.user.id);assert.deepEqual(await fresh.list(),[trip]);
  await pool.query('UPDATE public.app_sessions SET expires_at=now()-interval \'1 second\' WHERE token_hash=$1',[tokenHash(login.cookie.split('=')[1])]);await api('/trips','GET',undefined,login.cookie,undefined,401);assert.deepEqual((await api('/trips','GET',undefined,device.cookie)).data.trips,[trip]);
  console.log('PASS: simple signup, password hashing, private ownership, cross-account trip/expense denial, settlement, logout/relogin, second device and session expiry');
  const local={...source,id:randomUUID(),expenses:[]};delete local.owner_id;
  assert.deepEqual((await api('/import','POST',{trips:[local]},device.cookie)).data,{imported:1,skipped:0});assert.deepEqual((await api('/import','POST',{trips:[local]},device.cookie)).data,{imported:0,skipped:1});assert.deepEqual((await api('/import','POST',{trips:[local]},b.cookie)).data,{imported:1,skipped:0});
  trip=(await api(`/trips/${trip.id}/expenses/${e.id}`,'DELETE',undefined,device.cookie,trip.revision)).data;await api(`/trips/${trip.id}`,'DELETE',undefined,device.cookie,trip.revision);assert.equal((await api('/trips','GET',undefined,b.cookie)).data.trips.length,1);
  console.log('PASS: import duplicates isolated per account; delete affects only the owner');
}catch(error){console.error(error instanceof assert.AssertionError?`FAIL: ${error.message}`:`FAIL: ${error.code||'account QA error; secrets omitted'}`);process.exitCode=1;}
finally{
  try{await transaction(pool,async client=>{
    const {rows}=await client.query('SELECT id FROM public.app_users WHERE username=ANY($1::text[])',[names]);const users=rows.map(u=>u.id);
    await client.query('DELETE FROM public.expense_splits WHERE expense_id IN (SELECT e.id FROM public.expenses e JOIN public.trips t ON t.id=e.trip_id WHERE t.owner_id=ANY($1::bigint[]))',[users]);
    await client.query('DELETE FROM public.expenses WHERE trip_id IN (SELECT id FROM public.trips WHERE owner_id=ANY($1::bigint[]))',[users]);await client.query('DELETE FROM public.members WHERE trip_id IN (SELECT id FROM public.trips WHERE owner_id=ANY($1::bigint[]))',[users]);await client.query('DELETE FROM public.trips WHERE owner_id=ANY($1::bigint[])',[users]);await client.query('DELETE FROM public.app_users WHERE id=ANY($1::bigint[])',[users]);
    await client.query('DELETE FROM public.auth_limits WHERE key=ANY($1::text[])',[[`register:${ip}`,`login-ip:${ip}`,...names.map(n=>`login-user:${n}`)].map(tokenHash)]);
  });if(baseline){assert.deepEqual(await snapshot(),baseline);console.log('PASS: all QA accounts/sessions/trips cleaned; original 4-table data unchanged');}}
  catch{console.error('QA cleanup needs review');process.exitCode=1;}
  if(server)await new Promise(resolve=>server.close(resolve));await pool.end();
}
