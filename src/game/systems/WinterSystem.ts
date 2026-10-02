import Phaser from 'phaser'
import { WINTER_ISLAND } from '../data/winterIsland'
import { RenderLayers } from '../engine/RenderLayers'
import type { DayPhase } from '../sanctuary/types'

/** The island in winter (December 1 to February 14, see sanctuary/season.ts): the map itself is the
 * snowy one (drawn by tools/draw_winter_island.py); this adds what moves. Soft snowflakes drift down
 * all day, the pine's lights twinkle and the lamp posts glow in the evening and at night, and in
 * Valentine's week (February 1-14) little hearts float up from the snow now and then. With reduced
 * motion only the (still) glows are shown. */
type Point = { x: number; y: number }

const GLOW_ALPHA: Record<DayPhase, number> = { morning: 0, afternoon: 0, evening: 0.45, night: 0.7 }
const LIGHT_COLORS = ['255,110,110', '255,220,110', '120,200,255', '150,240,150', '255,160,220']
const HEART_PIXELS = ['.hh.hh.', 'hHhhhhh', 'hhhhhhh', '.hhhhh.', '..hhh..', '...h...']

function glowTexture(scene: Phaser.Scene, key: string, color: string): void {
  if (scene.textures.exists(key)) return
  const size = 64
  const texture = scene.textures.createCanvas(key, size, size)
  if (!texture) return
  const ctx = texture.context
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, `rgba(${color},0.95)`)
  g.addColorStop(0.3, `rgba(${color},0.45)`)
  g.addColorStop(1, `rgba(${color},0)`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  texture.refresh()
}

function flakeTexture(scene: Phaser.Scene, key: string): void {
  if (scene.textures.exists(key)) return
  const texture = scene.textures.createCanvas(key, 8, 8)
  if (!texture) return
  const ctx = texture.context
  const g = ctx.createRadialGradient(4, 4, 0, 4, 4, 4)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.6, 'rgba(240,246,255,0.8)')
  g.addColorStop(1, 'rgba(240,246,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 8, 8)
  texture.refresh()
}

function heartTexture(scene: Phaser.Scene, key: string): void {
  if (scene.textures.exists(key)) return
  const unit = 3
  const texture = scene.textures.createCanvas(key, HEART_PIXELS[0].length * unit, HEART_PIXELS.length * unit)
  if (!texture) return
  const ctx = texture.context
  HEART_PIXELS.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return
    ctx.fillStyle = ch === 'H' ? '#ffd0e0' : '#f0608c'
    ctx.fillRect(x * unit, y * unit, unit, unit)
  }))
  texture.refresh()
}

export class WinterSystem {
  private readonly scene: Phaser.Scene
  private bounds = new Phaser.Geom.Rectangle()
  private phase: DayPhase = 'afternoon'
  private reducedMotion = false
  private valentine = false
  private glows: { image: Phaser.GameObjects.Image; at: Point; r: number; twinkle: boolean; tween?: Phaser.Tweens.Tween }[] = []
  private movers = new Set<Phaser.GameObjects.Image>()
  private timers: Phaser.Time.TimerEvent[] = []

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  create(phase: DayPhase, reducedMotion: boolean, valentine: boolean): void {
    this.phase = phase
    this.reducedMotion = reducedMotion
    this.valentine = valentine
    LIGHT_COLORS.forEach((c, i) => glowTexture(this.scene, 'winter-glow-' + i, c))
    glowTexture(this.scene, 'winter-glow-warm', '255,214,140')
    flakeTexture(this.scene, 'winter-flake')
    heartTexture(this.scene, 'winter-heart')
    WINTER_ISLAND.glows.forEach((g, i) => {
      const key = g.kind === 'light' ? 'winter-glow-' + (i % LIGHT_COLORS.length) : 'winter-glow-warm'
      const image = this.scene.add.image(0, 0, key).setDepth(RenderLayers.lightingShade + 0.05).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0)
      this.glows.push({ image, at: { x: g.x, y: g.y }, r: g.r, twinkle: g.kind === 'light' })
    })
    this.timers.push(this.scene.time.addEvent({ delay: 260, loop: true, callback: () => this.spawnFlake() }))
    if (valentine) this.timers.push(this.scene.time.addEvent({ delay: 2200, loop: true, callback: () => this.spawnHeart() }))
    this.applyPhase()
  }

  resize(bounds: Phaser.Geom.Rectangle): void {
    this.bounds = new Phaser.Geom.Rectangle(bounds.x, bounds.y, bounds.width, bounds.height)
    for (const g of this.glows) {
      // The map already has a soft halo baked in: these just make it shimmer.
      const size = Math.max(10, g.r * bounds.width * (g.twinkle ? 1.6 : 1.1))
      g.image.setPosition(this.px(g.at), this.py(g.at)).setDisplaySize(size, size)
    }
  }

  setPhase(phase: DayPhase): void {
    if (phase === this.phase) return
    this.phase = phase
    this.applyPhase()
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion
    this.applyPhase()
  }

  private px(p: Point): number { return this.bounds.x + this.bounds.width * p.x }
  private py(p: Point): number { return this.bounds.y + this.bounds.height * p.y }

  private applyPhase(): void {
    const glow = GLOW_ALPHA[this.phase]
    for (const g of this.glows) {
      g.tween?.remove()
      g.tween = undefined
      g.image.setAlpha(glow)
      if (glow && !this.reducedMotion) {
        // The tree's lights twinkle; the lamps and the star breathe slowly.
        const twinkle = g.twinkle
        g.tween = this.scene.tweens.add({ targets: g.image, alpha: { from: glow * (twinkle ? 0.25 : 0.75), to: glow }, duration: twinkle ? Phaser.Math.Between(500, 1300) : Phaser.Math.Between(1800, 2600), yoyo: true, repeat: -1, delay: Phaser.Math.Between(0, 1200), ease: 'Sine.InOut' })
      }
    }
  }

  private track(image: Phaser.GameObjects.Image): Phaser.GameObjects.Image {
    this.movers.add(image)
    image.once(Phaser.GameObjects.Events.DESTROY, () => this.movers.delete(image))
    return image
  }

  private spawnFlake(): void {
    if (this.reducedMotion || !this.bounds.width || this.movers.size > 60) return
    const x0 = this.bounds.x + this.bounds.width * Phaser.Math.FloatBetween(0, 1)
    const y0 = this.bounds.y - 8
    const scale = Phaser.Math.FloatBetween(0.5, 1.3) * Math.max(0.7, this.bounds.width / 1100)
    const flake = this.track(this.scene.add.image(x0, y0, 'winter-flake').setDepth(RenderLayers.weather - 0.1).setScale(scale).setAlpha(Phaser.Math.FloatBetween(0.55, 0.9)))
    const fall = this.bounds.height * Phaser.Math.FloatBetween(0.55, 1.05), drift = this.bounds.width * Phaser.Math.FloatBetween(-0.06, 0.06)
    this.scene.tweens.add({ targets: flake, y: y0 + fall, x: x0 + drift, duration: Phaser.Math.Between(7000, 12000), ease: 'Linear',
      onComplete: () => this.scene.tweens.add({ targets: flake, alpha: 0, duration: 600, onComplete: () => flake.destroy() }) })
  }

  private spawnHeart(): void {
    if (!this.valentine || this.reducedMotion || !this.bounds.width || this.movers.size > 70) return
    const at = { x: Phaser.Math.FloatBetween(0.2, 0.8), y: Phaser.Math.FloatBetween(0.4, 0.75) }
    const scale = Phaser.Math.FloatBetween(0.8, 1.2) * Math.max(0.7, this.bounds.width / 1100)
    const heart = this.track(this.scene.add.image(this.px(at), this.py(at), 'winter-heart').setDepth(RenderLayers.ambientFront + 0.1).setScale(scale).setAlpha(0))
    const rise = this.bounds.height * Phaser.Math.FloatBetween(0.1, 0.18)
    this.scene.tweens.add({ targets: heart, alpha: { from: 0, to: 0.95 }, duration: 600 })
    this.scene.tweens.add({ targets: heart, y: this.py(at) - rise, x: this.px(at) + Phaser.Math.Between(-16, 16), duration: 3600, ease: 'Sine.Out',
      onComplete: () => this.scene.tweens.add({ targets: heart, alpha: 0, duration: 700, onComplete: () => heart.destroy() }) })
  }

  destroy(): void {
    this.timers.forEach(t => t.remove(false))
    this.timers = []
    this.glows.forEach(g => { g.tween?.remove(); g.image.destroy() })
    this.glows = []
    this.movers.forEach(m => m.destroy())
    this.movers.clear()
  }
}
