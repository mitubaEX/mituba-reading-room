export type SyncIdentity={db?:D1Database;userId:string;workspace:string;generation:number;keyHash:string;email:string;displayName:string;fullName:null};
export const digest=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(n=>n.toString(16).padStart(2,'0')).join('');
export function newKey(){return 'rr_'+Array.from(crypto.getRandomValues(new Uint8Array(32))).map(n=>n.toString(16).padStart(2,'0')).join('')}
export async function verifyKey(request:Request,db:D1Database):Promise<SyncIdentity|null>{
 const value=request.headers.get('authorization')||'';if(!/^Bearer rr_[a-f0-9]{64}$/.test(value))return null;
 const keyHash=await digest(value.slice(7));
 const row=await db.prepare('SELECT id,owner,generation FROM workspaces WHERE key_hash=?').bind(keyHash).first<{id:string;owner:string;generation:number}>();
 return row?{userId:row.owner,workspace:row.id,generation:row.generation,keyHash,email:'',displayName:'Reading Room',fullName:null}:null;
}
export async function createWorkspace(db:D1Database){const key=newKey(),id=crypto.randomUUID(),owner=crypto.randomUUID();await db.prepare('INSERT INTO workspaces(id,owner,key_hash,generation) VALUES(?,?,?,1)').bind(id,owner,await digest(key)).run();return{key}}
export async function rotateKey(db:D1Database,user:SyncIdentity){const key=newKey();const r=await db.prepare('UPDATE workspaces SET key_hash=?,generation=generation+1 WHERE id=? AND key_hash=? AND generation=?').bind(await digest(key),user.workspace,user.keyHash,user.generation).run();if(!r.meta.changes)throw Error('同期キーが更新されています');return{key}}
// Fencing assertion shares the transaction with every write. An expired lease,
// rotation or owner switch makes even a delayed in-flight write roll back.
export function guardedDb(db:D1Database,user:SyncIdentity,lock:string):D1Database{
 const assertion=()=>db.prepare(`UPDATE mutation_guard SET valid=CASE WHEN EXISTS(SELECT 1 FROM workspaces WHERE id=? AND owner=? AND generation=? AND key_hash=? AND lock_id=? AND lock_until>?) THEN 1 ELSE 0 END WHERE id=1`).bind(user.workspace,user.userId,user.generation,user.keyHash,lock,Date.now());
 const originals=new WeakMap<object,D1PreparedStatement>();
 const wrap=(statement:D1PreparedStatement):D1PreparedStatement=>{const p=new Proxy(statement,{get(target,prop){if(prop==='bind')return(...values:any[])=>wrap(target.bind(...values));if(prop==='run')return async()=>{const result=await db.batch([assertion(),target]);return result[1]};const value=Reflect.get(target,prop);return typeof value==='function'?value.bind(target):value}});originals.set(p,statement);return p};
 return new Proxy(db,{get(target,prop){if(prop==='prepare')return(sql:string)=>wrap(target.prepare(sql));if(prop==='batch')return async(statements:D1PreparedStatement[])=>{const result=await target.batch([assertion(),...statements.map(s=>originals.get(s)??s)]);return result.slice(1)};const value=Reflect.get(target,prop);return typeof value==='function'?value.bind(target):value}});
}
