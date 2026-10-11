import type {AppData, StudySeason} from './model'
import {classOccurrences, type ClassOccurrence} from './classSchedule'
import {schoolDay, validateSchool} from './schoolCalendar'

/** Home's "what's today" at a rotation school (Duxbury High, Duxbury Middle, NDA…): the rotation day, the
 * block going on now or the next one (with how long until it starts), and for parents, the same for
 * each kid's school. Weekly schools (Monday–Friday) don't need it: the weekday is the day. */
export type BlockNow = {label: string; slot?: string; start: string; end: string; location?: string}
export type RotationNow = {season: StudySeason; kidId?: string; cycleDay?: string; closed: boolean; label: string; now?: BlockNow; next?: BlockNow; minutesToNext?: number; done: boolean; tomorrow?: string}

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const pad = (n: number) => String(n).padStart(2, '0')
const dayOf = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
const addDay = (date: string, n: number) => { const d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() + n); return dayOf(d) }
const block = (c: ClassOccurrence): BlockNow => ({label: c.block.label, slot: c.block.slot, start: c.displayStart ?? c.block.start, end: c.displayEnd ?? c.block.end, ...(c.block.location ? {location: c.block.location} : {})})

export function rotationNow(data: Pick<AppData, 'activeProfileId' | 'studySeasons'>, when: Date): RotationNow[] {
  const today = dayOf(when), clock = when.getHours() * 60 + when.getMinutes()
  return data.studySeasons.filter(s => s.active && s.profileId === data.activeProfileId && s.school && s.school.pattern !== 'weekly' && s.start <= today && s.end >= today).map(season => {
    const day = schoolDay(season, today)
    // The day's classes and blocks (lunch, ASP) in time order; a break that isn't lunch is skipped.
    const blocks = classOccurrences({activeProfileId: season.profileId, studySeasons: [season]}, today)
      .filter(c => !c.timePending && !c.block.skippedDates?.includes(today) && (c.block.kind !== 'break' || /^lunch/i.test(c.block.label)))
      .map(block).sort((a, b) => a.start.localeCompare(b.start))
    // Lunch sits inside a block (Block 4): during lunch, it's lunch.
    const now = blocks.filter(b => minutes(b.start) <= clock && clock < minutes(b.end)).at(-1)
    const next = blocks.find(b => minutes(b.start) > clock)
    let tomorrow: string | undefined
    for (let i = 1; i <= 10 && !tomorrow; i++) { const d = schoolDay(season, addDay(today, i)); if (d && !d.closed && d.cycleDay) tomorrow = d.cycleDay }
    return {season, kidId: season.kidId, cycleDay: day?.cycleDay, closed: !day || day.closed, label: day?.label ?? '', now, next, minutesToNext: next ? minutes(next.start) - clock : undefined, done: !!blocks.length && !now && !next, tomorrow}
  })
}

/** "Not Day 7?": today is set to another rotation day, and the days after follow from it (the same thing
 * the school calendar's "rotation correction" does). A special day already on the calendar (a half day)
 * keeps its rule and gets the corrected day; otherwise a correction note is added for today. */
export function correctRotation(season: StudySeason, date: string, cycleDay: string): StudySeason {
  const school = season.school
  if (!school || !school.cycle.includes(cycleDay)) throw Error('Pick one of this school’s rotation days.')
  const own = school.exceptions.find(e => e.kind !== 'notice' && e.start === date && e.end === date)
  const exceptions = own
    ? school.exceptions.map(e => e === own ? {...e, cycleDay} : e)
    : [...school.exceptions.filter(e => e.id !== 'rotation-fix:' + date), {id: 'rotation-fix:' + date, start: date, end: date, kind: 'notice' as const, label: 'Rotation corrected', audience: 'all' as const, cycleDay}]
  const next = {...school, exceptions}
  validateSchool(next, season.start, season.end)
  return {...season, school: next}
}
