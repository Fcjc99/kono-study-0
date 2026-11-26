/** Does `file` match an accept list like "image/*,.pdf"? (The browser's picker filters; a drop or paste doesn't.) */
export function accepts(accept:string|undefined,file:{name:string;type:string}){
 if(!accept)return true
 return accept.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean).some(a=>a.startsWith('.')?file.name.toLowerCase().endsWith(a):a.endsWith('/*')?file.type.toLowerCase().startsWith(a.slice(0,-1)):file.type.toLowerCase()===a)
}
