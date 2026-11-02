import handler from 'vinext/server/fetch-handler';
import {createWorkspace,verifyKey,rotateKey,guardedDb,digest} from '../lib/sync-auth';
import {withOwner} from '../lib/owner-context';
import {consumeBudget} from '../lib/user-namespace';
import {exportState,restoreState,BACKUP_LIMIT} from '../lib/backup';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function body(request:Request){const reader=request.body?.getReader();if(!reader)throw Error('本文がありません');const chunks:Uint8Array[]=[];let size=0;while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>BACKUP_LIMIT){await reader.cancel();throw Error('1.8MBまでです')}chunks.push(r.value)}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}return JSON.parse(new TextDecoder().decode(bytes))}
async function route(request:Request,env:Cloudflare.Env,ctx:ExecutionContext):Promise<Response>{
 const path=new URL(request.url).pathname;
 if(path.startsWith('/assets/')||path.startsWith('/_next/static/'))return env.ASSETS.fetch(request);
 if(path==='/')return handler.fetch(request,env,ctx);
 if(!path.startsWith('/api/'))return new Response('Not found',{status:404});
 if(!env.DB||!env.APP_ORIGIN||new URL(request.url).origin!==env.APP_ORIGIN)return json({error:'準備中です'},503);
 const db=env.DB,write=!['GET','HEAD'].includes(request.method);
 if(write&&(request.headers.get('origin')!==env.APP_ORIGIN||!request.headers.get('content-type')?.includes('application/json')))return json({error:'リクエスト元を確認できません'},403);
 if(!await consumeBudget(db,'global:requests',10000,86400))return json({error:'本日の利用上限です'},429);
 const ip=await digest(request.headers.get('cf-connecting-ip')||'local');
 if(!await consumeBudget(db,'ip:'+ip,100,60))return json({error:'しばらく待ってください'},429);
 if(path==='/api/workspace'&&request.method==='POST'){
  if(!await consumeBudget(db,'global:create',20,86400)||!await consumeBudget(db,'create:'+ip,2,86400))return json({error:'作成上限です'},429);
  return json(await createWorkspace(db));
 }
 const user=await verifyKey(request,db);if(!user)return json({error:'同期キーを確認してください'},401);
 if(!await consumeBudget(db,user.workspace+(write?':write':':read'),write?30:300,60))return json({error:'しばらく待ってください'},429);
 if(write&&!await consumeBudget(db,'global:write',1000,86400))return json({error:'本日の更新上限です'},429);
 if(path==='/api/session'&&!write)return json({connected:true});
 // Reads are not cached in the browser, including images, so revoked keys are rechecked.
 if(path==='/api/backup'&&request.method==='GET')return json(await exportState(db,user.userId));
 let lock='';
 if(write){lock=crypto.randomUUID();const result=await db.prepare('UPDATE workspaces SET lock_id=?,lock_until=? WHERE id=? AND generation=? AND key_hash=? AND lock_until<?').bind(lock,Date.now()+180000,user.workspace,user.generation,user.keyHash,Date.now()).run();if(!result.meta.changes)return json({error:'別の操作が処理中です。少し待って再試行してください'},409)}
 user.db=write?guardedDb(db,user,lock):db;
 try{
  if(path==='/api/rotate'&&request.method==='POST')return json(await rotateKey(user.db,user));
  if(path==='/api/backup'&&request.method==='POST'){const b=await body(request);if(!['merge','replace'].includes(b.mode))return json({error:'復元方法を選択してください'},400);return json(await restoreState(user.db,user,b.backup,b.mode))}
  if(path!=='/api/reader'&&path!=='/api/image')return json({error:'Not found'},404);
  return await withOwner(user,()=>handler.fetch(request,env,ctx));
 }finally{if(lock)await db.prepare('UPDATE workspaces SET lock_id=NULL,lock_until=0 WHERE id=? AND lock_id=?').bind(user.workspace,lock).run()}
}
export default {async fetch(request:Request,env:Cloudflare.Env,ctx:ExecutionContext){
 let response:Response;try{response=await route(request,env,ctx)}catch{response=json({error:'処理を完了できませんでした。入力と接続を確認してください'},400)}
 const headers=new Headers(response.headers);headers.set('Referrer-Policy','no-referrer');headers.set('X-Content-Type-Options','nosniff');headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
 if(new URL(request.url).pathname.startsWith('/api/'))headers.set('Cache-Control','no-store');
 const nonce=crypto.randomUUID();headers.set('Content-Security-Policy',`default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`);
 response=new Response(response.body,{status:response.status,headers});
 if(headers.get('content-type')?.includes('text/html'))response=new HTMLRewriter().on('script',{element(e){e.setAttribute('nonce',nonce)}}).transform(response);
 return response;
}};
