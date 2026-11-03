import {test} from 'node:test';import assert from 'node:assert/strict';import {downloadBackup} from '../lib/download-backup.ts';
test('backup download uses authenticated export; failed export never downloads or mutates',async()=>{
 const original={fetch:globalThis.fetch,document:globalThis.document,localStorage:globalThis.localStorage,create:URL.createObjectURL,revoke:URL.revokeObjectURL};let clicks=0,blob:Blob|undefined;
 try{Object.assign(globalThis,{localStorage:{getItem:()=>''},document:{createElement:()=>({click(){clicks++}})}});URL.createObjectURL=(b:any)=>{blob=b;return 'blob:test'};URL.revokeObjectURL=()=>{};
 globalThis.fetch=async(url:any,init:any)=>{assert.equal(url,'/api/backup');assert.equal(init.method,undefined);assert.equal(init.credentials,'omit');return Response.json({format:'reading-room',version:1,feeds:[],articles:[],presets:[]})};await downloadBackup();assert.equal(clicks,1);assert.equal(JSON.parse(await blob!.text()).format,'reading-room');globalThis.fetch=async()=>new Response(null,{status:401});await assert.rejects(downloadBackup());assert.equal(clicks,1);
 }finally{Object.assign(globalThis,{fetch:original.fetch,document:original.document,localStorage:original.localStorage});URL.createObjectURL=original.create;URL.revokeObjectURL=original.revoke}
});
