let key='';
export function setSyncKey(value:string){key=value;if(value)localStorage.setItem('reading-room-sync-key',value);else localStorage.removeItem('reading-room-sync-key')}
export function readSyncKey(){return key||localStorage.getItem('reading-room-sync-key')||''}
export function apiFetch(url:string,options:RequestInit={}){const headers=new Headers(options.headers);headers.set('Authorization','Bearer '+readSyncKey());return fetch(url,{...options,headers,credentials:'omit',cache:'no-store'})}
