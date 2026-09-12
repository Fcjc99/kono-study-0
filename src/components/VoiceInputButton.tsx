import { useSpeechToText } from '../hooks/useSpeechToText'

/** Hidden entirely when the browser has no speech recognition API, rather than showing a dead button. */
export default function VoiceInputButton({ label, onText }: { label: string; onText: (text: string) => void }) {
  const { listening, error, toggle, supported } = useSpeechToText(onText)
  if (!supported) return null
  return <span className="voice-input">
    <button type="button" className={'voice-input-button' + (listening ? ' is-listening' : '')} aria-pressed={listening} onClick={toggle}>
      <span aria-hidden="true">🎙️</span> {listening ? 'Listening… tap to stop' : `Speak ${label}`}
    </button>
    {error && <small role="alert" className="voice-input-error">{error}</small>}
  </span>
}
