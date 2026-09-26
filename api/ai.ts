/// <reference types="node" />
import { handleAi } from '../src/store/aiProxy.js'

type Request = { method?: string; body?: unknown; headers: Record<string, string | string[] | undefined> }
type Response = { status(code: number): Response; setHeader(name: string, value: string): void; json(body: unknown): void }

// The Supabase address and publishable key are public (they're in the web app too); OPENAI_API_KEY is a
// secret set only in the Vercel project's Environment Variables.
const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim() || 'https://ooavktekwoguhttauvte.supabase.co'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY?.trim() || 'sb_publishable_5GOB_LMND1W2NSNmXwQLBA_RTFVemNR'

/** GET → whether built-in AI is on. POST {prompt, photo?} with the person's Supabase access token → {text}. */
export default async function handler(req: Request, res: Response) {
  res.setHeader('cache-control', 'no-store')
  if (req.method === 'GET') { res.status(200).json({ enabled: !!process.env.OPENAI_API_KEY }); return }
  if (req.method !== 'POST') { res.setHeader('allow', 'GET, POST'); res.status(405).json({ error: 'Use POST.' }); return }
  const auth = req.headers.authorization
  const token = typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7) : ''
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const result = await handleAi(token, body, { fetch, openaiKey: process.env.OPENAI_API_KEY, supabaseUrl, supabaseKey, model: process.env.KONO_AI_MODEL })
    res.status(result.status).json(result.body)
  } catch {
    res.status(502).json({ error: 'KONO’s AI couldn’t be reached. Try again in a moment.' })
  }
}
