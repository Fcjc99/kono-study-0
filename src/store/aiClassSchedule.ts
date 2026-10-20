import { uid } from './model'
import { needsAiMessage, aiReady, aiFail, callAi, type AiProvider, type PhotoInput } from './aiProvider'
import { weekdaysFrom } from './classTable'
import type { RotatingImportRow } from './schoolImport'

/** The fallback for class schedules the built-in reader can't follow: the person's own AI helper turns
 * the schedule's text (or photo) into classes, which they still review before anything is saved. */
export function classSchedulePrompt(cycle: string[], text?: string, periods?: number, extraRows: string[] = []): string {
  return `You are reading a student's class schedule${text ? ' (text copied from a PDF; table cells may be split across lines)' : ' from a photo'}. ` +
    `This schedule's days are named: ${cycle.map(d => JSON.stringify(d)).join(', ')}. ` +
    `Columns or rows headed like "D1", "D2 -" or "Day 1" are those rotation days. ` +
    `If the schedule's days are rotation days ("D1", "Day 1"…) that aren't among the day names above, never turn them into weekdays: put them in days exactly as written. ` +
    `For every class that meets on a regular day and time, return one entry; when a class meets in the same period (or at the same time) on several days, return it once with all those days; list a lecture, discussion, lab or section that meets at a different time as its own entry. ` +
    `If the schedule only shows periods (like "P1-Period 1") and no clock times, return each class with its period and set start and end to null; never guess times. ` +
    (periods ? `This school has ${periods} periods (also called blocks) every day, numbered 1 to ${periods}, so each day has at most ${periods} classes in them; return each period as "Period N". ` : '') +
    (extraRows.length ? `Each day also has ${extraRows.map(r => JSON.stringify(r)).join(' and ')} (its own row, with a class in it); return it with that as its period. ` : '') +
    `Row headings like "6-P5" or "5-ASP" are a row number, then the period: "6-P5" is Period 5 and "5-ASP" is ASP; the period is the part after the dash. ` +
    `A row that isn't numbered but has a class in it every day, like "ASP-Academic Support Period", is a period too: return its classes with that row's heading as the period. Skip lunch, passing time, homeroom or advisory unless it is clearly a class, and skip anything without a day and either a time or a period. ` +
    `When the schedule is a grid with periods down the side and days across the top (or no day headings at all, as in a cropped screenshot), read it column by column: the columns from left to right are the days in the order named above (the first column is ${JSON.stringify(cycle[0])}), and also return the whole grid in "grid". ` +
    `Respond with a single JSON object: {"dayHeadings": array of strings (the schedule's own day column or row headings, copied exactly as printed, like "Monday" or "D1 - Day 1"; empty if none show), ` +
    `"grid": null, or (for a grid) an array with one entry per row from top to bottom: {"period": string (the row heading as printed, like "1-P1"), "cells": array with one entry per day column from left to right, each null for an empty cell or {"name": string, "code": string or null, "room": string or null, "teacher": string or null}}, "classes": array of {"name": string (the class title), "code": string or null (course code or section, if shown), ` +
    `"days": array of one or more of the day names above, "start": "HH:MM" 24-hour or null, "end": "HH:MM" 24-hour or null, "period": string or null (the period the class meets in, like "Period 1", when shown), ` +
    `"building": string or null, "room": string or null, "teacher": string or null}}. Output ONLY the JSON object, no other text.` +
    (text ? `\n\nSchedule text:\n${text.slice(0, 30000)}` : '')
}

const clock = (value: unknown) => {
  const m = typeof value === 'string' ? value.trim().match(/^(\d{1,2}):(\d{2})$/) : null
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return ''
  return m[1].padStart(2, '0') + ':' + m[2]
}
/** "P1", "Period 1", "P1-Period 1", "1-P1" → "Period 1"; "ASP-Academic Support Period" → "ASP" (a short code before
 * its name); other labels (like "Block A") are kept as written. */
export function periodLabel(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return ''
  // "6-P5" (a row number, then the period) is Period 5; "5-ASP" is ASP.
  const text = value.replace(/^\s*\d{1,2}\s*-\s*(?=[A-Za-z])/, '')
  const m = text.match(/\b(?:p(?:er(?:iod)?)?)\s*-?\s*(\d{1,2})\b/i)
  const code = text.match(/^\s*([A-Z]{2,5})\s*-\s*[A-Za-z]/)
  return m ? 'Period ' + Number(m[1]) : code ? code[1] : text.replace(/\s+/g, ' ').trim().slice(0, 30)
}
/** "D3", "D3 -", "Day 3" → "Day 3" when the rotation has it. */
const rotationDay = (value: string, cycle: string[]) => { const m = value.match(/^\s*d(?:ay)?\s*-?\s*(\d{1,2})\b/i); return m && cycle.includes('Day ' + Number(m[1])) ? ['Day ' + Number(m[1])] : undefined }
const words = (value: unknown, max: number) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''

const ROTATION_ON_WEEKLY = 'This schedule uses rotation days (D1, D2…), not weekdays. Go back to step 1 and pick your school’s rotation option (like “Duxbury Middle School · 14-day rotation”), or set up a school with rotation days.'

/** Checks every field of the AI's answer; anything unusable is dropped rather than guessed. */
export function parseAiClassSchedule(raw: string, cycle: string[], start: string, end: string): RotatingImportRow[] {
  let obj: unknown
  try { obj = JSON.parse(raw) } catch { aiFail('The AI response was not valid JSON. Try again.') }
  const classes = obj && typeof obj === 'object' ? (obj as Record<string, unknown>).classes : undefined
  if (!Array.isArray(classes)) aiFail('The AI response was not in the expected format. Try again.')
  // KONO checks the schedule's own headings itself: a rotation-day schedule (D1–D14) can't fill a
  // Monday–Friday school, even when the AI turned its days into weekdays.
  const headings = (obj as Record<string, unknown>).dayHeadings
  const rotationHeadings = Array.isArray(headings) && headings.some(h => typeof h === 'string' && /^\s*d(?:ay)?\s*-?\s*\d{1,2}\b/i.test(h))
  if (rotationHeadings && !cycle.some(d => /^Day \d/.test(d))) aiFail(ROTATION_ON_WEEKLY)
  const byName = new Map(cycle.map(day => [day.toLowerCase(), day]))
  const rows: RotatingImportRow[] = []
  // A grid (periods down the side, days across): its columns are the days in order, so a cropped
  // screenshot without its day headings still reads; the class list is only used when there's no grid.
  const grid = (obj as Record<string, unknown>).grid
  // Each column's day: from its printed heading when every heading names a day, else in the cycle's order.
  const printed = Array.isArray(headings) ? headings.map(h => typeof h === 'string' ? byName.get(h.trim().toLowerCase()) ?? rotationDay(h, cycle)?.[0] ?? weekdaysFrom(h, cycle)[0] : undefined) : []
  const columnDay = (i: number) => (printed.length && printed.every(Boolean) ? printed[i] : undefined) ?? cycle[i]
  if (Array.isArray(grid)) {
    for (const row of grid.slice(0, 12)) {
      if (!row || typeof row !== 'object') continue
      const period = periodLabel((row as Record<string, unknown>).period), cells = (row as Record<string, unknown>).cells
      if (!period || !Array.isArray(cells)) continue
      cells.slice(0, cycle.length).forEach((cell, i) => {
        const c = typeof cell === 'string' ? {name: cell} : cell && typeof cell === 'object' ? cell as Record<string, unknown> : null
        const name = c ? words(c.name, 200) : '', code = c ? words(c.code, 30) : ''
        if (!c || !name) return
        const location = [words(c.room, 40), words(c.teacher, 100)].filter(Boolean).join(' · ').slice(0, 160)
        rows.push({ id: uid('import-block'), include: true, day: columnDay(i), label: [code, name].filter(Boolean).join(' · ').slice(0, 200), slot: period, start: '', end: '', dateStart: start, dateEnd: end, kind: 'study', location })
      })
    }
    if (rows.length >= cycle.length) return rows
    rows.length = 0
  }
  let rotationDays = 0
  // Up to 14 rotation days × 8 periods, one entry per class and period (a 14-day middle-school matrix is 84).
  for (const item of (classes as unknown[]).slice(0, 120)) {
    if (!item || typeof item !== 'object') continue
    const c = item as Record<string, unknown>
    const name = words(c.name, 200), code = words(c.code, 30), from = clock(c.start), to = clock(c.end), period = periodLabel(c.period)
    // A period without clock times is kept with empty times; the student sets each period's times once.
    const timed = !!from && !!to && to > from
    if (!name || (!timed && !period)) continue
    const listed = Array.isArray(c.days) ? c.days.filter((d): d is string => typeof d === 'string') : []
    const days = [...new Set(listed.flatMap(d => byName.get(d.trim().toLowerCase()) ?? rotationDay(d, cycle) ?? weekdaysFrom(d, cycle)))]
    if (!days.length && listed.some(d => /^\s*d(?:ay)?\s*-?\s*\d{1,2}\b/i.test(d))) rotationDays++
    const place = [words(c.building, 100), words(c.room, 40)].filter(Boolean).join(' ')
    const location = [place, words(c.teacher, 100)].filter(Boolean).join(' · ').slice(0, 160)
    const label = [code, name].filter(Boolean).join(' · ').slice(0, 200)
    for (const day of days) rows.push({ id: uid('import-block'), include: true, day, label, slot: timed ? code : period, start: timed ? from : '', end: timed ? to : '', dateStart: start, dateEnd: end, kind: 'study', location })
  }
  // A rotation-day schedule (D1–D14) read for a Monday–Friday school: it's the wrong kind of school.
  if (!rows.length && rotationDays) aiFail(ROTATION_ON_WEEKLY)
  return rows
}

export async function readClassScheduleWithAi(input: { text?: string; photo?: PhotoInput }, cycle: string[], start: string, end: string, provider: AiProvider, apiKey: string, periods?: number, extraRows?: string[]): Promise<RotatingImportRow[]> {
  if (!aiReady(apiKey)) aiFail(needsAiMessage)
  if (!input.photo && !input.text?.trim()) aiFail('Nothing was read from this file to send.')
  const rows = parseAiClassSchedule(await callAi(classSchedulePrompt(cycle, input.photo ? undefined : input.text, periods, extraRows), provider, apiKey.trim(), input.photo), cycle, start, end)
  if (!rows.length) aiFail('The AI helper found no classes with a day and time either. Add them by hand below.')
  return rows
}
