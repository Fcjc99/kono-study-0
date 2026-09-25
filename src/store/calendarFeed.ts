/** Fetching a calendar's subscription link (Google's "secret address in iCal format", an iCloud public
 * calendar, Outlook or Yahoo) for the calendar import. Browsers can't read these links directly, so a
 * small server function (api/calendar-feed.ts) calls this. Only calendar services' own addresses are
 * allowed, redirects are checked the same way, and nothing is stored. */
const ALLOWED_HOSTS = [/^calendar\.google\.com$/, /^([a-z0-9-]+\.)*icloud\.com$/, /^outlook\.(live|office365|office)\.com$/, /^([a-z0-9-]+\.)*calendar\.yahoo\.com$/]
const MAX_BYTES = 5_000_000

export function feedUrl(raw: string): URL {
  let url: URL
  try { url = new URL(raw.trim().replace(/^webcals?:\/\//i, 'https://')) } catch { throw Error('That doesn’t look like a calendar link. Copy the whole address, starting with https:// or webcal://.') }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) throw Error('Use the calendar’s https:// or webcal:// link.')
  if (!ALLOWED_HOSTS.some(h => h.test(url.hostname.toLowerCase()))) throw Error('KONO can read links from Google Calendar, iCloud (Apple Calendar), Outlook and Yahoo. For another calendar app, export a .ics file and choose it instead.')
  return url
}

export async function fetchFeed(raw: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  let url = feedUrl(raw)
  for (let hop = 0; hop < 4; hop++) {
    const response = await fetchImpl(url.href, { redirect: 'manual', headers: { accept: 'text/calendar, */*;q=0.5' }, signal: AbortSignal.timeout(10000) })
    if (response.status >= 300 && response.status < 400) {
      const next = response.headers.get('location')
      if (!next) break
      url = feedUrl(new URL(next, url).href)
      continue
    }
    if (response.status === 401 || response.status === 403 || response.status === 404) throw Error('The calendar service didn’t share this calendar. Check that the link is the private/secret address (Google) or that Public Calendar is on (iCloud).')
    if (!response.ok) throw Error(`The calendar service answered with an error (${response.status}). Try again in a moment.`)
    if (Number(response.headers.get('content-length') ?? 0) > MAX_BYTES) throw Error('This calendar is too large to import. Export a smaller date range as a .ics file instead.')
    const text = await response.text()
    if (text.length > MAX_BYTES) throw Error('This calendar is too large to import. Export a smaller date range as a .ics file instead.')
    if (!/BEGIN:VCALENDAR/i.test(text)) throw Error('That link didn’t return a calendar. Copy the iCal/ICS address, not the web page address.')
    return text
  }
  throw Error('The calendar link redirected too many times.')
}
