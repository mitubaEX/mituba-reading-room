import {createRemoteJWKSet,jwtVerify,type JWTVerifyGetKey} from 'jose';
export type AccessConfig={ACCESS_TEAM_DOMAIN?:string;ACCESS_AUD?:string;OWNER_EMAIL?:string;STORAGE_OWNER_ID?:string};
export type OwnerIdentity={userId:string;email:string;displayName:string;fullName:null};
const resolvers=new Map<string,ReturnType<typeof createRemoteJWKSet>>();
export async function verifyOwner(request:Request,config:AccessConfig,key?:JWTVerifyGetKey):Promise<OwnerIdentity|null>{
 const {ACCESS_TEAM_DOMAIN:issuer,ACCESS_AUD:audience,OWNER_EMAIL:owner,STORAGE_OWNER_ID:storage}=config;
 if(!issuer||!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer)||!audience||!owner||!storage)return null;
 const token=request.headers.get('cf-access-jwt-assertion');if(!token||token.length>16384)return null;
 try{
  let resolver=key??resolvers.get(issuer);if(!resolver){resolver=createRemoteJWKSet(new URL(issuer+'/cdn-cgi/access/certs'),{timeoutDuration:5000,cooldownDuration:30000,cacheMaxAge:600000});resolvers.set(issuer,resolver as ReturnType<typeof createRemoteJWKSet>)}
  const {payload}=await jwtVerify(token,resolver,{issuer,audience,algorithms:['RS256'],requiredClaims:['exp','iat','sub','email'],clockTolerance:5});
  if(typeof payload.email!=='string'||payload.email.toLowerCase()!==owner.toLowerCase()||typeof payload.sub!=='string'||!payload.sub)return null;
  return {userId:storage,email:payload.email,displayName:payload.email,fullName:null};
 }catch{return null}
}
