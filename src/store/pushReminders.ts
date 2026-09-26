import { classOccurrences, classTime } from './classSchedule'
import type { AppData } from './model'

/** The next week of lock-screen reminders for the active plan, worked out on the person's own device
 * (so times are in their time zone) and handed to KONO's server queue (migration 0008):
 * - 7:00 AM: what's due today (assignments and exams), one summary
 * - 7:00 PM: exams and tests tomorrow
 * - 15 minutes before each class, and at the start of each planned study block
 * - parent mode with family reminders on: 15 minutes before each timed event
 * Past times are skipped; the list is capped so a busy week can't flood anyone. */
export type Reminder = { sendAt: string; title: string; body: string; tag: string }

const MAX = 200
const pad = (n: number) => String(n).padStart(2, '0')
const dateOf = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
const at = (date: string, clock: string, minusMinutes = 0) => { const d = new Date(date + 'T' + clock + ':00'); d.setMinutes(d.getMinutes() - minusMinutes); return d }
const list = (titles: string[]) => titles.slice(0, 4).join(', ') + (titles.length > 4 ? ', …' : '')
const cut = (s: string, n: number) => s.length > n ? s.slice(0, n - 1) + '…' : s

export function buildReminders(data: AppData, now: Date, days = 7): Reminder[] {
  // Turning reminders on for a device is the opt-in, so the in-app reminder toggle doesn't gate these.
  const profileId = data.activeProfileId, settings = data.settings
  const out: Reminder[] = []
  const add = (when: Date, title: string, body: string, tag: string) => { if (when > now) out.push({ sendAt: when.toISOString(), title: cut(title, 120), body: cut(body, 300), tag: cut(tag, 120) }) }
  const tasks = data.tasks.filter(t => t.profileId === profileId && !t.done), exams = data.exams.filter(e => e.profileId === profileId && !e.done)
  const subject = (id: string) => data.subjects.find(s => s.id === id)?.name
  for (let i = 0; i < days; i++) {
    const day = new Date(now); day.setDate(now.getDate() + i)
    const date = dateOf(day), next = new Date(day); next.setDate(day.getDate() + 1)
    const due = [...tasks.filter(t => t.due === date).map(t => t.title), ...exams.filter(e => e.due === date).map(e => e.title)]
    if (due.length) add(at(date, '07:00'), due.length === 1 ? 'Due today: ' + due[0] : due.length + ' things due today', list(due), 'due-' + date)
    const tomorrow = exams.filter(e => e.due === dateOf(next))
    if (tomorrow.length) add(at(date, '19:00'), tomorrow.length === 1 ? 'Tomorrow: ' + tomorrow[0].title : tomorrow.length + ' exams or tests tomorrow', tomorrow.length === 1 ? (subject(tomorrow[0].subjectId) ?? 'Good luck — a little review tonight helps.') : list(tomorrow.map(e => e.title)), 'exam-' + date)
    for (const c of classOccurrences(data, date)) {
      const start = c.displayStart ?? c.block.start
      if (c.timePending || c.block.kind === 'break' || c.block.skippedDates?.includes(date) || !start) continue
      add(at(date, start, 15), (c.block.kind === 'study' ? 'Class in 15 min: ' : 'In 15 min: ') + c.block.label, [classTime(start), c.block.location].filter(Boolean).join(' · '), 'class-' + c.block.id + '-' + date)
    }
    for (const t of tasks.filter(t => t.due === date && t.plannedTime)) add(at(date, t.plannedTime!), 'Time to start: ' + t.title, t.estimatedMinutes ? `Planned for about ${t.estimatedMinutes} minutes.` : 'This is the time you planned for it.', 'block-' + t.id)
    if (settings.parentMode && settings.familyEventReminders) for (const e of data.calendarEvents.filter(e => e.profileId === profileId && !e.done && e.date === date && e.time)) add(at(date, e.time!, 15), 'In 15 min: ' + e.title, classTime(e.time!), 'event-' + e.id)
  }
  return out.sort((a, b) => a.sendAt.localeCompare(b.sendAt)).slice(0, MAX)
}
