export const SANCTUARY_PROGRESS_SCHEMA_VERSION = 7

export type SanctuaryFeatureId = 'tree' | 'pond' | 'home' | 'garden' | 'bridge' | 'lanterns' | 'bamboo'

export interface SanctuaryProgressState {
  schemaVersion: number
  profileId: string
  creditedTaskIds: string[]
  currentCompletedTaskIds: string[]
  creditsBySubjectId: Record<string, number>
  creditsBySubjectKey: Record<string, number>
  completionDates: Record<string, number>
  totalCredits: number
  currentCompletedCount: number
  unlockedStage: number
  readyStage: number
  nextStageAt: number | null
  featureStages: Record<SanctuaryFeatureId, number>
  nextFeatureAt: Record<SanctuaryFeatureId, number | null>
  lastTaskCompletedAt: string | null
  updatedAt: string
}

export interface ProgressTaskSnapshot {
  id: string
  profileId: string
  subjectId: string
  subjectKey?: string
  done: boolean
}

export interface TaskCompletionChange {
  task: ProgressTaskSnapshot
  completed: boolean
  completedAt?: string
}
