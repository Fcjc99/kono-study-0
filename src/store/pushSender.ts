/** Sends due lock-screen reminders (see migration 0008). api/push-send.ts calls this every 5 minutes:
 * claim what's due (which removes it from the queue, so nothing is sent twice), send each to its
 * device, and forget devices the push service says are gone (404/410). */
export type DueReminder = { endpoint: string; p256dh: string; auth: string; title: string; body: string; tag: string | null }
export type PushDeps = {
  claim: () => Promise<DueReminder[]>
  forget: (endpoint: string) => Promise<void>
  send: (subscription: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string) => Promise<unknown>
}

export async function sendDueReminders(deps: PushDeps) {
  const due = await deps.claim()
  let sent = 0, failed = 0
  const gone = new Set<string>()
  for (const r of due) {
    if (gone.has(r.endpoint)) continue
    try {
      await deps.send({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }, JSON.stringify({ title: r.title, body: r.body, tag: r.tag ?? undefined }))
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
