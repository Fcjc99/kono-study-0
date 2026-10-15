import { localDate, type AppData } from './model'
import { classOccurrences } from './classSchedule'
import { schoolDay } from './schoolCalendar'
import { addDays } from './studyScheduler'

// RFC 5545: CRLF line endings, and any line over 75 octets must be "folded" onto a continuation
// line that starts with a single space.
function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line
  const parts: string[] = []
  let start = 0
  while (start < line.length) {
    let end = Math.min(start + 75, line.length)
    // Don't split a multi-byte UTF-8 character or a \n/\\/\;/\, escape sequence across folds.
    while (end > start && new TextEncoder().encode(line.slice(start, end)).length > 75) end--
    parts.push(line.slice(start, end))
    start = end
  }
  return parts.join('\r\n ')
}

function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function dateStamp(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

type IcsEvent = { uid: string; date: string; time?: string; endTime?: string; summary: string; description?: string; categories?: string; location?: string; rrule?: string }

function eventLines(event: IcsEvent, stamp: string): string[] {
  const lines = ['BEGIN:VEVENT', 'UID:' + event.uid + '@kono-study-sanctuary', 'DTSTAMP:' + stamp]
  const day = event.date.replace(/-/g, '')
  // A CalendarEvent may carry a specific time-of-day; tasks/exams are date-only, so those stay
  // all-day rather than implying a due time (like 12:00 AM) that was never actually set.
  if (event.time && /^\d{2}:\d{2}$/.test(event.time)) {
    lines.push('DTSTART:' + day + 'T' + event.time.replace(':', '') + '00')
    if (event.endTime && /^\d{2}:\d{2}$/.test(event.endTime) && event.endTime > event.time) lines.push('DTEND:' + day + 'T' + event.endTime.replace(':', '') + '00')
  }
  else lines.push('DTSTART;VALUE=DATE:' + day)
  lines.push('SUMMARY:' + escapeText(event.summary))
  if (event.description) lines.push('DESCRIPTION:' + escapeText(event.description))
  if (event.categories) lines.push('CATEGORIES:' + escapeText(event.categories))
  if (event.location) lines.push('LOCATION:' + escapeText(event.location))
  if (event.rrule) lines.push('RRULE:' + event.rrule)
  lines.push('END:VEVENT')
  return lines
}

/** A point-in-time snapshot of one profile's plan as a standard .ics file -- every assignment, exam
 * and calendar event becomes one VEVENT, so any calendar app (Google, Apple, Outlook) can import it
 * as a one-time batch of entries. No live sync: re-download after big changes to refresh it.
 * `subscribe`: the version calendar apps keep fetching from a private link (api/ics.ts). It has a
 * calendar name and leaves out notes, since anyone who has the link can read it.
 * Both also carry the school schedule from a week ago to two months ahead: at a rotation school each
 * school day as an all-day "Day 3" (and days off), and every class at its time, so Google or Apple
 * Calendar shows the rotation and picks up changes (a snow day, a corrected day) on the next refresh. */
export function buildIcs(data: AppData, profileId: string, options: { subscribe?: boolean; today?: string } = {}): string {
  const notes = (text: string) => options.subscribe ? undefined : text || undefined
  const subjectName = new Map(data.subjects.filter(s => s.profileId === profileId).map(s => [s.id, s.name]))
  const stamp = dateStamp()
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//KONO Study Sanctuary//Study Plan Export//EN', 'CALSCALE:GREGORIAN']
  if (options.subscribe) lines.push('X-WR-CALNAME:' + escapeText('KONO · ' + (data.profiles.find(p => p.id === profileId)?.label ?? 'Study plan')), 'REFRESH-INTERVAL;VALUE=DURATION:PT4H', 'X-PUBLISHED-TTL:PT4H')

  for (const t of data.tasks.filter(t => t.profileId === profileId)) {
    lines.push(...eventLines({ uid: 'task-' + t.id, date: t.due, summary: t.title, description: notes(t.notes), categories: subjectName.get(t.subjectId) }, stamp))
  }
  for (const e of data.exams.filter(e => e.profileId === profileId)) {
    lines.push(...eventLines({ uid: 'exam-' + e.id, date: e.due, summary: 'Exam: ' + e.title, description: notes(e.notes), categories: subjectName.get(e.subjectId) }, stamp))
  }
  for (const c of data.calendarEvents.filter(c => c.profileId === profileId)) {
    lines.push(...eventLines({ uid: 'event-' + c.id, date: c.date, time: c.time, endTime: c.endTime, summary: c.title, description: notes(c.notes), categories: c.subjectId ? subjectName.get(c.subjectId) : undefined, location: c.location }, stamp))
  }
  // Birthdays come back every year; a countdown is its one day.
  for (const x of (data.specialDays ?? []).filter(x => x.profileId === profileId)) {
    lines.push(...eventLines({ uid: 'special-' + x.id, date: x.date, summary: x.kind === 'birthday' ? '🎂 ' + x.title + '’s birthday' : (x.emoji || '🎉') + ' ' + x.title, ...(x.kind === 'birthday' ? { rrule: 'FREQ=YEARLY' } : {}) }, stamp))
  }

  const today = options.today ?? localDate(), first = addDays(today, -7), last = addDays(today, 60)
  for (const season of data.studySeasons.filter(x => x.profileId === profileId && x.active)) {
    const rotation = season.school && season.school.pattern !== 'weekly'
    for (let d = first < season.start ? season.start : first; d <= last && d <= season.end; d = addDays(d, 1)) {
      const day = season.school ? schoolDay(season, d) : undefined
      if (rotation && day && !day.closed && day.cycleDay) lines.push(...eventLines({ uid: 'school-' + season.id + '-' + d, date: d, summary: day.cycleDay + (day.special && day.exception ? ' · ' + day.exception.label : ''), description: season.school!.name, categories: 'School' }, stamp))
      else if (day?.closed && day.exception && (day.exception.kind === 'holiday' || day.exception.kind === 'snow') && season.school!.weekdays.includes(new Date(d + 'T12:00:00').getDay())) lines.push(...eventLines({ uid: 'school-' + season.id + '-' + d, date: d, summary: 'No school' + (day.exception.label ? ' · ' + day.exception.label : ''), description: season.school!.name, categories: 'School' }, stamp))
      for (const c of classOccurrences({ activeProfileId: profileId, studySeasons: [season] }, d)) {
        const start = c.displayStart ?? c.block.start, end = c.displayEnd ?? c.block.end
        if (c.timePending || !start || c.block.skippedDates?.includes(d) || (c.block.kind === 'break' && !/^lunch/i.test(c.block.label))) continue
        const slot = c.block.slot && /^(Period|Block) /.test(c.block.slot) ? c.block.slot + ' · ' : ''
        lines.push(...eventLines({ uid: 'class-' + c.block.id + '-' + d, date: d, time: start, endTime: end, summary: slot + c.block.label, location: c.block.location, categories: c.block.subjectId ? subjectName.get(c.block.subjectId) : undefined }, stamp))
      }
    }
  }

  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join('\r\n') + '\r\n'
}
