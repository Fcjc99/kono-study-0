export type SanctuaryLandmarkId =
  | 'cherry'
  | 'house'
  | 'pond'
  | 'bridge'
  | 'mailbox'
  | 'lanterns'
  | 'garden'
  | 'tea-house'

export interface SanctuaryLandmark {
  id: SanctuaryLandmarkId
  title: string
  level: string
  description: string
  requirement: string
  reward: string
  progress: number
  progressGoal: number
  x: number
  y: number
  width: number
  height: number
}
