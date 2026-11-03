/** Called with the authenticated, fenced database; both deletes are atomic. */
export async function deleteFeed(db:D1Database,owner:string,id:unknown){
 if(typeof id!=='string'||!id||id.length>200)throw Error('フィードIDが不正です');
 const results=await db.batch([
  db.prepare('DELETE FROM articles WHERE owner=? AND feed=? AND EXISTS(SELECT 1 FROM feeds WHERE id=? AND owner=?)').bind(owner,id,id,owner),
  db.prepare('DELETE FROM feeds WHERE owner=? AND id=?').bind(owner,id),
 ]);
 return {ok:true,deleted:Number(results[1].meta.changes)>0};
}
