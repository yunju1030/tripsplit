import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool } from './server/database.js';
import { createStore, validId } from './server/store.js';
dotenv.config({path:['.env.local','.env'],quiet:true});
const root=path.dirname(fileURLToPath(import.meta.url));
export function createApp({storeFactory=()=>createStore(getPool())}={}) {
  const app=express();app.disable('x-powered-by');
  app.use(express.json({limit:'5mb'}));
  app.use((req,res,next)=>{
    res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; script-src 'self' https://cdn.tailwindcss.com 'unsafe-inline' 'unsafe-eval'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; img-src 'self' https: data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"});
    if(!['GET','HEAD'].includes(req.method) && (req.get('X-Requested-With')!=='TripSplit' || req.get('Sec-Fetch-Site')==='cross-site')) return res.status(403).json({error:'허용되지 않은 요청입니다.'});
    next();
  });
  app.get('/api/trips',async(req,res)=>res.json({trips:await storeFactory().list()}));
  app.post('/api/trips',async(req,res)=>res.status(201).json(await storeFactory().create(req.body)));
  app.put('/api/trips/:id',async(req,res)=>res.json(await storeFactory().update(validId(req.params.id),req.body,req.get('If-Match'))));
  app.delete('/api/trips/:id',async(req,res)=>res.json(await storeFactory().remove(validId(req.params.id),req.get('If-Match'))));
  app.post('/api/trips/:id/expenses',async(req,res)=>res.status(201).json(await storeFactory().expense(validId(req.params.id),req.body,null,'POST',req.get('If-Match'))));
  app.put('/api/trips/:id/expenses/:expenseId',async(req,res)=>res.json(await storeFactory().expense(validId(req.params.id),req.body,validId(req.params.expenseId),'PUT',req.get('If-Match'))));
  app.delete('/api/trips/:id/expenses/:expenseId',async(req,res)=>res.json(await storeFactory().expense(validId(req.params.id),null,validId(req.params.expenseId),'DELETE',req.get('If-Match'))));
  app.post('/api/import',async(req,res)=>res.json(await storeFactory().import(req.body?.trips)));
  app.use('/api',(req,res)=>res.status(404).json({error:'요청한 API를 찾을 수 없습니다.'}));
  // Explicit static allowlist. Never serve the project root, .env or SQL files.
  app.get('/',(req,res)=>res.sendFile(path.join(root,'index.html')));
  app.get('/styles.css',(req,res)=>res.sendFile(path.join(root,'styles.css')));
  app.use('/js',express.static(path.join(root,'js'),{dotfiles:'deny',index:false}));
  app.use((req,res)=>res.status(404).json({error:'페이지를 찾을 수 없습니다.'}));
  app.use((error,req,res,next)=>{
    if(error.type==='entity.parse.failed'||error.type==='entity.too.large') return res.status(400).json({error:'입력 데이터 형식이나 크기를 확인해 주세요.'});
    if(error.status) return res.status(error.status).json({error:error.message});
    if(['23503','23505','22003','22P02','23514','23502'].includes(error.code)) return res.status(409).json({error:'데이터 형식 또는 다른 데이터와의 연결을 확인해 주세요. 변경 사항은 저장하지 않았습니다.'});
    res.status(503).json({error:'Neon 데이터베이스에 연결하거나 데이터를 처리하지 못했습니다. 잠시 후 다시 시도하고 DATABASE_URL·네트워크·스키마 설정을 확인해 주세요. 브라우저의 기존 데이터는 보존되어 있습니다.'});
  });
  return app;
}
const app=createApp();
if(!process.env.VERCEL && process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) app.listen(process.env.PORT||3000,'127.0.0.1',()=>console.log(`TripSplit: http://localhost:${process.env.PORT||3000}`));
export default app;
