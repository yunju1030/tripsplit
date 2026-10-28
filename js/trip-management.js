export function installTripManagement({ repository, refresh, toast }) {
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function showDialog(content, opener) {
    const dialog = document.createElement('dialog');
    dialog.className = 'trip-dialog'; dialog.setAttribute('aria-labelledby', 'trip-dialog-title');
    dialog.innerHTML = content; document.body.append(dialog);
    const close = () => { dialog.close(); dialog.remove(); opener?.focus(); };
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    dialog.querySelector('[data-cancel]').onclick = close;
    dialog.showModal();
    return { dialog, close };
  }
  function removeTrip(id, opener) {
    const trip = repository.get(id); if (!trip) { refresh(); return; }
    const { dialog, close } = showDialog(`<h2 id="trip-dialog-title">여행 삭제</h2><p>정말로 '${escape(trip.name)}' 여행을 삭제하시겠습니까? 이 여행에 등록된 참여자와 지출 내역도 모두 삭제되며 복구할 수 없습니다.</p><p class="error" role="alert" hidden></p><div class="actions"><button class="btn" data-cancel>취소</button><button class="btn danger" data-confirm>여행 삭제</button></div>`, opener);
    dialog.querySelector('[data-confirm]').onclick = async event => {
      const button = event.currentTarget; if (button.disabled) return; button.disabled = true;
      try { await repository.remove(id); close(); await refresh(); toast('여행을 삭제했어요.'); }
      catch (error) { const box = dialog.querySelector('.error'); box.hidden = false; box.textContent = error.message; button.disabled = false; }
    };
  }
  function editTrip(id, opener) {
    const trip = repository.get(id); if (!trip) { refresh(); return; }
    const { dialog, close } = showDialog(`<form id="trip-edit-form"><h2 id="trip-dialog-title">여행 정보 수정</h2><p class="error" role="alert" tabindex="-1" hidden></p><label class="field">여행 이름<input name="name" value="${escape(trip.name)}" required maxlength="100"></label><div class="form-grid"><label class="field">여행 시작일<input type="date" name="startDate" value="${escape(trip.startDate)}" required></label><label class="field">여행 종료일<input type="date" name="endDate" value="${escape(trip.endDate)}" required></label></div><fieldset><legend>여행 참여자</legend><div data-participants></div><button type="button" class="btn small" data-add>+ 참여자 추가</button></fieldset><p class="notice">기존 지출의 결제자 또는 부담자는 관련 지출을 먼저 수정한 뒤 삭제할 수 있습니다. 참여자는 최소 1명이어야 합니다.</p><div class="actions"><button type="button" class="btn" data-cancel>취소</button><button type="submit" class="btn primary">저장</button></div></form>`, opener);
    const form = dialog.querySelector('form'), container = dialog.querySelector('[data-participants]');
    const error = message => { const box = dialog.querySelector('.error'); box.hidden = false; box.textContent = message; box.focus(); };
    function addParticipant(p = { id: crypto.randomUUID(), name: '' }) {
      const row = document.createElement('div'); row.className = 'participant-row'; row.dataset.id = p.id;
      row.innerHTML = `<input name="participant" value="${escape(p.name)}" aria-label="참여자 이름" required maxlength="50"><button type="button" class="btn danger small">삭제</button>`;
      row.querySelector('button').onclick = () => {
        const latest = repository.get(id);
        if (latest?.expenses.some(e => e.payer === p.id || e.beneficiaries.includes(p.id))) return error(`${row.querySelector('input').value || p.name}님은 기존 지출에 연결되어 있습니다. 관련 지출의 결제자·부담자를 먼저 수정해 주세요.`);
        if (container.children.length <= 1) return error('참여자는 최소 1명 이상 유지해야 합니다.');
        row.remove();
      };
      container.append(row); return row;
    }
    trip.participants.forEach(addParticipant);
    dialog.querySelector('[data-add]').onclick = () => addParticipant().querySelector('input').focus();
    form.onsubmit = async event => {
      event.preventDefault();
      const button = event.submitter || event.target.querySelector('[type=submit]'); if (button.disabled) return; button.disabled = true;
      try {
        const data = new FormData(form);
        await repository.update(id, { name: data.get('name').trim(), startDate: data.get('startDate'), endDate: data.get('endDate'), participants: Array.from(container.children, row => ({ id: row.dataset.id, name: row.querySelector('input').value.trim() })) });
        close(); await refresh(); toast('여행 정보를 수정했어요.');
      } catch (err) { error(err.message); } finally { button.disabled = false; }
    };
  }
  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-trip-menu]');
    if (trigger) {
      const menu = trigger.nextElementSibling, open = menu.hidden;
      document.querySelectorAll('.trip-menu').forEach(el => { el.hidden = true; el.previousElementSibling.setAttribute('aria-expanded', 'false'); });
      menu.hidden = !open; trigger.setAttribute('aria-expanded', String(open));
      if (open) menu.querySelector('button').focus(); return;
    }
    const action = event.target.closest('[data-trip-action]');
    document.querySelectorAll('.trip-menu').forEach(el => { el.hidden = true; el.previousElementSibling.setAttribute('aria-expanded', 'false'); });
    if (action) {
      const id = action.dataset.tripId;
      if (action.dataset.tripAction === 'edit') editTrip(id, action.closest('.trip-card').querySelector('[data-trip-menu]'));
      else removeTrip(id, action.closest('.trip-card').querySelector('[data-trip-menu]'));
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') document.querySelectorAll('.trip-menu:not([hidden])').forEach(el => { el.hidden = true; el.previousElementSibling.setAttribute('aria-expanded', 'false'); el.previousElementSibling.focus(); });
  });
  window.addEventListener('hashchange', () => document.querySelectorAll('.trip-dialog').forEach(dialog => dialog.remove()));
}
