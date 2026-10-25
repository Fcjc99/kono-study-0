/** KONO blast's face blocks: a photo you pick (your face, framed by dragging and zooming) shows in every block,
 * tinted in the block's color. It's cropped to a small square JPEG and kept on this device only (never sent
 * anywhere, not part of your plan). */
const KEY='kono-blast-face',SIZE=160

export function readBlastFace():string|null{try{return localStorage.getItem(KEY)}catch{return null}}
export function saveBlastFace(dataUrl:string|null){try{if(dataUrl)localStorage.setItem(KEY,dataUrl);else localStorage.removeItem(KEY)}catch{/* storage full or blocked */}}

/** How a photo is framed in the square: `zoom` 1 fits its short side, `x`/`y` move it (shares of the square). */
export type Frame={zoom:number;x:number;y:number}
/** Where the photo sits in a square of side `side`: its drawn size and top left. */
export function placement(w:number,h:number,side:number,f:Frame){
 const k=side/Math.min(w,h)*f.zoom,dw=w*k,dh=h*k
 return {dw,dh,dx:(side-dw)/2+f.x*side,dy:(side-dh)/2+f.y*side}
}
/** Keeps the photo covering the square (no empty edge). */
export function clampFrame(w:number,h:number,f:Frame):Frame{
 const zoom=Math.max(1,Math.min(4,f.zoom)),k=zoom/Math.min(w,h),mx=Math.max(0,(w*k-1)/2),my=Math.max(0,(h*k-1)/2)
 return {zoom,x:Math.max(-mx,Math.min(mx,f.x)),y:Math.max(-my,Math.min(my,f.y))}
}
/** A portrait's face is usually a little above the middle: the first frame. */
export const startFrame=(w:number,h:number):Frame=>clampFrame(w,h,{zoom:1.15,x:0,y:h>w?0.12:0})

/** Draws the framed photo into a small square JPEG (as a data URL). */
export function cropFace(img:CanvasImageSource&{width:number;height:number},f:Frame):string{
 const c=document.createElement('canvas');c.width=c.height=SIZE
 const g=c.getContext('2d')!,{dw,dh,dx,dy}=placement(img.width,img.height,SIZE,f)
 g.drawImage(img,dx,dy,dw,dh)
 return c.toDataURL('image/jpeg',0.86)
}
