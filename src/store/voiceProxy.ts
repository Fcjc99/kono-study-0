/** Ask KONO's natural voice: KONO's server reads an answer out loud with the owner's OpenAI key, for
 * signed-in people on devices other than iPhone and iPad (those use their own Premium voices). Used by
 * api/voice.ts. The sign-in and the voice allowance (kono_voice_take, separate from the AI requests) are
 * checked before OpenAI is called; nothing is stored. The audio comes back as base64 MP3. */
export type VoiceDeps = { fetch: typeof fetch; openaiKey?: string; supabaseUrl: string; supabaseKey: string; model?: string; voice?: string }
export type VoiceReply = { status: number; body: Record<string, unknown> }

/** Longer than any Ask KONO answer (a busy day, a full week). */
export const MAX_VOICE_TEXT = 1500
export const VOICE_STYLE = 'Speak like a warm, cheerful friend helping a student with their day: natural, relaxed pace, friendly and clear.'
const reply = (status: number, body: Record<string, unknown>): VoiceReply => ({ status, body })

export function readVoiceRequest(body: unknown): string | { error: string } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const text = typeof b.text === 'string' ? b.text.replace(/\s+/g, ' ').trim() : ''
  if (!text) return { error: 'Nothing to say.' }
  if (text.length > MAX_VOICE_TEXT) return { error: 'That’s too long to read out loud.' }
  return text
}

function base64(bytes: ArrayBuffer) {
  const all = new Uint8Array(bytes)
  let binary = ''
  for (let i = 0; i < all.length; i += 0x8000) binary += String.fromCharCode(...all.subarray(i, i + 0x8000))
  return btoa(binary)
}

export async function handleVoice(token: string, body: unknown, deps: VoiceDeps): Promise<VoiceReply> {
  if (!deps.openaiKey) return reply(503, { error: 'KONO’s natural voice isn’t turned on.' })
  if (!token) return reply(401, { error: 'Sign in with your email to use KONO’s natural voice.' })
  const text = readVoiceRequest(body)
  if (typeof text !== 'string') return reply(400, text)
  const headers = { apikey: deps.supabaseKey, authorization: 'Bearer ' + token }
  const who = await deps.fetch(deps.supabaseUrl + '/auth/v1/user', { headers })
  if (!who.ok) return reply(401, { error: 'Your sign-in has expired. Reload KONO and try again.' })
  const take = await deps.fetch(deps.supabaseUrl + '/rest/v1/rpc/kono_voice_take', { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: '{}' })
  if (!take.ok) return reply(503, { error: 'KONO’s voice allowance isn’t set up on the server yet.' })
  const allowance = await take.json() as { allowed?: boolean; used?: number; limit?: number }
  if (!allowance.allowed) return reply(429, { error: `KONO’s natural voice is resting until tomorrow (${allowance.limit ?? 40} answers a day).`, used: allowance.used, limit: allowance.limit })
  const model = deps.model || 'gpt-4o-mini-tts'
  const speech = await deps.fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + deps.openaiKey },
    // Only the gpt-4o voices take speaking directions; older models (tts-1) refuse them.
    body: JSON.stringify({ model, voice: deps.voice || 'coral', input: text, response_format: 'mp3', ...(model.startsWith('gpt-') ? { instructions: VOICE_STYLE } : {}) }),
  })
  if (!speech.ok) return reply(502, { error: `The voice service had a problem (${speech.status}).` })
  const audio = await speech.arrayBuffer()
  if (!audio.byteLength) return reply(502, { error: 'The voice service sent nothing back.' })
  return reply(200, { audio: base64(audio), type: 'audio/mpeg', used: allowance.used, limit: allowance.limit })
}
