import type { SanctuaryWeather } from '../sanctuary/types'

export type WeatherMode = 'live' | 'manual' | 'clear'
export type LiveWeatherSource = 'live' | 'cache' | 'manual' | 'clear' | 'loading' | 'error'

export interface LiveWeatherReading {
  weather: SanctuaryWeather
  locationQuery: string
  locationName: string
  region: string
  country: string
  temperatureF: number
  condition: string
  cloudCover: number
  windMph: number
  windGustMph: number
  precipitationIn: number
  weatherCode: number
  observedAt: string
  fetchedAt: string
}

export interface LiveWeatherState {
  weather: SanctuaryWeather
  source: LiveWeatherSource
  reading: LiveWeatherReading | null
  error: string | null
}

interface GeocodingResult {
  name?: string
  latitude?: number
  longitude?: number
  admin1?: string
  country?: string
  country_code?: string
  postcodes?: string[]
}

interface GeocodingResponse { results?: GeocodingResult[] }
interface ForecastCurrent {
  time?: string
  temperature_2m?: number
  precipitation?: number
  rain?: number
  showers?: number
  snowfall?: number
  weather_code?: number
  cloud_cover?: number
  wind_speed_10m?: number
  wind_gusts_10m?: number
}
interface ForecastResponse { current?: ForecastCurrent }

const WEATHER_CACHE_PREFIX = 'kono-live-weather-v2:'
const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000

export const normalizeZipCode = (value: string): string => value.replace(/\D/g, '').slice(0, 5)
export const isValidZipCode = (value: string): boolean => /^\d{5}$/.test(normalizeZipCode(value))
export const normalizeWeatherLocation = (value: string): string => value.replace(/\s+/g, ' ').trim().slice(0, 100)
export const isValidWeatherLocation = (value: string): boolean => normalizeWeatherLocation(value).length >= 2

const conditionLabel = (code: number): string => {
  if (code === 0) return 'Clear sky'
  if (code === 1) return 'Mostly clear'
  if (code === 2) return 'Partly cloudy'
  if (code === 3) return 'Overcast'
  if (code === 45 || code === 48) return 'Foggy'
  if (code >= 51 && code <= 57) return 'Drizzle'
  if (code >= 61 && code <= 67) return 'Rain'
  if (code >= 71 && code <= 77) return 'Snow'
  if (code >= 80 && code <= 82) return 'Rain showers'
  if (code >= 85 && code <= 86) return 'Snow showers'
  if (code >= 95) return 'Thunderstorms'
  return 'Current conditions'
}

const weatherFromConditions = (current: ForecastCurrent): SanctuaryWeather => {
  const code = Number(current.weather_code ?? 0)
  const snowfall = Number(current.snowfall ?? 0)
  const rain = Number(current.rain ?? 0) + Number(current.showers ?? 0) + Number(current.precipitation ?? 0)
  const wind = Number(current.wind_speed_10m ?? 0)
  const gust = Number(current.wind_gusts_10m ?? 0)
  const cloudCover = Number(current.cloud_cover ?? 0)
  if (snowfall > 0 || (code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return 'snow'
  if (rain > 0 || (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return 'rain'
  if (wind >= 18 || gust >= 28) return 'wind'
  if (cloudCover >= 50 || code === 2 || code === 3 || code === 45 || code === 48) return 'cloudy'
  return 'clear'
}

const fetchJson = async <T>(url: string, signal: AbortSignal): Promise<T> => {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`Weather service returned ${response.status}`)
  return response.json() as Promise<T>
}

const parseLocationQuery = (input: string) => {
  const query = normalizeWeatherLocation(input)
  const parts = query.split(',').map(part => part.trim()).filter(Boolean)
  const first = parts[0] ?? query
  const adminHint = parts[1]?.toLowerCase() ?? ''
  const countryHint = (parts.length ? parts[parts.length - 1] : '').toLowerCase()
  const numericZip = /^\d{5}$/.test(query)
  let countryCode = ''
  if (numericZip) countryCode = 'US'
  else if (countryHint === 'canada' || countryHint === 'ca') countryCode = 'CA'
  else if (countryHint === 'united states' || countryHint === 'usa' || countryHint === 'us') countryCode = 'US'
  return { query, searchName: numericZip ? query : first, adminHint, countryCode, numericZip }
}

const pickLocation = (results: GeocodingResult[], input: ReturnType<typeof parseLocationQuery>): GeocodingResult | null => {
  let candidates = results
  if (input.countryCode) candidates = candidates.filter(result => result.country_code === input.countryCode)
  if (input.numericZip) {
    const exact = candidates.find(result => result.postcodes?.includes(input.query))
    if (exact) return exact
  }
  if (input.adminHint) {
    const adminMatch = candidates.find(result => (result.admin1 ?? '').toLowerCase().includes(input.adminHint))
    if (adminMatch) return adminMatch
  }
  return candidates[0] ?? results[0] ?? null
}

export const fetchLiveWeather = async (locationInput: string, signal: AbortSignal): Promise<LiveWeatherReading> => {
  const parsed = parseLocationQuery(locationInput)
  if (!isValidWeatherLocation(parsed.query)) throw new Error('Enter a city, region, country, or 5-digit U.S. ZIP code')

  const geocodingUrl = new URL('https://geocoding-api.open-meteo.com/v1/search')
  geocodingUrl.searchParams.set('name', parsed.searchName)
  geocodingUrl.searchParams.set('count', '12')
  geocodingUrl.searchParams.set('language', 'en')
  geocodingUrl.searchParams.set('format', 'json')
  if (parsed.countryCode) geocodingUrl.searchParams.set('countryCode', parsed.countryCode)
  const geocoding = await fetchJson<GeocodingResponse>(geocodingUrl.toString(), signal)
  const location = pickLocation(geocoding.results ?? [], parsed)
  if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') throw new Error('Weather location could not be found')

  const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast')
  forecastUrl.searchParams.set('latitude', String(location.latitude))
  forecastUrl.searchParams.set('longitude', String(location.longitude))
  forecastUrl.searchParams.set('current', 'temperature_2m,precipitation,rain,showers,snowfall,weather_code,cloud_cover,wind_speed_10m,wind_gusts_10m')
  forecastUrl.searchParams.set('temperature_unit', 'fahrenheit')
  forecastUrl.searchParams.set('wind_speed_unit', 'mph')
  forecastUrl.searchParams.set('precipitation_unit', 'inch')
  forecastUrl.searchParams.set('timezone', 'auto')
  const forecast = await fetchJson<ForecastResponse>(forecastUrl.toString(), signal)
  if (!forecast.current) throw new Error('Current weather is unavailable')

  const current = forecast.current
  const fetchedAt = new Date().toISOString()
  return {
    weather: weatherFromConditions(current),
    locationQuery: parsed.query,
    locationName: location.name ?? parsed.searchName,
    region: location.admin1 ?? '',
    country: location.country ?? (location.country_code === 'CA' ? 'Canada' : location.country_code === 'US' ? 'United States' : ''),
    temperatureF: Math.round(Number(current.temperature_2m ?? 0)),
    condition: conditionLabel(Number(current.weather_code ?? 0)),
    cloudCover: Math.round(Number(current.cloud_cover ?? 0)),
    windMph: Math.round(Number(current.wind_speed_10m ?? 0)),
    windGustMph: Math.round(Number(current.wind_gusts_10m ?? 0)),
    precipitationIn: Number(current.precipitation ?? 0),
    weatherCode: Number(current.weather_code ?? 0),
    observedAt: current.time ?? fetchedAt,
    fetchedAt,
  }
}

const cacheKey = (locationInput: string) => `${WEATHER_CACHE_PREFIX}${encodeURIComponent(normalizeWeatherLocation(locationInput).toLowerCase())}`

export const readCachedWeather = (locationInput: string): LiveWeatherReading | null => {
  try {
    const raw = localStorage.getItem(cacheKey(locationInput))
    if (!raw) return null
    const reading = JSON.parse(raw) as LiveWeatherReading
    const age = Date.now() - new Date(reading.fetchedAt).getTime()
    return Number.isFinite(age) && age <= CACHE_MAX_AGE_MS ? reading : null
  } catch { return null }
}

export const writeCachedWeather = (reading: LiveWeatherReading): void => {
  try { localStorage.setItem(cacheKey(reading.locationQuery), JSON.stringify(reading)) } catch { /* optional cache */ }
}
