import {XMLParser,XMLValidator} from 'fast-xml-parser';
import {safeUrl} from './feed.ts';
export type ImportEntry={url:string;title:string;folder:string};
export const IMPORT_LIMIT=500;
const clean=(x:unknown)=>String(x??'').replace(/<[^>]*>/g,'').replace(/[\x00-\x1f]/g,' ').trim().slice(0,200);
export function normalizeFeedUrl(raw:string){
 if(typeof raw!=='string'||raw.length>2048)throw Error('URLが長すぎるか不正です');
 const u=safeUrl(raw.trim());
 let decoded='';try{decoded=decodeURIComponent(u.href)}catch{throw Error('URLのエンコードが不正です')}
 if(/(?:token|secret|password|passwd|api[_-]?key|auth|signature|access[_-]?key|private)[=/?:_-]|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(decoded)||u.pathname.split('/').some(x=>/^[a-zA-Z0-9_-]{24,}$/.test(x)))throw Error('認証情報・私用URLの可能性があるため除外');
 for(const key of u.searchParams.keys())if(!['feed','format','type','cat','category','tag','author','limit','rss'].includes(key.toLowerCase()))throw Error('個別確認が必要なクエリ付きURLのため除外');
 u.searchParams.sort();return u.href;
}
export function validateEntries(input:unknown):ImportEntry[]{if(!Array.isArray(input)||input.length>IMPORT_LIMIT)throw Error('一度に500フィードまでです');return input.map(x=>{if(!x||typeof x.url!=='string')throw Error('フィード形式が不正です');return {url:normalizeFeedUrl(x.url),title:clean(x.title)||new URL(x.url).hostname,folder:clean(x.folder)}})}
export function parseOpml(xml:string){
 if(new TextEncoder().encode(xml).length>2000000)throw Error('OPMLは2MBまでです');
 if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('DTD・外部実体は使用できません');
 let depth=0,nodes=0;for(const tag of xml.match(/<\/?outline\b[^>]*>/gi)||[]){if(tag.startsWith('</'))depth--;else{nodes++;if(!tag.endsWith('/>'))depth++;}if(depth>20||nodes>2000)throw Error('階層または項目数が上限を超えています');}
 if(XMLValidator.validate(xml)!==true)throw Error('OPMLのXMLが不正です');
 const data=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'@_',processEntities:true,parseTagValue:false}).parse(xml);if(!data.opml||!Object.prototype.hasOwnProperty.call(data.opml,'body'))throw Error('OPMLのbodyがありません');
 const entries:ImportEntry[]=[];const issues:{title:string;reason:string}[]=[];const seen=new Set<string>();let duplicates=0;const folders=new Set<string>();
 const walk=(input:any,path:string[])=>{for(const x of input==null?[]:Array.isArray(input)?input:[input]){const label=clean(x['@_title']||x['@_text']);const raw=x['@_xmlUrl']||x['@_xmlurl'];if(raw){try{const url=normalizeFeedUrl(raw);if(seen.has(url)){duplicates++;continue}seen.add(url);entries.push({url,title:label||new URL(url).hostname,folder:path.join(' / ').slice(0,200)});if(path.length)folders.add(path.join(' / '));}catch(e){issues.push({title:'除外項目 '+(issues.length+1),reason:(e as Error).message})}}else if(x.outline)walk(x.outline,[...path,label||'フォルダ']);}};
 walk(data.opml.body.outline,[]);if(entries.length>IMPORT_LIMIT)throw Error('一度に500フィードまでです');return {entries,issues,duplicates,folders:[...folders]};
}
