// 실행 중인 로컬 서버와 Edge의 개발자 프로토콜로 실제 화면 동작을 검증합니다.
// 테스트 전용 브라우저 프로필에서만 실행하세요. 해당 프로필의 TripSplit 데이터를 초기화합니다.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const debugUrl = process.env.TRIPSPLIT_DEBUG_URL || 'http://127.0.0.1:9222';
const appUrl = process.env.TRIPSPLIT_TEST_URL || 'http://127.0.0.1:3000/';
const target = await (await fetch(`${debugUrl}/json/new?${appUrl}`, { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let counter = 0;
const pending = new Map();
ws.onmessage = event => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id); pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message)); else resolve(message.result);
  }
};
function call(method, params = {}) {
  return new Promise((resolve, reject) => { const id = ++counter; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
}
async function run(expression) {
  const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function wait(expression) {
  for (let i = 0; i < 80; i++) {
    if (await run(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`화면 대기 시간 초과: ${expression}`);
}
const go = async hash => { await run(`location.hash=${JSON.stringify(hash)}`); await new Promise(resolve => setTimeout(resolve, 150)); };
const fill = (selector, value) => run(`document.querySelector(${JSON.stringify(selector)}).value=${JSON.stringify(value)}`);
const click = selector => run(`document.querySelector(${JSON.stringify(selector)}).click()`);
const submit = selector => run(`document.querySelector(${JSON.stringify(selector)}).requestSubmit()`);
try {
  await wait(`document.querySelector('#app')?.textContent.includes('여행 경비 정산')`);
  await run(`localStorage.removeItem('tripsplit.v1')`);
  await go('#create');
  await fill('[name=name]', '부산 테스트 여행'); await fill('[name=startDate]', '2026-10-27'); await fill('[name=endDate]', '2026-10-29');
  await run(`document.querySelectorAll('[name=participant]')[0].value='윤주';document.querySelectorAll('[name=participant]')[1].value='서영'`);
  await click('#add-participant'); await run(`document.querySelectorAll('[name=participant]')[2].value='임시 참여자'`);
  await run(`document.querySelectorAll('.participant-row button')[2].click()`);
  assert.equal(await run(`document.querySelectorAll('[name=participant]').length`), 2);
  await click('#add-participant'); await run(`document.querySelectorAll('[name=participant]')[2].value='시우'`);
  await submit('#trip-form'); await wait(`location.hash.startsWith('#dashboard/')`);
  const tripHash = await run('location.hash'); const tripId = tripHash.split('/')[1];
  async function add(name, amount, payerIndex, selected) {
    await go(`#expense/${tripId}`);
    assert.equal(await run(`document.querySelectorAll('[name=beneficiaries]:checked').length`), 3);
    await fill('[name=name]', name); await fill('[name=amount]', String(amount));
    await run(`document.querySelector('[name=payer]').selectedIndex=${payerIndex};document.querySelectorAll('[name=beneficiaries]').forEach((e,i)=>e.checked=${JSON.stringify(selected)}.includes(i));document.querySelector('[name=amount]').dispatchEvent(new Event('input',{bubbles:true}))`);
    await submit('#expense-form'); await wait(`location.hash.startsWith('#dashboard/')`);
  }
  await add('돼지국밥', 30000, 0, [0, 1, 2]); await add('KTX', 96000, 1, [0, 1]);
  assert.ok((await run(`document.querySelector('#app').textContent`)).includes('126,000원'));
  await go(`#settlement/${tripId}`);
  const balances = await run(`Array.from(document.querySelectorAll('tbody tr'),r=>r.textContent)`);
  assert.ok(balances[0].includes('58,000원') && balances[0].includes('28,000원'));
  assert.ok(balances[1].includes('+38,000원'));
  assert.ok(balances[2].includes('10,000원'));
  assert.equal(await run(`document.querySelectorAll('.transfer').length`), 2);
  await go(tripHash); await click('#expense-list a'); await wait(`!!document.querySelector('#expense-form')`);
  await fill('[name=amount]', '10001'); await click('#select-all');
  assert.ok((await run(`document.querySelector('#split-preview').textContent`)).includes('3,334원'));
  await submit('#expense-form'); await wait(`location.hash.startsWith('#dashboard/')`);
  await call('Page.reload'); await wait(`document.querySelector('#app')?.textContent.includes('106,001원')`);
  await run(`window.confirm=()=>false`); await click('[data-delete]');
  assert.equal(await run(`document.querySelectorAll('.expense').length`), 2);
  await run(`window.confirm=()=>true`); await click('[data-delete]');
  assert.equal(await run(`document.querySelectorAll('.expense').length`), 1);
  await go('#create'); await fill('[name=name]', '제주 테스트 여행'); await fill('[name=startDate]', '2026-11-01'); await fill('[name=endDate]', '2026-11-03');
  await run(`document.querySelectorAll('[name=participant]')[0].value='가';document.querySelectorAll('[name=participant]')[1].value='나'`);
  await submit('#trip-form'); await wait(`location.hash.startsWith('#dashboard/')`);
  assert.ok((await run(`document.querySelector('#app').textContent`)).includes('0원'));
  await go('#trips'); assert.equal(await run(`document.querySelectorAll('.trip-card').length`), 2);
  await click('.trip-card-link'); await run('history.back()'); await wait(`location.hash==='#trips'`);
  for (const width of [390, 1280]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
    for (const hash of ['#home', tripHash, `#expense/${tripId}`, `#settlement/${tripId}`]) {
      await go(hash);
      assert.ok(await run(`document.documentElement.scrollWidth<=innerWidth`), `${width}px ${hash} 가로 넘침`);
      await mkdir('test-results', { recursive: true });
      const shot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
      await writeFile(`test-results/${width}-${hash.split('/')[0].slice(1)}.png`, Buffer.from(shot.data, 'base64'));
    }
  }
  await run(`localStorage.removeItem('tripsplit.v1')`);
  console.log('PASS: 실제 Edge 화면에서 여행 생성·참여자 추가/삭제·지출 CRUD·부분 부담·정산·새로고침 유지·여행 분리·뒤로 가기·390/1280px 가로 넘침 검증');
} finally {
  await call('Page.close').catch(() => {}); ws.close();
}
