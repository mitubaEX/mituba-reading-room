// Legacy component names; identity is verified by sync-key middleware.
import {getOwner} from '../lib/owner-context';
export async function getChatGPTUser(){return getOwner()}
export async function requireChatGPTUser(_returnTo:string){const user=getOwner();if(!user)throw Error('同期キーで接続してください');return user}
