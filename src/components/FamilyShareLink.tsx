import { useEffect, useState } from 'react'
import type { usePlannerRepository } from '../store/repository'

type Store = ReturnType<typeof usePlannerRepository>

/** Settings › Family › Share with grandparents: a private, view-only link to the family's next two
 * weeks (events, tests, birthdays, countdowns). No sign-in for them; turning it off kills the link. */
export default function FamilyShareLink({ store, profileId }: { store: Store; profileId: string }) {
  const key = profileId + '#family'
  const [token, setToken] = useState<string | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [copied, setCopied] = useState(false)
  const signedIn = !!store.user && !store.support
  useEffect(() => { if (!signedIn) return; store.repository.calendarFeedToken(key, false).then(setToken).catch(() => setToken(null)) }, [signedIn, key, store.repository])
  const tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return '' } })()
  const link = token ? `${window.location.origin}/api/family?t=${token}${tz ? '&tz=' + encodeURIComponent(tz) : ''}` : ''
  const make = async () => { setBusy(true); setError(''); try { setToken(await store.repository.calendarFeedToken(key, true)) } catch (e) { setError(e instanceof Error ? e.message : 'Could not make a link.') } finally { setBusy(false) } }
  const stop = async () => { if (!window.confirm('Turn off this link? Anyone who has it won’t see your calendar anymore.')) return; setBusy(true); try { await store.repository.deleteCalendarFeed(key); setToken(null) } catch (e) { setError(e instanceof Error ? e.message : 'Could not turn it off.') } finally { setBusy(false) } }
  const copy = () => { void navigator.clipboard?.writeText(link).then(() => setCopied(true)).catch(() => undefined) }
  const canShare = typeof navigator.share === 'function'
  return <section className="wb-panel family-share" aria-label="Share with grandparents">
    <h2>Share with grandparents</h2>
    <p className="wb-muted">A view-only page with the next two weeks: events (with times and places), tests, birthdays, countdowns and school holidays. Homework, notes and who’s driving stay private. Anyone with the link can see it, and no sign-in is needed.</p>
    {!signedIn ? <p className="wb-muted">Sign in with your email to make a link.</p> : !token ? <button type="button" disabled={busy} onClick={() => void make()}>Make a view-only link</button> : <>
      <label>View-only link<input readOnly value={link} onFocus={e => e.currentTarget.select()} /></label>
      <div className="wb-toolbar">
        {canShare && <button type="button" className="primary" onClick={() => void navigator.share({ title: 'Our family calendar', url: link }).catch(() => undefined)}>Send it…</button>}
        <button type="button" onClick={copy}>{copied ? 'Copied!' : 'Copy link'}</button>
        <a className="button-link" href={link} target="_blank" rel="noreferrer">Open it</a>
        <button type="button" disabled={busy} onClick={() => void stop()}>Turn off link</button>
      </div>
    </>}
    {error && <p role="alert">{error}</p>}
  </section>
}
