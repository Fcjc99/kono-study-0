/// <reference types="node" />
import { mintTryOnToken, originAllowed } from '../src/shop/tryonToken.js'

type Request = { method?: string; headers: Record<string, string | string[] | undefined> }
type Response = { status(code: number): Response; setHeader(name: string, value: string): void; json(body: unknown): void }
const header = (req: Request, name: string) => { const v = req.headers[name]; return Array.isArray(v) ? v[0] : v }

/** GET → whether the AI fitting room is on. POST from the shop page → a short-lived Decart client key.
 * DECART_API_KEY is a secret set only in the Vercel project's Environment Variables. */
export default async function handler(req: Request, res: Response) {
  res.setHeader('cache-control', 'no-store')
  if (req.method === 'GET') { res.status(200).json({ enabled: !!process.env.DECART_API_KEY }); return }
  if (req.method !== 'POST') { res.setHeader('allow', 'GET, POST'); res.status(405).json({ error: 'Use POST.' }); return }
  const origin = header(req, 'origin')
  if (header(req, 'sec-fetch-site') === 'cross-site' || !originAllowed(origin, header(req, 'x-forwarded-host') ?? header(req, 'host'), process.env.KONO_SHOP_ORIGINS)) { res.status(403).json({ error: 'Use the fitting room on the KONO shop.' }); return }
  try {
    const result = await mintTryOnToken(origin, { apiKey: process.env.DECART_API_KEY, fetch })
    res.status(result.status).json(result.body)
  } catch {
    res.status(502).json({ error: 'The AI fitting room couldn’t be reached. Try again in a moment.' })
  }
}
