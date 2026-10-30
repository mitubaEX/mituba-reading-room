import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {fetchPublic,imageMime} from '../../../lib/feed';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 const user=await getChatGPTUser();if(!user)return new Response(null,{status:401});
 const id=new URL(req.url).searchParams.get('id');if(!id||!/^[a-f0-9]{64}$/.test(id))return new Response(null,{status:400});
 const row:any=await env.DB!.prepare('SELECT image FROM articles WHERE id=? AND owner=?').bind(id,user.userId).first();
 if(!row?.image)return new Response(null,{status:404});
 // Authorization occurs before cache access. Cache entries are never public routes.
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(row.image)))).map(x=>x.toString(16).padStart(2,'0')).join('');
 const key=new Request(new URL('/__internal_image_cache/'+id+'/'+digest,req.url));const cache=(caches as any).default;
 let cached:Response|undefined;try{cached=await cache?.match(key)}catch{}
 if(cached){const result=new Response(cached.body,cached);result.headers.set('X-Reader-Image-Cache','hit');result.headers.set('Cache-Control',cached.ok?'private, max-age=3600':'no-store');return result}
 let response:Response;
 try{const {bytes}=await fetchPublic(row.image,true,7000);const mime=imageMime(bytes);if(!mime)throw Error('Unsupported raster image');
 response=new Response(bytes,{headers:{'Content-Type':mime,'Content-Length':String(bytes.length),'Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Cross-Origin-Resource-Policy':'same-origin','Referrer-Policy':'no-referrer'}});
 }catch{response=new Response(null,{status:502,headers:{'Cache-Control':'public, max-age=300'}})}
 try{await cache?.put(key,response.clone())}catch{}
 response.headers.set('X-Reader-Image-Cache','miss');response.headers.set('Cache-Control',response.ok?'private, max-age=3600':'no-store');return response;
}
