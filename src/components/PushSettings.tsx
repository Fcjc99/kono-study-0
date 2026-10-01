import { useEffect, useState, useSyncExternalStore } from 'react'
import { currentPushSubscription, isIos, pushSupport, turnOffPush, turnOnPush } from '../store/pushDevice'
import { canInstall, onInstallChange, promptInstall } from '../store/installPrompt'
import type { usePlannerRepository } from '../store/repository'
import { APP_BADGE_SETTING, appBadgeSupported } from '../store/appBadge'
import { useLocalSetting } from '../hooks/useLocalSetting'

type Store = ReturnType<typeof usePlannerRepository>

/** Settings › Notifications: lock-screen reminders on this device, and installing KONO as an app. */
export default function PushSettings({ store }: { store: Store }) {
  const support = pushSupport()
  const [on, setOn] = useState<boolean | null>(null), [busy, setBusy] = useState(false), [status, setStatus] = useState(''), [error, setError] = useState('')
  const installable = useSyncExternalStore(onInstallChange, canInstall, () => false)
  const installed = typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches
  useEffect(() => { void currentPushSubscription().then(s => setOn(!!s)).catch(() => setOn(false)) }, [])
  const signedIn = store.repository.canUsePush
  const [badge, setBadge] = useLocalSetting(APP_BADGE_SETTING, 'on')
  const turnOn = async () => {
    setBusy(true); setError(''); setStatus('')
    try { await turnOnPush(store.repository); setOn(true); setStatus('Reminders are on for this device. The first ones arrive at their times — nothing to do now.') }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not turn on reminders.') } finally { setBusy(false) }
  }
  const turnOff = async () => {
    setBusy(true); setError('')
    try { await turnOffPush(store.repository); setOn(false); setStatus('Reminders are off for this device.') } catch (e) { setError(e instanceof Error ? e.message : 'Could not turn them off.') } finally { setBusy(false) }
  }
  return <section className="card push-settings">
    <h3>Lock-screen reminders</h3>
    <p>Get a notification even when KONO is closed: what’s due at 7 AM (and the week ahead on Monday mornings), exams and still-open homework the evening before, 15 minutes before each class or planned study time, for a rotating school, which day tomorrow is (or that there’s no school), and a week before any school day off or early release. In parent mode, Sunday evening brings the family’s week ahead. Turn them on for each phone or computer you use.</p>
    {support === 'install-first' && <p className="push-hint">On iPhone and iPad, reminders work once KONO is on your Home Screen: tap <strong>Share</strong> <span aria-hidden="true">⎋</span> › <strong>Add to Home Screen</strong>, open KONO from there, and turn reminders on.</p>}
    {support === 'unsupported' && <p className="wb-muted">This browser can’t show reminders when KONO is closed. Try Chrome, Edge, Firefox or Safari.</p>}
    {support === 'ok' && !signedIn && <p className="wb-muted">Sign in with your email (Plans &amp; account) to turn on lock-screen reminders.</p>}
    {support === 'ok' && signedIn && <div className="wb-toolbar">{on ? <><span className="push-on">✓ On for this device</span><button type="button" disabled={busy} onClick={() => void turnOff()}>Turn off</button></> : <button type="button" className="primary" disabled={busy || on === null} onClick={() => void turnOn()}>{busy ? 'Turning on…' : 'Turn on reminders'}</button>}</div>}
    {status && <p role="status">{status}</p>}{error && <p role="alert">{error}</p>}
    {(appBadgeSupported() || isIos()) && <><h3>Number on the app icon</h3>
    <label className="app-badge-setting"><input type="checkbox" checked={badge === 'on'} onChange={e => setBadge(e.target.checked ? 'on' : 'off')} /> Show how many things are due today (and late) on KONO’s icon</label>
    {isIos() && <p className="wb-muted">On iPhone and iPad this works for KONO on your Home Screen once reminders are turned on.</p>}</>}
    <h3>Install KONO</h3>
    {installed ? <p className="wb-muted">✓ KONO is installed on this device.</p> : installable ? <><p>Add KONO to your home screen or dock so it opens like an app.</p><button type="button" onClick={() => void promptInstall()}>Install KONO</button></> : isIos() ? <p>Tap <strong>Share</strong> › <strong>Add to Home Screen</strong> in Safari to put KONO on your Home Screen.</p> : <p className="wb-muted">In Chrome or Edge, use the install icon in the address bar (or the menu › Install KONO). On Android, the menu › Add to Home screen.</p>}
  </section>
}
