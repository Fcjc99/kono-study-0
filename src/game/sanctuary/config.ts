import type { DayPhase, SanctuaryWeather } from './types'

export const WORLD_WIDTH = 1448
export const WORLD_HEIGHT = 1086

export const PHASES: DayPhase[] = ['morning', 'afternoon', 'evening', 'night']

export const PHASE_LABELS: Record<DayPhase, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  night: 'Night',
}

export const PHASE_TEXTURES: Record<DayPhase, string> = {
  morning: 'stage0-morning',
  afternoon: 'stage0-afternoon',
  evening: 'stage0-evening',
  night: 'stage0-night',
}

export const WEATHER_LABELS: Record<SanctuaryWeather, string> = {
  clear: 'Clear',
  cloudy: 'Cloudy',
  rain: 'Rain',
  wind: 'Breezy',
  snow: 'Snow',
}

export const LANTERN_ANCHORS = [
  { x: 0.170, y: 0.466, scale: 0.62 },
  { x: 0.220, y: 0.478, scale: 0.78 },
  { x: 0.690, y: 0.382, scale: 0.38 },
  { x: 0.724, y: 0.402, scale: 0.32 },
  { x: 0.756, y: 0.407, scale: 0.30 },
  { x: 0.790, y: 0.400, scale: 0.32 },
  { x: 0.824, y: 0.416, scale: 0.28 },
]

export const DEW_ANCHORS = [
  { x: 0.452, y: 0.645 },
  { x: 0.516, y: 0.664 },
  { x: 0.570, y: 0.646 },
  { x: 0.196, y: 0.607 },
]

export const POND_RIPPLE_ANCHORS = [
  { x: 0.485, y: 0.675 },
  { x: 0.512, y: 0.680 },
  { x: 0.538, y: 0.686 },
  { x: 0.558, y: 0.660 },
  { x: 0.468, y: 0.653 },
]
