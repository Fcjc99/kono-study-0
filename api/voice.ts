/// <reference types="node" />
import { handleVoice } from '../src/store/voiceProxy.js'

type Request = { method?: string; body?: unknown; headers: Record<string, string | string[] | undefined> }
type Response = { status(code: number): Response; setHeader(name: string, value: string): void; json(body: unknown): void }

// Same public Supabase address and key as api/ai.ts; OPENAI_API_KEY is a secret set only in Vercel.
const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim() || 'https://ooavktekwoguhttauvte.supabase.co'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY?.trim() || 'sb_publishable_5GOB_LMND1W2NSNmXwQLBA_RTFVemNR'

/** POST {text} with the person's Supabase access token → {audio (base64 MP3), type}. */
export default async function handler(req: Request, res: Response) {
  res.setHeader('cache-control', 'no-store')
  if (req.method !== 'POST') { res.setHeader('allow', 'POST'); res.status(405).json({ error: 'Use POST.' }); return }
  const auth = req.headers.authorization
  const token = typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7) : ''
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const result = await handleVoice(token, body, { fetch, openaiKey: process.env.OPENAI_API_KEY, supabaseUrl, supabaseKey, model: process.env.KONO_VOICE_MODEL, voice: process.env.KONO_VOICE })
    res.status(result.status).json(result.body)
  } catch {
    res.status(502).json({ error: 'KONO’s voice couldn’t be reached.' })
  }
}
