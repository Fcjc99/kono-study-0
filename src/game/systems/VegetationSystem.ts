import Phaser from 'phaser'
import type { EnvironmentSnapshot } from '../sanctuary/environmentManager'
import type { DayPhase } from '../sanctuary/types'
import { RenderLayers } from '../engine/RenderLayers'

interface VegetationRuntime {
  sprite: Phaser.GameObjects.Image
  xRatio: number
  yRatio: number
  scale: number
  phaseOffset: number
  frequency: number
  windResponse: number
  baseAngle: number
}

const GRASS_KEYS = ['wind-grass-01', 'wind-grass-02', 'wind-grass-03', 'wind-grass-04', 'wind-grass-05'] as const
const FLOWER_KEYS = ['wind-flower-01', 'wind-flower-02', 'wind-flower-03', 'wind-flower-04', 'wind-flower-05'] as const

export class VegetationSystem {
  private readonly scene: Phaser.Scene
  private plants: VegetationRuntime[] = []
  private bounds = new Phaser.Geom.Rectangle()
  private reducedMotion = false
  private phase: DayPhase = 'afternoon'

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  static preload(scene: Phaser.Scene): void {
    GRASS_KEYS.forEach((key, index) => scene.load.image(key, `/garden/production-atmosphere/grass-${String(index + 1).padStart(2, '0')}.png`))
    FLOWER_KEYS.forEach((key, index) => scene.load.image(key, `/garden/production-atmosphere/flower-grass-${String(index + 1).padStart(2, '0')}.png`))
  }

  create(phase: DayPhase, reducedMotion: boolean): void {
    this.phase = phase
    this.reducedMotion = reducedMotion
    const placements = [
      { key: GRASS_KEYS[1], x: 0.174, y: 0.675, scale: 0.18, response: 0.62, frequency: 0.00082, angle: -0.4 },
      { key: FLOWER_KEYS[1], x: 0.276, y: 0.586, scale: 0.16, response: 0.72, frequency: 0.00092, angle: 0.3 },
      { key: GRASS_KEYS[3], x: 0.392, y: 0.735, scale: 0.17, response: 0.66, frequency: 0.00078, angle: -0.2 },
      { key: FLOWER_KEYS[2], x: 0.585, y: 0.704, scale: 0.14, response: 0.76, frequency: 0.00102, angle: 0.2 },
      { key: GRASS_KEYS[2], x: 0.708, y: 0.624, scale: 0.17, response: 0.60, frequency: 0.00074, angle: -0.3 },
      { key: FLOWER_KEYS[4], x: 0.786, y: 0.378, scale: 0.14, response: 0.78, frequency: 0.00097, angle: 0.4 },
      { key: GRASS_KEYS[4], x: 0.855, y: 0.675, scale: 0.16, response: 0.64, frequency: 0.00084, angle: -0.4 },
      { key: FLOWER_KEYS[3], x: 0.638, y: 0.315, scale: 0.13, response: 0.70, frequency: 0.00088, angle: 0.2 },
    ] as const

    this.plants = placements.map((placement, index) => {
      const sprite = this.scene.add.image(0, 0, placement.key)
        .setOrigin(0.5, 1)
        .setDepth(index % 3 === 0 ? RenderLayers.vegetationFront : RenderLayers.vegetation)
        .setAlpha(0.56)
      return {
        sprite,
        xRatio: placement.x,
        yRatio: placement.y,
        scale: placement.scale,
        phaseOffset: index * 1.19,
        frequency: placement.frequency,
        windResponse: placement.response,
        baseAngle: placement.angle,
      }
    })
    this.applyPhaseTint()
  }

  update(timeMs: number, environment: EnvironmentSnapshot): void {
    if (this.bounds.width <= 0) return
    const qualityLimit = environment.quality === 'low' ? 4 : environment.quality === 'balanced' ? 6 : this.plants.length
    const motionScale = this.reducedMotion ? 0.18 : 1
    const gust = environment.wind * environment.wind * 2.2

    this.plants.forEach((plant, index) => {
      plant.sprite.setVisible(index < qualityLimit)
      if (!plant.sprite.visible) return
      const idle = Math.sin(timeMs * plant.frequency + plant.phaseOffset) * 0.65
      const secondary = Math.sin(timeMs * plant.frequency * 0.47 + plant.phaseOffset * 1.7) * 0.28
      const targetAngle = plant.baseAngle + (idle + secondary + gust) * plant.windResponse * motionScale
      const darkness = Phaser.Math.Clamp(environment.darkness + (this.phase === 'night' ? 0.02 : 0), 0, 1)
      const red = Phaser.Math.Clamp(Math.round(255 - darkness * 86 + environment.warmth * 12 - environment.coolness * 8), 0, 255)
      const green = Phaser.Math.Clamp(Math.round(255 - darkness * 96 - environment.warmth * 10 + environment.coolness * 2), 0, 255)
      const blue = Phaser.Math.Clamp(Math.round(255 - darkness * 62 - environment.warmth * 28 + environment.coolness * 18), 0, 255)
      plant.sprite.setTint(Phaser.Display.Color.GetColor(red, green, blue))
      plant.sprite.setAlpha(0.32 + environment.ambientLight * 0.24)
      plant.sprite.setAngle(targetAngle)
      plant.sprite.setScale(plant.sprite.scaleX, plant.scale * Math.max(0.68, this.bounds.width / 1_448) * (1 - Math.abs(targetAngle) * 0.0016))
    })
  }

  resize(sceneBounds: Phaser.Geom.Rectangle): void {
    this.bounds = new Phaser.Geom.Rectangle(sceneBounds.x, sceneBounds.y, sceneBounds.width, sceneBounds.height)
    const sceneScale = Math.max(0.68, sceneBounds.width / 1_448)
    this.plants.forEach((plant) => {
      plant.sprite.setPosition(
        sceneBounds.left + sceneBounds.width * plant.xRatio,
        sceneBounds.top + sceneBounds.height * plant.yRatio,
      )
      plant.sprite.setScale(plant.scale * sceneScale)
    })
  }

  setPhase(phase: DayPhase): void {
    if (phase === this.phase) return
    this.phase = phase
    this.applyPhaseTint()
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion
  }

  destroy(): void {
    this.plants.forEach(({ sprite }) => sprite.destroy())
    this.plants = []
  }

  private applyPhaseTint(): void {
    const tint = this.phase === 'morning'
      ? 0xfff2df
      : this.phase === 'evening'
        ? 0xffd2b5
        : this.phase === 'night'
          ? 0x8ca0b5
          : 0xffffff
    const phaseAlpha = this.phase === 'night' ? 0.38 : this.phase === 'evening' ? 0.50 : 0.56
    this.plants.forEach(({ sprite }) => sprite.setTint(tint).setAlpha(phaseAlpha))
  }
}
