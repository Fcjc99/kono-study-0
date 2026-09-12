import { useCallback, useRef, useState } from 'react'

type SpeechResultEvent = { results: ArrayLike<ArrayLike<{ transcript?: string }>> }
type SpeechErrorEvent = { error?: string }
type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: SpeechResultEvent) => void) | null
  onerror: ((event: SpeechErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

const getRecognitionCtor = (): SpeechRecognitionCtor | undefined => {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export const speechToTextSupported = () => !!getRecognitionCtor()

/** Browsers stop listening on silence; there is no result stream to poll. */
export function useSpeechToText(onText: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const toggle = useCallback(() => {
    if (listening) { recognitionRef.current?.stop(); return }
    const Recognition = getRecognitionCtor()
    if (!Recognition) { setError('Voice input is not supported in this browser.'); return }
    const recognition = new Recognition()
    recognition.lang = typeof navigator !== 'undefined' ? navigator.language || 'en-US' : 'en-US'
    recognition.interimResults = false
    recognition.continuous = false
    recognition.onresult = event => {
      const text = Array.from(event.results).map(result => result[0]?.transcript ?? '').join(' ').trim()
      if (text) onText(text)
    }
    recognition.onerror = event => setError(event?.error === 'not-allowed' ? 'Microphone access was blocked. Check your browser permissions.' : 'Could not capture audio. Try again.')
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    setError('')
    setListening(true)
    recognition.start()
  }, [listening, onText])
  return { listening, error, toggle, supported: speechToTextSupported() }
}
