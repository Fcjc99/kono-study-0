import { localDate, type AppData } from './model'
import { parseIcs, syncIcs, type LinkedSeen } from './icsImport'

/** Calendars someone chose to keep up to date (a Canvas feed, Google's secret address, an iCloud link).
 * The links are private, so they stay in this browser only; KONO checks them when it opens (at most
 * every 6 hours) and adds new items, and moves ones whose date changed. */
export type LinkedCalendar = { url: string; name: string; lastSynced?: string; lastResult?: string; seen: LinkedSeen }

const key = (profileId: string) => 'kono-linked-calendars:' + profileId
const CHANGE = 'kono-linked-calendars'
const EVERY = 6 * 3600000

/** The stored list as text, for React's useSyncExternalStore (stable between changes). */
export function linkedSnapshot(profileId: string) { try { return localStorage.getItem(key(profileId)) ?? '[]' } catch { return '[]' } }
export function parseLinked(raw: string): LinkedCalendar[] {
  try { const list = JSON.parse(raw) as LinkedCalendar[]; return Array.isArray(list) ? list.filter(c => c && typeof c.url === 'string') : [] } catch { return [] }
}
export function readLinked(profileId: string): LinkedCalendar[] { return parseLinked(linkedSnapshot(profileId)) }
function writeLinked(profileId: string, list: LinkedCalendar[]) {
  try { localStorage.setItem(key(profileId), JSON.stringify(list.slice(0, 20))) } catch { /* Storage can be full or blocked; the calendar just won't stay linked. */ }
  window.dispatchEvent(new Event(CHANGE))
}
export function onLinkedChange(listener: () => void) { window.addEventListener(CHANGE, listener); return () => window.removeEventListener(CHANGE, listener) }

export function linkCalendar(profileId: string, calendar: LinkedCalendar) {
  writeLinked(profileId, [...readLinked(profileId).filter(c => c.url !== calendar.url), calendar])
}
export function unlinkCalendar(profileId: string, url: string) { writeLinked(profileId, readLinked(profileId).filter(c => c.url !== url)) }

export async function fetchCalendar(url: string): Promise<string> {
  const response = await fetch('/api/calendar-feed', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) })
  const text = await response.text()
  if (!response.ok) { let message = 'Couldn’t get that calendar. Check the link and try again.'; try { message = (JSON.parse(text) as { error?: string }).error || message } catch { /* not JSON: keep the general message */ } throw Error(message) }
  return text
}

/** Checks one linked calendar and applies what changed. `save` gets a function of the latest plan. */
export async function syncLinked(profileId: string, calendar: LinkedCalendar, current: () => AppData, save: (fn: (d: AppData) => AppData) => Promise<boolean>) {
  let result = 'Up to date.'
  try {
    const parsed = parseIcs(await fetchCalendar(calendar.url), localDate())
    const preview = syncIcs(current(), profileId, parsed, calendar.name, calendar.seen)
    let seen = preview.seen
    if (preview.added || preview.updated) {
      const ok = await save(d => { const r = syncIcs(d, profileId, parsed, calendar.name, calendar.seen); seen = r.seen; return r.data })
      result = ok ? [preview.added ? preview.added + ' new' : '', preview.updated ? preview.updated + ' moved to a new date' : ''].filter(Boolean).join(', ') + '.' : 'Not saved yet; will try again.'
      if (!ok) seen = calendar.seen
    }
    linkCalendar(profileId, { ...calendar, seen, lastSynced: new Date().toISOString(), lastResult: result })
  } catch (error) {
    result = error instanceof Error ? error.message : 'Couldn’t check this calendar.'
    linkCalendar(profileId, { ...calendar, lastSynced: new Date().toISOString(), lastResult: result })
  }
  return result
}

export const dueForSync = (calendar: LinkedCalendar, now = Date.now()) => !calendar.lastSynced || now - Date.parse(calendar.lastSynced) > EVERY
