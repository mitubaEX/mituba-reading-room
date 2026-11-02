import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {userNamespace,consumeBudget} from '../lib/user-namespace.ts';
function fixture(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../drizzle/0005_user_identity.sql',import.meta.url),'utf8'));
 const db:any={prepare(sql:string){return{bind(...args:any[]){return{async run(){return sqlite.prepare(sql).run(...args)},async first(){return sqlite.prepare(sql).get(...args)??null}}}}}};
 return{db,sqlite};
}
test('stable server identity, separate issuers/users; legacy namespace only through explicit mapping',async()=>{
 const {db,sqlite}=fixture();const a={issuer:'https://auth.example',subject:'a'},b={...a,subject:'b'};
 const first=await userNamespace(db,a);assert.equal(await userNamespace(db,a),first);
 assert.notEqual(await userNamespace(db,b),first);assert.notEqual(await userNamespace(db,{...a,issuer:'https://other.example'}),first);
 sqlite.prepare('INSERT INTO auth_identities VALUES(?,?,?)').run(a.issuer,'verified-migration-owner','legacy-owner');
 assert.equal(await userNamespace(db,{...a,subject:'verified-migration-owner'}),'legacy-owner');
 assert.notEqual(first,'legacy-owner');await assert.rejects(userNamespace(db,{...a,subject:''}));
 sqlite.close();
});
test('atomic budgets reject over-limit, isolate users and reset after window',async()=>{
 const {db,sqlite}=fixture();const outcomes=await Promise.all(Array.from({length:20},()=>consumeBudget(db,'user-a:refresh',3,60,1000)));
 assert.equal(outcomes.filter(Boolean).length,3);assert.equal(await consumeBudget(db,'user-b:refresh',3,60,1000),true);
 assert.equal(await consumeBudget(db,'user-a:refresh',3,60,61000),true);sqlite.close();
});
