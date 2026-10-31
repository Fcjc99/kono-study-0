/** Whether this browser can draw 3D (WebGL) at all. */
export function webglWorks(){
 try{const c=document.createElement('canvas');return !!(c.getContext('webgl2')||c.getContext('webgl'))}catch{return false}
}
