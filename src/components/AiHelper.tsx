import { useAiHelper } from '../hooks/useAiHelper'

export function AiHelperSettings({ profileId }: { profileId: string }) {
  const { provider, apiKey, setProvider, setApiKey } = useAiHelper(profileId)
  return <section className="card ai-helper-settings">
    <h3>AI helper</h3>
    <p className="wb-muted">K-Quiz, the photo scanner and the handwritten-planner import read your notes with an AI provider you choose. Set your key up once here and all three use it. Calls go straight from this browser to that provider using your own key; it's never sent anywhere else. Google's Gemini has a free tier with no credit card (though on the free tier Google may use your input to improve its models); OpenAI requires billing set up at platform.openai.com.</p>
    <label>Provider<select value={provider} onChange={e => setProvider(e.target.value)}><option value="gemini">Google Gemini (free tier available)</option><option value="openai">OpenAI</option></select></label>
    <label>API key<input type="password" autoComplete="off" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Paste your API key" /></label>
    <p className="wb-muted ai-key-help">Don't have one? <a href={provider === 'openai' ? 'https://platform.openai.com/api-keys' : 'https://aistudio.google.com/apikey'} target="_blank" rel="noopener noreferrer">{provider === 'openai' ? 'Get an OpenAI key' : 'Get a free Gemini key'} →</a></p>
  </section>
}

/** A one-line "is the AI helper ready" note for a feature that uses it; links to the setting when the
 * feature lives somewhere other than the Import & export tab. */
export function AiHelperStatus({ profileId, onOpenSettings }: { profileId: string; onOpenSettings?: () => void }) {
  const { provider, apiKey } = useAiHelper(profileId)
  const where = onOpenSettings ? <button type="button" className="ai-helper-link" onClick={onOpenSettings}>{apiKey.trim() ? 'Change' : 'Set up the AI helper'}</button> : <span>{apiKey.trim() ? '' : 'Add your key in AI helper above.'}</span>
  return <p className="wb-muted ai-helper-status">{apiKey.trim() ? `✓ AI helper ready (${provider === 'openai' ? 'OpenAI' : 'Gemini'}).` : 'Needs the AI helper (a free Gemini key works).'} {where}</p>
}
