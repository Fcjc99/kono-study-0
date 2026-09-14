import Phaser from 'phaser'
import type { EnvironmentSnapshot } from '../sanctuary/environmentManager'
import type { DayPhase } from '../sanctuary/types'
import { RenderLayers } from '../engine/RenderLayers'
import { TREE_STYLE_BY_ID, isTreeStyleId, treeStyleTextureKey, treeStyleTexturePath, type TreeStyleId } from '../data/treeStyles'

export const TREE_STAGE_NAMES = [
  'Quiet mound',
  'First sprout',
  'Young sapling',
  'Budding cherry tree',
  'First blossoms',
  'Full bloom',
] as const

const PHASES: readonly DayPhase[] = ['morning', 'afternoon', 'evening', 'night']
const STAGE_COUNT = TREE_STAGE_NAMES.length
const SOURCE_WIDTH = 1_448
const SOURCE_HEIGHT = 1_086
const TEXTURE_HEIGHT = 650
const ASSET_WIDTH = 410
const ASSET_HEIGHT = 430
const TREE_ANCHOR_X = 704
const TREE_GROUND_Y = 272
const CONTENT_BOTTOM_Y = 624
const TREE_ORIGIN_Y = CONTENT_BOTTOM_Y / TEXTURE_HEIGHT
const SHADOW_TEXTURE_KEY = 'evolution-tree-ground-shadow'

const SHADOW_WIDTHS = [126, 136, 152, 188, 224, 268] as const
const SHADOW_HEIGHTS = [30, 32, 34, 42, 48, 54] as const
// A style tree's footprint box, in the same SOURCE_WIDTH/HEIGHT coordinate space as the growth
// tree's own ASSET_WIDTH/HEIGHT — sized a bit larger since these are full illustrated trees, not
// the pixel-art growth sprites.
const TREE_STYLE_BOX_WIDTH = 460
const TREE_STYLE_BOX_HEIGHT = 480

const stageTextureKey = (phase: DayPhase, stage: number): string => `evolution-tree-${phase}-stage-${stage}`

const phaseShadowAlpha = (phase: DayPhase): number => {
  if (phase === 'morning') return 0.065
  if (phase === 'afternoon') return 0.095
  if (phase === 'evening') return 0.082
  return 0.050
}

const phaseShadowTint = (phase: DayPhase): number => {
  if (phase === 'morning') return 0x80694f
  if (phase === 'afternoon') return 0x59483a
  if (phase === 'evening') return 0x603a37
  return 0x233553
}

const phasePetalLimit = (phase: DayPhase, stage: number): number => {
  if (phase === 'night') return stage >= 5 ? 2 : 1
  if (phase === 'evening') return stage >= 5 ? 5 : 3
  if (phase === 'morning') return stage >= 5 ? 8 : 5
  return stage >= 5 ? 10 : 6
}

const phasePetalDelayMultiplier = (phase: DayPhase): number => {
  if (phase === 'morning') return 1.05
  if (phase === 'afternoon') return 1
  if (phase === 'evening') return 1.65
  return 3.8
}

export class TreeEvolutionSystem {
  private readonly scene: Phaser.Scene
  private shadow!: Phaser.GameObjects.Image
  private treeA!: Phaser.GameObjects.Image
  private treeB!: Phaser.GameObjects.Image
  private activeTree!: Phaser.GameObjects.Image
  private incomingTree!: Phaser.GameObjects.Image
  private phase: DayPhase = 'afternoon'
  private stage = 0
  private reducedMotion = false
  private sceneBounds = new Phaser.Geom.Rectangle()
  private treeDisplayWidth = ASSET_WIDTH
  private treeDisplayHeight = ASSET_HEIGHT
  private transitionToken = 0
  private nextPetalAt = 0
  private readonly persistentPetals = new Set<Phaser.GameObjects.Image>()
  private styleId: TreeStyleId | null = null
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
      for (let stage = 0; stage < STAGE_COUNT; stage += 1) {
        scene.load.image(stageTextureKey(phase, stage), `/garden/registered-22.8.6/evolution/cherry-tree/${phase}-stage-${stage}.png`)
      }
    })
  }

  /** A chosen tree style's 4 phase renders load as one batch, independent of the always-loaded
   * default growth stages — students who never touch this feature pay nothing extra for it. */
  static preloadStyle(scene: Phaser.Scene, styleId: TreeStyleId, phases: readonly DayPhase[] = PHASES): void {
    phases.forEach((phase) => scene.load.image(treeStyleTextureKey(styleId, phase), treeStyleTexturePath(styleId, phase)))
  }

  static isStyleLoaded(scene: Phaser.Scene, styleId: TreeStyleId): boolean {
    return scene.textures.exists(treeStyleTextureKey(styleId, 'afternoon'))
  }

  create(stage: number, phase: DayPhase, reducedMotion: boolean, styleId: string | null = null, styleScale = 1, styleFlipX = false, styleX: number | null = null, styleY: number | null = null): void {
    this.ensureShadowTexture()
    this.stage = Phaser.Math.Clamp(Math.round(stage), 0, STAGE_COUNT - 1)
    this.phase = phase
    this.reducedMotion = reducedMotion
    this.styleScale = Phaser.Math.Clamp(Number.isFinite(styleScale) ? styleScale : 1, 0.3, 3)
    this.styleFlipX = styleFlipX
    this.styleX = styleX
    this.styleY = styleY

    this.shadow = this.scene.add.image(0, 0, SHADOW_TEXTURE_KEY)
      .setDepth(RenderLayers.evolutionGround + 0.02)
      .setOrigin(0.5)
      .setAlpha(phaseShadowAlpha(phase))
      .setTint(phaseShadowTint(phase))

    this.treeA = this.scene.add.image(0, 0, stageTextureKey(phase, this.stage))
      .setDepth(RenderLayers.evolution)
      .setOrigin(0.5, TREE_ORIGIN_Y)
      .setAlpha(1)

    this.treeB = this.scene.add.image(0, 0, stageTextureKey(phase, this.stage))
      .setDepth(RenderLayers.evolution + 0.01)
      .setOrigin(0.5, TREE_ORIGIN_Y)
      .setAlpha(0)

    this.activeTree = this.treeA
    this.incomingTree = this.treeB

    if (isTreeStyleId(styleId)) this.applyStyle(styleId)
  }

  update(timeMs: number, environment: EnvironmentSnapshot): void {
    if (this.styleId) return
    const shadowAlpha = phaseShadowAlpha(this.phase) * (1 - environment.weatherShade * 0.36)
    this.shadow.setAlpha(Phaser.Math.Clamp(shadowAlpha, 0.025, 0.115))

    if (this.reducedMotion || this.stage < 4 || !this.sceneBounds.width) return
    if (environment.precipitation > 0.18 || environment.snowIntensity > 0.08) return
    if (timeMs < this.nextPetalAt || this.persistentPetals.size >= phasePetalLimit(this.phase, this.stage)) return

    const baseDelay = this.stage >= 5
      ? Phaser.Math.Between(760, 1_280)
      : Phaser.Math.Between(1_850, 2_900)
    const windFactor = Phaser.Math.Linear(1.08, 0.76, Phaser.Math.Clamp(environment.wind, 0, 1))
    this.nextPetalAt = timeMs + baseDelay * windFactor * phasePetalDelayMultiplier(this.phase)
    this.spawnPersistentPetal(environment)
    if (this.stage >= 5 && Math.random() < 0.24) {
      this.scene.time.delayedCall(Phaser.Math.Between(120, 280), () => {
        if (this.activeTree?.active && !this.reducedMotion && this.stage >= 5 && this.sceneBounds.width) this.spawnPersistentPetal(environment)
      })
    }
  }

  resize(sceneBounds: Phaser.Geom.Rectangle): void {
    this.sceneBounds = new Phaser.Geom.Rectangle(sceneBounds.x, sceneBounds.y, sceneBounds.width, sceneBounds.height)
    const scaleX = sceneBounds.width / SOURCE_WIDTH
    const scaleY = sceneBounds.height / SOURCE_HEIGHT
    this.treeDisplayWidth = ASSET_WIDTH * scaleX
    this.treeDisplayHeight = ASSET_HEIGHT * scaleY
    const anchorX = sceneBounds.left + TREE_ANCHOR_X * scaleX
    const anchorY = sceneBounds.top + TREE_GROUND_Y * scaleY

    ;[this.treeA, this.treeB].forEach((tree) => {
      tree
        .setPosition(anchorX, anchorY)
        .setDisplaySize(this.treeDisplayWidth, this.treeDisplayHeight)
    })

    this.shadow.setPosition(anchorX, anchorY - 14 * scaleY)
    this.updateShadowSize()
    if (this.styleId) this.layoutStyleImage()
  }

  /** Swaps in a chosen tree style in place of the default cherry tree's stage growth, or (passing
   * null/unknown) clears it back to the default. Caller must have already preloaded the style's
   * texture (see preloadStyle/isStyleLoaded) — this never triggers a load itself. */
  setStyle(styleId: string | null): void {
    const nextId = isTreeStyleId(styleId) ? styleId : null
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

  private applyStyle(id: TreeStyleId): void {
    this.styleId = id
    this.clearPersistentPetals()
    this.shadow.setVisible(false)
    this.treeA.setVisible(false)
    this.treeB.setVisible(false)
    const key = treeStyleTextureKey(id, this.phase)
    if (!this.styleImage) this.styleImage = this.scene.add.image(0, 0, key).setDepth(RenderLayers.evolution)
    else this.styleImage.setTexture(key).setVisible(true)
    if (this.sceneBounds.width) this.layoutStyleImage()
  }

  private clearStyle(): void {
    this.styleId = null
    this.styleImage?.setVisible(false)
    this.shadow.setVisible(true)
    this.treeA.setVisible(true)
    this.treeB.setVisible(this.treeB === this.incomingTree && this.incomingTree.alpha > 0)
  }

  private layoutStyleImage(): void {
    if (!this.styleImage || !this.styleId) return
    const style = TREE_STYLE_BY_ID[this.styleId]
    const scaleX = this.sceneBounds.width / SOURCE_WIDTH
    const scaleY = this.sceneBounds.height / SOURCE_HEIGHT
    const contentScale = Math.min(TREE_STYLE_BOX_WIDTH / style.contentWidth, TREE_STYLE_BOX_HEIGHT / style.contentHeight) * scaleX * this.styleScale
    const groundX = this.styleX == null ? this.sceneBounds.left + TREE_ANCHOR_X * scaleX : this.sceneBounds.left + this.styleX * this.sceneBounds.width
    const groundY = this.styleY == null ? this.sceneBounds.top + TREE_GROUND_Y * scaleY : this.sceneBounds.top + this.styleY * this.sceneBounds.height
    this.styleImage
      .setOrigin(style.anchorX, style.anchorY)
      .setPosition(groundX, groundY)
      .setDisplaySize(style.width * contentScale, style.height * contentScale)
      .setFlipX(this.styleFlipX)
  }

  setPhase(phase: DayPhase, animate = true): void {
    if (phase === this.phase) return
    this.phase = phase
    if (this.styleId) { this.styleImage?.setTexture(treeStyleTextureKey(this.styleId, phase)); return }
    this.transitionToken += 1
    this.scene.tweens.killTweensOf([this.activeTree, this.incomingTree])
    this.nextPetalAt = 0
    this.clearPersistentPetals()
    this.shadow
      .setAlpha(phaseShadowAlpha(phase))
      .setTint(phaseShadowTint(phase))

    if (!animate || this.reducedMotion || !this.sceneBounds.width) {
      this.activeTree.setTexture(stageTextureKey(phase, this.stage)).setAlpha(1)
      this.incomingTree.setTexture(stageTextureKey(phase, this.stage)).setAlpha(0)
      return
    }

    this.transitionToken += 1
    const token = this.transitionToken
    this.scene.tweens.killTweensOf([this.activeTree, this.incomingTree])
    if (this.incomingTree.alpha > this.activeTree.alpha) {
      [this.activeTree, this.incomingTree] = [this.incomingTree, this.activeTree]
    }
    const outgoing = this.activeTree
    const incoming = this.incomingTree
    incoming
      .setTexture(stageTextureKey(phase, this.stage))
      .setAlpha(0)
      .setAngle(0)
      .setDisplaySize(this.treeDisplayWidth, this.treeDisplayHeight)

    this.scene.tweens.add({ targets: outgoing, alpha: 0, duration: 520, ease: 'Sine.InOut' })
    this.scene.tweens.add({
      targets: incoming,
      alpha: 1,
      duration: 520,
      ease: 'Sine.InOut',
      onComplete: () => {
        if (token !== this.transitionToken) return
        outgoing.setTexture(stageTextureKey(phase, this.stage)).setAlpha(0).setAngle(0)
        this.activeTree = incoming
        this.incomingTree = outgoing
      },
    })
  }

  setStage(stage: number, animate = true): void {
    const nextStage = Phaser.Math.Clamp(Math.round(stage), 0, STAGE_COUNT - 1)
    if (nextStage === this.stage) return
    const previousStage = this.stage
    this.stage = nextStage
    if (this.styleId) return
    this.nextPetalAt = 0
    this.transitionToken += 1
    const token = this.transitionToken
    this.scene.tweens.killTweensOf([this.activeTree, this.incomingTree, this.shadow])
    this.updateShadowSize()

    if (!animate || this.reducedMotion || !this.sceneBounds.width) {
      this.activeTree
        .setTexture(stageTextureKey(this.phase, nextStage))
        .setAlpha(1)
        .setAngle(0)
        .setDisplaySize(this.treeDisplayWidth, this.treeDisplayHeight)
      this.incomingTree.setAlpha(0)
      return
    }

    if (this.incomingTree.alpha > this.activeTree.alpha) {
      [this.activeTree, this.incomingTree] = [this.incomingTree, this.activeTree]
    }
    const outgoing = this.activeTree
    const incoming = this.incomingTree
    incoming
      .setTexture(stageTextureKey(this.phase, nextStage))
      .setAlpha(0)
      .setAngle(0)
      .setDisplaySize(this.treeDisplayWidth, this.treeDisplayHeight)

    this.scene.tweens.add({ targets: outgoing, alpha: 0, duration: 620, ease: 'Sine.Out' })
    this.scene.tweens.add({
      targets: incoming,
      alpha: 1,
      duration: 620,
      ease: 'Sine.Out',
      onComplete: () => {
        if (token !== this.transitionToken) return
        outgoing.setTexture(stageTextureKey(this.phase, nextStage)).setAlpha(0).setAngle(0)
        this.activeTree = incoming
        this.incomingTree = outgoing
      },
    })
    this.spawnGrowthAccent(previousStage, nextStage)
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion
    if (reducedMotion) {
      this.activeTree.setAngle(0).setDisplaySize(this.treeDisplayWidth, this.treeDisplayHeight)
      this.clearPersistentPetals()
    }
  }

  destroy(): void {
    this.scene.tweens.killTweensOf([this.shadow, this.treeA, this.treeB])
    this.clearPersistentPetals()
    this.shadow.destroy()
    this.treeA.destroy()
    this.treeB.destroy()
    this.styleImage?.destroy()
  }

  private updateShadowSize(): void {
    if (!this.sceneBounds.width || !this.shadow) return
    const scaleX = this.sceneBounds.width / SOURCE_WIDTH
    const scaleY = this.sceneBounds.height / SOURCE_HEIGHT
    this.shadow.setDisplaySize(SHADOW_WIDTHS[this.stage] * scaleX, SHADOW_HEIGHTS[this.stage] * scaleY)
  }

  private spawnGrowthAccent(previousStage: number, nextStage: number): void {
    if (nextStage <= previousStage || nextStage < 4 || this.reducedMotion) return
    const count = nextStage >= 5 ? 9 : 5
    const scale = this.sceneBounds.width / SOURCE_WIDTH
    const centerX = this.sceneBounds.left + this.sceneBounds.width * (TREE_ANCHOR_X / SOURCE_WIDTH)
    const centerY = this.sceneBounds.top + this.sceneBounds.height * ((TREE_GROUND_Y - (nextStage >= 5 ? 230 : 190)) / SOURCE_HEIGHT)
    const spread = nextStage >= 5 ? 165 : 122

    for (let index = 0; index < count; index += 1) {
      const id = String((index % 4) + 1).padStart(2, '0')
      const sprite = this.scene.add.image(
        centerX + Phaser.Math.Between(-spread, spread) * scale,
        centerY + Phaser.Math.Between(-52, 30) * scale,
        `petal-${id}`,
      )
        .setDepth(RenderLayers.evolutionFront)
        .setAlpha(0)
        .setScale(Phaser.Math.FloatBetween(0.034, 0.062) * scale)
        .setAngle(Phaser.Math.Between(-22, 22))

      this.scene.tweens.add({
        targets: sprite,
        x: sprite.x + Phaser.Math.Between(-54, 72) * scale,
        y: sprite.y + Phaser.Math.Between(52, 92) * scale,
        angle: sprite.angle + Phaser.Math.Between(120, 300),
        duration: Phaser.Math.Between(1_250, 1_950),
        delay: index * 60,
        ease: 'Sine.InOut',
        onUpdate: (tween) => {
          const fadeIn = Math.min(1, tween.progress / 0.18)
          const fadeOut = Math.min(1, (1 - tween.progress) / 0.28)
          sprite.setAlpha((this.phase === 'night' ? 0.45 : 0.72) * fadeIn * fadeOut)
        },
        onComplete: () => sprite.destroy(),
      })
    }
  }

  private spawnPersistentPetal(environment: EnvironmentSnapshot): void {
    if (this.persistentPetals.size >= phasePetalLimit(this.phase, this.stage) || !this.sceneBounds.width) return
    const scale = this.sceneBounds.width / SOURCE_WIDTH
    const anchorX = this.sceneBounds.left + this.sceneBounds.width * (TREE_ANCHOR_X / SOURCE_WIDTH)
    const anchorY = this.sceneBounds.top + this.sceneBounds.height * (TREE_GROUND_Y / SOURCE_HEIGHT)
    const mature = this.stage >= 5
    const halfWidth = (mature ? 186 : 132) * scale
    const canopyY = anchorY - (mature ? 235 : 192) * scale
    const id = String(Phaser.Math.Between(1, 4)).padStart(2, '0')
    const petal = this.scene.add.image(
      anchorX + Phaser.Math.FloatBetween(-halfWidth, halfWidth),
      canopyY + Phaser.Math.Between(-56, 40) * scale,
      `petal-${id}`,
    )
      .setDepth(RenderLayers.evolutionFront)
      .setAlpha(this.phase === 'night' ? 0.24 : this.phase === 'evening' ? 0.42 : this.phase === 'morning' ? 0.58 : 0.66)
      .setScale(Phaser.Math.FloatBetween(0.026, 0.048) * scale)
      .setAngle(Phaser.Math.Between(-40, 40))

    this.persistentPetals.add(petal)
    const direction = Math.random() < 0.5 ? -1 : 1
    const windDrift = Phaser.Math.Linear(24, 112, Phaser.Math.Clamp(environment.wind, 0, 1)) * direction
    const duration = Phaser.Math.Between(3_200, 5_200)
    this.scene.tweens.add({
      targets: petal,
      x: petal.x + (windDrift + Phaser.Math.Between(-34, 34)) * scale,
      y: petal.y + Phaser.Math.Between(86, 156) * scale,
      angle: petal.angle + direction * Phaser.Math.Between(190, 420),
      duration,
      ease: 'Sine.InOut',
      onComplete: () => this.destroyPersistentPetal(petal),
    })
    this.scene.tweens.add({
      targets: petal,
      alpha: 0,
      duration: Math.round(duration * 0.34),
      delay: Math.round(duration * 0.62),
      ease: 'Sine.In',
    })
  }

  private destroyPersistentPetal(petal: Phaser.GameObjects.Image): void {
    this.persistentPetals.delete(petal)
    if (petal.active) petal.destroy()
  }

  private clearPersistentPetals(): void {
    this.persistentPetals.forEach((petal) => {
      this.scene.tweens.killTweensOf(petal)
      if (petal.active) petal.destroy()
    })
    this.persistentPetals.clear()
  }

  private ensureShadowTexture(): void {
    if (this.scene.textures.exists(SHADOW_TEXTURE_KEY)) return
    const graphics = this.scene.make.graphics({ x: 0, y: 0 })
    for (let width = 238; width >= 168; width -= 10) {
      const normalized = (width - 168) / 70
      graphics.fillStyle(0xffffff, 0.018 + (1 - normalized) * 0.012)
      graphics.fillEllipse(128, 42, width, 58 * (width / 238))
    }
    graphics.generateTexture(SHADOW_TEXTURE_KEY, 256, 84)
    graphics.destroy()
  }
}
