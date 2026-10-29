/** Sends due lock-screen reminders (see migration 0008). api/push-send.ts calls this every 5 minutes:
 * claim what's due (which removes it from the queue, so nothing is sent twice), send each to its
 * device, and forget devices the push service says are gone (404/410). */
export type DueReminder = { endpoint: string; p256dh: string; auth: string; title: string; body: string; tag: string | null }
export type PushDeps = {
  claim: () => Promise<DueReminder[]>
  forget: (endpoint: string) => Promise<void>
  send: (subscription: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string) => Promise<unknown>
  /** This site's https address, for where a tapped reminder opens (Declarative Web Push needs it). */
  appUrl?: string
}

/** A reminder's push message. KONO's service worker reads title/body/tag (Chrome, Firefox, Android);
 * Safari on iPhone and Mac (iOS 18.4+) also reads the Declarative Web Push part (web_push 8030), so it
 * can show the reminder even when the service worker isn't woken in time. */
export function reminderPayload(r: Pick<DueReminder, 'title' | 'body' | 'tag'>, appUrl?: string) {
  const base = { title: r.title, body: r.body, tag: r.tag ?? undefined }
  if (!appUrl || !/^https:\/\//.test(appUrl)) return JSON.stringify(base)
  return JSON.stringify({ ...base, web_push: 8030, notification: { title: r.title, body: r.body, navigate: new URL('/?page=planner', appUrl).href, ...(r.tag ? { tag: r.tag } : {}), lang: 'en-US', dir: 'ltr' } })
}

export async function sendDueReminders(deps: PushDeps) {
  const due = await deps.claim()
  let sent = 0, failed = 0
  const gone = new Set<string>()
  for (const r of due) {
    if (gone.has(r.endpoint)) continue
    try {
      await deps.send({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }, reminderPayload(r, deps.appUrl))
      sent++
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) { gone.add(r.endpoint); await deps.forget(r.endpoint).catch(() => undefined) } else failed++
    }
  }
  return { due: due.length, sent, failed, forgotten: gone.size }
}

/** Compares secrets without leaking how much of a guess was right through timing. */
export function sameSecret(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
