// Shared low-level AI call plumbing: every feature that calls Gemini/OpenAI directly from the
// browser (K-Quiz generation, ask-your-notes, the handwritten-planner photo import) goes through
// this one place, so the auth/error handling only needs to be right once.
export type AiProvider = 'gemini' | 'openai'
export type PhotoInput = { base64: string; mimeType: string }

export const aiFail = (message: string): never => { throw new Error(message) }

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
  if (!response.ok) aiFail(
    response.status === 400 || response.status === 401 || response.status === 403 ? 'That Gemini API key was rejected. Check it in Settings.' :
    `Gemini request failed (${response.status}). Try again in a moment.`,
  )
  const data = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  return text ?? aiFail('Gemini returned an empty response. Try again.')
}

async function callOpenAI(prompt: string, apiKey: string, photo?: PhotoInput): Promise<string> {
  const content: unknown = photo ? [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: `data:${photo.mimeType};base64,${photo.base64}` } }] : prompt
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', response_format: { type: 'json_object' }, messages: [{ role: 'user', content }] }),
  })
  if (!response.ok) aiFail(response.status === 401 ? 'That OpenAI API key was rejected. Check it in Settings.' : `OpenAI request failed (${response.status}). Try again in a moment.`)
  const data = await response.json() as { choices?: { message?: { content?: string } }[] }
  const text = data.choices?.[0]?.message?.content
  return text ?? aiFail('OpenAI returned an empty response. Try again.')
}

/** KONO's built-in AI (the server's own key, for signed-in people with no key of their own). The
 * repository turns it on after sign-in when the server says it's available. */
type BuiltIn = (prompt: string, photo?: PhotoInput) => Promise<string>
let builtIn: BuiltIn | null = null
const CHANGE = 'kono-built-in-ai'
export function setBuiltInAi(fn: BuiltIn | null) { builtIn = fn; window.dispatchEvent(new Event(CHANGE)) }
export const builtInAiAvailable = () => builtIn !== null
export function onBuiltInAiChange(listener: () => void) { window.addEventListener(CHANGE, listener); return () => window.removeEventListener(CHANGE, listener) }
/** Ready when the person has their own key, or KONO's built-in AI is on for them. */
export const aiReady = (apiKey: string) => !!apiKey.trim() || builtIn !== null
export const needsAiMessage = 'Sign in with your email to use KONO’s AI, or add your own key in Settings › Import & export › AI helper.'

/** Sends a JSON-schema-constrained prompt (optionally with an attached photo) to whichever provider
 * the caller has a key for — or to KONO's built-in AI when there's no key — and returns the raw
 * response text, still unparsed/untrusted JSON. */
export async function callAi(prompt: string, provider: AiProvider, apiKey: string, photo?: PhotoInput): Promise<string> {
  if (!apiKey.trim()) return builtIn ? builtIn(prompt, photo) : aiFail(needsAiMessage)
  return provider === 'gemini' ? callGemini(prompt, apiKey, photo) : callOpenAI(prompt, apiKey, photo)
}
