// Read-only UI regression: delayed/missing API data is simulated locally.
import assert from 'node:assert/strict';
import { createApp } from '../server.js';
let resolveRead,rejectRead;
const server=createApp({accountFactory:()=>({current:async()=>({id:'1',username:'test'})}),storeFactory:()=>({list:()=>new Promise((resolve,reject)=>{resolveRead=resolve;rejectRead=reject;})})}).listen(3021,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
let ws,call;
try{
  const target=await(await fetch('http://127.0.0.1:9231/json/new?http://127.0.0.1:3021/',{method:'PUT'})).json();
  ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  let seq=0;const pending=new Map();
  ws.onmessage=event=>{const m=JSON.parse(event.data);if(pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}};
  call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  async function run(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true});if(r.exceptionDetails)throw Error('Browser expression failed');return r.result.value;}
  async function wait(expression){for(let i=0;i<150;i++){if(await run(expression))return;await new Promise(resolve=>setTimeout(resolve,100));}throw Error('Browser wait timed out');}
  await wait(`!!document.querySelector('[data-loading-trips]')`);
  assert.ok((await run(`document.querySelector('#app').textContent`)).includes('여행 경비 정산'));
  assert.equal(await run(`document.querySelector('#app').getAttribute('aria-busy')`),'true');
  assert.equal(await run(`!!document.querySelector('.trip-grid')`),false);
  assert.ok(resolveRead);resolveRead([]);
  await wait(`!document.querySelector('#app').hasAttribute('aria-busy')`);
  assert.ok((await run(`document.querySelector('#trips').textContent`)).includes('함께 떠날 여행'));
  resolveRead=null;await call('Page.reload');await wait(`!!document.querySelector('[data-loading-trips]')`);assert.ok(rejectRead);rejectRead(Error('Simulated database outage'));
  await wait(`!!document.querySelector('#retry-load')`);assert.ok((await run(`document.querySelector('[role=alert]').textContent`)).includes('Neon'));
  await run(`document.querySelector('#retry-load').click()`);await wait(`!!document.querySelector('[data-loading-trips]')`);resolveRead([]);await wait(`!document.querySelector('#app').hasAttribute('aria-busy')`);
  console.log('PASS: existing landing visible before API resolves; correct loading/empty/error/retry states; no DB writes');
}finally{if(call)await call('Page.close').catch(()=>{});ws?.close();await new Promise(resolve=>server.close(resolve));}
