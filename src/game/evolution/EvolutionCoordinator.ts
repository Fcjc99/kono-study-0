import Phaser from 'phaser'
import { RenderLayers } from '../engine/RenderLayers'

export const EVOLUTION_FEATURE_ORDER = ['tree', 'home', 'garden', 'pond', 'lanterns'] as const
export type EvolutionFeature = (typeof EVOLUTION_FEATURE_ORDER)[number]

export interface EvolutionStageChange {
  feature: EvolutionFeature
  featureLabel: string
  previousStage: number
  nextStage: number
  stageName: string
}

export interface EvolutionMilestonePayload {
  feature: EvolutionFeature
  featureLabel: string
  previousStage: number
  nextStage: number
  stageName: string
  queueRemaining: number
}

interface FeatureVisual {
  x: number
  y: number
  color: number
}

const SOURCE_WIDTH = 1_448
const SOURCE_HEIGHT = 1_086
const FEATURE_VISUALS: Record<EvolutionFeature, FeatureVisual> = {
  tree: { x: 704, y: 272, color: 0xffd5e5 },
  home: { x: 315, y: 515, color: 0xffd39a },
  garden: { x: 720, y: 650, color: 0xc9e59a },
  pond: { x: 838, y: 700, color: 0xa7dbef },
  lanterns: { x: 1_175, y: 495, color: 0xffc96f },
}

const featureOrderIndex = (feature: EvolutionFeature): number => EVOLUTION_FEATURE_ORDER.indexOf(feature)

export class EvolutionCoordinator {
  private readonly scene: Phaser.Scene
  private readonly applyChange: (change: EvolutionStageChange, animate: boolean) => void
  private readonly emitMilestone: (payload: EvolutionMilestonePayload) => void
  private readonly queue: EvolutionStageChange[] = []
  private sceneBounds = new Phaser.Geom.Rectangle()
  private currentFeature: EvolutionFeature | null = null
  private currentTargetStage = -1
  private timer?: Phaser.Time.TimerEvent
  private reducedMotion = false
  private disposed = false

  constructor(
    scene: Phaser.Scene,
    applyChange: (change: EvolutionStageChange, animate: boolean) => void,
    emitMilestone: (payload: EvolutionMilestonePayload) => void,
  ) {
    this.scene = scene
    this.applyChange = applyChange
    this.emitMilestone = emitMilestone
  }

  resize(sceneBounds: Phaser.Geom.Rectangle): void {
    this.sceneBounds = new Phaser.Geom.Rectangle(sceneBounds.x, sceneBounds.y, sceneBounds.width, sceneBounds.height)
  }

  setReducedMotion(reducedMotion: boolean): void {
    const changed = this.reducedMotion !== reducedMotion
    this.reducedMotion = reducedMotion
    if (!changed || !reducedMotion || !this.queue.length) return
    const pending = [...this.queue]
    this.cancel(false)
    pending.forEach((change) => this.applyChange(change, false))
  }

  enqueue(changes: EvolutionStageChange[], animate = true): void {
    if (this.disposed) return
    const meaningful = changes.filter((change) => change.nextStage !== change.previousStage)
    if (!meaningful.length) return

    if (!animate || this.reducedMotion) {
      this.cancel(false)
      meaningful.forEach((change) => this.applyChange(change, false))
      return
    }

    meaningful.forEach((change) => this.mergeChange(change))
    this.queue.sort((left, right) => featureOrderIndex(left.feature) - featureOrderIndex(right.feature))
    if (!this.currentFeature) this.runNext()
  }

  cancel(clearVisuals = true): void {
    this.timer?.remove(false)
    this.timer = undefined
    this.queue.length = 0
    this.currentFeature = null
    this.currentTargetStage = -1
    if (clearVisuals) {
      this.scene.children.list
        .filter((child) => child.getData?.('evolutionAccent') === true)
        .forEach((child) => {
          this.scene.tweens.killTweensOf(child)
          child.destroy()
        })
    }
  }

  destroy(): void {
    this.disposed = true
    this.cancel()
    this.scene.children.list
      .filter((child) => child.getData?.('evolutionAccent') === true)
      .forEach((child) => child.destroy())
  }

  private mergeChange(change: EvolutionStageChange): void {
    const existing = this.queue.find((queued) => queued.feature === change.feature)
    if (existing) {
      existing.previousStage = Math.min(existing.previousStage, change.previousStage)
      if (change.nextStage >= existing.nextStage) {
        existing.nextStage = change.nextStage
        existing.stageName = change.stageName
        existing.featureLabel = change.featureLabel
      }
      return
    }

    const previousStage = this.currentFeature === change.feature
      ? Math.max(change.previousStage, this.currentTargetStage)
      : change.previousStage
    if (change.nextStage === previousStage) return
    this.queue.push({ ...change, previousStage })
  }

  private runNext(): void {
    if (this.disposed || this.currentFeature) return
    const change = this.queue.shift()
    if (!change) return

    this.currentFeature = change.feature
    this.currentTargetStage = change.nextStage
    this.applyChange(change, true)
    this.playAccent(change)
    this.emitMilestone({ ...change, queueRemaining: this.queue.length })

    const delay = this.reducedMotion ? 100 : 760
    this.timer = this.scene.time.delayedCall(delay, () => {
      this.timer = undefined
      this.currentFeature = null
      this.currentTargetStage = -1
      this.runNext()
    })
  }

  private playAccent(change: EvolutionStageChange): void {
    if (this.reducedMotion || !this.sceneBounds.width) return
    const visual = FEATURE_VISUALS[change.feature]
    const scaleX = this.sceneBounds.width / SOURCE_WIDTH
    const scaleY = this.sceneBounds.height / SOURCE_HEIGHT
    const x = this.sceneBounds.left + visual.x * scaleX
    const y = this.sceneBounds.top + visual.y * scaleY
    const baseRadius = Math.max(18, 42 * Math.min(scaleX, scaleY))

    const ring = this.scene.add.ellipse(x, y, baseRadius * 2.1, baseRadius * 0.78)
      .setDepth(RenderLayers.evolutionFront + 0.44)
      .setStrokeStyle(Math.max(1, 1.6 * Math.min(scaleX, scaleY)), visual.color, 0.48)
      .setAlpha(0.52)
      .setScale(0.82)
      .setData('evolutionAccent', true)

    this.scene.tweens.add({
      targets: ring,
      alpha: 0,
      scaleX: 1.34,
      scaleY: 1.34,
      duration: 560,
      ease: 'Sine.Out',
      onComplete: () => ring.destroy(),
    })

    const moteCount = 2
    for (let index = 0; index < moteCount; index += 1) {
      const angle = Phaser.Math.DegToRad((360 / moteCount) * index + Phaser.Math.Between(-16, 16))
      const distance = baseRadius * Phaser.Math.FloatBetween(0.35, 0.78)
      const mote = this.scene.add.circle(
        x + Math.cos(angle) * distance,
        y + Math.sin(angle) * distance * 0.42,
        Math.max(1.2, 2.1 * Math.min(scaleX, scaleY)),
        visual.color,
        0.46,
      )
        .setDepth(RenderLayers.evolutionFront + 0.45)
        .setData('evolutionAccent', true)
      this.scene.tweens.add({
        targets: mote,
        x: mote.x + Math.cos(angle) * baseRadius * 0.48,
        y: mote.y - baseRadius * Phaser.Math.FloatBetween(0.32, 0.52),
        alpha: 0,
        scale: 0.55,
        duration: Phaser.Math.Between(420, 560),
        ease: 'Sine.Out',
        onComplete: () => mote.destroy(),
      })
    }
  }
}
