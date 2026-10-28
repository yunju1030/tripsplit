import { createRepository as localRepository } from './storage.js';
export function createApiRepository() {
  let trips=[];
  async function request(url,method='GET',body,expected) {
    let response;
    try {response=await fetch(url,{method,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-Requested-With':'TripSplit',...(expected?{'If-Match':expected}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});}
    catch {throw new Error('서버에 연결하지 못했습니다. 네트워크 상태를 확인해 주세요. 입력 내용은 저장되지 않았습니다.');}
    const data=await response.json().catch(()=>({error:'서버 응답을 읽지 못했습니다.'}));
    if(response.status===401)window.dispatchEvent(new Event('tripsplit-session-expired'));
    if(!response.ok){const error=new Error(data.error||'데이터를 저장하지 못했습니다.');error.status=response.status;throw error;}
    return data;
  }
  function remember(trip){trips=[...trips.filter(t=>t.id!==trip.id),trip];return trip;}
  const get=id=>trips.find(t=>t.id===id);
  const expected=id=>{const trip=get(id);if(!trip)throw new Error('여행을 다시 조회한 뒤 시도해 주세요.');return trip.revision;};
  return {
    clear:()=>{trips=[];},
    list:()=>trips,
    get,
    async refresh(){const data=await request('/api/trips');trips=data.trips;return trips;},
    async save(trip){return remember(await request('/api/trips','POST',trip));},
    async update(id,changes){return remember(await request(`/api/trips/${encodeURIComponent(id)}`,'PUT',changes,expected(id)));},
    async remove(id){await request(`/api/trips/${encodeURIComponent(id)}`,'DELETE',undefined,expected(id));trips=trips.filter(t=>t.id!==id);},
    async saveExpense(id,expense,existingId){return remember(await request(`/api/trips/${encodeURIComponent(id)}/expenses${existingId?'/'+encodeURIComponent(existingId):''}`,existingId?'PUT':'POST',expense,expected(id)));},
    async removeExpense(id,expenseId){return remember(await request(`/api/trips/${encodeURIComponent(id)}/expenses/${encodeURIComponent(expenseId)}`,'DELETE',undefined,expected(id)));},
    async importLocal(){
      const local=localRepository({getItem:key=>window.localStorage.getItem(key)}).list();
      if(!local.length)throw new Error('이 브라우저에 가져올 기존 여행이 없습니다.');
      if(!window.confirm(`이 브라우저의 여행 ${local.length}개를 Neon으로 가져올까요? 이미 가져온 여행은 건너뛰며, 브라우저 원본은 삭제하지 않습니다.`))return null;
      return request('/api/import','POST',{trips:local});
    }
  };
}
