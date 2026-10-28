// 모든 계산은 정수 원화로 수행합니다. 나머지는 참여자 등록 순서대로 배분합니다.
export function splitExpense(amount, people) {
  if (!Number.isSafeInteger(amount) || amount <= 0 || !people.length || new Set(people).size !== people.length) throw new Error('금액과 부담자를 확인해 주세요.');
  const base = Math.floor(amount / people.length);
  const remainder = amount % people.length;
  return Object.fromEntries(people.map((id, index) => [id, base + (index < remainder ? 1 : 0)]));
}
export function expenseShares(trip, expense) {
  if (!expense.shares) return splitExpense(expense.amount, trip.participants.filter(p => expense.beneficiaries.includes(p.id)).map(p => p.id));
  const entries = Object.entries(expense.shares);
  if (entries.length !== expense.beneficiaries.length || entries.some(([id, amount]) => !expense.beneficiaries.includes(id) || !Number.isSafeInteger(amount) || amount < 0) || entries.reduce((sum, [, amount]) => sum + amount, 0) !== expense.amount) throw new Error('저장된 부담 금액의 합계가 지출 금액과 일치하지 않습니다.');
  return expense.shares;
}
export function summarize(trip) {
  const members = trip.participants.map(p => ({ ...p, paid: 0, owed: 0, balance: 0 }));
  let total = 0;
  for (const expense of trip.expenses) {
    const shares = expenseShares(trip, expense);
    total += expense.amount;
    if (!Number.isSafeInteger(total)) throw new Error('여행 총금액이 계산 가능한 범위를 초과했습니다.');
    for (const member of members) {
      if (member.id === expense.payer) member.paid += expense.amount;
      member.owed += shares[member.id] || 0;
      member.balance = member.paid - member.owed;
    }
  }
  const creditors = members.filter(p => p.balance > 0).map(p => ({ id: p.id, remaining: p.balance }));
  const debtors = members.filter(p => p.balance < 0).map(p => ({ id: p.id, remaining: -p.balance }));
  const transfers = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].remaining, creditors[j].remaining);
    transfers.push({ from: debtors[i].id, to: creditors[j].id, amount });
    debtors[i].remaining -= amount;
    creditors[j].remaining -= amount;
    if (!debtors[i].remaining) i++;
    if (!creditors[j].remaining) j++;
  }
  return { total, members, transfers };
}
