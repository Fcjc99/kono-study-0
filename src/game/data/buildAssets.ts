import type { DayPhase } from '../sanctuary/types'
import type { BuildPlacement, SignTextFont } from '../../store/model'
import { ROAD_ASSETS, roadAssetTexturePath } from './roadAssets'
import { BRIDGE_ASSETS, bridgeAssetTexturePath } from './bridgeAssets'
import { HOME_STYLES, homeStyleTexturePath } from './homeStyles'
import { POND_STYLES, pondStyleTexturePath } from './pondStyles'
import { TREE_STYLES, treeStyleTexturePath } from './treeStyles'
import { LIGHT_ASSETS, lightAssetTexturePath } from './lightAssets'
import { STUDY_DECOR_ASSETS, studyDecorAssetTexturePath } from './studyDecorAssets'
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

export const BUILD_CATEGORIES:BuildCategory[]=['homes','ponds','trees','paths','bridges','lights','study','signs']
export const BUILD_CATEGORY_LABELS:Record<BuildCategory,string>={homes:'Homes',ponds:'Ponds',trees:'Trees',paths:'Paths & Roads',bridges:'Bridges & Water',lights:'Lights & Lanterns',study:'Study Decor',signs:'Signs'}

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

export const BUILD_ASSETS:BuildAsset[]=[...homeAssets,...pondAssets,...treeAssets,...roadAssets,...bridgeAssets,...lightAssets,...studyDecorAssets,...signAssets]
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
/** A sign's writable text has its own optional look (size/color/font, all on the placement itself,
 * independent of the asset's overall scale) — these are the values it falls back to when the player
 * hasn't customized them. 'hand' matches the signs' rustic, hand-lettered art style by default. */
export const SIGN_TEXT_DEFAULTS={size:1,color:'#4b342a',font:'hand'} as const
export const SIGN_TEXT_FONT_FAMILIES:Record<SignTextFont,string>={
 hand:"'Caveat',cursive",
 serif:"'Newsreader',serif",
 sans:"'DM Sans',system-ui,sans-serif",
}
export const signTextStyle=(asset:BuildAsset,placement:Pick<BuildPlacement,'flipX'|'textSize'|'textColor'|'textFont'>):Record<string,string>|null=>!asset.signArea?null:({
 left:(asset.signArea.x*100)+'%',
 top:(asset.signArea.y*100)+'%',
 width:(asset.signArea.width*100)+'%',
 height:(asset.signArea.height*100)+'%',
 transform:placement.flipX?'scaleX(-1)':'none',
 fontSize:(placement.textSize??SIGN_TEXT_DEFAULTS.size)+'em',
 color:placement.textColor??SIGN_TEXT_DEFAULTS.color,
 fontFamily:SIGN_TEXT_FONT_FAMILIES[placement.textFont??SIGN_TEXT_DEFAULTS.font],
})
export const resolvePlacements=(placements:BuildPlacement[]):{placement:BuildPlacement;asset:BuildAsset}[]=>
 placements.map(placement=>({placement,asset:BUILD_ASSET_BY_ID[placement.assetId]})).filter((x):x is {placement:BuildPlacement;asset:BuildAsset}=>!!x.asset)

/** Layers KONO can walk across freely — a path tile or bridge deck is meant to be stood on, not
 * avoided, so only everything else (a building, tree, pond feature, or other ground-level decor)
 * turns into a no-go footprint for the mascot's pathing. */
const WALKABLE_LAYERS=new Set<BuildLayer>(['ground','ground-detail','terrain','bridge','water-or-bridge','border','wildlife-water'])
const WORLD_REFERENCE_WIDTH=1448
const clampValue=(value:number,min:number,max:number):number=>Math.min(max,Math.max(min,value))
export type MascotObstacle={x:number;y:number;rx:number;ry:number}
/** placement.x/y already sit at the asset's own anchor point (see buildItemStyle) — usually the
 * object's base on the ground — so that point doubles as the obstacle's center with no extra math.
 * The blocking radius is a fraction of the asset's on-screen width, not its full footprint: most
 * sprites carry transparent padding or an overhanging canopy that KONO can still walk near, and a
 * radius matching the whole sprite would make wide/tall decorations block far more ground than
 * they actually occupy. Flattened vertically to roughly match the island's isometric perspective,
 * the same ratio the terrain's own hardcoded pond exclusion uses. */
export const obstacleFootprint=(asset:BuildAsset,placement:Pick<BuildPlacement,'x'|'y'|'scale'>):MascotObstacle|null=>{
 if(WALKABLE_LAYERS.has(asset.layer))return null
 const rx=clampValue((asset.width/WORLD_REFERENCE_WIDTH)*placement.scale*0.28,0.02,0.12)
 return {x:placement.x,y:placement.y,rx,ry:rx*0.55}
}
export const mascotObstacles=(placements:BuildPlacement[]):MascotObstacle[]=>
 resolvePlacements(placements).map(({placement,asset})=>obstacleFootprint(asset,placement)).filter((o):o is MascotObstacle=>!!o)
