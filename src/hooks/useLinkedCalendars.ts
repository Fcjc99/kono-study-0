import { useEffect, useRef } from 'react'
import type { AppData } from '../store/model'
import { dueForSync, readLinked, syncLinked } from '../store/linkedCalendars'

/** Keeps linked calendars up to date while KONO is open: shortly after it opens, then every few hours. */
export function useLinkedCalendars(profileId: string, data: AppData, save: (fn: (d: AppData) => AppData) => Promise<boolean>, enabled: boolean) {
  const latest = useRef(data)
  useEffect(() => { latest.current = data }, [data])
  useEffect(() => {
    if (!enabled) return
    let running = false
    const run = async () => {
      if (running) return
      running = true
      try { for (const calendar of readLinked(profileId).filter(c => dueForSync(c))) await syncLinked(profileId, calendar, () => latest.current, save) } finally { running = false }
    }
    const soon = window.setTimeout(() => void run(), 8000), later = window.setInterval(() => void run(), 3600000)
    return () => { window.clearTimeout(soon); window.clearInterval(later) }
  }, [profileId, save, enabled])
}
