import Phaser from 'phaser'
import type { EnvironmentSnapshot } from '../sanctuary/environmentManager'
import type { DayPhase } from '../sanctuary/types'
import { RenderLayers } from '../engine/RenderLayers'

type CritterKind = 'butterfly' | 'dragonfly' | 'frog' | 'bird' | 'firefly' | 'moth' | 'snail'

interface CritterRuntime {
  sprite: Phaser.GameObjects.Image
  timer?: Phaser.Time.TimerEvent
}

interface NormalizedPoint {
  x: number
  y: number
}

const ASSET_ROOT = '/garden/fx/critters/individual'
const channel = (value: number): number => Phaser.Math.Clamp(Math.round(value), 0, 255)

const BUTTERFLY_TEXTURES = [
  'critter25-butterfly-pink-open',
  'critter25-butterfly-blue-side',
  'critter25-butterfly-orange-side',
  'critter25-butterfly-purple-open',
  'critter25-butterfly-mint-open',
  'critter25-butterfly-pink-side',
] as const

const FIREFLY_TEXTURES = [
  'critter25-firefly-01',
  'critter25-firefly-02',
  'critter25-firefly-03',
  'critter25-firefly-04',
  'critter25-firefly-05',
  'critter25-firefly-06',
] as const

const BIRD_PERCHED = ['critter25-bird-robin', 'critter25-bird-blue', 'critter25-bird-sparrow'] as const

export class CritterSystem {
  private readonly scene: Phaser.Scene
  private readonly active = new Set<CritterRuntime>()
  private bounds = new Phaser.Geom.Rectangle()
  private phase: DayPhase = 'afternoon'
  private reducedMotion = false
  private density = 1
  private gardenStage = 0
  private pondStage = 0
  private nextSpawnAt = 0
  private konoPosition: NormalizedPoint = { x: 0.455, y: 0.600 }

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  static preload(scene: Phaser.Scene): void {
    scene.load.image('critter25-bird-robin', `${ASSET_ROOT}/birds/bird-robin.png`)
    scene.load.image('critter25-bird-blue', `${ASSET_ROOT}/birds/bird-blue.png`)
    scene.load.image('critter25-bird-sparrow', `${ASSET_ROOT}/birds/bird-sparrow.png`)
    scene.load.image('critter25-bird-flight', `${ASSET_ROOT}/birds/bird-flight.png`)

    scene.load.image('critter25-butterfly-pink-open', `${ASSET_ROOT}/butterflies/butterfly-pink-open.png`)
    scene.load.image('critter25-butterfly-blue-side', `${ASSET_ROOT}/butterflies/butterfly-blue-side.png`)
    scene.load.image('critter25-butterfly-orange-side', `${ASSET_ROOT}/butterflies/butterfly-orange-side.png`)
    scene.load.image('critter25-butterfly-purple-open', `${ASSET_ROOT}/butterflies/butterfly-purple-open.png`)
    scene.load.image('critter25-butterfly-mint-open', `${ASSET_ROOT}/butterflies/butterfly-mint-open.png`)
    scene.load.image('critter25-butterfly-pink-side', `${ASSET_ROOT}/butterflies/butterfly-pink-side.png`)

    scene.load.image('critter25-frog-swim', `${ASSET_ROOT}/pond-life/frog-swim.png`)
    scene.load.image('critter25-frog-sit', `${ASSET_ROOT}/pond-life/frog-sit.png`)
    scene.load.image('critter25-frog-croak', `${ASSET_ROOT}/pond-life/frog-croak.png`)
    scene.load.image('critter25-dragonfly', `${ASSET_ROOT}/pond-life/dragonfly.png`)
    scene.load.image('critter25-snail', `${ASSET_ROOT}/pond-life/snail.png`)
    scene.load.image('critter25-moth', '/garden/critters/moth-01.png')

    for (let index = 1; index <= 6; index += 1) {
      scene.load.image(
        `critter25-firefly-${String(index).padStart(2, '0')}`,
        `${ASSET_ROOT}/fireflies/firefly-${String(index).padStart(2, '0')}.png`,
      )
    }
  }

  create(phase: DayPhase, reducedMotion: boolean, density: number, gardenStage: number, pondStage: number): void {
    this.phase = phase
    this.reducedMotion = reducedMotion
    this.density = Phaser.Math.Clamp(density, 0.25, 2)
    this.gardenStage = Phaser.Math.Clamp(Math.round(gardenStage), 0, 5)
    this.pondStage = Phaser.Math.Clamp(Math.round(pondStage), 0, 5)
    this.schedule(1_500)
  }

  update(timeMs: number, environment: EnvironmentSnapshot): void {
    if (this.bounds.width <= 0 || timeMs < this.nextSpawnAt) return
    const maxActive = environment.quality === 'high' ? 3 : 2
    if (this.active.size >= maxActive || environment.precipitation > 0.12 || environment.wind > 0.82) {
      this.schedule(3_800)
      return
    }

    const kind = this.chooseCritter()
    if (!kind) {
      this.schedule(5_000)
      return
    }

    this.spawn(kind, environment)
    const baseDelay = Phaser.Math.Between(7_500, 14_000) / Math.sqrt(this.density)
    this.schedule(this.reducedMotion ? baseDelay * 2.2 : baseDelay)
  }

  resize(sceneBounds: Phaser.Geom.Rectangle): void {
    this.bounds = new Phaser.Geom.Rectangle(sceneBounds.x, sceneBounds.y, sceneBounds.width, sceneBounds.height)
    this.clearActive()
    this.schedule(900)
  }

  setPhase(phase: DayPhase): void {
    if (phase === this.phase) return
    this.phase = phase
    this.clearActive()
    this.schedule(700)
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion
    if (reducedMotion) this.clearActive()
    this.schedule(reducedMotion ? 7_000 : 900)
  }

  setDensity(density: number): void {
    this.density = Phaser.Math.Clamp(density, 0.25, 2)
    this.schedule(900)
  }

  setStages(gardenStage: number, pondStage: number): void {
    this.gardenStage = Phaser.Math.Clamp(Math.round(gardenStage), 0, 5)
    this.pondStage = Phaser.Math.Clamp(Math.round(pondStage), 0, 5)
    this.schedule(650)
  }

  setKonoPosition(position: NormalizedPoint): void {
    this.konoPosition = {
      x: Phaser.Math.Clamp(position.x, 0, 1),
      y: Phaser.Math.Clamp(position.y, 0, 1),
    }
  }

  destroy(): void {
    this.clearActive()
  }

  private chooseCritter(): CritterKind | null {
    if (this.reducedMotion && Math.random() < 0.58) return null
    const roll = Math.random()

    if (this.phase === 'night') {
      if (this.gardenStage >= 2 && roll < 0.60) return 'firefly'
      if (this.gardenStage >= 2 && roll < 0.82) return 'moth'
      if (this.pondStage >= 1) return 'frog'
      return null
    }

    if (this.phase === 'evening') {
      if (this.gardenStage >= 2 && roll < 0.38) return 'firefly'
      if (this.gardenStage >= 2 && roll < 0.52) return 'moth'
      if (this.pondStage >= 1 && roll < 0.70) return 'frog'
      if (this.gardenStage >= 1 && roll < 0.90) return 'butterfly'
      return this.pondStage >= 2 ? 'dragonfly' : null
    }

    if (this.phase === 'morning') {
      if (this.gardenStage >= 3 && roll < 0.22) return 'bird'
      if (this.pondStage >= 2 && roll < 0.38) return 'dragonfly'
      if (this.gardenStage >= 1 && roll < 0.92) return 'butterfly'
      if (this.gardenStage >= 2) return 'snail'
      return null
    }

    if (this.pondStage >= 2 && roll < 0.22) return 'dragonfly'
    if (this.gardenStage >= 3 && roll > 0.82) return 'bird'
    if (this.gardenStage >= 2 && roll > 0.72) return 'snail'
    if (this.gardenStage >= 1) return 'butterfly'
    return null
  }

  private spawn(kind: CritterKind, environment: EnvironmentSnapshot): void {
    if (kind === 'butterfly') this.spawnButterfly(environment)
    else if (kind === 'dragonfly') this.spawnDragonfly(environment)
    else if (kind === 'frog') this.spawnFrog(environment)
    else if (kind === 'bird') this.spawnBird(environment)
    else if (kind === 'firefly') this.spawnFirefly(environment)
    else if (kind === 'moth') this.spawnMoth(environment)
    else this.spawnSnail(environment)
  }

  private spawnButterfly(environment: EnvironmentSnapshot): void {
    const texture = Phaser.Utils.Array.GetRandom([...BUTTERFLY_TEXTURES])
    const nearKono = this.phase !== 'night' && Math.random() < 0.38
    const startRatio = nearKono
      ? { x: Phaser.Math.Clamp(this.konoPosition.x + Phaser.Math.FloatBetween(-0.07, 0.07), 0.28, 0.76), y: Phaser.Math.Clamp(this.konoPosition.y - 0.05, 0.43, 0.66) }
      : { x: Phaser.Math.FloatBetween(0.24, 0.42), y: Phaser.Math.FloatBetween(0.46, 0.62) }
    const startX = this.x(startRatio.x)
    const startY = this.y(startRatio.y)
    const sprite = this.make(texture, startX, startY, 0.030, environment, 0.88)
    const direction = startRatio.x > 0.55 ? -1 : 1
    const travel = this.bounds.width * Phaser.Math.FloatBetween(0.12, 0.20) * direction
    const duration = this.reducedMotion ? 4_800 : Phaser.Math.Between(5_800, 8_400)

    this.scene.tweens.add({
      targets: sprite,
      x: startX + travel,
      alpha: { from: 0, to: 0.88 },
      duration,
      ease: 'Sine.InOut',
      onUpdate: (tween) => {
        const progress = tween.progress
        sprite.y = startY + Math.sin(progress * Math.PI * 6) * this.bounds.height * 0.010 - Math.sin(progress * Math.PI) * this.bounds.height * 0.012
        if (progress > 0.80) sprite.setAlpha(Phaser.Math.Linear(0.88, 0, (progress - 0.80) / 0.20))
      },
      onComplete: () => this.remove(sprite),
    })
  }

  private spawnDragonfly(environment: EnvironmentSnapshot): void {
    const startX = this.x(Phaser.Math.FloatBetween(0.43, 0.50))
    const startY = this.y(Phaser.Math.FloatBetween(0.64, 0.70))
    const sprite = this.make('critter25-dragonfly', startX, startY, 0.027, environment, 0.86)
    const duration = this.reducedMotion ? 3_000 : Phaser.Math.Between(3_600, 5_000)
    this.scene.tweens.add({
      targets: sprite,
      x: this.x(Phaser.Math.FloatBetween(0.58, 0.68)),
      alpha: { from: 0, to: 0.86 },
      duration,
      ease: 'Sine.InOut',
      onUpdate: (tween) => {
        const progress = tween.progress
        sprite.y = startY + Math.sin(progress * Math.PI * 8) * this.bounds.height * 0.005
        if (progress > 0.82) sprite.setAlpha(Phaser.Math.Linear(0.86, 0, (progress - 0.82) / 0.18))
      },
      onComplete: () => this.remove(sprite),
    })
  }

  private spawnFrog(environment: EnvironmentSnapshot): void {
    const konoLeftOfPond = this.konoPosition.x < 0.54
    const fromLeft = this.nearKono(0.54, 0.70, 0.12) ? !konoLeftOfPond : Math.random() < 0.5
    const startRatioX = fromLeft ? 0.445 : 0.640
    const startRatioY = Phaser.Math.FloatBetween(0.690, 0.715)
    const startX = this.x(startRatioX)
    const startY = this.y(startRatioY)
    const sprite = this.make('critter25-frog-sit', startX, startY, 0.038, environment, 0.90)
    sprite.setAlpha(0)

    this.scene.tweens.add({
      targets: sprite,
      alpha: 0.90,
      duration: 360,
      onComplete: () => {
        const pause = this.nearKono(startRatioX, startRatioY, 0.10) ? 550 : (this.reducedMotion ? 900 : 1_500)
        const timer = this.scene.time.delayedCall(pause, () => {
          sprite.setTexture(Math.random() < 0.45 ? 'critter25-frog-croak' : 'critter25-frog-swim')
          this.fitSprite(sprite, 0.040)
          const direction = fromLeft ? 1 : -1
          const landingX = startX + direction * this.bounds.width * 0.035
          const landingY = startY - this.bounds.height * 0.004
          this.scene.tweens.add({
            targets: sprite,
            x: landingX,
            y: landingY - this.bounds.height * 0.017,
            duration: this.reducedMotion ? 180 : 300,
            ease: 'Sine.Out',
            yoyo: true,
            onYoyo: () => {
              sprite.setTexture('critter25-frog-sit')
              this.fitSprite(sprite, 0.038)
            },
            onComplete: () => this.scene.tweens.add({
              targets: sprite,
              alpha: 0,
              duration: 580,
              delay: 750,
              onComplete: () => this.remove(sprite),
            }),
          })
        })
        const runtime = this.runtimeFor(sprite)
        if (runtime) runtime.timer = timer
      },
    })
  }

  private spawnBird(environment: EnvironmentSnapshot): void {
    const candidates = [
      { x: 0.805, y: 0.455 },
      { x: 0.305, y: 0.398 },
      { x: 0.365, y: 0.520 },
    ]
    const safe = candidates.filter((point) => Math.hypot(point.x - this.konoPosition.x, point.y - this.konoPosition.y) > 0.10)
    const landing = Phaser.Utils.Array.GetRandom(safe.length ? safe : candidates)
    const landingX = this.x(landing.x)
    const landingY = this.y(landing.y)
    const startX = this.bounds.left - 70
    const startY = landingY - this.bounds.height * 0.13
    const sprite = this.make('critter25-bird-flight', startX, startY, 0.045, environment, 0)
    sprite.setFlipX(false)

    this.scene.tweens.add({
      targets: sprite,
      x: landingX,
      y: landingY,
      alpha: 0.92,
      duration: this.reducedMotion ? 800 : 1_650,
      ease: 'Sine.InOut',
      onComplete: () => {
        sprite.setTexture(Phaser.Utils.Array.GetRandom([...BIRD_PERCHED]))
        this.fitSprite(sprite, 0.040)
        const closeToKono = this.nearKono(landing.x, landing.y, 0.115)
        const timer = this.scene.time.delayedCall(closeToKono ? 650 : (this.reducedMotion ? 1_000 : Phaser.Math.Between(2_000, 3_800)), () => {
          sprite.setTexture('critter25-bird-flight')
          this.fitSprite(sprite, 0.045)
          this.scene.tweens.add({
            targets: sprite,
            x: this.bounds.right + 80,
            y: landingY - this.bounds.height * 0.16,
            alpha: 0,
            duration: this.reducedMotion ? 700 : 1_550,
            ease: 'Sine.In',
            onComplete: () => this.remove(sprite),
          })
        })
        const runtime = this.runtimeFor(sprite)
        if (runtime) runtime.timer = timer
      },
    })
  }

  private spawnFirefly(environment: EnvironmentSnapshot): void {
    const followKono = Math.random() < 0.42
    const centerRatio = followKono
      ? { x: Phaser.Math.Clamp(this.konoPosition.x + Phaser.Math.FloatBetween(-0.06, 0.06), 0.28, 0.80), y: Phaser.Math.Clamp(this.konoPosition.y - 0.06, 0.38, 0.68) }
      : { x: Phaser.Math.FloatBetween(0.70, 0.84), y: Phaser.Math.FloatBetween(0.38, 0.52) }
    const centerX = this.x(centerRatio.x)
    const centerY = this.y(centerRatio.y)
    const sprite = this.make(Phaser.Utils.Array.GetRandom([...FIREFLY_TEXTURES]), centerX, centerY, 0.026, environment, 0)
    const duration = this.reducedMotion ? 4_500 : Phaser.Math.Between(5_000, 7_400)

    this.scene.tweens.add({
      targets: sprite,
      alpha: { from: 0, to: 0.90 },
      duration,
      ease: 'Sine.InOut',
      onUpdate: (tween) => {
        const progress = tween.progress
        const radiusX = this.bounds.width * 0.016
        const radiusY = this.bounds.height * 0.012
        sprite.x = centerX + Math.cos(progress * Math.PI * 5) * radiusX
        sprite.y = centerY + Math.sin(progress * Math.PI * 7) * radiusY
        if (progress > 0.78) sprite.setAlpha(Phaser.Math.Linear(0.90, 0, (progress - 0.78) / 0.22))
      },
      onComplete: () => this.remove(sprite),
    })
  }

  private spawnMoth(environment: EnvironmentSnapshot): void {
    const centerRatio = {
      x: Phaser.Math.FloatBetween(0.68, 0.82),
      y: Phaser.Math.FloatBetween(0.40, 0.54),
    }
    const centerX = this.x(centerRatio.x)
    const centerY = this.y(centerRatio.y)
    const sprite = this.make('critter25-moth', centerX, centerY, 0.026, environment, 0)
    const duration = this.reducedMotion ? 4_200 : Phaser.Math.Between(4_800, 6_800)

    this.scene.tweens.add({
      targets: sprite,
      alpha: { from: 0, to: 0.76 },
      duration,
      ease: 'Sine.InOut',
      onUpdate: (tween) => {
        const progress = tween.progress
        sprite.x = centerX + Math.sin(progress * Math.PI * 5) * this.bounds.width * 0.018
        sprite.y = centerY + Math.sin(progress * Math.PI * 8) * this.bounds.height * 0.010
        if (progress > 0.80) sprite.setAlpha(Phaser.Math.Linear(0.76, 0, (progress - 0.80) / 0.20))
      },
      onComplete: () => this.remove(sprite),
    })
  }

  private spawnSnail(environment: EnvironmentSnapshot): void {
    const startRatio = { x: Phaser.Math.FloatBetween(0.26, 0.34), y: Phaser.Math.FloatBetween(0.62, 0.67) }
    if (this.nearKono(startRatio.x, startRatio.y, 0.10)) startRatio.x -= 0.05
    const startX = this.x(startRatio.x)
    const startY = this.y(startRatio.y)
    const sprite = this.make('critter25-snail', startX, startY, 0.032, environment, 0)
    const direction = Math.random() < 0.5 ? -1 : 1
    const duration = this.reducedMotion ? 6_000 : Phaser.Math.Between(8_000, 12_000)
    this.scene.tweens.add({
      targets: sprite,
      x: startX + direction * this.bounds.width * 0.045,
      alpha: { from: 0, to: 0.82 },
      duration,
      ease: 'Sine.InOut',
      onUpdate: (tween) => {
        if (tween.progress > 0.82) sprite.setAlpha(Phaser.Math.Linear(0.82, 0, (tween.progress - 0.82) / 0.18))
      },
      onComplete: () => this.remove(sprite),
    })
  }

  private make(texture: string, x: number, y: number, heightRatio: number, environment: EnvironmentSnapshot, alpha: number): Phaser.GameObjects.Image {
    const sprite = this.scene.add.image(x, y, texture)
      .setDepth(RenderLayers.critters)
      .setTint(this.tintForEnvironment(environment))
      .setAlpha(alpha)
    this.fitSprite(sprite, heightRatio)
    this.active.add({ sprite })
    return sprite
  }

  private fitSprite(sprite: Phaser.GameObjects.Image, heightRatio: number): void {
    const targetHeight = Math.max(18, this.bounds.height * heightRatio)
    const scale = targetHeight / Math.max(1, sprite.height)
    sprite.setScale(scale)
  }

  private runtimeFor(sprite: Phaser.GameObjects.Image): CritterRuntime | undefined {
    return [...this.active].find((runtime) => runtime.sprite === sprite)
  }

  private remove(sprite: Phaser.GameObjects.Image): void {
    const runtime = this.runtimeFor(sprite)
    if (runtime) {
      runtime.timer?.remove(false)
      this.active.delete(runtime)
    }
    this.scene.tweens.killTweensOf(sprite)
    sprite.destroy()
  }

  private clearActive(): void {
    ;[...this.active].forEach((runtime) => {
      runtime.timer?.remove(false)
      this.scene.tweens.killTweensOf(runtime.sprite)
      runtime.sprite.destroy()
      this.active.delete(runtime)
    })
  }

  private schedule(delay: number): void {
    this.nextSpawnAt = this.scene.time.now + delay
  }

  private nearKono(x: number, y: number, radius: number): boolean {
    return Math.hypot(x - this.konoPosition.x, y - this.konoPosition.y) <= radius
  }

  private x(ratio: number): number {
    return this.bounds.left + this.bounds.width * ratio
  }

  private y(ratio: number): number {
    return this.bounds.top + this.bounds.height * ratio
  }

  private tintForEnvironment(environment: EnvironmentSnapshot): number {
    const darkness = Phaser.Math.Clamp(environment.darkness + environment.weatherShade * 0.26, 0, 1)
    const red = channel(255 - darkness * 48 + environment.warmth * 10)
    const green = channel(255 - darkness * 54 + environment.warmth * 2 + environment.coolness * 4)
    const blue = channel(255 - darkness * 34 - environment.warmth * 4 + environment.coolness * 16)
    return Phaser.Display.Color.GetColor(red, green, blue)
  }
}
