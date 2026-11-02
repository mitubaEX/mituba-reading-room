// 10 rows x 9 bound values = 90 parameters (< D1's 100 limit).
// At most 30 statements for a 300-entry feed, rather than 300 statements.
export function articleWrites(db:D1Database,rows:unknown[][]){
 const writes=[];for(let i=0;i<rows.length;i+=10){const group=rows.slice(i,i+10);writes.push(db.prepare('INSERT INTO articles (id,owner,feed,title,url,summary,image,published,added,read,saved,version) VALUES '+group.map(()=>'(?,?,?,?,?,?,?,?,?,0,0,0)').join(',')+' ON CONFLICT(id) DO UPDATE SET title=excluded.title,url=excluded.url,summary=excluded.summary,image=COALESCE(excluded.image,articles.image),published=excluded.published').bind(...group.flat()))}return writes;
}
