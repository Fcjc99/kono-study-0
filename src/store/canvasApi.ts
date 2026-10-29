/** Two-way Canvas (server side, called by api/canvas.ts): reads a student's Canvas to-do list (the
 * planner API) and marks items done or not done there. The student's access token comes with each
 * request and goes only to their school's Canvas address, over https; it isn't stored or logged here.
 * Canvas addresses get the same checks as calendar links (calendarFeed.ts): public https names only,
 * nothing that resolves to a private network, and no redirects. */
import { checkHost, feedUrl, type Lookup } from './calendarFeed.js'

/** One thing on the Canvas to-do list, trimmed to what KONO uses. `at` is Canvas's ISO time (UTC). */
export type CanvasItem = { type: string; id: string; title: string; course?: string; at: string; done: boolean; url?: string }
const KINDS = new Set(['assignment', 'quiz', 'discussion_topic', 'wiki_page'])
const PAGES = 6

/** "myschool.instructure.com", "https://canvas.school.edu/courses/1" → https://host (no path). */
export function canvasBase(raw: string): URL {
  const text = raw.trim()
  if (!text) throw Error('Enter your school’s Canvas address, like myschool.instructure.com.')
  const url = feedUrl(/^https?:\/\//i.test(text) ? text.replace(/^http:/i, 'https:') : 'https://' + text)
  return new URL(url.origin)
}

const cleanToken = (token: string) => {
  const t = token.trim()
  if (!/^[A-Za-z0-9~_.-]{20,200}$/.test(t)) throw Error('That doesn’t look like a Canvas access token. Copy the whole token Canvas showed you.')
  return t
}

async function call(base: URL, path: string, token: string, init: { method?: string; body?: unknown }, fetchImpl: typeof fetch, lookup?: Lookup) {
  const url = new URL(path, base)
  if (url.origin !== base.origin) throw Error('Canvas answered with another address.')
  await checkHost(url, lookup)
  const response = await fetchImpl(url.href, {
    method: init.method ?? 'GET', redirect: 'manual', signal: AbortSignal.timeout(12000),
    headers: { authorization: 'Bearer ' + token, accept: 'application/json', ...(init.body ? { 'content-type': 'application/json' } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
  })
  if (response.status >= 300 && response.status < 400) throw Error('That address isn’t your school’s Canvas. Use the address you see when Canvas is open, like myschool.instructure.com.')
  if (response.status === 401) throw Error('Canvas didn’t accept this token. It may have expired or been deleted; make a new one in Canvas (Account › Settings).')
  if (response.status === 403) throw Error('Canvas said no. Your school may not allow access tokens; use the Canvas calendar link instead (it only brings things in).')
  if (response.status === 404) throw Error('Canvas couldn’t find that. Check the address is your school’s Canvas.')
  return response
}

const nextLink = (header: string | null) => header?.split(',').map(p => p.match(/<([^>]+)>;\s*rel="next"/)?.[1]).find(Boolean)

type PlannerRow = { plannable_type?: string; plannable_id?: number | string; plannable_date?: string; html_url?: string; context_name?: string; plannable?: { title?: string; name?: string; due_at?: string; todo_date?: string }; planner_override?: { marked_complete?: boolean } | null; submissions?: false | { submitted?: boolean; graded?: boolean; excused?: boolean } }

/** The student's name (to show who's connected) and their to-do list from `start` to `end` (yyyy-mm-dd). */
export async function canvasItems(rawBase: string, rawToken: string, start: string, end: string, fetchImpl: typeof fetch = fetch, lookup?: Lookup) {
  const base = canvasBase(rawBase), token = cleanToken(rawToken)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) throw Error('Pick a date range.')
  const self = await call(base, '/api/v1/users/self', token, {}, fetchImpl, lookup)
  if (!self.ok) throw Error(`Canvas answered with an error (${self.status}). Try again in a moment.`)
  const me = await self.json() as { name?: string; short_name?: string }
  const items: CanvasItem[] = []
  let path: string | undefined = `/api/v1/planner/items?start_date=${start}&end_date=${end}&per_page=100`
  for (let page = 0; path && page < PAGES; page++) {
    const response = await call(base, path, token, {}, fetchImpl, lookup)
    if (!response.ok) throw Error(`Canvas answered with an error (${response.status}). Try again in a moment.`)
    const rows = await response.json() as PlannerRow[]
    for (const row of Array.isArray(rows) ? rows : []) {
      const type = String(row.plannable_type ?? ''), id = String(row.plannable_id ?? '')
      const at = row.plannable?.due_at ?? row.plannable?.todo_date ?? row.plannable_date ?? ''
      if (!KINDS.has(type) || !/^\d{1,20}$/.test(id) || !Number.isFinite(Date.parse(at))) continue
      const sub = row.submissions || undefined
      items.push({
        type, id, at, title: String(row.plannable?.title ?? row.plannable?.name ?? 'Canvas assignment').slice(0, 500),
        course: row.context_name ? String(row.context_name).slice(0, 200) : undefined,
        done: row.planner_override?.marked_complete === true || !!(sub && (sub.submitted || sub.graded || sub.excused)),
        url: row.html_url ? new URL(row.html_url, base).href : undefined,
      })
    }
    const next = nextLink(response.headers.get('link'))
    path = next ? new URL(next, base).origin === base.origin ? next : undefined : undefined
  }
  return { name: String(me.short_name || me.name || '').slice(0, 120), items }
}

/** Ticks (or unticks) one item on the student's Canvas to-do list: a planner override. */
export async function canvasMark(rawBase: string, rawToken: string, type: string, id: string, done: boolean, fetchImpl: typeof fetch = fetch, lookup?: Lookup) {
  const base = canvasBase(rawBase), token = cleanToken(rawToken)
  if (!KINDS.has(type) || !/^\d{1,20}$/.test(id)) throw Error('That isn’t a Canvas item.')
  const created = await call(base, '/api/v1/planner/overrides', token, { method: 'POST', body: { plannable_type: type, plannable_id: Number(id), marked_complete: done } }, fetchImpl, lookup)
  if (created.ok) return
  // Already has an override (Canvas answers 400): find it and change it.
  let path: string | undefined = '/api/v1/planner/overrides?per_page=100'
  for (let page = 0; path && page < PAGES; page++) {
    const response = await call(base, path, token, {}, fetchImpl, lookup)
    if (!response.ok) break
    const rows = await response.json() as { id?: number; plannable_type?: string; plannable_id?: number | string }[]
    const found = (Array.isArray(rows) ? rows : []).find(o => o.plannable_type === type && String(o.plannable_id) === id)
    if (found?.id) {
      const updated = await call(base, '/api/v1/planner/overrides/' + Number(found.id), token, { method: 'PUT', body: { marked_complete: done } }, fetchImpl, lookup)
      if (updated.ok) return
      break
    }
    const next = nextLink(response.headers.get('link'))
    path = next && new URL(next, base).origin === base.origin ? next : undefined
  }
  throw Error('Canvas didn’t save that change. Try again in a moment.')
}
