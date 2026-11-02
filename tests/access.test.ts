import {test} from 'node:test';import assert from 'node:assert/strict';import {generateKeyPair,SignJWT,exportJWK,createLocalJWKSet} from 'jose';import{verifyOwner}from'../lib/access-auth.ts';
test('Access identity: signed owner only, stable migration namespace, fail closed',async()=>{
 const {privateKey,publicKey}=await generateKeyPair('RS256');const key=createLocalJWKSet({keys:[{...await exportJWK(publicKey),kid:'test'}]});const config={ACCESS_TEAM_DOMAIN:'https://fixture.cloudflareaccess.com',ACCESS_AUD:'rss-only',OWNER_EMAIL:'owner@example.com',STORAGE_OWNER_ID:'legacy-owner'};
 const token=async(overrides:any={})=>new SignJWT({email:config.OWNER_EMAIL,sub:'access-sub',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+60,iss:config.ACCESS_TEAM_DOMAIN,aud:config.ACCESS_AUD,...overrides}).setProtectedHeader({alg:'RS256',kid:'test'}).sign(privateKey);
 const req=(t?:string)=>new Request('https://rss.example.com/api/reader',{headers:{...(t?{'cf-access-jwt-assertion':t}:{}),'oai-authenticated-user-id':'spoof','oai-authenticated-user-email':'owner@example.com','cf-access-authenticated-user-email':'owner@example.com'}});
 assert.equal((await verifyOwner(req(await token()),config,key))?.userId,'legacy-owner');assert.equal(await verifyOwner(req(),config,key),null);assert.equal(await verifyOwner(req('fake'),config,key),null);assert.equal(await verifyOwner(req(await token()),{},key),null);
 for(const bad of [{email:'other@example.com'},{aud:'another-app'},{iss:'https://evil.example'},{exp:1},{nbf:Math.floor(Date.now()/1000)+600},{sub:''}])assert.equal(await verifyOwner(req(await token(bad)),config,key),null);
 const foreign=await generateKeyPair('RS256');const forged=await new SignJWT({email:config.OWNER_EMAIL}).setProtectedHeader({alg:'RS256',kid:'test'}).sign(foreign.privateKey);assert.equal(await verifyOwner(req(forged),config,key),null);
 assert.equal(await verifyOwner(req(await token()),config,async()=>{throw Error('JWKS unavailable')}),null);
});
