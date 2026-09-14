import type { DayPhase } from '../sanctuary/types'

export type RoadAssetId =
  | 'straight-horizontal'
  | 'straight-vertical'
  | 'diagonal'
  | 'soft-curve'
  | 'corner-l'
  | 't-junction'
  | 'crossroad'
  | 'door-connector-stairs'
  | 'pond-connector'
  | 'small-plaza-patch'

export type RoadAsset = {
  id: RoadAssetId
  label: string
  width: number
  height: number
  rotatable: boolean
  flippable: boolean
}

export const ROAD_ASSETS: RoadAsset[] = [
  { id: 'straight-horizontal', label: 'Straight Path', width: 466, height: 172, rotatable: true, flippable: true },
  { id: 'straight-vertical', label: 'Straight Path (Vertical)', width: 215, height: 461, rotatable: true, flippable: true },
  { id: 'diagonal', label: 'Diagonal Path', width: 315, height: 331, rotatable: true, flippable: true },
  { id: 'soft-curve', label: 'Curved Path', width: 296, height: 356, rotatable: true, flippable: true },
  { id: 'corner-l', label: 'Corner Path', width: 227, height: 292, rotatable: true, flippable: true },
  { id: 't-junction', label: 'T-Junction Path', width: 292, height: 240, rotatable: true, flippable: true },
  { id: 'crossroad', label: 'Crossroad Path', width: 256, height: 320, rotatable: true, flippable: true },
  { id: 'door-connector-stairs', label: 'Doorway Steps', width: 192, height: 304, rotatable: true, flippable: false },
  { id: 'pond-connector', label: 'Pond Path Connector', width: 228, height: 315, rotatable: true, flippable: false },
  { id: 'small-plaza-patch', label: 'Small Plaza Patch', width: 183, height: 270, rotatable: false, flippable: false },
]

export const ROAD_ASSET_BY_ID = Object.fromEntries(ROAD_ASSETS.map(a => [a.id, a])) as Record<RoadAssetId, RoadAsset>

export const roadAssetTexturePath = (id: RoadAssetId, phase: DayPhase): string =>
  `/garden/registered-22.8.6/roads/${id}/${phase}.png`
