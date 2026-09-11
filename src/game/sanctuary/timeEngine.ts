import type { DayPhase, PhaseBlend } from './types'

interface TransitionWindow {
  start: number
  end: number
  from: DayPhase
  to: DayPhase
}

interface LightingProfile {
  ambientLight: number
  darkness: number
  warmth: number
  coolness: number
  lanternStrength: number
  starVisibility: number
  haze: number
  waterHighlight: number
  cloudBrightness: number
}

export interface DaylightState extends LightingProfile {
  minutes: number
  from: DayPhase
  to: DayPhase
  amount: number
  dominant: DayPhase
  nextPhase: DayPhase
}

const DAY_MINUTES = 24 * 60

const TRANSITIONS: TransitionWindow[] = [
  { start: 5 * 60 + 30, end: 7 * 60, from: 'night', to: 'morning' },
  { start: 11 * 60 + 30, end: 13 * 60, from: 'morning', to: 'afternoon' },
  { start: 17 * 60, end: 19 * 60, from: 'afternoon', to: 'evening' },
  { start: 20 * 60, end: 22 * 60, from: 'evening', to: 'night' },
]

const LIGHTING_PROFILES: Record<DayPhase, LightingProfile> = {
  morning: {
    ambientLight: 0.90,
    darkness: 0.02,
    warmth: 0.31,
    coolness: 0.02,
    lanternStrength: 0,
    starVisibility: 0,
    haze: 0.16,
    waterHighlight: 0.88,
    cloudBrightness: 0.97,
  },
  afternoon: {
    ambientLight: 1,
    darkness: 0,
    warmth: 0.04,
    coolness: 0,
    lanternStrength: 0,
    starVisibility: 0,
    haze: 0.03,
    waterHighlight: 1,
    cloudBrightness: 1,
  },
  evening: {
    ambientLight: 0.76,
    darkness: 0.10,
    warmth: 0.78,
    coolness: 0.05,
    lanternStrength: 0.42,
    starVisibility: 0.10,
    haze: 0.085,
    waterHighlight: 0.72,
    cloudBrightness: 0.84,
  },
  night: {
    ambientLight: 0.30,
    darkness: 0.60,
    warmth: 0,
    coolness: 0.78,
    lanternStrength: 0.10,
    starVisibility: 1,
    haze: 0.05,
    waterHighlight: 0.34,
    cloudBrightness: 0.58,
  },
}

const PHASE_ORDER: DayPhase[] = ['morning', 'afternoon', 'evening', 'night']
const PHASE_MIDPOINTS: Record<DayPhase, number> = {
  morning: 8 * 60 + 30,
  afternoon: 14 * 60,
  evening: 19 * 60 + 30,
  night: 23 * 60,
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
const easeInOut = (value: number) => value * value * (3 - 2 * value)
const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount

const nextPhaseAfter = (phase: DayPhase): DayPhase => {
  const index = PHASE_ORDER.indexOf(phase)
  return PHASE_ORDER[(index + 1) % PHASE_ORDER.length]
}

const interpolateProfile = (from: LightingProfile, to: LightingProfile, amount: number): LightingProfile => ({
  ambientLight: lerp(from.ambientLight, to.ambientLight, amount),
  darkness: lerp(from.darkness, to.darkness, amount),
  warmth: lerp(from.warmth, to.warmth, amount),
  coolness: lerp(from.coolness, to.coolness, amount),
  lanternStrength: lerp(from.lanternStrength, to.lanternStrength, amount),
  starVisibility: lerp(from.starVisibility, to.starVisibility, amount),
  haze: lerp(from.haze, to.haze, amount),
  waterHighlight: lerp(from.waterHighlight, to.waterHighlight, amount),
  cloudBrightness: lerp(from.cloudBrightness, to.cloudBrightness, amount),
})

export const minutesFromDate = (date: Date): number => date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60

export function phaseBlendForMinutes(inputMinutes: number): PhaseBlend {
  const minutes = ((inputMinutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES

  for (const transition of TRANSITIONS) {
    if (minutes >= transition.start && minutes < transition.end) {
      const linear = clamp01((minutes - transition.start) / (transition.end - transition.start))
      const amount = easeInOut(linear)
      return {
        from: transition.from,
        to: transition.to,
        amount,
        dominant: amount < 0.5 ? transition.from : transition.to,
      }
    }
  }

  if (minutes >= 7 * 60 && minutes < 11 * 60 + 30) return stable('morning')
  if (minutes >= 13 * 60 && minutes < 17 * 60) return stable('afternoon')
  if (minutes >= 19 * 60 && minutes < 20 * 60) return stable('evening')
  return stable('night')
}

export function daylightForMinutes(inputMinutes: number): DaylightState {
  const minutes = ((inputMinutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
  return daylightForBlend(phaseBlendForMinutes(minutes), minutes)
}

export function daylightForPhase(phase: DayPhase): DaylightState {
  return daylightForBlend(stable(phase), PHASE_MIDPOINTS[phase])
}

export function daylightForBlend(blend: PhaseBlend, minutes: number): DaylightState {
  const profile = interpolateProfile(LIGHTING_PROFILES[blend.from], LIGHTING_PROFILES[blend.to], blend.amount)
  return {
    ...profile,
    minutes,
    from: blend.from,
    to: blend.to,
    amount: blend.amount,
    dominant: blend.dominant,
    nextPhase: blend.from === blend.to ? nextPhaseAfter(blend.dominant) : blend.to,
  }
}

export const stable = (phase: DayPhase): PhaseBlend => ({ from: phase, to: phase, amount: 0, dominant: phase })
