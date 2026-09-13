import type { PhaseMode, SanctuaryQuality, SanctuaryRuntimeSettings, SanctuaryWeather } from './types'

export const SANCTUARY_EVENTS = {
  load: 'sanctuary:load-status',
  retry: 'sanctuary:load-retry',
  action: 'sanctuary:request-action',
  phase: 'sanctuary:set-phase',
  weather: 'sanctuary:set-weather',
  weatherTuning: 'sanctuary:set-weather-tuning',
  motion: 'sanctuary:set-motion',
  density: 'sanctuary:set-density',
  debugTime: 'sanctuary:set-debug-time',
  quality: 'sanctuary:set-quality',
  fluidSpeed: 'sanctuary:set-fluid-speed',
  fluidEnabled: 'sanctuary:set-fluid-enabled',
  progress: 'sanctuary:set-progress',
  homeStyle: 'sanctuary:set-home-style',
  pondStyle: 'sanctuary:set-pond-style',
  evolution: 'sanctuary:evolution-milestone',
  fishing: 'sanctuary:fishing-event',
  interaction: 'sanctuary:kono-interaction',
  state: 'sanctuary:state',
} as const

export const DEFAULT_SANCTUARY_SETTINGS: SanctuaryRuntimeSettings = {
  phaseMode: 'auto',
  weather: 'clear',
  reducedMotion: false,
  ambientDensity: 1,
  debugMinutes: null,
  quality: 'auto',
}

export const isPhaseMode = (value: unknown): value is PhaseMode =>
  value === 'auto' || value === 'morning' || value === 'afternoon' || value === 'evening' || value === 'night'

export const isSanctuaryWeather = (value: unknown): value is SanctuaryWeather =>
  value === 'clear' || value === 'cloudy' || value === 'rain' || value === 'wind' || value === 'snow'

export const isSanctuaryQuality = (value: unknown): value is SanctuaryQuality =>
  value === 'auto' || value === 'high' || value === 'balanced' || value === 'low'
