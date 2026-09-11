import Phaser from 'phaser'
import type { EnvironmentSnapshot } from '../sanctuary/environmentManager'
import type { DayPhase } from '../sanctuary/types'
import { RenderLayers } from '../engine/RenderLayers'

interface MistRuntime {
  sprite: Phaser.GameObjects.Image
  xRatio: number
  yRatio: number
  scale: number
  speed: number
  phaseOffset: number
  localRange: number
}

interface ShadowRuntime {
  sprite: Phaser.GameObjects.Image
  xRatio: number
  yRatio: number
  scaleX: number
  scaleY: number
  speed: number
  phaseOffset: number
}

const MIST_KEYS = ['atmosphere-mist-01', 'atmosphere-mist-02', 'atmosphere-mist-03'] as const
const channel = (value: number): number => Phaser.Math.Clamp(Math.round(value), 0, 255)

export class AtmosphereSystem {
  private readonly scene: Phaser.Scene
  private mist: MistRuntime[] = []
  private shadows: ShadowRuntime[] = []
  private bounds = new Phaser.Geom.Rectangle()
  private phase: DayPhase = 'afternoon'
  private reducedMotion = false

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  static preload(scene: Phaser.Scene): void {
    MIST_KEYS.forEach((key, index) => scene.load.image(key, `/garden/production-atmosphere/mist-${String(index + 1).padStart(2, '0')}.png`))
  }

  create(phase: DayPhase, reducedMotion: boolean): void {
    this.phase = phase
    this.reducedMotion = reducedMotion
    this.ensureShadowTexture()

    const mistPlacements = [
      { key: MIST_KEYS[0], x: 0.365, y: 0.868, scale: 0.58, speed: 2.6, range: 0.055 },
      { key: MIST_KEYS[1], x: 0.330, y: 0.840, scale: 0.46, speed: 1.9, range: 0.042 },
      { key: MIST_KEYS[2], x: 0.735, y: 0.175, scale: 0.72, speed: 1.1, range: 0.075 },
    ] as const

    this.mist = mistPlacements.map((placement, index) => ({
      sprite: this.scene.add.image(0, 0, placement.key)
        .setOrigin(0.5)
        .setDepth(index < 2 ? RenderLayers.waterfallMist : RenderLayers.atmosphereBack)
        .setAlpha(0),
      xRatio: placement.x,
      yRatio: placement.y,
      scale: placement.scale,
      speed: placement.speed,
      phaseOffset: index * 1.73,
      localRange: placement.range,
    }))

    const shadowPlacements = [
      { x: 0.18, y: 0.39, scaleX: 1.65, scaleY: 0.84, speed: 1.5 },
      { x: 0.70, y: 0.47, scaleX: 1.35, scaleY: 0.72, speed: 2.0 },
    ] as const

    this.shadows = shadowPlacements.map((placement, index) => ({
      sprite: this.scene.add.image(0, 0, 'sanctuary-cloud-shadow')
        .setOrigin(0.5)
        .setDepth(RenderLayers.cloudShadow)
        .setBlendMode(Phaser.BlendModes.MULTIPLY)
        .setAlpha(0),
      xRatio: placement.x,
      yRatio: placement.y,
      scaleX: placement.scaleX,
      scaleY: placement.scaleY,
      speed: placement.speed,
      phaseOffset: index * 2.15,
    }))
  }

  update(timeMs: number, deltaSeconds: number, environment: EnvironmentSnapshot): void {
    if (this.bounds.width <= 0) return
    const motionScale = this.reducedMotion ? 0.18 : 1
    const sceneScale = this.bounds.width / 1_448
    const weatherMist = environment.rainIntensity * 0.10 + Math.max(0, environment.cloudCover - 0.48) * 0.055 + environment.snowIntensity * 0.025
    const waterfallMist = Phaser.Math.Clamp(0.075 + environment.waterEnergy * 0.11 + weatherMist, 0.055, 0.27)
    const mistTint = this.tintForEnvironment(environment)

    this.mist.forEach((mist, index) => {
      const isWaterfall = index < 2
      const targetAlpha = isWaterfall ? waterfallMist : environment.haze * (environment.weather === 'clear' ? 0.12 : 1) + weatherMist * 0.42
      const qualityVisible = environment.quality !== 'low' || index === 0
      mist.sprite.setVisible(qualityVisible && targetAlpha > 0.008)
      if (!mist.sprite.visible) return

      const travel = this.bounds.width * mist.localRange
      const cycle = ((timeMs * 0.001 * mist.speed * (0.45 + environment.wind)) + mist.phaseOffset) % 2
      const eased = cycle <= 1 ? cycle : 2 - cycle
      const xOffset = (eased - 0.5) * travel * motionScale
      const yOffset = Math.sin(timeMs / 5_200 + mist.phaseOffset) * (this.reducedMotion ? 0.2 : 1.1)
      mist.sprite.setPosition(
        this.bounds.left + this.bounds.width * mist.xRatio + xOffset,
        this.bounds.top + this.bounds.height * mist.yRatio + yOffset,
      )
      mist.sprite.setScale(mist.scale * sceneScale)
      mist.sprite.setTint(mistTint)
      mist.sprite.setAlpha(targetAlpha * (0.88 + Math.sin(timeMs / 6_400 + mist.phaseOffset) * 0.10))
    })

    const shadowStrength = Phaser.Math.Clamp((environment.cloudCover - 0.10) * 0.17 * environment.ambientLight, 0, 0.12)
    const shadowMotion = (0.24 + environment.wind) * motionScale
    this.shadows.forEach((shadow, index) => {
      const qualityVisible = environment.quality === 'high' || index === 0
      shadow.sprite.setVisible(qualityVisible && shadowStrength > 0.003)
      if (!shadow.sprite.visible) return
      shadow.sprite.x += shadow.speed * shadowMotion * deltaSeconds
      shadow.sprite.y = this.bounds.top + this.bounds.height * shadow.yRatio
        + Math.sin(timeMs / 9_000 + shadow.phaseOffset) * (this.reducedMotion ? 0.3 : 1.4)
      shadow.sprite.setAlpha(shadowStrength * (0.90 + Math.sin(timeMs / 10_000 + shadow.phaseOffset) * 0.08))
      if (shadow.sprite.x - shadow.sprite.displayWidth / 2 > this.bounds.right + 80) {
        shadow.sprite.x = this.bounds.left - shadow.sprite.displayWidth / 2 - 80
      }
    })
  }

  resize(sceneBounds: Phaser.Geom.Rectangle): void {
    this.bounds = new Phaser.Geom.Rectangle(sceneBounds.x, sceneBounds.y, sceneBounds.width, sceneBounds.height)
    const sceneScale = sceneBounds.width / 1_448
    this.mist.forEach((mist) => {
      mist.sprite.setPosition(
        sceneBounds.left + sceneBounds.width * mist.xRatio,
        sceneBounds.top + sceneBounds.height * mist.yRatio,
      )
      mist.sprite.setScale(mist.scale * sceneScale)
    })
    this.shadows.forEach((shadow) => {
      shadow.sprite.setPosition(
        sceneBounds.left + sceneBounds.width * shadow.xRatio,
        sceneBounds.top + sceneBounds.height * shadow.yRatio,
      )
      shadow.sprite.setScale(shadow.scaleX * sceneScale, shadow.scaleY * sceneScale)
    })
  }

  setPhase(phase: DayPhase): void {
    this.phase = phase
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion
  }

  destroy(): void {
    this.mist.forEach(({ sprite }) => sprite.destroy())
    this.shadows.forEach(({ sprite }) => sprite.destroy())
    this.mist = []
    this.shadows = []
  }

  private ensureShadowTexture(): void {
    if (this.scene.textures.exists('sanctuary-cloud-shadow')) return
    const graphics = this.scene.make.graphics({ x: 0, y: 0 })
    for (let index = 0; index < 7; index += 1) {
      const inset = index * 8
      const alpha = 0.026 + index * 0.005
      graphics.fillStyle(0x65766d, alpha)
      graphics.fillEllipse(128, 54, 250 - inset * 2, 94 - inset)
    }
    graphics.generateTexture('sanctuary-cloud-shadow', 256, 108)
    graphics.destroy()
  }

  private tintForEnvironment(environment: EnvironmentSnapshot): number {
    const phaseBias = this.phase === 'night' ? 0.03 : 0
    const darkness = Phaser.Math.Clamp(environment.darkness + phaseBias, 0, 1)
    const red = channel(245 - darkness * 42 + environment.warmth * 18)
    const green = channel(250 - darkness * 52 + environment.warmth * 3 + environment.coolness * 5)
    const blue = channel(250 - darkness * 20 - environment.warmth * 18 + environment.coolness * 18)
    return Phaser.Display.Color.GetColor(red, green, blue)
  }
}

