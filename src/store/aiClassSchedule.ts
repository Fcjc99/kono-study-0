import { uid } from './model'
import { needsAiMessage, aiReady, aiFail, callAi, type AiProvider, type PhotoInput } from './aiProvider'
import { weekdaysFrom } from './classTable'
import type { RotatingImportRow } from './schoolImport'

/** The fallback for class schedules the built-in reader can't follow: the person's own AI helper turns
 * the schedule's text (or photo) into classes, which they still review before anything is saved. */
export function classSchedulePrompt(cycle: string[], text?: string): string {
  return `You are reading a student's class schedule${text ? ' (text copied from a PDF; table cells may be split across lines)' : ' from a photo'}. ` +
    `This schedule's days are named: ${cycle.map(d => JSON.stringify(d)).join(', ')}. ` +
    `For every class that meets on a regular day and time, return one entry; list a lecture, discussion, lab or section that meets at a different time as its own entry. ` +
    `Skip lunch, passing time, homeroom or advisory unless it is clearly a class, and skip anything without a day and time. ` +
    `Respond with a single JSON object: {"classes": array of {"name": string (the class title), "code": string or null (course code or section, if shown), ` +
    `"days": array of one or more of the day names above, "start": "HH:MM" 24-hour, "end": "HH:MM" 24-hour, ` +
    `"building": string or null, "room": string or null, "teacher": string or null}}. Output ONLY the JSON object, no other text.` +
    (text ? `\n\nSchedule text:\n${text.slice(0, 30000)}` : '')
}

const clock = (value: unknown) => {
  const m = typeof value === 'string' ? value.trim().match(/^(\d{1,2}):(\d{2})$/) : null
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return ''
  return m[1].padStart(2, '0') + ':' + m[2]
}
const words = (value: unknown, max: number) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''

/** Checks every field of the AI's answer; anything unusable is dropped rather than guessed. */
export function parseAiClassSchedule(raw: string, cycle: string[], start: string, end: string): RotatingImportRow[] {
  let obj: unknown
  try { obj = JSON.parse(raw) } catch { aiFail('The AI response was not valid JSON. Try again.') }
  const classes = obj && typeof obj === 'object' ? (obj as Record<string, unknown>).classes : undefined
  if (!Array.isArray(classes)) aiFail('The AI response was not in the expected format. Try again.')
  const byName = new Map(cycle.map(day => [day.toLowerCase(), day]))
  const rows: RotatingImportRow[] = []
  for (const item of (classes as unknown[]).slice(0, 60)) {
    if (!item || typeof item !== 'object') continue
    const c = item as Record<string, unknown>
    const name = words(c.name, 200), code = words(c.code, 30), from = clock(c.start), to = clock(c.end)
    if (!name || !from || !to || to <= from) continue
    const listed = Array.isArray(c.days) ? c.days.filter((d): d is string => typeof d === 'string') : []
    const days = [...new Set(listed.flatMap(d => byName.get(d.trim().toLowerCase()) ?? weekdaysFrom(d, cycle)))]
    const place = [words(c.building, 100), words(c.room, 40)].filter(Boolean).join(' ')
    const location = [place, words(c.teacher, 100)].filter(Boolean).join(' · ').slice(0, 160)
    const label = [code, name].filter(Boolean).join(' · ').slice(0, 200)
    for (const day of days) rows.push({ id: uid('import-block'), include: true, day, label, slot: code, start: from, end: to, dateStart: start, dateEnd: end, kind: 'study', location })
  }
  return rows
}

export async function readClassScheduleWithAi(input: { text?: string; photo?: PhotoInput }, cycle: string[], start: string, end: string, provider: AiProvider, apiKey: string): Promise<RotatingImportRow[]> {
  if (!aiReady(apiKey)) aiFail(needsAiMessage)
  if (!input.photo && !input.text?.trim()) aiFail('Nothing was read from this file to send.')
  const rows = parseAiClassSchedule(await callAi(classSchedulePrompt(cycle, input.photo ? undefined : input.text), provider, apiKey.trim(), input.photo), cycle, start, end)
  if (!rows.length) aiFail('The AI helper found no classes with a day and time either. Add them by hand below.')
  return rows
}
