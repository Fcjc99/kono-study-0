import { useEffect, useState } from 'react'
import type { SanctuaryWeather } from '../game/sanctuary/types'
import {
  fetchLiveWeather,
  isValidWeatherLocation,
  normalizeWeatherLocation,
  readCachedWeather,
  writeCachedWeather,
  type LiveWeatherState,
  type WeatherMode,
} from '../game/weather/liveWeather'

interface LiveWeatherOptions {
  mode: WeatherMode
  location: string
  manualWeather: SanctuaryWeather
}

const REFRESH_INTERVAL_MS = 20 * 60 * 1000
const fixedState = (weather: SanctuaryWeather, source: 'manual' | 'clear'): LiveWeatherState => ({ weather, source, reading: null, error: null })

export const useLiveSanctuaryWeather = ({ mode, location, manualWeather }: LiveWeatherOptions): LiveWeatherState => {
  const normalizedLocation = normalizeWeatherLocation(location)
  const [result,setResult]=useState<{location:string;state:LiveWeatherState}|null>(null)
  const cached=readCachedWeather(normalizedLocation)

  useEffect(() => {
    if(mode!=='live'||!isValidWeatherLocation(normalizedLocation))return
    let disposed=false
    let controller:AbortController|null=null
    const refresh = async () => {
      controller?.abort(); const requestController=new AbortController();controller=requestController
      try {
        const reading = await fetchLiveWeather(normalizedLocation, requestController.signal)
        if (disposed||requestController.signal.aborted||controller!==requestController) return
        writeCachedWeather(reading)
        setResult({location:normalizedLocation,state:{ weather: reading.weather, source: 'live', reading, error: null }})
      } catch (error) {
        if (disposed || requestController.signal.aborted || controller!==requestController) return
        const fallback = readCachedWeather(normalizedLocation)
        const message = error instanceof Error ? error.message : 'Weather could not be updated'
        setResult({location:normalizedLocation,state:fallback ? { weather: fallback.weather, source: 'cache', reading: fallback, error: message } : { weather: manualWeather, source: 'error', reading: null, error: message }})
      }
    }

    void refresh()
    const timer = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS)
    const handleVisibility = () => { if (!document.hidden) void refresh() }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => { disposed = true; controller?.abort(); window.clearInterval(timer); document.removeEventListener('visibilitychange', handleVisibility) }
  }, [manualWeather, mode, normalizedLocation])

  if(mode==='clear')return fixedState('clear','clear')
  if(mode==='manual')return fixedState(manualWeather,'manual')
  if(!isValidWeatherLocation(normalizedLocation))return {weather:manualWeather,source:'error',reading:null,error:'Enter a city, region, country, or 5-digit U.S. ZIP code'}
  if(result?.location===normalizedLocation)return result.state
  return cached?{weather:cached.weather,source:'cache',reading:cached,error:null}:{weather:manualWeather,source:'loading',reading:null,error:null}
}
