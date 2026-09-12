import { useEffect } from 'react'

type NotifiableItem = { id: string; title: string; due: string; done: boolean }

const notifiedKey = (day: string) => `kono-notified:${day}`

export const notificationsSupported = () => typeof window !== 'undefined' && typeof Notification !== 'undefined'

export const requestNotificationPermission = () => notificationsSupported() ? Notification.requestPermission() : Promise.resolve('denied' as NotificationPermission)

/** Runs on an interval rather than a due-date timer: the tab may be closed or asleep for days at the exact due moment. */
export function useDueNotifications(enabled: boolean, items: NotifiableItem[], today: string) {
  useEffect(() => {
    if (!enabled || !notificationsSupported() || Notification.permission !== 'granted') return
    const check = () => {
      let notified: string[] = []
      try { notified = JSON.parse(localStorage.getItem(notifiedKey(today)) ?? '[]') } catch { notified = [] }
      const due = items.filter(item => !item.done && item.due === today && !notified.includes(item.id))
      if (!due.length) return
      for (const item of due.slice(0, 5)) {
        try { new Notification('Due today: ' + item.title, { body: 'Open KONO to check it off.', tag: item.id }) } catch { /* Notifications can be blocked mid-session; skip silently. */ }
      }
      try { localStorage.setItem(notifiedKey(today), JSON.stringify([...notified, ...due.map(item => item.id)])) } catch { /* Best effort; worst case is a repeat notification next check. */ }
    }
    check()
    const interval = window.setInterval(check, 5 * 60000)
    return () => window.clearInterval(interval)
  }, [enabled, items, today])
}
