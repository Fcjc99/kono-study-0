/// <reference types="node" />
import { lookup as dnsLookup } from 'node:dns/promises'
import { canvasItems, canvasMark } from '../src/store/canvasApi.js'

type Request = { method?: string; body?: unknown }
type Response = { status(code: number): Response; setHeader(name: string, value: string): void; json(body: unknown): void }

const lookup = async (hostname: string) => (await dnsLookup(hostname, { all: true })).map(a => a.address)
const text = (v: unknown, max: number) => typeof v === 'string' ? v.slice(0, max) : ''

/** POST {base, token, action:'items', start, end} → {name, items}; {base, token, action:'mark', type, id, done} → {ok}.
 * Two-way Canvas (Settings › Import & export). The token is used for this one request and never kept. */
export default async function handler(req: Request, res: Response) {
  res.setHeader('cache-control', 'no-store')
  if (req.method !== 'POST') { res.setHeader('allow', 'POST'); res.status(405).json({ error: 'Use POST.' }); return }
  try {
    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {}) as Record<string, unknown>
    const base = text(body.base, 300), token = text(body.token, 300)
    if (body.action === 'items') { res.status(200).json(await canvasItems(base, token, text(body.start, 10), text(body.end, 10), fetch, lookup)); return }
    if (body.action === 'mark') { await canvasMark(base, token, text(body.type, 40), text(body.id, 20), body.done === true, fetch, lookup); res.status(200).json({ ok: true }); return }
    res.status(400).json({ error: 'Unknown Canvas action.' })
  } catch (error) {
    const message = error instanceof Error && !/fetch failed|aborted|timeout|JSON/i.test(error.message) ? error.message : 'Couldn’t reach Canvas. Check the address and try again.'
    res.status(400).json({ error: message })
  }
}
