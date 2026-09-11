import type { DayPhase } from './types'

export interface PhaseLightingFoundation {
  /** Normalized light origin within the sanctuary canvas. */
  lightOrigin: readonly [number, number]
  /** Normalized visual shadow emphasis point. */
  shadowFocus: readonly [number, number]
  highlightTint: number
  shadowTint: number
  moonTint: number
  highlightStrength: number
  shadowStrength: number
  moonStrength: number
  contactShadowStrength: number
  waterReflectionStrength: number
  description: string
}

/**
 * Build 22.6 final global lighting lock.
 *
 * These values are the production art-direction baseline for the whole Sanctuary:
 * - morning = warm sunrise, softer haze, longer gentle shadows
 * - afternoon = clean reference phase, clearest surfaces and shortest shadows
 * - evening = warm sunset, stronger golden highlights, long left-to-right shadows
 * - night = moonlit cool edges, no practical terrace/house glow baked here
 */
export const LIGHTING_FOUNDATION: Readonly<Record<DayPhase, PhaseLightingFoundation>> = Object.freeze({
  morning: {
    lightOrigin: [0.12, 0.18],
    shadowFocus: [0.74, 0.78],
    highlightTint: 0xffd8aa,
    shadowTint: 0x6e6d70,
    moonTint: 0xaec8ff,
    highlightStrength: 0.122,
    shadowStrength: 0.048,
    moonStrength: 0,
    contactShadowStrength: 0.76,
    waterReflectionStrength: 0.88,
    description: 'Warm sunrise from upper-left; long gentle shadows to lower-right with soft haze.',
  },
  afternoon: {
    lightOrigin: [0.39, 0.09],
    shadowFocus: [0.58, 0.62],
    highlightTint: 0xfff0c8,
    shadowTint: 0x4b5870,
    moonTint: 0xaec8ff,
    highlightStrength: 0.162,
    shadowStrength: 0.074,
    moonStrength: 0,
    contactShadowStrength: 0.90,
    waterReflectionStrength: 1,
    description: 'High clear daylight; shortest defined shadows and the cleanest readable surfaces.',
  },
  evening: {
    lightOrigin: [0.06, 0.39],
    shadowFocus: [0.83, 0.72],
    highlightTint: 0xffb277,
    shadowTint: 0x44496b,
    moonTint: 0xaec8ff,
    highlightStrength: 0.116,
    shadowStrength: 0.118,
    moonStrength: 0.036,
    contactShadowStrength: 0.86,
    waterReflectionStrength: 0.72,
    description: 'Low sunset from the left horizon; warm gold against cooler purple shade with long shadows.',
  },
  night: {
    lightOrigin: [0.16, 0.10],
    shadowFocus: [0.74, 0.80],
    highlightTint: 0xb9d6ff,
    shadowTint: 0x223451,
    moonTint: 0xb4d0ff,
    highlightStrength: 0.034,
    shadowStrength: 0.124,
    moonStrength: 0.145,
    contactShadowStrength: 0.58,
    waterReflectionStrength: 0.38,
    description: 'Moonlight from upper-left; cool silver edges, darker terrain, calm reflected water.',
  },
})
