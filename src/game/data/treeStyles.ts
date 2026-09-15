import type { DayPhase } from '../sanctuary/types'

export type TreeStyleId = 'round-leafy' | 'pine' | 'cherry-blossom' | 'willow' | 'fruit-tree' | 'bamboo-cluster'

export type TreeStyle = {
  id: TreeStyleId
  label: string
  blurb: string
  /** Full source canvas size, in px (identical across all four phase renders). */
  width: number
  height: number
  /** Content bounding box (alpha > 10), as fractions of the canvas — see homeStyles.ts for why this
   * matters: contain-fitting the padded canvas instead of the content would make a short wide style
   * and a tall narrow one shrink to very different apparent sizes. */
  contentWidth: number
  contentHeight: number
  anchorX: number
  anchorY: number
}

/**
 * Each is a flat final illustration with no growth stages — placed and duplicated freely as an
 * ordinary decoration (see buildAssets.ts), with its own morning/afternoon/evening/night art
 * swapped in as the sanctuary's time of day changes.
 */
export const TREE_STYLES: TreeStyle[] = [
  { id: 'round-leafy', label: 'Round Leafy Tree', blurb: 'Classic rounded canopy over a mossy base.', width: 1101, height: 1214, contentWidth: 989, contentHeight: 1113, anchorX: 0.5, anchorY: 0.9605 },
  { id: 'pine', label: 'Pine Tree', blurb: 'Tall evergreen with tiered needle branches.', width: 745, height: 1110, contentWidth: 633, contentHeight: 998, anchorX: 0.5, anchorY: 0.9495 },
  { id: 'cherry-blossom', label: 'Cherry Blossom Tree', blurb: 'Full bloom canopy with drifting pink petals.', width: 1243, height: 1265, contentWidth: 1178, contentHeight: 1193, anchorX: 0.5068, anchorY: 0.9628 },
  { id: 'willow', label: 'Willow Tree', blurb: 'Gently drooping branches over a curved trunk.', width: 1309, height: 1196, contentWidth: 1208, contentHeight: 1094, anchorX: 0.5042, anchorY: 0.9532 },
  { id: 'fruit-tree', label: 'Fruit Tree', blurb: 'Orchard tree heavy with ripe orange fruit.', width: 1168, height: 1293, contentWidth: 1056, contentHeight: 1202, anchorX: 0.5, anchorY: 0.9644 },
  { id: 'bamboo-cluster', label: 'Bamboo Cluster', blurb: 'Tall bamboo stalks in a tidy grove.', width: 1119, height: 1293, contentWidth: 1028, contentHeight: 1214, anchorX: 0.5094, anchorY: 0.959 },
]

export const treeStyleTexturePath = (styleId: TreeStyleId, phase: DayPhase): string => `/garden/registered-22.8.6/tree-styles/${styleId}/${phase}.png`
