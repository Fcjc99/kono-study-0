import { useCallback, useEffect, useRef, useState } from 'react'

type SpeechResultEvent = { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript?: string }> & { isFinal: boolean }> }
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

export type RecorderState = 'idle' | 'recording' | 'stopping'

/** Records audio (for local playback/storage) and builds a running transcript at the same time,
 * using the browser's free built-in speech recognition — unlike short voice commands, a lecture
 * can run long past where recognition normally times out on silence, so this restarts it
 * automatically for as long as recording continues. */
export function useLectureRecorder() {
  const [state, setState] = useState<RecorderState>('idle')
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [error, setError] = useState('')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const wantRecognitionRef = useRef(false)
  const transcriptRef = useRef('')
  const timerRef = useRef<number | undefined>(undefined)
  const startedAtRef = useRef(0)

  // A plain ref (reassigned fresh after each render, via the effect below) rather than useCallback,
  // so the restart-on-end handler below can call back into "the current start function" without a
  // self-referential closure that isn't defined yet at the point it's captured.
  const startRecognitionRef = useRef<() => void>(() => {})
  useEffect(() => { startRecognitionRef.current = () => {
    const Recognition = getRecognitionCtor()
    if (!Recognition) return
    const recognition = new Recognition()
    recognition.lang = typeof navigator !== 'undefined' ? navigator.language || 'en-US' : 'en-US'
    recognition.interimResults = true
    recognition.continuous = true
    recognition.onresult = event => {
      let finalChunk = '', live = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = result[0]?.transcript ?? ''
        if (result.isFinal) finalChunk += text + ' '
        else live += text
      }
      if (finalChunk) { transcriptRef.current = (transcriptRef.current + ' ' + finalChunk).trim(); setTranscript(transcriptRef.current) }
      setInterim(live)
    }
    recognition.onerror = event => { if (event?.error && event.error !== 'no-speech') setError(event.error === 'not-allowed' ? 'Microphone access was blocked. Check your browser permissions.' : 'Live transcription hiccuped, but recording continues.') }
    // Browsers stop recognition after a period of silence — restart it seamlessly while the user is
    // still recording, so a long lecture with pauses doesn't lose its transcript partway through.
    recognition.onend = () => { if (wantRecognitionRef.current) startRecognitionRef.current() }
    recognitionRef.current = recognition
    recognition.start()
  } }, [])

  const start = useCallback(async () => {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia) { setError('Recording is not supported in this browser.'); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      const recorder = new MediaRecorder(stream)
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mediaRecorderRef.current = recorder
      recorder.start()
      transcriptRef.current = ''
      setTranscript(''); setInterim('')
      wantRecognitionRef.current = true
      startRecognitionRef.current()
      startedAtRef.current = Date.now()
      setElapsedSeconds(0)
      timerRef.current = window.setInterval(() => setElapsedSeconds(Math.round((Date.now() - startedAtRef.current) / 1000)), 1000)
      setState('recording')
    } catch {
      setError('Microphone access was blocked or unavailable. Check your browser permissions.')
    }
  }, [])

  const stop = useCallback((): Promise<{ blob: Blob; transcript: string; durationSeconds: number } | null> => {
    return new Promise(resolve => {
      setState('stopping')
      wantRecognitionRef.current = false
      recognitionRef.current?.stop()
      window.clearInterval(timerRef.current)
      const recorder = mediaRecorderRef.current
      if (!recorder) { setState('idle'); resolve(null); return }
      recorder.onstop = () => {
        streamRef.current?.getTracks().forEach(track => track.stop())
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        const durationSeconds = Math.round((Date.now() - startedAtRef.current) / 1000)
        setState('idle')
        resolve({ blob, transcript: transcriptRef.current.trim(), durationSeconds })
      }
      recorder.stop()
    })
  }, [])

  return { state, transcript, interim, elapsedSeconds, error, start, stop, supported: !!navigator.mediaDevices?.getUserMedia, transcriptSupported: !!getRecognitionCtor() }
}
