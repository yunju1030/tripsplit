import dotenv from 'dotenv';
import { readFile } from 'node:fs/promises';
import { getPool, inspectSchema } from '../server/database.js';
dotenv.config({path:['.env.local','.env'],quiet:true});
let pool;
try {
  pool=getPool();
  if(process.argv[2]==='prepare'){
    const client=await pool.connect();
    try{await client.query(await readFile(new URL('../migrations/001-preserve-order-and-import.sql',import.meta.url),'utf8'));}
    catch(error){await client.query('ROLLBACK');throw error;}
    finally{client.release();}
  }
  await inspectSchema(pool);
  console.log('Neon 연결 및 BIGINT IDENTITY 스키마 확인 완료.');
}catch(error){console.error(error.status?error.message:`DB 연결·스키마 확인 실패 (${error.code||'CONNECTION_ERROR'}). 연결 정보는 출력하지 않았습니다.`);process.exitCode=1;}
finally{await pool?.end();}
