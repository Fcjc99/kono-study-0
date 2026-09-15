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

export const LIGHT_ASSETS: LightAsset[] = [
  { id: 'lantern-post', label: 'Lantern Post', width: 190, height: 440, rotatable: true, flippable: true },
  { id: 'hanging-lantern-hook', label: 'Hanging Lantern', width: 225, height: 345, rotatable: true, flippable: true },
  { id: 'paper-lantern-pair', label: 'Paper Lantern Pair', width: 375, height: 365, rotatable: true, flippable: true },
  { id: 'path-light-stake', label: 'Path Light', width: 182, height: 275, rotatable: true, flippable: true },
  { id: 'string-light-arch', label: 'String Light Arch', width: 435, height: 400, rotatable: true, flippable: true },
  { id: 'firefly-jar-stump', label: 'Firefly Jar', width: 245, height: 315, rotatable: true, flippable: true },
  { id: 'campfire-ring', label: 'Campfire Ring', width: 295, height: 198, rotatable: true, flippable: true },
  { id: 'moon-garden-lamp', label: 'Moon Garden Lamp', width: 201, height: 380, rotatable: true, flippable: true },
]

export const LIGHT_ASSET_BY_ID = Object.fromEntries(LIGHT_ASSETS.map(a => [a.id, a])) as Record<LightAssetId, LightAsset>

export const lightAssetTexturePath = (id: LightAssetId, phase: DayPhase): string =>
  `/garden/registered-22.8.6/lights/${id}/${phase}.png`
