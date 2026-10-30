import type { CalendarEvent } from './model'

/** Tablet & wall mode (components/FamilyHub): the settings that belong to the device on the wall, not the
 * plan -- quiet hours, a grown-up PIN, which panels Home shows -- plus helpers the hub and Planner share. */

const read = (key: string) => { try { return localStorage.getItem(key) } catch { return null } }
const write = (key: string, value: string | null) => { try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value) } catch { /* per device only */ } }

/** Quiet hours ("22:00-06:30"): the screen goes dark and is allowed to sleep. Off until set in Setup. */
export type Quiet = { from: string; until: string } | null
export const QUIET_KEY = 'kono-hub-quiet'
export function readQuiet(): Quiet {
  const m = /^(\d{2}:\d{2})-(\d{2}:\d{2})$/.exec(read(QUIET_KEY) ?? '')
  return m ? { from: m[1], until: m[2] } : null
}
export const writeQuiet = (q: Quiet) => write(QUIET_KEY, q ? q.from + '-' + q.until : 'off')
/** Whether a clock time ("23:10") falls in quiet hours, which may run past midnight. */
export function isQuiet(q: Quiet, clock: string): boolean {
  if (!q || q.from === q.until) return false
  return q.from < q.until ? clock >= q.from && clock < q.until : clock >= q.from || clock < q.until
}

/** A grown-up PIN for this device: to leave wall mode, change things there, and OK a kid's reward. Only a
 * hash is kept, so the number isn't sitting in the browser's storage. */
export const PIN_KEY = 'kono-hub-pin'
async function hash(pin: string) {
  const bytes = new TextEncoder().encode('kono-hub:' + pin)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
}
export const hasPin = () => !!read(PIN_KEY)
export async function setPin(pin: string | null) { write(PIN_KEY, pin ? await hash(pin) : null) }
export async function checkPin(pin: string) { const saved = read(PIN_KEY); return !saved || saved === await hash(pin) }

/** Home's side panels, in order; a leading '-' hides one. */
export const PANELS = ['next', 'routines', 'todos', 'dinner', 'countdowns'] as const
export type Panel = typeof PANELS[number]
export const PANEL_NAMES: Record<Panel, string> = { next: 'Up next', routines: 'Routines & chores', todos: 'To-dos', dinner: 'Dinner & groceries', countdowns: 'Counting down' }
export const PANELS_KEY = 'kono-hub-panels'
export function readPanels(): { order: Panel[]; hidden: Set<Panel> } {
  const parts = (read(PANELS_KEY) ?? '').split(',').filter(Boolean)
  const order: Panel[] = [], hidden = new Set<Panel>()
  for (const p of parts) { const id = p.replace(/^-/, '') as Panel; if (!PANELS.includes(id) || order.includes(id)) continue; order.push(id); if (p.startsWith('-')) hidden.add(id) }
  for (const p of PANELS) if (!order.includes(p)) order.push(p)
  return { order, hidden }
}
export const writePanels = (order: Panel[], hidden: Set<Panel>) => write(PANELS_KEY, order.map(p => (hidden.has(p) ? '-' : '') + p).join(','))

/** The same event from two linked calendars (or a linked one and your own): same name, day and start.
 * Your own copy wins, then the first one seen. Events nobody linked are never hidden. */
const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
export function withoutDuplicates<T extends Pick<CalendarEvent, 'title' | 'date' | 'time' | 'source'> & { kidId?: string }>(events: T[]): T[] {
  const seen = new Map<string, T>(), out: T[] = []
  for (const e of [...events].sort((a, b) => (a.source ? 1 : 0) - (b.source ? 1 : 0))) {
    const key = norm(e.title) + '|' + e.date + '|' + (e.time ?? '') + '|' + (e.kidId ?? '')
    const first = seen.get(key)
    if (first && (first.source || e.source)) continue
    seen.set(key, e); out.push(e)
  }
  return events.filter(e => out.includes(e))
}

/** "Paste an email or flyer": the lines that look like they name a day or time, tidied, for quick add. */
const DAYISH = /\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d{1,2}\b|\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b|\btoday\b|\btomorrow\b|\b\d{1,2}(:\d{2})? ?(am|pm)\b/i
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
/** "Thursday, Nov 12 at 9am." → "11/12 at 9am": a written date in the form quick add reads, the weekday
 * dropped when there's a date (the date wins), trailing punctuation and "is"/"will be" filler gone. */
function tidy(line: string) {
  let l = line.replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/i, (_, mon: string, day: string) => (MONTHS.indexOf(mon.toLowerCase().slice(0, 3)) + 1) + '/' + day)
  if (/\b\d{1,2}\/\d{1,2}\b/.test(l)) l = l.replace(/\b(mon|tues?|wed(nes)?|thu(rs)?|fri|sat(ur)?|sun)(day)?\b,?/gi, '')
  return l.replace(/\b(is|are|will be)\b/gi, ' ').replace(/[.!]+$/, '').replace(/\s+/g, ' ').trim()
}
export function eventLinesFrom(text: string): string[] {
  return [...new Set(text.split(/\r?\n|(?<=[.!?])\s+(?=[A-Z])/)
    .map(l => tidy(l.replace(/^[\s>*•\-–—\d.)]+/, '').replace(/\s+/g, ' ').trim()))
    .filter(l => l.length >= 4 && l.length <= 160 && DAYISH.test(l)))].slice(0, 20)
}
