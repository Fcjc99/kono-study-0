import type { DayPhase } from '../sanctuary/types'
import { ROAD_ASSETS, roadAssetTexturePath } from './roadAssets'

export type BuildCategory=string
export type BuildLayer='ground'|'ground-detail'|'terrain'|'water-feature'|'water-decor'|'water-or-bridge'|'bridge'|'border'|'decor'|'structure'|'wildlife-water'|'light-overlay'
export type BuildSurface='grass'|'water'|'water-edge'|'water-gap'|'cliff-edge'|'cliff-or-water'
/** `src` is a single path for a style-invariant asset, or a per-day-phase map for one (like the
 * roads pack) whose art changes with time of day the same way home/pond/tree style art does. */
export type BuildAsset={id:string;label:string;category:BuildCategory;categoryLabel:string;src:string|Record<DayPhase,string>;width:number;height:number;defaultScale:number;anchor:{x:number;y:number};surface:BuildSurface;layer:BuildLayer;rotatable:boolean;flippable:boolean}

export const BUILD_CATEGORIES:BuildCategory[]=['paths']
export const BUILD_CATEGORY_LABELS:Record<BuildCategory,string>={paths:'Paths & Roads'}

const roadSrc=(id:Parameters<typeof roadAssetTexturePath>[0]):Record<DayPhase,string>=>({
 morning:roadAssetTexturePath(id,'morning'),
 afternoon:roadAssetTexturePath(id,'afternoon'),
 evening:roadAssetTexturePath(id,'evening'),
 night:roadAssetTexturePath(id,'night'),
})

export const BUILD_ASSETS:BuildAsset[]=ROAD_ASSETS.map(road=>({
 id:'road-'+road.id,
 label:road.label,
 category:'paths',
 categoryLabel:'Paths & Roads',
 src:roadSrc(road.id),
 width:road.width,
 height:road.height,
 defaultScale:1,
 anchor:{x:0.5,y:0.5},
 surface:'grass',
 layer:'ground-detail',
 rotatable:road.rotatable,
 flippable:road.flippable,
}))
export const BUILD_ASSET_BY_ID:Record<string,BuildAsset>=Object.fromEntries(BUILD_ASSETS.map(a=>[a.id,a]))
