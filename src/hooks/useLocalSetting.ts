import { useEffect, useState } from 'react'

const CHANGE = 'kono-local-setting'
const read = (key: string, fallback: string) => { try { return localStorage.getItem(key) ?? fallback } catch { return fallback } }

/** A small per-device setting (not part of the synced plan) backed by localStorage. Used for things
 * like an AI provider/API key that should stick around on this browser without going through the
 * save/sync pipeline. Every mounted copy of the same key stays in step, in this tab and others. */
export function useLocalSetting(key: string, fallback: string): [string, (value: string) => void] {
  const [value, setValue] = useState(() => read(key, fallback))
  useEffect(() => {
    const sync = (e: Event) => { if ((e instanceof StorageEvent ? e.key : (e as CustomEvent<string>).detail) === key) setValue(read(key, fallback)) }
    window.addEventListener(CHANGE, sync); window.addEventListener('storage', sync)
    return () => { window.removeEventListener(CHANGE, sync); window.removeEventListener('storage', sync) }
  }, [key, fallback])
  const update = (next: string) => {
    setValue(next)
    try { localStorage.setItem(key, next) } catch { /* best effort; the field still works this session */ }
    window.dispatchEvent(new CustomEvent(CHANGE, { detail: key }))
  }
  return [value, update]
}
