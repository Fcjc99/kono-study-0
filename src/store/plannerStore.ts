import type { Assignment, PlannerData, Subject } from '../types/planner'
import { studyTasks, subjectMeta, type SubjectKey } from '../data/studyPlan'

export const STORAGE_KEY = 'kono-planner-v0.3.2'
const PREVIOUS_STORAGE_KEYS = ['kono-planner-v0.3.1']
const legacyKey = 'kono-completed-tasks-v1'
const subjectColors = ['#7ca982','#d9908c','#7f9fc9','#c69a65','#9a86bd','#5da8a1','#ba7f9d','#8b9a72']

export function makeId(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}` }

function seedData(): PlannerData {
  let legacy: Record<string, boolean> = {}
  try { legacy = JSON.parse(localStorage.getItem(legacyKey) || '{}') } catch { legacy = {} }
  const schoolYearId = 'summer-2026'
  const keys = (Object.keys(subjectMeta) as SubjectKey[])
  const subjects: Subject[] = keys.map((key, i) => ({
    id: `subject-${key.toLowerCase().replace(/[^a-z0-9]/g,'')}`,
    schoolYearId,
    name: subjectMeta[key].label,
    color: subjectColors[i % subjectColors.length],
    icon: subjectMeta[key].icon,
  }))
  const subjectByKey = Object.fromEntries(keys.map((key, i) => [key, subjects[i].id])) as Record<SubjectKey,string>
  const assignments: Assignment[] = studyTasks.map((task) => ({
    id: task.id,
    schoolYearId,
    subjectId: subjectByKey[task.subject],
    title: task.title,
    dueDate: task.date,
    scheduledDate: task.date,
    estimatedMinutes: task.subject === 'SAT' ? 40 : 50,
    priority: 'medium',
    status: legacy[task.id] ? 'completed' : 'not-started',
    notes: '',
    subtasks: [],
    createdAt: '2026-07-13T12:00:00.000Z',
    completedAt: legacy[task.id] ? new Date().toISOString() : undefined,
  }))
  return { schoolYears: [{ id: schoolYearId, name: 'Summer 2026', active: true, profileName: 'Sophia' }], subjects, assignments }
}

export function loadPlanner(): PlannerData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored) as PlannerData
    for (const key of PREVIOUS_STORAGE_KEYS) {
      const previous = localStorage.getItem(key)
      if (previous) {
        const migrated = JSON.parse(previous) as PlannerData
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
        return migrated
      }
    }
  } catch { /* reset below */ }
  return seedData()
}

export function savePlanner(data: PlannerData) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
