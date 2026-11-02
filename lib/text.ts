// Feed text only: never apply entity decoding to IDs, URLs or authorization values.
const named:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',ensp:' ',emsp:' ',thinsp:' ',ndash:'–',mdash:'—',hellip:'…',lsquo:'‘',rsquo:'’',ldquo:'“',rdquo:'”',bull:'•',middot:'·',copy:'©',reg:'®',trade:'™',yen:'¥',euro:'€',pound:'£',cent:'¢'};
export function decodeTextEntities(value:string):string {
 // One bounded pass also handles up to two escaped ampersand layers. It does
 // not repeatedly interpret the output as markup or recursively expand input.
 return value.replace(/&(?:amp;){0,2}(#x[0-9a-f]{1,8}|#[0-9]{1,10}|[a-zA-Z]+);/gi,(original,entity:string)=>{
  if(entity[0]!=='#')return named[entity]??original;
  const point=entity[1].toLowerCase()==='x'?parseInt(entity.slice(2),16):parseInt(entity.slice(1),10);
  return point===0||point>0x10ffff||(point>=0xd800&&point<=0xdfff)?'\uFFFD':String.fromCodePoint(point);
 });
}
export function plainText(value:string):string {
 return decodeTextEntities(value.slice(0,2000000)).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,3000);
}
// Non-destructive compatibility for articles stored before entity decoding.
export function readerText<T extends {feeds:any[];articles:any[]}>(data:T):T {
 return {...data,feeds:data.feeds.map(f=>({...f,title:plainText(String(f.title??''))})),articles:data.articles.map(a=>({...a,title:plainText(String(a.title??'')),summary:plainText(String(a.summary??''))}))};
}
