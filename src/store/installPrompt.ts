/** Chrome/Edge/Android offer "Install app" through a beforeinstallprompt event that must be caught early
 * and replayed from a button; this keeps it until the Install KONO button uses it. */
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
let deferred: InstallEvent | null = null
const listeners = new Set<() => void>()
const changed = () => listeners.forEach(l => l())

export function captureInstallPrompt() {
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferred = event as InstallEvent; changed() })
  window.addEventListener('appinstalled', () => { deferred = null; changed() })
}
export const canInstall = () => deferred !== null
export function onInstallChange(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
export async function promptInstall() {
  if (!deferred) return false
  const event = deferred
  deferred = null; changed()
  await event.prompt()
  return (await event.userChoice).outcome === 'accepted'
}
