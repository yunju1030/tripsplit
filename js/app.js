import { CATEGORIES, categoryOf } from './categories.js';
import { installTripManagement } from './trip-management.js';
import { createApiRepository } from './api-storage.js';
import { splitExpense, expenseShares, summarize } from './calculations.js';

const app = document.querySelector('#app');
const repository = createApiRepository();
let routeVersion = 0;
const money = amount => `${amount.toLocaleString('ko-KR')}원`;
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => crypto.randomUUID();
const url = (page, trip, expense) => `#${page}${trip ? '/' + encodeURIComponent(trip) : ''}${expense ? '/' + encodeURIComponent(expense) : ''}`;
const link = (text, href, kind = '') => `<a class="btn ${kind}" href="${href}">${text}</a>`;
const avatar = name => `<span class="avatar" aria-hidden="true">${escape(Array.from(name)[0])}</span>`;
const period = trip => `${trip.startDate.replaceAll('-', '.')} ~ ${trip.endDate.replaceAll('-', '.')}`;
let currentTrip;
let toastTimer;
function toast(message) {
  const box = document.querySelector('#toast');
  box.textContent = message; box.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { box.hidden = true; }, 3200);
}
function formError(error) {
  const box = document.querySelector('#form-error');
  box.textContent = error.message; box.hidden = false; box.focus();
}
function heading(title, subtitle, actions = '') {
  return `<div class="banner"><div class="row"><div><span class="tag">함께 떠나고, 편하게 나누고</span><h1 style="margin-top:12px">${escape(title)}</h1><p class="muted" style="margin-bottom:0">${escape(subtitle)}</p></div><div class="actions">${actions}</div></div></div>`;
}
function stats(trip, summary) {
  return `<div class="stats"><div class="card stat"><span class="muted">여행 전체 지출</span><strong class="money">${money(summary.total)}</strong></div><div class="card stat"><span class="muted">등록된 지출</span><strong>${trip.expenses.length}건</strong></div><div class="card stat"><span class="muted">함께하는 참여자</span><strong class="teal">${trip.participants.length}명</strong></div></div>`;
}
function tripList() {
  const trips = repository.list().slice().reverse();
  return `<section id="trips" class="section-space"><div class="row"><h2>내 여행 목록 <span class="muted">${trips.length}</span></h2>${link('+ 새 여행 만들기', '#create', 'primary')}</div>${trips.length ? `<div class="trip-grid">${trips.map(t => `<article class="card trip-card"><div class="trip-menu-wrap"><button class="btn trip-menu-trigger" type="button" data-trip-menu aria-label="${escape(t.name)} 여행 관리" aria-expanded="false">⋯</button><div class="trip-menu" hidden><button type="button" data-trip-action="edit" data-trip-id="${escape(t.id)}">여행 정보 수정</button><button type="button" class="danger" data-trip-action="delete" data-trip-id="${escape(t.id)}">여행 삭제</button></div></div><a class="trip-card-link" href="${url('dashboard', t.id)}"><span class="tag">참여자 ${t.participants.length}명</span><h3 style="margin-top:16px">${escape(t.name)}</h3><p class="muted">${period(t)}</p><div class="row"><strong class="money">${money(summarize(t).total)}</strong><span class="teal">여행 열기 →</span></div></a></article>`).join('')}</div>` : '<div class="card empty"><h2>함께 떠날 여행을 만들어 보세요</h2><p>참여자를 등록하면 지출 기록과 정산을 바로 시작할 수 있어요.</p></div>'}<button class="btn small" type="button" data-import-local>기존 브라우저 여행 가져오기</button><p class="notice">여행 기록은 Neon에 저장됩니다. 기존 브라우저 데이터는 확인 후 가져올 수 있습니다.</p></section>`;
}
function landing() {
  app.innerHTML = document.querySelector('#landing-template').innerHTML + `<div class="wrap" style="padding-top:0">${tripList()}</div>`;
}
function createTrip() {
  app.innerHTML = `<div class="wrap"><a class="back" href="#trips">← 내 여행 목록</a>${heading('새 여행 만들기', '여행의 이름과 함께할 사람들을 알려 주세요.')}<form id="trip-form" class="card" style="max-width:760px;margin:auto"><div id="form-error" class="error" role="alert" tabindex="-1" hidden></div><label class="field">여행 이름<input name="name" placeholder="예: 부산 여행" required maxlength="100" autofocus></label><div class="form-grid"><label class="field">시작일<input type="date" name="startDate" required></label><label class="field">종료일<input type="date" name="endDate" required></label></div><fieldset><legend>여행 참여자</legend><p class="muted">한 명씩 이름을 입력해 주세요. 참여자는 원하는 만큼 추가할 수 있어요.</p><div id="participants"></div><button class="btn" type="button" id="add-participant">+ 참여자 추가</button></fieldset><p class="notice">같은 이름은 별명 등으로 구분해 주세요.</p><div class="actions" style="margin-top:24px">${link('취소', '#trips')}<button class="btn primary" type="submit">여행 만들기 →</button></div></form></div>`;
  const container = document.querySelector('#participants');
  let participantNumber = 0;
  function addParticipant() {
    participantNumber++;
    const row = document.createElement('div'); row.className = 'participant-row';
    row.innerHTML = `<input name="participant" aria-label="참여자 ${participantNumber} 이름" placeholder="참여자 이름" required maxlength="50"><button class="btn danger small" type="button" aria-label="이 참여자 삭제">삭제</button>`;
    row.querySelector('button').onclick = () => { row.remove(); };
    container.append(row); row.querySelector('input').focus();
  }
  addParticipant(); addParticipant();
  document.querySelector('[name=name]').focus();
  document.querySelector('#add-participant').onclick = addParticipant;
  document.querySelector('[name=startDate]').oninput = event => { document.querySelector('[name=endDate]').min = event.target.value; };
  document.querySelector('#trip-form').onsubmit = async event => {
    event.preventDefault();
    const saveButton = event.submitter || event.target.querySelector('[type=submit]');
    if (saveButton.disabled) return;
    saveButton.disabled = true;
    try {
      const data = new FormData(event.target);
      const trip = { id: uid(), name: data.get('name').trim(), startDate: data.get('startDate'), endDate: data.get('endDate'), participants: data.getAll('participant').map(name => ({ id: uid(), name: name.trim() })), expenses: [] };
      const created = await repository.save(trip); location.hash = url('dashboard', created.id); toast('새 여행을 만들었어요.');
    } catch (error) { formError(error); } finally { saveButton.disabled = false; }
  };
}
function dashboard(trip) {
  const summary = summarize(trip);
  const names = Object.fromEntries(trip.participants.map(p => [p.id, p.name]));
  const expenses = trip.expenses.slice().sort((a, b) => b.date.localeCompare(a.date));
  app.innerHTML = `<div class="wrap"><a class="back" href="#trips">← 내 여행 목록</a>${heading(trip.name, period(trip), link('정산 결과 보기', url('settlement', trip.id)) + link('+ 지출 추가', url('expense', trip.id), 'primary'))}<div class="chips" style="margin:-8px 0 28px">${trip.participants.map(p => `<span class="chip">${avatar(p.name)}${escape(p.name)}</span>`).join('')}</div>${stats(trip, summary)}<div class="columns"><section class="card"><div class="row"><h2>지출 내역</h2><label class="actions muted">날짜순 <select id="sort" aria-label="지출 정렬 순서" style="width:auto;margin:0;padding:6px"><option value="desc">최신순</option><option value="asc">오래된순</option></select></label></div><div id="expense-list"></div></section><aside class="stack"><div class="card"><h2>참여자별 총 부담액</h2>${summary.members.map(p => `<div class="member-line">${avatar(p.name)}<span>${escape(p.name)}</span><strong class="money">${money(p.owed)}</strong></div>`).join('')}<p class="notice">각 지출에서 선택한 부담자만 나눠 부담합니다.</p></div><div class="preview"><h3>기록은 간단하게, 정산은 정확하게</h3><p class="muted">지출을 모두 등록했다면 최종 정산에서 송금할 금액을 확인해 보세요.</p>${link('최종 정산 결과 →', url('settlement', trip.id))}</div></aside></div></div>`;
  function renderExpenses(order) {
    document.querySelector('#expense-list').innerHTML = expenses.length ? (order === 'asc' ? expenses.slice().reverse() : expenses).map(e => {
      const shares = expenseShares(trip, e);
      return `<article class="expense"><div class="row"><div class="actions">${avatar(e.name)}<div><div class="expense-title"><h3 style="margin:0">${escape(e.name)}</h3><span class="expense-category" data-category="${CATEGORIES.indexOf(categoryOf(e))}">${escape(categoryOf(e))}</span></div><span class="muted">${e.date} · ${escape(names[e.payer])} 결제</span></div></div><strong class="money">${money(e.amount)}</strong></div><div class="details">${Object.entries(shares).map(([id, amount]) => `${escape(names[id])} ${money(amount)}`).join(' · ')}</div><div class="actions" style="justify-content:flex-end;margin-top:10px">${link('수정', url('expense', trip.id, e.id), 'small')}<button class="btn danger small" type="button" data-delete="${escape(e.id)}" aria-label="${escape(e.name)} 삭제">삭제</button></div></article>`;
    }).join('') : `<div class="empty"><h3>아직 등록된 지출이 없어요</h3><p>첫 번째 지출을 기록하고 함께 나눠 보세요.</p>${link('+ 지출 추가', url('expense', trip.id), 'primary')}</div>`;
    document.querySelectorAll('[data-delete]').forEach(button => { button.onclick = async () => {
      if (!confirm('이 지출을 삭제할까요? 삭제한 내역은 복구할 수 없습니다.')) return;
      try { button.disabled = true; await repository.removeExpense(trip.id, button.dataset.delete); await route(); toast('지출을 삭제했어요.'); }
      catch (error) { button.disabled = false; toast(error.message); }
    }; });
  }
  renderExpenses('desc'); document.querySelector('#sort').onchange = e => renderExpenses(e.target.value);
}
function expenseForm(trip, expenseId) {
  const existing = expenseId ? trip.expenses.find(e => e.id === expenseId) : null;
  if (expenseId && !existing) throw new Error('지출을 찾을 수 없습니다. 대시보드에서 다시 선택해 주세요.');
  const today = new Date().toLocaleDateString('sv-SE');
  const date = existing?.date || (today < trip.startDate ? trip.startDate : today > trip.endDate ? trip.endDate : today);
  app.innerHTML = `<div class="wrap"><a class="back" href="${url('dashboard', trip.id)}">← ${escape(trip.name)} 대시보드</a>${heading(existing ? '지출 내역 수정하기' : '새로운 여행 지출 기록하기', '결제 금액과 함께 비용을 나눌 친구들을 선택해 주세요.')}<form id="expense-form"><div class="columns"><section class="card"><h2>지출 정보</h2><div id="form-error" class="error" role="alert" tabindex="-1" hidden></div><div class="form-grid"><label class="field">지출 날짜<input type="date" name="date" value="${date}" min="${trip.startDate}" max="${trip.endDate}" required></label><label class="field">결제한 사람<select name="payer" required>${trip.participants.map(p => `<option value="${escape(p.id)}" ${p.id === existing?.payer ? 'selected' : ''}>${escape(p.name)}</option>`).join('')}</select></label></div><label class="field">지출 항목 이름<input name="name" value="${escape(existing?.name || '')}" placeholder="예: 돼지국밥, KTX, 카페" required maxlength="100"></label><label class="field" for="expense-category">카테고리<select id="expense-category" name="category" required>${CATEGORIES.map(category => `<option value="${escape(category)}" ${category === (existing ? categoryOf(existing) : CATEGORIES[0]) ? 'selected' : ''}>${escape(category)}</option>`).join('')}</select></label><label class="field">지출 금액 (원)<input name="amount" type="number" inputmode="numeric" step="1" min="1" max="2147483647" value="${existing?.amount || ''}" placeholder="예: 30000" required aria-describedby="amount-help"></label><p id="amount-help" class="notice">원화 정수 금액을 입력해 주세요.</p><fieldset style="margin-top:24px"><legend>비용을 부담할 사람</legend><div class="check-grid">${trip.participants.map(p => `<label class="check-label"><input type="checkbox" name="beneficiaries" value="${escape(p.id)}" ${!existing || existing.beneficiaries.includes(p.id) ? 'checked' : ''}>${escape(p.name)}</label>`).join('')}</div><div class="actions" style="margin-top:12px"><button type="button" class="btn small" id="select-all">모두 선택</button><button type="button" class="btn small" id="select-none">선택 해제</button></div></fieldset></section><aside class="card"><span class="tag">자동 N분의 1 계산</span><h2 style="margin-top:18px">이렇게 나눠 부담해요</h2><div id="split-preview" aria-live="polite"></div><p class="notice">나머지 금액은 참여자 등록 순서에 따라 1원씩 배분됩니다. 선택하지 않은 사람은 0원입니다.</p><div class="actions" style="margin-top:24px"><button type="submit" class="btn primary">${existing ? '수정 내용 저장' : '지출 저장하기'}</button>${link('취소', url('dashboard', trip.id))}</div></aside></div></form></div>`;
  const form = document.querySelector('#expense-form');
  function preview() {
    const data = new FormData(form); const amount = Number(data.get('amount'));
    const ids = trip.participants.filter(p => data.getAll('beneficiaries').includes(p.id)).map(p => p.id);
    const box = document.querySelector('#split-preview');
    if (!Number.isSafeInteger(amount) || amount <= 0 || !ids.length) { box.innerHTML = '<p class="muted">1원 이상의 정수 금액과 한 명 이상의 부담자를 선택해 주세요.</p>'; return; }
    const shares = splitExpense(amount, ids);
    box.innerHTML = `<div class="preview"><strong class="money">${money(amount)}</strong> · ${ids.length}명 부담</div>${trip.participants.map(p => `<div class="member-line">${avatar(p.name)}<span>${escape(p.name)}</span><strong class="money">${money(shares[p.id] || 0)}</strong></div>`).join('')}`;
  }
  form.oninput = preview;
  for (const [id, checked] of [['select-all', true], ['select-none', false]]) document.getElementById(id).onclick = () => { form.querySelectorAll('[name=beneficiaries]').forEach(input => { input.checked = checked; }); preview(); };
  preview();
  form.onsubmit = async event => {
    event.preventDefault();
    const saveButton = event.submitter || event.target.querySelector('[type=submit]');
    if (saveButton.disabled) return;
    saveButton.disabled = true;
    try {
      const data = new FormData(form);
      const expense = { id: existing?.id || uid(), date: data.get('date'), name: data.get('name').trim(), category: data.get('category'), amount: Number(data.get('amount')), payer: data.get('payer'), beneficiaries: trip.participants.filter(p => data.getAll('beneficiaries').includes(p.id)).map(p => p.id) };
      const latest = repository.get(trip.id);
      if (!latest || (existing && !latest.expenses.some(e => e.id === existing.id))) throw new Error('다른 창에서 지출이 변경되었습니다. 대시보드로 돌아가 다시 확인해 주세요.');
      await repository.saveExpense(trip.id, expense, existing?.id); location.hash = url('dashboard', trip.id); toast(existing ? '지출을 수정했어요.' : '지출을 저장했어요.');
    } catch (error) { formError(error); } finally { saveButton.disabled = false; }
  };
}
function settlement(trip) {
  const summary = summarize(trip);
  const names = Object.fromEntries(trip.participants.map(p => [p.id, p.name]));
  app.innerHTML = `<div class="wrap"><a class="back" href="${url('dashboard', trip.id)}">← 여행 대시보드</a>${heading('최종 정산 결과', `${trip.name} · ${period(trip)}`, `<button class="btn no-print" id="print" type="button">결과 인쇄 / PDF 저장</button>`)}${stats(trip, summary)}<section class="card"><h2>참여자별 정산 내역</h2><div class="table-scroll" tabindex="0" role="region" aria-label="참여자별 정산 내역 표"><table><thead><tr><th scope="col">참여자</th><th scope="col">실제 결제 금액</th><th scope="col">총 부담 금액</th><th scope="col">개인별 잔액</th><th scope="col">정산 안내</th></tr></thead><tbody>${summary.members.map(p => `<tr><td>${escape(p.name)}</td><td>${money(p.paid)}</td><td>${money(p.owed)}</td><td class="${p.balance > 0 ? 'teal' : ''}">${p.balance > 0 ? '+' : p.balance < 0 ? '−' : ''}${money(Math.abs(p.balance))}</td><td>${p.balance > 0 ? '받아야 할 금액' : p.balance < 0 ? '보내야 할 금액' : '정산 완료'}</td></tr>`).join('')}</tbody><tfoot><tr><th>합계</th><td>${money(summary.total)}</td><td>${money(summary.total)}</td><td>0원</td><td></td></tr></tfoot></table></div><p class="notice">개인별 잔액 = 실제 결제 금액 − 총 부담 금액</p></section><section class="card section-space"><div class="row"><h2>이렇게 송금하면 정산이 끝나요</h2><span class="tag">총 ${summary.transfers.length}건</span></div><div class="stack">${summary.transfers.length ? summary.transfers.map(t => `<div class="transfer"><span><strong>${escape(names[t.from])}</strong> → <strong>${escape(names[t.to])}</strong></span><strong class="money teal">${money(t.amount)}</strong></div>`).join('') : '<div class="empty">서로 주고받을 금액이 없습니다.</div>'}</div><p class="notice">송금 안내만 제공합니다. 실제 송금과 입금 확인은 참여자끼리 진행해 주세요.</p></section><div class="actions no-print section-space">${link('대시보드로 돌아가기', url('dashboard', trip.id))}${link('+ 지출 추가', url('expense', trip.id), 'primary')}</div></div>`;
  document.querySelector('#print').onclick = () => window.print();
}
async function route() {
  const version = ++routeVersion;
  app.setAttribute('aria-busy', 'true');
  try {
    await repository.refresh();
    if (version !== routeVersion) return;
    const [page = 'home', tripId, expenseId] = (location.hash.slice(1) || 'home').split('/').map(decodeURIComponent);
    currentTrip = tripId ? repository.get(tripId) : null;
    const nav = document.querySelector('#navigation');
    nav.innerHTML = `<a href="#home" ${page === 'home' ? 'aria-current="page"' : ''}>서비스 소개</a><a href="#trips" ${page === 'trips' ? 'aria-current="page"' : ''}>내 여행 목록</a>${currentTrip ? `<a href="${url('dashboard', tripId)}" ${page === 'dashboard' ? 'aria-current="page"' : ''}>대시보드</a><a href="${url('expense', tripId)}" ${page === 'expense' ? 'aria-current="page"' : ''}>지출 등록</a><a href="${url('settlement', tripId)}" ${page === 'settlement' ? 'aria-current="page"' : ''}>최종 정산 결과</a>` : ''}`;
    if (page === 'home') landing();
    else if (page === 'trips') app.innerHTML = `<div class="wrap">${heading('내 여행 목록', '여행마다 기록하고, 함께 쓴 만큼 정확하게 나눠요.')}${tripList()}</div>`;
    else if (page === 'create') createTrip();
    else if (['dashboard', 'expense', 'settlement'].includes(page) && currentTrip) {
      if (page === 'dashboard') dashboard(currentTrip);
      if (page === 'expense') expenseForm(currentTrip, expenseId);
      if (page === 'settlement') settlement(currentTrip);
    } else throw new Error('페이지 또는 여행을 찾을 수 없습니다. 여행 목록에서 다시 선택해 주세요.');
    document.title = `${currentTrip ? currentTrip.name + ' · ' : ''}TripSplit 여행 경비 정산`;
    window.scrollTo(0, 0);
    app.focus({ preventScroll: true });
  } catch (error) { if (version !== routeVersion) return; app.innerHTML = `<div class="wrap"><div class="card"><h1>화면을 열 수 없습니다</h1><p role="alert">${escape(error.message)}</p><button class="btn primary" id="retry-load" type="button">다시 불러오기</button></div></div>`; document.querySelector('#retry-load').onclick = route; }
  finally { if (version === routeVersion) app.removeAttribute('aria-busy'); }
}
window.addEventListener('hashchange', route);
document.querySelector('a.sr-only').onclick = event => {
  event.preventDefault();
  app.focus();
};
window.addEventListener('storage', () => {
  if (document.querySelector('form')) toast('다른 창에서 기록이 변경되었습니다. 저장 전 내용을 확인해 주세요.');
  else route();
});
route();

installTripManagement({ repository, refresh: route, toast });

document.addEventListener('click', async event => {
  const button = event.target.closest('[data-import-local]');
  if (!button || button.disabled) return;
  button.disabled = true;
  try {
    const result = await repository.importLocal();
    if (result) { await route(); toast(`가져옴 ${result.imported}개, 이미 가져온 여행 ${result.skipped}개`); }
  } catch (error) { toast(error.message); }
  finally { button.disabled = false; }
});
