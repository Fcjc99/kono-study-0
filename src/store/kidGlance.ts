import {peopleOf, type AppData, type Kid} from './model'
import {schoolDay} from './schoolCalendar'
import {planForKid} from './familyPlans'

/** A parent's Home: each kid at a glance, from the kid's own plan (if they have one) and anything still
 * tagged to them in the parent's plan: today's school day (Day 3, Monday, No school), what's due tonight
 * (open work due tomorrow, and anything late) and the tests coming up this week. Read only: nothing in
 * the kid's plan changes. */
export type KidGlance = {kid: Kid; planId?: string; school?: string; dueTonight: string[]; late: number; tests: {title: string; due: string}[]}

const addDays = (date: string, n: number) => { const d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

export function kidGlance(data: Pick<AppData, 'profiles' | 'kids' | 'tasks' | 'exams' | 'studySeasons'>, parentProfileId: string, today: string): KidGlance[] {
  const tomorrow = addDays(today, 1), weekEnd = addDays(today, 7)
  return data.kids.filter(k => k.profileId === parentProfileId).map(kid => {
    const plan = planForKid(data, kid.id)
    const mine = (x: {profileId: string; kidId?: string; kidIds?: string[]}) => (plan && x.profileId === plan.id) || (x.profileId === parentProfileId && peopleOf(x).includes(kid.id))
    const tasks = data.tasks.filter(t => !t.done && mine(t)), exams = data.exams.filter(e => !e.done && mine(e))
    const seasons = data.studySeasons.filter(s => s.active && s.school && mine(s))
    const day = seasons.map(s => schoolDay(s, today)).find(Boolean)
    const school = day ? (day.closed ? 'No school' : day.cycleDay ?? 'School day') : undefined
    return {
      kid, planId: plan?.id, school,
      dueTonight: tasks.filter(t => t.due === tomorrow).map(t => t.title),
      late: tasks.filter(t => t.due < today).length,
      tests: exams.filter(e => e.due >= today && e.due <= weekEnd).sort((a, b) => a.due.localeCompare(b.due)).map(e => ({title: e.title, due: e.due})),
    }
  })
}
