import type Phaser from 'phaser'
import type { DayPhase } from '../sanctuary/types'

// The original phase paintings already contain sunlight/moonlight and their
// rich palettes. Keep only subtle local fill and cast shadows; no global veil.
export const PHASE_LIGHT = {
  morning: { sun: 0, moon: 0, shadow: 0, bulbs: 0, kono: [0xfff2dc, 0xf0ddc1, 0xd5c1a4, 0xc7b69e] },
  afternoon: { sun: 0, moon: 0, shadow: 0, bulbs: 0, kono: [0xffffff, 0xfff9ed, 0xe7dac3, 0xdfd4c0] },
  evening: { sun: 0.025, moon: 0, shadow: 0.20, bulbs: 0.92, kono: [0xffc88d, 0xd6a08b, 0x927b79, 0x887784] },
  night: { sun: 0, moon: 0.02, shadow: 0.10, bulbs: 0, kono: [0x687da2, 0x899fc3, 0x424f70, 0x536584] },
} satisfies Record<DayPhase, { sun: number; moon: number; shadow: number; bulbs: number; kono: number[] }>

// Bulb centers measured in each existing terrace sprite; origin is left=960,
// bottom=552 for EVERY phase. Stage 0 uses the canonical map's original bulbs.
export const TERRACE_BULBS: readonly (readonly [number, number])[][] = [
  [[1034,414],[1060,421],[1080,425],[1100,424],[1122,419],[1146,409]],
  [[1044,388],[1082,396],[1116,399],[1146,399],[1178,395]],
  [[1044,388],[1082,396],[1116,399],[1146,399],[1178,395]],
  [[1044,386],[1082,394],[1116,397],[1146,397],[1178,393]],
  [[1044,379],[1080,387],[1115,395],[1148,401],[1180,406]],
  [[1041,393],[1073,396],[1107,402],[1141,408],[1177,415]],
]

export function ensureLightTexture(scene: Phaser.Scene, key: string, kind: 'sun' | 'moon' | 'shadow' | 'bulb'): void {
  if (scene.textures.exists(key)) return
  const size = kind === 'sun' || kind === 'moon' ? 256 : 64
  const texture = scene.textures.createCanvas(key, size, size)
  if (!texture) return
  const ctx = texture.context
  const gradient = kind === 'sun' ? ctx.createLinearGradient(0, 0, size, size * .9)
    : kind === 'moon' ? ctx.createLinearGradient(0, 0, size * .9, size)
    : ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  const color = kind === 'sun' ? '255,178,83' : kind === 'moon' ? '125,175,245' : kind === 'shadow' ? '26,28,48' : '255,183,72'
  gradient.addColorStop(0, `rgba(${color},${kind === 'shadow' ? .65 : .8})`)
  gradient.addColorStop(kind === 'bulb' ? .12 : .55, `rgba(${color},${kind === 'bulb' ? .55 : .15})`)
  gradient.addColorStop(1, `rgba(${color},0)`)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  texture.refresh()
}

