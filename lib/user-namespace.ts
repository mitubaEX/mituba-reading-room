/** Input must come from a verified session, never from request JSON or email. */
export type VerifiedSubject = {issuer:string;subject:string};
export async function userNamespace(db:D1Database,identity:VerifiedSubject):Promise<string>{
 if(!/^https:\/\/[^/]+\/?$/.test(identity.issuer)||!identity.subject||identity.subject.length>256)throw Error('Invalid verified identity');
 // Legacy namespaces are assigned only by a separately approved migration.
 // A normal signup cannot claim a namespace by matching an email address.
 const proposed='user_'+crypto.randomUUID();
 await db.prepare('INSERT OR IGNORE INTO auth_identities(issuer,subject,owner) VALUES(?,?,?)').bind(identity.issuer,identity.subject,proposed).run();
 const row=await db.prepare('SELECT owner FROM auth_identities WHERE issuer=? AND subject=?').bind(identity.issuer,identity.subject).first<{owner:string}>();
 if(!row?.owner)throw Error('Identity storage unavailable');
 return row.owner;
}
/** Atomic fixed-window budget. Keys are server-generated; never store raw IPs. */
export async function consumeBudget(db:D1Database,key:string,limit:number,windowSeconds:number,now=Date.now()):Promise<boolean>{
 if(!Number.isInteger(limit)||limit<1||!Number.isInteger(windowSeconds)||windowSeconds<1)throw Error('Invalid budget');
 const window=Math.floor(now/(windowSeconds*1000));
 const row=await db.prepare(`INSERT INTO request_budgets(key,window,used) VALUES(?,?,1)
 ON CONFLICT(key) DO UPDATE SET window=excluded.window,used=CASE WHEN request_budgets.window=excluded.window THEN request_budgets.used+1 ELSE 1 END
 WHERE request_budgets.window<>excluded.window OR request_budgets.used<? RETURNING used`).bind(key,window,limit).first();
 return !!row;
}
