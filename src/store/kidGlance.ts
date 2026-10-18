import {peopleOf, type AppData, type Kid} from './model'
import {schoolDay} from './schoolCalendar'
import {planForKid} from './familyPlans'
import {classOccurrences,classTime} from './classSchedule'

/** A parent's Home: each kid at a glance, from the kid's own plan (if they have one) and anything still
 * tagged to them in the parent's plan: today's school day (Day 3, Monday, No school), what's due tonight
 * (open work due tomorrow, and anything late), what they finished today and the tests coming up this week. Read only: nothing in
 * the kid's plan changes. */
export type KidGlance = {kid: Kid; planId?: string; school?: string; dueTonight: string[]; late: number; tests: {title: string; due: string}[]; doneToday: string[]; next?: {title: string; time: string; travelMinutes?: number}; laterToday: number; classes: string[]}

const localDay = (iso: string) => { const d = new Date(iso); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }
const addDays = (date: string, n: number) => { const d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

/** next: their next activity still to come today (from nowClock, "HH:MM"), and how many more after it. */
export function kidGlance(data: Pick<AppData, 'profiles' | 'kids' | 'tasks' | 'exams' | 'studySeasons'> & Partial<Pick<AppData, 'calendarEvents'>>, parentProfileId: string, today: string, nowClock = '00:00'): KidGlance[] {
  const tomorrow = addDays(today, 1), weekEnd = addDays(today, 7)
  return data.kids.filter(k => k.profileId === parentProfileId).map(kid => {
    const plan = planForKid(data, kid.id)
    const mine = (x: {profileId: string; kidId?: string; kidIds?: string[]}) => (plan && x.profileId === plan.id) || (x.profileId === parentProfileId && peopleOf(x).includes(kid.id))
    const tasks = data.tasks.filter(t => !t.done && mine(t)), exams = data.exams.filter(e => !e.done && mine(e))
    const seasons = data.studySeasons.filter(s => s.active && s.school && mine(s))
    const day = seasons.map(s => schoolDay(s, today)).find(Boolean)
    const school = day ? (day.closed ? 'No school' : day.cycleDay ?? 'School day') : undefined
    // Today's classes, from their school or class schedule (not breaks, not skipped).
    const classes = data.studySeasons.filter(s => s.active && mine(s)).flatMap(s => classOccurrences({activeProfileId: s.profileId, studySeasons: [s]}, today)).filter(c => c.block.kind !== 'break' && !c.block.skippedDates?.includes(today) && (!c.block.kidId || c.block.kidId === kid.id)).sort((a, b) => (a.displayStart ?? a.block.start).localeCompare(b.displayStart ?? b.block.start)).map(c => c.block.label + ' ' + classTime(c.displayStart ?? c.block.start))
    const coming = (data.calendarEvents ?? []).filter(e => e.date === today && !e.done && e.time && e.time >= nowClock && mine(e)).sort((a, b) => a.time!.localeCompare(b.time!))
    return {
      kid, planId: plan?.id, school,
      ...(coming[0] ? {next: {title: coming[0].title, time: coming[0].time!, ...(coming[0].travelMinutes ? {travelMinutes: coming[0].travelMinutes} : {})}} : {}), laterToday: Math.max(0, coming.length - 1), classes,
      dueTonight: tasks.filter(t => t.due === tomorrow).map(t => t.title),
      late: tasks.filter(t => t.due < today).length,
      doneToday: data.tasks.filter(t => t.done && t.completedAt && localDay(t.completedAt) === today && mine(t)).map(t => t.title),
      tests: exams.filter(e => e.due >= today && e.due <= weekEnd).sort((a, b) => a.due.localeCompare(b.due)).map(e => ({title: e.title, due: e.due})),
    }
  })
}
