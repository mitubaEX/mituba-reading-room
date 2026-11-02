import {fetchPublic,safeUrl,loadFeed} from './feed.ts';
export function pageImage(html:string,base:string):string|null {
 const values=new Map<string,string>();
 // Metadata only: never evaluate scripts or choose arbitrary page images/logos.
 for(const tag of html.match(/<meta\b[^>]*>/gi)||[]){const attrs=Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/g)].map(m=>[m[1].toLowerCase(),m[2]??m[3]??m[4]]));const name=(attrs.property||attrs.name||'').toLowerCase();if(!values.has(name)&&attrs.content)values.set(name,attrs.content);}
 for(const name of ['og:image:secure_url','og:image','twitter:image','twitter:image:src']){const raw=values.get(name);if(!raw||raw.length>2048)continue;try{return safeUrl(raw.replace(/&amp;/g,'&').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Math.min(Number(n),0x10ffff))),base).href}catch{}}
 return null;
}
export async function discoverPageImage(url:string){const r=await fetchPublic(url,false,5000);if(!r.contentType.toLowerCase().includes('text/html'))return null;return pageImage(r.text,r.url)}
export async function enrichImages(db:D1Database,owner:string){
 const backfilled=await backfillFeedImages(db,owner);
 const now=Date.now();
 const rows=await db.prepare('SELECT id,url FROM articles WHERE owner=? AND image IS NULL AND (image_checked IS NULL OR image_checked<?) ORDER BY COALESCE(published,added) DESC LIMIT 2').bind(owner,now-86400000).all();
 if(!rows.results.length)return {updated:backfilled};
 // Atomic owner-level lease: at most 2 article pages per 10 minutes across tabs.
 const lease=await db.prepare('INSERT INTO image_runs(owner,next_allowed) VALUES (?,?) ON CONFLICT(owner) DO UPDATE SET next_allowed=excluded.next_allowed WHERE image_runs.next_allowed<=?').bind(owner,now+600000,now).run();
 if(!lease.meta.changes)return {updated:backfilled};

 let updated=0;const queue=[...rows.results];
 const work=async()=>{while(queue.length){const row:any=queue.shift();let image=null;try{image=await discoverPageImage(row.url)}catch{/* Failed attempts are cached for 24 hours; ingestion is independent. */}await db.prepare('UPDATE articles SET image=?,image_checked=? WHERE id=? AND owner=? AND image IS NULL').bind(image,now,row.id,owner).run();if(image)updated++}};
 await Promise.all([work(),work()]);return {updated:updated+backfilled};
}

// Upgrade existing pre-image articles from their feeds before per-page OG work.
// Bounded, independent of list GET, and never touches read/saved/version columns.
export async function backfillFeedImages(db:D1Database,owner:string){
 const feeds=await db.prepare('SELECT DISTINCT f.id,f.url FROM feeds f JOIN articles a ON a.feed=f.id AND a.owner=f.owner WHERE f.owner=? AND a.image IS NULL LIMIT 1').bind(owner).all();
 if(!feeds.results.length)return 0;
 const now=Date.now();const lease=await db.prepare('INSERT INTO image_runs(owner,next_allowed) VALUES (?,?) ON CONFLICT(owner) DO UPDATE SET next_allowed=excluded.next_allowed WHERE image_runs.next_allowed<=?').bind('feed:'+owner,now+600000,now).run();
 if(!lease.meta.changes)return 0;
 let count=0;
 await Promise.all(feeds.results.map(async(f:any)=>{try{const missing=await db.prepare('SELECT url FROM articles WHERE owner=? AND feed=? AND image IS NULL LIMIT 10').bind(owner,f.id).all();const urls=new Set(missing.results.map((r:any)=>r.url));const data=await loadFeed(f.url);let attempted=0;for(const a of data.items){if(!a.image||!urls.has(a.url)||attempted>=10)continue;attempted++;const result=await db.prepare('UPDATE articles SET image=? WHERE owner=? AND feed=? AND url=? AND image IS NULL').bind(a.image,owner,f.id,a.url).run();count+=result.meta.changes||0}}catch{/* Try again after cooldown; preserve all existing article data. */}}));
 return count;
}
