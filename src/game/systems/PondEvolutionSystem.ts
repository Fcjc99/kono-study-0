import Phaser from 'phaser'
import type { EnvironmentSnapshot } from '../sanctuary/environmentManager'
import { RenderLayers } from '../engine/RenderLayers'
import { POND_STYLE_BY_ID, isPondStyleId, pondStyleTextureKey, pondStyleTexturePath, type PondStyleId } from '../data/pondStyles'
import type { DayPhase } from '../sanctuary/types'

const PHASES: readonly DayPhase[] = ['morning', 'afternoon', 'evening', 'night']

export const POND_STAGE_NAMES = [
  'Natural pond',
  'Rippled water',
  'Lily pond',
  'First koi',
  'Koi garden',
  'Sanctuary pond',
] as const

const SOURCE_WIDTH = 1_448
const SOURCE_HEIGHT = 1_086
const POND_BOX_X = 520
const POND_BOX_Y = 525
const POND_CENTER_X = 735
const POND_CENTER_Y = 706
const POND_RADIUS_X = 132
const POND_RADIUS_Y = 43
const MAX_FISH = 3
const KOI_DIRECTIONS = 8
const KOI_FRAMES = 2
const ASSET_ROOT = '/garden/evolution/pond'
// A chosen pond style is a complete standalone illustration (its own shoreline/rocks/grass, not
// just open water) sized to fully cover the painted pond+rocks on the terrace map, not just the
// safe-swimming water box above. Measured against the actual painted map, not the swim-path box.
const POND_STYLE_BOX_WIDTH = 400
const POND_STYLE_BOX_HEIGHT = 260
const POND_STYLE_GROUND_X = 735
const POND_STYLE_GROUND_Y = 800

/**
 * Build 21.5 koi routes.
 *
 * These points were sampled from the intersection of the eroded production pond-water
 * masks for morning, afternoon, evening, and night. The erosion reserves enough room
 * for the full koi sprite, so fish do not clip the painted shoreline, rocks, or baked
 * lily pads in any time-of-day phase. Coordinates are local to the 515x285 production pond crop.
 */
type KoiPoint = readonly [number, number]
const KOI_SWIM_PATHS: readonly (readonly KoiPoint[])[] = Object.freeze([
  Object.freeze([[285, 145], [330, 150], [370, 155], [400, 170], [385, 190], [350, 205], [300, 210], [255, 200], [235, 185], [235, 165], [250, 150]] as const),
  Object.freeze([[255, 155], [295, 150], [330, 160], [350, 175], [335, 190], [300, 200], [265, 195], [240, 180], [240, 165]] as const),
  Object.freeze([[320, 160], [360, 155], [392, 165], [400, 175], [380, 185], [350, 198], [315, 190], [300, 175]] as const),
])

const KOI_VARIANTS = ['orange-white', 'red-white', 'gold-black'] as const
type KoiVariant = (typeof KOI_VARIANTS)[number]

interface KoiRuntime {
  sprite: Phaser.GameObjects.Image
  variant: KoiVariant
  phase: number
  speed: number
  direction: number
  pathIndex: number
}

interface DecorationSpec {
  key: string
  file: string
  minStage: number
  x: number
  y: number
  scale: number
  alpha: number
  depth: number
  pulse?: boolean
  nightBoost?: boolean
  flipX?: boolean
  mapX?: number
  mapY?: number
}

const DECORATIONS: readonly DecorationSpec[] = [
  { key: 'pond-ripple-large', file: 'ripple-large.png', minStage: 1, x: -0.12, y: 0.06, scale: 0.92, alpha: 0.58, depth: RenderLayers.pondGlint - 0.08 },
  { key: 'pond-ripple-small', file: 'ripple-small.png', minStage: 1, x: 0.46, y: -0.18, scale: 0.78, alpha: 0.50, depth: RenderLayers.pondGlint - 0.07 },
  { key: 'pond-lily-1', file: 'lily-pad-1.png', minStage: 2, x: -0.46, y: -0.08, scale: 0.62, alpha: 0.90, depth: RenderLayers.pondLife + 0.06 },
  { key: 'pond-lily-2', file: 'lily-pad-2.png', minStage: 2, x: -0.17, y: 0.28, scale: 0.54, alpha: 0.88, depth: RenderLayers.pondLife + 0.07 },
  { key: 'pond-lily-3', file: 'lily-pad-3.png', minStage: 2, x: 0.36, y: -0.04, scale: 0.50, alpha: 0.86, depth: RenderLayers.pondLife + 0.08 },
  { key: 'pond-lotus-1', file: 'lotus-pink.png', minStage: 2, x: -0.36, y: -0.34, scale: 0.50, alpha: 0.96, depth: RenderLayers.pondLife + 0.10 },

  // Stage 4 becomes a true koi garden without changing the pond footprint.
  { key: 'pond-reeds-1', file: 'reeds-cluster.png', minStage: 4, x: 0, y: 0, mapX: 892, mapY: 641, scale: 0.56, alpha: 0.94, depth: RenderLayers.gardenFront - 0.03 },
  { key: 'pond-stones-1', file: 'moss-stones.png', minStage: 4, x: 0, y: 0, mapX: 628, mapY: 732, scale: 0.54, alpha: 0.88, depth: RenderLayers.pondLife + 0.02 },
  { key: 'pond-flowers-1', file: 'shore-flowers.png', minStage: 4, x: 0, y: 0, mapX: 650, mapY: 642, scale: 0.52, alpha: 0.90, depth: RenderLayers.gardenFront - 0.02 },

  // Stage 5 adds a second shoreline layer and subtle reflective life.
  { key: 'pond-lotus-2', file: 'lotus-pink.png', minStage: 5, x: 0.54, y: 0.26, scale: 0.44, alpha: 0.92, depth: RenderLayers.pondLife + 0.11, flipX: true },
  { key: 'pond-reeds-2', file: 'reeds-cluster.png', minStage: 5, x: 0, y: 0, mapX: 670, mapY: 645, scale: 0.46, alpha: 0.86, depth: RenderLayers.gardenFront - 0.035, flipX: true },
  { key: 'pond-stones-2', file: 'moss-stones.png', minStage: 5, x: 0, y: 0, mapX: 925, mapY: 730, scale: 0.46, alpha: 0.82, depth: RenderLayers.pondLife + 0.025, flipX: true },
  { key: 'pond-flowers-2', file: 'shore-flowers.png', minStage: 5, x: 0, y: 0, mapX: 925, mapY: 680, scale: 0.46, alpha: 0.84, depth: RenderLayers.gardenFront - 0.01, flipX: true },
  { key: 'pond-sparkle-1', file: 'water-sparkle.png', minStage: 5, x: -0.06, y: -0.30, scale: 0.50, alpha: 0.68, depth: RenderLayers.pondGlint + 0.04, pulse: true, nightBoost: true },
  { key: 'pond-sparkle-2', file: 'water-sparkle.png', minStage: 5, x: 0.46, y: 0.18, scale: 0.40, alpha: 0.54, depth: RenderLayers.pondGlint + 0.05, pulse: true, nightBoost: true },
]

const koiTextureKey = (variant: KoiVariant, direction: number, frame: number): string =>
  `pond-koi-${variant}-d${direction}-f${frame}`

const phaseKoiTint = (environment: EnvironmentSnapshot): number => {
  if (environment.phase === 'morning') return 0xfff2df
  if (environment.phase === 'evening') return 0xebc0b1
  if (environment.phase === 'night') return 0xb3c3e6
  return 0xffffff
}


const phaseDecorationTint = (environment: EnvironmentSnapshot): number => {
  if (environment.phase === 'morning') return 0xfff4e2
  if (environment.phase === 'evening') return 0xdfb19f
  if (environment.phase === 'night') return 0x97b0d1
  return 0xffffff
}

const phaseKoiVisibility = (environment: EnvironmentSnapshot): number => {
  if (environment.phase === 'morning') return 0.98
  if (environment.phase === 'evening') return 0.94
  if (environment.phase === 'night') return 0.82
  return 1
}

const phaseDecorationVisibility = (environment: EnvironmentSnapshot): number => {
  if (environment.phase === 'morning') return 0.98
  if (environment.phase === 'evening') return 0.82
  if (environment.phase === 'night') return 0.62
  return 1
}

const wrap01 = (value: number): number => ((value % 1) + 1) % 1

export class PondEvolutionSystem {
  private readonly scene: Phaser.Scene
  private readonly fish: KoiRuntime[] = []
  private readonly decorations: Phaser.GameObjects.Image[] = []
  private stage = 0
  private reducedMotion = false
  private motionTimeMs = 0
  private lastUpdateTimeMs: number | null = null
  private centerX = 0
  private centerY = 0
  private radiusX = 0
  private radiusY = 0
  private sceneScale = 1
  private scaleX = 1
  private scaleY = 1
  private sceneLeft = 0
  private sceneTop = 0
  private styleId: PondStyleId | null = null
  private styleImage?: Phaser.GameObjects.Image
  private styleScale = 1
  private styleFlipX = false
  private styleX: number | null = null
  private styleY: number | null = null
  private phase: DayPhase = 'afternoon'
  private sceneBounds = new Phaser.Geom.Rectangle()

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /** A chosen style's 4 day-phase variants load as their own batch, independent of the (now visually
   * inert) default koi/decoration assets — students who never pick a pond style pay nothing extra. */
  static preloadStyle(scene: Phaser.Scene, styleId: PondStyleId, phases: readonly DayPhase[] = PHASES): void {
    phases.forEach((phase) => scene.load.image(pondStyleTextureKey(styleId, phase), pondStyleTexturePath(styleId, phase)))
  }

  static isStyleLoaded(scene: Phaser.Scene, styleId: PondStyleId): boolean {
    return scene.textures.exists(pondStyleTextureKey(styleId, 'afternoon'))
  }

  /** True once a pond style image is on screen — callers use this to suppress the plain-water
   * ambient effects (ripple sprites) that were designed for the default painted pond and would
   * otherwise float visibly over the style artwork. */
  hasStyle(): boolean {
    return this.styleId !== null
  }

  static preload(scene: Phaser.Scene): void {
    KOI_VARIANTS.forEach((variant) => {
      for (let direction = 0; direction < KOI_DIRECTIONS; direction += 1) {
        for (let frame = 0; frame < KOI_FRAMES; frame += 1) {
          scene.load.image(
            koiTextureKey(variant, direction, frame),
            `${ASSET_ROOT}/koi-${variant}-d${direction}-f${frame}.png`,
          )
        }
      }
    })

    const uniqueAssets = new Map<string, string>()
    DECORATIONS.forEach((spec) => uniqueAssets.set(spec.key, spec.file))
    uniqueAssets.forEach((file, key) => scene.load.image(key, `${ASSET_ROOT}/${file}`))
  }

  create(stage: number, reducedMotion: boolean, styleId: string | null = null, styleScale = 1, styleFlipX = false, styleX: number | null = null, styleY: number | null = null): void {
    this.stage = Phaser.Math.Clamp(Math.round(stage), 0, POND_STAGE_NAMES.length - 1)
    this.reducedMotion = reducedMotion
    this.styleScale = Phaser.Math.Clamp(Number.isFinite(styleScale) ? styleScale : 1, 0.3, 3)
    this.styleFlipX = styleFlipX
    this.styleX = styleX
    this.styleY = styleY
    // Build 22.9: the koi/lily/reed stage-growth visuals below are retired in favor of the pond-style
    // system (setStyle) — progression still tracks and scores pond stage under the hood, it just no
    // longer draws anything for it. With no style chosen the pond is the plain painted water already
    // baked into the terrace map, nothing drawn on top of it; this.fish/this.decorations intentionally
    // stay empty so every method below that iterates them is already a no-op.
    if (isPondStyleId(styleId)) this.applyStyle(styleId)
  }

  update(timeMs: number, environment: EnvironmentSnapshot): void {
    const safeTimeMs = Number.isFinite(timeMs) ? timeMs : this.lastUpdateTimeMs ?? 0
    const elapsedMs = this.lastUpdateTimeMs === null ? 0 : Phaser.Math.Clamp(safeTimeMs - this.lastUpdateTimeMs, 0, 34)
    this.lastUpdateTimeMs = safeTimeMs
    // Preserve each fish's position across reduced motion and page sleep/resume.
    if (!this.reducedMotion) this.motionTimeMs += elapsedMs
    const weatherFade = Phaser.Math.Clamp(1 - environment.precipitation * 0.42, 0.48, 1)
    const koiPhaseFactor = phaseKoiVisibility(environment)
    const decorationPhaseFactor = phaseDecorationVisibility(environment)
    const visibleFish = this.fishCountForStage(this.stage)
    const koiTint = phaseKoiTint(environment)
    const decorationTint = phaseDecorationTint(environment)

    this.fish.forEach((runtime, index) => {
      const shouldBeVisible = index < visibleFish
      runtime.sprite.setVisible(shouldBeVisible)
      if (!shouldBeVisible) {
        runtime.sprite.setAlpha(0)
        return
      }

      const pathProgress = wrap01(runtime.phase + this.motionTimeMs * runtime.speed * runtime.direction)
      const current = this.sampleSwimPath(runtime.pathIndex, pathProgress)
      const lookAhead = this.sampleSwimPath(runtime.pathIndex, wrap01(pathProgress + runtime.direction * 0.0025))
      const x = this.sceneLeft + (POND_BOX_X + current.x) * this.scaleX
      const y = this.sceneTop + (POND_BOX_Y + current.y) * this.scaleY
      const dx = (lookAhead.x - current.x) * this.scaleX
      const dy = (lookAhead.y - current.y) * this.scaleY
      const heading = Math.atan2(dy, dx)
      const direction = (Math.round((heading / (Math.PI * 2)) * KOI_DIRECTIONS) + KOI_DIRECTIONS) % KOI_DIRECTIONS
      const frame = (Math.floor(this.motionTimeMs / (390 + index * 45)) + index) % KOI_FRAMES
      const alpha = Phaser.Math.Clamp((0.96 - index * 0.04) * koiPhaseFactor * weatherFade, 0.52, 0.96)

      runtime.sprite
        .setTexture(koiTextureKey(runtime.variant, direction, frame))
        .setPosition(Math.round(x), Math.round(y))
        .setAngle(0)
        .setTint(koiTint)
        .setAlpha(alpha)
    })

    this.decorations.forEach((image, index) => {
      const spec = image.getData('pondDecorationSpec') as DecorationSpec
      if (this.stage < spec.minStage || !image.visible) return
      const pulse = spec.pulse && !this.reducedMotion
        ? 0.76 + Math.sin(timeMs / (1_250 + index * 83) + index * 1.7) * 0.24
        : 1
      const nightBoost = spec.nightBoost && environment.phase === 'night' ? 1.28 : 1
      const alpha = Phaser.Math.Clamp(spec.alpha * decorationPhaseFactor * weatherFade * pulse * nightBoost, 0.18, 1)
      image.setTint(decorationTint).setAlpha(alpha)
    })

    if (environment.phase !== this.phase) {
      this.phase = environment.phase
      if (this.styleId) this.styleImage?.setTexture(pondStyleTextureKey(this.styleId, this.phase))
    }
  }

  resize(sceneBounds: Phaser.Geom.Rectangle): void {
    this.sceneBounds = new Phaser.Geom.Rectangle(sceneBounds.x, sceneBounds.y, sceneBounds.width, sceneBounds.height)
    this.scaleX = sceneBounds.width / SOURCE_WIDTH
    this.scaleY = sceneBounds.height / SOURCE_HEIGHT
    this.sceneLeft = sceneBounds.left
    this.sceneTop = sceneBounds.top
    this.sceneScale = Math.max(0.72, Math.min(this.scaleX, this.scaleY))
    this.centerX = sceneBounds.left + POND_CENTER_X * this.scaleX
    this.centerY = sceneBounds.top + POND_CENTER_Y * this.scaleY
    this.radiusX = POND_RADIUS_X * this.scaleX
    this.radiusY = POND_RADIUS_Y * this.scaleY

    this.applyFishScale()

    this.decorations.forEach((image) => {
      const spec = image.getData('pondDecorationSpec') as DecorationSpec
      const x = spec.mapX === undefined
        ? this.centerX + this.radiusX * spec.x
        : sceneBounds.left + spec.mapX * this.scaleX
      const y = spec.mapY === undefined
        ? this.centerY + this.radiusY * spec.y
        : sceneBounds.top + spec.mapY * this.scaleY
      image
        .setPosition(Math.round(x), Math.round(y))
        .setScale(spec.scale * this.sceneScale)
    })

    if (this.styleId) this.layoutStyleImage()
  }

  /** Swaps in a chosen pond style, or (passing null/unknown) clears back to plain painted water.
   * Caller must have already preloaded the style's frames (see preloadStyle/isStyleLoaded) — this
   * never triggers a load itself. */
  setStyle(styleId: string | null): void {
    const nextId = isPondStyleId(styleId) ? styleId : null
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

  private applyStyle(id: PondStyleId): void {
    this.styleId = id
    const key = pondStyleTextureKey(id, this.phase)
    if (!this.styleImage) this.styleImage = this.scene.add.image(0, 0, key).setDepth(RenderLayers.pondGlint + 0.09)
    else this.styleImage.setTexture(key).setVisible(true)
    if (this.sceneBounds.width) this.layoutStyleImage()
  }

  private clearStyle(): void {
    this.styleId = null
    this.styleImage?.setVisible(false)
  }

  private layoutStyleImage(): void {
    if (!this.styleImage || !this.styleId) return
    const style = POND_STYLE_BY_ID[this.styleId]
    const contentScale = Math.min(POND_STYLE_BOX_WIDTH / style.contentWidth, POND_STYLE_BOX_HEIGHT / style.contentHeight) * this.scaleX * this.styleScale
    const groundX = this.styleX == null ? this.sceneLeft + POND_STYLE_GROUND_X * this.scaleX : this.sceneBounds.left + this.styleX * this.sceneBounds.width
    const groundY = this.styleY == null ? this.sceneTop + POND_STYLE_GROUND_Y * this.scaleY : this.sceneBounds.top + this.styleY * this.sceneBounds.height
    this.styleImage
      .setOrigin(style.anchorX, style.anchorY)
      .setPosition(groundX, groundY)
      .setDisplaySize(style.width * contentScale, style.height * contentScale)
      .setFlipX(this.styleFlipX)
  }

  setStage(stage: number, animate = true): void {
    const nextStage = Phaser.Math.Clamp(Math.round(stage), 0, POND_STAGE_NAMES.length - 1)
    const previousStage = this.stage
    this.stage = nextStage
    // Always resync visibility/scale, even when the numeric stage did not change.
    // This makes koi self-heal after profile resets, page sleeps, and scene resizes.
    this.syncStageVisuals(false)
    this.applyFishScale()
    if (animate && nextStage > previousStage && !this.reducedMotion) this.playUnlockSparkles(nextStage)
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion
  }

  rippleDelayMultiplier(): number {
    return [1.42, 1.00, 0.88, 0.76, 0.68, 0.60][this.stage] ?? 1
  }

  rippleAlphaBonus(): number {
    return Math.min(0.10, this.stage * 0.02)
  }

  rippleScaleMultiplier(): number {
    return this.stage >= 3 ? 0.88 : this.stage >= 1 ? 0.94 : 1
  }

  destroy(): void {
    this.fish.forEach(({ sprite }) => {
      this.scene.tweens.killTweensOf(sprite)
      sprite.destroy()
    })
    this.decorations.forEach((image) => {
      this.scene.tweens.killTweensOf(image)
      image.destroy()
    })
    this.fish.length = 0
    this.decorations.length = 0
    this.styleImage?.destroy()
  }


  private applyFishScale(): void {
    const stageScale = this.stage >= 5 ? 0.74 : this.stage === 4 ? 0.70 : 0.66
    this.fish.forEach(({ sprite }, index) => {
      const size = (stageScale + index * 0.018) * this.sceneScale
      sprite.setScale(size)
    })
  }

  private fishCountForStage(stage: number): number {
    if (stage < 3) return 0
    return Math.min(MAX_FISH, stage - 2)
  }

  private sampleSwimPath(pathIndex: number, progress: number): { x: number; y: number } {
    const path = KOI_SWIM_PATHS[pathIndex % KOI_SWIM_PATHS.length]
    const scaled = wrap01(progress) * path.length
    const fromIndex = Math.floor(scaled) % path.length
    const toIndex = (fromIndex + 1) % path.length
    const local = scaled - Math.floor(scaled)
    // Sine easing softens the corner approach without a spline that could overshoot the safe-water mask.
    const eased = 0.5 - Math.cos(local * Math.PI) * 0.5
    const from = path[fromIndex]
    const to = path[toIndex]
    return {
      x: Phaser.Math.Linear(from[0], to[0], eased),
      y: Phaser.Math.Linear(from[1], to[1], eased),
    }
  }

  private syncStageVisuals(_animate: boolean): void {
    void _animate
    const fishCount = this.fishCountForStage(this.stage)
    this.fish.forEach(({ sprite }, index) => {
      const visible = index < fishCount
      sprite.setVisible(visible)
      if (!visible) sprite.setAlpha(0)
    })

    this.decorations.forEach((image) => {
      const spec = image.getData('pondDecorationSpec') as DecorationSpec
      const visible = this.stage >= spec.minStage
      image.setVisible(visible)
      if (!visible) image.setAlpha(0)
      else image.setAlpha(spec.alpha)
    })
  }

  private playUnlockSparkles(stage: number): void {
    const count = stage >= 5 ? 5 : stage >= 3 ? 3 : 2
    for (let index = 0; index < count; index += 1) {
      const sparkle = this.scene.add.image(
        this.centerX + Phaser.Math.Between(-Math.round(this.radiusX * 0.55), Math.round(this.radiusX * 0.55)),
        this.centerY + Phaser.Math.Between(-Math.round(this.radiusY * 0.55), Math.round(this.radiusY * 0.55)),
        'pond-sparkle-1',
      )
        .setDepth(RenderLayers.pondGlint + 0.12)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale((0.26 + index * 0.035) * this.sceneScale)
        .setAlpha(0)

      this.scene.tweens.add({
        targets: sparkle,
        alpha: { from: 0, to: 0.88 },
        scaleX: sparkle.scaleX * 1.55,
        scaleY: sparkle.scaleY * 1.55,
        duration: 420,
        delay: index * 90,
        ease: 'Sine.Out',
        yoyo: true,
        hold: 90,
        onComplete: () => sparkle.destroy(),
      })
    }
  }
}
