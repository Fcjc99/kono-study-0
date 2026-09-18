import { useState } from 'react'

/** A small per-device setting (not part of the synced plan) backed by localStorage. Used for things
 * like an AI provider/API key that should stick around on this browser without going through the
 * save/sync pipeline. */
export function useLocalSetting(key: string, fallback: string): [string, (value: string) => void] {
  const [value, setValue] = useState(() => { try { return localStorage.getItem(key) ?? fallback } catch { return fallback } })
  const update = (next: string) => { setValue(next); try { localStorage.setItem(key, next) } catch { /* best effort; the field still works this session */ } }
  return [value, update]
}
