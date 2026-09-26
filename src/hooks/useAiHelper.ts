import { useSyncExternalStore } from 'react'
import { useLocalSetting } from './useLocalSetting'
import { builtInAiAvailable, onBuiltInAiChange } from '../store/aiProvider'

/** One per-plan AI provider/key on this device, used by K-Quiz, the photo scanner and the planner-photo
 * import. The storage keys predate the shared setting (K-Quiz owned them), so existing keys carry over.
 * `builtIn`: KONO's own AI is on for this signed-in person; `ready`: either that or a personal key. */
export function useAiHelper(profileId: string) {
  const [provider, setProvider] = useLocalSetting('kono-kquiz:' + profileId + ':provider', 'gemini')
  const [apiKey, setApiKey] = useLocalSetting('kono-kquiz:' + profileId + ':key', '')
  const builtIn = useSyncExternalStore(onBuiltInAiChange, builtInAiAvailable, () => false)
  return { provider: provider === 'openai' ? 'openai' as const : 'gemini' as const, apiKey, setProvider, setApiKey, builtIn, ready: !!apiKey.trim() || builtIn }
}
