/** Built-in AI: KONO's server answers AI requests with the owner's OpenAI key, for signed-in people who
 * haven't added their own key. Used by api/ai.ts. Every request is checked against the person's Supabase
 * sign-in and their daily allowance (kono_ai_take) before OpenAI is called; nothing is stored. */
export type AiPhoto = { base64: string; mimeType: string }
export type AiRequest = { prompt: string; photo?: AiPhoto }
export type AiDeps = { fetch: typeof fetch; openaiKey?: string; supabaseUrl: string; supabaseKey: string; model?: string }
export type AiReply = { status: number; body: Record<string, unknown> }

const MAX_PROMPT = 60_000, MAX_PHOTO = 3_500_000
const reply = (status: number, body: Record<string, unknown>): AiReply => ({ status, body })

export function readAiRequest(body: unknown): AiRequest | string {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  if (typeof b.prompt !== 'string' || !b.prompt.trim()) return 'Nothing to ask.'
  if (b.prompt.length > MAX_PROMPT) return 'That’s too much text for one request. Try a shorter part.'
  if (b.photo === undefined || b.photo === null) return { prompt: b.prompt }
  const p = b.photo as Record<string, unknown>
  if (typeof p.base64 !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(p.base64) || typeof p.mimeType !== 'string' || !/^image\/(jpeg|png|webp)$/.test(p.mimeType)) return 'That photo couldn’t be read.'
  if (p.base64.length > MAX_PHOTO) return 'That photo is too large. Crop it to the part you need.'
  return { prompt: b.prompt, photo: { base64: p.base64, mimeType: p.mimeType } }
}

export async function handleAi(token: string, body: unknown, deps: AiDeps): Promise<AiReply> {
  if (!deps.openaiKey) return reply(503, { error: 'KONO’s built-in AI isn’t turned on yet. Add your own key in AI helper, or ask KONO support.' })
  if (!token) return reply(401, { error: 'Sign in with your email to use KONO’s AI.' })
  const request = readAiRequest(body)
  if (typeof request === 'string') return reply(400, { error: request })
  const headers = { apikey: deps.supabaseKey, authorization: 'Bearer ' + token }
  const who = await deps.fetch(deps.supabaseUrl + '/auth/v1/user', { headers })
  if (!who.ok) return reply(401, { error: 'Your sign-in has expired. Reload KONO and try again.' })
  const take = await deps.fetch(deps.supabaseUrl + '/rest/v1/rpc/kono_ai_take', { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: '{}' })
  if (!take.ok) return reply(503, { error: 'KONO’s AI allowance isn’t set up on the server yet.' })
  const allowance = await take.json() as { allowed?: boolean; used?: number; limit?: number }
  if (!allowance.allowed) return reply(429, { error: `You’ve used today’s ${allowance.limit ?? 40} AI requests. They reset at midnight UTC (8 PM Eastern). You can also add your own key in AI helper.`, used: allowance.used, limit: allowance.limit })
  const content: unknown = request.photo ? [{ type: 'text', text: request.prompt }, { type: 'image_url', image_url: { url: `data:${request.photo.mimeType};base64,${request.photo.base64}` } }] : request.prompt
  const ai = await deps.fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + deps.openaiKey },
    body: JSON.stringify({ model: deps.model || 'gpt-4o-mini', response_format: { type: 'json_object' }, max_tokens: 4000, messages: [{ role: 'user', content }] }),
  })
  if (!ai.ok) return reply(502, { error: ai.status === 429 ? 'KONO’s AI is busy right now. Try again in a minute.' : `The AI service had a problem (${ai.status}). Try again in a moment.` })
  const data = await ai.json() as { choices?: { message?: { content?: string } }[] }
  const text = data.choices?.[0]?.message?.content
  if (!text) return reply(502, { error: 'The AI returned an empty answer. Try again.' })
  return reply(200, { text, used: allowance.used, limit: allowance.limit })
}
