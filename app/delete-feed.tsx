'use client';
import {useRef,useState} from 'react';
import {deletionFlow} from '../lib/delete-confirmation';
import {apiFetch} from '../lib/client-api';
import {downloadBackup} from '../lib/download-backup';
export default function DeleteFeed({feed,onDeleted,disabled}:{feed:{id:string;title:string};onDeleted:()=>Promise<void>;disabled:boolean}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[exported,setExported]=useState(false);const pending=useRef(false);const confirmDeletion=useRef(deletionFlow());
 async function run(action:()=>Promise<void>){if(pending.current)return;pending.current=true;setBusy(true);setError('');try{await action()}catch(e){setError((e as Error).message)}finally{pending.current=false;setBusy(false)}}
 async function remove(){await confirmDeletion.current(()=>window.confirm(`「${feed.title}」を削除しますか？\nこのフィードの記事・既読状態・あとで読むも削除されます。バックアップがなければ元に戻せません。\n他のフィードとプリセットは残ります。プリセットを再取り込みすると再登録される場合があります。`),()=>run(async()=>{const r=await apiFetch('/api/reader',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'deleteFeed',id:feed.id})});if(!r.ok){const data:any=await r.json();throw Error(data.error||'削除できませんでした')}await onDeleted();setOpen(false)}))}
 return <div><button disabled={disabled||busy} aria-label={`${feed.title}を削除`} onClick={()=>setOpen(v=>!v)}>削除…</button>{open&&<div role="group" aria-label="フィード削除の確認"><p>このフィードの記事・既読状態・あとで読むも削除されます。他のフィードとプリセットは残ります。プリセットの再取り込みで再登録される場合があります。</p><p>必要なら先に全体のバックアップを保存してください。私用データを含み、同期キーは含みません。</p><button disabled={busy||disabled} onClick={()=>run(async()=>{await downloadBackup();setExported(true)})}>削除前にバックアップを保存</button>{exported&&<p role="status">ダウンロードを開始しました。ファイルが保存されたことを確認してください。</p>}<button disabled={busy||disabled} onClick={remove}>削除の最終確認へ</button><button disabled={busy} onClick={()=>setOpen(false)}>キャンセル</button>{error&&<p role="alert">{error}</p>}</div>}</div>;
}
