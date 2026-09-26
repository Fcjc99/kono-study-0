import { addDays } from './studyScheduler'
import { uid } from './model'
import type { ImportRow } from './scheduleImport'
import { needsAiMessage, aiReady, aiFail, callAi, type AiProvider, type PhotoInput } from './aiProvider'

const fail = aiFail

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const
type Weekday = typeof WEEKDAYS[number]
const WEEKDAY_OFFSET = Object.fromEntries(WEEKDAYS.map((d, i) => [d, i])) as Record<Weekday, number>

export type PlannerPhotoItem = { weekday: Weekday; title: string; time: string | null; kind: 'exam' | 'task' | 'event' }

function buildPlannerPhotoPrompt(): string {
  return `You are reading a photo of someone's handwritten or printed weekly planner page. For every ` +
    `distinct task, assignment, event, or reminder written under a day, extract one item (work through ` +
    `any unclear handwriting using your best judgement; skip anything you truly cannot make out). ` +
    `Respond with a single JSON object: {"items": array of {"weekday": one of "Monday", "Tuesday", ` +
    `"Wednesday", "Thursday", "Friday", "Saturday", "Sunday" (whichever day it is written under -- omit ` +
    `the item entirely if you cannot tell which day it belongs to), "title": string (the task or event ` +
    `text, cleaned up but close to what is written), "time": string or null (a time of day if one is ` +
    `written next to it, otherwise null), "kind": one of "exam" (a test, quiz or exam), "task" (homework, ` +
    `an assignment, something to turn in), or "event" (anything else, like an appointment or activity)}}. ` +
    `Output ONLY the JSON object, no other text.`
}

function parsePlannerPhoto(raw: string): PlannerPhotoItem[] {
  let obj: unknown
  try { obj = JSON.parse(raw) } catch { fail('The AI response was not valid JSON. Try again.') }
  if (!obj || typeof obj !== 'object') fail('The AI response was not in the expected format.')
  const items = (obj as Record<string, unknown>).items
  if (!Array.isArray(items)) fail('Could not read any items from that photo. Try a clearer photo.')
  const parsed = (items as unknown[]).flatMap((raw): PlannerPhotoItem[] => {
    if (!raw || typeof raw !== 'object') return []
    const item = raw as Record<string, unknown>
    const weekday = WEEKDAYS.find(d => d === item.weekday)
    const title = typeof item.title === 'string' ? item.title.trim().slice(0, 200) : ''
    if (!weekday || !title) return []
    const time = typeof item.time === 'string' && item.time.trim() ? item.time.trim().slice(0, 40) : null
    const kind = item.kind === 'exam' || item.kind === 'task' ? item.kind : 'event'
    return [{ weekday, title, time, kind }]
  }).slice(0, 60)
  if (!parsed.length) fail('Could not read any items from that photo. Try a clearer photo, or make sure each day is legible.')
  return parsed
}

export async function readPlannerPhoto(photo: PhotoInput, provider: AiProvider, apiKey: string): Promise<PlannerPhotoItem[]> {
  if (!aiReady(apiKey)) aiFail(needsAiMessage)
  const raw = await callAi(buildPlannerPhotoPrompt(), provider, apiKey.trim(), photo)
  return parsePlannerPhoto(raw)
}

/** Turns the AI's day-of-week items into the same ImportRow shape the PDF importer produces, so both
 * paths share one review-before-commit UI -- nothing from a photo ever reaches the Planner without a
 * person checking it first, same as a PDF scan. `mondayDate` anchors the week: every other day is
 * computed as an offset from it, so a planner page with no explicit dates (just day names) still lands
 * on real calendar dates. */
export function plannerPhotoToImportRows(items: PlannerPhotoItem[], mondayDate: string): ImportRow[] {
  return items.map(item => ({
    id: uid('import-row'),
    include: false,
    kind: item.kind,
    title: item.title,
    subject: '',
    date: addDays(mondayDate, WEEKDAY_OFFSET[item.weekday]),
    weekdays: [],
    start: '',
    end: '',
    source: item.weekday + (item.time ? ' · ' + item.time : '') + ': ' + item.title,
  }))
}

/** Exposed for tests — exercises the same validation a real API response goes through. */
export const __test__ = { parsePlannerPhoto, buildPlannerPhotoPrompt }
