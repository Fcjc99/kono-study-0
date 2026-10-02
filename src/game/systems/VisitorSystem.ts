import Phaser from 'phaser'
import { RenderLayers } from '../engine/RenderLayers'
import { SANCTUARY_EVENTS } from '../sanctuary/runtime'
import type { DayPhase } from '../sanctuary/types'

/** Today's visitor (store/konoFriends): after a good week one of KONO's friends spends the day on
 * the grass near KONO's spot, hopping gently in place now and then. Its picture loads only when a
 * friend is visiting. With reduced motion it just sits still. */
const AT = { x: 0.66, y: 0.56 }
const HEIGHT_RATIO = 0.052
const NIGHT_TINT: Record<DayPhase, number> = { morning: 0xffffff, afternoon: 0xffffff, evening: 0xf0d8c8, night: 0x9aa4cc }
const key = (id: string) => 'friend-visitor-' + id

export class VisitorSystem {
  private readonly scene: Phaser.Scene
  private bounds = new Phaser.Geom.Rectangle()
  private image: Phaser.GameObjects.Image | null = null
  private shadow: Phaser.GameObjects.Ellipse | null = null
  private hop: Phaser.Tweens.Tween | null = null
  private id: string | null = null
  private phase: DayPhase = 'afternoon'
  private reducedMotion = false

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  create(id: string | null, phase: DayPhase, reducedMotion: boolean): void {
    this.phase = phase
    this.reducedMotion = reducedMotion
    this.scene.game.events.on(SANCTUARY_EVENTS.visitor, this.setVisitor, this)
    this.setVisitor(id)
  }

  setVisitor(id: unknown): void {
    this.id = typeof id === 'string' && /^[a-z]+$/.test(id) ? id : null
    if (!this.id) { this.clear(); return }
    const friend = this.id
    if (this.scene.textures.exists(key(friend))) { this.place(); return }
    this.scene.load.image(key(friend), '/garden/friends/' + friend + '.webp')
    this.scene.load.once(Phaser.Loader.Events.COMPLETE, () => { if (this.id === friend) this.place() })
    this.scene.load.start()
  }

  resize(bounds: Phaser.Geom.Rectangle): void {
    this.bounds = new Phaser.Geom.Rectangle(bounds.x, bounds.y, bounds.width, bounds.height)
    this.place()
  }

  setPhase(phase: DayPhase): void {
    this.phase = phase
    this.image?.setTint(NIGHT_TINT[phase])
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion
    this.place()
  }

  private place(): void {
    if (!this.id || !this.bounds.width || !this.scene.textures.exists(key(this.id))) return
    const x = Math.round(this.bounds.x + this.bounds.width * AT.x), y = Math.round(this.bounds.y + this.bounds.height * AT.y)
    if (!this.image) this.image = this.scene.add.image(x, y, key(this.id)).setOrigin(0.5, 0.92)
    if (!this.shadow) this.shadow = this.scene.add.ellipse(x, y, 10, 4, 0x1c2a18, 0.22)
    const scale = Math.max(22, this.bounds.height * HEIGHT_RATIO) / this.image.height
    const depth = RenderLayers.critters + 0.30 + AT.y * 0.12
    this.image.setTexture(key(this.id)).setPosition(x, y).setScale(scale).setDepth(depth).setVisible(true).setTint(NIGHT_TINT[this.phase])
    this.shadow.setPosition(x, y).setSize(this.image.displayWidth * 0.6, this.image.displayHeight * 0.14).setDepth(depth - 0.13).setVisible(true)
    this.hop?.remove()
    this.hop = this.reducedMotion ? null : this.scene.tweens.add({ targets: this.image, y: y - Math.max(2, this.image.displayHeight * 0.1), duration: 220, yoyo: true, repeat: 1, repeatDelay: 80, hold: 40, ease: 'Sine.Out', loopDelay: 2600, loop: -1 })
  }

  private clear(): void {
    this.hop?.remove()
    this.hop = null
    this.image?.setVisible(false)
    this.shadow?.setVisible(false)
  }

  destroy(): void {
    this.scene.game.events.off(SANCTUARY_EVENTS.visitor, this.setVisitor, this)
    this.hop?.remove()
    this.image?.destroy()
    this.shadow?.destroy()
    this.image = null
    this.shadow = null
  }
}
