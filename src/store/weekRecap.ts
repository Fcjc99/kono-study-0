import type { AppData } from './model'
import { addDays } from './studyScheduler'
import { TREE_STAGE_NAMES } from '../game/progression/progressionEngine'
import type { SanctuaryProgressState } from '../game/progression/types'

/** The weekly recap: the last seven days (today included) at a glance, shown on Sundays and any time
 * from the Planner, and shareable as a picture. The picture only uses counts, never titles. */
export type WeekRecap = {
  from: string; to: string
  assignmentsDone: number; examsDone: number
  studySessions: number; studyMinutes: number
  days: { date: string; active: boolean }[]; activeDays: number
  streak: number; islandStage: number; stageName: string; grewThisWeek: number
  topSubject?: string
  nextWeekDue: number; nextExam?: { title: string; due: string }
  headline: string
}

const localDay = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }
const minutesBetween = (start: string, end: string) => { const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)); return Math.max(0, m(end) - m(start)) }

/** Days in a row with a finished assignment, counting back from today (or yesterday, if nothing is
 * finished yet today, so an unfinished day doesn't read as a broken streak). */
export function currentStreak(completionDates: Record<string, number>, today: string) {
  let streak = 0, cursor = (completionDates[today] ?? 0) > 0 ? today : addDays(today, -1)
  while ((completionDates[cursor] ?? 0) > 0) { streak++; cursor = addDays(cursor, -1) }
  return streak
}

function headlineFor(r: Omit<WeekRecap, 'headline'>) {
  if (r.assignmentsDone + r.examsDone === 0 && r.activeDays === 0) return 'A quiet week. Next week is a fresh start.'
  if (r.activeDays === 7) return 'Seven days out of seven. What a week!'
  if (r.assignmentsDone >= 10) return 'A huge week. ' + r.assignmentsDone + ' assignments done!'
  if (r.streak >= 5) return r.streak + ' days in a row and counting.'
  if (r.grewThisWeek > 0) return 'Your island grew this week.'
  return 'Nice work this week.'
}

export function weekRecap(data: AppData, today: string, progress: Pick<SanctuaryProgressState, 'completionDates' | 'unlockedStage'>): WeekRecap {
  const profileId = data.activeProfileId, from = addDays(today, -6), nextEnd = addDays(today, 7)
  const inWeek = (date: string) => date >= from && date <= today
  const done = data.tasks.filter(t => t.profileId === profileId && t.done && t.completedAt && inWeek(localDay(t.completedAt)))
  const examsDone = data.exams.filter(e => e.profileId === profileId && e.done && inWeek(e.due)).length
  const sessions = data.calendarEvents.filter(e => e.profileId === profileId && e.kind === 'study' && inWeek(e.date) && (e.date < today || e.done) && e.time && e.endTime)
  const finishedOn = new Set(done.map(t => localDay(t.completedAt!)))
  const days = Array.from({ length: 7 }, (_, i) => { const date = addDays(from, i); return { date, active: (progress.completionDates[date] ?? 0) > 0 || finishedOn.has(date) } })
  const bySubject = new Map<string, number>()
  for (const t of done) if (t.subjectId) bySubject.set(t.subjectId, (bySubject.get(t.subjectId) ?? 0) + 1)
  const top = [...bySubject].sort((a, b) => b[1] - a[1])[0]
  const upcoming = [
    ...data.tasks.filter(t => t.profileId === profileId && !t.done && t.due > today && t.due <= nextEnd),
    ...data.exams.filter(e => e.profileId === profileId && !e.done && e.due > today && e.due <= nextEnd),
  ]
  const exam = data.exams.filter(e => e.profileId === profileId && !e.done && e.due > today && e.due <= nextEnd).sort((a, b) => a.due.localeCompare(b.due))[0]
  const stage = Math.max(0, Math.min(TREE_STAGE_NAMES.length - 1, progress.unlockedStage))
  const recap: Omit<WeekRecap, 'headline'> = {
    from, to: today,
    assignmentsDone: done.length, examsDone,
    studySessions: sessions.length, studyMinutes: sessions.reduce((n, e) => n + minutesBetween(e.time!, e.endTime!), 0),
    days, activeDays: days.filter(d => d.active).length,
    streak: currentStreak(progress.completionDates, today),
    islandStage: stage, stageName: TREE_STAGE_NAMES[stage],
    grewThisWeek: days.reduce((n, d) => n + (progress.completionDates[d.date] ?? 0), 0),
    topSubject: top ? data.subjects.find(s => s.id === top[0])?.name : undefined,
    nextWeekDue: upcoming.length,
    nextExam: exam ? { title: exam.title, due: exam.due } : undefined,
  }
  return { ...recap, headline: headlineFor(recap) }
}

/** Shown on the Sanctuary page on Sundays (and Monday, in case Sunday was missed) until dismissed. */
export const recapDay = (today: string) => [0, 1].includes(new Date(today + 'T12:00:00').getDay())
