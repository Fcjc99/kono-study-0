export type Assignment = {
  id: number
  subject: string
  title: string
  dueDate: string
  time: string
  duration: number
  completed: boolean
}

export const assignments: Assignment[] = [
  {
    id: 1,
    subject: 'Honors Algebra II',
    title: 'Complete problems 1–6',
    dueDate: '2026-07-19',
    time: '4:15 PM',
    duration: 45,
    completed: false,
  },
  {
    id: 2,
    subject: 'History',
    title: 'Read and annotate chapter 1',
    dueDate: '2026-07-19',
    time: '5:15 PM',
    duration: 50,
    completed: false,
  },
  {
    id: 3,
    subject: 'SAT Prep',
    title: 'Complete pages 1–12',
    dueDate: '2026-07-19',
    time: '7:30 PM',
    duration: 40,
    completed: false,
  },
]