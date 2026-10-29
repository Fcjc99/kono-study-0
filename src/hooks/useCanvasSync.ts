import { useEffect, useRef } from 'react'
import type { AppData } from '../store/model'

const connected = (profileId: string) => { try { return !!localStorage.getItem('kono-canvas:' + profileId) } catch { return false } }

/** Two-way Canvas while KONO is open (store/canvasSync.ts): checks Canvas shortly after opening and every
 * half hour, and sends a tick to Canvas a few seconds after one is made here. The Canvas code is only
 * downloaded on devices that connected Canvas. */
export function useCanvasSync(profileId: string, data: AppData, save: (fn: (d: AppData) => AppData) => Promise<boolean>, enabled: boolean) {
  const latest = useRef(data)
  useEffect(() => { latest.current = data }, [data])
  useEffect(() => {
    if (!enabled) return
    let running = false
    const run = async () => {
      if (running || !connected(profileId)) return
      running = true
      try { const m = await import('../store/canvasSync'), link = m.readCanvas(profileId); if (link && m.canvasDue(link)) await m.syncCanvas(profileId, () => latest.current, save) } finally { running = false }
    }
    const soon = window.setTimeout(() => void run(), 9000), later = window.setInterval(() => void run(), 600000)
    return () => { window.clearTimeout(soon); window.clearInterval(later) }
  }, [profileId, save, enabled])
  // A tick on a Canvas item goes to Canvas once things settle (several ticks in a row go together).
  const signature = data.tasks.concat(data.exams as never).filter(x => x.canvasRef && x.profileId === profileId).map(x => x.canvasRef + (x.done ? '1' : '0')).join(',')
  useEffect(() => {
    if (!enabled || !signature || !connected(profileId)) return
    const t = window.setTimeout(() => void import('../store/canvasSync').then(m => m.pushCanvas(profileId, latest.current)).catch(() => {}), 3000)
    return () => window.clearTimeout(t)
  }, [signature, profileId, enabled])
}
