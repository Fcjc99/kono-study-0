import type { WeatherSnapshot } from '../engine/WeatherManager'
import type { DaylightState } from './timeEngine'
import type { DayPhase, SanctuaryQuality, SanctuaryWeather } from './types'

export interface EnvironmentSnapshot {
  phase: DayPhase
  weather: SanctuaryWeather
  previousWeather: SanctuaryWeather
  weatherBlend: number
  weatherTransition: number
  wind: number
  windTarget: number
  waterEnergy: number
  waterResponse: number
  cloudCover: number
  precipitation: number
  rainIntensity: number
  snowIntensity: number
  leafIntensity: number
  quality: Exclude<SanctuaryQuality, 'auto'>
  minutes: number
  nextPhase: DayPhase
  phaseTransition: number
  ambientLight: number
  darkness: number
  warmth: number
  coolness: number
  lanternStrength: number
  starVisibility: number
  haze: number
  waterHighlight: number
  cloudBrightness: number
  weatherShade: number
}

const AFTERNOON_DAYLIGHT: DaylightState = {
  minutes: 14 * 60,
  from: 'afternoon',
  to: 'afternoon',
  amount: 0,
  dominant: 'afternoon',
  nextPhase: 'evening',
  ambientLight: 1,
  darkness: 0,
  warmth: 0.03,
  coolness: 0,
  lanternStrength: 0,
  starVisibility: 0,
  haze: 0.025,
  waterHighlight: 1,
  cloudBrightness: 1,
}

const CLEAR_WEATHER: WeatherSnapshot = {
  weather: 'clear',
  previousWeather: 'clear',
  transition: 1,
  cloudCover: 0.08,
  rainIntensity: 0,
  snowIntensity: 0,
  precipitation: 0,
  leafIntensity: 0,
  wind: 0.12,
  windTarget: 0.12,
  shade: 0,
  haze: 0,
  coolness: 0,
  waterResponse: 0,
}

const buildSnapshot = (
  phase: DayPhase,
  quality: Exclude<SanctuaryQuality, 'auto'>,
  daylight: DaylightState,
  weather: WeatherSnapshot,
): EnvironmentSnapshot => {
  const waterEnergy = Math.max(0.05, Math.min(1, 0.18 + weather.wind * 0.48 + weather.waterResponse))
  const weatherDarkening = weather.shade
  return {
    phase,
    weather: weather.weather,
    previousWeather: weather.previousWeather,
    weatherBlend: weather.transition,
    weatherTransition: weather.transition,
    wind: weather.wind,
    windTarget: weather.windTarget,
    waterEnergy,
    waterResponse: weather.waterResponse,
    cloudCover: weather.cloudCover,
    precipitation: weather.precipitation,
    rainIntensity: weather.rainIntensity,
    snowIntensity: weather.snowIntensity,
    leafIntensity: weather.leafIntensity,
    quality,
    minutes: daylight.minutes,
    nextPhase: daylight.nextPhase,
    phaseTransition: daylight.amount,
    ambientLight: Math.max(0, daylight.ambientLight - weatherDarkening),
    darkness: Math.min(1, daylight.darkness + weatherDarkening),
    warmth: daylight.warmth * (1 - weatherDarkening * 1.5),
    coolness: Math.min(1, daylight.coolness + weather.coolness + weatherDarkening * 0.35),
    lanternStrength: Math.min(1, daylight.lanternStrength + weatherDarkening * 0.34),
    starVisibility: daylight.starVisibility,
    haze: Math.min(1, daylight.haze + weather.haze),
    waterHighlight: Math.max(0.18, daylight.waterHighlight - weatherDarkening * 1.8),
    cloudBrightness: Math.max(0.35, daylight.cloudBrightness - weatherDarkening * 1.2),
    weatherShade: weather.shade,
  }
}

export class EnvironmentManager {
  private phase: DayPhase = 'afternoon'
  private quality: Exclude<SanctuaryQuality, 'auto'> = 'high'
  private daylight: DaylightState = { ...AFTERNOON_DAYLIGHT }
  private lastSnapshot: EnvironmentSnapshot = buildSnapshot('afternoon', 'high', AFTERNOON_DAYLIGHT, CLEAR_WEATHER)

  setPhase(phase: DayPhase): void {
    this.phase = phase
  }

  setDaylight(daylight: DaylightState): void {
    this.daylight = { ...daylight }
    this.phase = daylight.dominant
  }

  setQuality(quality: Exclude<SanctuaryQuality, 'auto'>): void {
    this.quality = quality
  }

  update(_dt: number, weather: WeatherSnapshot): EnvironmentSnapshot {
    this.lastSnapshot = buildSnapshot(this.phase, this.quality, this.daylight, weather)
    return { ...this.lastSnapshot }
  }

  snapshot(): EnvironmentSnapshot {
    return { ...this.lastSnapshot }
  }
}
