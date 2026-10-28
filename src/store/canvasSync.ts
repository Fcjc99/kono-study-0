import { localDate, normalizeData, uid, type AppData, type Exam, type Task } from './model'
import type { CanvasItem } from './canvasApi'

/** Two-way Canvas (Settings › Import & export › Canvas, two-way): with a Canvas access token, KONO
 * brings in the to-do list (assignments, quizzes, discussions and pages with a to-do date) and keeps it
 * up to date, and ticking one done in KONO ticks it done in Canvas too (unticking unticks it).
 * Done in Canvas (submitted, graded, excused or ticked there) comes back as done in KONO. KONO never
 * unticks something because Canvas still shows it, so a tick made offline is sent the next time.
 *
 * The token is private, so the connection stays in this browser only, like linked calendars; the
 * server function (api/canvas.ts) uses it for one request at a time and keeps nothing. */
export type CanvasLink = { base: string; token: string; name?: string; lastSynced?: string; lastResult?: string; known: Record<string, boolean> }

export const canvasKey = (profileId: string) => 'kono-canvas:' + profileId
const CHANGE = 'kono-canvas'
const EVERY = 30 * 60000, BACK_DAYS = 14, AHEAD_DAYS = 90, MAX_PUSH = 25

export function canvasSnapshot(profileId: string) { try { return localStorage.getItem(canvasKey(profileId)) ?? '' } catch { return '' } }
export function parseCanvas(raw: string): CanvasLink | null {
  try { const link = JSON.parse(raw) as CanvasLink; return link && typeof link.base === 'string' && typeof link.token === 'string' ? { ...link, known: link.known && typeof link.known === 'object' ? link.known : {} } : null } catch { return null }
}
export const readCanvas = (profileId: string) => parseCanvas(canvasSnapshot(profileId))
export function writeCanvas(profileId: string, link: CanvasLink | null) {
  try { if (link) localStorage.setItem(canvasKey(profileId), JSON.stringify(link)); else localStorage.removeItem(canvasKey(profileId)) } catch { /* storage blocked: Canvas just won't stay connected */ }
  window.dispatchEvent(new Event(CHANGE))
}
export function onCanvasChange(listener: () => void) { window.addEventListener(CHANGE, listener); return () => window.removeEventListener(CHANGE, listener) }
export const canvasDue = (link: CanvasLink, now = Date.now()) => !link.lastSynced || now - Date.parse(link.lastSynced) > EVERY

async function api<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch('/api/canvas', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const text = await response.text()
  let parsed: unknown = null
  try { parsed = JSON.parse(text) } catch { /* not JSON */ }
  if (!response.ok) throw Error((parsed as { error?: string } | null)?.error || 'Couldn’t reach Canvas right now. Try again in a moment.')
  return parsed as T
}

const pad = (n: number) => String(n).padStart(2, '0')
const shift = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return localDate(d) }
/** Canvas times are UTC; KONO's dates are this device's days. 11:59 pm is "end of the day" (no time shown). */
export function localDue(at: string) {
  const d = new Date(at), time = pad(d.getHours()) + ':' + pad(d.getMinutes())
  return { date: localDate(d), time: time === '23:59' || time === '00:00' ? undefined : time }
}
export const refOf = (item: Pick<CanvasItem, 'type' | 'id'>) => item.type + ':' + item.id
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** Brings Canvas's list into the plan: links items the Canvas calendar link already brought in, adds new
 * ones, moves ones whose due date changed, and marks done what's done in Canvas. Pure. */
export function mergeCanvas(data: AppData, profileId: string, items: CanvasItem[]) {
  const next = structuredClone(data)
  let added = 0, moved = 0, done = 0, linked = 0
  const subjectFor = (course?: string) => {
    if (!course) return ''
    const known = next.subjects.find(s => s.profileId === profileId && (same(s.name, course) || course.toLowerCase().includes(s.name.trim().toLowerCase())))
    if (known) return known.id
    const subject = { id: uid('subject'), profileId, name: course.slice(0, 200), color: '#4169a8', resources: [] }
    next.subjects.push(subject); return subject.id
  }
  for (const item of items) {
    const ref = refOf(item), { date, time } = localDue(item.at), isExam = item.type === 'quiz'
    const list: (Task | Exam)[] = isExam ? next.exams : next.tasks
    const mine = (x: Task | Exam) => x.profileId === profileId
    const found = list.find(x => mine(x) && x.canvasRef === ref)
      ?? list.find(x => mine(x) && !x.canvasRef && x.source === 'canvas' && same(x.title, item.title) && x.due === date)
    if (!found) {
      const base = { id: uid(isExam ? 'exam' : 'task'), profileId, subjectId: subjectFor(item.course), title: item.title, due: date, done: item.done, notes: time ? 'Due at ' + time : '', source: 'canvas' as const, canvasRef: ref, ...(item.url ? { link: item.url } : {}) }
      if (isExam) next.exams.push(base); else next.tasks.push({ ...base, ...(item.done ? { completedAt: new Date().toISOString() } : {}) })
      added++; continue
    }
    if (found.canvasRef !== ref) { found.canvasRef = ref; linked++ }
    if (!found.link && item.url) found.link = item.url
    if (found.due !== date) { found.due = date; moved++ }
    if (item.done && !found.done) { found.done = true; if (!isExam) (found as Task).completedAt = new Date().toISOString(); done++ }
  }
  return { data: normalizeData(next), added, moved, done, linked }
}

/** Items in this plan linked to Canvas, and whether each is done. */
export function linkedDone(data: AppData, profileId: string): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  for (const x of [...data.tasks, ...data.exams]) if (x.profileId === profileId && x.canvasRef) out[x.canvasRef] = x.done
  return out
}

/** What changed in KONO since Canvas last heard: refs whose done differs from what Canvas has. */
export function pendingPushes(data: AppData, profileId: string, known: Record<string, boolean>) {
  return Object.entries(linkedDone(data, profileId)).filter(([ref, isDone]) => ref in known && known[ref] !== isDone).slice(0, MAX_PUSH)
}

/** Sends KONO's ticks to Canvas. Returns how many went through; `known` is updated for those. */
export async function pushCanvas(profileId: string, data: AppData) {
  const link = readCanvas(profileId)
  if (!link) return 0
  let sent = 0
  const known = { ...link.known }
  for (const [ref, isDone] of pendingPushes(data, profileId, known)) {
    const [type, id] = ref.split(':')
    try { await api({ action: 'mark', base: link.base, token: link.token, type, id, done: isDone }); known[ref] = isDone; sent++ } catch { break }
  }
  if (sent) writeCanvas(profileId, { ...(readCanvas(profileId) ?? link), known })
  return sent
}

/** Checks Canvas, brings in what changed, then sends KONO's ticks. `save` gets a function of the latest plan. */
export async function syncCanvas(profileId: string, current: () => AppData, save: (fn: (d: AppData) => AppData) => Promise<boolean>, link = readCanvas(profileId)) {
  if (!link) return 'Not connected.'
  let result = 'Up to date.'
  try {
    const { name, items } = await api<{ name: string; items: CanvasItem[] }>({ action: 'items', base: link.base, token: link.token, start: shift(-BACK_DAYS), end: shift(AHEAD_DAYS) })
    const preview = mergeCanvas(current(), profileId, items)
    if (preview.added || preview.moved || preview.done || preview.linked) {
      const ok = await save(d => mergeCanvas(d, profileId, items).data)
      if (!ok) throw Error('Not saved yet; will try again.')
    }
    // What Canvas has now. Anything KONO has done that Canvas doesn't is sent next.
    const known: Record<string, boolean> = { ...link.known }
    for (const item of items) known[refOf(item)] = item.done
    writeCanvas(profileId, { ...link, name: name || link.name, known, lastSynced: new Date().toISOString(), lastResult: result })
    const sent = await pushCanvas(profileId, current())
    const parts = [preview.added ? preview.added + ' new' : '', preview.moved ? preview.moved + ' moved' : '', preview.done ? preview.done + ' done in Canvas' : '', sent ? sent + ' ticked in Canvas' : ''].filter(Boolean)
    result = parts.length ? parts.join(', ') + '.' : result
    writeCanvas(profileId, { ...(readCanvas(profileId) ?? link), lastResult: result })
  } catch (error) {
    result = error instanceof Error ? error.message : 'Couldn’t check Canvas.'
    writeCanvas(profileId, { ...link, lastSynced: new Date().toISOString(), lastResult: result })
  }
  return result
}

/** Connecting: checks the address and token with Canvas before keeping them. */
export async function connectCanvas(profileId: string, base: string, token: string, current: () => AppData, save: (fn: (d: AppData) => AppData) => Promise<boolean>) {
  const link: CanvasLink = { base: base.trim(), token: token.trim(), known: {} }
  const { name } = await api<{ name: string }>({ action: 'items', base: link.base, token: link.token, start: shift(0), end: shift(1) })
  writeCanvas(profileId, { ...link, name })
  return syncCanvas(profileId, current, save, { ...link, name })
}
