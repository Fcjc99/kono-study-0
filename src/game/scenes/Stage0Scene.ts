import Phaser from 'phaser'
import { SANCTUARY_LANDMARKS } from '../data/sanctuaryLandmarks'
import type { SanctuaryLandmark } from '../types/SanctuaryLandmark'
import { createSanctuaryProgress, migrateSanctuaryProgress } from '../progression/progressionEngine'
import type { SanctuaryProgressState } from '../progression/types'
import {
  PHASE_LABELS,
  POND_RIPPLE_ANCHORS,
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
import { LightingSystem, type LightingVisualState } from '../systems/LightingSystem'
import { WeatherSystem } from '../systems/WeatherSystem'
import { TREE_STAGE_NAMES, TreeEvolutionSystem } from '../systems/TreeEvolutionSystem'
import { POND_STAGE_NAMES, PondEvolutionSystem } from '../systems/PondEvolutionSystem'
import { HOME_STAGE_NAMES, HomeEvolutionSystem } from '../systems/HomeEvolutionSystem'
import { LANTERN_STAGE_INTERACTIONS, LANTERN_STAGE_NAMES, LanternEvolutionSystem } from '../systems/LanternEvolutionSystem'
import { GARDEN_STAGE_NAMES, GardenEvolutionSystem } from '../systems/GardenEvolutionSystem'
import { CritterSystem } from '../systems/CritterSystem'
import { FishingSystem } from '../systems/FishingSystem'
import { KonoInteractionSystem, type KonoLandmarkId } from '../systems/KonoInteractionSystem'
import { KonoMascotSystem } from '../systems/KonoMascotSystem'
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
const RIPPLE_VARIANTS = ['01', '02', '03', '06']

const TERRACE_MAP_STAGE_COUNT = 6
const terraceMapTextureKey = (phase: DayPhase, stage: number): string => `stage0-${phase}-terrace-stage-${Phaser.Math.Clamp(Math.round(stage), 0, TERRACE_MAP_STAGE_COUNT - 1)}`


export default class Stage0Scene extends Phaser.Scene {
  private baseA!: Phaser.GameObjects.Image
  private sceneBounds = new Phaser.Geom.Rectangle()
  private landmarks: LandmarkRuntime[] = []
  private popupObjects: Phaser.GameObjects.GameObject[] = []
  private popupLandmarkId: string | null = null
  private popupOpenedAt = -1_000
  private lanternEvolution!: LanternEvolutionSystem
  private gardenEvolution!: GardenEvolutionSystem
  private critters!: CritterSystem
  private fishing!: FishingSystem
  private konoInteractions!: KonoInteractionSystem
  private konoMascot!: KonoMascotSystem
  private fluid!: FluidSystem
  private clouds!: CloudSystem
  private atmosphere!: AtmosphereSystem
  private vegetation!: VegetationSystem
  private lighting!: LightingSystem
  private weatherSystem!: WeatherSystem
  private evolution!: TreeEvolutionSystem
  private pondEvolution!: PondEvolutionSystem
  private homeEvolution!: HomeEvolutionSystem
  private evolutionCoordinator!: EvolutionCoordinator
  private paintedPhase: DayPhase = 'afternoon'
  private lightingVisual: LightingVisualState = {
    ambientLight: 1,
    darkness: 0,
    warmth: 0.03,
    coolness: 0,
    lanternStrength: 0,
    starVisibility: 0,
    haze: 0.025,
    waterHighlight: 1,
  }
  private ambientSprites = new Set<Phaser.GameObjects.Image>()
  private clockEvent?: Phaser.Time.TimerEvent
  private rippleEvent?: Phaser.Time.TimerEvent
  private ambientEvent?: Phaser.Time.TimerEvent
  private blend: PhaseBlend = stable('afternoon')
  private settings: SanctuaryRuntimeSettings = { ...DEFAULT_SANCTUARY_SETTINGS }
  private progress: SanctuaryProgressState = createSanctuaryProgress('unassigned')
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
    for(let stage=0;stage<TERRACE_MAP_STAGE_COUNT;stage++)this.load.image(terraceMapTextureKey(phase,stage),`/garden/terrace-22.8.7/${phase}/stage-${stage}.png`)
    FluidSystem.preload(this,[phase]);TreeEvolutionSystem.preload(this,[phase]);HomeEvolutionSystem.preload(this,[phase]);FishingSystem.preload(this,[phase])
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
    RIPPLE_VARIANTS.forEach((id) => this.load.image(`ripple-${id}`, `/garden/processed/ripples/ripple-${id}.png`))
    PHASE_VARIANTS.forEach((id) => {
      this.load.image(`leaf-${id}`, `/garden/processed/leaves/leaf-${id}.png`)
      this.load.image(`petal-${id}`, `/garden/processed/petals/cherry-petal-${id}.png`)
    })
    CloudSystem.preload(this)
    AtmosphereSystem.preload(this)
    VegetationSystem.preload(this)
    PondEvolutionSystem.preload(this)
    LanternEvolutionSystem.preload(this)
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

    this.baseA = this.add.image(this.scale.width / 2, this.scale.height / 2, terraceMapTextureKey(this.paintedPhase, this.progress.featureStages.lanterns ?? 0)).setOrigin(0.5).setDepth(RenderLayers.background)
    this.lighting = new LightingSystem(this)
    this.lighting.create(this.settings.reducedMotion)
    this.weatherSystem = new WeatherSystem(this)
    this.weatherSystem.create(this.settings.reducedMotion, this.settings.ambientDensity)

    this.gardenEvolution = new GardenEvolutionSystem(this)
    this.gardenEvolution.create(this.progress.featureStages.garden ?? 0, this.settings.reducedMotion)
    this.homeEvolution = new HomeEvolutionSystem(this)
    this.homeEvolution.create(this.progress.featureStages.home ?? 0, this.blend.dominant, this.settings.reducedMotion)
    this.lanternEvolution = new LanternEvolutionSystem(this)
    this.lanternEvolution.create(this.progress.featureStages.lanterns ?? 0, this.settings.reducedMotion)
    this.fluid = new FluidSystem(this)
    this.fluid.create(this.blend.dominant, this.settings.reducedMotion)
    this.pondEvolution = new PondEvolutionSystem(this)
    this.pondEvolution.create(this.progress.featureStages.pond ?? 0, this.settings.reducedMotion)
    this.clouds = new CloudSystem(this)
    this.clouds.create(this.blend.dominant, this.settings.reducedMotion)
    this.atmosphere = new AtmosphereSystem(this)
    this.atmosphere.create(this.blend.dominant, this.settings.reducedMotion)
    this.vegetation = new VegetationSystem(this)
    this.vegetation.create(this.blend.dominant, this.settings.reducedMotion)
    this.evolution = new TreeEvolutionSystem(this)
    this.evolution.create(this.progress.featureStages.tree ?? this.progress.unlockedStage, this.blend.dominant, this.settings.reducedMotion)
    this.critters = new CritterSystem(this)
    this.critters.create(
      this.blend.dominant,
      this.settings.reducedMotion,
      this.settings.ambientDensity,
      this.progress.featureStages.garden ?? 0,
      this.progress.featureStages.pond ?? 0,
    )
    this.fishing = new FishingSystem(this)
    this.fishing.setPhase(this.paintedPhase)
    this.fishing.create(this.settings.reducedMotion, this.progress.profileId)
    this.konoInteractions = new KonoInteractionSystem(this)
    this.konoInteractions.create(this.settings.reducedMotion, this.progress.profileId)
    this.konoMascot = new KonoMascotSystem(this)
    this.konoMascot.create(this.settings.reducedMotion, this.blend.dominant)
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
    this.scheduleNextRipple(900)
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
      this.fishing?.setProfile(this.progress.profileId)
      this.konoInteractions?.setProfile(this.progress.profileId)
    }
    if (changes.some((change) => change.feature === 'pond')) this.scheduleNextRipple(260)
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
    if (change.feature === 'tree') this.evolution?.setStage(change.nextStage, animate)
    else if (change.feature === 'home') this.homeEvolution?.setStage(change.nextStage, animate)
    else if (change.feature === 'pond') this.pondEvolution?.setStage(change.nextStage, animate)
    else if (change.feature === 'lanterns') {
      this.lanternEvolution?.setStage(change.nextStage, animate)
      this.baseA?.setTexture(terraceMapTextureKey(this.paintedPhase, change.nextStage)).setAlpha(1)
      this.fitBackgrounds()
      this.positionWorldEffects()
    }
    else if (change.feature === 'garden') this.gardenEvolution?.setStage(change.nextStage, animate)
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
    this.pondEvolution.setReducedMotion(reducedMotion)
    this.homeEvolution.setReducedMotion(reducedMotion)
    this.lanternEvolution.setReducedMotion(reducedMotion)
    this.gardenEvolution.setReducedMotion(reducedMotion)
    this.critters.setReducedMotion(reducedMotion)
    this.fishing.setReducedMotion(reducedMotion)
    this.konoInteractions.setReducedMotion(reducedMotion)
    this.konoMascot.setReducedMotion(reducedMotion)
    this.evolution.setReducedMotion(reducedMotion)
    this.evolutionCoordinator.setReducedMotion(reducedMotion)
    this.refreshPersistentEffects()
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
    if(this.readyPhases.has(phase)){this.pendingBlend=null;this.commitBlend(request.blend,request.daylight,request.initial);this.game.events.emit(SANCTUARY_EVENTS.load,{status:'ready',phase});return}
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
    if(payload.kind==='fishing'){if(payload.action==='cast')this.fishing.start(true);if(payload.action==='reel')this.fishing.handleBridgePress();return}
    if(payload.kind!=='interaction'||!payload.landmarkId)return
    const actions=this.konoInteractions.getActions(payload.landmarkId,{lanternStage:this.progress.featureStages.lanterns??0,pondStage:this.progress.featureStages.pond??0,phase:this.paintedPhase})??[]
    const action=actions.find(a=>a.id===payload.actionId)
    if(action){this.closePopup();this.konoInteractions.start(action)}
  }
  private handlePhaseRetry():void{
    const phase=this.pendingBlend?.blend.dominant
    if(phase){this.failedPhases.delete(phase);this.pumpPhaseRequest()}
  }
  private commitBlend(nextBlend: PhaseBlend, daylight: ReturnType<typeof daylightForMinutes>, initial: boolean): void {
    this.blend = nextBlend
    this.world.setPhase(nextBlend.dominant)
    this.world.setDaylight(daylight)
    this.swapPaintedPhase(nextBlend.dominant, initial)
    this.fluid.setPhase(nextBlend.dominant)
    this.clouds.setPhase(nextBlend.dominant)
    this.atmosphere.setPhase(nextBlend.dominant)
    this.vegetation.setPhase(nextBlend.dominant)
    this.critters.setPhase(nextBlend.dominant)
    this.konoMascot?.setPhase(nextBlend.dominant)
    this.refreshPersistentEffects()
    this.emitState()
  }

  private swapPaintedPhase(phase: DayPhase, immediate: boolean): void {
    if (phase === this.paintedPhase) {
      if (immediate) this.syncRegisteredPhaseArt(phase)
      return
    }
    const applyTexture = () => {
      this.paintedPhase = phase
      this.baseA.setTexture(terraceMapTextureKey(phase, this.progress.featureStages.lanterns ?? 0)).setAlpha(1)
      this.syncRegisteredPhaseArt(phase)
      this.fitBackgrounds()
      this.positionWorldEffects()
    }

    // Production 22.7.25: direct FULL-MAP texture swap only; every terrace stage is rebuilt independently from its phase Stage 0 map and the locked native structure anchor. The terrace is already
    // baked into each stage/phase Sanctuary PNG. No separate terrace sprite, alpha patch,
    // phase veil, tint, recolor, glow, or other lighting overlay is rendered at runtime.
    applyTexture()
  }

  private syncRegisteredPhaseArt(phase: DayPhase): void {
    // Build 22.1: these full-map/crop-registered assets must change on the exact
    // same frame as the painted Sanctuary map. This prevents a transient old
    // roofline, clipped rock, terrace mismatch, or fishing-kit color shift.
    this.homeEvolution?.setPhase(phase)
    this.lanternEvolution?.setPhase(phase)
    this.fishing?.setPhase(phase)
    // Tree phase PNG must change on this exact frame too; crossfading two
    // differently painted trees caused transient old/new phase mismatch.
    this.evolution?.setPhase(phase, false)
  }

  private phaseWeight(phase: DayPhase): number {
    if (this.blend.from === this.blend.to) return this.blend.from === phase ? 1 : 0
    let weight = 0
    if (this.blend.from === phase) weight += 1 - this.blend.amount
    if (this.blend.to === phase) weight += this.blend.amount
    return weight
  }

  private createGeneratedTextures(): void {
    // Intentionally empty. Terrace/lantern lighting is baked directly into the
    // 24 full Sanctuary map PNGs; no procedural terrace texture or glow is generated.
  }


  private refreshPersistentEffects(): void {
    const environment = this.world.environment.snapshot()
    this.lanternEvolution.update(this.lighting.snapshot(), environment, 0)
  }

  update(timeMs: number, delta: number): void {
    if(!this.sceneReady)return
    const dt = Math.min(delta, 34) / 1000
    const frame = this.world.update(dt)
    const environment = frame.environment
    this.lightingVisual = this.lighting.update(timeMs, dt, environment)
    this.lanternEvolution.update(this.lightingVisual, environment, timeMs)
    this.fluid.update(timeMs, dt, environment)
    this.clouds.update(timeMs, dt, environment)
    this.atmosphere.update(timeMs, dt, environment)
    this.vegetation.update(timeMs, environment)
    this.weatherSystem.update(timeMs, dt, environment)
    this.pondEvolution.update(timeMs, environment)
    this.gardenEvolution.update(timeMs, environment)
    this.evolution.update(timeMs, environment)
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
    this.refreshPersistentEffects()
    this.emitState()
  }

  private scheduleNextRipple(delay?: number): void {
    this.rippleEvent?.remove(false)
    const environment = this.world.environment.snapshot()
    const rainIntensity = Phaser.Math.Clamp(environment.rainIntensity, 0, 1)
    const density = Phaser.Math.Clamp(this.settings.ambientDensity, 0.25, 2)
    const calmDelay = Phaser.Math.Between(8_000, 17_000) / Math.sqrt(density)
    const rainDelay = Phaser.Math.Between(380, 980) / density
    const baseDelay = Phaser.Math.Linear(calmDelay, rainDelay, rainIntensity)
    const evolvedDelay = baseDelay * this.pondEvolution.rippleDelayMultiplier()
    const motionDelay = this.settings.reducedMotion ? evolvedDelay * 2.2 : evolvedDelay
    this.rippleEvent = this.time.delayedCall(delay ?? motionDelay, () => {
      this.spawnPondRipple()
      const currentRain = this.world.environment.snapshot().rainIntensity
      if (currentRain > 0.45 && !this.settings.reducedMotion && Math.random() < currentRain * 0.45) {
        this.time.delayedCall(Phaser.Math.Between(90, 240), () => this.spawnPondRipple())
      }
      this.scheduleNextRipple()
    })
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
    this.scheduleNextRipple(350)
    this.scheduleNextAmbient(700)
  }

  private spawnPondRipple(): void {
    if (!this.baseA?.active || this.popupObjects.length) return
    const environment = this.world.environment.snapshot()
    const rainIntensity = Phaser.Math.Clamp(environment.rainIntensity, 0, 1)
    const anchor = Phaser.Utils.Array.GetRandom(POND_RIPPLE_ANCHORS)
    const x = this.sceneBounds.left + this.sceneBounds.width * anchor.x
    const y = this.sceneBounds.top + this.sceneBounds.height * anchor.y
    const ripple = this.add.image(x, y, `ripple-${Phaser.Utils.Array.GetRandom(RIPPLE_VARIANTS)}`)
      .setDepth(RenderLayers.atmosphereBack)
      .setAlpha((this.phaseWeight('night') > 0.5 ? 0.26 : Phaser.Math.Linear(0.42, 0.34, rainIntensity)) + this.pondEvolution.rippleAlphaBonus())
      .setScale(Math.max(0.055, this.sceneBounds.width / 3_300) * this.pondEvolution.rippleScaleMultiplier())

    this.ambientSprites.add(ripple)
    const expansion = Phaser.Math.Linear(1.58, 1.34, rainIntensity)
    this.tweens.add({
      targets: ripple,
      scaleX: ripple.scaleX * expansion,
      scaleY: ripple.scaleY * expansion,
      alpha: 0,
      duration: this.settings.reducedMotion ? 1_250 : Phaser.Math.Linear(2_300, 1_550, rainIntensity),
      ease: 'Sine.Out',
      onComplete: () => this.destroyAmbientSprite(ripple),
    })
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

  private getLandmarkProgress(landmark: SanctuaryLandmark): { current: number; goal: number; level: number } {
    let current = this.progress.totalCredits

    if (landmark.id === 'pond') {
      current = this.progress.creditsBySubjectKey?.science ?? 0
    } else if (landmark.id === 'bridge') {
      current = Object.keys(this.progress.completionDates).length
    } else if (landmark.id === 'lanterns') {
      current = Object.keys(this.progress.completionDates).filter((key) => (this.progress.completionDates[key] ?? 0) > 0).length
    } else if (landmark.id === 'mailbox') {
      const now = new Date()
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      current = (this.progress.completionDates[today] ?? 0) > 0 ? 1 : 0
    }

    const goal = landmark.progressGoal
    return { current: Math.min(current, goal), goal, level: current >= goal ? 1 : 0 }
  }

  private createLandmarks(): void {
    SANCTUARY_LANDMARKS.forEach((landmark) => {
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
      hitbox.on('pointerdown', () => {
        if (landmark.id === 'bridge' && this.fishing.handleBridgePress()) return
        this.openLandmarkPopup(landmark)
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
    this.pondEvolution.resize(this.sceneBounds)
    this.homeEvolution.resize(this.sceneBounds)
    this.lanternEvolution.resize(this.sceneBounds)
    this.gardenEvolution.resize(this.sceneBounds)
    this.critters.resize(this.sceneBounds)
    this.fishing.resize(this.sceneBounds)
    this.konoInteractions.resize(this.sceneBounds)
    this.konoMascot.resize(this.sceneBounds)
    this.evolution.resize(this.sceneBounds)
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

  private openLandmarkPopup(landmark: SanctuaryLandmark): void {
    const now = this.time.now
    if (this.popupLandmarkId === landmark.id && now - this.popupOpenedAt < 240) return
    this.closePopup()
    this.popupLandmarkId = landmark.id
    this.popupOpenedAt = now

    const width = this.scale.width
    const height = this.scale.height
    const panelWidth = Math.min(350, Math.max(270, width - 24))
    const margin = Math.max(12, Math.min(20, width * 0.025))
    const centerX = width - panelWidth / 2 - margin
    const progress = this.getLandmarkProgress(landmark)
    const unlocked = progress.current >= progress.goal
    const treeStage = this.progress.featureStages.tree ?? this.progress.unlockedStage
    const pondStage = this.progress.featureStages.pond ?? 0
    const homeStage = this.progress.featureStages.home ?? 0
    const lanternStage = this.progress.featureStages.lanterns ?? 0
    const gardenStage = this.progress.featureStages.garden ?? 0
    const scienceCredits = this.progress.creditsBySubjectKey?.science ?? 0
    const activeDays = Object.keys(this.progress.completionDates).filter((key) => (this.progress.completionDates[key] ?? 0) > 0).length
    const isCherry = landmark.id === 'cherry'
    const isPond = landmark.id === 'pond'
    const isHome = landmark.id === 'house'
    const isLanterns = landmark.id === 'lanterns'
    const isGarden = landmark.id === 'garden'
    const isBridge = landmark.id === 'bridge'
    const fishingSummary = this.fishing.getSummary()
    const interactionSummary = this.konoInteractions.getSummary()
    const landmarkVisits = interactionSummary.landmarkVisits[landmark.id as KonoLandmarkId] ?? 0
    const isEvolutionFeature = isCherry || isPond || isHome || isLanterns || isGarden
    const nextTreeAt = this.progress.nextFeatureAt?.tree ?? this.progress.nextStageAt
    const nextPondAt = this.progress.nextFeatureAt?.pond ?? null
    const nextHomeAt = this.progress.nextFeatureAt?.home ?? null
    const nextLanternAt = this.progress.nextFeatureAt?.lanterns ?? null
    const nextGardenAt = this.progress.nextFeatureAt?.garden ?? null
    const bodyWidth = panelWidth - 34

    const levelLabel = isCherry
      ? `Cherry tree · Stage ${treeStage}/5`
      : isPond
        ? `${POND_STAGE_NAMES[pondStage]} · Stage ${pondStage}/5`
        : isHome
          ? `${HOME_STAGE_NAMES[homeStage]} · Stage ${homeStage}/5`
          : isLanterns
            ? `${LANTERN_STAGE_NAMES[lanternStage]} · Stage ${lanternStage}/5`
            : isGarden
              ? `${GARDEN_STAGE_NAMES[gardenStage]} · Stage ${gardenStage}/5`
              : isBridge
                ? 'Fishing spot · Ready'
                : unlocked ? 'Next stage ready' : 'Sanctuary stage 0'

    const progressLabel = isCherry
      ? nextTreeAt === null ? `${this.progress.totalCredits} task credits · mature` : `${this.progress.totalCredits} / ${nextTreeAt} task credits`
      : isPond
        ? nextPondAt === null ? `${scienceCredits} science credits · complete` : `${scienceCredits} / ${nextPondAt} science credits`
        : isHome
          ? nextHomeAt === null ? `${this.progress.totalCredits} task credits · complete` : `${this.progress.totalCredits} / ${nextHomeAt} task credits`
          : isLanterns
            ? nextLanternAt === null ? `${activeDays} productive days · full glow` : `${activeDays} / ${nextLanternAt} productive days`
            : isGarden
              ? nextGardenAt === null ? `${this.progress.totalCredits} task credits · flourishing` : `${this.progress.totalCredits} / ${nextGardenAt} task credits`
              : isBridge
                ? `${fishingSummary.totalCatches} catches · ${progress.current}/${progress.goal} active days`
                : `${progress.current} / ${progress.goal}`

    const descriptionCopy = isPond
      ? 'Science work brings ripples, lily details, and pond life.'
      : isHome
        ? 'Completed work grows the original cottage through six complete pixel-PNG home stages.'
        : isLanterns
          ? `Productive study days furnish the terrace through six permanent pixel-PNG stages. ${LANTERN_STAGE_INTERACTIONS[lanternStage]}`
          : isGarden
            ? 'Task milestones establish permanent garden clusters around the island.'
            : isCherry
              ? 'Every newly completed assignment helps the centerpiece tree grow.'
              : isBridge
                ? 'Cast from the wooden bridge into the ocean below. Wait for the bite, then tap the bridge again to reel in.'
                : landmark.description

    const nextCopy = isCherry
      ? treeStage >= 5 ? 'Full bloom reached.' : 'Next: a larger cherry-tree form.'
      : isPond
        ? pondStage >= 5 ? 'Living pond reached.' : 'Next: more movement and pond life.'
        : isHome
          ? homeStage >= 5 ? 'Sanctuary cottage fully evolved.' : 'Next: a larger complete cottage sprite.'
          : isLanterns
            ? lanternStage >= 5 ? 'Cozy terrace complete: sit, tea, read, or rest.' : `Next: ${LANTERN_STAGE_NAMES[Math.min(5, lanternStage + 1)]}.`
            : isGarden
              ? gardenStage >= 5 ? 'Garden fully flourishing.' : 'Next: another planted island zone.'
              : isBridge
                ? `Best catch: ${fishingSummary.bestCatchName ?? '—'}${fishingSummary.bestSizeCm > 0 ? ` · ${fishingSummary.bestSizeCm} cm` : ''}`
                : landmarkVisits > 0 ? `KONO visits: ${landmarkVisits} · ${unlocked ? `Ready: ${landmark.reward}` : `Future: ${landmark.reward}`}` : unlocked ? `Ready: ${landmark.reward}` : `Future: ${landmark.reward}`

    const title = this.add.text(0, 0, landmark.title, {
      fontFamily: 'Arial, sans-serif', fontSize: '18px', fontStyle: 'bold', color: '#332d2a',
    }).setDepth(RenderLayers.popup + 2)
    const level = this.add.text(0, 0, levelLabel, {
      fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: isEvolutionFeature || isBridge || unlocked ? '#5d7859' : '#8a7d76',
    }).setDepth(RenderLayers.popup + 2)
    const progressText = this.add.text(0, 0, progressLabel, {
      fontFamily: 'Arial, sans-serif', fontSize: '13px', fontStyle: 'bold', color: isEvolutionFeature || isBridge || unlocked ? '#557150' : '#8a665b',
    }).setDepth(RenderLayers.popup + 2)
    const description = this.add.text(0, 0, descriptionCopy, {
      fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#5c514c', lineSpacing: 3, wordWrap: { width: bodyWidth },
    }).setDepth(RenderLayers.popup + 2)
    const next = this.add.text(0, 0, nextCopy, {
      fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#6c7d62', lineSpacing: 3, wordWrap: { width: bodyWidth },
    }).setDepth(RenderLayers.popup + 2)

    const interactionActions = this.konoInteractions.getActions(landmark.id as KonoLandmarkId, { lanternStage, pondStage, phase: this.paintedPhase })
    const popupActions: Array<{ label: string; primary?: boolean; run: () => void }> = []
    if (isBridge) {
      popupActions.push({
        label: 'Go Fishing',
        primary: true,
        run: () => this.fishing.start(),
      })
    }
    interactionActions.forEach((action) => popupActions.push({
      label: action.label,
      primary: !isBridge && popupActions.length === 0,
      run: () => this.konoInteractions.start(action),
    }))

    const actionColumns = popupActions.length > 1 ? 2 : 1
    const actionRows = Math.ceil(popupActions.length / actionColumns)
    const actionHeight = popupActions.length > 0 ? 12 + actionRows * 34 + Math.max(0, actionRows - 1) * 6 : 0
    const contentHeight = title.height + 5 + level.height + 11 + progressText.height + 10 + description.height + 9 + next.height + actionHeight
    const panelHeight = Math.min(height - margin * 2, Math.max(178, contentHeight + 34))
    const centerY = Phaser.Math.Clamp(height * 0.50, margin + panelHeight / 2, height - margin - panelHeight / 2)
    const shadow = this.add.rectangle(centerX + 4, centerY + 6, panelWidth, panelHeight, 0x251d1a, 0.18)
      .setDepth(RenderLayers.popup)
    const panel = this.add.rectangle(centerX, centerY, panelWidth, panelHeight, 0xfffbf6, 0.97)
      .setStrokeStyle(2, 0xd8b8aa, 0.92)
      .setDepth(RenderLayers.popup + 1)
      .setInteractive()

    const left = centerX - panelWidth / 2 + 17
    let y = centerY - panelHeight / 2 + 14
    title.setPosition(left, y); y += title.height + 5
    level.setPosition(left, y); y += level.height + 11
    progressText.setPosition(left, y); y += progressText.height + 10
    description.setPosition(left, y); y += description.height + 9
    next.setPosition(left, y); y += next.height

    const actionObjects: Phaser.GameObjects.GameObject[] = []
    if (popupActions.length > 0) {
      y += 12
      const actionGap = 6
      const actionWidth = actionColumns === 1 ? bodyWidth : (bodyWidth - actionGap) / 2
      popupActions.forEach((action, index) => {
        const column = index % actionColumns
        const row = Math.floor(index / actionColumns)
        const actionX = left + actionWidth / 2 + column * (actionWidth + actionGap)
        const actionY = y + 17 + row * 40
        const fill = action.primary ? 0x6d8064 : 0xf3eadf
        const stroke = action.primary ? 0x53644e : 0xd8b8aa
        const textColor = action.primary ? '#ffffff' : '#5c514c'
        const actionBg = this.add.rectangle(actionX, actionY, actionWidth, 34, fill, 1)
          .setStrokeStyle(1, stroke, 0.95)
          .setDepth(RenderLayers.popup + 3)
          .setInteractive({ useHandCursor: true })
        const actionText = this.add.text(actionX, actionY, action.label, {
          fontFamily: 'Arial, sans-serif', fontSize: '13px', fontStyle: 'bold', color: textColor,
        }).setOrigin(0.5).setDepth(RenderLayers.popup + 4).setInteractive({ useHandCursor: true })

        const runAction = (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
          event.stopPropagation()
          this.closePopup()
          action.run()
        }
        actionBg.on('pointerdown', runAction)
        actionText.on('pointerdown', runAction)
        actionObjects.push(actionBg, actionText)
      })
    }

    const closeX = centerX + panelWidth / 2 - 18
    const closeY = centerY - panelHeight / 2 + 18
    const closeBg = this.add.circle(closeX, closeY, 12, 0x6d8064, 1)
      .setDepth(RenderLayers.popup + 3)
      .setInteractive({ useHandCursor: true })
    const closeText = this.add.text(closeX, closeY - 1, '×', {
      fontFamily: 'Arial, sans-serif', fontSize: '18px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5).setDepth(RenderLayers.popup + 4).setInteractive({ useHandCursor: true })

    closeBg.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation()
      this.closePopup()
    })
    closeText.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation()
      this.closePopup()
    })

    const popupObjects: Phaser.GameObjects.GameObject[] = [shadow, panel, title, level, progressText, description, next, closeBg, closeText, ...actionObjects]
    this.popupObjects = popupObjects
    popupObjects.forEach((object) => {
      const alphaObject = object as Phaser.GameObjects.GameObject & { setAlpha?: (value: number) => unknown }
      alphaObject.setAlpha?.(0)
    })
    panel.setScale(0.98)
    this.tweens.add({
      targets: popupObjects,
      alpha: 1,
      duration: this.settings.reducedMotion ? 60 : 150,
      ease: 'Sine.Out',
    })
    this.tweens.add({ targets: panel, scaleX: 1, scaleY: 1, duration: this.settings.reducedMotion ? 60 : 180, ease: 'Sine.Out' })
  }

  private closePopup(): void {
    this.popupObjects.forEach((object) => object.destroy())
    this.popupObjects = []
    this.popupLandmarkId = null
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
    this.rippleEvent?.remove(false)
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
    this.scale.off('resize', this.handleResize, this)
    this.tweens.killAll()
    this.ambientSprites.forEach((sprite) => sprite.destroy())
    this.ambientSprites.clear()
    this.fishing.destroy()
    this.konoInteractions.destroy()
    this.konoMascot.destroy()
    this.fluid.destroy()
    this.clouds.destroy()
    this.atmosphere.destroy()
    this.vegetation.destroy()
    this.lighting.destroy()
    this.weatherSystem.destroy()
    this.pondEvolution.destroy()
    this.homeEvolution.destroy()
    this.lanternEvolution.destroy()
    this.gardenEvolution.destroy()
    this.critters.destroy()
    this.evolutionCoordinator.destroy()
    this.evolution.destroy()
    this.closePopup()
  }
}
