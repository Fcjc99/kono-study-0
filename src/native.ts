/** Running inside KONO's iPhone or Android app (capacitor.config.ts)? The app's native layer adds
 * `window.Capacitor` to the page; on the web it isn't there and everything here does nothing. No
 * Capacitor code is bundled: plugins are reached through that object. */
type Plugin = Record<string, ((options?: unknown) => Promise<unknown>) | undefined>
type Capacitor = { isNativePlatform?: () => boolean; getPlatform?: () => string; Plugins?: Record<string, Plugin | undefined> }
const capacitor = () => (globalThis as { Capacitor?: Capacitor }).Capacitor

export const isNativeApp = () => { try { return !!capacitor()?.isNativePlatform?.() } catch { return false } }
export const nativePlatform = () => isNativeApp() ? capacitor()?.getPlatform?.() ?? 'native' : 'web'

/** Calls a native plugin method; resolves to undefined (never throws) when it isn't there. */
export async function callNative<T = unknown>(plugin: string, method: string, options?: unknown): Promise<T | undefined> {
  if (!isNativeApp()) return undefined
  const fn = capacitor()?.Plugins?.[plugin]?.[method]
  if (typeof fn !== 'function') return undefined
  try { return await fn(options) as T } catch { return undefined }
}

/** The focus timer on the lock screen and Dynamic Island (iPhone Live Activity) while a session runs. */
export const nativeFocus = (session: { title: string; endsAt: number } | null) =>
  void callNative('KonoWidget', session ? 'startFocus' : 'endFocus', session ?? undefined)
