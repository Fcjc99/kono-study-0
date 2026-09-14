import Phaser from 'phaser'
import { RenderLayers } from '../engine/RenderLayers'
import { LIGHTING_FOUNDATION } from '../sanctuary/lightingFoundation'
import type { DayPhase } from '../sanctuary/types'
import { HOME_STYLE_BY_ID, homeStyleTextureKey, homeStyleTexturePath, isHomeStyleId, type HomeStyleId } from '../data/homeStyles'

export const HOME_STAGE_NAMES = [
  'Original cottage',
  'Front porch cottage',
  'Extended cottage',
  'Lived-in cottage',
  'Sanctuary cottage',
  'Living sanctuary home',
] as const

const PHASES: readonly DayPhase[] = ['morning', 'afternoon', 'evening', 'night']
const STAGE_COUNT = HOME_STAGE_NAMES.length
const SOURCE_WIDTH = 1_448
const SOURCE_HEIGHT = 1_086
const CROP_X = 100
const CROP_Y = 300
const CROP_WIDTH = 500
const CROP_HEIGHT = 450
const VEGETABLE_GARDEN_OFFSET_X = 0
const VEGETABLE_GARDEN_OFFSET_Y = -25

const textureKey = (phase: DayPhase, stage: number): string => `evolution-home-${phase}-stage-${stage}`
const shadowKey = (stage: number): string => `evolution-home-ground-shadow-${stage}`
const smokeKey = (frame: number): string => `evolution-home-smoke-${String(frame).padStart(2, '0')}`
const vegetableGardenKey = (phase: DayPhase): string => `evolution-home-stage5-vegetable-garden-${phase}`
const visibleAlpha = (stage: number): number => stage === 0 ? 0 : 1

const SMOKE_SOURCE: Readonly<Record<number, readonly [number, number]>> = Object.freeze({
  4: [288, 61],
  5: [312, 16],
})

const SMOKE_TINT: Readonly<Record<DayPhase, number>> = Object.freeze({
  morning: 0xf1e3d4,
  afternoon: 0xf3eee6,
  evening: 0xe0c2b8,
  night: 0xaebed3,
})

/**
 * Build 21.0 home evolution:
 * - Stage 0 stays map-painted and immutable.
 * - Stage 2 gets repaired roof/step perimeter pixels.
 * - Stages 3-5 are rebalanced closer to the original cottage footprint.
 * - Later growth is communicated by dormers, flowers, vines, lanterns and chimney life,
 *   instead of making the house dramatically larger.
 * - A raster contact-shadow PNG grounds each upgrade into the existing path.
 * - Stages 4-5 use a tiny PNG chimney-smoke loop.
 * - Stage 5 removes the old gate/arch entirely and adds a small separate pixel-PNG vegetable garden.
 */
export class HomeEvolutionSystem {
  private readonly scene: Phaser.Scene
  private homeA!: Phaser.GameObjects.Image
  private homeB!: Phaser.GameObjects.Image
  private activeHome!: Phaser.GameObjects.Image
  private incomingHome!: Phaser.GameObjects.Image
  private groundShadow!: Phaser.GameObjects.Image
  private roofUnderlay!: Phaser.GameObjects.Image
  private smoke!: Phaser.GameObjects.Image
  private vegetableGarden!: Phaser.GameObjects.Image
  private smokeEvent?: Phaser.Time.TimerEvent
  private phase: DayPhase = 'afternoon'
  private stage = 0
  private reducedMotion = false
  private sceneBounds = new Phaser.Geom.Rectangle()
  private displayWidth = CROP_WIDTH
  private displayHeight = CROP_HEIGHT
  private transitionToken = 0
  private smokeFrame = 1
  private styleId: HomeStyleId | null = null
  private styleImage?: Phaser.GameObjects.Image
  private styleScale = 1
  private styleFlipX = false
  private styleX: number | null = null
  private styleY: number | null = null

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  static preload(scene: Phaser.Scene, phases: readonly DayPhase[] = PHASES): void {
    phases.forEach((phase) => {
      scene.load.image(`home-roof-underlay-${phase}`, `/garden/registered-22.8.6/evolution/home/${phase}-roof-underlay.png`)
      for (let stage = 0; stage < STAGE_COUNT; stage += 1) {
        scene.load.image(textureKey(phase, stage), `/garden/registered-22.8.6/evolution/home/${phase}-stage-${stage}.png`)
      }
    })
    for (let stage = 1; stage < STAGE_COUNT; stage += 1) {
      scene.load.image(shadowKey(stage), `/garden/evolution/home/ground-shadow-stage-${stage}.png`)
    }
    for (let frame = 1; frame <= 3; frame += 1) {
      scene.load.image(smokeKey(frame), `/garden/evolution/home/fx/chimney-smoke-${String(frame).padStart(2, '0')}.png`)
    }
    phases.forEach((phase) => {
      scene.load.image(vegetableGardenKey(phase), `/garden/registered-22.8.6/evolution/home/decor/vegetable-garden-stage5-${phase}.png`)
    })
  }

  /** A chosen home style's 4 phase renders load as one batch, independent of the default cottage's
   * always-loaded evolution art — students who never touch this feature pay nothing extra for it. */
  static preloadStyle(scene: Phaser.Scene, styleId: HomeStyleId, phases: readonly DayPhase[] = PHASES): void {
    phases.forEach((phase) => scene.load.image(homeStyleTextureKey(styleId, phase), homeStyleTexturePath(styleId, phase)))
  }

  static isStyleLoaded(scene: Phaser.Scene, styleId: HomeStyleId): boolean {
    return scene.textures.exists(homeStyleTextureKey(styleId, 'afternoon'))
  }

  create(stage: number, phase: DayPhase, reducedMotion: boolean, styleId: string | null = null, styleScale = 1, styleFlipX = false, styleX: number | null = null, styleY: number | null = null): void {
    this.stage = Phaser.Math.Clamp(Math.round(stage), 0, STAGE_COUNT - 1)
    this.phase = phase
    this.reducedMotion = reducedMotion
    this.styleScale = Phaser.Math.Clamp(Number.isFinite(styleScale) ? styleScale : 1, 0.3, 3)
    this.styleFlipX = styleFlipX
    this.styleX = styleX
    this.styleY = styleY

    this.groundShadow = this.scene.add.image(0, 0, shadowKey(Math.max(1, this.stage)))
      .setOrigin(0)
      .setDepth(RenderLayers.evolution - 0.22)
      .setAlpha(this.stage > 0 ? this.shadowAlpha() : 0)

    this.roofUnderlay = this.scene.add.image(0, 0, `home-roof-underlay-${phase}`)
      .setOrigin(0).setDepth(RenderLayers.evolution - 0.21)
      .setAlpha(this.stage > 0 ? 1 : 0)

    this.homeA = this.scene.add.image(0, 0, textureKey(phase, this.stage))
      .setOrigin(0)
      .setDepth(RenderLayers.evolution - 0.2)
      .setAlpha(visibleAlpha(this.stage))

    this.homeB = this.scene.add.image(0, 0, textureKey(phase, this.stage))
      .setOrigin(0)
      .setDepth(RenderLayers.evolution - 0.19)
      .setAlpha(0)

    this.activeHome = this.homeA
    this.incomingHome = this.homeB

    this.vegetableGarden = this.scene.add.image(0, 0, vegetableGardenKey(phase))
      .setOrigin(0)
      .setDepth(RenderLayers.evolution - 0.18)
      .setAlpha(this.stage === 5 ? 1 : 0)

    this.smoke = this.scene.add.image(0, 0, smokeKey(1))
      .setOrigin(0.5, 1)
      .setDepth(RenderLayers.evolutionFront + 0.05)
      .setBlendMode(Phaser.BlendModes.NORMAL)
      .setAlpha(0)

    this.smokeEvent = this.scene.time.addEvent({
      delay: 520,
      loop: true,
      callback: () => this.advanceSmoke(),
    })
    this.refreshDecor()
    if (isHomeStyleId(styleId)) this.applyStyle(styleId)
  }

  resize(sceneBounds: Phaser.Geom.Rectangle): void {
    this.sceneBounds = new Phaser.Geom.Rectangle(sceneBounds.x, sceneBounds.y, sceneBounds.width, sceneBounds.height)
    const scaleX = sceneBounds.width / SOURCE_WIDTH
    const scaleY = sceneBounds.height / SOURCE_HEIGHT
    this.displayWidth = CROP_WIDTH * scaleX
    this.displayHeight = CROP_HEIGHT * scaleY
    const x = sceneBounds.left + CROP_X * scaleX
    const y = sceneBounds.top + CROP_Y * scaleY
    ;[this.groundShadow, this.roofUnderlay, this.homeA, this.homeB].forEach((home) => home.setPosition(x, y).setDisplaySize(this.displayWidth, this.displayHeight))
    this.vegetableGarden
      .setPosition(x + VEGETABLE_GARDEN_OFFSET_X * scaleX, y + VEGETABLE_GARDEN_OFFSET_Y * scaleY)
      .setDisplaySize(this.displayWidth, this.displayHeight)
    this.positionSmoke(scaleX, scaleY)
    if (this.styleId) this.layoutStyleImage()
  }

  setStage(stage: number, animate = true): void {
    const nextStage = Phaser.Math.Clamp(Math.round(stage), 0, STAGE_COUNT - 1)
    if (nextStage === this.stage) return
    this.stage = nextStage
    this.roofUnderlay.setAlpha(nextStage > 0 ? 1 : 0)
    this.groundShadow
      .setTexture(shadowKey(Math.max(1, nextStage)))
      .setAlpha(nextStage > 0 ? this.shadowAlpha() : 0)
    this.swapTo(textureKey(this.phase, nextStage), visibleAlpha(nextStage), animate ? 560 : 0)
    this.vegetableGarden.setAlpha(nextStage === 5 ? 1 : 0)
    this.refreshDecor()
  }

  setPhase(phase: DayPhase): void {
    if (phase === this.phase) return
    this.phase = phase
    this.roofUnderlay.setTexture(`home-roof-underlay-${phase}`)
    this.groundShadow.setAlpha(this.stage > 0 ? this.shadowAlpha() : 0)
    // Build 22.1: phase art swaps with the painted base map; do not crossfade
    // two differently graded house silhouettes over each other.
    this.swapTo(textureKey(phase, this.stage), visibleAlpha(this.stage), 0)
    this.vegetableGarden.setTexture(vegetableGardenKey(phase)).setAlpha(this.stage === 5 ? 1 : 0)
    this.refreshDecor()
    if (this.styleId) this.styleImage?.setTexture(homeStyleTextureKey(this.styleId, phase))
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion
    this.refreshDecor()
  }

  /** Swaps in a chosen home style in place of the default cottage's stage evolution, or (passing
   * null/unknown) clears it back to the default. Caller must have already preloaded the style's
   * textures (see preloadStyle/isStyleLoaded) — this never triggers a load itself. */
  setStyle(styleId: string | null): void {
    const nextId = isHomeStyleId(styleId) ? styleId : null
    if (nextId === this.styleId) return
    if (!nextId) { this.clearStyle(); return }
    this.applyStyle(nextId)
  }

  /** User-controlled resize/mirror on top of the auto-computed contain-fit sizing — independent of
   * which style is chosen, so switching styles doesn't reset a player's preferred look. */
  setStyleTransform(scale: number, flipX: boolean): void {
    this.styleScale = Phaser.Math.Clamp(Number.isFinite(scale) ? scale : 1, 0.3, 3)
    this.styleFlipX = flipX
    if (this.styleId) this.layoutStyleImage()
  }

  /** A dragged position, as a fraction of the scene bounds — null falls back to the default
   * ground-anchored spot the contain-fit math computes on its own. */
  setStylePosition(x: number | null, y: number | null): void {
    this.styleX = x
    this.styleY = y
    if (this.styleId) this.layoutStyleImage()
  }

  destroy(): void {
    this.scene.tweens.killTweensOf([this.homeA, this.homeB, this.smoke, this.vegetableGarden])
    this.smokeEvent?.destroy()
    this.groundShadow.destroy()
    this.roofUnderlay.destroy()
    this.vegetableGarden.destroy()
    this.smoke.destroy()
    this.homeA.destroy()
    this.homeB.destroy()
    this.styleImage?.destroy()
  }

  private applyStyle(id: HomeStyleId): void {
    this.styleId = id
    this.groundShadow.setVisible(false)
    this.roofUnderlay.setVisible(false)
    this.homeA.setVisible(false)
    this.homeB.setVisible(false)
    this.vegetableGarden.setVisible(false)
    this.smoke.setVisible(false)
    const key = homeStyleTextureKey(id, this.phase)
    if (!this.styleImage) this.styleImage = this.scene.add.image(0, 0, key).setDepth(RenderLayers.evolution - 0.2)
    else this.styleImage.setTexture(key).setVisible(true)
    if (this.sceneBounds.width) this.layoutStyleImage()
  }

  private clearStyle(): void {
    this.styleId = null
    this.styleImage?.setVisible(false)
    this.groundShadow.setVisible(true)
    this.roofUnderlay.setVisible(true)
    this.homeA.setVisible(true)
    this.homeB.setVisible(true)
    this.vegetableGarden.setVisible(true)
    this.refreshDecor()
  }

  private layoutStyleImage(): void {
    if (!this.styleImage || !this.styleId) return
    const style = HOME_STYLE_BY_ID[this.styleId]
    const scaleX = this.sceneBounds.width / SOURCE_WIDTH
    const scaleY = this.sceneBounds.height / SOURCE_HEIGHT
    // A single uniform scale (not scaleX/scaleY independently) keeps this pre-rendered art's own
    // aspect ratio intact — unlike the default cottage's per-phase art, it was never painted to
    // tolerate a non-uniform stretch.
    const contentScale = Math.min(CROP_WIDTH / style.contentWidth, CROP_HEIGHT / style.contentHeight) * scaleX * this.styleScale
    const groundX = this.styleX == null ? this.sceneBounds.left + (CROP_X + CROP_WIDTH / 2) * scaleX : this.sceneBounds.left + this.styleX * this.sceneBounds.width
    const groundY = this.styleY == null ? this.sceneBounds.top + (CROP_Y + CROP_HEIGHT) * scaleY : this.sceneBounds.top + this.styleY * this.sceneBounds.height
    this.styleImage
      .setOrigin(style.anchorX, style.anchorY)
      .setPosition(groundX, groundY)
      .setDisplaySize(style.width * contentScale, style.height * contentScale)
      .setFlipX(this.styleFlipX)
  }

  private swapTo(nextTexture: string, nextAlpha: number, duration: number): void {
    this.transitionToken += 1
    const token = this.transitionToken
    this.scene.tweens.killTweensOf([this.activeHome, this.incomingHome])

    if (this.reducedMotion || duration <= 0 || !this.sceneBounds.width) {
      this.activeHome.setTexture(nextTexture).setAlpha(nextAlpha).setDisplaySize(this.displayWidth, this.displayHeight)
      this.incomingHome.setAlpha(0)
      return
    }

    // A rapid retarget must retain the more-visible layer, not reset both.
    if (this.incomingHome.alpha > this.activeHome.alpha) {
      [this.activeHome, this.incomingHome] = [this.incomingHome, this.activeHome]
    }
    const outgoing = this.activeHome
    const incoming = this.incomingHome
    incoming.setTexture(nextTexture).setAlpha(0).setDisplaySize(this.displayWidth, this.displayHeight)

    this.scene.tweens.add({ targets: outgoing, alpha: 0, duration, ease: 'Sine.InOut' })
    this.scene.tweens.add({
      targets: incoming,
      alpha: nextAlpha,
      duration,
      ease: 'Sine.InOut',
      onComplete: () => {
        if (token !== this.transitionToken) return
        outgoing.setTexture(nextTexture).setAlpha(0)
        this.activeHome = incoming
        this.incomingHome = outgoing
      },
    })
  }

  private shadowAlpha(): number {
    return Phaser.Math.Clamp(0.18 * LIGHTING_FOUNDATION[this.phase].contactShadowStrength, 0.07, 0.18)
  }

  private refreshDecor(): void {
    const hasSmoke = this.stage >= 4 && !this.styleId
    this.smoke.setVisible(hasSmoke)
    if (!hasSmoke) {
      this.smoke.setAlpha(0)
      return
    }
    this.smoke.setTint(SMOKE_TINT[this.phase])
    const phaseAlpha = this.phase === 'night' ? 0.62 : this.phase === 'evening' ? 0.55 : 0.42
    this.smoke.setAlpha(phaseAlpha)
    if (this.sceneBounds.width) {
      const scaleX = this.sceneBounds.width / SOURCE_WIDTH
      const scaleY = this.sceneBounds.height / SOURCE_HEIGHT
      this.positionSmoke(scaleX, scaleY)
    }
  }

  private positionSmoke(scaleX: number, scaleY: number): void {
    const source = SMOKE_SOURCE[this.stage]
    if (!source) return
    const x = this.sceneBounds.left + (CROP_X + source[0]) * scaleX
    const y = this.sceneBounds.top + (CROP_Y + source[1]) * scaleY
    this.smoke
      .setPosition(x, y)
      .setDisplaySize(32 * scaleX, 36 * scaleY)
  }

  private advanceSmoke(): void {
    if (this.reducedMotion || this.stage < 4 || !this.smoke.visible) return
    this.smokeFrame = this.smokeFrame % 3 + 1
    this.smoke.setTexture(smokeKey(this.smokeFrame))
    const baseAlpha = this.phase === 'night' ? 0.62 : this.phase === 'evening' ? 0.55 : 0.42
    this.scene.tweens.killTweensOf(this.smoke)
    this.smoke.setAlpha(baseAlpha * 0.78)
    this.scene.tweens.add({ targets: this.smoke, alpha: baseAlpha, duration: 260, ease: 'Sine.Out' })
  }
}
