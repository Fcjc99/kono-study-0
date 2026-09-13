import type { DayPhase } from '../sanctuary/types'

export interface FluidCrop {
  x: number
  y: number
  width: number
  height: number
  frames: number
  fps: number
}

export const FLUID_PHASES: readonly DayPhase[] = ['morning', 'afternoon', 'evening', 'night']

export const FLUID_CROPS = {
  ocean: { x: 0, y: 420, width: 1448, height: 666, frames: 12, fps: 3.0 },
  pond: { x: 520, y: 525, width: 515, height: 285, frames: 12, fps: 2.4 },
  waterfall: { x: 480, y: 790, width: 145, height: 215, frames: 12, fps: 7.0 },
  foam: { x: 455, y: 915, width: 195, height: 100, frames: 12, fps: 4.0 },
} satisfies Record<'ocean' | 'pond' | 'waterfall' | 'foam', FluidCrop>

export const fluidTextureKey = (
  phase: DayPhase,
  layer: keyof typeof FLUID_CROPS,
  frame: number,
): string => `production-water-${phase}-${layer}-${frame}`

// The folder is versioned (production-water-2, not production-water) so that
// regenerating these PNGs — same phase/layer/frame names, new pixel content —
// forces a real cache-bust. Without a path change, the service worker's runtime
// cache, the browser HTTP cache, and the CDN all key on this URL and would keep
// serving the old bytes to returning visitors indefinitely.
export const fluidTexturePath = (
  phase: DayPhase,
  layer: keyof typeof FLUID_CROPS,
  frame: number,
): string => `/garden/registered-22.8.6/production-water-2/${phase}-${layer}-${frame}.png`

