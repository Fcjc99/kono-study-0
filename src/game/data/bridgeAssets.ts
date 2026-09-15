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
  // Straight bridge, curved bridge, dock, curved stream and stepping stones were redrawn in v3
  // (style-matched to the rest of the pack) with new native dimensions; straight stream keeps its
  // original v1 art, since v3 didn't include a replacement for it.
  { id: 'bridge-straight-wooden', label: 'Straight Wooden Bridge', width: 441, height: 250, rotatable: true, flippable: true },
  { id: 'bridge-curved-wooden', label: 'Curved Wooden Bridge', width: 445, height: 228, rotatable: true, flippable: true },
  { id: 'dock-tiny-wooden-edge', label: 'Tiny Wooden Dock', width: 280, height: 315, rotatable: true, flippable: true },
  { id: 'stream-straight', label: 'Straight Stream', width: 350, height: 393, rotatable: true, flippable: true },
  { id: 'stream-curve', label: 'Curved Stream', width: 554, height: 376, rotatable: true, flippable: true },
  { id: 'stepping-stones-crossing', label: 'Stepping Stones Crossing', width: 450, height: 263, rotatable: true, flippable: false },
]

export const BRIDGE_ASSET_BY_ID = Object.fromEntries(BRIDGE_ASSETS.map(a => [a.id, a])) as Record<BridgeAssetId, BridgeAsset>

export const bridgeAssetTexturePath = (id: BridgeAssetId, phase: DayPhase): string =>
  `/garden/registered-22.8.6/bridges-water/${id}/${phase}.png`
