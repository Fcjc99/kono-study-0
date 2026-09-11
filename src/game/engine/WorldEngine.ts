import { EnvironmentManager, type EnvironmentSnapshot } from '../sanctuary/environmentManager'
import type { DaylightState } from '../sanctuary/timeEngine'
import type { DayPhase, SanctuaryQuality, SanctuaryWeather } from '../sanctuary/types'
import { PerformanceManager } from './PerformanceManager'
import { SimulationClock } from './SimulationClock'
import { WeatherManager, type WeatherTuning } from './WeatherManager'

export interface WorldFrame {
  elapsed: number
  environment: EnvironmentSnapshot
}

export class WorldEngine {
  readonly environment = new EnvironmentManager()
  readonly performance = new PerformanceManager()
  readonly clock = new SimulationClock()
  readonly weather = new WeatherManager()

  setPhase(phase: DayPhase): void {
    this.environment.setPhase(phase)
  }

  setDaylight(daylight: DaylightState): void {
    this.environment.setDaylight(daylight)
  }

  setWeather(weather: SanctuaryWeather, immediate = false): void {
    this.weather.setWeather(weather, immediate)
  }

  setWeatherTuning(tuning: Partial<WeatherTuning>): void {
    this.weather.setTuning(tuning)
  }

  setQuality(quality: SanctuaryQuality, width: number): void {
    this.performance.setQuality(quality)
    this.environment.setQuality(this.performance.resolve(width))
  }

  update(deltaSeconds: number): WorldFrame {
    const weather = this.weather.update(deltaSeconds)
    return {
      elapsed: this.clock.update(deltaSeconds),
      environment: this.environment.update(deltaSeconds, weather),
    }
  }
}
