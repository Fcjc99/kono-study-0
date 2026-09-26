/** Turning lock-screen reminders on or off on this device (Web Push through KONO's service worker). */
type Saver = { savePushDevice: (sub: { endpoint: string; p256dh: string; auth: string }) => Promise<void>; forgetPushDevice: (endpoint: string) => Promise<void> }

const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
export const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/** 'ok'; 'install-first' (iPhone/iPad: only an app added to the Home Screen can get reminders); or 'unsupported'. */
export function pushSupport(): 'ok' | 'install-first' | 'unsupported' {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return 'unsupported'
  if (isIos() && !standalone()) return 'install-first'
  return 'PushManager' in window && 'Notification' in window ? 'ok' : 'unsupported'
}

const toKey = (base64url: string) => { const s = atob(base64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - base64url.length % 4) % 4)); return Uint8Array.from(s, c => c.charCodeAt(0)) }
const b64 = (buffer: ArrayBuffer | null) => buffer ? btoa(String.fromCharCode(...new Uint8Array(buffer))) : ''

export async function currentPushSubscription() {
  if (pushSupport() !== 'ok') return null
  const registration = await navigator.serviceWorker.getRegistration()
  return registration ? registration.pushManager.getSubscription() : null
}

export async function turnOnPush(saver: Saver) {
  const status = await fetch('/api/push').then(r => r.ok && /json/.test(r.headers.get('content-type') ?? '') ? r.json() as Promise<{ publicKey: string | null }> : { publicKey: null }).catch(() => ({ publicKey: null }))
  if (!status.publicKey) throw Error('Lock-screen reminders aren’t set up on KONO’s server yet.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw Error('Notifications are blocked for KONO. Allow them in your browser or phone settings, then try again.')
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(status.publicKey) })
  await saver.savePushDevice({ endpoint: subscription.endpoint, p256dh: b64(subscription.getKey('p256dh')), auth: b64(subscription.getKey('auth')) })
  return subscription
}

export async function turnOffPush(saver: Saver) {
  const subscription = await currentPushSubscription()
  if (!subscription) return
  await saver.forgetPushDevice(subscription.endpoint).catch(() => undefined)
  await subscription.unsubscribe()
}
