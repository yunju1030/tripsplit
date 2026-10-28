import test from 'node:test';
import assert from 'node:assert/strict';
import { credentials,passwordHash,passwordMatches,cookieOptions } from '../server/accounts.js';
import { createStore } from '../server/store.js';
test('두 필드 회원가입 검증 및 비밀번호 해시',async()=>{
  assert.deepEqual(credentials({username:'  Yunju1030 ',password:'long-password-123'}),{username:'yunju1030',password:'long-password-123'});
  assert.throws(()=>credentials({username:'abc',password:'123'}));
  const a=await passwordHash('long-password-123'),b=await passwordHash('long-password-123');
  assert.notEqual(a,b);assert.ok(!a.includes('long-password-123'));
  assert.equal(await passwordMatches('long-password-123',a),true);assert.equal(await passwordMatches('wrong-password-123',a),false);
});
test('사용자 없는 DB 저장소 접근 차단 및 배포 쿠키 보호',()=>{
  assert.throws(()=>createStore({}),/로그인/);
  assert.throws(()=>createStore({},null),/로그인/);
  assert.deepEqual(cookieOptions({VERCEL:'1'}),{httpOnly:true,sameSite:'lax',secure:true,path:'/'});
});
