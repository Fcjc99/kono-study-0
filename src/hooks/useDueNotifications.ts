import { useEffect } from 'react'

type NotifiableItem = { id: string; title: string; due: string; done: boolean }

const lastDigestKey = 'kono-notified-digest-day'

export const notificationsSupported = () => typeof window !== 'undefined' && typeof Notification !== 'undefined'

export const requestNotificationPermission = () => notificationsSupported() ? Notification.requestPermission() : Promise.resolve('denied' as NotificationPermission)

/** One digest per day, not one notification per item — a busy day would otherwise stack a dozen alerts. */
export function useDueNotifications(enabled: boolean, items: NotifiableItem[], today: string) {
  useEffect(() => {
    if (!enabled || !notificationsSupported() || Notification.permission !== 'granted') return
    const check = () => {
      let lastDigestDay = ''
      try { lastDigestDay = localStorage.getItem(lastDigestKey) ?? '' } catch { /* Storage can be blocked; treat as no prior digest today. */ }
      if (lastDigestDay === today) return
      const due = items.filter(item => !item.done && item.due === today)
      if (!due.length) return
      const title = due.length === 1 ? 'Due today: ' + due[0].title : due.length + ' things due today'
      const body = due.slice(0, 5).map(item => item.title).join(', ') + (due.length > 5 ? ', …' : '')
      try { new Notification(title, { body, tag: 'kono-daily-digest' }) } catch { /* Notifications can be blocked mid-session; skip silently. */ }
      try { localStorage.setItem(lastDigestKey, today) } catch { /* Best effort; worst case is a repeat digest later today. */ }
    }
    check()
    const interval = window.setInterval(check, 5 * 60000)
    return () => window.clearInterval(interval)
  }, [enabled, items, today])
}

type TimeBlockItem = { id: string; title: string; due: string; done: boolean; plannedTime?: string; estimatedMinutes?: number; profileId?: string }
const notifiedBlockKey = (id: string, date: string) => 'kono-notified-block:' + id + ':' + date

/** True the moment a planned time-block (see store/timeBlocking.ts) has arrived -- or up to 15 minutes
 * after -- so a tab opened hours later doesn't surface a stale alert for a block long past. Split out
 * as a pure function (no Date.now() inside) so the boundary math is directly testable. */
export function isTimeBlockDue(item: Pick<TimeBlockItem, 'due' | 'done' | 'plannedTime'>, today: string, nowMinutes: number): boolean {
  if (item.done || item.due !== today || !item.plannedTime) return false
  const [h, m] = item.plannedTime.split(':').map(Number), lateBy = nowMinutes - (h * 60 + m)
  return lateBy >= 0 && lateBy <= 15
}

/** Nudges at the moment a picked time-blocking slot actually arrives, so picking a slot earlier does
 * something later instead of just leaving a quiet chip on the task. One notification per task per day,
 * same as the due digest. */
export function useTimeBlockNotifications(enabled: boolean, items: TimeBlockItem[], today: string, onDue: (item: TimeBlockItem) => void) {
  useEffect(() => {
    if (!enabled || !notificationsSupported() || Notification.permission !== 'granted') return
    const check = () => {
      const now = new Date(), nowMinutes = now.getHours() * 60 + now.getMinutes()
      for (const item of items) {
        if (!isTimeBlockDue(item, today, nowMinutes)) continue
        const key = notifiedBlockKey(item.id, today)
        let already = ''
        try { already = localStorage.getItem(key) ?? '' } catch { /* Storage can be blocked; treat as not yet notified. */ }
        if (already) continue
        try {
          const notification = new Notification('Time to start: ' + item.title, {
            body: item.estimatedMinutes ? `Planned for about ${item.estimatedMinutes} minutes.` : 'This was the planned time for it.',
            tag: 'kono-time-block-' + item.id,
          })
          notification.onclick = () => { window.focus(); onDue(item) }
        } catch { /* Notifications can be blocked mid-session; skip silently. */ }
        try { localStorage.setItem(key, '1') } catch { /* Best effort; worst case it re-notifies later this session. */ }
      }
    }
    check()
    const interval = window.setInterval(check, 60000)
    return () => window.clearInterval(interval)
  }, [enabled, items, today, onDue])
}
