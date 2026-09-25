/** Sends unexpected app errors to KONO support: at most a few per page load, never the same one twice,
 * and never anything from the person's plan (only the error text and which page it happened on). */
type Report={message:string;detail?:string;page?:string;appVersion?:string}
let send:((report:Report)=>Promise<void>)|null=null
let context:()=>{page?:string;appVersion?:string}=()=>({})
const seen=new Set<string>()
let installed=false

export function reportError(error:unknown,extra?:{page?:string;detail?:string}){
 if(!send||seen.size>=5)return
 const message=error instanceof Error?error.message:typeof error==='string'?error:'Unknown error'
 if(!message||seen.has(message)||/ResizeObserver loop|Load failed|NetworkError|Failed to fetch|AbortError/i.test(message))return
 seen.add(message)
 const detail=error instanceof Error?error.stack?.split('\n').slice(0,8).join('\n'):undefined
 void send({message,detail,...context(),...extra}).catch(()=>undefined)
}

export function installErrorReporter(sender:(report:Report)=>Promise<void>,getContext:()=>{page?:string;appVersion?:string}){
 send=sender;context=getContext
 if(installed)return
 installed=true
 window.addEventListener('error',event=>reportError(event.error??event.message))
 window.addEventListener('unhandledrejection',event=>reportError(event.reason))
}
