import {
  SANCTUARY_PROGRESS_SCHEMA_VERSION,
  type ProgressTaskSnapshot,
  type SanctuaryFeatureId,
  type SanctuaryProgressState,
  type TaskCompletionChange,
} from './types'

export const SANCTUARY_STAGE_THRESHOLDS = [0, 3, 8, 15, 25, 40] as const
export const POND_STAGE_THRESHOLDS = [0, 1, 2, 3, 5, 8] as const
export const HOME_STAGE_THRESHOLDS = [0, 5, 12, 20, 30, 40] as const
export const LANTERN_STAGE_THRESHOLDS = [0, 1, 3, 5, 7, 14] as const
export const GARDEN_STAGE_THRESHOLDS = [0, 4, 10, 18, 30, 45] as const

/** The terrace's own furniture growth (baked into the terrace map background art) still tracks this
 * name per stage for the evolution-milestone notice — the lantern light halos this once also named
 * are retired, but the terrace itself still furnishes up through six stages. */
export const LANTERN_STAGE_NAMES = [
  'Simple terrace',
  'Quiet bench',
  'Cozy corner lounge',
  'Garden reading lounge',
  'Blossom pergola',
  'Grand sanctuary terrace',
] as const

const FEATURE_IDS: SanctuaryFeatureId[] = ['tree', 'pond', 'home', 'garden', 'bridge', 'lanterns', 'bamboo']

const unique = (values: string[]): string[] => [...new Set(values)]

const localDateKey = (isoDate: string): string => {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const normalizeProgressSubjectKey = (value: string | undefined): string => {
  const normalized = (value ?? '').trim().toLowerCase()
  if (!normalized) return 'general'
  if (normalized.includes('marine') || normalized.includes('science') || normalized.includes('biology') || normalized.includes('chemistry') || normalized.includes('physics')) return 'science'
  if (normalized.includes('spanish') || normalized.includes('language')) return 'spanish'
  if (normalized.includes('math') || normalized.includes('algebra') || normalized.includes('geometry') || normalized.includes('calculus')) return 'math'
  if (normalized.includes('sat')) return 'sat'
  if (normalized.includes('history')) return 'history'
  if (normalized.includes('english') || normalized.includes('1984') || normalized.includes('literature')) return 'english'
  if (normalized.includes('theology') || normalized.includes('religion')) return 'theology'
  return normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'general'
}

const stageForThresholds = (credits: number, thresholds: readonly number[]): number => {
  let stage = 0
  thresholds.forEach((threshold, index) => {
    if (credits >= threshold) stage = index
  })
  return stage
}

const nextThreshold = (credits: number, thresholds: readonly number[]): number | null => thresholds.find((threshold) => threshold > credits) ?? null

export const stageForCredits = (credits: number): number => stageForThresholds(credits, SANCTUARY_STAGE_THRESHOLDS)
export const nextStageThreshold = (credits: number): number | null => nextThreshold(credits, SANCTUARY_STAGE_THRESHOLDS)
export const pondStageForScienceCredits = (credits: number): number => stageForThresholds(credits, POND_STAGE_THRESHOLDS)
export const nextPondThreshold = (credits: number): number | null => nextThreshold(credits, POND_STAGE_THRESHOLDS)
export const homeStageForCredits = (credits: number): number => stageForThresholds(credits, HOME_STAGE_THRESHOLDS)
export const nextHomeThreshold = (credits: number): number | null => nextThreshold(credits, HOME_STAGE_THRESHOLDS)
export const lanternStageForActiveDays = (days: number): number => stageForThresholds(days, LANTERN_STAGE_THRESHOLDS)
export const nextLanternThreshold = (days: number): number | null => nextThreshold(days, LANTERN_STAGE_THRESHOLDS)
export const gardenStageForCredits = (credits: number): number => stageForThresholds(credits, GARDEN_STAGE_THRESHOLDS)
export const nextGardenThreshold = (credits: number): number | null => nextThreshold(credits, GARDEN_STAGE_THRESHOLDS)

const emptyFeatureStages = (): Record<SanctuaryFeatureId, number> => Object.fromEntries(FEATURE_IDS.map((id) => [id, 0])) as Record<SanctuaryFeatureId, number>
const emptyFeatureThresholds = (): Record<SanctuaryFeatureId, number | null> => Object.fromEntries(FEATURE_IDS.map((id) => [id, null])) as Record<SanctuaryFeatureId, number | null>

const deriveFeatureState = (
  totalCredits: number,
  creditsBySubjectKey: Record<string, number>,
  completionDates: Record<string, number>,
  savedStages?: Partial<Record<SanctuaryFeatureId, number>>,
): { stages: Record<SanctuaryFeatureId, number>; next: Record<SanctuaryFeatureId, number | null> } => {
  const stages = { ...emptyFeatureStages(), ...(savedStages ?? {}) }
  const scienceCredits = creditsBySubjectKey.science ?? 0
  const activeDays = Object.keys(completionDates).filter((key) => (completionDates[key] ?? 0) > 0).length
  stages.tree = Math.min(SANCTUARY_STAGE_THRESHOLDS.length - 1, Math.max(stages.tree ?? 0, stageForCredits(totalCredits)))
  stages.pond = Math.min(POND_STAGE_THRESHOLDS.length - 1, Math.max(stages.pond ?? 0, pondStageForScienceCredits(scienceCredits)))
  stages.home = Math.min(HOME_STAGE_THRESHOLDS.length - 1, Math.max(stages.home ?? 0, homeStageForCredits(totalCredits)))
  stages.lanterns = Math.min(LANTERN_STAGE_THRESHOLDS.length - 1, Math.max(stages.lanterns ?? 0, lanternStageForActiveDays(activeDays)))
  stages.garden = Math.min(GARDEN_STAGE_THRESHOLDS.length - 1, Math.max(stages.garden ?? 0, gardenStageForCredits(totalCredits)))
  // Bamboo has been removed from the active Sanctuary; preserve the save key only for migration safety.
  stages.bamboo = 0
  const next = emptyFeatureThresholds()
  next.tree = nextStageThreshold(totalCredits)
  next.pond = nextPondThreshold(scienceCredits)
  next.home = nextHomeThreshold(totalCredits)
  next.lanterns = nextLanternThreshold(activeDays)
  next.garden = nextGardenThreshold(totalCredits)
  next.bamboo = null
  return { stages, next }
}

export const createSanctuaryProgress = (profileId: string, now = new Date().toISOString()): SanctuaryProgressState => ({
  schemaVersion: SANCTUARY_PROGRESS_SCHEMA_VERSION,
  profileId,
  creditedTaskIds: [],
  currentCompletedTaskIds: [],
  creditsBySubjectId: {},
  creditsBySubjectKey: {},
  completionDates: {},
  totalCredits: 0,
  currentCompletedCount: 0,
  unlockedStage: 0,
  readyStage: 0,
  nextStageAt: SANCTUARY_STAGE_THRESHOLDS[1],
  featureStages: emptyFeatureStages(),
  nextFeatureAt: {
    ...emptyFeatureThresholds(),
    tree: SANCTUARY_STAGE_THRESHOLDS[1],
    pond: POND_STAGE_THRESHOLDS[1],
    home: HOME_STAGE_THRESHOLDS[1],
    lanterns: LANTERN_STAGE_THRESHOLDS[1],
    garden: GARDEN_STAGE_THRESHOLDS[1],
    bamboo: null,
  },
  lastTaskCompletedAt: null,
  updatedAt: now,
})

export const migrateSanctuaryProgress = (
  raw: unknown,
  profileId: string,
  tasks: ProgressTaskSnapshot[] = [],
  now = new Date().toISOString(),
): SanctuaryProgressState => {
  const base = createSanctuaryProgress(profileId, now)
  const source = raw && typeof raw === 'object' ? raw as Partial<SanctuaryProgressState> : {}
  const profileTasks = tasks.filter((task) => task.profileId === profileId)
  const currentCompletedTaskIds = unique(profileTasks.filter((task) => task.done).map((task) => task.id))

  // Reopening work does not erase the lifetime credit ledger. Reset is explicit.

  const creditedTaskIds = unique([
    ...(Array.isArray(source.creditedTaskIds) ? source.creditedTaskIds.filter((id): id is string => typeof id === 'string') : []),
    ...currentCompletedTaskIds,
  ])
  const creditsBySubjectId: Record<string, number> = { ...(source.creditsBySubjectId ?? {}) }
  const creditsBySubjectKey: Record<string, number> = { ...(source.creditsBySubjectKey ?? {}) }
  const completionDates: Record<string, number> = { ...(source.completionDates ?? {}) }

  if (!source.creditsBySubjectId || !source.creditsBySubjectKey) {
    const rebuiltById: Record<string, number> = {}
    const rebuiltByKey: Record<string, number> = {}
    creditedTaskIds.forEach((taskId) => {
      const task = profileTasks.find((candidate) => candidate.id === taskId)
      if (!task) return
      rebuiltById[task.subjectId] = (rebuiltById[task.subjectId] ?? 0) + 1
      const key = normalizeProgressSubjectKey(task.subjectKey ?? task.subjectId)
      rebuiltByKey[key] = (rebuiltByKey[key] ?? 0) + 1
    })
    if (!source.creditsBySubjectId) Object.assign(creditsBySubjectId, rebuiltById)
    if (!source.creditsBySubjectKey) Object.assign(creditsBySubjectKey, rebuiltByKey)
  }

  const totalCredits = creditedTaskIds.length
  if (totalCredits > 0 && Object.keys(completionDates).length === 0) {
    const migrationDate = typeof source.lastTaskCompletedAt === 'string' ? source.lastTaskCompletedAt : now
    completionDates[localDateKey(migrationDate)] = totalCredits
  }
  const readyStage = stageForCredits(totalCredits)
  const savedUnlockedStage = Math.max(0, Number.isFinite(source.unlockedStage) ? Number(source.unlockedStage) : 0)
  const unlockedStage = Math.max(savedUnlockedStage, readyStage)
  const derived = deriveFeatureState(totalCredits, creditsBySubjectKey, completionDates, { ...(source.featureStages ?? {}), tree: unlockedStage })
  return {
    ...base,
    ...source,
    schemaVersion: SANCTUARY_PROGRESS_SCHEMA_VERSION,
    profileId,
    creditedTaskIds,
    currentCompletedTaskIds,
    creditsBySubjectId,
    creditsBySubjectKey,
    completionDates,
    totalCredits,
    currentCompletedCount: currentCompletedTaskIds.length,
    unlockedStage,
    readyStage,
    nextStageAt: nextStageThreshold(totalCredits),
    featureStages: derived.stages,
    nextFeatureAt: derived.next,
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : now,
  }
}

export const applyTaskCompletionChange = (
  state: SanctuaryProgressState,
  change: TaskCompletionChange,
): SanctuaryProgressState => {
  if (change.task.profileId !== state.profileId) return state
  const completedAt = change.completedAt ?? new Date().toISOString()
  const current = new Set(state.currentCompletedTaskIds)
  if (change.completed) current.add(change.task.id)
  else current.delete(change.task.id)


  const credited = new Set(state.creditedTaskIds)
  const creditsBySubjectId = { ...state.creditsBySubjectId }
  const creditsBySubjectKey = { ...(state.creditsBySubjectKey ?? {}) }
  const completionDates = { ...state.completionDates }
  let lastTaskCompletedAt = state.lastTaskCompletedAt

  if (change.completed && !credited.has(change.task.id)) {
    credited.add(change.task.id)
    creditsBySubjectId[change.task.subjectId] = (creditsBySubjectId[change.task.subjectId] ?? 0) + 1
    const subjectKey = normalizeProgressSubjectKey(change.task.subjectKey ?? change.task.subjectId)
    creditsBySubjectKey[subjectKey] = (creditsBySubjectKey[subjectKey] ?? 0) + 1
    const dateKey = localDateKey(completedAt)
    completionDates[dateKey] = (completionDates[dateKey] ?? 0) + 1
    lastTaskCompletedAt = completedAt
  }

  const totalCredits = credited.size
  const readyStage = stageForCredits(totalCredits)
  const unlockedStage = Math.max(state.unlockedStage, readyStage)
  const derived = deriveFeatureState(totalCredits, creditsBySubjectKey, completionDates, { ...state.featureStages, tree: unlockedStage })
  return {
    ...state,
    creditedTaskIds: [...credited],
    currentCompletedTaskIds: [...current],
    creditsBySubjectId,
    creditsBySubjectKey,
    completionDates,
    totalCredits,
    currentCompletedCount: current.size,
    unlockedStage,
    readyStage,
    featureStages: derived.stages,
    nextFeatureAt: derived.next,
    nextStageAt: nextStageThreshold(totalCredits),
    lastTaskCompletedAt,
    updatedAt: completedAt,
  }
}

export const syncCurrentTaskCompletion = (
  state: SanctuaryProgressState,
  tasks: ProgressTaskSnapshot[],
  now = new Date().toISOString(),
): SanctuaryProgressState => {
  const profileTasks = tasks.filter((task) => task.profileId === state.profileId)
  const currentCompletedTaskIds = unique(profileTasks.filter((task) => task.done).map((task) => task.id))
  if (
    currentCompletedTaskIds.length === state.currentCompletedTaskIds.length
    && currentCompletedTaskIds.every((id) => state.currentCompletedTaskIds.includes(id))
  ) return state
  return {
    ...state,
    currentCompletedTaskIds,
    currentCompletedCount: currentCompletedTaskIds.length,
    updatedAt: now,
  }
}

export const unlockReadyStage = (
  state: SanctuaryProgressState,
  now = new Date().toISOString(),
): SanctuaryProgressState => {
  const unlockedStage = Math.max(state.unlockedStage, state.readyStage)
  return {
    ...state,
    unlockedStage,
    featureStages: { ...state.featureStages, tree: Math.max(state.featureStages.tree ?? 0, unlockedStage) },
    updatedAt: now,
  }
}
