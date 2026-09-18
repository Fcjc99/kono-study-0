import { normalizeData, uid, type AppData, type CalendarEventKind } from './model'
import { validDate } from './scheduleImport'
import { aiFail, callAi, type AiProvider, type PhotoInput } from './aiProvider'

const fail = aiFail

export type AssignmentPhotoItem = { title: string; date: string | null; kind: 'task' | 'exam' | 'event'; subject: string }

function buildAssignmentPhotoPrompt(today: string): string {
  return `You are reading a photo of a student's handwritten or printed notes listing assignments, due ` +
    `dates, tests, and classes -- this could be a to-do list, a page torn from a notebook, a sticky note, ` +
    `anything. Today's date is ${today}. For every distinct item you can make out, extract one entry ` +
    `(work through unclear handwriting using your best judgement; skip anything you truly cannot read). ` +
    `Respond with a single JSON object: {"items": array of {` +
    `"title": string (what the item is, cleaned up but close to what is written), ` +
    `"date": string in YYYY-MM-DD format, or null if genuinely no date or day is written or implied for ` +
    `this item -- resolve any relative day reference ("Friday", "next Tuesday", "tomorrow") against ` +
    `today's date (${today}), ` +
    `"kind": one of "exam" (a test, quiz or exam), "task" (homework, an assignment, something to turn in), ` +
    `or "event" (anything else), ` +
    `"subject": string (the class or subject this belongs to, if mentioned or clearly implied -- ` +
    `otherwise an empty string)}}. Output ONLY the JSON object, no other text.`
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
    const kind = item.kind === 'exam' || item.kind === 'task' ? item.kind : 'event'
    const subject = typeof item.subject === 'string' ? item.subject.trim().slice(0, 200) : ''
    return [{ title, date, kind, subject }]
  }).slice(0, 60)
  if (!parsed.length) fail('Could not read any items from that photo. Try a clearer photo, or make sure the writing is legible.')
  return parsed
}

export async function readAssignmentPhoto(photo: PhotoInput, provider: AiProvider, apiKey: string, today: string): Promise<AssignmentPhotoItem[]> {
  if (!apiKey.trim()) fail('Add an API key first.')
  const raw = await callAi(buildAssignmentPhotoPrompt(today), provider, apiKey.trim(), photo)
  return parseAssignmentPhoto(raw)
}

export type ApplyAssignmentPhotoResult = { data: AppData; added: number }

/** Unlike the schedule photo importer, every item here lands as a real entry immediately -- no
 * separate review-before-commit checklist. Each one is marked needsReview instead, so it renders with
 * a clear visual flag (see RecordCard) until a person opens or confirms it: AI-read handwriting is
 * exactly the kind of thing that's cheap to skim-check in place, not worth a full checkbox gate for
 * every single item. An item with no resolvable date lands on today rather than being silently
 * dropped, so nothing written down is lost -- it's still flagged for review like everything else, so a
 * wrong guess is exactly as visible as a wrong date would be. */
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
  for (const item of items) {
    const subjectId = subjectFor(item.subject)
    const due = item.date ?? today
    if (item.kind === 'exam') next.exams.push({ id: uid('exam'), profileId, subjectId, title: item.title, due, notes: '', done: false, needsReview: true })
    else if (item.kind === 'task') next.tasks.push({ id: uid('task'), profileId, subjectId, title: item.title, due, done: false, notes: '', needsReview: true })
    else next.calendarEvents.push({ id: uid('event'), profileId, subjectId, title: item.title, date: due, kind: 'other' as CalendarEventKind, notes: '', done: false, needsReview: true })
  }
  return { data: normalizeData(next), added: items.length }
}

/** Exposed for tests. */
export const __test__ = { parseAssignmentPhoto, buildAssignmentPhotoPrompt }
