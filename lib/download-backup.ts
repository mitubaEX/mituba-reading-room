import {apiFetch} from './client-api.ts';
export async function downloadBackup(){
 const response=await apiFetch('/api/backup');
 if(!response.ok)throw Error('バックアップを書き出せませんでした。削除せずに再試行してください');
 const blob=await response.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='reading-room-'+new Date().toISOString().slice(0,10)+'.json';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
