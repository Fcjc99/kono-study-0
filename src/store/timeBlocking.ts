import { classOccurrences } from './classSchedule'
import type { AppData } from './model'

export type OpenSlot = { start: string; end: string }

const DAY_START = '07:00'
const DAY_END = '22:00'

const toMinutes = (t: string): number => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const toClock = (mins: number): string => { const h = Math.floor(mins / 60), m = mins % 60; return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') }

/** Suggests where in a day's existing class/activity schedule an assignment of the given length could
 * actually get done -- one suggestion per open gap, each starting as early as that gap allows, so a
 * student sees a few real windows instead of one vague "sometime today". A 'break' block is free time
 * within the day (a study hall, a free period), not a commitment, so it never blocks a suggestion. */
export function findOpenSlots(data: Pick<AppData, 'activeProfileId' | 'studySeasons'>, date: string, durationMinutes: number, dayStart = DAY_START, dayEnd = DAY_END): OpenSlot[] {
  if (!date || durationMinutes <= 0) return []
  const busy = classOccurrences(data, date)
    .filter(o => o.block.kind !== 'break')
    .map(o => [toMinutes(o.displayStart ?? o.block.start), toMinutes(o.displayEnd ?? o.block.end)] as [number, number])
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const [s, e] of busy) {
    const last = merged[merged.length - 1]
    if (last && s <= last[1]) last[1] = Math.max(last[1], e)
    else merged.push([s, e])
  }
  const slots: OpenSlot[] = []
  let cursor = toMinutes(dayStart)
  const end = toMinutes(dayEnd)
  for (const [s, e] of merged) {
    if (s - cursor >= durationMinutes) slots.push({ start: toClock(cursor), end: toClock(cursor + durationMinutes) })
    cursor = Math.max(cursor, e)
  }
  if (end - cursor >= durationMinutes) slots.push({ start: toClock(cursor), end: toClock(cursor + durationMinutes) })
  return slots
}
