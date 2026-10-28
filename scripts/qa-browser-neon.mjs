// Uses a separate Edge debug profile. Real Neon QA rows are uniquely named and removed.
import dotenv from 'dotenv';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createPool, transaction } from '../server/database.js';
import { createStore } from '../server/store.js';
import { createApp } from '../server.js';
dotenv.config({path:process.env.TRIPSPLIT_ENV_FILE||'.env',quiet:true});
const pool=createPool(process.env.DATABASE_URL||process.env.DATABAST_URL), store=createStore(pool);
const marker=`TripSplit_Browser_QA_${randomUUID()}`;
const names=[marker,`${marker}_edited`,`${marker}_import`];
const server=createApp({storeFactory:()=>store}).listen(3014,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
let ws,call,baseline;
try{
  baseline=await store.list();
  const target=await(await fetch('http://127.0.0.1:9231/json/new?about:blank',{method:'PUT'})).json();
  ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  let seq=0;const pending=new Map();
  ws.onmessage=event=>{const m=JSON.parse(event.data);if(pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}};
  call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  async function run(expression){const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error('Browser expression failed');return r.result.value;}
  async function wait(expression){for(let i=0;i<200;i++){if(await run(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error(`Timed out: ${expression}`);}
  const click=selector=>run(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const fill=(selector,value)=>run(`document.querySelector(${JSON.stringify(selector)}).value=${JSON.stringify(value)}`);
  const ready=()=>wait(`!!document.querySelector('#app')&&!document.querySelector('#app').hasAttribute('aria-busy')`);
  async function go(hash,selector){await run(`location.hash=${JSON.stringify(hash)}`);await wait(`location.hash===${JSON.stringify(hash)} && !!document.querySelector(${JSON.stringify(selector)}) && !document.querySelector('#app').hasAttribute('aria-busy')`);}
  async function submit(selector,next){await run(`document.querySelector(${JSON.stringify(selector)}).requestSubmit()`);await wait(`!!document.querySelector(${JSON.stringify(next)})&&!document.querySelector('#app').hasAttribute('aria-busy')`);}
  await call('Network.enable');
  await call('Page.navigate',{url:'http://127.0.0.1:3014/#create'});await wait(`!!document.querySelector('#trip-form')`);await ready();
  await run(`localStorage.setItem('tripsplit.qa-preserve','keep')`);
  await fill('[name=name]',marker);await fill('[name=startDate]','2026-10-21');await fill('[name=endDate]','2026-10-23');
  await run(`document.querySelectorAll('[name=participant]')[0].value='윤주';document.querySelectorAll('[name=participant]')[1].value='서영'`);await click('#add-participant');await run(`document.querySelectorAll('[name=participant]')[2].value='시우'`);
  await submit('#trip-form','#expense-list');const hash=await run('location.hash'),id=hash.split('/')[1];assert.match(id,/^\d+$/);
  await go(`#expense/${id}`,'#expense-form');assert.equal(await run(`document.querySelector('[name=category]').value`),'식비');
  await fill('[name=name]','대게');await fill('[name=amount]','92000');await fill('[name=category]','식비');await submit('#expense-form','#expense-list');
  let trip=(await store.list()).find(t=>t.id===id);assert.equal(trip.expenses[0].amount,92000);assert.deepEqual(Object.values(trip.expenses[0].shares).sort(),[30666,30667,30667]);
  await go(`#settlement/${id}`,'tbody');assert.ok((await run(`document.querySelector('tbody').textContent`)).includes('30,666원'));
  await go('#trips','.trip-card');await click(`[data-trip-action="edit"][data-trip-id="${id}"]`);
  await fill('#trip-edit-form [name=name]',names[1]);await run(`document.querySelector('[data-participants] input').value='윤주 수정'`);
  await click('[data-participants] button');assert.ok((await run(`document.querySelector('.trip-dialog .error').textContent`)).includes('기존 지출'));
  await run(`document.querySelector('#trip-edit-form').requestSubmit()`);await wait(`!document.querySelector('.trip-dialog')&&!document.querySelector('#app').hasAttribute('aria-busy')`);
  let updated=(await store.list()).find(t=>t.id===id);assert.equal(updated.participants[0].id,trip.participants[0].id);assert.deepEqual(updated.expenses,trip.expenses);
  await go(`#expense/${id}/${trip.expenses[0].id}`,'#expense-form');await fill('[name=amount]','10001');await fill('[name=category]','카페·간식');await submit('#expense-form','#expense-list');
  await call('Page.reload');await wait(`!!document.querySelector('.expense-category')&&!document.querySelector('#app').hasAttribute('aria-busy')`);assert.equal(await run(`document.querySelector('.expense-category').textContent`),'카페·간식');
  for(const width of [390,1280]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
    await go(`#expense/${id}/${trip.expenses[0].id}`,'#expense-form');
    assert.ok(await run(`document.documentElement.scrollWidth<=innerWidth`));assert.equal(await run(`document.querySelector('[name=category]').value`),'카페·간식');
    await run(`scrollTo(0,0)`);await mkdir('test-results',{recursive:true});const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(`test-results/${width}-neon-expense.png`,Buffer.from(shot.data,'base64'));
    await go(`#dashboard/${id}`,'#expense-list');
  }
  await run(`window.confirm=()=>true`);await click('[data-delete]');await wait(`document.querySelector('#expense-list')?.textContent.includes('아직 등록된 지출')&&!document.querySelector('#app').hasAttribute('aria-busy')`);
  assert.equal((await store.list()).find(t=>t.id===id).expenses.length,0);
  await go('#trips','.trip-card');await click(`[data-trip-action="delete"][data-trip-id="${id}"]`);await click('[data-confirm]');await wait(`!document.querySelector('.trip-dialog')&&!document.querySelector('#app').hasAttribute('aria-busy')`);assert.ok(!(await store.list()).some(t=>t.id===id));
  // Import only the separate QA profile's fixture, with explicit confirmation.
  const legacy={id:randomUUID(),name:names[2],startDate:'2026-10-21',endDate:'2026-10-23',participants:[{id:randomUUID(),name:'기존 참여자'}],expenses:[]};
  await run(`localStorage.setItem('tripsplit.v1',${JSON.stringify(JSON.stringify({version:1,trips:[legacy]}))});window.confirm=()=>false`);
  await click('[data-import-local]');await new Promise(r=>setTimeout(r,150));assert.equal((await store.list()).length,baseline.length);
  await run(`window.confirm=()=>true`);await click('[data-import-local]');await wait(`document.querySelector('#trips')?.textContent.includes(${JSON.stringify(names[2])})&&!document.querySelector('#app').hasAttribute('aria-busy')`);
  assert.equal(await run(`localStorage.getItem('tripsplit.qa-preserve')`),'keep');assert.equal(JSON.parse(await run(`localStorage.getItem('tripsplit.v1')`)).trips[0].id,legacy.id);
  // Simulate server connection failure; no fallback writes or local data removal.
  await call('Fetch.enable',{patterns:[{urlPattern:'*api/trips',requestStage:'Request'}]});
  const listener=async event=>{const m=JSON.parse(event.data);if(m.method==='Fetch.requestPaused')await call('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:503,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify({error:'Neon 연결을 확인해 주세요.'})).toString('base64')});};
  ws.addEventListener('message',listener);await call('Page.reload');await wait(`!!document.querySelector('#retry-load')`);assert.ok((await run(`document.querySelector('#app').textContent`)).includes('Neon 연결'));
  await call('Fetch.disable');ws.removeEventListener('message',listener);await click('#retry-load');await wait(`!!document.querySelector('#trips')&&!document.querySelector('#app').hasAttribute('aria-busy')`);
  console.log('PASS: real browser + Neon creation, categories, edit/delete, rounding, protected member, reload, import confirmation, error/retry, 390/1280px UI');
}catch(error){console.error(error instanceof assert.AssertionError?`FAIL: ${error.message}`:`FAIL: ${error.message?.startsWith('Timed out:')?error.message:'browser or DB verification error; secrets omitted'}`);process.exitCode=1;}
finally{
  try{
    await transaction(pool,async client=>{
      const {rows}=await client.query('SELECT id::text FROM public.trips WHERE name=ANY($1::text[])',[names]);const ids=rows.map(t=>t.id);
      await client.query('DELETE FROM public.expense_splits WHERE expense_id IN (SELECT id FROM public.expenses WHERE trip_id::text=ANY($1::text[]))',[ids]);
      await client.query('DELETE FROM public.expenses WHERE trip_id::text=ANY($1::text[])',[ids]);await client.query('DELETE FROM public.members WHERE trip_id::text=ANY($1::text[])',[ids]);await client.query('DELETE FROM public.trips WHERE id::text=ANY($1::text[])',[ids]);
    });
    if(baseline){assert.deepEqual(await store.list(),baseline);console.log('PASS: browser QA records cleaned; pre-existing trips unchanged');}
  }catch{console.error('Browser QA cleanup needs review');process.exitCode=1;}
  if(call)await call('Page.close').catch(()=>{});ws?.close();await new Promise(resolve=>server.close(resolve));await pool.end();
}
