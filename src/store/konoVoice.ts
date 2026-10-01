/** How Ask KONO talks. iPhone and iPad always use the device's own voices, picking a downloaded Premium
 * or Enhanced one (Ava, Zoe, Evan…) when there is one. Other devices use KONO's natural voice (OpenAI,
 * through api/voice) when signed in and online, falling back to the device's best voice (Edge's "Natural"
 * voices, Chrome's Google voices) when it isn't available, the day's allowance is used, or playback is
 * blocked. Clips are kept on the device, so the greeting, KONO's questions and "Say it again" replay
 * without asking the server again. */
export type VoiceInfo = { name: string; lang: string; voiceURI?: string }

/** Apple's joke and character voices: never picked over a normal one. */
const NOVELTY = /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|kathy|ralph|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley)\b/i

/** iPhone, iPad and iPod (iPadOS reports itself as a Mac, but with a touch screen). */
export const isAppleMobile = (ua: string, platform = '', touchPoints = 0) => /iPhone|iPad|iPod/.test(ua) || (platform === 'MacIntel' && touchPoints > 1)

/** 3 Premium, 2 Enhanced or another natural-sounding voice, 1 Google, 0 standard, negative for novelty voices. */
export function voiceQuality(v: VoiceInfo) {
  const id = v.name + ' ' + (v.voiceURI ?? '')
  if (NOVELTY.test(v.name)) return -5
  if (/premium/i.test(id)) return 3
  if (/enhanced|natural|neural|online/i.test(id)) return 2
  if (/google/i.test(id)) return 1
  return 0
}

/** The best-sounding voice for the language (exact region first), or undefined to leave it to the device. */
export function bestVoice<V extends VoiceInfo>(voices: V[], lang = 'en-US'): V | undefined {
  const want = lang.toLowerCase().replace('_', '-'), base = want.split('-')[0]
  let best: V | undefined, bestScore = -Infinity
  for (const v of voices) {
    const l = v.lang.toLowerCase().replace('_', '-')
    if (l.split('-')[0] !== base) continue
    const score = voiceQuality(v) * 10 + (l === want ? 2 : 0)
    if (score > bestScore) { best = v; bestScore = score }
  }
  return best
}

/** Whether the device has a natural-sounding voice for the language (if not, iPhone shows how to get one). */
export const hasNaturalVoice = (voices: VoiceInfo[], lang = 'en-US') => voiceQuality(bestVoice(voices, lang) ?? { name: '', lang }) >= 2

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
const deviceVoices = (): SpeechSynthesisVoice[] => canSpeak() && typeof window.speechSynthesis.getVoices === 'function' ? window.speechSynthesis.getVoices() : []
const language = () => (typeof navigator !== 'undefined' && navigator.language) || 'en-US'

export function speakOnDevice(text: string) {
  if (!canSpeak()) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text), voice = bestVoice(deviceVoices(), language())
  if (voice) { u.voice = voice; u.lang = voice.lang }
  // A natural voice sounds best as it is; a plain one a touch higher, to sound more like KONO.
  u.rate = 1; u.pitch = voice && voiceQuality(voice) >= 2 ? 1 : 1.1
  window.speechSynthesis.speak(u)
}

/** KONO's natural voice, set up by the repository after sign-in when the server has it. */
export type NaturalVoice = (text: string) => Promise<Blob>
let natural: NaturalVoice | null = null
/** Set when the server says no (the day's allowance is used, or it isn't set up): the device's voice
 * until KONO is opened again, instead of asking for every answer. */
let resting = false
export function setNaturalVoice(fn: NaturalVoice | null) { natural = fn; resting = false }
export const naturalVoiceAvailable = () => natural !== null

const CACHE = 'kono-voice', KEEP = 40
async function cacheKey(text: string) {
  if (typeof crypto === 'undefined' || !crypto.subtle) return null
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), b => b.toString(16).padStart(2, '0')).join('')
  return new Request('/__kono-voice/' + hash)
}
/** A clip from this device's store; a hit moves to the back of the queue so phrases KONO says often stay. */
async function storedClip(text: string) {
  try {
    const key = await cacheKey(text)
    if (!key || typeof caches === 'undefined') return null
    const cache = await caches.open(CACHE), hit = await cache.match(key)
    if (!hit) return null
    const blob = await hit.blob()
    await cache.delete(key); await cache.put(key, new Response(blob, { headers: { 'content-type': blob.type || 'audio/mpeg' } }))
    return blob
  } catch { return null }
}
async function storeClip(text: string, blob: Blob) {
  try {
    const key = await cacheKey(text)
    if (!key || typeof caches === 'undefined') return
    const cache = await caches.open(CACHE)
    await cache.put(key, new Response(blob, { headers: { 'content-type': blob.type || 'audio/mpeg' } }))
    const keys = await cache.keys()
    for (const old of keys.slice(0, Math.max(0, keys.length - KEEP))) await cache.delete(old)
  } catch { /* Storage full or unavailable: it's only a convenience. */ }
}

/** One speaker per Ask KONO window: a new answer stops the one before, and a slow clip that arrives
 * after a newer question (or Quiet) is dropped. */
export class KonoSpeaker {
  private audio: HTMLAudioElement | null = null
  private turn = 0
  private clips = new Map<string, Blob>()
  stop() {
    this.turn++
    if (this.audio) { this.audio.pause(); this.audio = null }
    if (canSpeak()) window.speechSynthesis.cancel()
  }
  /** Says `text`, in KONO's natural voice when `naturalVoice` is on and it's available. */
  async say(text: string, naturalVoice: boolean) {
    this.stop()
    const turn = this.turn, voice = natural
    if (voice && naturalVoice && !resting && navigator.onLine !== false) {
      try {
        let clip = this.clips.get(text) ?? await storedClip(text)
        if (!clip) { clip = await voice(text); void storeClip(text, clip) }
        this.clips.set(text, clip)
        if (turn !== this.turn) return
        await this.play(clip)
        return
      } catch (e) {
        if ([401, 429, 503].includes((e as { status?: number }).status ?? 0)) resting = true
        if (turn !== this.turn) return
      }
    }
    speakOnDevice(text)
  }
  private async play(clip: Blob) {
    const url = URL.createObjectURL(clip), audio = new Audio(url)
    this.audio = audio
    audio.onended = audio.onerror = () => URL.revokeObjectURL(url)
    try { await audio.play() } catch (e) { URL.revokeObjectURL(url); this.audio = null; throw e }
  }
}

/** The device's voices, which some browsers only list after a moment. */
export function onVoicesChanged(listener: () => void) {
  if (!canSpeak() || typeof window.speechSynthesis.addEventListener !== 'function') return () => {}
  window.speechSynthesis.addEventListener('voiceschanged', listener)
  return () => window.speechSynthesis.removeEventListener('voiceschanged', listener)
}
export const currentVoices = deviceVoices
