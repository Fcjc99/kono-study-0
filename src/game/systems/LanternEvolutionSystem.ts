import Phaser from 'phaser'
import type { LightingVisualState } from './LightingSystem'
import type { EnvironmentSnapshot } from '../sanctuary/environmentManager'
import type { DayPhase } from '../sanctuary/types'
import { RenderLayers } from '../engine/RenderLayers'
import { ensureLightTexture, PHASE_LIGHT, TERRACE_BULBS } from './sanctuaryLighting'

export const LANTERN_STAGE_NAMES = [
  'Simple terrace',
  'Quiet bench',
  'Cozy corner lounge',
  'Garden reading lounge',
  'Blossom pergola',
  'Grand sanctuary terrace',
] as const

export const LANTERN_STAGE_INTERACTIONS = [
  'No terrace interaction yet.',
  'No terrace interaction yet.',
  'KONO can stand here and look out over the sanctuary.',
  'KONO can sit and have tea.',
  'KONO can sit, have tea, and look around.',
  'KONO can sit, have tea, read, or rest.',
] as const

/** Stage-aware evening bulb emission. Never redraw or move the terrace artwork. */
export class LanternEvolutionSystem {
  private stage = 0
  private phase: DayPhase = 'afternoon'
  private bounds = new Phaser.Geom.Rectangle()
  private halos: Phaser.GameObjects.Image[] = []
  private cores: Phaser.GameObjects.Rectangle[] = []
  private readonly scene: Phaser.Scene
  constructor(scene: Phaser.Scene) { this.scene = scene }
  static preload(_scene: Phaser.Scene): void {void _scene}
  create(stage: number, _reducedMotion: boolean): void {void _reducedMotion;
    this.stage = Phaser.Math.Clamp(Math.round(stage),0,5)
    ensureLightTexture(this.scene,'terrace-bulb-light','bulb')
    for(let i=0;i<6;i++) {
      this.halos.push(this.scene.add.image(0,0,'terrace-bulb-light').setDepth(RenderLayers.lanternGlow).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0))
      this.cores.push(this.scene.add.rectangle(0,0,3,4,0xffefb1).setDepth(RenderLayers.lanternGlow+.01).setAlpha(0))
    }
  }
  update(_lighting: LightingVisualState,environment: EnvironmentSnapshot,_timeMs:number): void {void _lighting;void _timeMs; this.setPhase(environment.phase) }
  resize(bounds: Phaser.Geom.Rectangle): void {
    this.bounds.setTo(bounds.x,bounds.y,bounds.width,bounds.height)
    this.refresh()
  }
  setPhase(phase: DayPhase): void { this.phase=phase; this.refresh() }
  setStage(stage:number,_animate=true): void {void _animate; this.stage=Phaser.Math.Clamp(Math.round(stage),0,5); this.refresh() }
  setReducedMotion(_reducedMotion:boolean): void {void _reducedMotion}
  destroy(): void { this.halos.forEach(s=>s.destroy()); this.cores.forEach(s=>s.destroy()); this.halos=[]; this.cores=[] }
  private refresh(): void {
    const anchors=TERRACE_BULBS[this.stage], sx=this.bounds.width/1448,sy=this.bounds.height/1086,alpha=PHASE_LIGHT[this.phase].bulbs
    this.halos.forEach((halo,i)=>{
      const point=anchors[i],core=this.cores[i]
      halo.setVisible(!!point);core.setVisible(!!point)
      if(!point)return
      const x=this.bounds.x+point[0]*sx,y=this.bounds.y+point[1]*sy
      halo.setPosition(x,y).setDisplaySize(24*sx,24*sy).setAlpha(alpha*.65)
      core.setPosition(x,y).setDisplaySize(3*sx,4*sy).setAlpha(alpha)
    })
  }
}
