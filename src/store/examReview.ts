import { addDays } from './studyScheduler'
import { uid, type AppData, type CalendarEvent, type CalendarEventKind } from './model'

export type ReviewScheduleResult =
  { ok: false; message: string } |
  { ok: true; events: CalendarEvent[]; message: string }

const REVIEW_OFFSETS_DAYS = [14, 7, 3, 1]

/** Counts backward from an exam date using whatever K-Quiz flashcard decks already exist for its
 * subject, so the exam countdown isn't just a ticking clock -- it actively paces review. Offsets are
 * fixed (not configurable) to keep this a one-click action. Re-running it only fills in gaps: it
 * never schedules a session on a date that already has one for this exact exam. */
export function planExamReview(params: {
  profileId: string
  subjectId: string
  examTitle: string
  due: string
  today: string
  kquizSets: AppData['kquizSets']
  flashcardDecks: AppData['flashcardDecks']
  calendarEvents: AppData['calendarEvents']
}): ReviewScheduleResult {
  const { profileId, subjectId, examTitle, due, today, kquizSets, flashcardDecks, calendarEvents } = params
  const deckTitles = [...new Set(
    kquizSets.filter(s => s.profileId === profileId && s.subjectId === subjectId && s.flashcardDeckId)
      .map(s => flashcardDecks.find(d => d.id === s.flashcardDeckId)?.title)
      .filter((t): t is string => !!t),
  )]
  if (!deckTitles.length) return { ok: false, message: 'No K-Quiz flashcards yet for this subject — generate a study set first, then schedule review.' }
  const dates = [...new Set(REVIEW_OFFSETS_DAYS.map(offset => addDays(due, -offset)))].filter(d => d >= today && d < due).sort()
  if (!dates.length) return { ok: false, message: 'This exam is too close to schedule review sessions ahead of it.' }
  const reviewTitle = 'Review — ' + examTitle
  const already = new Set(calendarEvents.filter(e => e.profileId === profileId && e.subjectId === subjectId && e.title === reviewTitle).map(e => e.date))
  const toCreate = dates.filter(d => !already.has(d))
  if (!toCreate.length) return { ok: false, message: 'Review sessions are already scheduled for this exam.' }
  const events: CalendarEvent[] = toCreate.map(date => ({
    id: uid('event'), profileId, subjectId, title: reviewTitle,
    kind: 'study' as CalendarEventKind, date, notes: 'Spaced review before your exam. Study: ' + deckTitles.join(', ') + '.', done: false,
  }))
  return { ok: true, events, message: `${toCreate.length} review session${toCreate.length === 1 ? '' : 's'} scheduled leading up to the exam.` }
}
