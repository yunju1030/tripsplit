import pg from 'pg';
import { AppError } from './errors.js';
let pool;
export function createPool(connectionString) {
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new AppError(503, 'DATABASE_URL 형식을 확인해 주세요.');
  // Require TLS and verify the Neon certificate, regardless of URL sslmode aliases.
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
  const result = new pg.Pool({ connectionString: url.toString(), ssl: { rejectUnauthorized: true }, max: 2, idleTimeoutMillis: 10000, connectionTimeoutMillis: 10000, statement_timeout: 15000, allowExitOnIdle: true });
  result.on('error', () => {}); // No raw driver errors or credentials in logs.
  return result;
}
export function getPool() {
  if (!process.env.DATABASE_URL) throw new AppError(503, '서버의 DATABASE_URL을 설정해 주세요. 기존 브라우저 데이터는 보존되어 있습니다.');
  return pool ||= createPool(process.env.DATABASE_URL);
}
export async function transaction(pool, callback, readOnly = false) {
  const client = await pool.connect();
  try {
    await client.query(readOnly ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* Preserve original error. */ }
    throw error;
  } finally { client.release(); }
}
const required = { trips: ['id','name','start_date','end_date','created_at','legacy_id'], members: ['id','trip_id','name','position'], expenses: ['id','trip_id','date','item','category','amount','paid_by'], expense_splits: ['id','expense_id','member_id','share_amount'] };
export async function inspectSchema(client) {
  const { rows } = await client.query("SELECT table_name,column_name,data_type,column_default,is_identity FROM information_schema.columns WHERE table_schema='public' AND table_name = ANY($1::text[])", [Object.keys(required)]);
  const columns = Object.fromEntries(Object.keys(required).map(table => [table, Object.fromEntries(rows.filter(row => row.table_name === table).map(row => [row.column_name, row]))]));
  for (const [table, names] of Object.entries(required)) for (const name of names) {
    if (!columns[table][name]) throw new AppError(503, ['position','legacy_id'].includes(name) ? '참여자 순서와 중복 없는 가져오기를 위해 npm run db:prepare를 먼저 실행해 주세요. 기존 데이터는 삭제되지 않습니다.' : `DB 스키마에 ${table}.${name} 컬럼이 필요합니다. 기존 테이블 정의를 확인해 주세요.`);
  }
  for (const table of ['trips','members','expenses','expense_splits']) {
    if (columns[table].id.data_type !== 'bigint' || columns[table].id.is_identity !== 'YES') throw new AppError(503, `${table}.id의 BIGINT IDENTITY 설정을 확인해 주세요.`);
  }
  for (const [table, field] of [['expenses','amount'],['expense_splits','share_amount']]) if (!['smallint','integer','bigint','numeric','decimal'].includes(columns[table][field].data_type)) throw new AppError(503, `${table}.${field}은 정수 금액을 저장할 수 있는 타입이어야 합니다.`);
  return columns;
}
