import type { SanctuaryWeather } from '../sanctuary/types'

export interface WeatherTuning {
  transitionSpeed: number
  cloudTarget: number | null
  windTarget: number | null
  intensityTarget: number | null
  waterResponse: number
  instant: boolean
}

export interface WeatherSnapshot {
  weather: SanctuaryWeather
  previousWeather: SanctuaryWeather
  transition: number
  cloudCover: number
  rainIntensity: number
  snowIntensity: number
  precipitation: number
  leafIntensity: number
  wind: number
  windTarget: number
  shade: number
  haze: number
  coolness: number
  waterResponse: number
}

interface WeatherProfile {
  cloudCover: number
  rainIntensity: number
  snowIntensity: number
  leafIntensity: number
  wind: number
  shade: number
  haze: number
  coolness: number
  waterResponse: number
}

const WEATHER_PROFILES: Record<SanctuaryWeather, WeatherProfile> = {
  clear: {
    cloudCover: 0.08,
    rainIntensity: 0,
    snowIntensity: 0,
    leafIntensity: 0,
    wind: 0.12,
    shade: 0,
    haze: 0,
    coolness: 0,
    waterResponse: 0,
  },
  cloudy: {
    cloudCover: 0.78,
    rainIntensity: 0,
    snowIntensity: 0,
    leafIntensity: 0,
    wind: 0.22,
    shade: 0.065,
    haze: 0.035,
    coolness: 0.025,
    waterResponse: 0.045,
  },
  rain: {
    cloudCover: 0.96,
    rainIntensity: 1,
    snowIntensity: 0,
    leafIntensity: 0,
    wind: 0.34,
    shade: 0.135,
    haze: 0.09,
    coolness: 0.085,
    waterResponse: 0.34,
  },
  wind: {
    cloudCover: 0.24,
    rainIntensity: 0,
    snowIntensity: 0,
    leafIntensity: 1,
    wind: 0.62,
    shade: 0.018,
    haze: 0.012,
    coolness: 0,
    waterResponse: 0.19,
  },
  snow: {
    cloudCover: 0.74,
    rainIntensity: 0,
    snowIntensity: 1,
    leafIntensity: 0,
    wind: 0.20,
    shade: 0.075,
    haze: 0.075,
    coolness: 0.17,
    waterResponse: -0.08,
  },
}

export const DEFAULT_WEATHER_TUNING: WeatherTuning = {
  transitionSpeed: 1,
  cloudTarget: null,
  windTarget: null,
  intensityTarget: null,
  waterResponse: 1,
  instant: false,
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value))
const lerp = (from: number, to: number, amount: number): number => from + (to - from) * amount
const smoothWindow = (progress: number, start: number, end: number): number => {
  if (end <= start) return progress >= end ? 1 : 0
  const t = clamp01((progress - start) / (end - start))
  return t * t * (3 - 2 * t)
}
const approach = (current: number, target: number, speed: number, dt: number): number => {
  const amount = 1 - Math.exp(-Math.max(0, speed) * Math.max(0, dt))
  return current + (target - current) * amount
}
const copyProfile = (profile: WeatherProfile): WeatherProfile => ({ ...profile })

export class WeatherManager {
  private weather: SanctuaryWeather = 'clear'
  private previousWeather: SanctuaryWeather = 'clear'
  private progress = 1
  private start = copyProfile(WEATHER_PROFILES.clear)
  private current = copyProfile(WEATHER_PROFILES.clear)
  private target = copyProfile(WEATHER_PROFILES.clear)
  private tuning: WeatherTuning = { ...DEFAULT_WEATHER_TUNING }
  private gust = 0
  private gustTarget = 0
  private gustTimer = 0
  private lastSnapshot: WeatherSnapshot = {
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

  setWeather(weather: SanctuaryWeather, immediate = false): void {
    if (weather === this.weather && !immediate) return
    this.previousWeather = this.weather
    this.weather = weather
    this.start = copyProfile(this.current)
    this.target = this.profileFor(weather)
    this.progress = immediate || this.tuning.instant ? 1 : 0
    if (this.progress >= 1) this.current = copyProfile(this.target)
  }

  setTuning(tuning: Partial<WeatherTuning>): void {
    const previous = this.tuning
    this.tuning = {
      transitionSpeed: Math.max(0.25, Math.min(4, tuning.transitionSpeed ?? previous.transitionSpeed)),
      cloudTarget: tuning.cloudTarget === undefined ? previous.cloudTarget : tuning.cloudTarget,
      windTarget: tuning.windTarget === undefined ? previous.windTarget : tuning.windTarget,
      intensityTarget: tuning.intensityTarget === undefined ? previous.intensityTarget : tuning.intensityTarget,
      waterResponse: Math.max(0.5, Math.min(2, tuning.waterResponse ?? previous.waterResponse)),
      instant: tuning.instant ?? previous.instant,
    }

    this.start = copyProfile(this.current)
    this.target = this.profileFor(this.weather)
    if (this.tuning.instant) {
      this.progress = 1
      this.current = copyProfile(this.target)
    } else if (
      previous.cloudTarget !== this.tuning.cloudTarget
      || previous.windTarget !== this.tuning.windTarget
      || previous.intensityTarget !== this.tuning.intensityTarget
      || previous.waterResponse !== this.tuning.waterResponse
    ) {
      this.progress = 0
    }
  }

  update(dt: number): WeatherSnapshot {
    if (this.progress < 1) {
      const duration = 18 / this.tuning.transitionSpeed
      this.progress = clamp01(this.progress + Math.max(0, dt) / Math.max(1.5, duration))
      this.current = this.interpolateProfile(this.start, this.target, this.progress)
    } else {
      this.current = copyProfile(this.target)
    }

    this.updateGust(dt)
    const wind = clamp01(this.current.wind + this.gust)
    const precipitation = clamp01(Math.max(this.current.rainIntensity, this.current.snowIntensity))
    this.lastSnapshot = {
      weather: this.weather,
      previousWeather: this.previousWeather,
      transition: this.progress,
      cloudCover: clamp01(this.current.cloudCover),
      rainIntensity: clamp01(this.current.rainIntensity),
      snowIntensity: clamp01(this.current.snowIntensity),
      precipitation,
      leafIntensity: clamp01(this.current.leafIntensity),
      wind,
      windTarget: clamp01(this.current.wind),
      shade: clamp01(this.current.shade),
      haze: clamp01(this.current.haze),
      coolness: clamp01(this.current.coolness),
      waterResponse: Math.max(-0.1, Math.min(0.75, this.current.waterResponse)),
    }
    return { ...this.lastSnapshot }
  }

  snapshot(): WeatherSnapshot {
    return { ...this.lastSnapshot }
  }

  private profileFor(weather: SanctuaryWeather): WeatherProfile {
    const profile = copyProfile(WEATHER_PROFILES[weather])
    if (this.tuning.cloudTarget !== null) profile.cloudCover = clamp01(this.tuning.cloudTarget)
    if (this.tuning.windTarget !== null) profile.wind = clamp01(this.tuning.windTarget)
    if (this.tuning.intensityTarget !== null) {
      if (weather === 'rain') profile.rainIntensity = clamp01(this.tuning.intensityTarget)
      if (weather === 'snow') profile.snowIntensity = clamp01(this.tuning.intensityTarget)
    }
    profile.waterResponse *= this.tuning.waterResponse
    return profile
  }

  private interpolateProfile(from: WeatherProfile, to: WeatherProfile, progress: number): WeatherProfile {
    const cloudProgress = to.cloudCover >= from.cloudCover
      ? smoothWindow(progress, 0, 0.66)
      : smoothWindow(progress, 0.30, 1)
    const windProgress = to.wind >= from.wind
      ? smoothWindow(progress, 0, 0.46)
      : smoothWindow(progress, 0, 0.72)
    const rainProgress = to.rainIntensity >= from.rainIntensity
      ? smoothWindow(progress, 0.22, 1)
      : smoothWindow(progress, 0, 0.50)
    const snowProgress = to.snowIntensity >= from.snowIntensity
      ? smoothWindow(progress, 0.18, 1)
      : smoothWindow(progress, 0, 0.52)
    const leafProgress = to.leafIntensity >= from.leafIntensity
      ? smoothWindow(progress, 0.05, 0.70)
      : smoothWindow(progress, 0, 0.68)
    const atmosphereProgress = Math.max(cloudProgress, rainProgress * 0.88, snowProgress * 0.82)
    const waterProgress = to.waterResponse >= from.waterResponse
      ? smoothWindow(progress, 0.16, 1)
      : smoothWindow(progress, 0.34, 1)

    return {
      cloudCover: lerp(from.cloudCover, to.cloudCover, cloudProgress),
      rainIntensity: lerp(from.rainIntensity, to.rainIntensity, rainProgress),
      snowIntensity: lerp(from.snowIntensity, to.snowIntensity, snowProgress),
      leafIntensity: lerp(from.leafIntensity, to.leafIntensity, leafProgress),
      wind: lerp(from.wind, to.wind, windProgress),
      shade: lerp(from.shade, to.shade, atmosphereProgress),
      haze: lerp(from.haze, to.haze, atmosphereProgress),
      coolness: lerp(from.coolness, to.coolness, atmosphereProgress),
      waterResponse: lerp(from.waterResponse, to.waterResponse, waterProgress),
    }
  }

  private updateGust(dt: number): void {
    this.gustTimer -= dt
    if (this.gustTimer <= 0) {
      const windy = this.weather === 'wind'
      const rainy = this.current.rainIntensity > 0.1
      const amplitude = windy ? 0.28 : rainy ? 0.09 : 0.045
      this.gustTarget = Math.random() * amplitude
      this.gustTimer = windy ? 1.8 + Math.random() * 2.8 : 4.2 + Math.random() * 5.8
    }
    const response = this.weather === 'wind' ? 0.85 : 0.45
    this.gust = approach(this.gust, this.gustTarget, response, dt)
    if (this.gust > this.gustTarget * 0.98) this.gustTarget *= 0.35
  }
}
