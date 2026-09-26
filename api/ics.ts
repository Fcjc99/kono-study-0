/// <reference types="node" />
import { buildIcs } from '../src/store/icsExport.js'
import type { AppData } from '../src/store/model.js'

type Request = { method?: string; query?: Record<string, string | string[] | undefined> }
type Response = { status(code: number): Response; setHeader(name: string, value: string): void; send(body: string): void }

const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim() || 'https://ooavktekwoguhttauvte.supabase.co'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY?.trim() || 'sb_publishable_5GOB_LMND1W2NSNmXwQLBA_RTFVemNR'

/** GET ?t=TOKEN → that plan's assignments, exams and events as a calendar Google/Apple Calendar can subscribe to. */
export default async function handler(req: Request, res: Response) {
  res.setHeader('cache-control', 'private, max-age=900')
  const token = typeof req.query?.t === 'string' ? req.query.t : ''
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.status(405).send('Use GET.'); return }
  if (!/^[a-f0-9]{32,128}$/.test(token)) { res.status(404).send('Not found'); return }
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/kono_calendar_feed`, { method: 'POST', headers: { apikey: supabaseKey, authorization: 'Bearer ' + supabaseKey, 'content-type': 'application/json' }, body: JSON.stringify({ p_token: token }) })
    const feed = response.ok ? await response.json() as { profileId: string; data: AppData } | null : null
    if (!feed?.data) { res.status(404).send('This calendar link was turned off.'); return }
    res.setHeader('content-type', 'text/calendar; charset=utf-8')
    res.setHeader('content-disposition', 'inline; filename="kono.ics"')
    res.status(200).send(buildIcs(feed.data, feed.profileId, { subscribe: true }))
  } catch {
    res.status(502).send('Could not load this calendar right now.')
  }
}
