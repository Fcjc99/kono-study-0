import { uid, type AppData, type DaySticker, type Routine, type RoutineCheck, type StarEntry } from './model'
import { upcomingSpecial } from './specialDays'

/** The Planner's Kids view (components/KidsPlanner): a picture day for each person, Skylight-style, with
 * routines that earn stars, "sleeps until" countdowns and a sticker for each day. */

/** A picture for an event from its words ("Soccer practice" ⚽), else its kind. */
const PICTURES: [RegExp, string][] = [
  [/soccer|football/, '⚽'], [/basketball/, '🏀'], [/baseball|softball|t-?ball/, '⚾'], [/tennis/, '🎾'], [/swim|pool/, '🏊'],
  [/dance|ballet/, '🩰'], [/gym(nastics)?|tumbl/, '🤸'], [/karate|taekwondo|martial/, '🥋'], [/hockey|skat/, '⛸️'], [/run|track/, '🏃'],
  [/piano|keyboard/, '🎹'], [/guitar/, '🎸'], [/violin|cello|orchestra/, '🎻'], [/drum/, '🥁'], [/sing|choir/, '🎤'], [/music|band/, '🎵'],
  [/art|paint|draw|craft/, '🎨'], [/read|library|book/, '📚'], [/math/, '➗'], [/science|lab/, '🔬'], [/homework|study|tutor/, '✏️'],
  [/school|class/, '🏫'], [/bus/, '🚌'], [/dentist|teeth|ortho/, '🦷'], [/doctor|check-?up|clinic|vaccin/, '🩺'], [/haircut|hair/, '💇'],
  [/birthday|party/, '🎉'], [/play ?date|friend/, '🧸'], [/park|playground/, '🛝'], [/church|temple|mosque|synagogue/, '⛪'],
  [/dinner|lunch|breakfast|eat|pizza/, '🍽️'], [/movie|film/, '🎬'], [/zoo/, '🦁'], [/beach/, '🏖️'], [/camp/, '🏕️'], [/trip|travel|flight|airport/, '✈️'],
  [/grandma|grandpa|nana|papa|family/, '👨‍👩‍👧'], [/vet|dog|cat|pet/, '🐾'], [/bath/, '🛁'], [/bed|sleep|nap/, '😴'], [/shop|store|grocer/, '🛒'],
  [/scout/, '⚜️'], [/chess/, '♟️'], [/coding|robot/, '🤖'], [/clean|chore|tidy/, '🧹'], [/work|shift/, '💼'],
]
const KIND_PICTURE: Record<string, string> = { exam: '📝', test: '📝', quiz: '📝', assignment: '✏️', sports: '⚽', appointment: '🩺', activity: '🎨', lesson: '📖', study: '✏️', work: '💼', personal: '⭐', other: '✨' }
export function pictureFor(title: string, kind?: string): string {
  const t = title.toLowerCase()
  return PICTURES.find(([re]) => re.test(t))?.[1] ?? KIND_PICTURE[kind ?? ''] ?? '📌'
}

/** "In 3 sleeps": birthdays and countdowns in the next month, for the top of the Kids view. */
export function sleepsUntil(data: Pick<AppData, 'specialDays'>, profileId: string, today: string, within = 31) {
  return upcomingSpecial(data, profileId, today, within).filter(s => s.daysAway > 0).slice(0, 4).map(s => ({ icon: s.icon, label: s.label, sleeps: s.daysAway, kidId: s.day.kidId }))
}

/** Starter routines a parent can add for a kid in one tap. */
export const STARTER_ROUTINES: Omit<Routine, 'id' | 'profileId' | 'kidId'>[] = [
  { title: 'Morning', emoji: '🌞', when: 'morning', stars: 1, steps: [['🛏️', 'Make bed'], ['🪥', 'Brush teeth'], ['👕', 'Get dressed'], ['🥣', 'Eat breakfast'], ['🎒', 'Pack bag']].map(([emoji, title]) => ({ id: '', emoji, title })) },
  { title: 'After school', emoji: '🎒', when: 'afternoon', stars: 1, steps: [['👟', 'Shoes away'], ['🍎', 'Snack'], ['✏️', 'Homework'], ['🧸', 'Tidy toys']].map(([emoji, title]) => ({ id: '', emoji, title })) },
  { title: 'Bedtime', emoji: '🌙', when: 'evening', stars: 1, steps: [['🛁', 'Bath'], ['🪥', 'Brush teeth'], ['👚', 'Pajamas'], ['📖', 'Story'], ['💤', 'Lights out']].map(([emoji, title]) => ({ id: '', emoji, title })) },
]
export const routineFrom = (template: Omit<Routine, 'id' | 'profileId' | 'kidId'>, profileId: string, kidId?: string): Routine =>
  ({ ...template, id: uid('routine'), profileId, ...(kidId ? { kidId } : {}), steps: template.steps.map(s => ({ ...s, id: uid('step') })) })

export const checkOf = (data: Pick<AppData, 'routineLog'>, routineId: string, date: string): RoutineCheck | undefined => (data.routineLog ?? []).find(c => c.routineId === routineId && c.date === date)
const starTag = (routineId: string, date: string) => 'routine:' + routineId + ':' + date

/** Ticks (or unticks) one step of a routine on a day. Finishing every step earns the routine's stars once
 * that day (for a kid's routine); unticking a step of a finished one takes them back. */
export function tickStep(data: AppData, routine: Routine, date: string, stepId: string, now = new Date()): { data: AppData; earned: number } {
  const log = data.routineLog ?? [], had = checkOf(data, routine.id, date)
  const steps = had?.steps.includes(stepId) ? had.steps.filter(s => s !== stepId) : [...(had?.steps ?? []), stepId]
  const check: RoutineCheck = had ? { ...had, steps } : { id: uid('check'), profileId: routine.profileId, routineId: routine.id, date, steps }
  const all = routine.steps.length > 0 && routine.steps.every(s => steps.includes(s.id))
  const tag = starTag(routine.id, date), stars = data.starLog ?? [], paid = stars.some(e => e.todoId === tag)
  let starLog: StarEntry[] = stars, earned = 0
  if (routine.kidId && routine.stars > 0 && all && !paid) { earned = routine.stars; starLog = [...stars, { id: uid('star'), profileId: routine.profileId, kidId: routine.kidId, at: now.toISOString(), n: routine.stars, note: routine.emoji + ' ' + routine.title + ' routine', todoId: tag }] }
  else if (!all && paid) starLog = stars.filter(e => e.todoId !== tag)
  return { data: { ...data, routineLog: [...log.filter(c => c !== had), check], starLog }, earned }
}

/** Sets a day's sticker for a kid (or the family); the same sticker again takes it off. */
export function setSticker(data: AppData, profileId: string, date: string, emoji: string, kidId?: string): AppData {
  const list = data.dayStickers ?? [], mine = (s: DaySticker) => s.profileId === profileId && s.date === date && (s.kidId ?? '') === (kidId ?? '')
  const same = list.find(s => mine(s) && s.emoji === emoji)
  return { ...data, dayStickers: [...list.filter(s => !mine(s)), ...(same ? [] : [{ id: uid('sticker'), profileId, date, emoji, ...(kidId ? { kidId } : {}) }])] }
}
export const stickersOn = (data: Pick<AppData, 'dayStickers'>, profileId: string, date: string) => (data.dayStickers ?? []).filter(s => s.profileId === profileId && s.date === date)
export const STICKERS = ['😊', '🤩', '🏆', '🌈', '💪', '🎉', '😴', '🤒', '🍕', '⚽', '🎨', '📚']

/** Words for reading a day aloud: "At 4 o'clock, Soccer practice, at Field 3." */
export function sayTime(time?: string): string {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number), hr = h % 12 || 12
  return 'At ' + (m ? hr + ':' + String(m).padStart(2, '0') : hr + " o'clock") + (h < 12 ? ' in the morning' : h < 17 ? ' in the afternoon' : ' in the evening')
}

/** Skylight's progress strip: how much of today a person has done -- their homework due today, chores
 * (to-dos for them) and routine steps. personId '' is the plan's own person (untagged things). */
export function progressToday(data: AppData, profileId: string, today: string, personId: string): { done: number; total: number } {
  const mine = (kidId?: string) => (kidId ?? '') === personId
  const tasks = data.tasks.filter(t => t.profileId === profileId && t.due === today && mine(t.kidIds?.[0] ?? t.kidId))
  const steps = (data.routines ?? []).filter(r => r.profileId === profileId && mine(r.kidId)).flatMap(r => { const on = checkOf(data, r.id, today)?.steps ?? []; return r.steps.map(s => on.includes(s.id)) })
  const openTodos = (data.familyTodos ?? []).filter(t => t.profileId === profileId && !t.done && t.due && t.due <= today && mine(t.forKidId)).length
  const choresDone = personId ? (data.starLog ?? []).filter(e => e.kidId === personId && e.n > 0 && e.todoId && !e.todoId.startsWith('routine:') && new Date(e.at).toLocaleDateString('en-CA') === today).length : 0
  const done = tasks.filter(t => t.done).length + steps.filter(Boolean).length + choresDone
  return { done, total: done + tasks.filter(t => !t.done).length + steps.filter(x => !x).length + openTodos }
}
