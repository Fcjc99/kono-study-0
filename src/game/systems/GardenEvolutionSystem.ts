import Phaser from 'phaser'
import type { EnvironmentSnapshot } from '../sanctuary/environmentManager'
import { RenderLayers } from '../engine/RenderLayers'

export const GARDEN_STAGE_NAMES = [
  'Quiet grass',
  'First blooms',
  'Pathside garden',
  'Cottage garden',
  'Living sanctuary',
  'Flourishing garden',
] as const

const SOURCE_WIDTH = 1_448
const SOURCE_HEIGHT = 1_086

interface GardenAnchor {
  x: number
  y: number
  scale: number
  minStage: number
  key: string
  depthOffset: number
  flipX?: boolean
}

const GARDEN_ANCHORS: GardenAnchor[] = [
  { x: 170, y: 555, scale: 0.38, minStage: 1, key: 'garden-flower-01', depthOffset: 0.01 },
  { x: 438, y: 548, scale: 0.34, minStage: 1, key: 'garden-grass-02', depthOffset: 0.02, flipX: true },
  { x: 570, y: 575, scale: 0.40, minStage: 2, key: 'garden-flower-03', depthOffset: 0.03 },
  { x: 884, y: 570, scale: 0.34, minStage: 2, key: 'garden-grass-04', depthOffset: 0.04, flipX: true },
  { x: 585, y: 762, scale: 0.34, minStage: 2, key: 'garden-grass-01', depthOffset: 0.05 },
  { x: 970, y: 736, scale: 0.37, minStage: 2, key: 'garden-flower-05', depthOffset: 0.06 },
  { x: 235, y: 585, scale: 0.42, minStage: 3, key: 'garden-flower-02', depthOffset: 0.07 },
  { x: 420, y: 584, scale: 0.37, minStage: 3, key: 'garden-grass-05', depthOffset: 0.08, flipX: true },
  { x: 1_025, y: 536, scale: 0.34, minStage: 3, key: 'garden-flower-04', depthOffset: 0.09 },
  { x: 1_300, y: 532, scale: 0.39, minStage: 3, key: 'garden-grass-03', depthOffset: 0.10, flipX: true },
  { x: 590, y: 870, scale: 0.35, minStage: 4, key: 'garden-flower-01', depthOffset: 0.11 },
  { x: 870, y: 861, scale: 0.37, minStage: 4, key: 'garden-flower-03', depthOffset: 0.12, flipX: true },
  { x: 515, y: 382, scale: 0.30, minStage: 4, key: 'garden-grass-04', depthOffset: 0.13 },
  { x: 960, y: 454, scale: 0.30, minStage: 4, key: 'garden-flower-05', depthOffset: 0.14 },
  { x: 305, y: 715, scale: 0.42, minStage: 5, key: 'garden-flower-02', depthOffset: 0.15 },
  { x: 1_110, y: 652, scale: 0.40, minStage: 5, key: 'garden-flower-04', depthOffset: 0.16, flipX: true },
]

const channel = (value: number): number => Phaser.Math.Clamp(Math.round(value), 0, 255)

export class GardenEvolutionSystem {
  private readonly scene: Phaser.Scene
  private readonly props: Phaser.GameObjects.Image[] = []
  private stage = 0
  private reducedMotion = false

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  static preload(scene: Phaser.Scene): void {
    for (let index = 1; index <= 5; index += 1) {
      const id = String(index).padStart(2, '0')
      scene.load.image(`garden-grass-${id}`, `/garden/production-atmosphere/grass-${id}.png`)
      scene.load.image(`garden-flower-${id}`, `/garden/production-atmosphere/flower-grass-${id}.png`)
    }
  }

  create(stage: number, reducedMotion: boolean): void {
    this.stage = Phaser.Math.Clamp(Math.round(stage), 0, GARDEN_STAGE_NAMES.length - 1)
    this.reducedMotion = reducedMotion
    this.props.push(...GARDEN_ANCHORS.map((anchor, index) => this.scene.add.image(0, 0, anchor.key)
      .setOrigin(0.5, 0.82)
      .setDepth(RenderLayers.gardenGround + anchor.depthOffset)
      .setVisible(false)
      .setAlpha(0)
      .setFlipX(anchor.flipX ?? false)
      .setData('anchor', anchor)
      .setData('index', index)))
    this.syncStage(false)
  }

  update(timeMs: number, environment: EnvironmentSnapshot): void {
    const phaseAlpha = environment.phase === 'night'
      ? 0.58
      : environment.phase === 'evening'
        ? 0.72
        : environment.phase === 'morning'
          ? 0.82
          : 0.90
    const weatherAlpha = Phaser.Math.Clamp(1 - environment.precipitation * 0.32 - environment.weatherShade * 0.28, 0.48, 1)
    const tint = this.tintForEnvironment(environment)

    this.props.forEach((prop, index) => {
      if (!prop.visible) return
      const anchor = prop.getData('anchor') as GardenAnchor
      const sway = this.reducedMotion ? 0 : Math.sin(timeMs / (2_500 + index * 85) + index * 0.71) * environment.wind * 1.35
      prop.setAngle(sway)
      prop.setTint(tint)
      prop.setAlpha(phaseAlpha * weatherAlpha * (anchor.key.includes('flower') ? 0.94 : 0.82))
    })
  }

  resize(sceneBounds: Phaser.Geom.Rectangle): void {
    const scaleX = sceneBounds.width / SOURCE_WIDTH
    const scaleY = sceneBounds.height / SOURCE_HEIGHT
    const sceneScale = Math.max(0.70, Math.min(scaleX, scaleY))
    this.props.forEach((prop) => {
      const anchor = prop.getData('anchor') as GardenAnchor
      prop
        .setPosition(sceneBounds.left + anchor.x * scaleX, sceneBounds.top + anchor.y * scaleY)
        .setScale(anchor.scale * sceneScale)
    })
  }

  setStage(stage: number, animate = true): void {
    const nextStage = Phaser.Math.Clamp(Math.round(stage), 0, GARDEN_STAGE_NAMES.length - 1)
    if (nextStage === this.stage) return
    const previous = this.stage
    this.stage = nextStage
    this.syncStage(animate && nextStage > previous && !this.reducedMotion)
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion
  }

  destroy(): void {
    this.props.forEach((prop) => {
      this.scene.tweens.killTweensOf(prop)
      prop.destroy()
    })
    this.props.length = 0
  }

  private syncStage(animate: boolean): void {
    this.props.forEach((prop, index) => {
      const anchor = prop.getData('anchor') as GardenAnchor
      const visible = this.stage >= anchor.minStage
      this.scene.tweens.killTweensOf(prop)
      if (!visible) {
        prop.setVisible(false).setAlpha(0)
        return
      }
      prop.setVisible(true)
      if (!animate) {
        prop.setAlpha(0.86)
        return
      }
      const scaleX = prop.scaleX || 1
      const scaleY = prop.scaleY || 1
      prop.setAlpha(0).setScale(scaleX * 0.90, scaleY * 0.90)
      this.scene.tweens.add({
        targets: prop,
        alpha: 0.88,
        scaleX,
        scaleY,
        duration: 460,
        delay: index * 50,
        ease: 'Sine.Out',
      })
    })
  }

  private tintForEnvironment(environment: EnvironmentSnapshot): number {
    const darkness = Phaser.Math.Clamp(environment.darkness + environment.weatherShade * 0.35, 0, 1)
    const red = channel(255 - darkness * 64 + environment.warmth * 13)
    const green = channel(255 - darkness * 72 + environment.warmth * 4 + environment.coolness * 3)
    const blue = channel(255 - darkness * 46 - environment.warmth * 13 + environment.coolness * 14)
    return Phaser.Display.Color.GetColor(red, green, blue)
  }
}
