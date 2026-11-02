import {plainText} from './text.ts';
import {XMLParser,XMLValidator} from 'fast-xml-parser';
import ipaddr from 'ipaddr.js';
export function safeUrl(raw:string,base?:string){const u=new URL(raw,base);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||(u.port&&!['80','443'].includes(u.port)))throw Error('公開HTTP(S) URLのみ登録できます');const h=u.hostname.replace(/\.$/,'');if(!h.includes('.')||h.includes(':')||ipaddr.isValid(h)||/(^|\.)(localhost|local|internal|test|invalid|onion)$/.test(h))throw Error('内部アドレスは取得できません');u.hash='';return u;}
export function publicIp(ip:string){try{return ipaddr.parse(ip).range()==='unicast'}catch{return false}}
async function checkDns(host:string,signal:AbortSignal){for(const type of ['A','AAAA']){const r=await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`,{headers:{accept:'application/dns-json'},signal});if(!r.ok)throw Error('DNS確認に失敗しました');const d:any=await r.json();if(d.Status!==0)throw Error('ホストを確認できません');const ips=(d.Answer||[]).filter((x:any)=>x.type===1||x.type===28);if(ips.some((x:any)=>!publicIp(x.data)))throw Error('内部ネットワークへの取得を拒否しました');if(type==='AAAA'&&!ips.length)continue;}}
export async function fetchPublic(raw:string, image=false, timeout=12000){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeout);try{let u=safeUrl(raw);for(let i=0;i<5;i++){await checkDns(u.hostname,controller.signal);const r=await fetch(u,{redirect:'manual',signal:controller.signal,headers:{accept:image?'image/webp,image/png,image/jpeg,image/gif':'application/rss+xml, application/atom+xml, application/xml, text/html;q=0.8','user-agent':'ReadingRoom/1.0'},credentials:'omit'});if([301,302,303,307,308].includes(r.status)){const next=r.headers.get('location');if(!next)throw Error('転送先がありません');u=safeUrl(next,u.href);await r.body?.cancel();continue}if(!r.ok)throw Error(`取得失敗 (HTTP ${r.status})`);if(Number(r.headers.get('content-length'))>2000000)throw Error('フィードが大きすぎます (2 MBまで)');const reader=r.body?.getReader();if(!reader)throw Error('本文が空です');const chunks=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2000000){await reader.cancel();throw Error('フィードが大きすぎます (2 MBまで)')}chunks.push(value)}const bytes=new Uint8Array(size);let pos=0;for(const c of chunks){bytes.set(c,pos);pos+=c.length}return {text:image?'':new TextDecoder().decode(bytes),bytes,url:u.href,contentType:r.headers.get('content-type')||''}}throw Error('転送回数が多すぎます')}finally{clearTimeout(timer)}}
const arr=(x:any)=>x==null?[]:Array.isArray(x)?x:[x];
const val=(x:any):string=>typeof x==='object'?(x?.['#text']||''):String(x??'');
export const plain=(s:any)=>plainText(val(s));
export function parseFeed(xml:string,base:string){if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('DTD・外部実体を含むXMLは拒否しました');if(XMLValidator.validate(xml)!==true)throw Error('XMLを解析できません');const data=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'@_',processEntities:true,parseTagValue:false}).parse(xml);const root=data.rss?.channel||data.feed||data['rdf:RDF'];if(!root)throw Error('RSS / Atomフィードが見つかりません');const items=arr(root.item||root.entry||data['rdf:RDF']?.item).slice(0,300).flatMap((x:any)=>{let link=arr(x.link).find((l:any)=>typeof l==='string'||(!l['@_rel']||l['@_rel']==='alternate'));link=typeof link==='object'?link['@_href']:link;try{const url=safeUrl(val(link),base).href;const date=val(x.pubDate||x.published||x.updated||x['dc:date']);return [{key:val(x.guid||x.id)||url,title:plain(x.title)||'無題',url,image:extractImage(x,base),summary:plain(x.description||x.summary||x.content||x['content:encoded']),published:date&&!isNaN(Date.parse(date))?new Date(date).toISOString():null}]}catch{return []}});return {title:plain(root.title||root.channel?.title)||new URL(base).hostname,items};}
export async function loadFeed(url:string){let r=await fetchPublic(url);if(/<html[\s>]/i.test(r.text)){const tags=r.text.match(/<link\b[^>]*>/gi)||[];let found='';for(const tag of tags){const attrs=Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*["']([^"']*)["']/g)].map(x=>[x[1].toLowerCase(),x[2]]));if(/alternate/i.test(attrs.rel||'')&&/application\/(rss|atom)\+xml/i.test(attrs.type||'')){found=safeUrl(attrs.href,r.url).href;break}}if(!found)throw Error('RSSを自動検出できません。フィードのURLを入力してください');r=await fetchPublic(found)}return {...parseFeed(r.text,r.url),url:r.url}}

// Keep only publicly addressable HTTP(S) candidates. DNS and every redirect are
// checked when the authenticated image endpoint retrieves the chosen candidate.
export function extractImage(entry:any,base:string):string|null {
  const media=[...arr(entry['media:thumbnail']),...arr(entry['media:content']),...arr(entry['media:group']?.['media:thumbnail']),...arr(entry['media:group']?.['media:content'])];
  const candidates=media.filter(x=>!x['@_medium']||x['@_medium']==='image').filter(x=>!x['@_type']||x['@_type'].startsWith('image/')).map(x=>x['@_url']);
  for(const e of [...arr(entry.enclosure),...arr(entry.link).filter(x=>x?.['@_rel']==='enclosure')]) if(e?.['@_type']?.startsWith('image/'))candidates.push(e['@_url']||e['@_href']);
  if(entry['webfeeds:cover']?.['@_image'])candidates.push(entry['webfeeds:cover']['@_image']);
  for(const html of [entry.description,entry.summary,entry.content,entry['content:encoded']]){
    for(const tag of val(html).match(/<img\b[^>]*>/gi)||[]){const match=tag.match(/\bsrc\s*=\s*(?:"([^"<>]+)"|'([^'<>]+)'|([^\s>"']+))/i);if(match)candidates.push(match[1]||match[2]||match[3]);}
  }
  for(const raw of candidates){if(typeof raw!=='string'||raw.length>2048)continue;try{return safeUrl(raw.replace(/&amp;/g,'&'),base).href}catch{}}
  return null;
}
export function imageMime(bytes:Uint8Array):string|null {
  if(bytes.length<12)return null;
  if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return 'image/jpeg';
  if([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return 'image/png';
  const first=new TextDecoder().decode(bytes.slice(0,12));
  if(first.startsWith('GIF87a')||first.startsWith('GIF89a'))return 'image/gif';
  if(first.startsWith('RIFF')&&first.slice(8)==='WEBP')return 'image/webp';
  return null;
}
