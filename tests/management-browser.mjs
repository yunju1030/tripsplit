import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const target = await (await fetch('http://127.0.0.1:9231/json/new?http://127.0.0.1:3012/#trips', {method:'PUT'})).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
let seq=0; const pending=new Map();
ws.onmessage=event=>{const m=JSON.parse(event.data);if(pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}};
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
async function run(expression){const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function wait(expression){for(let i=0;i<100;i++){if(await run(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error(`Timed out: ${expression}`);}
const click=selector=>run(`document.querySelector(${JSON.stringify(selector)}).click()`);
const fill=(selector,value)=>run(`document.querySelector(${JSON.stringify(selector)}).value=${JSON.stringify(value)}`);
const saved=()=>run(`JSON.parse(localStorage.getItem('tripsplit.v1')).trips`);
try {
  await wait(`!!document.querySelector('#trips')`);
  await run(`localStorage.setItem('tripsplit.v1',JSON.stringify({version:1,trips:['one','two'].map(id=>({id,name:'강릉',startDate:'2026-10-21',endDate:'2026-10-23',participants:[{id:'a',name:'윤주'},{id:'b',name:'서영'},{id:'c',name:'시우'}],expenses:[{id:'e',name:'식사',date:'2026-10-22',amount:10001,category:'기타',payer:'a',beneficiaries:['a','b']}]}))}));location.reload()`);
  await wait(`document.querySelectorAll('.trip-card').length===2`);
  const before=await saved();
  await click('.trip-menu-trigger'); assert.equal(await run(`document.querySelector('.trip-menu').hidden`),false);
  await click('[data-trip-action="edit"]'); await wait(`!!document.querySelector('#trip-edit-form')`);
  assert.equal(await run(`document.querySelector('#trip-edit-form [name=name]').value`),'강릉');
  await fill('#trip-edit-form [name=name]','취소할 이름'); await click('[data-cancel]'); assert.deepEqual(await saved(),before);
  await click('.trip-menu-trigger'); await click('[data-trip-action="edit"]');
  await fill('#trip-edit-form [name=name]','부산 여행'); await fill('[name=startDate]','2026-10-20'); await fill('[name=endDate]','2026-10-24');
  await fill('[data-id="a"] input','윤주 수정');
  await click('[data-id="a"] button'); assert.equal(await run(`document.querySelectorAll('[data-participants] .participant-row').length`),3);
  assert.ok((await run(`document.querySelector('.trip-dialog .error').textContent`)).includes('지출'));
  await click('[data-id="b"] button'); assert.equal(await run(`document.querySelectorAll('[data-participants] .participant-row').length`),3);
  await click('[data-id="c"] button'); await click('[data-add]');
  await run(`document.querySelector('[data-participants]').lastElementChild.querySelector('input').value='새 참여자'`);
  await run(`document.querySelector('#trip-edit-form').requestSubmit()`);
  await wait(`!document.querySelector('.trip-dialog')`);
  const after=await saved(); const edited=after.find(t=>t.id==='two');
  assert.equal(edited.name,'부산 여행'); assert.equal(edited.startDate,'2026-10-20'); assert.equal(edited.endDate,'2026-10-24'); assert.equal(edited.participants[0].id,'a'); assert.equal(edited.participants[0].name,'윤주 수정'); assert.deepEqual(edited.expenses,before[1].expenses); assert.deepEqual(after[0],before[0]);
  await click('.trip-card-link'); await wait(`location.hash==='#dashboard/two'`);
  assert.ok((await run(`document.querySelector('#app').textContent`)).includes('부산 여행'));
  await run(`location.hash='#expense/two'`); await wait(`!!document.querySelector('#expense-form')`);
  assert.ok((await run(`document.querySelector('[name=payer]').textContent`)).includes('새 참여자'));
  await run(`location.hash='#settlement/two'`); await wait(`!!document.querySelector('tbody')`);
  assert.ok((await run(`document.querySelector('tbody').textContent`)).includes('5,001원'));
  await run(`location.hash='#trips'`); await wait(`!!document.querySelector('.trip-menu-trigger')`);
  await call('Page.reload'); await wait(`document.querySelectorAll('.trip-card').length===2`);
  assert.ok((await run(`document.querySelector('.trip-card').textContent`)).includes('부산 여행'));
  for(const width of [390,1280]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});
    await click('.trip-menu-trigger'); await click('[data-trip-action="edit"]');
    assert.ok(await run(`document.documentElement.scrollWidth<=innerWidth`));
    assert.ok(await run(`document.querySelector('.trip-dialog').getBoundingClientRect().right<=innerWidth`));
    await mkdir('test-results',{recursive:true});const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(`test-results/${width}-trip-edit.png`,Buffer.from(shot.data,'base64'));
    await click('[data-cancel]');
  }
  await click('.trip-menu-trigger'); await click('[data-trip-action="delete"]'); await click('[data-cancel]'); assert.equal((await saved()).length,2);
  await click('.trip-menu-trigger'); await click('[data-trip-action="delete"]');
  assert.ok((await run(`document.querySelector('.trip-dialog').textContent`)).includes('복구할 수 없습니다'));
  await click('[data-confirm]'); assert.equal(await run(`document.querySelectorAll('.trip-card').length`),1);
  assert.deepEqual(await saved(),[before[0]]);
  await call('Page.reload'); await wait(`document.querySelectorAll('.trip-card').length===1`); assert.deepEqual(await saved(),[before[0]]);
  console.log('PASS: real trip menu, populated modal, cancel, edit, protected participants, new participant selection, settlement, delete isolation, reload persistence, 390/1280px layout');
} finally { await call('Page.close').catch(()=>{}); ws.close(); }
