import { fetchFeed } from '../src/store/calendarFeed.js'

/** POST {url} → the calendar's .ics text, for the calendar import in Settings › Import & export. */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({})) as { url?: unknown }
    const text = await fetchFeed(typeof body.url === 'string' ? body.url.slice(0, 2000) : '')
    return new Response(text, { headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error && !/fetch failed|aborted|timeout/i.test(error.message) ? error.message : 'Couldn’t reach that calendar. Check the link and try again.'
    return Response.json({ error: message }, { status: 400, headers: { 'cache-control': 'no-store' } })
  }
}
