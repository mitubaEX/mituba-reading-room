// Read a private snapshot and validate an in-memory restore. Never connects remotely.
import {DatabaseSync} from 'node:sqlite';import{readFileSync}from'node:fs';import{createHash}from'node:crypto';import assert from'node:assert/strict';
const path=process.argv[2];if(!path)throw Error('Provide a private snapshot path outside the repository');
const snapshot=JSON.parse(readFileSync(path,'utf8'));const db=new DatabaseSync(':memory:');
for(const file of ['0000_public_chronomancer.sql','0001_complete_triathlon.sql','0002_special_omega_sentinel.sql','0003_tearful_rawhide_kid.sql','0004_owner_indexes.sql'])db.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
const tables=['feeds','articles','presets','image_runs'];const counts={};
for(const table of tables){const rows=snapshot.tables[table];assert.ok(Array.isArray(rows));const columns=db.prepare(`PRAGMA table_info(${table})`).all().map(x=>x.name);for(const row of rows){assert.deepEqual(Object.keys(row).sort(),[...columns].sort());db.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')})`).run(...columns.map(c=>row[c]));}const restored=db.prepare(`SELECT * FROM ${table}`).all().map(x=>({...x}));assert.deepEqual(restored,rows);counts[table]=rows.length;}
assert.equal(db.prepare('SELECT count(*) n FROM articles a LEFT JOIN feeds f ON a.feed=f.id AND a.owner=f.owner WHERE f.id IS NULL').get().n,0);
const owners=db.prepare('SELECT DISTINCT owner FROM feeds UNION SELECT DISTINCT owner FROM articles UNION SELECT DISTINCT owner FROM presets').all();assert.equal(owners.length,1);
const states=db.prepare('SELECT id,read,saved,version FROM articles ORDER BY id').all();console.log(JSON.stringify({verified:counts,ownerCount:owners.length,readingStateSha256:createHash('sha256').update(JSON.stringify(states)).digest('hex')}));db.close();
