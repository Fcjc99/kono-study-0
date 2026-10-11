import { useEffect, useRef } from 'react'
import type { AppData } from '../store/model'
import type { buildReminders } from '../store/pushReminders'
import { currentPushSubscription } from '../store/pushDevice'

/** While this device has lock-screen reminders on, keep its queue on KONO's server in step with the plan
 * open on it (each device its own: a kid's iPad gets the kid's plan): shortly after changes, and every
 * few hours while KONO stays open. */
export function usePushReminders(data: AppData, sync: (rows: ReturnType<typeof buildReminders>, endpoint?: string) => Promise<void>, enabled: boolean) {
  const last = useRef('')
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const run = async () => {
      const subscription = await currentPushSubscription().catch(() => null)
      if (!subscription || cancelled) return
      // The reminder builder loads only on devices with lock-screen reminders on.
      const { buildReminders } = await import('../store/pushReminders')
      if (cancelled) return
      const rows = buildReminders(data, new Date()), key = subscription.endpoint + JSON.stringify(rows)
      if (key === last.current) return
      await sync(rows, subscription.endpoint).then(() => { last.current = key }).catch(() => undefined)
    }
    const soon = window.setTimeout(() => void run(), 5000), later = window.setInterval(() => void run(), 3 * 3600000)
    return () => { cancelled = true; window.clearTimeout(soon); window.clearInterval(later) }
  }, [data, sync, enabled])
}
