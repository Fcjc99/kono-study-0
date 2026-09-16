import type { DayPhase } from '../sanctuary/types'

export type SignAssetId =
  | 'small-wooden-arrow'
  | 'large-message-board'
  | 'cork-note-board'
  | 'chalkboard-stand'
  | 'hanging-oval-sign'
  | 'stone-plaque'
  | 'scroll-parchment'
  | 'friendship-card-stand'

export type SignAsset = {
  id: SignAssetId
  label: string
  width: number
  height: number
  rotatable: boolean
  flippable: boolean
  signArea: { x: number; y: number; width: number; height: number }
}

// signArea values are measured directly against each asset's rendered artwork (sampled the writable
// panel's fill color and traced its actual bounds), not authored/eyeballed — the previous values came
// from an asset manifest that no longer matches the shipped art and placed text off the visible panel
// on several signs (most visibly the hanging oval sign, where text landed in the leaves above the board).
export const SIGN_ASSETS: SignAsset[] = [
  { id: 'small-wooden-arrow', label: 'Wooden Arrow Sign', width: 859, height: 900, rotatable: true, flippable: true, signArea: { x: 0.13, y: 0.23, width: 0.72, height: 0.22 } },
  { id: 'large-message-board', label: 'Large Message Board', width: 900, height: 601, rotatable: true, flippable: true, signArea: { x: 0.3, y: 0.3, width: 0.4, height: 0.3 } },
  { id: 'cork-note-board', label: 'Cork Note Board', width: 900, height: 716, rotatable: true, flippable: true, signArea: { x: 0.27, y: 0.34, width: 0.48, height: 0.34 } },
  { id: 'chalkboard-stand', label: 'Chalkboard Stand', width: 900, height: 877, rotatable: true, flippable: true, signArea: { x: 0.25, y: 0.25, width: 0.5, height: 0.48 } },
  { id: 'hanging-oval-sign', label: 'Hanging Oval Sign', width: 900, height: 626, rotatable: true, flippable: true, signArea: { x: 0.36, y: 0.48, width: 0.44, height: 0.26 } },
  { id: 'stone-plaque', label: 'Stone Plaque', width: 900, height: 558, rotatable: true, flippable: true, signArea: { x: 0.23, y: 0.23, width: 0.59, height: 0.47 } },
  { id: 'scroll-parchment', label: 'Scroll Parchment', width: 900, height: 590, rotatable: true, flippable: true, signArea: { x: 0.3, y: 0.25, width: 0.46, height: 0.32 } },
  { id: 'friendship-card-stand', label: 'Friendship Card Stand', width: 900, height: 657, rotatable: true, flippable: true, signArea: { x: 0.26, y: 0.25, width: 0.5, height: 0.4 } },
]

export const SIGN_ASSET_BY_ID = Object.fromEntries(SIGN_ASSETS.map(a => [a.id, a])) as Record<SignAssetId, SignAsset>

const FILENAME_BY_ID: Record<SignAssetId, string> = {
  'small-wooden-arrow': 'sign_01_small_wooden_arrow',
  'large-message-board': 'sign_02_large_message_board',
  'cork-note-board': 'sign_03_cork_note_board',
  'chalkboard-stand': 'sign_04_chalkboard_stand',
  'hanging-oval-sign': 'sign_05_hanging_oval_sign',
  'stone-plaque': 'sign_06_stone_plaque',
  'scroll-parchment': 'sign_07_scroll_parchment',
  'friendship-card-stand': 'sign_08_friendship_card_stand',
}

export const signAssetTexturePath = (id: SignAssetId, phase: DayPhase): string =>
  `/garden/registered-22.8.6/signs/${phase}/${FILENAME_BY_ID[id]}.png`
