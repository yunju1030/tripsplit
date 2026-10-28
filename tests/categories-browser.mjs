// Run only in a dedicated test browser profile: this replaces test-origin data.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const target=await(await fetch('http://127.0.0.1:9231/json/new?http://127.0.0.1:3012/#trips',{method:'PUT'})).json();
const ws=new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
let seq=0;const pending=new Map();
ws.onmessage=event=>{const m=JSON.parse(event.data);if(pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}};
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
async function run(expression){const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function wait(expression){for(let i=0;i<100;i++){if(await run(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error(`Timed out: ${expression}`);}
const click=selector=>run(`document.querySelector(${JSON.stringify(selector)}).click()`);
const fill=(selector,value)=>run(`document.querySelector(${JSON.stringify(selector)}).value=${JSON.stringify(value)}`);
const go=async hash=>{await run(`location.hash=${JSON.stringify(hash)}`);await wait(`location.hash===${JSON.stringify(hash)} && !!document.querySelector('${hash.startsWith('#expense')?'#expense-form':hash.startsWith('#settlement')?'tbody':'#expense-list'}')`);};
const saved=()=>run(`JSON.parse(localStorage.getItem('tripsplit.v1')).trips[0]`);
const categories=['식비','카페·간식','교통비','숙박비','관광·액티비티','쇼핑','기타'];
try{
  await wait(`!!document.querySelector('#trips')`);
  await run(`localStorage.setItem('tripsplit.v1',JSON.stringify({version:1,trips:[{id:'category-trip',name:'강릉',startDate:'2026-10-21',endDate:'2026-10-23',participants:[{id:'a',name:'윤주'},{id:'b',name:'서영'},{id:'c',name:'시우'}],expenses:[{id:'legacy',name:'기존 식사',date:'2026-10-22',amount:92000,payer:'a',beneficiaries:['a','b','c']}]}]}));location.hash='#dashboard/category-trip'`);
  await wait(`!!document.querySelector('.expense-category')`);
  assert.equal(await run(`document.querySelector('.expense-category').textContent`),'기타');
  await go('#settlement/category-trip');const settlement=await run(`document.querySelector('tbody').textContent`);
  for(const width of [390,1280]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
    for(const edit of [false,true]){
      await go(`#expense/category-trip${edit?'/legacy':''}`);
      assert.equal(await run(`document.querySelector('[name=category]').value`),edit?'기타':'식비');
      assert.deepEqual(await run(`Array.from(document.querySelector('[name=category]').options,o=>o.value)`),categories);
      assert.ok(await run(`(()=>{const e=document.querySelector('#expense-category');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect(),s=getComputedStyle(e);return s.display!=='none'&&s.visibility!=='hidden'&&r.width>100&&r.height>30&&r.left>=0&&r.right<=innerWidth&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e&&document.documentElement.scrollWidth<=innerWidth})()`));
      // Real input events on the visible native dropdown, not setting its value.
      const rect=await run(`(()=>{const r=document.querySelector('#expense-category').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
      await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...rect});await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...rect});
      for(const key of ['Home','ArrowDown','Enter']){await call('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,windowsVirtualKeyCode:key==='Home'?36:key==='ArrowDown'?40:13});await call('Input.dispatchKeyEvent',{type:'keyUp',key,code:key,windowsVirtualKeyCode:key==='Home'?36:key==='ArrowDown'?40:13});}
      assert.equal(await run(`document.querySelector('[name=category]').value`),'카페·간식');
      await mkdir('test-results',{recursive:true});const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(`test-results/${width}-category-${edit?'edit':'create'}.png`,Buffer.from(shot.data,'base64'));
    }
  }
  for(const category of categories){
    await go('#dashboard/category-trip');await go('#expense/category-trip/legacy');
    const previous=(await saved()).expenses[0].category||'기타';assert.equal(await run(`document.querySelector('[name=category]').value`),previous);
    await fill('[name=category]',category);await run(`document.querySelector('#expense-form').requestSubmit()`);await wait(`!!document.querySelector('#expense-list')`);
    assert.equal((await saved()).expenses[0].category,category);assert.equal(await run(`document.querySelector('.expense-category').textContent`),category);
  }
  await go('#settlement/category-trip');assert.equal(await run(`document.querySelector('tbody').textContent`),settlement);
  await go('#expense/category-trip');await fill('[name=name]','KTX');await fill('[name=amount]','96000');await fill('[name=category]','교통비');await run(`document.querySelector('#expense-form').requestSubmit()`);await wait(`!!document.querySelector('#expense-list')`);
  const added=(await saved()).expenses.find(e=>e.name==='KTX');assert.equal(added.category,'교통비');
  await go(`#expense/category-trip/${added.id}`);assert.equal(await run(`document.querySelector('[name=category]').value`),'교통비');
  await call('Page.reload');await wait(`!!document.querySelector('#expense-category')`);assert.equal(await run(`document.querySelector('[name=category]').value`),'교통비');
  await go('#dashboard/category-trip');assert.deepEqual(await run(`Array.from(document.querySelectorAll('.expense-category'),e=>e.textContent).sort()`),['교통비','기타'].sort());
  console.log('PASS: visible and unobscured dropdown in create/edit at 390/1280px, real mouse/keyboard selection, all 7 category saves, legacy fallback, badges, reload, settlement unchanged');
}finally{await call('Page.close').catch(()=>{});ws.close();}
