/// <reference types="node" />
import webpush from 'web-push'
import { sameSecret, sendDueReminders, type DueReminder } from '../src/store/pushSender.js'

type Request = { method?: string; headers: Record<string, string | string[] | undefined> }
type Response = { status(code: number): Response; setHeader(name: string, value: string): void; json(body: unknown): void }

const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim() || 'https://ooavktekwoguhttauvte.supabase.co'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY?.trim() || 'sb_publishable_5GOB_LMND1W2NSNmXwQLBA_RTFVemNR'

async function rpc(name: string, args: Record<string, string>) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, { method: 'POST', headers: { apikey: supabaseKey, authorization: 'Bearer ' + supabaseKey, 'content-type': 'application/json' }, body: JSON.stringify(args) })
  if (!response.ok) throw Error(`${name} failed (${response.status})`)
  return response.status === 204 ? null : response.json()
}

/** POST from Supabase's pg_cron every 5 minutes (header x-kono-cron = PUSH_CRON_SECRET): send due reminders. */
export default async function handler(req: Request, res: Response) {
  res.setHeader('cache-control', 'no-store')
  const secret = process.env.PUSH_CRON_SECRET?.trim() ?? '', header = req.headers['x-kono-cron']
  if (req.method !== 'POST' || !sameSecret(typeof header === 'string' ? header : '', secret)) { res.status(404).json({ error: 'Not found' }); return }
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim(), privateKey = process.env.VAPID_PRIVATE_KEY?.trim()
  if (!publicKey || !privateKey) { res.status(503).json({ error: 'Push keys are not set.' }); return }
  // Push services want a contact: VAPID_SUBJECT (mailto:you@… or https://…), else this site's own address.
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  webpush.setVapidDetails(process.env.VAPID_SUBJECT?.trim() || (production ? 'https://' + production : 'https://vercel.app'), publicKey, privateKey)
  try {
    const result = await sendDueReminders({
      claim: async () => (await rpc('kono_push_claim', { p_secret: secret }) ?? []) as DueReminder[],
      forget: async endpoint => { await rpc('kono_push_forget', { p_secret: secret, p_endpoint: endpoint }) },
      send: (subscription, payload) => webpush.sendNotification(subscription, payload, { TTL: 3600, urgency: 'normal' }),
    })
    res.status(200).json(result)
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : 'Could not send reminders.' })
  }
}
