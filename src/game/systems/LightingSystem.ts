import Phaser from 'phaser'
import type { EnvironmentSnapshot } from '../sanctuary/environmentManager'
import { RenderLayers } from '../engine/RenderLayers'
import { ensureLightTexture, PHASE_LIGHT } from './sanctuaryLighting'

export interface LightingVisualState {
  ambientLight: number
  darkness: number
  warmth: number
  coolness: number
  lanternStrength: number
  starVisibility: number
  haze: number
  waterHighlight: number
}

const approach = (current: number, target: number, speed: number, dt: number): number => {
  const amount = 1 - Math.exp(-Math.max(0, speed) * Math.max(0, dt))
  return current + (target - current) * amount
}

const createInitialState = (): LightingVisualState => ({
  ambientLight: 1,
  darkness: 0,
  warmth: 0.03,
  coolness: 0,
  lanternStrength: 0,
  starVisibility: 0,
  haze: 0.025,
  waterHighlight: 1,
})

/**
 * Directional illumination over registered artwork. No base geometry is changed.
 * Sun and moon arrive from the original paintings' upper-left horizon. UI remains above lighting.
 */
export class LightingSystem {
  private reducedMotion = false
  private visual: LightingVisualState = createInitialState()
  private sun!: Phaser.GameObjects.Image
  private moon!: Phaser.GameObjects.Image
  private shadows: Phaser.GameObjects.Image[] = []

  private readonly scene: Phaser.Scene
  constructor(scene: Phaser.Scene) { this.scene = scene }

  static preload(_scene: Phaser.Scene): void {
    void _scene
    // Intentionally empty: no runtime lighting overlay textures are loaded.
  }

  create(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion
    ensureLightTexture(this.scene, 'sanctuary-sunlight', 'sun')
    ensureLightTexture(this.scene, 'sanctuary-moonlight', 'moon')
    ensureLightTexture(this.scene, 'sanctuary-cast-shadow', 'shadow')
    this.sun = this.scene.add.image(0, 0, 'sanctuary-sunlight').setOrigin(0).setDepth(RenderLayers.lightingShade).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0)
    this.moon = this.scene.add.image(0, 0, 'sanctuary-moonlight').setOrigin(0).setDepth(RenderLayers.lightingShade + .01).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0)
    for (let i=0;i<3;i++) this.shadows.push(this.scene.add.image(0,0,'sanctuary-cast-shadow').setDepth(RenderLayers.evolutionGround - .1).setAlpha(0))
  }

  update(_timeMs: number, deltaSeconds: number, environment: EnvironmentSnapshot): LightingVisualState {
    const response = this.reducedMotion ? 5.8 : 3.1
    this.visual.ambientLight = approach(this.visual.ambientLight, environment.ambientLight, response, deltaSeconds)
    this.visual.darkness = approach(this.visual.darkness, environment.darkness, response, deltaSeconds)
    this.visual.warmth = approach(this.visual.warmth, environment.warmth, response, deltaSeconds)
    this.visual.coolness = approach(this.visual.coolness, environment.coolness, response, deltaSeconds)
    this.visual.lanternStrength = approach(this.visual.lanternStrength, environment.lanternStrength, response, deltaSeconds)
    this.visual.starVisibility = approach(this.visual.starVisibility, environment.starVisibility, response, deltaSeconds)
    this.visual.haze = approach(this.visual.haze, environment.haze, response, deltaSeconds)
    this.visual.waterHighlight = approach(this.visual.waterHighlight, environment.waterHighlight, response, deltaSeconds)
    const light = PHASE_LIGHT[environment.phase]
    const weather = Phaser.Math.Clamp(1 - environment.precipitation * .7 - environment.cloudCover * .35, .25, 1)
    this.sun.setAlpha(light.sun * weather)
    this.moon.setAlpha(light.moon * weather)
    this.shadows.forEach(shadow => shadow.setAlpha(light.shadow * weather).setAngle(environment.phase === 'night' ? -14 : 18))
    return this.snapshot()
  }

  resize(bounds: Phaser.Geom.Rectangle): void {
    for (const light of [this.sun, this.moon]) light.setPosition(bounds.x,bounds.y).setDisplaySize(bounds.width,bounds.height)
    const scaleX=bounds.width/1448, scaleY=bounds.height/1086
    // Soft cast shadows lie on the ground behind the cottage, tree and terrace.
    const anchors = [[422,561,205,42],[748,293,150,28],[1158,543,192,30]]
    this.shadows.forEach((shadow,i)=> { const [x,y,w,h]=anchors[i]; shadow.setPosition(bounds.x+x*scaleX,bounds.y+y*scaleY).setDisplaySize(w*scaleX,h*scaleY) })
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion
  }

  snapshot(): LightingVisualState {
    return { ...this.visual }
  }

  destroy(): void {
    this.sun?.destroy()
    this.moon?.destroy()
    this.shadows.forEach(shadow=>shadow.destroy())
    this.shadows=[]
  }
}
