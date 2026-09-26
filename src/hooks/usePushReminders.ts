import { useEffect, useRef } from 'react'
import type { AppData } from '../store/model'
import { buildReminders } from '../store/pushReminders'
import { currentPushSubscription } from '../store/pushDevice'

/** While this device has lock-screen reminders on, keep the account's queue on KONO's server in step
 * with the plan: shortly after changes, and every few hours while KONO stays open. */
export function usePushReminders(data: AppData, sync: (rows: ReturnType<typeof buildReminders>) => Promise<void>, enabled: boolean) {
  const last = useRef('')
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const run = async () => {
      if (!(await currentPushSubscription().catch(() => null)) || cancelled) return
      const rows = buildReminders(data, new Date()), key = JSON.stringify(rows)
      if (key === last.current) return
      await sync(rows).then(() => { last.current = key }).catch(() => undefined)
    }
    const soon = window.setTimeout(() => void run(), 5000), later = window.setInterval(() => void run(), 3 * 3600000)
    return () => { cancelled = true; window.clearTimeout(soon); window.clearInterval(later) }
  }, [data, sync, enabled])
}
