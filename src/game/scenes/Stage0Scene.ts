import Phaser from 'phaser'
import { SANCTUARY_LANDMARKS } from '../data/sanctuaryLandmarks'
import type { SanctuaryLandmark } from '../types/SanctuaryLandmark'
import {
  createSanctuaryProgress,
  migrateSanctuaryProgress,
  HOME_STAGE_NAMES,
  POND_STAGE_NAMES,
  TREE_STAGE_NAMES,
  LANTERN_STAGE_NAMES,
} from '../progression/progressionEngine'
import type { SanctuaryProgressState } from '../progression/types'
import {
  PHASE_LABELS,
  WEATHER_LABELS,
} from '../sanctuary/config'
import { DEFAULT_SANCTUARY_SETTINGS, SANCTUARY_EVENTS, isPhaseMode, isSanctuaryQuality, isSanctuaryWeather } from '../sanctuary/runtime'
import { daylightForMinutes, daylightForPhase, minutesFromDate, phaseBlendForMinutes, stable } from '../sanctuary/timeEngine'
import type { DayPhase, PhaseBlend, PhaseMode, SanctuaryRuntimeSettings, SanctuaryWeather } from '../sanctuary/types'
import { RenderLayers } from '../engine/RenderLayers'
import { WorldEngine } from '../engine/WorldEngine'
import type { WeatherTuning } from '../engine/WeatherManager'
import { FluidSystem } from '../systems/FluidSystem'
import { CloudSystem } from '../systems/CloudSystem'
import { AtmosphereSystem } from '../systems/AtmosphereSystem'
import { VegetationSystem } from '../systems/VegetationSystem'
import { LightingSystem } from '../systems/LightingSystem'
import { WeatherSystem } from '../systems/WeatherSystem'
import { GARDEN_STAGE_NAMES, GardenEvolutionSystem } from '../systems/GardenEvolutionSystem'
import { CritterSystem } from '../systems/CritterSystem'
import { KonoInteractionSystem, type KonoLandmarkId } from '../systems/KonoInteractionSystem'
import { KonoMascotSystem } from '../systems/KonoMascotSystem'
import { mascotObstacles } from '../data/buildAssets'
import type { BuildPlacement } from '../../store/model'
import { EvolutionCoordinator, type EvolutionStageChange } from '../evolution/EvolutionCoordinator'

interface LandmarkRuntime {
  data: SanctuaryLandmark
  hitbox: Phaser.GameObjects.Rectangle
  outline: Phaser.GameObjects.Rectangle
}

interface SanctuaryStatePayload {
  phase: DayPhase
  phaseLabel: string
  nextPhase: DayPhase
  nextPhaseLabel: string
  weather: SanctuaryWeather
  weatherLabel: string
  transition: number
  mode: PhaseMode
  simulationMinutes: number
  ambientLight: number
  lanternStrength: number
  starVisibility: number
  haze: number
  weatherTransition: number
  cloudCover: number
  windStrength: number
  precipitation: number
  waterEnergy: number
}

const PHASE_VARIANTS = ['01', '02', '03', '04']

const terraceMapTextureKey = (phase: DayPhase): string => `stage0-${phase}-terrace`


export default class Stage0Scene extends Phaser.Scene {
  private baseA!: Phaser.GameObjects.Image
  private sceneBounds = new Phaser.Geom.Rectangle()
  private landmarks: LandmarkRuntime[] = []
  private popupObjects: Phaser.GameObjects.GameObject[] = []
  private gardenEvolution!: GardenEvolutionSystem
  private critters!: CritterSystem
  private konoInteractions!: KonoInteractionSystem
  private konoMascot!: KonoMascotSystem
  private fluid!: FluidSystem
  private clouds!: CloudSystem
  private atmosphere!: AtmosphereSystem
  private vegetation!: VegetationSystem
  private lighting!: LightingSystem
  private weatherSystem!: WeatherSystem
  private evolutionCoordinator!: EvolutionCoordinator
  private paintedPhase: DayPhase = 'afternoon'
  private ambientSprites = new Set<Phaser.GameObjects.Image>()
  private clockEvent?: Phaser.Time.TimerEvent
  private ambientEvent?: Phaser.Time.TimerEvent
  private blend: PhaseBlend = stable('afternoon')
  private settings: SanctuaryRuntimeSettings = { ...DEFAULT_SANCTUARY_SETTINGS }
  private progress: SanctuaryProgressState = createSanctuaryProgress('unassigned')
  private decorations: BuildPlacement[] = []
  private world = new WorldEngine()
  private stateEmitClock = 0
  private readyPhases = new Set<DayPhase>()
  private failedPhases = new Set<DayPhase>()
  private pendingBlend: {blend:PhaseBlend;daylight:ReturnType<typeof daylightForMinutes>;initial:boolean}|null=null
  private loadingPhase:DayPhase|null=null
  private loadingImageKeys:string[]=[]
  private bootImageKeys:string[]=[]
  private bootDaylight=daylightForPhase('afternoon')
  private sceneReady=false
  private systemsDisposed=false
  private phaseGateDisposed=false
  private collectQueuedImages(queue:()=>void):string[]{
    const keys:string[]=[]
    const collect=(key:string,type:string)=>{if(type==='image')keys.push(key)}
    this.load.on(Phaser.Loader.Events.ADD,collect)
    try{queue()}finally{this.load.off(Phaser.Loader.Events.ADD,collect)}
    return keys
  }
  private enqueuePhaseAssets(phase:DayPhase):void{
    this.load.image(terraceMapTextureKey(phase),`/garden/terrace-23.0/${phase}.webp`)
  }

  constructor() {
    super('Stage0Scene')
  }

  preload(): void {
    this.readRegistrySettings()
    const minutes=this.currentMinutes()
    this.blend=this.settings.phaseMode==='auto'?phaseBlendForMinutes(minutes):stable(this.settings.phaseMode)
    this.paintedPhase=this.blend.dominant
    this.bootDaylight=this.settings.phaseMode==='auto'?daylightForMinutes(minutes):daylightForPhase(this.settings.phaseMode)
    this.events.once(Phaser.Scenes.Events.DESTROY,()=>{this.phaseGateDisposed=true;this.pendingBlend=null})
    this.bootImageKeys=this.collectQueuedImages(()=>{
    this.enqueuePhaseAssets(this.paintedPhase)
    PHASE_VARIANTS.forEach((id) => {
      this.load.image(`leaf-${id}`, `/garden/processed/leaves/leaf-${id}.png`)
      this.load.image(`petal-${id}`, `/garden/processed/petals/cherry-petal-${id}.png`)
    })
    CloudSystem.preload(this)
    AtmosphereSystem.preload(this)
    VegetationSystem.preload(this)
    LightingSystem.preload(this)
    GardenEvolutionSystem.preload(this)
    CritterSystem.preload(this)
    KonoMascotSystem.preload(this)
    })
  }

  create(): void {
    if(this.bootImageKeys.some(key=>!this.textures.exists(key))){this.game.events.emit(SANCTUARY_EVENTS.load,{status:'error',phase:this.paintedPhase,boot:true});return}
    this.readyPhases.add(this.paintedPhase)
    this.readRegistrySettings()
    this.world.setPhase(this.paintedPhase)
    this.world.setDaylight(this.bootDaylight)
    this.world.performance.setQuality(this.settings.quality)
    this.world.setWeather(this.settings.weather, true)
    this.world.setQuality(this.settings.quality, this.scale.width)
    this.createGeneratedTextures()

    this.baseA = this.add.image(this.scale.width / 2, this.scale.height / 2, terraceMapTextureKey(this.paintedPhase)).setOrigin(0.5).setDepth(RenderLayers.background)
    this.lighting = new LightingSystem(this)
    this.lighting.create(this.settings.reducedMotion)
    this.weatherSystem = new WeatherSystem(this)
    this.weatherSystem.create(this.settings.reducedMotion, this.settings.ambientDensity)

    this.gardenEvolution = new GardenEvolutionSystem(this)
    this.gardenEvolution.create(this.progress.featureStages.garden ?? 0, this.settings.reducedMotion)
    // Build 23.0: the animated ocean/waterfall/foam/pond shimmer crops were tuned to fixed pixel
    // positions on the old terrace map and no longer line up with the new blank island's coastline
    // and waterfall — never created, rather than shown misplaced. New crops fitted to the new island's
    // art (and its own per-phase variants) will replace this later; the class stays wired (every other
    // call site below is a safe no-op against its empty layer map) so re-enabling it is a one-line change.
    this.fluid = new FluidSystem(this)
    this.clouds = new CloudSystem(this)
    this.clouds.create(this.blend.dominant, this.settings.reducedMotion)
    this.atmosphere = new AtmosphereSystem(this)
    this.atmosphere.create(this.blend.dominant, this.settings.reducedMotion)
    this.vegetation = new VegetationSystem(this)
    this.vegetation.create(this.blend.dominant, this.settings.reducedMotion)
    this.critters = new CritterSystem(this)
    this.critters.create(
      this.blend.dominant,
      this.settings.reducedMotion,
      this.settings.ambientDensity,
      this.progress.featureStages.garden ?? 0,
      this.progress.featureStages.pond ?? 0,
    )
    this.konoInteractions = new KonoInteractionSystem(this)
    this.konoInteractions.create(this.settings.reducedMotion, this.progress.profileId)
    this.konoMascot = new KonoMascotSystem(this)
    this.konoMascot.create(this.settings.reducedMotion, this.blend.dominant)
    this.konoMascot.setObstacles(mascotObstacles(this.decorations))
    this.evolutionCoordinator = new EvolutionCoordinator(
      this,
      (change, animate) => this.applyEvolutionChange(change, animate),
      (payload) => this.game.events.emit(SANCTUARY_EVENTS.evolution, payload),
    )
    this.evolutionCoordinator.setReducedMotion(this.settings.reducedMotion)
    this.sceneReady=true
    this.game.events.emit(SANCTUARY_EVENTS.load,{status:'ready',phase:this.paintedPhase})
    this.game.events.on(SANCTUARY_EVENTS.retry,this.handlePhaseRetry,this)
    this.game.events.on(SANCTUARY_EVENTS.action,this.handleAccessibleAction,this)
    this.createLandmarks()
    this.fitScene()
    this.applyCurrentTime(true)
    this.applyWeather(this.settings.weather, true)
    this.bindRuntimeEvents()

    this.clockEvent = this.time.addEvent({ delay: 5_000, loop: true, callback: () => this.applyCurrentTime(false) })
    this.scheduleNextAmbient(1_600)

    this.scale.on('resize', this.handleResize, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this)
  }

  private readRegistrySettings(): void {
    const phaseMode = this.registry.get('sanctuaryPhase')
    const weather = this.registry.get('sanctuaryWeather')
    const reducedMotion = this.registry.get('sanctuaryReducedMotion')
    const ambientDensity = this.registry.get('sanctuaryAmbientDensity')
    const debugMinutes = this.registry.get('sanctuaryDebugMinutes')
    const quality = this.registry.get('sanctuaryQuality')
    const progress = this.registry.get('sanctuaryProgress')
    const decorations = this.registry.get('sanctuaryDecorations')

    if (isPhaseMode(phaseMode)) this.settings.phaseMode = phaseMode
    if (isSanctuaryWeather(weather)) this.settings.weather = weather
    if (typeof reducedMotion === 'boolean') this.settings.reducedMotion = reducedMotion
    if (typeof ambientDensity === 'number' && Number.isFinite(ambientDensity)) this.settings.ambientDensity = Phaser.Math.Clamp(ambientDensity, 0.25, 2)
    if (typeof debugMinutes === 'number' && Number.isFinite(debugMinutes)) this.settings.debugMinutes = Phaser.Math.Clamp(debugMinutes, 0, 1439)
    if (isSanctuaryQuality(quality)) this.settings.quality = quality
    if (progress && typeof progress === 'object') {
      const profileId = typeof (progress as Partial<SanctuaryProgressState>).profileId === 'string'
        ? (progress as Partial<SanctuaryProgressState>).profileId as string
        : 'unassigned'
      this.progress = migrateSanctuaryProgress(progress, profileId)
    }
    if (Array.isArray(decorations)) this.decorations = decorations as BuildPlacement[]
  }

  private bindRuntimeEvents(): void {
    this.game.events.on(SANCTUARY_EVENTS.phase, this.handlePhaseEvent, this)
    this.game.events.on(SANCTUARY_EVENTS.weather, this.handleWeatherEvent, this)
    this.game.events.on(SANCTUARY_EVENTS.weatherTuning, this.handleWeatherTuningEvent, this)
    this.game.events.on(SANCTUARY_EVENTS.motion, this.handleMotionEvent, this)
    this.game.events.on(SANCTUARY_EVENTS.density, this.handleDensityEvent, this)
    this.game.events.on(SANCTUARY_EVENTS.debugTime, this.handleDebugTimeEvent, this)
    this.game.events.on(SANCTUARY_EVENTS.quality, this.handleQualityEvent, this)
    this.game.events.on(SANCTUARY_EVENTS.fluidSpeed, this.handleFluidSpeedEvent, this)
    this.game.events.on(SANCTUARY_EVENTS.fluidEnabled, this.handleFluidEnabledEvent, this)
    this.game.events.on(SANCTUARY_EVENTS.progress, this.handleProgressEvent, this)
    this.game.events.on(SANCTUARY_EVENTS.decor, this.handleDecorEvent, this)
  }

  private handleDecorEvent(decorations: unknown): void {
    if (!Array.isArray(decorations)) return
    this.decorations = decorations as BuildPlacement[]
    this.konoMascot?.setObstacles(mascotObstacles(this.decorations))
  }

  private handleProgressEvent(progress: unknown): void {
    if (!progress || typeof progress !== 'object') return
    const profileId = typeof (progress as Partial<SanctuaryProgressState>).profileId === 'string'
      ? (progress as Partial<SanctuaryProgressState>).profileId as string
      : this.progress.profileId
    const profileChanged = profileId !== this.progress.profileId
    const previous = this.progress
    this.progress = migrateSanctuaryProgress(progress, profileId)

    const changes = this.buildEvolutionChanges(previous, this.progress)
    const regressions = changes.filter((change) => change.nextStage < change.previousStage)
    const advances = changes.filter((change) => change.nextStage > change.previousStage)

    if (profileChanged || regressions.length > 0) {
      this.evolutionCoordinator.cancel()
      // A reset can interrupt queued upgrades whose displayed stage still differs
      // from progress. Resync every feature, including unchanged logical stages.
      const reset = { ...this.progress, featureStages: { ...this.progress.featureStages, tree: -1, home: -1, pond: -1, garden: -1, lanterns: -1 } }
      this.buildEvolutionChanges(reset, this.progress).forEach((change) => this.applyEvolutionChange(change, false))
    } else {
      this.evolutionCoordinator.enqueue(advances, true)
    }

    const nextGardenStage = this.progress.featureStages.garden ?? 0
    const nextPondStage = this.progress.featureStages.pond ?? 0
    this.critters?.setStages(nextGardenStage, nextPondStage)
    if (profileChanged) {
      this.konoInteractions?.setProfile(this.progress.profileId)
    }
  }

  private buildEvolutionChanges(previous: SanctuaryProgressState, next: SanctuaryProgressState): EvolutionStageChange[] {
    const previousTree = previous.featureStages.tree ?? previous.unlockedStage
    const nextTree = next.featureStages.tree ?? next.unlockedStage
    const previousPond = previous.featureStages.pond ?? 0
    const previousHome = previous.featureStages.home ?? 0
    const nextPond = next.featureStages.pond ?? 0
    const nextHome = next.featureStages.home ?? 0
    const previousLanterns = previous.featureStages.lanterns ?? 0
    const nextLanterns = next.featureStages.lanterns ?? 0
    const previousGarden = previous.featureStages.garden ?? 0
    const nextGarden = next.featureStages.garden ?? 0

    const changes: EvolutionStageChange[] = [
      { feature: 'tree', featureLabel: 'Cherry tree', previousStage: previousTree, nextStage: nextTree, stageName: TREE_STAGE_NAMES[nextTree] ?? TREE_STAGE_NAMES[0] },
      { feature: 'home', featureLabel: 'Sanctuary cottage', previousStage: previousHome, nextStage: nextHome, stageName: HOME_STAGE_NAMES[nextHome] ?? HOME_STAGE_NAMES[0] },
      { feature: 'garden', featureLabel: 'Sanctuary garden', previousStage: previousGarden, nextStage: nextGarden, stageName: GARDEN_STAGE_NAMES[nextGarden] ?? GARDEN_STAGE_NAMES[0] },
      { feature: 'pond', featureLabel: 'Koi pond', previousStage: previousPond, nextStage: nextPond, stageName: POND_STAGE_NAMES[nextPond] ?? POND_STAGE_NAMES[0] },
      { feature: 'lanterns', featureLabel: 'Lantern terrace', previousStage: previousLanterns, nextStage: nextLanterns, stageName: LANTERN_STAGE_NAMES[nextLanterns] ?? LANTERN_STAGE_NAMES[0] },
    ]
    return changes.filter((change) => change.previousStage !== change.nextStage)
  }

  private applyEvolutionChange(change: EvolutionStageChange, animate: boolean): void {
    if (change.feature === 'garden') this.gardenEvolution?.setStage(change.nextStage, animate)
    // 'tree'/'home'/'pond'/'lanterns' progress still track and fire their own evolution-milestone
    // notice — the growing pixel-art stages these once animated are retired in favor of the
    // duplicable Home/Pond/Tree decorations; there's no single instance left to grow.
  }

  private handlePhaseEvent(mode: unknown): void {
    if (!isPhaseMode(mode)) return
    this.settings.phaseMode = mode
    if (mode === 'auto') this.applyCurrentTime(false)
    else this.transitionToManualPhase(mode)
  }

  private handleWeatherEvent(weather: unknown): void {
    if (!isSanctuaryWeather(weather)) return
    this.settings.weather = weather
    this.applyWeather(weather, false)
    this.rescheduleAmbientSystems()
  }

  private handleWeatherTuningEvent(tuning: unknown): void {
    if (!tuning || typeof tuning !== 'object') return
    this.world.setWeatherTuning(tuning as Partial<WeatherTuning>)
    this.world.update(0)
    this.rescheduleAmbientSystems()
    this.emitState()
  }

  private handleMotionEvent(reducedMotion: unknown): void {
    if (typeof reducedMotion !== 'boolean') return
    this.settings.reducedMotion = reducedMotion
    this.fluid.setReducedMotion(reducedMotion)
    this.clouds.setReducedMotion(reducedMotion)
    this.atmosphere.setReducedMotion(reducedMotion)
    this.vegetation.setReducedMotion(reducedMotion)
    this.lighting.setReducedMotion(reducedMotion)
    this.weatherSystem.setReducedMotion(reducedMotion)
    this.gardenEvolution.setReducedMotion(reducedMotion)
    this.critters.setReducedMotion(reducedMotion)
    this.konoInteractions.setReducedMotion(reducedMotion)
    this.konoMascot.setReducedMotion(reducedMotion)
    this.evolutionCoordinator.setReducedMotion(reducedMotion)
    this.rescheduleAmbientSystems()
  }

  private handleDensityEvent(density: unknown): void {
    if (typeof density !== 'number' || !Number.isFinite(density)) return
    this.settings.ambientDensity = Phaser.Math.Clamp(density, 0.25, 2)
    this.weatherSystem.setDensity(this.settings.ambientDensity)
    this.critters.setDensity(this.settings.ambientDensity)
    this.rescheduleAmbientSystems()
  }

  private handleQualityEvent(quality: unknown): void {
    if (!isSanctuaryQuality(quality)) return
    this.settings.quality = quality
    this.world.setQuality(quality, this.scale.width)
    this.rescheduleAmbientSystems()
  }

  private handleFluidSpeedEvent(speed: unknown): void {
    if (typeof speed !== 'number' || !Number.isFinite(speed)) return
    this.fluid.setSpeedMultiplier(speed)
  }

  private handleFluidEnabledEvent(enabled: unknown): void {
    if (typeof enabled !== 'boolean') return
    this.fluid.setEnabled(enabled)
  }

  private handleDebugTimeEvent(minutes: unknown): void {
    this.settings.debugMinutes = typeof minutes === 'number' && Number.isFinite(minutes) ? Phaser.Math.Clamp(minutes, 0, 1439) : null
    if (this.settings.phaseMode === 'auto') this.applyCurrentTime(false)
  }

  private currentMinutes(): number {
    return this.settings.debugMinutes ?? minutesFromDate(new Date())
  }

  private applyCurrentTime(initial: boolean): void {
    if (this.settings.phaseMode !== 'auto') {
      if (initial) this.applyBlend(stable(this.settings.phaseMode), daylightForPhase(this.settings.phaseMode), true)
      return
    }

    const minutes = this.currentMinutes()
    const nextBlend = phaseBlendForMinutes(minutes)
    this.applyBlend(nextBlend, daylightForMinutes(minutes), initial)
  }

  private transitionToManualPhase(phase: DayPhase): void {
    this.applyBlend(stable(phase), daylightForPhase(phase), false)
  }

  private applyBlend(blend:PhaseBlend,daylight:ReturnType<typeof daylightForMinutes>,initial:boolean):void{
    if(this.phaseGateDisposed)return
    this.pendingBlend={blend,daylight,initial}
    this.pumpPhaseRequest()
  }
  private pumpPhaseRequest():void{
    const request=this.pendingBlend
    if(this.phaseGateDisposed||!request)return
    const phase=request.blend.dominant
    if(this.readyPhases.has(phase)){this.pendingBlend=null;this.commitBlend(request.blend,request.daylight);this.game.events.emit(SANCTUARY_EVENTS.load,{status:'ready',phase});return}
    if(this.failedPhases.has(phase)){this.game.events.emit(SANCTUARY_EVENTS.load,{status:'error',phase});return}
    this.game.events.emit(SANCTUARY_EVENTS.load,{status:'loading',phase})
    if(this.loadingPhase)return
    this.loadingPhase=phase
    this.loadingImageKeys=this.collectQueuedImages(()=>this.enqueuePhaseAssets(phase))
    if(!this.loadingImageKeys.length){this.handlePhaseLoadComplete();return}
    this.load.once(Phaser.Loader.Events.COMPLETE,this.handlePhaseLoadComplete,this);this.load.start()
  }
  private handlePhaseLoadComplete():void{
    const phase=this.loadingPhase
    if(this.phaseGateDisposed||!phase)return
    const failed=this.loadingImageKeys.some(key=>!this.textures.exists(key))
    this.loadingPhase=null;this.loadingImageKeys=[]
    if(failed)this.failedPhases.add(phase);else this.readyPhases.add(phase)
    this.pumpPhaseRequest()
  }
  private handleAccessibleAction(payload:{kind?:string;landmarkId?:KonoLandmarkId;actionId?:string;action?:string}):void{
    if(!this.sceneReady||!payload)return
    if(payload.kind!=='interaction'||!payload.landmarkId)return
    const actions=this.konoInteractions.getActions(payload.landmarkId,{lanternStage:this.progress.featureStages.lanterns??0,pondStage:this.progress.featureStages.pond??0,phase:this.paintedPhase})??[]
    const action=actions.find(a=>a.id===payload.actionId)
    if(action){this.closePopup();this.konoInteractions.start(action)}
  }
  private handlePhaseRetry():void{
    const phase=this.pendingBlend?.blend.dominant
    if(phase){this.failedPhases.delete(phase);this.pumpPhaseRequest()}
  }
  private commitBlend(nextBlend: PhaseBlend, daylight: ReturnType<typeof daylightForMinutes>): void {
    this.blend = nextBlend
    this.world.setPhase(nextBlend.dominant)
    this.world.setDaylight(daylight)
    this.swapPaintedPhase(nextBlend.dominant)
    this.fluid.setPhase(nextBlend.dominant)
    this.clouds.setPhase(nextBlend.dominant)
    this.atmosphere.setPhase(nextBlend.dominant)
    this.vegetation.setPhase(nextBlend.dominant)
    this.critters.setPhase(nextBlend.dominant)
    this.konoMascot?.setPhase(nextBlend.dominant)
    this.emitState()
  }

  private swapPaintedPhase(phase: DayPhase): void {
    if (phase === this.paintedPhase) return
    // Production 22.7.25: direct FULL-MAP texture swap only; every terrace stage is rebuilt independently from its phase Stage 0 map and the locked native structure anchor. The terrace is already
    // baked into each stage/phase Sanctuary PNG. No separate terrace sprite, alpha patch,
    // phase veil, tint, recolor, glow, or other lighting overlay is rendered at runtime.
    this.paintedPhase = phase
    this.baseA.setTexture(terraceMapTextureKey(phase)).setAlpha(1)
    this.fitBackgrounds()
    this.positionWorldEffects()
  }

  private createGeneratedTextures(): void {
    // Intentionally empty. Terrace/lantern lighting is baked directly into the
    // 24 full Sanctuary map PNGs; no procedural terrace texture or glow is generated.
  }


  update(timeMs: number, delta: number): void {
    if(!this.sceneReady)return
    const dt = Math.min(delta, 34) / 1000
    const frame = this.world.update(dt)
    const environment = frame.environment
    this.lighting.update(timeMs, dt, environment)
    this.fluid.update(timeMs, dt, environment)
    this.clouds.update(timeMs, dt, environment)
    this.atmosphere.update(timeMs, dt, environment)
    this.vegetation.update(timeMs, environment)
    this.weatherSystem.update(timeMs, dt, environment)
    this.gardenEvolution.update(timeMs, environment)
    this.konoMascot.update(timeMs, dt, environment)
    this.critters.setKonoPosition(this.konoMascot.getNormalizedPosition())
    this.critters.update(timeMs, environment)

    this.stateEmitClock += dt
    if (this.stateEmitClock >= 0.5) {
      this.stateEmitClock = 0
      this.emitState()
    }
  }

  private applyWeather(weather: SanctuaryWeather, immediate: boolean): void {
    this.world.setWeather(weather, immediate || this.settings.reducedMotion)
    this.world.setQuality(this.settings.quality, this.scale.width)
    this.world.update(0)
    this.emitState()
  }

  private scheduleNextAmbient(delay?: number): void {
    this.ambientEvent?.remove(false)
    const environment = this.world.environment.snapshot()
    const weatherFactor = environment.leafIntensity > 0.2
      ? 0.38
      : environment.precipitation > 0.1
        ? 1.35
        : environment.cloudCover > 0.55
          ? 0.78
          : 1
    const motionFactor = this.settings.reducedMotion ? 2.5 : 1
    const density = Math.max(0.25, this.settings.ambientDensity)
    const baseDelay = Phaser.Math.Between(4_800, 10_500) * weatherFactor * motionFactor / density
    this.ambientEvent = this.time.delayedCall(delay ?? baseDelay, () => {
      this.spawnAmbientAccent()
      this.scheduleNextAmbient()
    })
  }

  private rescheduleAmbientSystems(): void {
    this.scheduleNextAmbient(700)
  }

  private spawnAmbientAccent(): void {
    if (!this.baseA?.active || this.popupObjects.length || this.settings.reducedMotion && Phaser.Math.Between(0, 2) !== 0) return
    const limit = this.world.performance.particleCount({
      base: 11,
      width: this.scale.width,
      density: this.settings.ambientDensity,
      reducedMotion: this.settings.reducedMotion,
    })
    if (this.ambientSprites.size > limit) return

    const dominant = this.blend.dominant
    const environment = this.world.environment.snapshot()
    if (environment.precipitation > 0.12) return
    if (environment.leafIntensity > 0.22) {
      this.spawnDriftingSprite('leaf', 0.15, 0.82, 0.18, 0.48, 0.065, 0.105, 3_400, 5_600, true, 120)
      return
    }
    // Build 22.6.1: night/evening fireflies are exclusively handled by CritterSystem
    // using the clean individual transparent PNG silhouettes. Do not spawn the
    // legacy processed firefly assets here or they compete visually with the critter pack.
    if (environment.starVisibility > 0.45 || dominant === 'night') return
    if (environment.lanternStrength > 0.12 || dominant === 'evening') {
      this.spawnDriftingSprite('petal', 0.28, 0.78, 0.16, 0.48, 0.065, 0.105, 3_800, 6_400, true, 82)
      return
    }
    if (dominant === 'morning') {
      this.spawnDriftingSprite('petal', 0.25, 0.72, 0.15, 0.43, 0.055, 0.085, 5_200, 7_800, true, 58)
      return
    }
    this.spawnDriftingSprite('leaf', 0.20, 0.76, 0.16, 0.44, 0.05, 0.08, 5_400, 8_200, true, 52)
  }

  private spawnDriftingSprite(
    prefix: 'leaf' | 'petal',
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    minScale: number,
    maxScale: number,
    minDuration: number,
    maxDuration: number,
    fall: boolean,
    horizontalTravel: number,
  ): void {
    const id = String(Phaser.Math.Between(1, 4)).padStart(2, '0')
    const x = this.sceneBounds.left + this.sceneBounds.width * Phaser.Math.FloatBetween(minX, maxX)
    const y = this.sceneBounds.top + this.sceneBounds.height * Phaser.Math.FloatBetween(minY, maxY)
    const sprite = this.add.image(x, y, `${prefix}-${id}`)
      .setDepth(25)
      .setAlpha(0.58)
      .setScale(Phaser.Math.FloatBetween(minScale, maxScale) * Math.max(0.72, this.sceneBounds.width / 1_440))
      .setAngle(Phaser.Math.Between(-24, 24))

    this.ambientSprites.add(sprite)
    const duration = Phaser.Math.Between(minDuration, maxDuration)
    const direction = Phaser.Math.Between(0, 1) ? 1 : -1
    const driftX = horizontalTravel * direction * Math.max(0.7, this.sceneBounds.width / 1_448)
    const driftY = fall ? Phaser.Math.Between(45, 105) : Phaser.Math.Between(-22, 22)
    const peakAlpha = 0.66

    this.tweens.add({
      targets: sprite,
      x: x + driftX,
      y: y + driftY,
      angle: sprite.angle + Phaser.Math.Between(-95, 110),
      alpha: 0,
      duration,
      ease: 'Sine.InOut',
      onUpdate: (tween) => {
        const progress = tween.progress
        if (progress < 0.35) sprite.setAlpha(Phaser.Math.Linear(0.18, peakAlpha, progress / 0.35))
      },
      onComplete: () => this.destroyAmbientSprite(sprite),
    })
  }

  private destroyAmbientSprite(sprite: Phaser.GameObjects.Image): void {
    this.ambientSprites.delete(sprite)
    sprite.destroy()
  }

  private emitState(): void {
    const environment = this.world.environment.snapshot()
    const payload: SanctuaryStatePayload = {
      phase: this.blend.dominant,
      phaseLabel: PHASE_LABELS[this.blend.dominant],
      nextPhase: environment.nextPhase,
      nextPhaseLabel: PHASE_LABELS[environment.nextPhase],
      weather: this.settings.weather,
      weatherLabel: WEATHER_LABELS[this.settings.weather],
      transition: environment.phaseTransition,
      mode: this.settings.phaseMode,
      simulationMinutes: environment.minutes,
      ambientLight: environment.ambientLight,
      lanternStrength: environment.lanternStrength,
      starVisibility: environment.starVisibility,
      haze: environment.haze,
      weatherTransition: environment.weatherTransition,
      cloudCover: environment.cloudCover,
      windStrength: environment.wind,
      precipitation: environment.precipitation,
      waterEnergy: environment.waterEnergy,
    }
    this.game.events.emit(SANCTUARY_EVENTS.state, payload)
  }

  private createLandmarks(): void {
    // These landmarks have no info popup left (per explicit request) — the hover highlight and
    // hitbox that used to lead into it are retired along with it, not just the click action, so
    // there's no dead "hover box that does nothing" left over. garden and mailbox were the last two
    // still wired up; decoration is now handled entirely by the manual Decorate-mode build system.
    const retiredLandmarkIds = new Set(['cherry', 'lanterns', 'house', 'pond', 'bridge', 'garden', 'mailbox'])
    SANCTUARY_LANDMARKS.forEach((landmark) => {
      if (retiredLandmarkIds.has(landmark.id)) return
      const outline = this.add.rectangle(0, 0, 1, 1, 0xfff5c9, 0).setStrokeStyle(3, 0xfff2b5, 0).setDepth(RenderLayers.landmarkOutline)
      const hitbox = this.add.rectangle(0, 0, 1, 1, 0xffffff, 0.001).setDepth(RenderLayers.landmarkHitbox).setInteractive({ useHandCursor: true })

      hitbox.on('pointerover', () => {
        outline.setFillStyle(0xfff5c9, 0.07).setStrokeStyle(2, 0xffefaa, 0.55)
        this.tweens.killTweensOf(outline)
        this.tweens.add({ targets: outline, scaleX: 1.02, scaleY: 1.02, duration: 220, ease: 'Sine.Out' })
      })
      hitbox.on('pointerout', () => {
        outline.setFillStyle(0xfff5c9, 0).setStrokeStyle(2, 0xfff2b5, 0)
        this.tweens.killTweensOf(outline)
        this.tweens.add({ targets: outline, scaleX: 1, scaleY: 1, duration: 180, ease: 'Sine.Out' })
      })
      this.landmarks.push({ data: landmark, hitbox, outline })
    })
  }

  private fitScene(): void {
    this.fitBackgrounds()
    this.positionWorldEffects()
    this.positionLandmarks()
  }

  private fitBackgrounds(): void {
    if (!this.baseA) return
    const sourceWidth = this.baseA.width || 1
    const sourceHeight = this.baseA.height || 1
    const scale = Math.min(this.scale.width / sourceWidth, this.scale.height / sourceHeight)
    this.baseA.setPosition(this.scale.width / 2, this.scale.height / 2).setScale(scale)
    this.sceneBounds = this.baseA.getBounds()
  }

  private positionWorldEffects(): void {
    this.lighting.resize(this.sceneBounds)
    this.fluid.resize(this.sceneBounds)
    this.clouds.resize(this.sceneBounds)
    this.atmosphere.resize(this.sceneBounds)
    this.vegetation.resize(this.sceneBounds)
    this.weatherSystem.resize(this.sceneBounds)
    this.gardenEvolution.resize(this.sceneBounds)
    this.critters.resize(this.sceneBounds)
    this.konoInteractions.resize(this.sceneBounds)
    this.konoMascot.resize(this.sceneBounds)
    this.evolutionCoordinator.resize(this.sceneBounds)
  }

  private positionLandmarks(): void {
    const bounds = this.sceneBounds
    this.landmarks.forEach(({ data, hitbox, outline }) => {
      const x = bounds.left + bounds.width * data.x
      const y = bounds.top + bounds.height * data.y
      const width = bounds.width * data.width
      const height = bounds.height * data.height
      hitbox.setPosition(x, y).setSize(width, height)
      outline.setPosition(x, y).setSize(width, height)
    })
  }

  private closePopup(): void {
    this.popupObjects.forEach((object) => object.destroy())
    this.popupObjects = []
  }

  private handleResize = (): void => {
    this.closePopup()
    this.fitScene()
  }

  private handleShutdown(): void {
    if(this.systemsDisposed)return
    this.systemsDisposed=true;this.sceneReady=false;this.phaseGateDisposed=true;this.pendingBlend=null
    this.load.off(Phaser.Loader.Events.COMPLETE,this.handlePhaseLoadComplete,this)
    this.game.events.off(SANCTUARY_EVENTS.retry,this.handlePhaseRetry,this)
    this.game.events.off(SANCTUARY_EVENTS.action,this.handleAccessibleAction,this)
    this.clockEvent?.remove(false)
    this.ambientEvent?.remove(false)
    this.game.events.off(SANCTUARY_EVENTS.phase, this.handlePhaseEvent, this)
    this.game.events.off(SANCTUARY_EVENTS.weather, this.handleWeatherEvent, this)
    this.game.events.off(SANCTUARY_EVENTS.weatherTuning, this.handleWeatherTuningEvent, this)
    this.game.events.off(SANCTUARY_EVENTS.motion, this.handleMotionEvent, this)
    this.game.events.off(SANCTUARY_EVENTS.density, this.handleDensityEvent, this)
    this.game.events.off(SANCTUARY_EVENTS.debugTime, this.handleDebugTimeEvent, this)
    this.game.events.off(SANCTUARY_EVENTS.quality, this.handleQualityEvent, this)
    this.game.events.off(SANCTUARY_EVENTS.fluidSpeed, this.handleFluidSpeedEvent, this)
    this.game.events.off(SANCTUARY_EVENTS.fluidEnabled, this.handleFluidEnabledEvent, this)
    this.game.events.off(SANCTUARY_EVENTS.progress, this.handleProgressEvent, this)
    this.game.events.off(SANCTUARY_EVENTS.decor, this.handleDecorEvent, this)
    this.scale.off('resize', this.handleResize, this)
    this.tweens.killAll()
    this.ambientSprites.forEach((sprite) => sprite.destroy())
    this.ambientSprites.clear()
    this.konoInteractions.destroy()
    this.konoMascot.destroy()
    this.fluid.destroy()
    this.clouds.destroy()
    this.atmosphere.destroy()
    this.vegetation.destroy()
    this.lighting.destroy()
    this.weatherSystem.destroy()
    this.gardenEvolution.destroy()
    this.critters.destroy()
    this.evolutionCoordinator.destroy()
    this.closePopup()
  }
}
