export type Priority = 'low' | 'medium' | 'high'
export type AssignmentStatus = 'not-started' | 'in-progress' | 'completed'

export type SchoolYear = { id: string; name: string; active: boolean; archived?: boolean; profileName?: string; grade?: string }
export type Subject = { id: string; schoolYearId: string; name: string; color: string; icon: string }
export type Subtask = { id: string; title: string; completed: boolean }
export type Assignment = {
  id: string
  schoolYearId: string
  subjectId: string
  title: string
  dueDate: string
  scheduledDate: string
  estimatedMinutes: number
  priority: Priority
  status: AssignmentStatus
  notes: string
  subtasks: Subtask[]
  createdAt: string
  completedAt?: string
}
export type PlannerData = { schoolYears: SchoolYear[]; subjects: Subject[]; assignments: Assignment[] }
