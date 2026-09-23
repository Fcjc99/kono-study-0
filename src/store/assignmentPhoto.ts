import { normalizeData, uid, type AppData, type CalendarEventKind } from './model'
import { validDate } from './scheduleImport'
import { aiFail, callAi, type AiProvider, type PhotoInput } from './aiProvider'
import { nextKidColor } from './kids'

const fail = aiFail

// Anything that isn't a task or exam lands as a calendarEvent with one of these kinds -- the same set
// the quick-add popup offers (see Workspace.tsx's QUICK_KIND_OPTIONS), plus "work". Letting the AI pick
// among them (instead of always coercing to "other") means a scanned family calendar's sports practices
// and appointments still show up correctly colored and filterable under Academic/Sports/Appointments,
// the same as one entered by hand. "activity" is deliberately excluded -- eventCategory buckets it as
// Academic, which is wrong for a dance class or club scanned off a family calendar.
const EVENT_KINDS = ['personal', 'sports', 'appointment', 'work', 'other'] as const
type EventKind = typeof EVENT_KINDS[number]

export type AssignmentPhotoItem = { title: string; date: string | null; time: string | null; endTime: string | null; kind: 'task' | 'exam' | 'event'; eventKind: EventKind; subject: string; kidName: string }

/** Defensive fallback for a time the AI didn't format as the requested 24-hour "HH:MM" -- accepts
 * that format directly, or a common 12-hour form ("5:30pm", "5:30 PM", "5p"). Returns undefined
 * (never throws) for anything else, since a scanned item's time is optional and a bad guess should
 * just come through blank rather than sinking the whole item. */
function normalizeClockTime(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined
  const s = raw.trim()
  const iso = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(s)
  if (iso) return `${iso[1].padStart(2, '0')}:${iso[2]}`
  const twelveHour = /^(\d{1,2})(?::([0-5]\d))?\s*([ap])\.?m?\.?$/i.exec(s)
  if (twelveHour) {
    let hour = Number(twelveHour[1]) % 12
    if (/p/i.test(twelveHour[3])) hour += 12
    return `${String(hour).padStart(2, '0')}:${twelveHour[2] ?? '00'}`
  }
  return undefined
}

function buildAssignmentPhotoPrompt(today: string): string {
  return `You are reading a photo of notes, a planner page, or a family calendar app screenshot listing ` +
    `assignments, due dates, tests, classes, appointments, sports practices/games, or other scheduled ` +
    `items. This could be a quick to-do list, a page torn from a notebook, a sticky note, a full course ` +
    `syllabus covering an entire term (with a week-by-week schedule table, reading list, and exam ` +
    `dates), or a screenshot of a family/shared calendar app where each item is labeled with a person's ` +
    `name and often a color-coded dot next to their name. Today's date is ${today}. Extract every ` +
    `distinct dated item across the ENTIRE document, not just ones near today -- a syllabus's schedule ` +
    `table can run many weeks past today and every row in it matters just as much as this week's, and a ` +
    `calendar screenshot's later days matter just as much as today's. Work through unclear handwriting ` +
    `or small print using your best judgement; skip anything you truly cannot read. ` +
    `Respond with a single JSON object: {"items": array of {` +
    `"title": string (what the item is, cleaned up but close to what is written -- drop a person's name ` +
    `from the title itself if it's already captured in "kidName" below, e.g. "Blair- dance" becomes just ` +
    `"Dance"), ` +
    `"date": string in YYYY-MM-DD format, or null if genuinely no date or day is written or implied for ` +
    `this item -- a syllabus usually states its own literal dates (in the schedule table or next to each ` +
    `assignment), a calendar screenshot's day headers give the literal date for everything under them, ` +
    `so use those directly when given; only resolve a relative day reference ("Friday", "next Tuesday", ` +
    `"tomorrow") against today's date (${today}) when no literal date is stated, ` +
    `"time": string in 24-hour "HH:MM" format (e.g. "17:30" for 5:30 PM), or null if no time of day is ` +
    `written or implied for this item -- when a range is given (e.g. "5:30-6:30pm" or "530-630pm"), use ` +
    `the range's start, ` +
    `"endTime": string in 24-hour "HH:MM" format for when the item ends, or null if no end time is ` +
    `written or implied -- only fill this in from an explicit range (e.g. "5:30-6:30pm" gives endTime ` +
    `"18:30"); never guess a duration for an item with only a single time, ` +
    `"kind": one of "exam" (a test, quiz or exam), "task" (homework, reading, an assignment, something to ` +
    `turn in), or "event" (anything else: an appointment, sports practice or game, activity, or a plain ` +
    `topic/lecture with no deliverable), ` +
    `"eventKind": only meaningful when "kind" is "event" -- one of "sports" (a practice, game, or sports ` +
    `activity), "appointment" (a doctor/dentist/other appointment), "personal" (dance, music, tutoring, ` +
    `a club, a family event, or anything general/personal), "work" (a work shift), or "other" (anything ` +
    `else, including a plain event with no clearer category), ` +
    `"subject": string (the class or subject this belongs to, if mentioned or clearly implied -- ` +
    `otherwise an empty string), ` +
    `"kidName": string (the first name of the specific person/kid this item is for, if the document ` +
    `labels items by person -- for example a family calendar screenshot's per-item name and color dot, ` +
    `or a planner page headed with one kid's name -- otherwise an empty string if the item applies to ` +
    `nobody in particular or the document isn't organized by person)` +
    `}}. Output ONLY the JSON object, no other text.`
}

function parseAssignmentPhoto(raw: string): AssignmentPhotoItem[] {
  let obj: unknown
  try { obj = JSON.parse(raw) } catch { fail('The AI response was not valid JSON. Try again.') }
  if (!obj || typeof obj !== 'object') fail('The AI response was not in the expected format.')
  const items = (obj as Record<string, unknown>).items
  if (!Array.isArray(items)) fail('Could not read any items from that photo. Try a clearer photo.')
  const parsed = (items as unknown[]).flatMap((raw): AssignmentPhotoItem[] => {
    if (!raw || typeof raw !== 'object') return []
    const item = raw as Record<string, unknown>
    const title = typeof item.title === 'string' ? item.title.trim().slice(0, 200) : ''
    if (!title) return []
    const date = typeof item.date === 'string' && validDate(item.date) ? item.date : null
    const time = typeof item.time === 'string' ? normalizeClockTime(item.time) ?? null : null
    // An end time only means anything alongside a start time -- drop a stray one rather than let a
    // "5:30" item silently gain an implied 5-hour block from a misread "endTime" with no "time".
    const endTime = time && typeof item.endTime === 'string' ? normalizeClockTime(item.endTime) ?? null : null
    const kind = item.kind === 'exam' || item.kind === 'task' ? item.kind : 'event'
    const eventKind = (EVENT_KINDS as readonly string[]).includes(item.eventKind as string) ? item.eventKind as EventKind : 'other'
    const subject = typeof item.subject === 'string' ? item.subject.trim().slice(0, 200) : ''
    const kidName = typeof item.kidName === 'string' ? item.kidName.trim().slice(0, 200) : ''
    return [{ title, date, time, endTime, kind, eventKind, subject, kidName }]
  }).slice(0, 150) // a dense multi-week syllabus table can list far more entries than a quick to-do photo
  if (!parsed.length) fail('Could not read any items from that photo. Try a clearer photo, or make sure the writing is legible.')
  return parsed
}

export async function readAssignmentPhoto(photo: PhotoInput, provider: AiProvider, apiKey: string, today: string): Promise<AssignmentPhotoItem[]> {
  if (!apiKey.trim()) fail('Add an API key first.')
  const raw = await callAi(buildAssignmentPhotoPrompt(today), provider, apiKey.trim(), photo)
  return parseAssignmentPhoto(raw)
}

export type CreatedItem = { key: 'tasks' | 'exams' | 'calendarEvents'; id: string; title: string; date: string; time?: string; endTime?: string; subjectId: string; kidId?: string }
export type ApplyAssignmentPhotoResult = { data: AppData; created: CreatedItem[] }

/** Unlike the schedule photo importer, every item here lands as a real entry immediately -- no
 * separate review-before-commit checklist. Each one is marked needsReview instead, so it renders with
 * a clear visual flag (see RecordCard) until a person opens or confirms it: AI-read handwriting is
 * exactly the kind of thing that's cheap to skim-check in place, not worth a full checkbox gate for
 * every single item. An item with no resolvable date lands on today rather than being silently
 * dropped, so nothing written down is lost -- it's still flagged for review like everything else, so a
 * wrong guess is exactly as visible as a wrong date would be. `created` lets the caller show exactly
 * what landed (and offer a quick per-item confirm) without having to diff the before/after data. */
export function applyAssignmentPhoto(data: AppData, profileId: string, items: AssignmentPhotoItem[], today: string): ApplyAssignmentPhotoResult {
  if (data.activeProfileId !== profileId) throw new Error('Your profile changed. Reopen the scanner.')
  const next = structuredClone(data)
  const clean = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()
  const subjectFor = (name: string): string => {
    if (!name.trim()) return ''
    const known = next.subjects.find(s => s.profileId === profileId && clean(s.name) === clean(name))
    if (known) return known.id
    const id = uid('subject')
    next.subjects.push({ id, profileId, name: name.trim().slice(0, 200), color: '#4169a8', resources: [] })
    return id
  }
  // Mirrors subjectFor above -- a scanned family calendar labels most items by person, not subject, so
  // the same "match an existing one by name, otherwise create it" pattern applies to kids too. A new
  // kid gets the next unused palette color, same as adding one by hand from the Kids page.
  const kidFor = (name?: string): string | undefined => {
    if (!name?.trim()) return undefined
    const known = next.kids.find(k => k.profileId === profileId && clean(k.name) === clean(name))
    if (known) return known.id
    const id = uid('kid')
    next.kids.push({ id, profileId, name: name.trim().slice(0, 200), color: nextKidColor(next.kids.filter(k => k.profileId === profileId)) })
    return id
  }
  const created: CreatedItem[] = []
  for (const item of items) {
    const subjectId = subjectFor(item.subject)
    const kidId = kidFor(item.kidName)
    const due = item.date ?? today
    if (item.kind === 'exam') {
      const id = uid('exam')
      next.exams.push({ id, profileId, subjectId, kidId, title: item.title, due, notes: '', done: false, needsReview: true })
      created.push({ key: 'exams', id, title: item.title, date: due, subjectId, kidId })
    } else if (item.kind === 'task') {
      const id = uid('task')
      next.tasks.push({ id, profileId, subjectId, kidId, title: item.title, due, done: false, notes: '', needsReview: true })
      created.push({ key: 'tasks', id, title: item.title, date: due, subjectId, kidId })
    } else {
      const id = uid('event')
      const time = item.time ?? undefined
      const endTime = item.endTime ?? undefined
      next.calendarEvents.push({ id, profileId, subjectId, kidId, title: item.title, date: due, time, endTime, kind: (item.eventKind ?? 'other') as CalendarEventKind, notes: '', done: false, needsReview: true })
      created.push({ key: 'calendarEvents', id, title: item.title, date: due, time, endTime, subjectId, kidId })
    }
  }
  return { data: normalizeData(next), created }
}

/** Exposed for tests. */
export const __test__ = { parseAssignmentPhoto, buildAssignmentPhotoPrompt, normalizeClockTime }
