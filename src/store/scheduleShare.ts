import { normalizeData, uid, type AppData, type StudySeason, type Subject } from './model'

export type ScheduleShare = { version: 1; season: StudySeason; subjects: Subject[] }

export function exportScheduleShare(data: AppData, seasonId: string): ScheduleShare {
  const season = data.studySeasons.find(s => s.id === seasonId)
  if (!season) throw new Error('That schedule could not be found.')
  const subjectIds = new Set<string>()
  for (const blocks of Object.values(season.week)) for (const block of blocks) if (block.subjectId) subjectIds.add(block.subjectId)
  const subjects = data.subjects.filter(s => subjectIds.has(s.id))
  return { version: 1, season, subjects }
}

function parseScheduleShare(raw: string): ScheduleShare {
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { throw new Error('This file is not a valid schedule share.') }
  if (!parsed || typeof parsed !== 'object' || (parsed as { version?: unknown }).version !== 1 || !(parsed as { season?: unknown }).season) throw new Error('This does not look like a KONO schedule share file.')
  return parsed as ScheduleShare
}

export function previewScheduleShare(raw: string) {
  const parsed = parseScheduleShare(raw)
  const classCount = Object.values(parsed.season.week).reduce((n, blocks) => n + (Array.isArray(blocks) ? blocks.length : 0), 0)
  return { name: parsed.season.name, start: parsed.season.start, end: parsed.season.end, classCount, subjectCount: parsed.subjects.length }
}

/** Always mints fresh IDs so loading a shared schedule can never collide with or silently replace the recipient's own data. */
export function importScheduleShare(data: AppData, profileId: string, raw: string): AppData {
  const parsed = parseScheduleShare(raw)
  const subjectIdMap = new Map<string, string>()
  const subjects: Subject[] = parsed.subjects.map(s => {
    const newId = uid('subject')
    subjectIdMap.set(s.id, newId)
    return { ...s, id: newId, profileId }
  })
  const week = Object.fromEntries(Object.entries(parsed.season.week).map(([day, blocks]) => [day, (blocks ?? []).map(b => ({ ...b, id: uid('block'), subjectId: b.subjectId ? subjectIdMap.get(b.subjectId) : undefined, completedDates: [], skippedDates: [], occurrenceNotes: {} }))]))
  const season: StudySeason = { ...parsed.season, id: uid('season'), profileId, active: false, week }
  return normalizeData({ ...data, subjects: [...data.subjects, ...subjects], studySeasons: [...data.studySeasons, season] })
}
