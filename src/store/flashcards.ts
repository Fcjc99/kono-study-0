import {srsInitial, isDue, type SrsState} from './spacedRepetition'

export type Flashcard = { id: string; question: string; answer: string; reviewId?: string } & SrsState
export type FlashcardDeck = { id: string; profileId: string; title: string; cards: Flashcard[] }

/** Deliberately structured input, not AI extraction. Treat all imported text as text. */
export function parseFlashcards(text: string, id: () => string, today: string): Flashcard[] {
  if (text.length > 100000) throw new Error('Keep the import under 100,000 characters.')
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim())
  if (!lines.length || lines.length > 200) throw new Error('Enter between 1 and 200 question-and-answer pairs.')
  return lines.map((line, index) => {
    const delimiter = line.includes('\t') ? '\t' : ' :: ', at = line.indexOf(delimiter)
    if (at < 0) throw new Error(`Line ${index + 1}: separate the question and answer with a tab or “ :: ”.`)
    const question = line.slice(0, at).trim(), answer = line.slice(at + delimiter.length).trim()
    if (!question || !answer || question.length > 2000 || answer.length > 5000) throw new Error(`Line ${index + 1}: add a question (up to 2,000 characters) and an answer (up to 5,000).`)
    return { id: id(), question, answer, ...srsInitial(today) }
  })
}

/** Only cards actually due today by default -- most-overdue first, so the session reflects what
 * spaced repetition says is worth reviewing right now rather than the whole deck every time.
 * missedOnly narrows that further to cards still in box zero (missed this round or never learned). */
export function reviewQueue(deck: FlashcardDeck, today: string, missedOnly = false): string[] {
  const due = deck.cards.filter(c => isDue(c, today))
  return [...(missedOnly ? due.filter(c => c.interval === 0) : due)].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map(c => c.id)
}

/** For "study anyway" when nothing is due -- every card, least-recently-due first. */
export function fullDeckQueue(deck: FlashcardDeck): string[] {
  return [...deck.cards].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map(c => c.id)
}

export function nextDueIn(deck: FlashcardDeck, today: string): number | null {
  const upcoming = deck.cards.filter(c => !isDue(c, today))
  if (!upcoming.length) return null
  const soonest = upcoming.reduce((min, c) => c.dueDate < min ? c.dueDate : min, upcoming[0].dueDate)
  return Math.round((new Date(soonest + 'T12:00:00').getTime() - new Date(today + 'T12:00:00').getTime()) / 86400000)
}
