import {safeUrl,plain} from './feed.ts';
import {normalizeFeedUrl,validateEntries} from './opml.ts';
import {digest,type SyncIdentity} from './sync-auth.ts';
export const BACKUP_LIMIT=1800000;
const fields={feeds:['id','url','title','checked','success','error','folder'],articles:['id','feed','title','url','summary','image','image_checked','published','added','read','saved','version'],presets:['id','name','entries','created']} as const;
export async function exportState(db:D1Database,owner:string){
 const entries=Object.entries(fields);
 const rows=await db.batch(entries.map(([table,columns])=>db.prepare(`SELECT ${columns.join(',')} FROM ${table} WHERE owner=? ORDER BY id`).bind(owner)));
 const data:any={format:'reading-room',version:1,exportedAt:new Date().toISOString()};
 entries.forEach(([table],index)=>{data[table]=rows[index].results});return data;
}
const text=(v:unknown,max:number)=>{if(typeof v!=='string'||v.length>max)throw Error('バックアップの文字列が不正です');return plain(v).slice(0,max)};
const date=(v:any)=>{if(v===null||v===undefined)return null;if(typeof v!=='string'||v.length>40||!Number.isFinite(Date.parse(v)))throw Error('日付が不正です');return v};
const id=(v:any)=>{if(typeof v!=='string'||!v||v.length>200)throw Error('IDが不正です');return v};
export function validateBackup(raw:any){
 if(JSON.stringify(raw).length>BACKUP_LIMIT)throw Error('復元は1.8MBまでです');
 if(raw?.format!=='reading-room'||raw.version!==1)throw Error('未対応のバックアップ形式です');
 if(!Array.isArray(raw.feeds)||raw.feeds.length>500||!Array.isArray(raw.articles)||raw.articles.length>5000||!Array.isArray(raw.presets)||raw.presets.length>10)throw Error('バックアップの件数が上限を超えています');
 const feeds=raw.feeds.map((f:any)=>({id:id(f.id),url:normalizeFeedUrl(f.url),title:text(f.title,3000),checked:date(f.checked),success:date(f.success),error:f.error==null?null:text(f.error,3000),folder:f.folder==null?null:text(f.folder,200)}));
 const feedIds=new Set(feeds.map((f:any)=>f.id));if(feedIds.size!==feeds.length||new Set(feeds.map((f:any)=>f.url)).size!==feeds.length)throw Error('フィードが重複しています');
 const articles=raw.articles.map((a:any)=>{if(!feedIds.has(a.feed)||![0,1].includes(a.read)||![0,1].includes(a.saved)||!Number.isSafeInteger(a.version)||a.version<0)throw Error('記事の状態が不正です');return{id:id(a.id),feed:a.feed,title:text(a.title,3000),url:safeUrl(a.url).href,summary:text(a.summary,3000),image:a.image?safeUrl(a.image).href:null,image_checked:Number.isSafeInteger(a.image_checked)&&a.image_checked>=0?a.image_checked:null,published:date(a.published),added:date(a.added)||new Date().toISOString(),read:a.read,saved:a.saved,version:a.version}});
 if(new Set(articles.map((a:any)=>a.id)).size!==articles.length)throw Error('記事IDが重複しています');
 const presets=raw.presets.map((p:any)=>({id:id(p.id),name:text(p.name,100),entries:JSON.stringify(validateEntries(typeof p.entries==='string'?JSON.parse(p.entries):p.entries)),created:date(p.created)||new Date().toISOString()}));
 if(new Set(presets.map((p:any)=>p.id)).size!==presets.length)throw Error('プリセットが重複しています');
 return{format:'reading-room',version:1,feeds,articles,presets};
}
export function mergeBackup(current:any,incoming:any){
 const feeds=new Map<string,any>(),articles=new Map<string,any>(),presets=new Map<string,any>();
 for(const data of [incoming,current]){const refs=new Map(data.feeds.map((f:any)=>[f.id,f.url]));for(const f of data.feeds)feeds.set(f.url,{...f,id:f.url});for(const a of data.articles){const feed=refs.get(a.feed) as string;articles.set(feed+'\n'+a.url,{...a,id:feed+'\n'+a.url,feed})}for(const p of data.presets)presets.set(p.entries,p)}
 // Temporary IDs may be URLs; validation is performed before and after remapping.
 return{format:'reading-room',version:1,feeds:[...feeds.values()],articles:[...articles.values()],presets:[...presets.values()]};
}
export async function restoreState(db:D1Database,user:SyncIdentity,input:any,mode:'merge'|'replace'){
 const incoming=validateBackup(input),current=validateBackup(await exportState(db,user.userId));
 const source=mode==='merge'?mergeBackup(current,incoming):incoming;
 if(source.feeds.length>500||source.articles.length>5000||source.presets.length>10||JSON.stringify(source).length>BACKUP_LIMIT)throw Error('結合後のバックアップが上限を超えます');
 const owner=crypto.randomUUID(),refs=new Map<string,string>();
 for(const f of source.feeds){const next=await digest(owner+'|'+f.url);refs.set(f.id,next);f.id=next}
 for(const a of source.articles){a.feed=refs.get(a.feed)!;a.id=await digest(owner+'|'+a.feed+'|'+a.url)}
 for(const p of source.presets)p.id=await digest(owner+'|'+p.entries);
 // All three tables, owner switch and old-data removal share one D1 transaction.
 const statements=[];for(const [table,columns]of Object.entries(fields)){const values=source[table as keyof typeof fields];statements.push(db.prepare(`INSERT INTO ${table}(owner,${columns.join(',')}) SELECT ?,${columns.map(c=>`json_extract(value,'$.${c}')`).join(',')} FROM json_each(?)`).bind(owner,JSON.stringify(values)))}
 statements.push(db.prepare('UPDATE workspaces SET owner=? WHERE id=? AND owner=? AND generation=?').bind(owner,user.workspace,user.userId,user.generation));
 for(const table of ['articles','feeds','presets','image_runs'])statements.push(db.prepare(`DELETE FROM ${table} WHERE owner=?`).bind(user.userId));
 statements.push(db.prepare('DELETE FROM image_runs WHERE owner=?').bind('feed:'+user.userId));
 await db.batch(statements);return{feeds:source.feeds.length,articles:source.articles.length,presets:source.presets.length};
}
