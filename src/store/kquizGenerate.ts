import type { KQuizQuestion } from './model'

export type KQuizProvider = 'gemini' | 'openai'
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

const fail = (message: string): never => { throw new Error(message) }

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

function buildPhotoPrompt(): string {
  return `You are a study assistant. Read the handwritten or printed notes in the attached photo ` +
    `(work through any unclear handwriting using your best judgement), then ${OUTPUT_SCHEMA} Base ` +
    `everything only on the content of the photo.`
}

export type PhotoInput = { base64: string; mimeType: string }

async function callGemini(prompt: string, apiKey: string, photo?: PhotoInput): Promise<string> {
  const parts: unknown[] = [{ text: prompt }]
  if (photo) parts.push({ inline_data: { mime_type: photo.mimeType, data: photo.base64 } })
  // Google migrated the Gemini API to "auth keys" (the AQ.-prefixed format Google AI Studio now issues
  // by default) in mid-2026, authenticated via the x-goog-api-key header rather than a ?key= query
  // parameter — the classic AIzaSy-style keys sent that way are being phased out entirely. The header
  // works for both key formats, so every key goes through this one path.
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: 'application/json' } }),
  })
  if (!response.ok) fail(
    response.status === 400 || response.status === 401 || response.status === 403 ? 'That Gemini API key was rejected. Check it in Settings.' :
    `Gemini request failed (${response.status}). Try again in a moment.`,
  )
  const data = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  return text ?? fail('Gemini returned an empty response. Try again.')
}

async function callOpenAI(prompt: string, apiKey: string, photo?: PhotoInput): Promise<string> {
  const content: unknown = photo ? [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: `data:${photo.mimeType};base64,${photo.base64}` } }] : prompt
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', response_format: { type: 'json_object' }, messages: [{ role: 'user', content }] }),
  })
  if (!response.ok) fail(response.status === 401 ? 'That OpenAI API key was rejected. Check it in Settings.' : `OpenAI request failed (${response.status}). Try again in a moment.`)
  const data = await response.json() as { choices?: { message?: { content?: string } }[] }
  const text = data.choices?.[0]?.message?.content
  return text ?? fail('OpenAI returned an empty response. Try again.')
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
  if (!apiKey.trim()) fail('Add an API key in Settings first.')
  const prompt = buildPrompt(transcript)
  const raw = provider === 'gemini' ? await callGemini(prompt, apiKey.trim()) : await callOpenAI(prompt, apiKey.trim())
  return parseGenerated(raw)
}

export async function generateStudyMaterialsFromPhoto(photo: PhotoInput, provider: KQuizProvider, apiKey: string): Promise<GeneratedMaterials> {
  if (!apiKey.trim()) fail('Add an API key in Settings first.')
  const prompt = buildPhotoPrompt()
  const raw = provider === 'gemini' ? await callGemini(prompt, apiKey.trim(), photo) : await callOpenAI(prompt, apiKey.trim(), photo)
  return parseGenerated(raw)
}

/** Exposed for tests — exercises the same validation a real API response goes through. */
export const __test__ = { parseGenerated, buildPrompt, buildPhotoPrompt }
