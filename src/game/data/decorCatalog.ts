/**
 * Placeholder decoration catalog — swatch color + label only, no real art yet.
 * Once hand-drawn assets exist (see SanctuaryBuildStudio, ?page=build), each entry's
 * id stays the same and a real sprite reference replaces the swatch color here.
 */
export type DecorOption = { id: string; label: string; swatch: string }
export type DecorCategory = 'houseStyle' | 'door' | 'window' | 'chimney' | 'exteriorDecor' | 'tree' | 'pondItems' | 'terraceItems'

export const DECOR_CATALOG: Record<DecorCategory, DecorOption[]> = {
  houseStyle: [
    { id: 'cottage-thatch', label: 'Thatched cottage', swatch: '#c9a066' },
    { id: 'cottage-stone', label: 'Stone cottage', swatch: '#9aa5ad' },
    { id: 'cottage-timber', label: 'Timber cottage', swatch: '#8a6a4f' },
  ],
  door: [
    { id: 'door-red', label: 'Red door', swatch: '#b0473f' },
    { id: 'door-blue', label: 'Blue door', swatch: '#3f6ab0' },
  ],
  window: [
    { id: 'window-round', label: 'Round window', swatch: '#dce7ea' },
    { id: 'window-shuttered', label: 'Shuttered window', swatch: '#7a9e7e' },
  ],
  chimney: [
    { id: 'chimney-brick', label: 'Brick chimney', swatch: '#a1543f' },
    { id: 'chimney-stone', label: 'Stone chimney', swatch: '#8b8e91' },
  ],
  exteriorDecor: [
    { id: 'flower-boxes', label: 'Flower boxes', swatch: '#d97fa8' },
    { id: 'vine-trellis', label: 'Vine trellis', swatch: '#5f8f52' },
    { id: 'lantern-string', label: 'Lantern string', swatch: '#e8b652' },
  ],
  tree: [
    { id: 'tree-cherry', label: 'Cherry blossom', swatch: '#f0a8bc' },
    { id: 'tree-maple', label: 'Maple', swatch: '#c15a2e' },
    { id: 'tree-pine', label: 'Pine', swatch: '#3f6b4a' },
  ],
  pondItems: [
    { id: 'lily-pads', label: 'Lily pads', swatch: '#6fae63' },
    { id: 'stepping-stones', label: 'Stepping stones', swatch: '#8b8577' },
    { id: 'reeds', label: 'Reeds', swatch: '#a3a84f' },
  ],
  terraceItems: [
    { id: 'tea-table', label: 'Tea table', swatch: '#a9764e' },
    { id: 'rug-woven', label: 'Woven rug', swatch: '#c26b4f' },
    { id: 'bench', label: 'Bench', swatch: '#8a6a4f' },
    { id: 'wind-chime', label: 'Wind chime', swatch: '#cbb677' },
  ],
}

export const DECOR_CATEGORY_LABELS: Record<DecorCategory, string> = {
  houseStyle: 'House style',
  door: 'Door',
  window: 'Window',
  chimney: 'Chimney',
  exteriorDecor: 'Exterior decorations',
  tree: 'Tree',
  pondItems: 'Pond decorations',
  terraceItems: 'Terrace furniture',
}

export const DECOR_SINGLE_SELECT: readonly DecorCategory[] = ['houseStyle', 'door', 'window', 'chimney', 'tree']
export const DECOR_MULTI_SELECT: readonly DecorCategory[] = ['exteriorDecor', 'pondItems', 'terraceItems']
