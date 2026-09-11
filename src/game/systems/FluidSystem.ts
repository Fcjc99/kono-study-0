import Phaser from 'phaser'
import type { EnvironmentSnapshot } from '../sanctuary/environmentManager'
import type { DayPhase } from '../sanctuary/types'
import { RenderLayers } from '../engine/RenderLayers'
import { FLUID_CROPS, FLUID_PHASES, fluidTextureKey, fluidTexturePath } from '../production/fluidAssets'

type FluidLayer = keyof typeof FLUID_CROPS

interface LayerRuntime {
  spriteA: Phaser.GameObjects.Image
  spriteB: Phaser.GameObjects.Image
  layer: FluidLayer
  frame: number
  clock: number
  alpha: number
}

export class FluidSystem {
  private readonly scene: Phaser.Scene
  private reducedMotion = false
  private enabled = true
  private speedMultiplier = 1
  private phase: DayPhase = 'afternoon'
  private layers = new Map<FluidLayer, LayerRuntime>()

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  static preload(scene: Phaser.Scene, phases: readonly DayPhase[] = FLUID_PHASES): void {
    phases.forEach((phase) => {
      ;(Object.keys(FLUID_CROPS) as FluidLayer[]).forEach((layer) => {
        const { frames } = FLUID_CROPS[layer]
        for (let frame = 0; frame < frames; frame += 1) {
          scene.load.image(
            fluidTextureKey(phase, layer, frame),
            fluidTexturePath(phase, layer, frame),
          )
        }
      })
    })
  }

  create(phase: DayPhase, reducedMotion: boolean): void {
    this.phase = phase
    this.reducedMotion = reducedMotion
    this.layers.set('ocean', this.createLayer('ocean', RenderLayers.ocean, 1))
    this.layers.set('pond', this.createLayer('pond', RenderLayers.ocean + 0.2, 1))
    this.layers.set('waterfall', this.createLayer('waterfall', RenderLayers.waterfall, 1))
    this.layers.set('foam', this.createLayer('foam', RenderLayers.waterfallFoam, 1))
  }

  update(_timeMs: number, deltaSeconds: number, environment: EnvironmentSnapshot): void {
    if (!this.enabled) return

    const energy = Phaser.Math.Clamp(environment.waterEnergy, 0, 1)
    this.layers.forEach((runtime) => {
      const config = FLUID_CROPS[runtime.layer]
      const energyScale = runtime.layer === 'waterfall'
        ? 0.95 + energy * 0.45
        : runtime.layer === 'foam'
          ? 0.9 + energy * 0.38
          : 0.82 + energy * 0.42
      const motionScale = this.reducedMotion ? 0.38 : 1
      const fps = config.fps * energyScale * motionScale * this.speedMultiplier
      const frameDuration = 1 / Math.max(0.5, fps)
      runtime.clock += deltaSeconds

      while (runtime.clock >= frameDuration) {
        runtime.clock -= frameDuration
        runtime.frame = (runtime.frame + 1) % config.frames
        runtime.spriteA.setTexture(fluidTextureKey(this.phase, runtime.layer, runtime.frame))
        runtime.spriteB.setTexture(fluidTextureKey(this.phase, runtime.layer, (runtime.frame + 1) % config.frames))
      }

      const progress = Phaser.Math.Clamp(runtime.clock / frameDuration, 0, 1)
      const crossfade = Phaser.Math.Clamp((progress - 0.44) / 0.56, 0, 1)
      const blend = crossfade * crossfade * (3 - 2 * crossfade)
      const darkness = Phaser.Math.Clamp(environment.darkness, 0, 1)
      const highlight = Phaser.Math.Clamp(environment.waterHighlight, 0.18, 1)
      const daylightAlpha = Phaser.Math.Clamp(0.80 + highlight * 0.16 - darkness * 0.08, 0.66, 0.96)
      runtime.spriteA.clearTint().setAlpha(runtime.alpha * daylightAlpha * (1 - blend))
      runtime.spriteB.clearTint().setAlpha(runtime.alpha * daylightAlpha * blend)
    })
  }

  resize(sceneBounds: Phaser.Geom.Rectangle): void {
    const sourceWidth = 1448
    const sourceHeight = 1086
    const scaleX = sceneBounds.width / sourceWidth
    const scaleY = sceneBounds.height / sourceHeight

    this.layers.forEach(({ spriteA, spriteB, layer }) => {
      const crop = FLUID_CROPS[layer]
      const x = sceneBounds.left + (crop.x + crop.width / 2) * scaleX
      const y = sceneBounds.top + (crop.y + crop.height / 2) * scaleY
      const width = crop.width * scaleX
      const height = crop.height * scaleY
      spriteA.setPosition(x, y).setDisplaySize(width, height)
      spriteB.setPosition(x, y).setDisplaySize(width, height)
    })
  }

  setPhase(phase: DayPhase): void {
    if (this.phase === phase) return
    this.phase = phase
    this.layers.forEach((runtime) => {
      runtime.spriteA.setTexture(fluidTextureKey(this.phase, runtime.layer, runtime.frame))
      runtime.spriteB.setTexture(fluidTextureKey(this.phase, runtime.layer, (runtime.frame + 1) % FLUID_CROPS[runtime.layer].frames))
    })
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    this.layers.forEach(({ spriteA, spriteB }) => {
      spriteA.setVisible(enabled)
      spriteB.setVisible(enabled)
    })
  }

  setSpeedMultiplier(multiplier: number): void {
    this.speedMultiplier = Phaser.Math.Clamp(multiplier, 0.25, 2.5)
  }

  destroy(): void {
    this.layers.forEach(({ spriteA, spriteB }) => {
      spriteA.destroy()
      spriteB.destroy()
    })
    this.layers.clear()
  }

  private createLayer(layer: FluidLayer, depth: number, alpha: number): LayerRuntime {
    const spriteA = this.scene.add.image(0, 0, fluidTextureKey(this.phase, layer, 0))
      .setDepth(depth)
      .setAlpha(alpha)
    const spriteB = this.scene.add.image(0, 0, fluidTextureKey(this.phase, layer, 1))
      .setDepth(depth + 0.01)
      .setAlpha(0)
    return { spriteA, spriteB, layer, frame: 0, clock: 0, alpha }
  }
}
