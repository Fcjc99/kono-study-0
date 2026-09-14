import type { DayPhase } from '../sanctuary/types'

export type PondStyleId = 'round-stone-pond' | 'long-oval-lily-pond' | 'compact-koi-lily-pond' | 'tiered-waterfall-pond'

export type PondStyle = {
  id: PondStyleId
  label: string
  blurb: string
  /** Full source canvas size, in px (identical across all 4 day-phase variants). */
  width: number
  height: number
  /** Content bounding box (alpha > 10), as fractions of the canvas — see homeStyles.ts for why this
   * matters: contain-fitting the padded canvas instead of the content would make a short wide style
   * (the long oval pond) and a tall narrow one shrink to very different apparent sizes. */
  contentWidth: number
  contentHeight: number
  anchorX: number
  anchorY: number
}

/**
 * These are finals with no growth stages — picking one replaces the pond entirely with this one
 * fixed illustration, with its own morning/afternoon/evening/night art swapped in as the sanctuary's
 * time of day changes. There is deliberately no default pond to fall back to: with no style chosen,
 * the pond area is just the plain painted water already baked into the terrace map, with nothing
 * drawn on top of it (see PondEvolutionSystem, whose koi/lily/reed stage-growth visuals are
 * permanently disabled rather than used as a fallback).
 */
export const POND_STYLES: PondStyle[] = [
  { id: 'round-stone-pond', label: 'Round Stone Pond', blurb: 'Circular stone-ringed basin, calm center ripple.', width: 1241, height: 869, contentWidth: 1145, contentHeight: 773, anchorX: 0.4996, anchorY: 0.9436 },
  { id: 'long-oval-lily-pond', label: 'Long Oval Lily Pond', blurb: 'Elongated pond, lily pads drifting along the far edge.', width: 1536, height: 732, contentWidth: 1482, contentHeight: 636, anchorX: 0.5016, anchorY: 0.9331 },
  { id: 'compact-koi-lily-pond', label: 'Compact Koi Lily Pond', blurb: 'Tight koi pond with lily pads and visible fish motion.', width: 1316, height: 959, contentWidth: 1220, contentHeight: 863, anchorX: 0.4996, anchorY: 0.9489 },
  { id: 'tiered-waterfall-pond', label: 'Tiered Waterfall Pond', blurb: 'Two-level pond fed by a small stepped waterfall.', width: 1369, height: 1053, contentWidth: 1273, contentHeight: 957, anchorX: 0.4996, anchorY: 0.9535 },
]

export const POND_STYLE_BY_ID: Record<PondStyleId, PondStyle> = Object.fromEntries(POND_STYLES.map((s) => [s.id, s])) as Record<PondStyleId, PondStyle>

export const isPondStyleId = (value: unknown): value is PondStyleId => typeof value === 'string' && value in POND_STYLE_BY_ID

export const pondStyleTextureKey = (styleId: PondStyleId, phase: DayPhase): string => `pond-style-${styleId}-${phase}`
export const pondStyleTexturePath = (styleId: PondStyleId, phase: DayPhase): string => `/garden/registered-22.8.6/pond-styles/${styleId}/${phase}.png`
