import { useEffect, useState } from 'react'
import type { usePlannerRepository } from '../store/repository'

type Store = ReturnType<typeof usePlannerRepository>

/** A private link Google Calendar or Apple Calendar subscribes to, so KONO's assignments, exams and
 * events show up there and stay up to date (calendar apps re-check it every few hours). */
export default function CalendarSubscribe({ store, profileId, planLabel }: { store: Store; profileId: string; planLabel: string }) {
  const [token, setToken] = useState<string | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [copied, setCopied] = useState('')
  const signedIn = !!store.user && !store.support
  useEffect(() => { if (!signedIn) return; store.repository.calendarFeedToken(profileId, false).then(setToken).catch(() => setToken(null)) }, [signedIn, profileId, store.repository])
  const https = token ? `${window.location.origin}/api/ics?t=${token}` : '', webcal = https.replace(/^https?:/, 'webcal:')
  const make = async () => { setBusy(true); setError(''); try { setToken(await store.repository.calendarFeedToken(profileId, true)) } catch (e) { setError(e instanceof Error ? e.message : 'Could not make a link.') } finally { setBusy(false) } }
  const stop = async () => { if (!window.confirm('Turn off this calendar link? Calendars subscribed to it stop updating.')) return; setBusy(true); try { await store.repository.deleteCalendarFeed(profileId); setToken(null) } catch (e) { setError(e instanceof Error ? e.message : 'Could not turn it off.') } finally { setBusy(false) } }
  const copy = (text: string, which: string) => { void navigator.clipboard?.writeText(text).then(() => setCopied(which)).catch(() => undefined) }
  if (!signedIn) return <p className="wb-muted">Sign in with your email to get a link your calendar app stays subscribed to.</p>
  return <div className="calendar-subscribe">
    <p>Subscribe once and “{planLabel}” assignments, exams and events appear in your calendar app, updating on their own every few hours. Notes aren’t included. Anyone with this link can see those titles and dates, so keep it private.</p>
    {!token ? <button type="button" disabled={busy} onClick={() => void make()}>Make my calendar link</button> : <>
      <label>Your KONO calendar link<input readOnly value={https} onFocus={e => e.currentTarget.select()} /></label>
      <div className="wb-toolbar"><button type="button" onClick={() => copy(https, 'link')}>{copied === 'link' ? 'Copied!' : 'Copy link'}</button><a className="button-link" href={webcal}>Open in Apple Calendar</a><button type="button" disabled={busy} onClick={() => void stop()}>Turn off link</button></div>
      <details><summary>Add it to Google Calendar</summary><ol><li>On a computer, open calendar.google.com.</li><li>Next to <strong>Other calendars</strong>, click <strong>+</strong> › <strong>From URL</strong>.</li><li>Paste the link and click <strong>Add calendar</strong>. It shows on your phone too.</li></ol></details>
      <details><summary>Add it to Apple Calendar (iPhone)</summary><ol><li>Tap <strong>Open in Apple Calendar</strong> above, then <strong>Subscribe</strong>.</li><li>Or: Settings › Calendar › Accounts › Add Account › Other › <strong>Add Subscribed Calendar</strong>, and paste the link.</li></ol></details>
    </>}
    {error && <p role="alert">{error}</p>}
  </div>
}
