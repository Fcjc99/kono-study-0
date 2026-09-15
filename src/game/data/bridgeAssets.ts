import type { DayPhase } from '../sanctuary/types'

export type BridgeAssetId =
  | 'bridge-straight-wooden'
  | 'bridge-curved-wooden'
  | 'dock-tiny-wooden-edge'
  | 'stream-straight'
  | 'stream-curve'
  | 'stepping-stones-crossing'

export type BridgeAsset = {
  id: BridgeAssetId
  label: string
  width: number
  height: number
  rotatable: boolean
  flippable: boolean
}

export const BRIDGE_ASSETS: BridgeAsset[] = [
  { id: 'bridge-straight-wooden', label: 'Straight Wooden Bridge', width: 410, height: 345, rotatable: true, flippable: true },
  { id: 'bridge-curved-wooden', label: 'Curved Wooden Bridge', width: 425, height: 370, rotatable: true, flippable: true },
  { id: 'dock-tiny-wooden-edge', label: 'Tiny Wooden Dock', width: 470, height: 355, rotatable: true, flippable: true },
  { id: 'stream-straight', label: 'Straight Stream', width: 350, height: 393, rotatable: true, flippable: true },
  { id: 'stream-curve', label: 'Curved Stream', width: 455, height: 400, rotatable: true, flippable: true },
  { id: 'stepping-stones-crossing', label: 'Stepping Stones Crossing', width: 475, height: 322, rotatable: true, flippable: false },
]

export const BRIDGE_ASSET_BY_ID = Object.fromEntries(BRIDGE_ASSETS.map(a => [a.id, a])) as Record<BridgeAssetId, BridgeAsset>

export const bridgeAssetTexturePath = (id: BridgeAssetId, phase: DayPhase): string =>
  `/garden/registered-22.8.6/bridges-water/${id}/${phase}.png`
