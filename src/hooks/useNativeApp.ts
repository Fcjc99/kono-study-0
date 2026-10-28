import { useEffect } from 'react'
import { isNativeApp } from '../native'
import type { AppData } from '../store/model'
import type { WidgetSnapshot } from '../store/nativeBridge'

/** In KONO's phone apps only: keeps the home-screen widgets and the phone's own reminders in step with
 * the plan, a moment after it changes (and every half hour, so "next up" stays current). Does nothing
 * on the web, where the bridge code isn't even downloaded. */
export function useNativeApp(data: AppData, snapshot: Omit<WidgetSnapshot, 'updated'> | null, enabled: boolean) {
  const key = JSON.stringify(snapshot)
  useEffect(() => {
    if (!enabled || !snapshot || !isNativeApp()) return
    const run = () => void import('../store/nativeBridge').then(m => m.updateWidgets(m.widgetSnapshot(JSON.parse(key)))).catch(() => {})
    const soon = window.setTimeout(run, 1500), later = window.setInterval(run, 1800000)
    return () => { window.clearTimeout(soon); window.clearInterval(later) }
  }, [key, enabled]) // eslint-disable-line react-hooks/exhaustive-deps -- `key` is the snapshot
  useEffect(() => {
    if (!enabled || !isNativeApp()) return
    const run = () => void import('../store/nativeBridge').then(m => m.scheduleReminders(data)).catch(() => {})
    const soon = window.setTimeout(run, 4000), later = window.setInterval(run, 3 * 3600000)
    return () => { window.clearTimeout(soon); window.clearInterval(later) }
  }, [data, enabled])
}
