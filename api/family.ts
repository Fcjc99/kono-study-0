/// <reference types="node" />
import { familyPageHtml, todayIn } from '../src/store/familyPage.js'
import type { AppData } from '../src/store/model.js'

type Request = { method?: string; query?: Record<string, string | string[] | undefined> }
type Response = { status(code: number): Response; setHeader(name: string, value: string): void; send(body: string): void }

const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim() || 'https://ooavktekwoguhttauvte.supabase.co'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY?.trim() || 'sb_publishable_5GOB_LMND1W2NSNmXwQLBA_RTFVemNR'
/** The view-only family page's links are saved as "<plan>#family", so a calendar (.ics) link never opens it. */
const SUFFIX = '#family'
const page = (res: Response, status: number, text: string) => { res.setHeader('content-type', 'text/html; charset=utf-8'); res.status(status).send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KONO</title><p style="font:18px system-ui;margin:40px auto;max-width:520px;padding:0 16px">${text}</p>`) }

/** GET ?t=TOKEN&tz=America/New_York → the family's next two weeks as a page (Settings › Family › Share with grandparents). */
export default async function handler(req: Request, res: Response) {
  res.setHeader('cache-control', 'private, max-age=300')
  res.setHeader('x-robots-tag', 'noindex')
  res.setHeader('referrer-policy', 'no-referrer')
  const token = typeof req.query?.t === 'string' ? req.query.t : '', tz = typeof req.query?.tz === 'string' ? req.query.tz.slice(0, 60) : ''
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.status(405).send('Use GET.'); return }
  if (!/^[a-f0-9]{32,128}$/.test(token)) { page(res, 404, 'This link isn’t right. Ask for a new one.'); return }
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/kono_calendar_feed`, { method: 'POST', headers: { apikey: supabaseKey, authorization: 'Bearer ' + supabaseKey, 'content-type': 'application/json' }, body: JSON.stringify({ p_token: token }) })
    const feed = response.ok ? await response.json() as { profileId: string; data: AppData } | null : null
    if (!feed?.data || !feed.profileId.endsWith(SUFFIX)) { page(res, 404, 'This family calendar link was turned off.'); return }
    res.setHeader('content-type', 'text/html; charset=utf-8')
    res.status(200).send(familyPageHtml(feed.data, feed.profileId.slice(0, -SUFFIX.length), todayIn(tz)))
  } catch {
    page(res, 502, 'Couldn’t load the calendar right now. Try again in a minute.')
  }
}
