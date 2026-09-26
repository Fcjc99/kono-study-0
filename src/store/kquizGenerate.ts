import type { KQuizQuestion } from './model'
import { needsAiMessage, aiReady, aiFail, callAi, type AiProvider, type PhotoInput } from './aiProvider'

export type KQuizProvider = AiProvider
export type { PhotoInput }
export type GeneratedMaterials = {
  summary: string
  studyGuide: string
  flashcards: { question: string; answer: string }[]
  questions: KQuizQuestion[]
}

const OUTPUT_SCHEMA =
  'produce study materials as a single JSON object with exactly these keys and nothing else:\n' +
  '{"summary": string (2-4 short paragraphs covering the main points),\n' +
  ' "studyGuide": string (a structured outline in markdown: headers for each major topic, bullet points for key facts and definitions),\n' +
  ' "flashcards": array of 10-20 {"question": string, "answer": string} pairs covering distinct facts or concepts,\n' +
  ' "questions": array of 8-14 practice questions, mixing types. Each is either\n' +
  '   {"type":"mcq","prompt": string,"choices": array of 3-5 strings,"correctIndex": integer index into choices}\n' +
  '   or {"type":"written","prompt": string,"answer": string (a model answer to compare against)}.}\n' +
  'Output ONLY the JSON object, no other text.'

const fail = aiFail

function buildPrompt(transcript: string): string {
  const trimmed = transcript.trim()
  if (!trimmed) fail('This lecture has no transcript yet to generate from.')
  // A very long transcript still costs pennies on the cheap models this targets, but capping keeps
  // one runaway recording from blowing through a free-tier daily quota in a single call.
  const capped = trimmed.length > 60000 ? trimmed.slice(0, 60000) + '\n[transcript truncated]' : trimmed
  return `You are a study assistant. Given a lecture transcript (it may include speech-recognition ` +
    `errors — use your best judgement to read through them), ${OUTPUT_SCHEMA} Base everything only ` +
    `on the transcript content.\n\nTRANSCRIPT:\n${capped}`
}

function buildAnswerPrompt(context: string, question: string): string {
  const trimmedContext = context.trim()
  if (!trimmedContext) fail('Check off at least one note or lecture to ask about first.')
  const trimmedQuestion = question.trim()
  if (!trimmedQuestion) fail('Type a question first.')
  const capped = trimmedContext.length > 60000 ? trimmedContext.slice(0, 60000) + '\n[notes truncated]' : trimmedContext
  return `You are a study assistant. A student is asking a question about their own notes below ` +
    `(they may include speech-recognition or handwriting-transcription errors — use your best ` +
    `judgement to read through them). Answer using only the material provided — if the notes don't ` +
    `contain enough to answer, say so plainly rather than guessing or using outside knowledge. Keep ` +
    `the answer focused: a few sentences to a short paragraph, unless the question calls for a list ` +
    `or steps. Respond with a single JSON object: {"answer": string}. Output ONLY the JSON object, ` +
    `no other text.\n\nNOTES:\n${capped}\n\nQUESTION:\n${trimmedQuestion}`
}

function buildTranscribePrompt(): string {
  return `You are a study assistant. Read the handwritten or printed notes in the attached photo ` +
    `(work through any unclear handwriting using your best judgement) and transcribe them faithfully ` +
    `as plain text, keeping headings, bullet points, and structure where it's reasonable to. Respond ` +
    `with a single JSON object: {"text": string}. Output ONLY the JSON object, no other text.`
}

/** The model is asked for strict JSON but is never trusted blindly — every field is validated the
 * same defensive way the rest of KONO validates saved data, so a malformed or partial AI response
 * fails clearly instead of quietly corrupting a study set. */
function parseGenerated(raw: string): GeneratedMaterials {
  let obj: unknown
  try { obj = JSON.parse(raw) } catch { fail('The AI response was not valid JSON. Try generating again.') }
  if (!obj || typeof obj !== 'object') fail('The AI response was not in the expected format.')
  const o = obj as Record<string, unknown>
  const summary = typeof o.summary === 'string' && o.summary.trim() ? o.summary.trim().slice(0, 20000) : fail('The AI response was missing a summary.')
  const studyGuide = typeof o.studyGuide === 'string' && o.studyGuide.trim() ? o.studyGuide.trim().slice(0, 50000) : fail('The AI response was missing a study guide.')
  if (!Array.isArray(o.flashcards) || !o.flashcards.length) fail('The AI response had no flashcards.')
  const flashcards = (o.flashcards as unknown[]).flatMap(c => {
    if (!c || typeof c !== 'object') return []
    const card = c as Record<string, unknown>
    if (typeof card.question !== 'string' || typeof card.answer !== 'string' || !card.question.trim() || !card.answer.trim()) return []
    return [{ question: card.question.trim().slice(0, 2000), answer: card.answer.trim().slice(0, 5000) }]
  }).slice(0, 40)
  if (!flashcards.length) fail('The AI response had no usable flashcards.')
  if (!Array.isArray(o.questions) || !o.questions.length) fail('The AI response had no practice questions.')
  const questions = (o.questions as unknown[]).flatMap((q, i): KQuizQuestion[] => {
    if (!q || typeof q !== 'object') return []
    const question = q as Record<string, unknown>
    const prompt = typeof question.prompt === 'string' ? question.prompt.trim().slice(0, 2000) : ''
    if (!prompt) return []
    const id = `q${i}`
    if (question.type === 'written') {
      if (typeof question.answer !== 'string' || !question.answer.trim()) return []
      return [{ id, type: 'written', prompt, answer: question.answer.trim().slice(0, 5000) }]
    }
    if (!Array.isArray(question.choices)) return []
    const choices = (question.choices as unknown[]).filter((c): c is string => typeof c === 'string' && !!c.trim()).map(c => c.slice(0, 500))
    if (choices.length < 2 || choices.length > 8) return []
    const correctIndex = typeof question.correctIndex === 'number' && Number.isInteger(question.correctIndex) && question.correctIndex >= 0 && question.correctIndex < choices.length ? question.correctIndex : -1
    if (correctIndex < 0) return []
    return [{ id, type: 'mcq', prompt, choices, correctIndex }]
  }).slice(0, 40)
  if (!questions.length) fail('The AI response had no usable practice questions.')
  return { summary, studyGuide, flashcards, questions }
}

export async function generateStudyMaterials(transcript: string, provider: KQuizProvider, apiKey: string): Promise<GeneratedMaterials> {
  if (!aiReady(apiKey)) aiFail(needsAiMessage)
  const raw = await callAi(buildPrompt(transcript), provider, apiKey.trim())
  return parseGenerated(raw)
}

function parseTranscription(raw: string): string {
  let obj: unknown
  try { obj = JSON.parse(raw) } catch { fail('The AI response was not valid JSON. Try again.') }
  if (!obj || typeof obj !== 'object') fail('The AI response was not in the expected format.')
  const text = (obj as Record<string, unknown>).text
  return typeof text === 'string' && text.trim() ? text.trim().slice(0, 200000) : fail('Could not read any text from that photo. Try a clearer photo.')
}

function parseAnswer(raw: string): string {
  let obj: unknown
  try { obj = JSON.parse(raw) } catch { fail('The AI response was not valid JSON. Try asking again.') }
  if (!obj || typeof obj !== 'object') fail('The AI response was not in the expected format.')
  const answer = (obj as Record<string, unknown>).answer
  return typeof answer === 'string' && answer.trim() ? answer.trim().slice(0, 10000) : fail('The AI did not return an answer. Try asking again.')
}

/** Reads a photo into plain text only — no summary/flashcards/questions yet. Scanning a photo just
 * adds it to a subject's running list of material; generating a study set happens later, over
 * whichever entries get checked off (see generateStudyMaterials, called with their combined text). */
export async function transcribePhoto(photo: PhotoInput, provider: KQuizProvider, apiKey: string): Promise<string> {
  if (!aiReady(apiKey)) aiFail(needsAiMessage)
  const raw = await callAi(buildTranscribePrompt(), provider, apiKey.trim(), photo)
  return parseTranscription(raw)
}

/** Answers a question grounded only in the student's own checked notes/lectures — no separate
 * summary or flashcards, just a direct answer, so this stays cheap enough to ask freely. */
export async function answerFromNotes(context: string, question: string, provider: KQuizProvider, apiKey: string): Promise<string> {
  if (!aiReady(apiKey)) aiFail(needsAiMessage)
  const raw = await callAi(buildAnswerPrompt(context, question), provider, apiKey.trim())
  return parseAnswer(raw)
}

/** Exposed for tests — exercises the same validation a real API response goes through. */
export const __test__ = { parseGenerated, parseTranscription, parseAnswer, buildPrompt, buildTranscribePrompt, buildAnswerPrompt }
