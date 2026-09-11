import Phaser from 'phaser'
import type { EnvironmentSnapshot } from '../sanctuary/environmentManager'
import type { DayPhase, SanctuaryWeather } from '../sanctuary/types'
import { RenderLayers } from '../engine/RenderLayers'

interface CloudRuntime {
  sprite: Phaser.GameObjects.Image
  speed: number
  yRatio: number
  scale: number
  phaseOffset: number
  coverThreshold: number
  baseAlpha: number
  parallax: number
  alwaysVisible: number
  layer: 'far' | 'mid' | 'front'
}

const CLOUD_KEYS = ['atmosphere-cloud-01', 'atmosphere-cloud-02', 'atmosphere-cloud-03', 'atmosphere-cloud-04', 'atmosphere-cloud-05'] as const

const smoothStep = (edge0: number, edge1: number, value: number): number => {
  const span = Math.max(0.0001, edge1 - edge0)
  const t = Phaser.Math.Clamp((value - edge0) / span, 0, 1)
  return t * t * (3 - 2 * t)
}

const channel = (value: number): number => Phaser.Math.Clamp(Math.round(value), 0, 255)

const weatherDensityFloor = (weather: SanctuaryWeather): number => {
  switch (weather) {
    case 'cloudy':
      return 0.82
    case 'rain':
      return 0.94
    case 'snow':
      return 0.88
    case 'wind':
      return 0.46
    case 'clear':
    default:
      return 0.28
  }
}

const phaseDensityBoost = (phase: DayPhase): number => {
  switch (phase) {
    case 'morning':
      return 0.05
    case 'evening':
      return 0.10
    case 'night':
      return -0.10
    case 'afternoon':
    default:
      return 0
  }
}

export class CloudSystem {
  private readonly scene: Phaser.Scene
  private clouds: CloudRuntime[] = []
  private bounds = new Phaser.Geom.Rectangle()
  private reducedMotion = false
  private phase: DayPhase = 'afternoon'

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  static preload(scene: Phaser.Scene): void {
    CLOUD_KEYS.forEach((key, index) => {
      scene.load.image(key, `/garden/production-atmosphere/cloud-${String(index + 1).padStart(2, '0')}.png`)
    })
  }

  create(phase: DayPhase, reducedMotion: boolean): void {
    this.phase = phase
    this.reducedMotion = reducedMotion

    const placements = [
      { key: CLOUD_KEYS[4], x: 0.06, y: 0.06, speed: 2.0, scale: 1.92, threshold: 0.00, alpha: 0.62, parallax: 0.38, flip: false, alwaysVisible: 0.95, layer: 'far' },
      { key: CLOUD_KEYS[0], x: 0.25, y: 0.11, speed: 2.8, scale: 1.16, threshold: 0.06, alpha: 0.58, parallax: 0.55, flip: true, alwaysVisible: 0.76, layer: 'far' },
      { key: CLOUD_KEYS[2], x: 0.48, y: 0.07, speed: 2.4, scale: 1.36, threshold: 0.12, alpha: 0.60, parallax: 0.48, flip: false, alwaysVisible: 0.68, layer: 'far' },
      { key: CLOUD_KEYS[4], x: 0.82, y: 0.10, speed: 2.6, scale: 1.54, threshold: 0.20, alpha: 0.58, parallax: 0.42, flip: true, alwaysVisible: 0.60, layer: 'far' },
      { key: CLOUD_KEYS[1], x: 0.17, y: 0.18, speed: 3.8, scale: 0.96, threshold: 0.28, alpha: 0.54, parallax: 0.78, flip: true, alwaysVisible: 0.42, layer: 'mid' },
      { key: CLOUD_KEYS[3], x: 0.40, y: 0.21, speed: 4.5, scale: 1.08, threshold: 0.36, alpha: 0.52, parallax: 0.92, flip: false, alwaysVisible: 0.35, layer: 'mid' },
      { key: CLOUD_KEYS[0], x: 0.65, y: 0.17, speed: 4.1, scale: 0.90, threshold: 0.46, alpha: 0.50, parallax: 0.86, flip: false, alwaysVisible: 0.28, layer: 'mid' },
      { key: CLOUD_KEYS[2], x: 0.90, y: 0.22, speed: 4.8, scale: 0.94, threshold: 0.56, alpha: 0.50, parallax: 0.94, flip: true, alwaysVisible: 0.22, layer: 'mid' },
      { key: CLOUD_KEYS[1], x: 0.11, y: 0.27, speed: 5.8, scale: 0.76, threshold: 0.66, alpha: 0.44, parallax: 1.10, flip: false, alwaysVisible: 0.08, layer: 'front' },
      { key: CLOUD_KEYS[3], x: 0.58, y: 0.26, speed: 6.1, scale: 0.84, threshold: 0.76, alpha: 0.42, parallax: 1.18, flip: true, alwaysVisible: 0.04, layer: 'front' },
    ] as const

    this.clouds = placements.map((placement, index) => {
      const sprite = this.scene.add.image(0, 0, placement.key)
        .setDepth(placement.layer === 'front' ? RenderLayers.cloudsFront : RenderLayers.cloudsBack)
        .setOrigin(0.5)
        .setAlpha(0)
        .setFlipX(placement.flip)
      sprite.setData('xRatio', placement.x)
      return {
        sprite,
        speed: placement.speed,
        yRatio: placement.y,
        scale: placement.scale,
        phaseOffset: index * 1.31,
        coverThreshold: placement.threshold,
        baseAlpha: placement.alpha,
        parallax: placement.parallax,
        alwaysVisible: placement.alwaysVisible,
        layer: placement.layer,
      }
    })
  }

  update(timeMs: number, deltaSeconds: number, environment: EnvironmentSnapshot): void {
    if (this.bounds.width <= 0) return

    const motionScale = this.reducedMotion ? 0.22 : 1
    const windScale = 0.72 + environment.wind * 1.4
    const qualityLimit = environment.quality === 'low' ? 6 : environment.quality === 'balanced' ? 8 : this.clouds.length
    const tint = this.tintForEnvironment(environment)
    const density = Phaser.Math.Clamp(Math.max(environment.cloudCover, weatherDensityFloor(environment.weather)) + phaseDensityBoost(this.phase), 0, 1)
    // The original painting already owns the clear-sky clouds. Extra weather
    // clouds must not veil its sun/moon or desaturate the entire scene.
    const clearSkyScale = environment.weather === 'clear' ? 0.06 : 0.65
    const visibilityScale = this.phase === 'night' ? 0.78 : this.phase === 'evening' ? 0.96 : 1

    this.clouds.forEach((cloud, index) => {
      const qualityVisible = index < qualityLimit
      const coverage = smoothStep(cloud.coverThreshold - 0.12, cloud.coverThreshold + 0.20, density)
      const visibility = Phaser.Math.Clamp(Math.max(coverage, cloud.alwaysVisible), 0, 1)
      const layerBoost = cloud.layer === 'far' ? 1.08 : cloud.layer === 'mid' ? 1 : 0.9
      cloud.sprite.setVisible(qualityVisible && visibility > 0.03)
      if (!cloud.sprite.visible) return

      cloud.sprite.x += cloud.speed * cloud.parallax * windScale * motionScale * deltaSeconds
      cloud.sprite.y = this.bounds.top + this.bounds.height * cloud.yRatio
        + Math.sin(timeMs / (5600 - cloud.parallax * 420) + cloud.phaseOffset) * (this.reducedMotion ? 0.25 : 1.15 + cloud.parallax * 0.45)

      const breathe = 0.97 + Math.sin(timeMs / 8400 + cloud.phaseOffset) * 0.03
      const daylightAlpha = 0.68 + environment.cloudBrightness * 0.52
      const alpha = clearSkyScale * cloud.baseAlpha * visibility * daylightAlpha * breathe * visibilityScale * layerBoost
      cloud.sprite.setTint(tint)
      cloud.sprite.setAlpha(Phaser.Math.Clamp(alpha, 0, 0.92))

      const halfWidth = cloud.sprite.displayWidth / 2
      if (cloud.sprite.x - halfWidth > this.bounds.right + 80) {
        cloud.sprite.x = this.bounds.left - halfWidth - Phaser.Math.Between(120, 260)
      }
    })
  }

  resize(sceneBounds: Phaser.Geom.Rectangle): void {
    this.bounds = new Phaser.Geom.Rectangle(sceneBounds.x, sceneBounds.y, sceneBounds.width, sceneBounds.height)
    const sceneScale = sceneBounds.width / 1448
    this.clouds.forEach((cloud) => {
      const ratio = Number(cloud.sprite.getData('xRatio') ?? 0.5)
      cloud.sprite.x = sceneBounds.left + sceneBounds.width * ratio
      cloud.sprite.y = sceneBounds.top + sceneBounds.height * cloud.yRatio
      cloud.sprite.setScale(cloud.scale * sceneScale)
    })
  }

  setPhase(phase: DayPhase): void {
    this.phase = phase
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion
  }

  destroy(): void {
    this.clouds.forEach(({ sprite }) => sprite.destroy())
    this.clouds = []
  }

  private tintForEnvironment(environment: EnvironmentSnapshot): number {
    const phaseBias = this.phase === 'night' ? 0.12 : this.phase === 'evening' ? 0.05 : 0
    const darkness = Phaser.Math.Clamp(environment.darkness + phaseBias, 0, 1)
    const weatherDim = environment.weather === 'rain' ? 16 : environment.weather === 'snow' ? -10 : 0
    const red = channel(255 - darkness * 72 + environment.warmth * 18 - environment.coolness * 10 + weatherDim)
    const green = channel(255 - darkness * 86 - environment.warmth * 22 + environment.coolness * 8 + weatherDim)
    const blue = channel(255 - darkness * 40 - environment.warmth * 28 + environment.coolness * 24 + (environment.weather === 'snow' ? 10 : 0))
    return Phaser.Display.Color.GetColor(red, green, blue)
  }
}

