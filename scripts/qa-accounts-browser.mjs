import dotenv from 'dotenv';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {createPool,transaction} from '../server/database.js';
import {createStore} from '../server/store.js';
import {createAccounts} from '../server/accounts.js';
import {createApp} from '../server.js';
dotenv.config({path:process.env.TRIPSPLIT_ENV_FILE||'.env',quiet:true});
const pool=createPool(process.env.DATABASE_URL),tag=randomBytes(5).toString('hex'),names=[`qa_ui_a_${tag}`,`qa_ui_b_${tag}`],password=randomUUID();
const server=createApp({storeFactory:id=>createStore(pool,id),accountFactory:()=>createAccounts(pool),config:{}}).listen(3014,'127.0.0.1');await new Promise(r=>server.once('listening',r));
let ws,call,baseline;
async function snapshot(){const result={};for(const table of ['trips','members','expenses','expense_splits'])result[table]=createHash('sha256').update(JSON.stringify((await pool.query(`SELECT * FROM public.${table} ORDER BY id`)).rows)).digest('hex');return result;}
try{
  baseline=await snapshot();
  const target=await(await fetch('http://127.0.0.1:9231/json/new?http://127.0.0.1:3014/',{method:'PUT'})).json();ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  let seq=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error('Browser command failed')):p.resolve(m.result);}};
  call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  async function run(expression){const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error('Browser expression failed');return r.result.value;}
  async function wait(expression){for(let i=0;i<200;i++){if(await run(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Browser wait timed out');}
  const click=s=>run(`document.querySelector(${JSON.stringify(s)}).click()`);
  const fill=(s,v)=>run(`document.querySelector(${JSON.stringify(s)}).value=${JSON.stringify(v)}`);
  async function go(hash,selector){await run(`location.hash=${JSON.stringify(hash)}`);await wait(`location.hash===${JSON.stringify(hash)}&&!!document.querySelector(${JSON.stringify(selector)})&&!document.querySelector('#app').hasAttribute('aria-busy')`);}
  async function submit(s,next){await run(`document.querySelector(${JSON.stringify(s)}).requestSubmit()`);await wait(`!!document.querySelector(${JSON.stringify(next)})&&!document.querySelector('#app').hasAttribute('aria-busy')`);}
  await wait(`!!document.querySelector('.account-controls a')`);await go('#signup','#account-form');assert.equal(await run(`document.querySelectorAll('#account-form input').length`),2);
  for(const width of [390,1280]){await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});assert.ok(await run(`document.documentElement.scrollWidth<=innerWidth`));await mkdir('test-results',{recursive:true});const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(`test-results/${width}-signup.png`,Buffer.from(shot.data,'base64'));}
  await fill('[name=username]',names[0]);await fill('[name=password]',password);await submit('#account-form','#trips');assert.equal(await run(`document.cookie.includes('tripsplit_session')`),false);
  await go('#create','#trip-form');await fill('[name=name]',`A private ${tag}`);await fill('[name=startDate]','2026-10-21');await fill('[name=endDate]','2026-10-23');await run(`document.querySelectorAll('[name=participant]')[0].value='가';document.querySelectorAll('[name=participant]')[1].value='나'`);await submit('#trip-form','#expense-list');const aHash=await run('location.hash'),id=aHash.split('/')[1];
  await go(`#expense/${id}`,'#expense-form');await fill('[name=name]','식사');await fill('[name=amount]','10001');await fill('[name=category]','식비');await submit('#expense-form','#expense-list');assert.ok((await run(`document.querySelector('#app').textContent`)).includes('10,001원'));
  await click('[data-logout]');await wait(`!!document.querySelector('.account-controls a')&&!document.querySelector('#app').hasAttribute('aria-busy')`);assert.equal(await run(`fetch('/api/trips').then(r=>r.status)`),401);
  await go('#signup','#account-form');await fill('[name=username]',names[1]);await fill('[name=password]',password);await submit('#account-form','#trips');assert.equal(await run(`document.querySelectorAll('.trip-card').length`),0);
  await run(`location.hash=${JSON.stringify(aHash)}`);await wait(`!!document.querySelector('#retry-load')`);assert.ok(!(await run(`document.querySelector('#app').textContent`)).includes(`A private ${tag}`));
  await go('#create','#trip-form');await fill('[name=name]',`B private ${tag}`);await fill('[name=startDate]','2026-10-21');await fill('[name=endDate]','2026-10-23');await run(`document.querySelectorAll('[name=participant]')[0].value='다';document.querySelectorAll('[name=participant]')[1].value='라'`);await submit('#trip-form','#expense-list');
  await click('[data-logout]');await wait(`!!document.querySelector('.account-controls a')&&!document.querySelector('#app').hasAttribute('aria-busy')`);await go('#login','#account-form');await fill('[name=username]',names[0]);await fill('[name=password]',password);await submit('#account-form','#trips');const text=await run(`document.querySelector('#trips').textContent`);assert.ok(text.includes(`A private ${tag}`));assert.ok(!text.includes(`B private ${tag}`));
  await call('Page.reload');await wait(`!!document.querySelector('.trip-card')&&!document.querySelector('#app').hasAttribute('aria-busy')`);assert.ok((await run(`document.querySelector('#trips').textContent`)).includes(`A private ${tag}`));
  await go(`#settlement/${id}`,'tbody');assert.ok((await run(`document.querySelector('tbody').textContent`)).includes('5,001원'));
  console.log('PASS: 2-field signup/auto-login, 390/1280px UI, private travel creation, logout, second account isolation, re-login/reload persistence, settlement');
}catch(error){console.error(error instanceof assert.AssertionError?`FAIL: ${error.message}`:`FAIL: ${error.message||'browser account test'}`);process.exitCode=1;}
finally{
  try{await transaction(pool,async c=>{const {rows}=await c.query('SELECT id FROM public.app_users WHERE username=ANY($1::text[])',[names]);const users=rows.map(u=>u.id);await c.query('DELETE FROM public.expense_splits WHERE expense_id IN (SELECT e.id FROM public.expenses e JOIN public.trips t ON t.id=e.trip_id WHERE t.owner_id=ANY($1::bigint[]))',[users]);await c.query('DELETE FROM public.expenses WHERE trip_id IN (SELECT id FROM public.trips WHERE owner_id=ANY($1::bigint[]))',[users]);await c.query('DELETE FROM public.members WHERE trip_id IN (SELECT id FROM public.trips WHERE owner_id=ANY($1::bigint[]))',[users]);await c.query('DELETE FROM public.trips WHERE owner_id=ANY($1::bigint[])',[users]);await c.query('DELETE FROM public.app_users WHERE id=ANY($1::bigint[])',[users]);});if(baseline){assert.deepEqual(await snapshot(),baseline);console.log('PASS: browser QA accounts and rows removed, original data unchanged');}}
  catch{console.error('Browser QA cleanup needs review');process.exitCode=1;}
  if(call)await call('Page.close').catch(()=>{});ws?.close();await new Promise(r=>server.close(r));await pool.end();
}
