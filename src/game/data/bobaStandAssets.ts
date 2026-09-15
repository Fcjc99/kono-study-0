import type { DayPhase } from '../sanctuary/types'

export type BobaStandAssetId =
  | 'stand-kiosk-blank-sign'
  | 'menu-board-blank'
  | 'cup-display-tray'
  | 'table-two-stools'
  | 'ingredient-crate'
  | 'cup-lantern-sign'

export type BobaStandAsset = {
  id: BobaStandAssetId
  label: string
  width: number
  height: number
  rotatable: boolean
  flippable: boolean
  /** Only the kiosk's arch sign and the chalkboard menu ship an actual blank area in the art — the
   * other four items are plain decoration with nothing to write on. */
  signArea?: { x: number; y: number; width: number; height: number }
}

export const BOBA_STAND_ASSETS: BobaStandAsset[] = [
  { id: 'stand-kiosk-blank-sign', label: 'Boba Stand Kiosk', width: 555, height: 530, rotatable: true, flippable: true, signArea: { x: 0.16, y: 0.03, width: 0.6, height: 0.13 } },
  { id: 'menu-board-blank', label: 'Menu Board', width: 275, height: 405, rotatable: true, flippable: true, signArea: { x: 0.38, y: 0.12, width: 0.54, height: 0.55 } },
  { id: 'cup-display-tray', label: 'Cup Display Tray', width: 450, height: 296, rotatable: true, flippable: true },
  { id: 'table-two-stools', label: 'Table & Two Stools', width: 515, height: 335, rotatable: true, flippable: true },
  { id: 'ingredient-crate', label: 'Ingredient Crate', width: 400, height: 310, rotatable: true, flippable: true },
  { id: 'cup-lantern-sign', label: 'Cup Lantern', width: 287, height: 440, rotatable: true, flippable: true },
]

export const BOBA_STAND_ASSET_BY_ID = Object.fromEntries(BOBA_STAND_ASSETS.map(a => [a.id, a])) as Record<BobaStandAssetId, BobaStandAsset>

const FILENAME_BY_ID: Record<BobaStandAssetId, string> = {
  'stand-kiosk-blank-sign': 'boba_01_stand_kiosk_blank_sign',
  'menu-board-blank': 'boba_02_menu_board_blank',
  'cup-display-tray': 'boba_03_cup_display_tray',
  'table-two-stools': 'boba_04_table_two_stools',
  'ingredient-crate': 'boba_05_ingredient_crate',
  'cup-lantern-sign': 'boba_06_cup_lantern_sign',
}

export const bobaStandAssetTexturePath = (id: BobaStandAssetId, phase: DayPhase): string =>
  `/garden/registered-22.8.6/boba-stand/${phase}/${FILENAME_BY_ID[id]}.png`
