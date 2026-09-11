import type { SanctuaryQuality } from '../sanctuary/types'

export interface ParticleBudgetInput {
  base: number
  width: number
  density: number
  reducedMotion: boolean
}

export class PerformanceManager {
  private requestedQuality: SanctuaryQuality = 'auto'

  setQuality(quality: SanctuaryQuality): void {
    this.requestedQuality = quality
  }

  resolve(width: number): Exclude<SanctuaryQuality, 'auto'> {
    if (this.requestedQuality !== 'auto') return this.requestedQuality

    const memory = Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4)
    const mobile = width < 760
    if (mobile && memory <= 3) return 'low'
    if (mobile || memory <= 5) return 'balanced'
    return 'high'
  }

  particleCount(input: ParticleBudgetInput): number {
    const quality = this.resolve(input.width)
    const mobileFactor = input.width < 760 ? 0.82 : 1
    const qualityFactor = quality === 'high' ? 1 : quality === 'balanced' ? 0.74 : 0.5
    const motionFactor = input.reducedMotion ? 0.42 : 1
    const density = Math.min(2, Math.max(0.25, input.density))
    return Math.max(4, Math.round(input.base * mobileFactor * motionFactor * density * qualityFactor))
  }
}
