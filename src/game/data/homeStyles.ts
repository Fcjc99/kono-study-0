import type { DayPhase } from '../sanctuary/types'

export type HomeStyleId = 'mushroom-house' | 'tea-house' | 'medieval-house' | 'greenhouse-cottage' | 'stone-cottage' | 'treehouse'

export type HomeStyle = {
  id: HomeStyleId
  label: string
  blurb: string
  /** Full source canvas size, in px. The art carries generous transparent padding around the
   * house itself, so this is only needed to convert the fractions below back into pixels. */
  width: number
  height: number
  /** Content bounding box (the house's actual painted pixels, alpha > 10), as fractions of the
   * canvas. Contain-fitting THIS box — not the padded canvas — into the world's home footprint
   * is what keeps a short wide style (the greenhouse wing) and a tall narrow one (the treehouse's
   * canopy) reading at a comparable scale instead of one shrinking to fit the other's padding. */
  contentWidth: number
  contentHeight: number
  /** Bottom-center of the content box, as a fraction of the canvas — where this style's art sits
   * on the ground, matched against the default cottage's own ground point at render time. */
  anchorX: number
  anchorY: number
}

/**
 * These renders are finals with no per-stage growth art — picking one replaces the default
 * cottage's stage-by-stage evolution outright, it doesn't add a parallel evolution track.
 * More styles may be added later; each is expected to keep this same "one flat appearance,
 * four day phases" shape rather than the default cottage's 6-stage growth.
 */
export const HOME_STYLES: HomeStyle[] = [
  { id: 'mushroom-house', label: 'Mushroom House', blurb: 'Fungal timber cap, hanging lantern, ivy-grown stone base.', width: 1300, height: 1177, contentWidth: 1170, contentHeight: 1047, anchorX: 0.4996, anchorY: 0.9439 },
  { id: 'tea-house', label: 'Tea House', blurb: 'Engawa deck, shoji screens, blue ceramic roof tile.', width: 1378, height: 1142, contentWidth: 1331, contentHeight: 1083, anchorX: 0.5007, anchorY: 0.9676 },
  { id: 'medieval-house', label: 'Tudor Cottage', blurb: 'Timber-frame gable, stone chimney, leaded windows.', width: 1312, height: 1199, contentWidth: 1193, contentHeight: 1094, anchorX: 0.503, anchorY: 0.9575 },
  { id: 'greenhouse-cottage', label: 'Greenhouse Cottage', blurb: 'Whitewashed cottage with a glasshouse conservatory wing.', width: 1508, height: 1024, contentWidth: 1378, contentHeight: 917, anchorX: 0.4997, anchorY: 0.9463 },
  { id: 'stone-cottage', label: 'Stone Cottage', blurb: 'Round-arch door, thatch-toned tile roof, flower boxes.', width: 1314, height: 1085, contentWidth: 1184, contentHeight: 956, anchorX: 0.4996, anchorY: 0.9392 },
  { id: 'treehouse', label: 'Treehouse', blurb: 'Canopy platform in an oak crown, rope-ladder access.', width: 1206, height: 1254, contentWidth: 1076, contentHeight: 1217, anchorX: 0.4996, anchorY: 0.9833 },
]

export const HOME_STYLE_BY_ID: Record<HomeStyleId, HomeStyle> = Object.fromEntries(HOME_STYLES.map((s) => [s.id, s])) as Record<HomeStyleId, HomeStyle>

export const isHomeStyleId = (value: unknown): value is HomeStyleId => typeof value === 'string' && value in HOME_STYLE_BY_ID

export const homeStyleTextureKey = (styleId: HomeStyleId, phase: DayPhase): string => `home-style-${styleId}-${phase}`
export const homeStyleTexturePath = (styleId: HomeStyleId, phase: DayPhase): string => `/garden/registered-22.8.6/home-styles/${styleId}/${phase}.png`
