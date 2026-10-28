import { callNative } from '../native'
import { buildReminders } from './pushReminders'
import type { AppData } from './model'

/** KONO's phone apps (only loaded there, from hooks/useNativeApp): what the home-screen widgets show,
 * and reminders scheduled on the phone itself (a website's lock-screen reminders don't reach an app). */

/** What the widgets read (ios/KONOWidget, android KonoWidgetProvider). Keep in step with them. */
export type WidgetSnapshot = {
  updated: string
  name: string
  next: { title: string; why: string }[]
  today: { done: number; left: number }
  kono: { mood: string; line: string; full: number; happy: number; asleep: boolean }
}

export const widgetSnapshot = (s: Omit<WidgetSnapshot, 'updated'>, now = new Date()): WidgetSnapshot => ({
  ...s, updated: now.toISOString(),
  name: s.name.slice(0, 40),
  next: s.next.slice(0, 3).map(n => ({ title: n.title.slice(0, 80), why: n.why.slice(0, 80) })),
  kono: { ...s.kono, line: s.kono.line.slice(0, 90), full: Math.round(s.kono.full), happy: Math.round(s.kono.happy) },
})

export async function updateWidgets(snapshot: WidgetSnapshot) {
  await callNative('KonoWidget', 'setSnapshot', { json: JSON.stringify(snapshot) })
}

/** Notification ids are 32-bit numbers: one per reminder tag, the same every time it's rescheduled. */
export function reminderId(tag: string) {
  let h = 2166136261
  for (let i = 0; i < tag.length; i++) h = Math.imul(h ^ tag.charCodeAt(i), 16777619)
  return (h >>> 1) || 1
}

const ASKED = 'kono-native-reminders-asked'
const MAX = 60 // iOS keeps at most 64 waiting

/** Replaces the phone's waiting reminders with the plan's next week of reminders. Asks for permission
 * once, the first time there's something to remind about. */
export async function scheduleReminders(data: AppData, now = new Date()) {
  const rows = buildReminders(data, now).filter(r => Date.parse(r.sendAt) > now.getTime() + 30000).slice(0, MAX)
  let perm = (await callNative<{ display?: string }>('LocalNotifications', 'checkPermissions'))?.display
  if (perm === 'prompt' || perm === 'prompt-with-rationale') {
    let asked = false
    try { asked = localStorage.getItem(ASKED) === '1' } catch { /* ask again next time */ }
    if (!asked && rows.length) {
      try { localStorage.setItem(ASKED, '1') } catch { /* fine */ }
      perm = (await callNative<{ display?: string }>('LocalNotifications', 'requestPermissions'))?.display
    }
  }
  if (perm !== 'granted') return 0
  const pending = (await callNative<{ notifications?: { id: number }[] }>('LocalNotifications', 'getPending'))?.notifications ?? []
  if (pending.length) await callNative('LocalNotifications', 'cancel', { notifications: pending.map(n => ({ id: n.id })) })
  if (!rows.length) return 0
  await callNative('LocalNotifications', 'schedule', {
    notifications: rows.map(r => ({ id: reminderId(r.tag), title: r.title, body: r.body, schedule: { at: new Date(r.sendAt), allowWhileIdle: true }, extra: { tag: r.tag } })),
  })
  return rows.length
}
