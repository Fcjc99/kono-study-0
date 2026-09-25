import { minutesFromDate, phaseBlendForMinutes } from '../game/sanctuary/timeEngine'
import { useEffect, useRef, useState } from 'react'
import { WORLD_HEIGHT, WORLD_WIDTH } from '../game/sanctuary/config'
import { SANCTUARY_EVENTS } from '../game/sanctuary/runtime'
import { DEFAULT_WEATHER_TUNING, type WeatherTuning } from '../game/engine/WeatherManager'
import type { DayPhase, PhaseMode, SanctuaryQuality, SanctuaryWeather } from '../game/sanctuary/types'
import type { SanctuaryProgressState } from '../game/progression/types'
import type { BuildPlacement } from '../store/model'
import type { EvolutionMilestonePayload } from '../game/evolution/EvolutionCoordinator'
import type { KonoContextAction, KonoInteractionSummary } from '../game/systems/KonoInteractionSystem'
import { APP_VERSION } from '../version'

interface SanctuaryState {
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


interface KonoInteractionPayload {
  type: 'start' | 'finish'
  action: KonoContextAction
  summary: KonoInteractionSummary
}

interface PhaserGameHandle {
  registry: { set: (key: string, value: unknown) => void }
  events: {
    on: <T>(event: string, callback: (payload: T) => void) => void
    off: <T>(event: string, callback: (payload: T) => void) => void
    emit: (event: string, payload: unknown) => void
  }
  scale: { resize: (width: number, height: number) => void }
  isRunning: boolean
  scene: {stop: (key:string)=>unknown}
  loop: { running:boolean; sleep: () => void; wake: () => void; actualFps: number }
  destroy: (removeCanvas?: boolean) => void
}

const destroyGame=(game:PhaserGameHandle)=>{game.scene.stop('Stage0Scene');game.destroy(true);if(game.isRunning&&!game.loop.running)game.loop.wake()}
interface GardenCardProps {
  phase: PhaseMode
  weather: SanctuaryWeather
  reducedMotion: boolean
  progress: SanctuaryProgressState
  /** Placed Decorate-mode items, so KONO can path around them instead of walking through them.
   * Defaults to no decorations for callers (like the Decorate preview) that don't pass any. */
  decorations?: BuildPlacement[]
  /** Sleep the Phaser render loop while true — the live weather/day-night simulation keeps
   * rendering every frame behind the Decorate overlay otherwise, even though decorate only ever
   * shows a static reference view of the island. On a large/high-res screen that competes for
   * enough main-thread and GPU time that a real device (confirmed: Samsung Galaxy Z Fold 7, Chrome)
   * can visibly delay repainting a placed item's own scale/skew change until well after the
   * Size/Skew slider drag that caused it — the underlying data was already correct the whole time,
   * only the paint was starved. */
  paused?: boolean
  /** A fresh (non-null) value makes KONO play a one-off celebration reaction -- set this when the
   * student actually finishes something (clearing today's list, a streak milestone), not on every
   * render. null/undefined means "nothing to celebrate right now". */
  celebrateSignal?: number | null
  /** True for the duration of an active Focus Session -- KONO heads to the cherry tree and settles
   * into a reading pose as a quiet companion instead of wandering, then resumes as normal once false. */
  focusCompanionActive?: boolean
}

const initialState: SanctuaryState = {
  phase: 'afternoon',
  phaseLabel: 'Afternoon',
  nextPhase: 'evening',
  nextPhaseLabel: 'Evening',
  weather: 'clear',
  weatherLabel: 'Clear',
  transition: 0,
  mode: 'auto',
  simulationMinutes: 14 * 60,
  ambientLight: 1,
  lanternStrength: 0,
  starVisibility: 0,
  haze: 0.025,
  weatherTransition: 1,
  cloudCover: 0.08,
  windStrength: 0.12,
  precipitation: 0,
  waterEnergy: 0.18,
}

const formatDebugTime = (minutes: number) => {
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

const debugFromUrl = () =>
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('sanctuaryDebug') === '1'

export default function GardenCard({ phase, weather, reducedMotion, progress, decorations = [], paused, celebrateSignal, focusCompanionActive }: GardenCardProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const gameRef = useRef<PhaserGameHandle | null>(null)
  const visibleRef = useRef(true)
  const pausedRef = useRef(!!paused)
  const syncPauseStateRef = useRef<(() => void) | null>(null)
  const debugEnabledRef = useRef(debugFromUrl())
  const lastCanvasSizeRef = useRef({ width: 0, height: 0 })
  const bootSettingsRef = useRef({ phase, weather, reducedMotion, progress, decorations })
  useEffect(()=>{bootSettingsRef.current={phase,weather,reducedMotion,progress,decorations}},[phase,weather,reducedMotion,progress,decorations])
  useEffect(()=>{pausedRef.current=!!paused;syncPauseStateRef.current?.()},[paused])

  const [state, setState] = useState<SanctuaryState>(initialState)
  // Shown while the island engine downloads: the same picture the island starts from, sized the same way.
  const [autoPhase] = useState(() => phaseBlendForMinutes(minutesFromDate(new Date())).dominant)
  const [debugEnabled, setDebugEnabled] = useState(debugFromUrl)
  const [debugMinutes, setDebugMinutes] = useState(() => new Date().getHours() * 60 + new Date().getMinutes())
  const [debugDensity, setDebugDensity] = useState(1)
  const [weatherOverride,setWeatherOverride]=useState<{base:SanctuaryWeather;value:SanctuaryWeather}|null>(null)
  const debugWeather=weatherOverride?.base===weather?weatherOverride.value:weather
  const [loadStatus,setLoadStatus]=useState<{status:string;phase?:string;boot?:boolean}>({status:'loading'})
  const [attempt,setAttempt]=useState(0)
  const [debugQuality, setDebugQuality] = useState<SanctuaryQuality>('auto')
  const [debugFluidSpeed, setDebugFluidSpeed] = useState(1)
  const [debugFluidEnabled, setDebugFluidEnabled] = useState(true)
  const [debugWeatherTuning, setDebugWeatherTuning] = useState<WeatherTuning>({ ...DEFAULT_WEATHER_TUNING })
  const [debugFps, setDebugFps] = useState(0)
  const [evolutionNotice, setEvolutionNotice] = useState<EvolutionMilestonePayload | null>(null)
  const evolutionNoticeTimerRef = useRef(0)
  const [interactionNotice, setInteractionNotice] = useState<KonoInteractionPayload | null>(null)
  const interactionNoticeTimerRef = useRef(0)

  useEffect(() => {
    const handleDebugShortcut = (event: KeyboardEvent) => {
      if (event.key !== 'F8') return
      event.preventDefault()
      setDebugEnabled((enabled) => !enabled)
    }
    window.addEventListener('keydown', handleDebugShortcut)
    return () => window.removeEventListener('keydown', handleDebugShortcut)
  }, [])

  useEffect(() => {
    debugEnabledRef.current = debugEnabled
  }, [debugEnabled])

  useEffect(() => {
    const container = containerRef.current
    if (!container || gameRef.current) return

    let disposed = false
    let resizeObserver: ResizeObserver | null = null
    let visibilityObserver: IntersectionObserver | null = null
    let fpsTimer = 0
    let resizeFrame = 0
    let game: PhaserGameHandle | null = null
    let detachEvents=()=>{}
    let removeResizeFallback=()=>{}
    let syncPauseState: (() => void) | null = null

    const boot = async () => {
      const [{ default: PhaserRuntime }, { default: Stage0Scene }] = await Promise.all([
        import('phaser'),
        import('../game/scenes/Stage0Scene'),
      ])
      if (disposed || !containerRef.current) return

      const current = bootSettingsRef.current
      game = new PhaserRuntime.Game({
        type: PhaserRuntime.AUTO,
        parent: containerRef.current,
        width: WORLD_WIDTH,
        height: WORLD_HEIGHT,
        backgroundColor: '#cfe4ee',
        scene: [Stage0Scene],
        scale: { mode: PhaserRuntime.Scale.RESIZE, autoCenter: PhaserRuntime.Scale.CENTER_BOTH },
        fps: { target: 60, min: 30, forceSetTimeOut: false, smoothStep: true },
        render: {
          // 22.7.14: full Sanctuary maps are high-resolution baked compositions.
          // Do not force nearest-neighbor sampling during responsive map scaling.
          antialias: true,
          pixelArt: false,
          roundPixels: false,
          powerPreference: 'high-performance',
          batchSize: 4096,
          // Decorate mode calls game.loop.sleep() to stop the render loop and freeze the current
          // frame -- but WebGL's drawing buffer defaults to clearing itself after every composite
          // (preserveDrawingBuffer defaults to false), so once nothing is redrawing, the *next*
          // browser repaint can wipe the canvas to black instead of leaving the last frame visible.
          // Reproduced directly: entering Decorate reliably blacked out the canvas. This keeps the
          // buffer around between frames, which is exactly what "stop rendering, stay frozen" needs.
          preserveDrawingBuffer: true,
        },
        callbacks: {
          preBoot: (bootingGame) => {
            bootingGame.registry.set('sanctuaryPhase', current.phase)
            bootingGame.registry.set('sanctuaryWeather', current.weather)
            bootingGame.registry.set('sanctuaryReducedMotion', current.reducedMotion)
            bootingGame.registry.set('sanctuaryAmbientDensity', 1)
            bootingGame.registry.set('sanctuaryDebugMinutes', null)
            bootingGame.registry.set('sanctuaryQuality', 'auto')
            bootingGame.registry.set('sanctuaryProgress', current.progress)
            bootingGame.registry.set('sanctuaryDecorations', current.decorations)
          },
        },
      }) as unknown as PhaserGameHandle
      gameRef.current = game

      const handleLoad=(payload:{status:string;phase?:string;boot?:boolean})=>{if(!disposed)setLoadStatus(payload)}
      game.events.on(SANCTUARY_EVENTS.load,handleLoad)
      const handleState = (payload: SanctuaryState) => {
        if (debugEnabledRef.current) {
          setState(payload)
          return
        }
        setState((previous) => {
          const publicStateChanged = previous.phase !== payload.phase
            || previous.nextPhase !== payload.nextPhase
            || previous.weather !== payload.weather
            || previous.mode !== payload.mode
            || previous.phaseLabel !== payload.phaseLabel
            || previous.weatherLabel !== payload.weatherLabel
          return publicStateChanged ? { ...previous, ...payload } : previous
        })
      }
      const handleEvolutionMilestone = (payload: EvolutionMilestonePayload) => {
        setEvolutionNotice(payload)
        if (evolutionNoticeTimerRef.current) window.clearTimeout(evolutionNoticeTimerRef.current)
        evolutionNoticeTimerRef.current = window.setTimeout(() => setEvolutionNotice(null), payload.queueRemaining > 0 ? 1_050 : 2_150)
      }
      const handleKonoInteraction = (payload: KonoInteractionPayload) => {
        if (payload.type !== 'start') return
        setInteractionNotice(payload)
        if (interactionNoticeTimerRef.current) window.clearTimeout(interactionNoticeTimerRef.current)
        interactionNoticeTimerRef.current = window.setTimeout(() => setInteractionNotice(null), bootSettingsRef.current.reducedMotion ? 1_900 : 2_850)
      }
      game.events.on<SanctuaryState>(SANCTUARY_EVENTS.state, handleState)
      game.events.on<EvolutionMilestonePayload>(SANCTUARY_EVENTS.evolution, handleEvolutionMilestone)
      game.events.on<KonoInteractionPayload>(SANCTUARY_EVENTS.interaction, handleKonoInteraction)

      detachEvents=()=>{
        game?.events.off(SANCTUARY_EVENTS.load,handleLoad)
        game?.events.off(SANCTUARY_EVENTS.state,handleState)
        game?.events.off(SANCTUARY_EVENTS.evolution,handleEvolutionMilestone)
        game?.events.off(SANCTUARY_EVENTS.interaction,handleKonoInteraction)
      }
      const resizeGame = () => {
        if (resizeFrame) window.cancelAnimationFrame(resizeFrame)
        resizeFrame = window.requestAnimationFrame(() => {
          resizeFrame = 0
          if (!game || !containerRef.current) return
          // Entering Decorate mode isn't just a pause -- workbench.css narrows .wb-island's max
          // width at the same time, so the ResizeObserver below fires right along with it. Canvas
          // resizing always clears its pixel buffer (that's guaranteed HTML5 canvas behavior, not
          // implementation-defined like WebGL's drawing-buffer preservation), and with the render
          // loop already asleep nothing redraws it afterward -- reproduced directly: the canvas
          // went solid black the instant Decorate mode's CSS resize landed. Skip applying the
          // resize while paused; syncPauseState's own wake branch already calls resizeGame() right
          // after game.loop.wake(), so the pending size difference gets picked up and applied then,
          // once there's a running loop again to redraw the new dimensions.
          if (pausedRef.current || document.hidden || !visibleRef.current) return
          const width = Math.max(1, Math.round(containerRef.current.clientWidth))
          const height = Math.max(1, Math.round(containerRef.current.clientHeight || width * WORLD_HEIGHT / WORLD_WIDTH))
          const previous = lastCanvasSizeRef.current
          if (previous.width === width && previous.height === height) return
          lastCanvasSizeRef.current = { width, height }
          game.scale.resize(width, height)
        })
      }
      resizeGame()
      if(typeof ResizeObserver!=='undefined'){resizeObserver = new ResizeObserver(resizeGame);resizeObserver.observe(containerRef.current)}
      else {window.addEventListener('resize',resizeGame);removeResizeFallback=()=>window.removeEventListener('resize',resizeGame)}

      syncPauseState = () => {
        if (!game) return
        const shouldPause = document.hidden || !visibleRef.current || pausedRef.current
        if (shouldPause) {
          game.loop.sleep()
        } else {
          game.loop.wake()
          resizeGame()
        }
      }
      syncPauseStateRef.current = syncPauseState
      // Deferred rather than called synchronously here: if Decorate mode (or an already-hidden
      // tab) makes this pause on mount, Phaser's own boot sequence hasn't necessarily run its
      // first render/clear-to-backgroundColor yet -- game.loop.sleep() before that point freezes
      // the canvas in its raw, unpainted state (solid black) instead of the intended frozen frame.
      // Two rAF ticks are enough for Phaser's internal loop (itself rAF-driven) to have painted at
      // least once, regardless of whether the rest of the scene's assets have finished loading.
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => { if (!disposed) syncPauseState?.() }))
      if(typeof IntersectionObserver!=='undefined'){visibilityObserver = new IntersectionObserver(([entry]) => {
        visibleRef.current = entry?.isIntersecting ?? true
        syncPauseState?.()
      }, { rootMargin: '120px', threshold: 0.01 })
      visibilityObserver.observe(containerRef.current)}
      document.addEventListener('visibilitychange', syncPauseState)

      fpsTimer = window.setInterval(() => {
        if (game && debugEnabledRef.current && visibleRef.current && !document.hidden) {
          setDebugFps(Math.round(game.loop.actualFps || 0))
        }
      }, 750)

      if (disposed) {
        if (syncPauseState) document.removeEventListener('visibilitychange', syncPauseState)
        game.events.off<SanctuaryState>(SANCTUARY_EVENTS.state, handleState)
        game.events.off<EvolutionMilestonePayload>(SANCTUARY_EVENTS.evolution, handleEvolutionMilestone)
        game.events.off<KonoInteractionPayload>(SANCTUARY_EVENTS.interaction, handleKonoInteraction)
        detachEvents();destroyGame(game)
      }
    }

    void boot().catch(()=>{if(!disposed)setLoadStatus({status:'error',boot:true})})

    return () => {
      disposed = true
      resizeObserver?.disconnect()
      removeResizeFallback()
      visibilityObserver?.disconnect()
      if (syncPauseState) document.removeEventListener('visibilitychange', syncPauseState)
      if (fpsTimer) window.clearInterval(fpsTimer)
      if (evolutionNoticeTimerRef.current) window.clearTimeout(evolutionNoticeTimerRef.current)
      if (interactionNoticeTimerRef.current) window.clearTimeout(interactionNoticeTimerRef.current)
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame)
      const currentGame = gameRef.current
      if (currentGame) {
        gameRef.current = null
        detachEvents();destroyGame(currentGame)
      }
    }
  }, [attempt])

  useEffect(() => {
    gameRef.current?.registry.set('sanctuaryPhase', phase)
    gameRef.current?.events.emit(SANCTUARY_EVENTS.phase, phase)
  }, [phase])

  useEffect(() => {
    gameRef.current?.registry.set('sanctuaryWeather', weather)
    gameRef.current?.events.emit(SANCTUARY_EVENTS.weather, weather)
  }, [weather])

  useEffect(() => {
    gameRef.current?.registry.set('sanctuaryReducedMotion', reducedMotion)
    gameRef.current?.events.emit(SANCTUARY_EVENTS.motion, reducedMotion)
  }, [reducedMotion])

  useEffect(() => {
    gameRef.current?.registry.set('sanctuaryProgress', progress)
    gameRef.current?.events.emit(SANCTUARY_EVENTS.progress, progress)
  }, [progress])

  useEffect(() => {
    gameRef.current?.registry.set('sanctuaryDecorations', decorations)
    gameRef.current?.events.emit(SANCTUARY_EVENTS.decor, decorations)
  }, [decorations])

  useEffect(() => {
    if (celebrateSignal == null) return
    gameRef.current?.events.emit(SANCTUARY_EVENTS.celebrate, celebrateSignal)
  }, [celebrateSignal])

  useEffect(() => {
    gameRef.current?.events.emit(SANCTUARY_EVENTS.focusCompanion, Boolean(focusCompanionActive))
  }, [focusCompanionActive])

  const updateDebugTime = (minutes: number) => {
    setDebugMinutes(minutes)
    gameRef.current?.events.emit(SANCTUARY_EVENTS.debugTime, minutes)
  }

  const clearDebugTime = () => gameRef.current?.events.emit(SANCTUARY_EVENTS.debugTime, null)

  const updateDebugWeather = (nextWeather: SanctuaryWeather) => {
    setWeatherOverride({base:weather,value:nextWeather})
    gameRef.current?.events.emit(SANCTUARY_EVENTS.weather, nextWeather)
  }

  const updateWeatherTuning = (patch: Partial<WeatherTuning>) => {
    const next = { ...debugWeatherTuning, ...patch }
    setDebugWeatherTuning(next)
    gameRef.current?.events.emit(SANCTUARY_EVENTS.weatherTuning, next)
  }

  const updateDebugQuality = (quality: SanctuaryQuality) => {
    setDebugQuality(quality)
    gameRef.current?.events.emit(SANCTUARY_EVENTS.quality, quality)
  }

  const updateDebugDensity = (density: number) => {
    setDebugDensity(density)
    gameRef.current?.events.emit(SANCTUARY_EVENTS.density, density)
  }

  const updateFluidSpeed = (speed: number) => {
    setDebugFluidSpeed(speed)
    gameRef.current?.events.emit(SANCTUARY_EVENTS.fluidSpeed, speed)
  }

  const updateFluidEnabled = (enabled: boolean) => {
    setDebugFluidEnabled(enabled)
    gameRef.current?.events.emit(SANCTUARY_EVENTS.fluidEnabled, enabled)
  }

  return <article className="sanctuary-card" aria-label="KONO Living Sanctuary">
    <div ref={containerRef} className="sanctuary-viewport" role="img" aria-label={`${state.phaseLabel} sanctuary, ${state.weatherLabel.toLowerCase()} weather`} style={loadStatus.status!=='ready'?{backgroundImage:`url(/garden/terrace-23.0/${phase==='auto'?autoPhase:phase}.webp)`}:undefined} />
    {loadStatus.status!=='ready'&&<div className="sanctuary-load-status" role="status">{loadStatus.status==='error'?'Some Sanctuary artwork could not load. Your plan is safe.':`Opening ${loadStatus.phase??'your'} Sanctuary…`}{loadStatus.status==='error'&&<button onClick={()=>{setLoadStatus({status:'loading'});if(loadStatus.boot)setAttempt(a=>a+1);else gameRef.current?.events.emit(SANCTUARY_EVENTS.retry,null)}}>Retry artwork</button>}</div>}
    {evolutionNotice && <div className={`sanctuary-evolution-toast feature-${evolutionNotice.feature}`} role="status" aria-live="polite"><span>Sanctuary evolved</span><strong>{evolutionNotice.featureLabel}</strong><em>Stage {evolutionNotice.nextStage} · {evolutionNotice.stageName}</em></div>}
    {interactionNotice && <div className="sanctuary-interaction-toast" role="status" aria-live="polite"><span>KONO</span><strong>{interactionNotice.action.title}</strong><em>{interactionNotice.action.hint}</em></div>}
    <div className="sanctuary-world-status" aria-live="polite">
      <i aria-hidden="true" />
      <span>{state.mode === 'auto' ? 'Live world' : 'Preview'}</span>
      <b>{state.phaseLabel}</b>
      <em>{state.weatherLabel}</em>
    </div>
    {debugEnabled && <aside className="sanctuary-debug-panel">
      <header>
        <strong>World debug</strong>
        <span>{APP_VERSION} · {debugFps || '—'} FPS</span>
        <button type="button" className="debug-close" aria-label="Close world debug panel" onClick={() => setDebugEnabled(false)}>×</button>
      </header>
      <label>Time <b>{formatDebugTime(debugMinutes)}</b><input type="range" min="0" max="1439" step="5" value={debugMinutes} onChange={(event) => updateDebugTime(Number(event.target.value))} /></label>
      <div className="debug-readout"><span>{state.phaseLabel} → {state.nextPhaseLabel}</span><b>{Math.round(state.transition * 100)}%</b></div>
      <div className="debug-readout"><span>Ambient light</span><b>{Math.round(state.ambientLight * 100)}%</b></div>
      <div className="debug-readout"><span>Lanterns</span><b>{Math.round(state.lanternStrength * 100)}%</b></div>
      <div className="debug-readout"><span>Stars</span><b>{Math.round(state.starVisibility * 100)}%</b></div>
      <div className="debug-readout"><span>Haze</span><b>{Math.round(state.haze * 100)}%</b></div>
      <div className="debug-readout"><span>Evolution stage</span><b>{progress.unlockedStage} · ready {progress.readyStage}</b></div>
      <div className="debug-readout"><span>Task credits</span><b>{progress.totalCredits}{progress.nextStageAt===null?' · max':` / ${progress.nextStageAt}`}</b></div>
      <div className="debug-readout"><span>Pond · science credits</span><b>{progress.featureStages.pond ?? 0} · {progress.creditsBySubjectKey?.science ?? 0}{progress.nextFeatureAt?.pond===null?' · max':` / ${progress.nextFeatureAt?.pond ?? 1}`}</b></div>
      <div className="debug-readout"><span>Home evolution</span><b>Stage {progress.featureStages.home ?? 0}</b></div>
      <div className="debug-readout"><span>Lanterns · productive days</span><b>{progress.featureStages.lanterns ?? 0} · {Object.keys(progress.completionDates).length}{progress.nextFeatureAt?.lanterns===null?' · max':` / ${progress.nextFeatureAt?.lanterns ?? 1}`}</b></div>
      <div className="debug-readout"><span>Garden · task credits</span><b>{progress.featureStages.garden ?? 0} · {progress.totalCredits}{progress.nextFeatureAt?.garden===null?' · max':` / ${progress.nextFeatureAt?.garden ?? 4}`}</b></div>
      <div className="debug-readout"><span>Critter habitat</span><b>Garden {progress.featureStages.garden ?? 0} · Pond {progress.featureStages.pond ?? 0}</b></div>
      <button type="button" onClick={clearDebugTime}>Use real time · {formatDebugTime(state.simulationMinutes)}</button>
      <label>Weather<select value={debugWeather} onChange={(event) => updateDebugWeather(event.target.value as SanctuaryWeather)}><option value="clear">Clear</option><option value="cloudy">Cloudy</option><option value="rain">Rain</option><option value="wind">Breezy</option><option value="snow">Snow</option></select></label>
      <div className="debug-readout"><span>Weather transition</span><b>{Math.round(state.weatherTransition * 100)}%</b></div>
      <div className="debug-readout"><span>Clouds · Wind</span><b>{Math.round(state.cloudCover * 100)}% · {Math.round(state.windStrength * 100)}%</b></div>
      <div className="debug-readout"><span>Precipitation · Water</span><b>{Math.round(state.precipitation * 100)}% · {Math.round(state.waterEnergy * 100)}%</b></div>
      <details className="debug-weather-details">
        <summary>Weather simulation</summary>
        <div className="debug-weather-grid">
          <label>Transition speed <b>{debugWeatherTuning.transitionSpeed.toFixed(2)}×</b><input type="range" min="0.25" max="4" step="0.25" value={debugWeatherTuning.transitionSpeed} onChange={(event) => updateWeatherTuning({ transitionSpeed: Number(event.target.value) })} /></label>
          <label className="debug-toggle"><span>Instant state</span><input type="checkbox" checked={debugWeatherTuning.instant} onChange={(event) => updateWeatherTuning({ instant: event.target.checked })} /></label>
          <label>Cloud target<select value={debugWeatherTuning.cloudTarget ?? 'auto'} onChange={(event) => updateWeatherTuning({ cloudTarget: event.target.value === 'auto' ? null : Number(event.target.value) })}><option value="auto">Auto</option><option value="0">0%</option><option value="0.25">25%</option><option value="0.5">50%</option><option value="0.75">75%</option><option value="1">100%</option></select></label>
          <label>Wind target<select value={debugWeatherTuning.windTarget ?? 'auto'} onChange={(event) => updateWeatherTuning({ windTarget: event.target.value === 'auto' ? null : Number(event.target.value) })}><option value="auto">Auto</option><option value="0">Calm</option><option value="0.25">25%</option><option value="0.5">50%</option><option value="0.75">75%</option><option value="1">100%</option></select></label>
          <label>Rain / snow<select value={debugWeatherTuning.intensityTarget ?? 'auto'} onChange={(event) => updateWeatherTuning({ intensityTarget: event.target.value === 'auto' ? null : Number(event.target.value) })}><option value="auto">Auto</option><option value="0.25">25%</option><option value="0.5">50%</option><option value="0.75">75%</option><option value="1">100%</option></select></label>
          <label>Water response <b>{debugWeatherTuning.waterResponse.toFixed(2)}×</b><input type="range" min="0.5" max="2" step="0.25" value={debugWeatherTuning.waterResponse} onChange={(event) => updateWeatherTuning({ waterResponse: Number(event.target.value) })} /></label>
        </div>
      </details>
      <label>Quality<select value={debugQuality} onChange={(event) => updateDebugQuality(event.target.value as SanctuaryQuality)}><option value="auto">Auto</option><option value="high">High</option><option value="balanced">Balanced</option><option value="low">Low</option></select></label>
      <label>Weather + ambience <b>{debugDensity.toFixed(1)}×</b><input type="range" min="0.25" max="2" step="0.25" value={debugDensity} onChange={(event) => updateDebugDensity(Number(event.target.value))} /></label>
      <label>Fluid speed <b>{debugFluidSpeed.toFixed(2)}×</b><input type="range" min="0.25" max="2.5" step="0.25" value={debugFluidSpeed} onChange={(event) => updateFluidSpeed(Number(event.target.value))} /></label>
      <label className="debug-toggle"><span>Production fluid layers</span><input type="checkbox" checked={debugFluidEnabled} onChange={(event) => updateFluidEnabled(event.target.checked)} /></label>
      <small>Press F8 to show or hide this panel.</small>
    </aside>}
  </article>
}
