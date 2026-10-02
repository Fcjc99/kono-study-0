import Phaser from 'phaser'
import { HALLOWEEN_ISLAND } from '../data/halloweenIsland'
import { RenderLayers } from '../engine/RenderLayers'
import type { DayPhase } from '../sanctuary/types'

/** The island in October (see sanctuary/season.ts): the map itself is the Halloween one (drawn by
 * tools/draw_halloween_island.py); this adds what moves. Jack-o'-lanterns, candles and the cauldron
 * flicker in the evening and at night, bats cross the sky, low fog drifts over the grass, autumn
 * leaves fall in the day, and now and then a friendly ghost floats up from a gravestone at night.
 * With reduced motion only the (still) glows and fog are shown. */
type Point = { x: number; y: number }

const GLOW_ALPHA: Record<DayPhase, number> = { morning: 0, afternoon: 0, evening: 0.55, night: 0.85 }
const FOG_ALPHA: Record<DayPhase, number> = { morning: 0.12, afternoon: 0, evening: 0.16, night: 0.22 }
const LEAF_TINTS = [0xe0782c, 0xc84a26, 0xf0b040, 0xa8642c]
const BAT_PIXELS = [
  // wings up
  ['x.........x', 'xx.......xx', '.xxx.x.xxx.', '..xxxxxxx..', '...xx.xx...', '...........'],
  // wings down
  ['...........', '....x.x....', '..xxxxxxx..', '.xxxxxxxxx.', 'xx.xx.xx.xx', 'x.........x'],
]
const GHOST_PIXELS = ['...oooo...', '..owwwwo..', '.owwwwwwo.', '.owkwwkwo.', '.owwwwwwo.', '.owwmmwwo.', '.owwwwwwo.', '.owwwwwwo.', '.owowwowo.', '.o.o..o.o.']

function pixelTexture(scene: Phaser.Scene, key: string, rows: string[], colors: Record<string, string>, unit: number): void {
  if (scene.textures.exists(key)) return
  const w = Math.max(...rows.map(r => r.length)) * unit, h = rows.length * unit
  const texture = scene.textures.createCanvas(key, w, h)
  if (!texture) return
  const ctx = texture.context
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    const color = colors[ch]
    if (!color) return
    ctx.fillStyle = color
    ctx.fillRect(x * unit, y * unit, unit, unit)
  }))
  texture.refresh()
}

function glowTexture(scene: Phaser.Scene, key: string, color: string): void {
  if (scene.textures.exists(key)) return
  const size = 128
  const texture = scene.textures.createCanvas(key, size, size)
  if (!texture) return
  const ctx = texture.context
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, `rgba(${color},0.9)`)
  g.addColorStop(0.25, `rgba(${color},0.45)`)
  g.addColorStop(1, `rgba(${color},0)`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  texture.refresh()
}

function fogTexture(scene: Phaser.Scene, key: string): void {
  if (scene.textures.exists(key)) return
  const w = 512, h = 128
  const texture = scene.textures.createCanvas(key, w, h)
  if (!texture) return
  const ctx = texture.context
  for (let i = 0; i < 9; i++) {
    const x = 60 + i * 50, y = 64 + Math.sin(i * 1.7) * 14, r = 70 + (i % 3) * 18
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, 'rgba(226,214,244,0.42)')
    g.addColorStop(1, 'rgba(226,214,244,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  }
  texture.refresh()
}

export class HalloweenSystem {
  private readonly scene: Phaser.Scene
  private bounds = new Phaser.Geom.Rectangle()
  private phase: DayPhase = 'afternoon'
  private reducedMotion = false
  private glows: { image: Phaser.GameObjects.Image; at: Point; r: number; tween?: Phaser.Tweens.Tween }[] = []
  private fog: { image: Phaser.GameObjects.Image; at: Point; tween?: Phaser.Tweens.Tween }[] = []
  private movers = new Set<Phaser.GameObjects.Image>()
  private timers: Phaser.Time.TimerEvent[] = []

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  create(phase: DayPhase, reducedMotion: boolean): void {
    this.phase = phase
    this.reducedMotion = reducedMotion
    glowTexture(this.scene, 'hw-glow-orange', '255,150,50')
    glowTexture(this.scene, 'hw-glow-green', '140,255,110')
    fogTexture(this.scene, 'hw-fog')
    BAT_PIXELS.forEach((rows, i) => pixelTexture(this.scene, 'hw-bat-' + i, rows, { x: '#241a2e' }, 3))
    pixelTexture(this.scene, 'hw-ghost', GHOST_PIXELS, { o: '#5a5470', w: '#f6f3ff', k: '#2a2238', m: '#e88aa0' }, 3)
    for (const g of HALLOWEEN_ISLAND.glows) {
      const image = this.scene.add.image(0, 0, g.kind === 'cauldron' ? 'hw-glow-green' : 'hw-glow-orange')
        .setDepth(RenderLayers.lightingShade + 0.05).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0)
      this.glows.push({ image, at: { x: g.x, y: g.y }, r: g.r })
    }
    const fogAt: Point[] = [{ x: 0.3, y: 0.62 }, { x: 0.62, y: 0.7 }, { x: 0.78, y: 0.5 }, { x: 0.45, y: 0.45 }]
    for (const at of fogAt) {
      const image = this.scene.add.image(0, 0, 'hw-fog').setDepth(RenderLayers.atmosphereBack + 0.1).setAlpha(0)
      this.fog.push({ image, at })
    }
    this.timers.push(this.scene.time.addEvent({ delay: 2600, loop: true, callback: () => this.spawnBat() }))
    this.timers.push(this.scene.time.addEvent({ delay: 1400, loop: true, callback: () => this.spawnLeaf() }))
    this.timers.push(this.scene.time.addEvent({ delay: 9000, loop: true, callback: () => this.spawnGhost() }))
    this.applyPhase()
  }

  resize(bounds: Phaser.Geom.Rectangle): void {
    this.bounds = new Phaser.Geom.Rectangle(bounds.x, bounds.y, bounds.width, bounds.height)
    for (const g of this.glows) {
      const size = Math.max(24, g.r * bounds.width * 2)
      g.image.setPosition(this.px(g.at), this.py(g.at)).setDisplaySize(size, size)
    }
    for (const f of this.fog) {
      f.image.setPosition(this.px(f.at), this.py(f.at)).setDisplaySize(bounds.width * 0.42, bounds.width * 0.1)
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
    const glow = GLOW_ALPHA[this.phase], fog = FOG_ALPHA[this.phase]
    for (const g of this.glows) {
      g.tween?.remove()
      g.tween = undefined
      g.image.setAlpha(glow)
      if (glow && !this.reducedMotion) {
        g.tween = this.scene.tweens.add({ targets: g.image, alpha: { from: glow * 0.7, to: glow }, duration: Phaser.Math.Between(180, 420), yoyo: true, repeat: -1, repeatDelay: Phaser.Math.Between(60, 900), ease: 'Sine.InOut' })
      }
    }
    for (const f of this.fog) {
      f.tween?.remove()
      f.tween = undefined
      f.image.setAlpha(fog)
      if (fog && !this.reducedMotion) {
        const shift = this.bounds.width * 0.05
        f.tween = this.scene.tweens.add({ targets: f.image, x: { from: this.px(f.at) - shift, to: this.px(f.at) + shift }, duration: Phaser.Math.Between(9000, 14000), yoyo: true, repeat: -1, ease: 'Sine.InOut' })
      }
    }
  }

  private track(image: Phaser.GameObjects.Image): Phaser.GameObjects.Image {
    this.movers.add(image)
    image.once(Phaser.GameObjects.Events.DESTROY, () => this.movers.delete(image))
    return image
  }

  private spawnBat(): void {
    if (this.reducedMotion || !this.bounds.width || this.movers.size > 14) return
    // Bats come out in the evening and at night (and once in a while in the afternoon).
    if (this.phase === 'morning' || (this.phase === 'afternoon' && Math.random() > 0.15)) return
    const fromLeft = Math.random() < 0.5
    const y0 = this.bounds.y + this.bounds.height * Phaser.Math.FloatBetween(0.04, 0.3)
    const x0 = fromLeft ? this.bounds.x - 30 : this.bounds.right + 30
    const x1 = fromLeft ? this.bounds.right + 30 : this.bounds.x - 30
    const scale = Phaser.Math.FloatBetween(0.8, 1.3) * Math.max(0.6, this.bounds.width / 1100)
    const bat = this.track(this.scene.add.image(x0, y0, 'hw-bat-0').setDepth(RenderLayers.cloudsFront + 0.2).setScale(scale).setAlpha(0.92))
    let frame = 0
    const flap = this.scene.time.addEvent({ delay: 130, loop: true, callback: () => { frame = 1 - frame; if (bat.active) bat.setTexture('hw-bat-' + frame) } })
    const wobble = Phaser.Math.FloatBetween(10, 26), duration = Phaser.Math.Between(5200, 8600)
    this.scene.tweens.addCounter({
      from: 0, to: 1, duration,
      onUpdate: t => { const p = t.getValue() ?? 0; if (bat.active) bat.setPosition(x0 + (x1 - x0) * p, y0 + Math.sin(p * Math.PI * 4) * wobble) },
      onComplete: () => { flap.remove(); bat.destroy() },
    })
  }

  private spawnLeaf(): void {
    if (this.reducedMotion || !this.bounds.width || this.movers.size > 14 || this.phase === 'night') return
    if (!this.scene.textures.exists('leaf-01')) return
    const x0 = this.bounds.x + this.bounds.width * Phaser.Math.FloatBetween(0.12, 0.88)
    const y0 = this.bounds.y + this.bounds.height * Phaser.Math.FloatBetween(0.08, 0.3)
    const leaf = this.track(this.scene.add.image(x0, y0, 'leaf-0' + Phaser.Math.Between(1, 4))
      .setDepth(RenderLayers.ambientFront).setTint(Phaser.Utils.Array.GetRandom(LEAF_TINTS))
      .setScale(Phaser.Math.FloatBetween(0.05, 0.08) * Math.max(0.7, this.bounds.width / 1448)).setAlpha(0))
    const fall = this.bounds.height * Phaser.Math.FloatBetween(0.25, 0.45), drift = this.bounds.width * Phaser.Math.FloatBetween(-0.08, 0.08)
    this.scene.tweens.add({ targets: leaf, alpha: { from: 0, to: 0.9 }, duration: 600 })
    this.scene.tweens.add({ targets: leaf, y: y0 + fall, x: x0 + drift, angle: Phaser.Math.Between(-220, 220), duration: Phaser.Math.Between(5200, 8200), ease: 'Sine.InOut',
      onComplete: () => this.scene.tweens.add({ targets: leaf, alpha: 0, duration: 700, onComplete: () => leaf.destroy() }) })
  }

  private spawnGhost(): void {
    if (this.reducedMotion || !this.bounds.width || this.phase !== 'night' || !HALLOWEEN_ISLAND.graves.length) return
    const at = Phaser.Utils.Array.GetRandom([...HALLOWEEN_ISLAND.graves])
    const scale = Math.max(0.7, this.bounds.width / 1100)
    const ghost = this.track(this.scene.add.image(this.px(at), this.py(at), 'hw-ghost').setDepth(RenderLayers.critters + 0.1).setScale(scale).setAlpha(0))
    const rise = this.bounds.height * 0.09
    this.scene.tweens.add({ targets: ghost, alpha: { from: 0, to: 0.85 }, duration: 900 })
    this.scene.tweens.add({ targets: ghost, y: this.py(at) - rise, x: this.px(at) + Phaser.Math.Between(-14, 14), duration: 4200, ease: 'Sine.Out',
      onComplete: () => this.scene.tweens.add({ targets: ghost, alpha: 0, duration: 900, onComplete: () => ghost.destroy() }) })
  }

  destroy(): void {
    this.timers.forEach(t => t.remove(false))
    this.timers = []
    this.glows.forEach(g => { g.tween?.remove(); g.image.destroy() })
    this.fog.forEach(f => { f.tween?.remove(); f.image.destroy() })
    this.glows = []
    this.fog = []
    this.movers.forEach(m => m.destroy())
    this.movers.clear()
  }
}
