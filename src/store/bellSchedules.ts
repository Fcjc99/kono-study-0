import type { SchoolCalendar } from './schoolCalendar'
import type { ScheduleBlock, StudySeason } from './model'
import { uid } from './model'

export type LunchWave = 1 | 2 | 3
/** A school's regular bell schedule: the times of each numbered period (or block), and, when lunch
 * happens inside one of them, which part of that period each lunch wave eats. */
export type BellSchedule = { periods: [string, string][]; lunch?: { period: number; waves: Record<LunchWave, [string, string]> } }

/** Duxbury High School: five blocks a day on the 7-day rotation. Lunch is inside Block 4, in three
 * waves, and a class's wave follows the department that teaches it (see duxburyLunchWave). */
export const duxburyHighBells: BellSchedule = {
  periods: [['08:20', '09:19'], ['09:23', '10:22'], ['10:26', '11:25'], ['11:29', '12:58'], ['13:02', '14:45']],
  lunch: { period: 4, waves: { 1: ['11:29', '11:53'], 2: ['11:54', '12:18'], 3: ['12:34', '12:58'] } },
}

export const bellScheduleFor = (school?: SchoolCalendar): BellSchedule | undefined =>
  school?.pattern === 'rotation' && school.name === 'Duxbury High School' ? duxburyHighBells : undefined

/** "Period 4" or "Block 4" → 4. */
export const periodNumber = (slot?: string) => { const m = slot?.match(/^(?:Period|Block) (\d{1,2})$/); return m ? Number(m[1]) : 0 }
export const periodTimes = (bells: BellSchedule, slot?: string) => bells.periods[periodNumber(slot) - 1]

// Duxbury High lunch waves by department: 1 · science, math, applied technology; 2 · social studies /
// history, world languages; 3 · English, the arts, PE / health, other electives and study halls.
const wave1 = /\b(science|biology|bio|chemistry|chem|physics|anatomy|physiology|astronomy|forensics?|environmental|earth|marine|geology|ecology|math|mathematics|algebra|geometry|calculus|calc|pre-?calculus|trigonometry|trig|statistics|stats|computer|programming|coding|engineering|robotics|technology|tech|cad|woodworking|manufacturing|electronics|business|accounting|finance|culinary|applied|practical)\b/i
const wave2 = /\b(history|historical|social studies|civics|government|gov|economics|econ|psychology|psych|sociology|geography|law|world issues|holocaust|humanities|spanish|french|latin|german|italian|chinese|mandarin|japanese|portuguese|arabic|asl|sign language|language)\b/i
const wave3 = /\b(english|literature|lit|writing|composition|journalism|poetry|creative|art|arts|drawing|painting|ceramics|sculpture|photography|design|music|band|chorus|choir|orchestra|theater|theatre|drama|dance|physical education|pe|health|wellness|fitness|study hall)\b/i
/** A class's lunch wave from its name, and whether the name actually said which department it's in. */
export function duxburyLunchWave(className: string): { wave: LunchWave; sure: boolean } {
  const name = className.replace(/[·_]/g, ' ')
  // "Music Technology" and "Art History" are the arts; "Computer Science" is still wave 1.
  if (/\b(culinary|practical|applied|industrial)\s+arts?\b/i.test(name)) return { wave: 1, sure: true }
  if (/\b(music|art|arts|theater|theatre|dance)\b/i.test(name) && !/\bmartial\b/i.test(name)) return { wave: 3, sure: true }
  if (wave1.test(name)) return { wave: 1, sure: true }
  if (wave2.test(name)) return { wave: 2, sure: true }
  return { wave: 3, sure: wave3.test(name) }
}
export const lunchWaveFor = (school: SchoolCalendar | undefined, className: string) => bellScheduleFor(school) ? duxburyLunchWave(className) : undefined

/** The lunch shown on a school day: a "Lunch N" break inside the lunch period, for the same dates as the class it's in. */
export function lunchBlock(bells: BellSchedule, wave: LunchWave, dateStart?: string, dateEnd?: string): ScheduleBlock {
  const [start, end] = bells.lunch!.waves[wave]
  return { id: uid('lunch'), label: 'Lunch ' + wave, slot: 'Lunch', start, end, kind: 'break', dateStart, dateEnd, occurrenceNotes: {}, completedDates: [], skippedDates: [] }
}

const dayBefore = (iso: string) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10) }

/** A class that changes partway through the year (a semester class): on every rotation day it meets,
 * the old class ends the school day before `from` and the new one takes its period from `from`. Notes
 * and completed days stay with the old class. At a school with lunch waves, the lunch on those days
 * switches to the new class's wave too. */
export function switchClass(season: StudySeason, oldLabel: string, next: { label: string; location?: string; from: string; lunchWave?: LunchWave }): StudySeason {
  const label = next.label.trim(), key = oldLabel.trim().toLowerCase()
  if (!label) throw Error('Enter the new class’s name.')
  if (!next.from || next.from <= season.start || next.from > (season.school?.lastClassDate || season.end)) throw Error('Choose a date during the school year for the new class to start.')
  const bells = bellScheduleFor(season.school), result = structuredClone(season)
  const range = (b: ScheduleBlock) => b.fullYear ? [season.start, season.end] : [b.dateStart ?? season.start, b.dateEnd ?? season.end]
  let changed = 0
  for (const [day, blocks] of Object.entries(result.week)) {
    const out: ScheduleBlock[] = []
    let lunchUntil = ''
    for (const b of blocks) {
      const [start, end] = range(b)
      if (b.label.trim().toLowerCase() !== key || b.kind !== 'study' || next.from <= start || next.from > end) { out.push(b); continue }
      changed++
      out.push({ ...b, fullYear: false, dateStart: start, dateEnd: dayBefore(next.from) })
      out.push({ ...b, id: uid('block'), label, location: next.location?.trim() || undefined, subjectId: undefined, fullYear: false, dateStart: next.from, dateEnd: end, occurrenceNotes: {}, completedDates: [], skippedDates: [] })
      if (bells?.lunch && next.lunchWave && periodNumber(b.slot) === bells.lunch.period) lunchUntil = end
    }
    // The lunch inside the changed class's period follows the new class.
    if (lunchUntil && bells && next.lunchWave) {
      for (let i = 0; i < out.length; i++) {
        const l = out[i], [start, end] = range(l)
        if (l.slot === 'Lunch' && l.kind === 'break' && start < next.from && end >= next.from) out[i] = { ...l, fullYear: false, dateStart: start, dateEnd: dayBefore(next.from) }
      }
      out.push(lunchBlock(bells, next.lunchWave, next.from, lunchUntil))
    }
    result.week[day] = out.sort((a, b) => a.start.localeCompare(b.start))
  }
  if (!changed) throw Error('That class doesn’t meet after this date, so there’s nothing to change.')
  return result
}

/** Fixes a class's name everywhere it meets (a typo, or a class renamed by the school). */
export function renameClass(season: StudySeason, oldLabel: string, label: string): StudySeason {
  const name = label.trim(), key = oldLabel.trim().toLowerCase()
  if (!name) throw Error('Enter the class’s new name.')
  return { ...season, week: Object.fromEntries(Object.entries(season.week).map(([day, blocks]) => [day, blocks.map(b => b.label.trim().toLowerCase() === key ? { ...b, label: name } : b)])) }
}

type PeriodRow = { include: boolean; day: string; label: string; slot: string; start: string; end: string; dateStart: string; dateEnd: string; kind: string; lunchWave?: LunchWave; lunchSure?: boolean }

/** Imported classes listed by period: each gets its period's bell times (unless it already has times),
 * and a class in the lunch period gets a lunch wave guessed from its department. */
export function applyBells<R extends PeriodRow>(rows: R[], bells?: BellSchedule): R[] {
  if (!bells) return rows
  return rows.map(r => {
    const times = periodTimes(bells, r.slot)
    if (!times) return r
    const timed = r.start && r.end ? r : { ...r, start: times[0], end: times[1] }
    if (bells.lunch && periodNumber(r.slot) === bells.lunch.period && r.kind === 'study' && !r.lunchWave) { const guess = duxburyLunchWave(r.label); return { ...timed, lunchWave: guess.wave, lunchSure: guess.sure } }
    return timed
  })
}

/** The lunch breaks for the imported classes in the lunch period, one per day and date range. */
export function addLunches<R extends PeriodRow>(season: StudySeason, rows: R[]): StudySeason {
  const bells = bellScheduleFor(season.school)
  if (!bells?.lunch) return season
  const next = structuredClone(season)
  for (const r of rows) {
    if (!r.include || !r.lunchWave || periodNumber(r.slot) !== bells.lunch.period || !next.week[r.day]) continue
    const lunch = lunchBlock(bells, r.lunchWave, r.dateStart, r.dateEnd)
    if (next.week[r.day].some(b => b.slot === 'Lunch' && b.start === lunch.start && b.dateStart === r.dateStart && b.dateEnd === r.dateEnd)) continue
    next.week[r.day] = [...next.week[r.day], lunch].sort((a, b) => a.start.localeCompare(b.start))
  }
  return next
}

/** Days that don't add up: two classes in one period, or (for a school with a known bell schedule) a
 * period with nothing in it. Free periods count, so a study hall or free block fills its period. */
export function periodProblems(rows: PeriodRow[], cycle: string[], bells?: BellSchedule): string[] {
  const problems: string[] = []
  for (const day of cycle) {
    const chosen = rows.filter(r => r.include && r.day === day && periodNumber(r.slot))
    const count = new Map<number, number>()
    for (const r of chosen) count.set(periodNumber(r.slot), (count.get(periodNumber(r.slot)) ?? 0) + 1)
    const doubled = [...count].filter(([, n]) => n > 1).map(([p]) => 'Period ' + p)
    if (doubled.length) problems.push(day + ' has two classes in ' + doubled.join(' and ') + '. Untick the one that’s wrong.')
    if (bells && chosen.length) {
      const missing = bells.periods.map((_, i) => i + 1).filter(p => !count.has(p))
      if (missing.length) problems.push(day + ' has nothing in ' + missing.map(p => 'Period ' + p).join(', ') + '. Add it below (a free block counts) if your schedule has one.')
    }
  }
  return problems
}
