// Explicit operator action only. No HTTP endpoint allows claiming legacy trips.
import dotenv from 'dotenv';
import { getPool,transaction } from '../server/database.js';
dotenv.config({path:['.env.local','.env'],quiet:true});
const [username,tripIds,confirmation]=process.argv.slice(2);
if(!username||!/^\d+(,\d+)*$/.test(tripIds||'')||confirmation!=='--confirm')throw Error('Usage: node scripts/assign-legacy-owner.mjs USERNAME TRIP_IDS_COMMA_SEPARATED --confirm');
const pool=getPool();
try{
  await transaction(pool,async c=>{
    const {rows:[user]}=await c.query('SELECT id FROM public.app_users WHERE username=$1',[username.trim().toLowerCase()]);if(!user)throw Error('가입된 아이디를 확인해 주세요.');
    const ids=tripIds.split(',');const {rows}=await c.query('SELECT id::text,owner_id FROM public.trips WHERE id::text=ANY($1::text[]) FOR UPDATE',[ids]);
    if(rows.length!==new Set(ids).size||rows.some(t=>t.owner_id!==null))throw Error('선택한 여행을 확인해 주세요. 이미 소유자가 있는 여행은 이전하지 않습니다.');
    await c.query('UPDATE public.trips SET owner_id=$1 WHERE id::text=ANY($2::text[]) AND owner_id IS NULL',[user.id,ids]);
    console.log(`선택한 기존 여행 ${rows.length}개를 지정 계정에 연결했습니다. 지출·참여자·정산 데이터는 유지했습니다.`);
  });
}catch(error){console.error(error.code?'기존 여행 연결에 실패했습니다. 데이터는 변경하지 않았습니다.':error.message);process.exitCode=1;}
finally{await pool.end();}
