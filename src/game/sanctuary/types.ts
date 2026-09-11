export type DayPhase = 'morning' | 'afternoon' | 'evening' | 'night'
export type PhaseMode = 'auto' | DayPhase
export type SanctuaryWeather = 'clear' | 'cloudy' | 'rain' | 'wind' | 'snow'
export type SanctuaryQuality = 'auto' | 'high' | 'balanced' | 'low'

export interface PhaseBlend {
  from: DayPhase
  to: DayPhase
  amount: number
  dominant: DayPhase
}

export interface SanctuaryRuntimeSettings {
  phaseMode: PhaseMode
  weather: SanctuaryWeather
  reducedMotion: boolean
  ambientDensity: number
  debugMinutes: number | null
  quality: SanctuaryQuality
}
