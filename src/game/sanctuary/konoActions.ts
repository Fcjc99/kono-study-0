import type { DayPhase } from './types'
export type KonoLandmarkId = 'house' | 'garden' | 'cherry' | 'pond' | 'bridge' | 'mailbox' | 'lanterns'
export type KonoCue = 'leaf' | 'petal' | 'ripple' | 'firefly' | 'none'

export interface KonoContextAction {
  id: string
  label: string
  title: string
  hint: string
  landmarkId: KonoLandmarkId
  cue: KonoCue
  durationMs: number
  phase: DayPhase
}

export interface KonoInteractionSummary {
  totalInteractions: number
  lastActionId: string | null
  lastLandmarkId: KonoLandmarkId | null
  landmarkVisits: Partial<Record<KonoLandmarkId, number>>
}

export interface ActionContext {
  lanternStage: number
  pondStage: number
  phase: DayPhase
}

const makeAction = (
  landmarkId: KonoLandmarkId,
  id: string,
  label: string,
  title: string,
  hint: string,
  cue: KonoCue,
  phase: DayPhase,
  durationMs = 2_650,
): KonoContextAction => ({ landmarkId, id, label, title, hint, cue, durationMs, phase })

const terraceCue = (phase: DayPhase): KonoCue => {
  if (phase === 'evening' || phase === 'night') return 'firefly'
  if (phase === 'morning') return 'petal'
  return 'leaf'
}

export function getKonoActions(landmarkId: KonoLandmarkId, context: ActionContext): KonoContextAction[] {
    const phase = context.phase
    switch (landmarkId) {
      case 'house':
        if (phase === 'evening') {
          return [makeAction('house', 'warm-home', 'Warm Up Inside', 'A Cozy Evening at Home', 'The cottage windows glow warmly while KONO settles in.', 'none', phase, 3_050)]
        }
        if (phase === 'night') {
          return [makeAction('house', 'rest-home', 'Rest at Home', 'Quiet Night at Home', 'The cottage is dark and still — time to rest.', 'none', phase, 3_050)]
        }
        return [makeAction('house', 'rest-home', 'Rest at Home', 'Resting at Home', 'A quiet reset before the next study block.', 'leaf', phase, 2_650)]

      case 'garden':
        if (phase === 'night') {
          return [makeAction('garden', 'check-garden', 'Check Garden', 'A Quiet Garden Check', 'The beds are settled for the night.', 'none', phase, 2_350)]
        }
        return [makeAction('garden', 'tend-garden', 'Tend Garden', 'Tending the Garden', phase === 'evening' ? 'A quick evening check among the growing plants.' : 'A few calm minutes among the growing plants.', phase === 'evening' ? 'firefly' : 'leaf', phase, 2_650)]

      case 'cherry':
        return [makeAction('cherry', 'sit-cherry', 'Sit Under Tree', 'Under the Cherry Tree', phase === 'night' ? 'Moonlight settles over the branches.' : 'A quiet place to read, think, or watch the petals.', phase === 'night' ? 'none' : 'petal', phase, 2_950)]

      case 'pond':
        return context.pondStage >= 3
          ? [makeAction('pond', 'watch-koi', 'Watch the Koi', 'Watching the Koi', phase === 'night' ? 'The koi move slowly beneath the moonlit water.' : 'The koi circle slowly through their safe pond paths.', 'ripple', phase, 2_850)]
          : [makeAction('pond', 'sit-pond', 'Sit by Pond', 'Beside the Pond', phase === 'night' ? 'The water catches a little moonlight.' : 'The water is calm and still.', 'ripple', phase, 2_650)]

      case 'bridge':
        return [makeAction('bridge', 'quiet-bridge', 'Watch the Water', 'At the Garden Bridge', phase === 'night' ? 'Water moves quietly below the bridge.' : 'A short break listening to the water below.', 'ripple', phase, 2_550)]

      case 'mailbox':
        return [makeAction('mailbox', 'check-mailbox', 'Check Mailbox', 'Checking the Mailbox', 'Nothing urgent — the sanctuary is quiet.', phase === 'night' ? 'none' : 'leaf', phase, 2_150)]

      case 'lanterns': {
        const cue = terraceCue(phase)
        const eveningTeaHint = phase === 'evening' ? 'The terrace lights are on and the view is warm.' : 'A warm cup and a quiet view.'
        const readHint = phase === 'night' ? 'A quiet page or two before the sanctuary sleeps.' : phase === 'evening' ? 'A cozy reading spot under the terrace lights.' : 'A comfortable place to read for a while.'
        const restHint = phase === 'night' ? 'The terrace is dark and calm under the night sky.' : 'The finished terrace is made for slowing down.'

        if (context.lanternStage >= 5) {
          return [
            makeAction('lanterns', 'terrace-tea', 'Have Tea', 'Tea on the Terrace', eveningTeaHint, cue, phase, 3_000),
            makeAction('lanterns', 'terrace-read', 'Read', 'Reading on the Terrace', readHint, cue, phase, 3_200),
            makeAction('lanterns', 'terrace-rest', 'Rest', 'Resting on the Terrace', restHint, phase === 'night' ? 'none' : cue, phase, 3_050),
          ]
        }
        if (context.lanternStage >= 4) {
          return [
            makeAction('lanterns', 'terrace-sit', 'Sit Down', 'Settling In', 'A comfortable pause on the terrace.', cue, phase, 2_650),
            makeAction('lanterns', 'terrace-tea', 'Have Tea', 'Tea on the Terrace', eveningTeaHint, cue, phase, 3_000),
            makeAction('lanterns', 'terrace-read', 'Read', 'Reading on the Terrace', readHint, cue, phase, 3_200),
          ]
        }
        if (context.lanternStage >= 3) {
          return [
            makeAction('lanterns', 'terrace-sit', 'Sit Down', 'Settling In', 'A comfortable pause on the terrace.', cue, phase, 2_650),
            makeAction('lanterns', 'terrace-tea', 'Have Tea', 'Tea on the Terrace', eveningTeaHint, cue, phase, 3_000),
          ]
        }
        if (context.lanternStage >= 2) {
          return [makeAction('lanterns', 'terrace-sit', 'Sit Down', 'Settling In', 'A comfortable pause on the terrace.', cue, phase, 2_650)]
        }
        return [makeAction('lanterns', 'terrace-lookout', 'Enjoy Terrace', 'Lantern Terrace', phase === 'night' ? 'A dark, quiet lookout over the sanctuary.' : 'Looking out over the sanctuary.', phase === 'night' ? 'none' : cue, phase, 2_450)]
      }
    }
  }
