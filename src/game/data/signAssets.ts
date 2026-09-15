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

export const SIGN_ASSETS: SignAsset[] = [
  { id: 'small-wooden-arrow', label: 'Wooden Arrow Sign', width: 859, height: 900, rotatable: true, flippable: true, signArea: { x: 0.08, y: 0.22, width: 0.62, height: 0.24 } },
  { id: 'large-message-board', label: 'Large Message Board', width: 900, height: 601, rotatable: true, flippable: true, signArea: { x: 0.26, y: 0.23, width: 0.54, height: 0.4 } },
  { id: 'cork-note-board', label: 'Cork Note Board', width: 900, height: 716, rotatable: true, flippable: true, signArea: { x: 0.22, y: 0.27, width: 0.56, height: 0.45 } },
  { id: 'chalkboard-stand', label: 'Chalkboard Stand', width: 900, height: 877, rotatable: true, flippable: true, signArea: { x: 0.26, y: 0.22, width: 0.42, height: 0.44 } },
  { id: 'hanging-oval-sign', label: 'Hanging Oval Sign', width: 900, height: 626, rotatable: true, flippable: true, signArea: { x: 0.33, y: 0.4, width: 0.48, height: 0.34 } },
  { id: 'stone-plaque', label: 'Stone Plaque', width: 900, height: 558, rotatable: true, flippable: true, signArea: { x: 0.24, y: 0.22, width: 0.51, height: 0.4 } },
  { id: 'scroll-parchment', label: 'Scroll Parchment', width: 900, height: 590, rotatable: true, flippable: true, signArea: { x: 0.21, y: 0.2, width: 0.58, height: 0.42 } },
  { id: 'friendship-card-stand', label: 'Friendship Card Stand', width: 900, height: 657, rotatable: true, flippable: true, signArea: { x: 0.23, y: 0.23, width: 0.52, height: 0.42 } },
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
