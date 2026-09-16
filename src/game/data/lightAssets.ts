import type { DayPhase } from '../sanctuary/types'

export type LightAssetId =
  | 'lantern-post'
  | 'hanging-lantern-hook'
  | 'paper-lantern-pair'
  | 'path-light-stake'
  | 'string-light-arch'
  | 'firefly-jar-stump'
  | 'campfire-ring'
  | 'moon-garden-lamp'

export type LightAsset = {
  id: LightAssetId
  label: string
  width: number
  height: number
  rotatable: boolean
  flippable: boolean
}

// v2 standalone pack — v1's assets were cropped tight to their art with visible edge cutoffs;
// v2 restores full padded canvases (much bigger raw dimensions) matching every other pack added
// since (study decor, signs), which likewise use their padded canvas size as-is.
export const LIGHT_ASSETS: LightAsset[] = [
  { id: 'lantern-post', label: 'Lantern Post', width: 621, height: 972, rotatable: true, flippable: true },
  { id: 'hanging-lantern-hook', label: 'Hanging Lantern', width: 670, height: 972, rotatable: true, flippable: true },
  { id: 'paper-lantern-pair', label: 'Paper Lantern Pair', width: 835, height: 674, rotatable: true, flippable: true },
  { id: 'path-light-stake', label: 'Path Light', width: 666, height: 951, rotatable: true, flippable: true },
  { id: 'string-light-arch', label: 'String Light Arch', width: 972, height: 902, rotatable: true, flippable: true },
  { id: 'firefly-jar-stump', label: 'Firefly Jar', width: 936, height: 972, rotatable: true, flippable: true },
  { id: 'campfire-ring', label: 'Campfire Ring', width: 851, height: 770, rotatable: true, flippable: true },
  { id: 'moon-garden-lamp', label: 'Moon Garden Lamp', width: 671, height: 972, rotatable: true, flippable: true },
]

export const LIGHT_ASSET_BY_ID = Object.fromEntries(LIGHT_ASSETS.map(a => [a.id, a])) as Record<LightAssetId, LightAsset>

export const lightAssetTexturePath = (id: LightAssetId, phase: DayPhase): string =>
  `/garden/registered-22.8.6/lights/${id}/${phase}.png`
