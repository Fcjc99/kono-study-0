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
      try { lastDigestDay = localStorage.getItem(lastDigestKey) ?? '' } catch { lastDigestDay = '' }
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
