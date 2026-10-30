import assert from 'node:assert/strict';
const base='http://127.0.0.1:5189';
const login=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});const cookie=login.headers.get('set-cookie').split(';')[0];
async function call(body,auth=cookie){const r=await fetch(base+'/api/reader',{method:body?'POST':'GET',headers:{cookie:auth,origin:base,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()}}
assert.equal((await call(null,'')).status,401);
let d=(await call()).data;assert.equal(d.feeds.length,1);assert.equal(d.articles.length,20);const a=d.articles[0];
assert.equal((await call({action:'state',id:a.id,field:'read',value:1,version:a.version})).status,200);
assert.equal((await call({action:'state',id:a.id,field:'saved',value:1,version:a.version})).status,409);
d=(await call()).data;let updated=d.articles.find(x=>x.id===a.id);assert.equal(updated.read,1);
assert.equal((await call({action:'state',id:a.id,field:'saved',value:1,version:updated.version})).status,200);
await call({action:'refresh'});d=(await call()).data;assert.equal(d.articles.length,20);updated=d.articles.find(x=>x.id===a.id);assert.equal(updated.read,1);assert.equal(updated.saved,1);
await call({action:'add',url:'https://kai-you.net/contents/feed.rss'});assert.equal((await call()).data.feeds.length,1);
assert.equal((await call({action:'add',url:'http://127.0.0.1/'})).status,400);
assert.equal((await call({action:'add',url:'https://kai-you.net/not-a-feed-nonexistent'})).status,400);
await call({action:'readAll',items:d.articles.map(x=>({id:x.id,version:x.version}))});d=(await call()).data;assert.ok(d.articles.every(x=>x.read===1));
const csrf=await fetch(base+'/api/reader',{method:'POST',headers:{cookie,origin:'https://evil.example','content-type':'application/json'},body:'{"action":"refresh"}'});assert.equal(csrf.status,403);
console.log('PASS anonymous 401, real feed 20, state persistence, saved persistence, stale-version 409, refresh dedupe, subscription dedupe, SSRF rejection, failed feed, bulk-read, CSRF 403');
