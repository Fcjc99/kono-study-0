/// <reference types="node" />
import { lookup as dnsLookup } from 'node:dns/promises'
import { fetchFeed } from '../src/store/calendarFeed.js'

type Request = { method?: string; body?: unknown }
type Response = { status(code: number): Response; setHeader(name: string, value: string): void; send(body: string): void; json(body: unknown): void }

const lookup = async (hostname: string) => (await dnsLookup(hostname, { all: true })).map(a => a.address)

/** POST {url} → the calendar's .ics text, for the calendar import in Settings › Import & export. */
export default async function handler(req: Request, res: Response) {
  res.setHeader('cache-control', 'no-store')
  if (req.method !== 'POST') { res.setHeader('allow', 'POST'); res.status(405).json({ error: 'Use POST.' }); return }
  try {
    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {}) as { url?: unknown }
    const text = await fetchFeed(typeof body.url === 'string' ? body.url.slice(0, 2000) : '', fetch, lookup)
    res.setHeader('content-type', 'text/calendar; charset=utf-8')
    res.status(200).send(text)
  } catch (error) {
    const message = error instanceof Error && !/fetch failed|aborted|timeout|JSON/i.test(error.message) ? error.message : 'Couldn’t reach that calendar. Check the link and try again.'
    res.status(400).json({ error: message })
  }
}
