import {AsyncLocalStorage} from 'node:async_hooks';
import type {SyncIdentity} from './sync-auth';
const context=new AsyncLocalStorage<SyncIdentity>();
export const getOwner=()=>context.getStore()??null;
export const withOwner=<T>(owner:SyncIdentity,run:()=>T)=>context.run(owner,run);
