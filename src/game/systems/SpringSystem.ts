import Phaser from 'phaser'
import { RenderLayers } from '../engine/RenderLayers'
import type { DayPhase } from '../sanctuary/types'

/** The island in spring and at the end of the semester (see sanctuary/season.ts): the maps are drawn by
 * tools/draw_spring_island.py; this adds what moves. In spring, cherry blossom petals drift across the
 * island and now and then a butterfly flutters by (in daylight). At the end of the semester, a little
 * burst of confetti pops over the island every so often, and a graduation cap is tossed up once in a
 * while. With reduced motion nothing moves. */
type Look = 'spring' | 'semester'
const PETAL_TINTS = [0xff92bc, 0xffb4d0, 0xfff0f6]
const CONFETTI_TINTS = [0xf05a64, 0xffd250, 0x64aaf0, 0x78d278, 0xe68ce6]
const BUTTERFLY_PIXELS = [
  ['y..y', 'yyyy', '.oo.', 'yyyy', 'y..y'],
  ['.yy.', '.yy.', '.oo.', '.yy.', '.yy.'],
]
const CAP_PIXELS = ['...k...', '.kkkkk.', 'kkkkkkk', '.kkkkk.', '..kkky.', '..kkk.y']

function pixelTexture(scene: Phaser.Scene, key: string, rows: string[], colors: Record<string, string>, unit: number): void {
  if (scene.textures.exists(key)) return
  const texture = scene.textures.createCanvas(key, Math.max(...rows.map(r => r.length)) * unit, rows.length * unit)
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

function blobTexture(scene: Phaser.Scene, key: string, w: number, h: number): void {
  if (scene.textures.exists(key)) return
  const texture = scene.textures.createCanvas(key, w, h)
  if (!texture) return
  texture.context.fillStyle = '#ffffff'
  texture.context.beginPath()
  texture.context.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
  texture.context.fill()
  texture.refresh()
}

export class SpringSystem {
  private readonly scene: Phaser.Scene
  private bounds = new Phaser.Geom.Rectangle()
  private phase: DayPhase = 'afternoon'
  private reducedMotion = false
  private movers = new Set<Phaser.GameObjects.Image>()
  private timers: Phaser.Time.TimerEvent[] = []

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  create(phase: DayPhase, reducedMotion: boolean, look: Look): void {
    this.phase = phase
    this.reducedMotion = reducedMotion
    blobTexture(this.scene, 'spring-petal', 10, 6)
    blobTexture(this.scene, 'spring-confetti', 4, 6)
    BUTTERFLY_PIXELS.forEach((rows, i) => pixelTexture(this.scene, 'spring-butterfly-' + i, rows, { y: '#ffd36e', o: '#5a4632' }, 3))
    pixelTexture(this.scene, 'spring-cap', CAP_PIXELS, { k: '#2a2a3a', y: '#ffd250' }, 3)
    if (look === 'spring') {
      this.timers.push(this.scene.time.addEvent({ delay: 550, loop: true, callback: () => this.spawnPetal() }))
      this.timers.push(this.scene.time.addEvent({ delay: 7000, loop: true, callback: () => this.spawnButterfly() }))
    } else {
      this.timers.push(this.scene.time.addEvent({ delay: 6000, loop: true, callback: () => this.burstConfetti() }))
      this.timers.push(this.scene.time.addEvent({ delay: 15000, loop: true, callback: () => this.tossCap() }))
    }
  }

  resize(bounds: Phaser.Geom.Rectangle): void {
    this.bounds = new Phaser.Geom.Rectangle(bounds.x, bounds.y, bounds.width, bounds.height)
  }

  setPhase(phase: DayPhase): void {
    this.phase = phase
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion
  }

  private ready(max: number): boolean {
    return !this.reducedMotion && this.bounds.width > 0 && this.movers.size <= max
  }

  private track(image: Phaser.GameObjects.Image): Phaser.GameObjects.Image {
    this.movers.add(image)
    image.once(Phaser.GameObjects.Events.DESTROY, () => this.movers.delete(image))
    return image
  }

  private scale(): number {
    return Math.max(0.7, this.bounds.width / 1100)
  }

  private spawnPetal(): void {
    if (!this.ready(30)) return
    const x0 = this.bounds.x + this.bounds.width * Phaser.Math.FloatBetween(0.1, 0.7)
    const y0 = this.bounds.y + this.bounds.height * Phaser.Math.FloatBetween(0.08, 0.3)
    const petal = this.track(this.scene.add.image(x0, y0, 'spring-petal').setDepth(RenderLayers.ambientFront)
      .setTint(Phaser.Utils.Array.GetRandom(PETAL_TINTS)).setScale(this.scale() * Phaser.Math.FloatBetween(0.8, 1.3)).setAlpha(0))
    const drift = this.bounds.width * Phaser.Math.FloatBetween(0.12, 0.3), fall = this.bounds.height * Phaser.Math.FloatBetween(0.2, 0.42)
    this.scene.tweens.add({ targets: petal, alpha: { from: 0, to: 0.9 }, duration: 500 })
    this.scene.tweens.add({ targets: petal, x: x0 + drift, y: y0 + fall, angle: Phaser.Math.Between(-260, 260), duration: Phaser.Math.Between(6000, 9000), ease: 'Sine.InOut',
      onComplete: () => this.scene.tweens.add({ targets: petal, alpha: 0, duration: 600, onComplete: () => petal.destroy() }) })
  }

  private spawnButterfly(): void {
    if (!this.ready(32) || this.phase === 'night' || this.phase === 'evening') return
    const fromLeft = Math.random() < 0.5
    const y0 = this.bounds.y + this.bounds.height * Phaser.Math.FloatBetween(0.35, 0.65)
    const x0 = fromLeft ? this.bounds.x + this.bounds.width * 0.15 : this.bounds.right - this.bounds.width * 0.15
    const x1 = fromLeft ? this.bounds.right - this.bounds.width * 0.15 : this.bounds.x + this.bounds.width * 0.15
    const fly = this.track(this.scene.add.image(x0, y0, 'spring-butterfly-0').setDepth(RenderLayers.critters + 0.4).setScale(this.scale()).setAlpha(0))
    let frame = 0
    const flap = this.scene.time.addEvent({ delay: 160, loop: true, callback: () => { frame = 1 - frame; if (fly.active) fly.setTexture('spring-butterfly-' + frame) } })
    const duration = Phaser.Math.Between(9000, 13000), wobble = this.bounds.height * 0.03
    this.scene.tweens.add({ targets: fly, alpha: { from: 0, to: 1 }, duration: 600 })
    this.scene.tweens.addCounter({
      from: 0, to: 1, duration,
      onUpdate: t => { const p = t.getValue() ?? 0; if (fly.active) fly.setPosition(x0 + (x1 - x0) * p, y0 + Math.sin(p * Math.PI * 5) * wobble) },
      onComplete: () => this.scene.tweens.add({ targets: fly, alpha: 0, duration: 500, onComplete: () => { flap.remove(); fly.destroy() } }),
    })
  }

  private burstConfetti(): void {
    if (!this.ready(20) || this.phase === 'night') return
    const cx = this.bounds.x + this.bounds.width * Phaser.Math.FloatBetween(0.3, 0.7)
    const cy = this.bounds.y + this.bounds.height * Phaser.Math.FloatBetween(0.3, 0.5)
    for (let i = 0; i < 18; i++) {
      const bit = this.track(this.scene.add.image(cx, cy, 'spring-confetti').setDepth(RenderLayers.ambientFront + 0.2)
        .setTint(Phaser.Utils.Array.GetRandom(CONFETTI_TINTS)).setScale(this.scale()).setAngle(Phaser.Math.Between(0, 360)))
      const ang = Phaser.Math.FloatBetween(-Math.PI * 0.95, -Math.PI * 0.05), speed = this.bounds.width * Phaser.Math.FloatBetween(0.03, 0.08)
      const tx = cx + Math.cos(ang) * speed, ty = cy + Math.sin(ang) * speed
      this.scene.tweens.add({ targets: bit, x: tx, y: ty, angle: bit.angle + Phaser.Math.Between(-180, 180), duration: 500, ease: 'Quad.Out',
        onComplete: () => this.scene.tweens.add({ targets: bit, y: ty + this.bounds.height * 0.08, alpha: 0, angle: bit.angle + 200, duration: 1600, ease: 'Sine.In', onComplete: () => bit.destroy() }) })
    }
  }

  private tossCap(): void {
    if (!this.ready(40) || this.phase === 'night') return
    const x0 = this.bounds.x + this.bounds.width * Phaser.Math.FloatBetween(0.35, 0.65)
    const y0 = this.bounds.y + this.bounds.height * 0.5
    const cap = this.track(this.scene.add.image(x0, y0, 'spring-cap').setDepth(RenderLayers.ambientFront + 0.3).setScale(this.scale()))
    const peak = this.bounds.height * 0.2
    this.scene.tweens.add({ targets: cap, y: y0 - peak, angle: 360, duration: 900, ease: 'Quad.Out', yoyo: true, hold: 120,
      onComplete: () => this.scene.tweens.add({ targets: cap, alpha: 0, duration: 400, onComplete: () => cap.destroy() }) })
  }

  destroy(): void {
    this.timers.forEach(t => t.remove(false))
    this.timers = []
    this.movers.forEach(m => m.destroy())
    this.movers.clear()
  }
}
