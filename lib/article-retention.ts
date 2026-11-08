import {articleWrites} from './article-writes.ts';
import {digest} from './sync-auth.ts';
import {loadFeed,type parseFeed} from './feed.ts';
export const RETENTION_MS = 48 * 60 * 60 * 1000;
// julianday handles ISO offsets in restored backups as well as normalized dates.
export const articleTimeSql = 'COALESCE(julianday(published),julianday(added))';
export function retentionCutoff(now = Date.now()) { return new Date(now - RETENTION_MS).toISOString(); }

/** Fetch must succeed before calling. All content changes and expiry share a transaction. */
export async function storeFreshFeed(db:D1Database, owner:string, feed:string, data:ReturnType<typeof parseFeed>, now = Date.now()) {
  const timestamp = new Date(now).toISOString();
  const known = await db.prepare('SELECT id,url,published,added,saved FROM articles WHERE owner=? AND feed=?').bind(owner,feed).all<any>();
  const expired = await db.prepare('SELECT id,url FROM article_expirations WHERE owner=? AND feed=?').bind(owner,feed).all<any>();
  const byUrl = new Map(known.results.map(a=>[a.url,a]));
  const byId = new Map(known.results.map(a=>[a.id,a]));
  const expiredIds = new Set(expired.results.map(a=>a.id));
  const expiredUrls = new Set(expired.results.map(a=>a.url));
  const rows:unknown[][]=[];
  for (const a of data.items.slice(0,200)) {
    const key = await digest(owner+'|'+feed+'|'+a.key);
    const existing = byUrl.get(a.url) || byId.get(key);
    if (!existing && (expiredIds.has(key) || expiredUrls.has(a.url))) continue;
    // A changed/missing feed date must not reset an existing article's age.
    const original = existing && (Number.isFinite(Date.parse(existing.published)) ? existing.published : existing.added);
    const times = [original,a.published].map(v=>v?Date.parse(v):NaN).filter(Number.isFinite);
    const published = (a.published || existing?.published) && times.length ? new Date(Math.min(now,...times)).toISOString() : null;
    rows.push([existing?.id || key,owner,feed,a.title,a.url,a.summary,a.image,published,existing?.added || timestamp]);
  }
  const expiredWhere = `owner=? AND feed=? AND saved=0 AND ${articleTimeSql}<julianday(?)`;
  const cutoff = retentionCutoff(now);
  await db.batch([
    ...articleWrites(db,rows),
    db.prepare(`INSERT OR IGNORE INTO article_expirations(owner,feed,id,url) SELECT owner,feed,id,url FROM articles WHERE ${expiredWhere}`).bind(owner,feed,cutoff),
    db.prepare(`DELETE FROM articles WHERE ${expiredWhere}`).bind(owner,feed,cutoff),
    db.prepare('UPDATE feeds SET title=?,checked=?,success=?,error=NULL WHERE id=? AND owner=?').bind(data.title,timestamp,timestamp,feed,owner),
  ]);
}

export async function refreshFeed(db:D1Database,owner:string,feed:{id:string;url:string},loader=loadFeed,now=Date.now()) {
  try {
    const data=await loader(feed.url);
    await storeFreshFeed(db,owner,feed.id,data,now);
    return null;
  } catch(e) {
    const error=e instanceof Error?e.message:'取得に失敗しました';
    await db.prepare('UPDATE feeds SET checked=?,error=? WHERE id=? AND owner=?').bind(new Date(now).toISOString(),error,feed.id,owner).run();
    return error;
  }
}
