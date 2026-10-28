import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server.js';
import { transaction } from '../server/database.js';
import { expenseShares, summarize } from '../js/calculations.js';
test('메인 공개·개인 API 보호, 비밀 파일 차단 및 쓰기 요청 검증',async()=>{
  const server=createApp({accountFactory:()=>({current:async token=>token?{id:'1',username:'test'}:null}),storeFactory:()=>({list:async()=>[],create:async()=>({id:'1'})})}).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try{
    const home=await fetch(base);assert.equal(home.status,200);assert.ok((await home.text()).includes('id="app"'));
    assert.equal(home.headers.get('www-authenticate'),null);assert.equal(home.headers.get('set-cookie'),null);
    assert.equal((await fetch(`${base}/api/trips`)).status,401);
    const headers={'Content-Type':'application/json','X-Requested-With':'TripSplit',Cookie:'tripsplit_session='+ 'a'.repeat(43)};
    const list=await fetch(`${base}/api/trips`,{headers});assert.equal(list.status,200);assert.deepEqual(await list.json(),{trips:[]});
    for(const file of ['.env','server/database.js','access.html','access.js','api/access'])assert.equal((await fetch(`${base}/${file}`,{headers})).status,404);
    assert.equal((await fetch(`${base}/api/trips`,{method:'POST'})).status,403);
    assert.equal((await fetch(`${base}/api/trips`,{method:'POST',headers,body:'{}'})).status,201);
    assert.equal((await fetch(`${base}/api/trips`,{method:'POST',headers,body:'{bad'})).status,400);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
test('연결 오류 원문 비공개',async()=>{
  const server=createApp({accountFactory:()=>({current:async()=>({id:'1',username:'test'})}),storeFactory:()=>({list:async()=>{throw Error('secret database connection');}})}).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  try{const response=await fetch(`http://127.0.0.1:${server.address().port}/api/trips`);assert.equal(response.status,503);assert.ok(!(await response.text()).includes('secret database connection'));}
  finally{await new Promise(resolve=>server.close(resolve));}
});
test('트랜잭션 실패 시 rollback 및 연결 반환',async()=>{
  const calls=[];const client={query:async sql=>calls.push(sql),release:()=>calls.push('release')};
  await assert.rejects(()=>transaction({connect:async()=>client},async()=>{throw Error('failure');}));
  assert.deepEqual(calls,['BEGIN','ROLLBACK','release']);
});
test('Neon에 저장된 부담 금액을 재분배하지 않고 정산에 사용',()=>{
  const trip={participants:[{id:'1',name:'가'},{id:'2',name:'나'}],expenses:[{amount:3,payer:'1',beneficiaries:['1','2'],shares:{'1':1,'2':2}}]};
  assert.deepEqual(summarize(trip).members.map(p=>p.owed),[1,2]);
  assert.throws(()=>expenseShares(trip,{...trip.expenses[0],shares:{'1':1,'2':1}}));
});
