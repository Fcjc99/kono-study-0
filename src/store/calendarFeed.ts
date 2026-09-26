/** Fetching a calendar's subscription link (Google's "secret address in iCal format", an iCloud public
 * calendar, Canvas/Schoology calendar feeds on a school's own domain, Outlook, Yahoo) for the calendar
 * import. Browsers can't read these links directly, so a small server function (api/calendar-feed.ts)
 * calls this. Only public https addresses are fetched: names that resolve to private, loopback or
 * link-local networks are refused (redirects are checked the same way), the reply must be a calendar,
 * and nothing is stored. */
const MAX_BYTES = 5_000_000
export type Lookup = (hostname: string) => Promise<string[]>

export function feedUrl(raw: string): URL {
  let url: URL
  try { url = new URL(raw.trim().replace(/^webcals?:\/\//i, 'https://')) } catch { throw Error('That doesn’t look like a calendar link. Copy the whole address, starting with https:// or webcal://.') }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) throw Error('Use the calendar’s https:// or webcal:// link.')
  const host = url.hostname.toLowerCase()
  if (!host.includes('.') || /^[\d.]+$/.test(host) || host.startsWith('[') || /(^|\.)(localhost|local|internal|intranet|lan|home|corp)$/.test(host)) throw Error('Use the calendar service’s public web address.')
  return url
}

/** True for addresses a public calendar should never live at (private, loopback, link-local, carrier-grade NAT, unique-local IPv6…). */
export function privateAddress(ip: string): boolean {
  const v4 = ip.replace(/^::ffff:/i, '').match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224
  }
  const v6 = ip.toLowerCase()
  return v6 === '::' || v6 === '::1' || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || /^ff/.test(v6)
}

async function checkHost(url: URL, lookup?: Lookup) {
  if (!lookup) return
  const addresses = await lookup(url.hostname).catch(() => { throw Error('That calendar address couldn’t be found. Check the link.') })
  if (!addresses.length || addresses.some(privateAddress)) throw Error('Use the calendar service’s public web address.')
}

export async function fetchFeed(raw: string, fetchImpl: typeof fetch = fetch, lookup?: Lookup): Promise<string> {
  let url = feedUrl(raw)
  for (let hop = 0; hop < 4; hop++) {
    await checkHost(url, lookup)
    const response = await fetchImpl(url.href, { redirect: 'manual', headers: { accept: 'text/calendar, */*;q=0.5' }, signal: AbortSignal.timeout(10000) })
    if (response.status >= 300 && response.status < 400) {
      const next = response.headers.get('location')
      if (!next) break
      url = feedUrl(new URL(next, url).href)
      continue
    }
    if (response.status === 401 || response.status === 403 || response.status === 404) throw Error('The calendar service didn’t share this calendar. Check that the link is the private/secret calendar address (Google, Canvas, Schoology) or that Public Calendar is on (iCloud).')
    if (!response.ok) throw Error(`The calendar service answered with an error (${response.status}). Try again in a moment.`)
    if (Number(response.headers.get('content-length') ?? 0) > MAX_BYTES) throw Error('This calendar is too large to import. Export a smaller date range as a .ics file instead.')
    const text = await response.text()
    if (text.length > MAX_BYTES) throw Error('This calendar is too large to import. Export a smaller date range as a .ics file instead.')
    if (!/BEGIN:VCALENDAR/i.test(text)) throw Error('That link didn’t return a calendar. Copy the calendar feed (iCal/ICS) address, not the web page address.')
    return text
  }
  throw Error('The calendar link redirected too many times.')
}
