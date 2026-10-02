import type {CSSProperties} from 'react'
import {POSE_HEADS,outfitBox,outfitSrcFor} from '../game/data/konoOutfits'

/** KONO in a pose, wearing an outfit (or not), fitted into a square `size` px box: the KONO today card's
 * face and the wardrobe's previews. Uses the same placement as the island (game/data/konoOutfits). */
export default function KonoFace({pose,outfit,size,imgKey}:{pose:string;outfit?:string|null;size:number;imgKey?:string|number}){
 const name=pose.replace(/^.*\//,'').replace(/\.\w+$/,'')
 const head=POSE_HEADS[name],box=outfit&&head?outfitBox(name,outfit):null
 let hat:CSSProperties|null=null
 if(head&&box){
  const [w,h]=head.size,k=size/Math.max(w,h),ox=(size-w*k)/2,oy=(size-h*k)/2
  hat={left:ox+box.x*k,top:oy+box.y*k,width:box.w*k,height:box.h*k}
 }
 return <>
  <img key={imgKey} src={pose} alt=""/>
  {hat&&outfit&&<img className="kono-outfit" src={outfitSrcFor(outfit,name)} alt="" style={hat}/>}
 </>
}
