import type { DayPhase } from '../sanctuary/types'

export type StudyDecorAssetId =
  | 'outdoor-study-desk'
  | 'reading-bench'
  | 'bulletin-board'
  | 'book-stack'
  | 'signpost'
  | 'picnic-study-blanket'
  | 'tea-table-cushions'
  | 'exam-project-shrine'

export type StudyDecorAsset = {
  id: StudyDecorAssetId
  label: string
  width: number
  height: number
  rotatable: boolean
  flippable: boolean
}

export const STUDY_DECOR_ASSETS: StudyDecorAsset[] = [
  { id: 'outdoor-study-desk', label: 'Outdoor Study Desk', width: 375, height: 345, rotatable: true, flippable: true },
  { id: 'reading-bench', label: 'Reading Bench', width: 310, height: 237, rotatable: true, flippable: true },
  { id: 'bulletin-board', label: 'Bulletin Board', width: 345, height: 286, rotatable: true, flippable: true },
  { id: 'book-stack', label: 'Book Stack', width: 245, height: 159, rotatable: true, flippable: true },
  { id: 'signpost', label: 'Signpost', width: 245, height: 384, rotatable: true, flippable: true },
  { id: 'picnic-study-blanket', label: 'Picnic Study Blanket', width: 380, height: 311, rotatable: true, flippable: true },
  { id: 'tea-table-cushions', label: 'Tea Table & Cushions', width: 355, height: 322, rotatable: true, flippable: true },
  { id: 'exam-project-shrine', label: 'Exam Trophy Shrine', width: 230, height: 380, rotatable: true, flippable: true },
]

export const STUDY_DECOR_ASSET_BY_ID = Object.fromEntries(STUDY_DECOR_ASSETS.map(a => [a.id, a])) as Record<StudyDecorAssetId, StudyDecorAsset>

export const studyDecorAssetTexturePath = (id: StudyDecorAssetId, phase: DayPhase): string =>
  `/garden/registered-22.8.6/study-decor/${id}/${phase}.png`
