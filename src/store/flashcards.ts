export type Flashcard = { id: string; question: string; answer: string; needsReview: boolean; reviewId?: string }
export type FlashcardDeck = { id: string; profileId: string; title: string; cards: Flashcard[] }

/** Deliberately structured input, not AI extraction. Treat all imported text as text. */
export function parseFlashcards(text: string, id: () => string): Flashcard[] {
  if (text.length > 100000) throw new Error('Keep the import under 100,000 characters.')
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim())
  if (!lines.length || lines.length > 200) throw new Error('Enter between 1 and 200 question-and-answer pairs.')
  return lines.map((line, index) => {
    const delimiter = line.includes('\t') ? '\t' : ' :: ', at = line.indexOf(delimiter)
    if (at < 0) throw new Error(`Line ${index + 1}: separate the question and answer with a tab or “ :: ”.`)
    const question = line.slice(0, at).trim(), answer = line.slice(at + delimiter.length).trim()
    if (!question || !answer || question.length > 2000 || answer.length > 5000) throw new Error(`Line ${index + 1}: add a question (up to 2,000 characters) and an answer (up to 5,000).`)
    return { id: id(), question, answer, needsReview: true }
  })
}

export function reviewQueue(deck: FlashcardDeck, missedOnly = false): string[] {
  // Unfamiliar cards first. A session reviews each once; users can repeat missed cards.
  return [...deck.cards].filter(c => !missedOnly || c.needsReview).sort((a, b) => Number(b.needsReview) - Number(a.needsReview)).map(c => c.id)
}
