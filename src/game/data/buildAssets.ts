import type { DayPhase } from '../sanctuary/types'
import type { BuildPlacement } from '../../store/model'
import { ROAD_ASSETS, roadAssetTexturePath } from './roadAssets'
import { BRIDGE_ASSETS, bridgeAssetTexturePath } from './bridgeAssets'
import { HOME_STYLES, homeStyleTexturePath } from './homeStyles'
import { POND_STYLES, pondStyleTexturePath } from './pondStyles'
import { TREE_STYLES, treeStyleTexturePath } from './treeStyles'
import { LIGHT_ASSETS, lightAssetTexturePath } from './lightAssets'
import { STUDY_DECOR_ASSETS, studyDecorAssetTexturePath } from './studyDecorAssets'
import { BOBA_STAND_ASSETS, bobaStandAssetTexturePath } from './bobaStandAssets'
import { SIGN_ASSETS, signAssetTexturePath } from './signAssets'

export type BuildCategory=string
export type BuildLayer='ground'|'ground-detail'|'terrain'|'water-feature'|'water-decor'|'water-or-bridge'|'bridge'|'border'|'decor'|'structure'|'wildlife-water'|'light-overlay'
export type BuildSurface='grass'|'water'|'water-edge'|'water-gap'|'cliff-edge'|'cliff-or-water'
/** `src` is a single path for a style-invariant asset, or a per-day-phase map for one (every asset
 * pack since the roads pack) whose art changes with time of day. */
/** `signArea` (fractions of this asset's own width/height) marks the blank patch of art a player's
 * custom sign text renders over — only a handful of assets (a kiosk's arch sign, a chalkboard menu)
 * have one; everything else is plain decoration with no writable surface. */
export type BuildAsset={id:string;label:string;category:BuildCategory;categoryLabel:string;src:string|Record<DayPhase,string>;width:number;height:number;defaultScale:number;anchor:{x:number;y:number};surface:BuildSurface;layer:BuildLayer;rotatable:boolean;flippable:boolean;signArea?:{x:number;y:number;width:number;height:number}}

export const BUILD_CATEGORIES:BuildCategory[]=['homes','ponds','trees','paths','bridges','lights','study','cafe','signs']
export const BUILD_CATEGORY_LABELS:Record<BuildCategory,string>={homes:'Homes',ponds:'Ponds',trees:'Trees',paths:'Paths & Roads',bridges:'Bridges & Water',lights:'Lights & Lanterns',study:'Study Decor',cafe:'Boba Stand',signs:'Signs'}

const phaseSrc=(pathFor:(phase:DayPhase)=>string):Record<DayPhase,string>=>({
 morning:pathFor('morning'),
 afternoon:pathFor('afternoon'),
 evening:pathFor('evening'),
 night:pathFor('night'),
})

// Every placed decoration renders as a plain <img> sized as a fraction of the shared 1448-wide
// virtual island canvas (see SanctuaryBuild.tsx), so a road tile's native pixel width is already
// the right "footprint" to use as-is. Home/pond/tree style art, though, was painted onto a padded
// canvas much bigger than the house/pond/tree itself — contain-fitting the CONTENT box (not the
// padded canvas) into the same world-space footprint the old dedicated pickers used keeps a short
// wide style and a tall narrow one reading at a comparable size instead of one shrinking to fit the
// other's padding. This mirrors the contain-fit math the old Home/Pond/TreeEvolutionSystem classes
// used, just computed once here instead of every frame.
const HOME_BOX={w:500,h:450}
const POND_BOX={w:400,h:260}
const TREE_BOX={w:460,h:480}
const contentScale=(contentWidth:number,contentHeight:number,box:{w:number;h:number}):number=>Math.min(box.w/contentWidth,box.h/contentHeight)

const roadAssets:BuildAsset[]=ROAD_ASSETS.map(road=>({
 id:'road-'+road.id,
 label:road.label,
 category:'paths',
 categoryLabel:'Paths & Roads',
 src:phaseSrc(phase=>roadAssetTexturePath(road.id,phase)),
 width:road.width,
 height:road.height,
 defaultScale:1,
 anchor:{x:0.5,y:0.5},
 surface:'grass',
 layer:'ground-detail',
 rotatable:road.rotatable,
 flippable:road.flippable,
}))

const bridgeAssets:BuildAsset[]=BRIDGE_ASSETS.map(bridge=>({
 id:'bridge-'+bridge.id,
 label:bridge.label,
 category:'bridges',
 categoryLabel:'Bridges & Water',
 src:phaseSrc(phase=>bridgeAssetTexturePath(bridge.id,phase)),
 width:bridge.width,
 height:bridge.height,
 defaultScale:1,
 anchor:{x:0.5,y:0.5},
 surface:'water-edge',
 layer:'bridge',
 rotatable:bridge.rotatable,
 flippable:bridge.flippable,
}))

const homeAssets:BuildAsset[]=HOME_STYLES.map(style=>{
 const scale=contentScale(style.contentWidth,style.contentHeight,HOME_BOX)
 return {
  id:'home-'+style.id,
  label:style.label,
  category:'homes',
  categoryLabel:'Homes',
  src:phaseSrc(phase=>homeStyleTexturePath(style.id,phase)),
  width:style.width*scale,
  height:style.height*scale,
  defaultScale:1,
  anchor:{x:0.5,y:style.anchorY},
  surface:'grass',
  layer:'structure',
  rotatable:false,
  flippable:true,
 }
})

const pondAssets:BuildAsset[]=POND_STYLES.map(style=>{
 const scale=contentScale(style.contentWidth,style.contentHeight,POND_BOX)
 return {
  id:'pond-'+style.id,
  label:style.label,
  category:'ponds',
  categoryLabel:'Ponds',
  src:phaseSrc(phase=>pondStyleTexturePath(style.id,phase)),
  width:style.width*scale,
  height:style.height*scale,
  defaultScale:1,
  anchor:{x:0.5,y:style.anchorY},
  surface:'water',
  layer:'water-feature',
  rotatable:false,
  flippable:true,
 }
})

const treeAssets:BuildAsset[]=TREE_STYLES.map(style=>{
 const scale=contentScale(style.contentWidth,style.contentHeight,TREE_BOX)
 return {
  id:'tree-'+style.id,
  label:style.label,
  category:'trees',
  categoryLabel:'Trees',
  src:phaseSrc(phase=>treeStyleTexturePath(style.id,phase)),
  width:style.width*scale,
  height:style.height*scale,
  defaultScale:1,
  anchor:{x:0.5,y:style.anchorY},
  surface:'grass',
  layer:'decor',
  rotatable:false,
  flippable:true,
 }
})

const lightAssets:BuildAsset[]=LIGHT_ASSETS.map(light=>({
 id:'light-'+light.id,
 label:light.label,
 category:'lights',
 categoryLabel:'Lights & Lanterns',
 src:phaseSrc(phase=>lightAssetTexturePath(light.id,phase)),
 width:light.width,
 height:light.height,
 defaultScale:1,
 anchor:{x:0.5,y:0.95},
 surface:'grass',
 layer:'light-overlay',
 rotatable:light.rotatable,
 flippable:light.flippable,
}))

const studyDecorAssets:BuildAsset[]=STUDY_DECOR_ASSETS.map(item=>({
 id:'study-'+item.id,
 label:item.label,
 category:'study',
 categoryLabel:'Study Decor',
 src:phaseSrc(phase=>studyDecorAssetTexturePath(item.id,phase)),
 width:item.width,
 height:item.height,
 defaultScale:1,
 anchor:{x:0.5,y:0.95},
 surface:'grass',
 layer:'decor',
 rotatable:item.rotatable,
 flippable:item.flippable,
}))

const bobaStandAssets:BuildAsset[]=BOBA_STAND_ASSETS.map(item=>({
 id:'boba-'+item.id,
 label:item.label,
 category:'cafe',
 categoryLabel:'Boba Stand',
 src:phaseSrc(phase=>bobaStandAssetTexturePath(item.id,phase)),
 width:item.width,
 height:item.height,
 defaultScale:1,
 anchor:{x:0.5,y:0.95},
 surface:'grass',
 layer:'decor',
 rotatable:item.rotatable,
 flippable:item.flippable,
 signArea:item.signArea,
}))

const signAssets:BuildAsset[]=SIGN_ASSETS.map(item=>({
 id:'sign-'+item.id,
 label:item.label,
 category:'signs',
 categoryLabel:'Signs',
 src:phaseSrc(phase=>signAssetTexturePath(item.id,phase)),
 width:item.width,
 height:item.height,
 defaultScale:1,
 anchor:{x:0.5,y:0.95},
 surface:'grass',
 layer:'decor',
 rotatable:item.rotatable,
 flippable:item.flippable,
 signArea:item.signArea,
}))

export const BUILD_ASSETS:BuildAsset[]=[...homeAssets,...pondAssets,...treeAssets,...roadAssets,...bridgeAssets,...lightAssets,...studyDecorAssets,...bobaStandAssets,...signAssets]
export const BUILD_ASSET_BY_ID:Record<string,BuildAsset>=Object.fromEntries(BUILD_ASSETS.map(a=>[a.id,a]))

/** A placed item's box/transform, shared by the interactive Decorate editor and the read-only
 * island view so the two never drift out of sync on how a placement is actually drawn. */
export const buildItemStyle=(asset:BuildAsset,p:{x:number;y:number;rotation:number;scale:number;skewX:number;flipX:boolean}):Record<string,string>=>({
 left:(p.x*100)+'%',
 top:(p.y*100)+'%',
 width:(asset.width/1448*100)+'%',
 transformOrigin:`50% ${asset.anchor.y*100}%`,
 transform:`translate(-50%,-${asset.anchor.y*100}%) rotate(${p.rotation}deg) skewX(${p.skewX}deg) scale(${(p.flipX?-1:1)*p.scale},${p.scale})`,
})
export const buildAssetSrc=(asset:BuildAsset,phase:DayPhase):string=>typeof asset.src==='string'?asset.src:asset.src[phase]
export const signTextStyle=(asset:BuildAsset,flipX:boolean):Record<string,string>|null=>!asset.signArea?null:({
 left:(asset.signArea.x*100)+'%',
 top:(asset.signArea.y*100)+'%',
 width:(asset.signArea.width*100)+'%',
 height:(asset.signArea.height*100)+'%',
 transform:flipX?'scaleX(-1)':'none',
})
export const resolvePlacements=(placements:BuildPlacement[]):{placement:BuildPlacement;asset:BuildAsset}[]=>
 placements.map(placement=>({placement,asset:BUILD_ASSET_BY_ID[placement.assetId]})).filter((x):x is {placement:BuildPlacement;asset:BuildAsset}=>!!x.asset)
