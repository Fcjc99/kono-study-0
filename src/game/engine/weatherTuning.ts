// The weather tuning shape and its defaults, apart from WeatherManager so the island card can use
// them without pulling the whole weather engine into the startup script.
export interface WeatherTuning {
  transitionSpeed: number
  cloudTarget: number | null
  windTarget: number | null
  intensityTarget: number | null
  waterResponse: number
  instant: boolean
}

export const DEFAULT_WEATHER_TUNING: WeatherTuning = {
  transitionSpeed: 1,
  cloudTarget: null,
  windTarget: null,
  intensityTarget: null,
  waterResponse: 1,
  instant: false,
}
