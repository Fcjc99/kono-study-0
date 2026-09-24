import { useLocalSetting } from './useLocalSetting'

/** One per-plan AI provider/key on this device, used by K-Quiz, the photo scanner and the planner-photo
 * import. The storage keys predate the shared setting (K-Quiz owned them), so existing keys carry over. */
export function useAiHelper(profileId: string) {
  const [provider, setProvider] = useLocalSetting('kono-kquiz:' + profileId + ':provider', 'gemini')
  const [apiKey, setApiKey] = useLocalSetting('kono-kquiz:' + profileId + ':key', '')
  return { provider: provider === 'openai' ? 'openai' as const : 'gemini' as const, apiKey, setProvider, setApiKey }
}
