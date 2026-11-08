import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {storeFreshFeed,refreshFeed,refreshNextFeed,retentionCutoff,articleTimeSql} from '../lib/article-retention.ts';
const now=Date.parse('2026-11-06T12:00:00Z');
function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 for(const name of ['0000_public_chronomancer','0001_complete_triathlon','0002_special_omega_sentinel','0003_tearful_rawhide_kid','0007_article_retention'])sql.exec(readFileSync(new URL('../drizzle/'+name+'.sql',import.meta.url),'utf8'));
 sql.exec("INSERT INTO feeds(id,owner,url,title) VALUES('f','one','https://example.com/feed','Feed'),('g','two','https://example.org/feed','Other')");
 const db:any={prepare(q:string){return{bind(...args:any[]){return {q,args,async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}}},async all(){return{results:sql.prepare(q).all(...args)}}}}}},async batch(stmts:any[]){sql.exec('BEGIN');try{const result=stmts.map(s=>sql.prepare(s.q).run(...s.args));sql.exec('COMMIT');return result}catch(e){sql.exec('ROLLBACK');throw e}}};
 const add=(id:string,published:string|null,added:string,saved=0,owner='one',feed='f')=>sql.prepare('INSERT INTO articles(id,owner,feed,title,url,summary,published,added,read,saved,version) VALUES(?,?,?,?,?,?,?,?,1,?,7)').run(id,owner,feed,id,'https://example.com/'+id,'content',published,added,saved);
 const ids=()=>sql.prepare('SELECT id FROM articles ORDER BY id').all().map(r=>r.id);
 return{sql,db,add,ids};
}
const item=(key:string,published:string|null)=>({key,title:key,url:'https://example.com/'+key,summary:'new content',image:null,published});
test('48h boundary, saved retention, undated expiry, owner isolation and repeat refresh',async()=>{
 const{sql,db,add,ids}=fixture();const old='2026-11-04T11:59:59Z',fresh='2026-11-06T10:00:00Z';
 add('old',old,fresh);add('saved',old,old,1);add('boundary',retentionCutoff(now),old);add('undated',null,old);add('recent',fresh,fresh);add('other',old,old,0,'two','g');
 const data={title:'New feed',items:[item('old',fresh),item('saved',old),item('undated',null),item('recent',fresh),item('too-old',old),item('new',fresh),item('no-date',null)]};
 await storeFreshFeed(db,'one','f',data,now);
 assert.ok(!ids().includes('old'));assert.ok(!ids().includes('undated'));assert.ok(ids().includes('saved'));assert.ok(ids().includes('boundary'));assert.ok(ids().includes('other'));
 assert.equal(sql.prepare("SELECT count(*) n FROM articles WHERE url='https://example.com/too-old'").get()?.n,0);
 assert.deepEqual({...sql.prepare("SELECT read,saved,version FROM articles WHERE id='saved'").get()},{read:1,saved:1,version:7});
 assert.deepEqual({...sql.prepare("SELECT read,saved,version FROM articles WHERE id='recent'").get()},{read:1,saved:0,version:7});
 const before=ids();await storeFreshFeed(db,'one','f',data,now);assert.deepEqual(ids(),before);
 // Changing GUID and removing publication date still cannot resurrect an expired URL.
 await storeFreshFeed(db,'one','f',{title:'Feed',items:[{...item('changed-guid',null),url:'https://example.com/undated'}]},now+2000);
 assert.equal(sql.prepare("SELECT count(*) n FROM articles WHERE url='https://example.com/undated'").get()?.n,0);
 await storeFreshFeed(db,'one','f',data,now+49*3600000);
 assert.equal(sql.prepare("SELECT count(*) n FROM articles WHERE owner='one' AND saved=0").get()?.n,0);
 await storeFreshFeed(db,'one','f',data,now+50*3600000);
 assert.equal(sql.prepare("SELECT count(*) n FROM articles WHERE owner='one' AND saved=0").get()?.n,0);
 sql.close();
});
test('failed write rolls back new articles, pruning, tombstones and success timestamp',async()=>{
 const{sql,db,add}=fixture();add('old','2026-11-01T00:00:00Z','2026-11-01T00:00:00Z');
 sql.exec("CREATE TRIGGER fail_success BEFORE UPDATE ON feeds BEGIN SELECT RAISE(ABORT,'failure'); END;");
 await assert.rejects(storeFreshFeed(db,'one','f',{title:'Updated',items:[item('new',new Date(now).toISOString())]},now));
 assert.equal(sql.prepare('SELECT count(*) n FROM articles').get()?.n,1);assert.equal(sql.prepare('SELECT count(*) n FROM article_expirations').get()?.n,0);assert.equal(sql.prepare("SELECT success FROM feeds WHERE id='f'").get()?.success,null);sql.close();
});
test('date offsets, missing dates and saved visibility; expiration metadata cascades on feed deletion',async()=>{
 const{sql,db,add}=fixture();add('old','2026-11-04T13:00:00+02:00','2026-11-06T00:00:00Z');add('saved',null,'2026-11-01T00:00:00Z',1);add('new',null,'2026-11-06T00:00:00Z');
 const visible=sql.prepare(`SELECT id FROM articles WHERE owner=? AND (saved=1 OR ${articleTimeSql}>=julianday(?)) ORDER BY id`).all('one',retentionCutoff(now));assert.deepEqual(visible.map(r=>r.id),['new','saved']);
 await storeFreshFeed(db,'one','f',{title:'Feed',items:[]},now);assert.equal(sql.prepare('SELECT count(*) n FROM article_expirations').get()?.n,1);
 sql.exec("DELETE FROM feeds WHERE id='f'");assert.equal(sql.prepare('SELECT count(*) n FROM article_expirations').get()?.n,0);sql.close();
});

test('fetch failure preserves all content and last success; a later success prunes',async()=>{
 const{sql,db,add}=fixture();add('old','2026-11-01T00:00:00Z','2026-11-01T00:00:00Z');
 sql.exec("UPDATE feeds SET success='2026-11-01T00:00:00Z' WHERE id='f'");
 const before=sql.prepare('SELECT * FROM articles').all();
 assert.equal(await refreshFeed(db,'one',{id:'f',url:'https://example.com/feed'},async()=>{throw Error('offline')},now),'offline');
 assert.deepEqual(sql.prepare('SELECT * FROM articles').all(),before);
 assert.equal(sql.prepare("SELECT success FROM feeds WHERE id='f'").get()?.success,'2026-11-01T00:00:00Z');
 assert.equal(await refreshFeed(db,'one',{id:'f',url:'https://example.com/feed'},async()=>({url:'https://example.com/feed',title:'Feed',items:[]}),now),null);
 assert.equal(sql.prepare('SELECT count(*) n FROM articles').get()?.n,0);sql.close();
});

test('manual refresh marks existing articles across the owner’s feeds, retains saved state and inserts unread new items',async()=>{
 const{sql,db,add}=fixture(),fresh=new Date(now).toISOString();
 sql.exec("INSERT INTO feeds(id,owner,url,title) VALUES('h','one','https://example.com/other-feed','Other feed')");
 add('existing',fresh,fresh);add('saved','2026-10-01T00:00:00Z',fresh,1,'one','h');add('same-owner-other-feed',fresh,fresh,0,'one','h');add('other-owner',fresh,fresh,0,'two','g');
 sql.exec('UPDATE articles SET read=0');
 const result=await refreshNextFeed(db,'one',{markExistingRead:true,feed:'f'},async()=>({url:'https://example.com/feed',title:'Feed',items:[item('existing',fresh),item('existing',fresh),item('new',fresh)]}),now);
 assert.equal(result.refreshedFeedId,'f');assert.deepEqual(result.errors,[]);
 assert.deepEqual({...sql.prepare("SELECT read,version FROM articles WHERE id='existing'").get()},{read:1,version:8});
 assert.deepEqual({...sql.prepare("SELECT read,saved,version FROM articles WHERE id='saved'").get()},{read:1,saved:1,version:8});
 assert.equal(sql.prepare("SELECT count(*) n FROM articles WHERE url='https://example.com/existing'").get()?.n,1);
 assert.deepEqual({...sql.prepare("SELECT read,version FROM articles WHERE url='https://example.com/new'").get()},{read:0,version:0});
 assert.equal(sql.prepare("SELECT read FROM articles WHERE id='same-owner-other-feed'").get()?.read,1);
 assert.equal(sql.prepare("SELECT read FROM articles WHERE id='other-owner'").get()?.read,0);
 // Old UI state cannot overwrite the refresh's versioned transition.
 assert.equal(sql.prepare("UPDATE articles SET read=0,version=version+1 WHERE id='existing' AND version=7").run().changes,0);
 sql.close();
});
test('automatic, initial/add and unflagged refresh never mark unread rows',async()=>{
 const{sql,db,add}=fixture(),fresh=new Date(now).toISOString();add('existing',fresh,fresh);sql.exec('UPDATE articles SET read=0');
 const loader=async()=>({url:'https://example.com/feed',title:'Feed',items:[item('existing',fresh)]});
 await refreshNextFeed(db,'one',{automatic:true,markExistingRead:true,feed:'g'},loader,now);
 assert.equal(sql.prepare("SELECT read FROM articles WHERE id='existing'").get()?.read,0);
 const skipped=await refreshNextFeed(db,'one',{automatic:true},async()=>{throw Error('cooldown must skip fetching')},now+1000);assert.equal(skipped.refreshedFeedId,null);
 await refreshNextFeed(db,'one',{},loader,now);
 await refreshFeed(db,'one',{id:'f',url:'https://example.com/feed'},loader,now);
 assert.deepEqual({...sql.prepare("SELECT read,version FROM articles WHERE id='existing'").get()},{read:0,version:7});sql.close();
});
test('failed refresh marks nothing; later successful one-feed request atomically marks its all-feed snapshot',async()=>{
 const{sql,db,add}=fixture(),fresh=new Date(now).toISOString();
 sql.exec("INSERT INTO feeds(id,owner,url,title) VALUES('h','one','https://example.com/h','Other')");
 add('existing',fresh,fresh);add('other-feed',fresh,fresh,0,'one','h');sql.exec('UPDATE articles SET read=0');
 const failed=await refreshNextFeed(db,'one',{markExistingRead:true},async()=>{throw Error('offline')},now);assert.deepEqual(failed.errors,['offline']);
 assert.equal(sql.prepare("SELECT read FROM articles WHERE id='existing'").get()?.read,0);
 assert.equal(sql.prepare("SELECT read FROM articles WHERE id='other-feed'").get()?.read,0);
 const next=await refreshNextFeed(db,'one',{markExistingRead:true},async()=>({url:'https://example.com/h',title:'Other',items:[item('new',fresh)]}),now);
 assert.equal(next.refreshedFeedId,'h');assert.equal(sql.prepare("SELECT read FROM articles WHERE id='other-feed'").get()?.read,1);assert.equal(sql.prepare("SELECT read FROM articles WHERE id='existing'").get()?.read,1);
 assert.equal(sql.prepare("SELECT error FROM feeds WHERE id='f'").get()?.error,'offline');
 sql.exec('UPDATE articles SET read=0,version=version+1');
 sql.exec("CREATE TRIGGER fail_title BEFORE UPDATE OF title ON feeds BEGIN SELECT RAISE(ABORT,'failure'); END;");
 const before=sql.prepare('SELECT * FROM articles ORDER BY id').all();
 const writeFailed=await refreshNextFeed(db,'one',{markExistingRead:true,feed:'f'},async()=>({url:'https://example.com/feed',title:'Feed',items:[item('new-f',fresh)]}),now);
 assert.equal(writeFailed.errors.length,1);assert.deepEqual(sql.prepare('SELECT * FROM articles ORDER BY id').all(),before);
 const inaccessible=await refreshNextFeed(db,'one',{markExistingRead:true,feed:'g'},async()=>{throw Error('must not fetch another owner')},now);assert.equal(inaccessible.refreshedFeedId,null);sql.close();
});
test('snapshot excludes arrivals during fetch and respects intervening version changes',async()=>{
 const{sql,db,add}=fixture(),fresh=new Date(now).toISOString();sql.exec("INSERT INTO feeds(id,owner,url,title) VALUES('h','one','https://example.com/h','Other')");add('changed',fresh,fresh,0,'one','h');add('already-read',fresh,fresh);sql.exec("UPDATE articles SET read=0 WHERE id='changed'");
 await refreshNextFeed(db,'one',{markExistingRead:true,feed:'f'},async()=>{
  sql.exec("UPDATE articles SET saved=1,version=version+1 WHERE id='changed'");
  add('arrival',fresh,fresh,0,'one','h');sql.exec("UPDATE articles SET read=0 WHERE id='arrival'");
  return{url:'https://example.com/feed',title:'Feed',items:[item('new',fresh)]};
 },now);
 assert.deepEqual({...sql.prepare("SELECT read,saved,version FROM articles WHERE id='changed'").get()},{read:0,saved:1,version:8});
 assert.equal(sql.prepare("SELECT read FROM articles WHERE id='arrival'").get()?.read,0);
 assert.equal(sql.prepare("SELECT version FROM articles WHERE id='already-read'").get()?.version,7);
 assert.equal(sql.prepare("SELECT read FROM articles WHERE url='https://example.com/new'").get()?.read,0);sql.close();
});
