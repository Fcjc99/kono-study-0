import Phaser from 'phaser'
import { HALLOWEEN_MOON } from '../data/halloweenIsland'
import { RenderLayers } from '../engine/RenderLayers'
import type { DayPhase } from '../sanctuary/types'

/** The island in October (see sanctuary/season.ts): one Halloween night picture all day (drawn by
 * tools/draw_halloween_night.py, the island's own art under a violet sky and a big full moon); this adds
 * what moves. The moon's glow breathes, bats cross the sky (often in front of the moon), low fog drifts
 * over the grass, a few autumn leaves fall, and now and then a friendly ghost floats up from the grass.
 * With reduced motion only the (still) moon glow and fog are shown. */
type Point = { x: number; y: number }

const LEAF_TINTS = [0xe0782c, 0xc84a26, 0xf0b040, 0xa8642c]
/** Where a ghost can float up from: open grass, away from the hill and the cliffs. */
const GHOST_SPOTS: Point[] = [{ x: 0.3, y: 0.55 }, { x: 0.44, y: 0.62 }, { x: 0.6, y: 0.5 }, { x: 0.72, y: 0.62 }, { x: 0.36, y: 0.42 }]
/** A friendly ghost, painted softly like the island's decorations (no hard pixels): a rounded sheet
 * with a wavy hem, a lavender shadow, little eyes and blush. 30x34 px. */
function ghostTexture(scene: Phaser.Scene, key: string): void {
  if (scene.textures.exists(key)) return
  const w = 30, h = 34
  const texture = scene.textures.createCanvas(key, w, h)
  if (!texture) return
  const ctx = texture.context
  ctx.beginPath()
  ctx.moveTo(3, 18)
  ctx.bezierCurveTo(3, 6, 9, 2, 15, 2)
  ctx.bezierCurveTo(21, 2, 27, 6, 27, 18)
  ctx.lineTo(27, 29)
  for (let k = 0; k < 4; k++) { const x = 27 - k * 6; ctx.quadraticCurveTo(x - 1.5, 33, x - 3, 29); ctx.quadraticCurveTo(x - 4.5, 25.5, x - 6, 29) }
  ctx.closePath()
  const body = ctx.createLinearGradient(8, 2, 22, 32)
  body.addColorStop(0, '#ffffff')
  body.addColorStop(0.6, '#f2eefc')
  body.addColorStop(1, '#cfc6e6')
  ctx.fillStyle = body
  ctx.fill()
  ctx.lineWidth = 1.4
  ctx.strokeStyle = 'rgba(96, 82, 120, 0.75)'
  ctx.stroke()
  ctx.fillStyle = '#3a2f48'
  ctx.beginPath(); ctx.ellipse(11, 15, 1.8, 2.4, 0, 0, Math.PI * 2); ctx.ellipse(19, 15, 1.8, 2.4, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.beginPath(); ctx.arc(11.6, 14.2, 0.7, 0, Math.PI * 2); ctx.arc(19.6, 14.2, 0.7, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = 'rgba(240, 140, 160, 0.6)'
  ctx.beginPath(); ctx.ellipse(8.5, 19, 2, 1.2, 0, 0, Math.PI * 2); ctx.ellipse(21.5, 19, 2, 1.2, 0, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#3a2f48'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.arc(15, 18.5, 1.8, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke()
  texture.refresh()
}

/** A little bat (two flap frames), soft-edged: a round body, ears and bezier wings. 34x18 px. */
function batTexture(scene: Phaser.Scene, key: string, wingsUp: boolean): void {
  if (scene.textures.exists(key)) return
  const w = 34, h = 18
  const texture = scene.textures.createCanvas(key, w, h)
  if (!texture) return
  const ctx = texture.context
  const tip = wingsUp ? 1 : 16, mid = wingsUp ? 6 : 12
  ctx.fillStyle = '#4a3a5e'
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(17, 9)
    ctx.quadraticCurveTo(17 + side * 8, mid - 4, 17 + side * 16, tip)
    ctx.quadraticCurveTo(17 + side * 13, mid + 1, 17 + side * 11, mid + 3)
    ctx.quadraticCurveTo(17 + side * 8, mid + 1, 17 + side * 6, mid + 4)
    ctx.quadraticCurveTo(17 + side * 4, 10, 17, 11)
    ctx.closePath()
    ctx.fill()
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(170, 150, 200, 0.75)'
    ctx.stroke()
  }
  const body = ctx.createRadialGradient(16, 8, 1, 17, 10, 6)
  body.addColorStop(0, '#6a5680')
  body.addColorStop(1, '#2e2238')
  ctx.fillStyle = body
  ctx.beginPath(); ctx.ellipse(17, 10, 4, 4.6, 0, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.moveTo(14, 7); ctx.lineTo(14.6, 3.6); ctx.lineTo(16, 6.4); ctx.moveTo(20, 7); ctx.lineTo(19.4, 3.6); ctx.lineTo(18, 6.4); ctx.fill()
  ctx.fillStyle = '#ffe28a'
  ctx.beginPath(); ctx.arc(15.6, 9.4, 0.8, 0, Math.PI * 2); ctx.arc(18.4, 9.4, 0.8, 0, Math.PI * 2); ctx.fill()
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
  private reducedMotion = false
  private moonGlow: Phaser.GameObjects.Image | null = null
  private moonTween?: Phaser.Tweens.Tween
  private fog: { image: Phaser.GameObjects.Image; at: Point; tween?: Phaser.Tweens.Tween }[] = []
  private movers = new Set<Phaser.GameObjects.Image>()
  private timers: Phaser.Time.TimerEvent[] = []

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /** The picture is night all day, so the time of day doesn't change what's shown. */
  create(_phase: DayPhase, reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion
    glowTexture(this.scene, 'hw-glow-moon', '255,214,160')
    fogTexture(this.scene, 'hw-fog')
    batTexture(this.scene, 'hw-bat-0', true)
    batTexture(this.scene, 'hw-bat-1', false)
    ghostTexture(this.scene, 'hw-ghost')
    this.moonGlow = this.scene.add.image(0, 0, 'hw-glow-moon').setDepth(RenderLayers.lightingShade + 0.05).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35)
    const fogAt: Point[] = [{ x: 0.3, y: 0.62 }, { x: 0.62, y: 0.7 }, { x: 0.78, y: 0.5 }, { x: 0.45, y: 0.45 }]
    for (const at of fogAt) {
      const image = this.scene.add.image(0, 0, 'hw-fog').setDepth(RenderLayers.atmosphereBack + 0.1).setAlpha(0.2)
      this.fog.push({ image, at })
    }
    this.timers.push(this.scene.time.addEvent({ delay: 2400, loop: true, callback: () => this.spawnBat() }))
    this.timers.push(this.scene.time.addEvent({ delay: 2600, loop: true, callback: () => this.spawnLeaf() }))
    this.timers.push(this.scene.time.addEvent({ delay: 11000, loop: true, callback: () => this.spawnGhost() }))
    this.animate()
  }

  resize(bounds: Phaser.Geom.Rectangle): void {
    this.bounds = new Phaser.Geom.Rectangle(bounds.x, bounds.y, bounds.width, bounds.height)
    if (this.moonGlow) {
      const size = HALLOWEEN_MOON.r * bounds.width * 6
      this.moonGlow.setPosition(this.px(HALLOWEEN_MOON), this.py(HALLOWEEN_MOON)).setDisplaySize(size, size)
    }
    for (const f of this.fog) {
      f.image.setPosition(this.px(f.at), this.py(f.at)).setDisplaySize(bounds.width * 0.42, bounds.width * 0.1)
    }
    this.animate()
  }

  setPhase(_phase?: DayPhase): void {} // eslint-disable-line @typescript-eslint/no-unused-vars

  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion
    this.animate()
  }

  private px(p: Point): number { return this.bounds.x + this.bounds.width * p.x }
  private py(p: Point): number { return this.bounds.y + this.bounds.height * p.y }

  private animate(): void {
    this.moonTween?.remove()
    this.moonTween = undefined
    if (this.moonGlow) {
      this.moonGlow.setAlpha(0.35)
      if (!this.reducedMotion) this.moonTween = this.scene.tweens.add({ targets: this.moonGlow, alpha: { from: 0.26, to: 0.42 }, duration: 3600, yoyo: true, repeat: -1, ease: 'Sine.InOut' })
    }
    for (const f of this.fog) {
      f.tween?.remove()
      f.tween = undefined
      f.image.setX(this.px(f.at))
      if (!this.reducedMotion && this.bounds.width) {
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
    if (this.reducedMotion || !this.bounds.width || this.movers.size > 12) return
    const fromLeft = Math.random() < 0.5
    // About half fly past the moon, so they show up as silhouettes against it.
    const nearMoon = Math.random() < 0.5
    const y0 = nearMoon ? this.py(HALLOWEEN_MOON) + this.bounds.width * HALLOWEEN_MOON.r * Phaser.Math.FloatBetween(-0.6, 0.6) : this.bounds.y + this.bounds.height * Phaser.Math.FloatBetween(0.04, 0.3)
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
    if (this.reducedMotion || !this.bounds.width || this.movers.size > 12) return
    if (!this.scene.textures.exists('leaf-01')) return
    const x0 = this.bounds.x + this.bounds.width * Phaser.Math.FloatBetween(0.12, 0.88)
    const y0 = this.bounds.y + this.bounds.height * Phaser.Math.FloatBetween(0.08, 0.3)
    const leaf = this.track(this.scene.add.image(x0, y0, 'leaf-0' + Phaser.Math.Between(1, 4))
      .setDepth(RenderLayers.ambientFront).setTint(Phaser.Utils.Array.GetRandom(LEAF_TINTS))
      .setScale(Phaser.Math.FloatBetween(0.05, 0.08) * Math.max(0.7, this.bounds.width / 1448)).setAlpha(0))
    const fall = this.bounds.height * Phaser.Math.FloatBetween(0.25, 0.45), drift = this.bounds.width * Phaser.Math.FloatBetween(-0.08, 0.08)
    this.scene.tweens.add({ targets: leaf, alpha: { from: 0, to: 0.75 }, duration: 600 })
    this.scene.tweens.add({ targets: leaf, y: y0 + fall, x: x0 + drift, angle: Phaser.Math.Between(-220, 220), duration: Phaser.Math.Between(5200, 8200), ease: 'Sine.InOut',
      onComplete: () => this.scene.tweens.add({ targets: leaf, alpha: 0, duration: 700, onComplete: () => leaf.destroy() }) })
  }

  private spawnGhost(): void {
    if (this.reducedMotion || !this.bounds.width) return
    const at = Phaser.Utils.Array.GetRandom(GHOST_SPOTS)
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
    this.moonTween?.remove()
    this.moonGlow?.destroy()
    this.moonGlow = null
    this.fog.forEach(f => { f.tween?.remove(); f.image.destroy() })
    this.fog = []
    this.movers.forEach(m => m.destroy())
    this.movers.clear()
  }
}
