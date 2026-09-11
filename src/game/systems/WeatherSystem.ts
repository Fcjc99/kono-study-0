import Phaser from 'phaser'
import { RenderLayers } from '../engine/RenderLayers'
import type { EnvironmentSnapshot } from '../sanctuary/environmentManager'

interface RainRuntime {
  sprite: Phaser.GameObjects.Image
  vx: number
  vy: number
  baseAlpha: number
  phase: number
  alpha: number
}

interface SnowRuntime {
  sprite: Phaser.GameObjects.Image
  vx: number
  vy: number
  spin: number
  drift: number
  phase: number
  baseAlpha: number
  alpha: number
}

interface LeafRuntime {
  sprite: Phaser.GameObjects.Image
  vx: number
  vy: number
  spin: number
  phase: number
  baseAlpha: number
  alpha: number
}

const approach = (current: number, target: number, speed: number, dt: number): number => {
  const amount = 1 - Math.exp(-Math.max(0, speed) * Math.max(0, dt))
  return current + (target - current) * amount
}

const mixChannel = (from: number, to: number, amount: number): number => Math.round(from + (to - from) * amount)

export class WeatherSystem {
  private readonly scene: Phaser.Scene
  private shade!: Phaser.GameObjects.Rectangle
  private bounds = new Phaser.Geom.Rectangle()
  private rain: RainRuntime[] = []
  private snow: SnowRuntime[] = []
  private leaves: LeafRuntime[] = []
  private reducedMotion = false
  private density = 1

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  create(reducedMotion: boolean, density: number): void {
    this.reducedMotion = reducedMotion
    this.density = density
    this.ensureTextures()
    this.shade = this.scene.add.rectangle(0, 0, 1, 1, 0x4d6471, 0)
      .setOrigin(0.5)
      .setDepth(RenderLayers.weatherShade)

    this.rain = Array.from({ length: 84 }, (_, index) => this.createRain(index))
    this.snow = Array.from({ length: 64 }, (_, index) => this.createSnow(index))
    this.leaves = Array.from({ length: 18 }, (_, index) => this.createLeaf(index))
  }

  update(timeMs: number, deltaSeconds: number, environment: EnvironmentSnapshot): void {
    if (this.bounds.width <= 0) return
    this.updateShade(environment)
    this.updateRain(timeMs, deltaSeconds, environment)
    this.updateSnow(timeMs, deltaSeconds, environment)
    this.updateLeaves(timeMs, deltaSeconds, environment)
  }

  resize(sceneBounds: Phaser.Geom.Rectangle): void {
    this.bounds = new Phaser.Geom.Rectangle(sceneBounds.x, sceneBounds.y, sceneBounds.width, sceneBounds.height)
    this.shade.setPosition(sceneBounds.centerX, sceneBounds.centerY).setSize(sceneBounds.width, sceneBounds.height)
    this.rain.forEach(({ sprite }) => {
      if (sprite.x === 0 && sprite.y === 0) {
        sprite.setPosition(
          Phaser.Math.Between(Math.round(sceneBounds.left - 100), Math.round(sceneBounds.right)),
          Phaser.Math.Between(Math.round(sceneBounds.top - sceneBounds.height), Math.round(sceneBounds.bottom)),
        )
      }
    })
    this.snow.forEach(({ sprite }) => {
      if (sprite.x === 0 && sprite.y === 0) {
        sprite.setPosition(
          Phaser.Math.Between(Math.round(sceneBounds.left), Math.round(sceneBounds.right)),
          Phaser.Math.Between(Math.round(sceneBounds.top - sceneBounds.height), Math.round(sceneBounds.bottom)),
        )
      }
    })
    this.leaves.forEach(({ sprite }) => {
      if (sprite.x === 0 && sprite.y === 0) {
        sprite.setPosition(
          Phaser.Math.Between(Math.round(sceneBounds.left - 180), Math.round(sceneBounds.right)),
          Phaser.Math.Between(Math.round(sceneBounds.top + sceneBounds.height * 0.12), Math.round(sceneBounds.bottom - 20)),
        )
      }
    })
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion
  }

  setDensity(density: number): void {
    this.density = Phaser.Math.Clamp(density, 0.25, 2)
  }

  destroy(): void {
    this.shade.destroy()
    this.rain.forEach(({ sprite }) => sprite.destroy())
    this.snow.forEach(({ sprite }) => sprite.destroy())
    this.leaves.forEach(({ sprite }) => sprite.destroy())
    this.rain = []
    this.snow = []
    this.leaves = []
  }

  private updateShade(environment: EnvironmentSnapshot): void {
    const snowMix = Phaser.Math.Clamp(environment.snowIntensity, 0, 1)
    const red = mixChannel(0x4d, 0xdc, snowMix)
    const green = mixChannel(0x64, 0xe8, snowMix)
    const blue = mixChannel(0x71, 0xed, snowMix)
    this.shade.setFillStyle(Phaser.Display.Color.GetColor(red, green, blue), 1)
    this.shade.setAlpha(Phaser.Math.Clamp(environment.weatherShade * 0.72, 0, 0.12))
  }

  private updateRain(timeMs: number, dt: number, environment: EnvironmentSnapshot): void {
    const intensity = environment.rainIntensity
    const activeCount = this.activeCount(this.rain.length, 58, intensity, environment)
    const windPush = 35 + environment.wind * 190

    this.rain.forEach((rain, index) => {
      const active = index < activeCount && intensity > 0.015
      const targetAlpha = active ? rain.baseAlpha * (0.42 + intensity * 0.58) : 0
      rain.alpha = approach(rain.alpha, targetAlpha, active ? 5.2 : 7.5, dt)
      rain.sprite.setVisible(rain.alpha > 0.008)
      if (!rain.sprite.visible) return

      rain.sprite.setAlpha(rain.alpha * (0.94 + Math.sin(timeMs / 900 + rain.phase) * 0.06))
      rain.sprite.setAngle(7 + environment.wind * 13)
      rain.sprite.x += (rain.vx + windPush) * dt
      rain.sprite.y += rain.vy * (0.82 + intensity * 0.30) * dt
      if (rain.sprite.y > this.bounds.bottom + 90 || rain.sprite.x > this.bounds.right + 130) {
        rain.sprite.setPosition(
          Phaser.Math.Between(Math.round(this.bounds.left - 120), Math.round(this.bounds.right)),
          Phaser.Math.Between(Math.round(this.bounds.top - 260), Math.round(this.bounds.top - 20)),
        )
      }
    })
  }

  private updateSnow(timeMs: number, dt: number, environment: EnvironmentSnapshot): void {
    const intensity = environment.snowIntensity
    const activeCount = this.activeCount(this.snow.length, 48, intensity, environment)

    this.snow.forEach((snow, index) => {
      const active = index < activeCount && intensity > 0.015
      const targetAlpha = active ? snow.baseAlpha * (0.48 + intensity * 0.52) : 0
      snow.alpha = approach(snow.alpha, targetAlpha, active ? 3.8 : 6.2, dt)
      snow.sprite.setVisible(snow.alpha > 0.008)
      if (!snow.sprite.visible) return

      const drift = Math.sin(timeMs / 720 + snow.phase) * (10 + snow.drift) + environment.wind * 32
      snow.sprite.setAlpha(snow.alpha)
      snow.sprite.x += (snow.vx + drift) * dt
      snow.sprite.y += snow.vy * (0.78 + intensity * 0.18) * dt
      snow.sprite.angle += snow.spin * dt
      if (snow.sprite.y > this.bounds.bottom + 55 || snow.sprite.x > this.bounds.right + 60 || snow.sprite.x < this.bounds.left - 60) {
        snow.sprite.setPosition(
          Phaser.Math.Between(Math.round(this.bounds.left), Math.round(this.bounds.right)),
          Phaser.Math.Between(Math.round(this.bounds.top - 180), Math.round(this.bounds.top - 12)),
        )
      }
    })
  }

  private updateLeaves(timeMs: number, dt: number, environment: EnvironmentSnapshot): void {
    const intensity = environment.leafIntensity
    const activeCount = this.activeCount(this.leaves.length, 13, intensity, environment)
    const gust = 0.55 + environment.wind * 1.5

    this.leaves.forEach((leaf, index) => {
      const active = index < activeCount && intensity > 0.02
      const targetAlpha = active ? leaf.baseAlpha * (0.55 + intensity * 0.45) : 0
      leaf.alpha = approach(leaf.alpha, targetAlpha, active ? 3.4 : 5.2, dt)
      leaf.sprite.setVisible(leaf.alpha > 0.008)
      if (!leaf.sprite.visible) return

      leaf.sprite.setAlpha(leaf.alpha)
      leaf.sprite.x += leaf.vx * gust * dt
      leaf.sprite.y += leaf.vy * dt + Math.sin(timeMs / 430 + leaf.phase) * (0.35 + environment.wind * 0.95)
      leaf.sprite.angle += leaf.spin * dt
      if (leaf.sprite.x > this.bounds.right + 280 || leaf.sprite.y > this.bounds.bottom + 140) {
        leaf.sprite.setPosition(
          this.bounds.left - Phaser.Math.Between(80, 260),
          Phaser.Math.Between(Math.round(this.bounds.top + this.bounds.height * 0.12), Math.round(this.bounds.bottom - 50)),
        )
      }
    })
  }

  private activeCount(poolSize: number, base: number, intensity: number, environment: EnvironmentSnapshot): number {
    if (intensity <= 0.01) return 0
    const quality = environment.quality === 'high' ? 1 : environment.quality === 'balanced' ? 0.74 : 0.5
    const mobile = this.bounds.width < 760 ? 0.82 : 1
    const motion = this.reducedMotion ? 0.34 : 1
    const count = Math.round(base * quality * mobile * motion * this.density * Phaser.Math.Clamp(intensity, 0, 1))
    return Phaser.Math.Clamp(Math.max(1, count), 0, poolSize)
  }

  private createRain(index: number): RainRuntime {
    const sprite = this.scene.add.image(0, 0, 'sanctuary-rain-drop')
      .setDepth(index % 4 === 0 ? RenderLayers.weatherFront : RenderLayers.weather)
      .setVisible(false)
      .setAlpha(0)
      .setScale(Phaser.Math.FloatBetween(0.72, 1.22))
    return {
      sprite,
      vx: Phaser.Math.FloatBetween(55, 105),
      vy: Phaser.Math.FloatBetween(760, 1_060),
      baseAlpha: Phaser.Math.FloatBetween(0.42, 0.82),
      phase: Phaser.Math.FloatBetween(0, Math.PI * 2),
      alpha: 0,
    }
  }

  private createSnow(index: number): SnowRuntime {
    const sprite = this.scene.add.image(0, 0, 'sanctuary-snow-flake')
      .setDepth(index % 5 === 0 ? RenderLayers.weatherFront : RenderLayers.weather)
      .setVisible(false)
      .setAlpha(0)
      .setScale(Phaser.Math.FloatBetween(0.52, 1.38))
    return {
      sprite,
      vx: Phaser.Math.FloatBetween(-13, 14),
      vy: Phaser.Math.FloatBetween(90, 178),
      spin: Phaser.Math.FloatBetween(-28, 28),
      drift: Phaser.Math.FloatBetween(4, 18),
      phase: Phaser.Math.FloatBetween(0, Math.PI * 2),
      baseAlpha: Phaser.Math.FloatBetween(0.58, 0.95),
      alpha: 0,
    }
  }

  private createLeaf(index: number): LeafRuntime {
    const key = `leaf-${String((index % 4) + 1).padStart(2, '0')}`
    const sprite = this.scene.add.image(0, 0, key)
      .setDepth(index % 3 === 0 ? RenderLayers.ambientFront : RenderLayers.ambient)
      .setVisible(false)
      .setAlpha(0)
      .setScale(Phaser.Math.FloatBetween(0.052, 0.102))
    return {
      sprite,
      vx: Phaser.Math.FloatBetween(125, 230),
      vy: Phaser.Math.FloatBetween(12, 42),
      spin: Phaser.Math.FloatBetween(80, 190) * (index % 2 ? 1 : -1),
      phase: Phaser.Math.FloatBetween(0, Math.PI * 2),
      baseAlpha: Phaser.Math.FloatBetween(0.52, 0.82),
      alpha: 0,
    }
  }

  private ensureTextures(): void {
    if (!this.scene.textures.exists('sanctuary-rain-drop')) {
      const rain = this.scene.make.graphics({ x: 0, y: 0 })
      rain.lineStyle(2, 0xd9f0fb, 0.94)
      rain.lineBetween(2, 0, 0, 21)
      rain.generateTexture('sanctuary-rain-drop', 4, 23)
      rain.destroy()
    }

    if (!this.scene.textures.exists('sanctuary-snow-flake')) {
      const snow = this.scene.make.graphics({ x: 0, y: 0 })
      snow.fillStyle(0xffffff, 0.98)
      snow.fillCircle(6, 6, 3.5)
      snow.lineStyle(1, 0xf8fcff, 0.78)
      snow.lineBetween(6, 0, 6, 12)
      snow.lineBetween(0, 6, 12, 6)
      snow.generateTexture('sanctuary-snow-flake', 12, 12)
      snow.destroy()
    }
  }
}
