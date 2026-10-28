import { randomBytes, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { AppError } from './errors.js';
import { transaction } from './database.js';
import { validPassword, PASSWORD_HINT } from '../js/password-policy.js';
const derive=promisify(scrypt);
export const SESSION_COOKIE='tripsplit_session';
const duration=30*24*60*60*1000;
export const tokenHash=token=>createHash('sha256').update(token).digest('hex');
export function credentials(body,{registration=true}={}) {
  const username=typeof body?.username==='string'?body.username.trim().toLowerCase():'';
  if(!/^[a-z0-9][a-z0-9._-]{3,39}$/.test(username))throw new AppError(400,'아이디는 영문·숫자·._- 4~40자로 입력해 주세요.');
  if(typeof body?.password!=='string'||body.password.length<1||body.password.length>128)throw new AppError(400,'비밀번호를 입력해 주세요. 최대 128자까지 입력할 수 있습니다.');
  if(registration&&!validPassword(body.password))throw new AppError(400,PASSWORD_HINT);
  return {username,password:body.password};
}
export async function passwordHash(password) {
  const salt=randomBytes(16).toString('hex');
  const key=await derive(password,salt,64,{N:32768,r:8,p:3,maxmem:64*1024*1024});
  return `scrypt$${salt}$${key.toString('hex')}`;
}
export async function passwordMatches(password,encoded) {
  const [algorithm,salt,hash]=String(encoded||'').split('$');
  if(algorithm!=='scrypt'||!/^[a-f0-9]{32}$/.test(salt||'')||!/^[a-f0-9]{128}$/.test(hash||''))return false;
  const key=await derive(password,salt,64,{N:32768,r:8,p:3,maxmem:64*1024*1024});
  return timingSafeEqual(key,Buffer.from(hash,'hex'));
}
export function cookieOptions(config=process.env){return {httpOnly:true,sameSite:'lax',secure:Boolean(config.VERCEL)||config.NODE_ENV==='production',path:'/'};}
export function sessionToken(req){const part=(req.get('Cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(SESSION_COOKIE+'='));const token=part?.slice(SESSION_COOKIE.length+1)||'';return /^[A-Za-z0-9_-]{43}$/.test(token)?token:null;}
export function createAccounts(pool) {
  async function limit(key,max,windowSeconds) {
    const bucket=Math.floor(Date.now()/(windowSeconds*1000));
    const {rows:[row]}=await pool.query('INSERT INTO public.auth_limits (key,bucket,attempts) VALUES ($1,$2,1) ON CONFLICT (key,bucket) DO UPDATE SET attempts=auth_limits.attempts+1 RETURNING attempts',[tokenHash(key),bucket]);
    if(row.attempts>max)throw new AppError(429,'시도가 많습니다. 잠시 후 다시 시도해 주세요.');
  }
  async function start(user,db=pool) {
    const token=randomBytes(32).toString('base64url');
    await db.query('INSERT INTO public.app_sessions (token_hash,user_id,expires_at) VALUES ($1,$2,$3)',[tokenHash(token),user.id,new Date(Date.now()+duration)]);
    return {user,token,maxAge:duration};
  }
  return {
    async register(body,ip){
      const {username,password}=credentials(body);await limit(`register:${ip}`,12,3600);
      const hash=await passwordHash(password);
      try{return await transaction(pool,async client=>{
        const {rows:[user]}=await client.query('INSERT INTO public.app_users (username,password_hash) VALUES ($1,$2) RETURNING id::text,username',[username,hash]);
        return start(user,client);
      });}
      catch(error){if(error.code==='23505')throw new AppError(409,'이미 사용 중인 아이디입니다. 다른 아이디를 입력해 주세요.');throw error;}
    },
    async login(body,ip){
      const {username,password}=credentials(body,{registration:false});await limit(`login-ip:${ip}`,60,900);await limit(`login-user:${username}`,20,900);
      const {rows:[row]}=await pool.query('SELECT id::text,username,password_hash FROM public.app_users WHERE username=$1',[username]);
      // Match the work factor for unknown accounts to avoid username timing disclosure.
      const encoded=row?.password_hash||`scrypt$${'0'.repeat(32)}$${'0'.repeat(128)}`;
      const matches=await passwordMatches(password,encoded);
      if(!row||!matches)throw new AppError(401,'아이디 또는 비밀번호를 확인해 주세요.');
      return start({id:row.id,username:row.username});
    },
    async current(token){
      if(!token)return null;
      const {rows:[user]}=await pool.query('SELECT u.id::text,u.username FROM public.app_sessions s JOIN public.app_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()',[tokenHash(token)]);
      return user||null;
    },
    async logout(token){if(token)await pool.query('DELETE FROM public.app_sessions WHERE token_hash=$1',[tokenHash(token)]);}
  };
}
