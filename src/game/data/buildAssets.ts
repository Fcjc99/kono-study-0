/** The decoration asset pack was pulled after the last import came out visually poor (bad crops,
 * style mismatch with the pixel-art Sanctuary). The live-scene overlay, placement, drag, resize, skew
 * and rotate machinery in SanctuaryBuild.tsx all stay intact and asset-agnostic — dropping a new pack
 * in here (regenerated the same way, from a placement-metadata.json manifest) is all that's needed to
 * repopulate the palette. */
export type BuildCategory=string
export type BuildLayer='ground'|'ground-detail'|'terrain'|'water-feature'|'water-decor'|'water-or-bridge'|'bridge'|'border'|'decor'|'structure'|'wildlife-water'|'light-overlay'
export type BuildSurface='grass'|'water'|'water-edge'|'water-gap'|'cliff-edge'|'cliff-or-water'
export type BuildAsset={id:string;label:string;category:BuildCategory;categoryLabel:string;src:string;width:number;height:number;defaultScale:number;anchor:{x:number;y:number};surface:BuildSurface;layer:BuildLayer;rotatable:boolean;flippable:boolean}

export const BUILD_CATEGORIES:BuildCategory[]=[]
export const BUILD_CATEGORY_LABELS:Record<BuildCategory,string>={}
export const BUILD_ASSETS:BuildAsset[]=[]
export const BUILD_ASSET_BY_ID:Record<string,BuildAsset>=Object.fromEntries(BUILD_ASSETS.map(a=>[a.id,a]))
