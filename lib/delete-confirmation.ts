// The in-flight flag is set before confirmation, including rapid repeated clicks.
export function deletionFlow(){let pending=false;return async(confirm:()=>boolean,remove:()=>Promise<void>)=>{if(pending)return;pending=true;try{if(confirm())await remove()}finally{pending=false}}}
