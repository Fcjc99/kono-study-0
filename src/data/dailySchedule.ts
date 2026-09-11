export type ScheduleBlock = { start: string; end: string; label: string; kind: 'study' | 'break' | 'routine' | 'hobby' }

export const weekdaySchedule: ScheduleBlock[] = [
  { start: '08:00', end: '08:20', label: 'Wake up, breakfast, get ready', kind: 'routine' },
  { start: '08:20', end: '09:00', label: 'SAT reading · 18–20 pages', kind: 'study' },
  { start: '09:00', end: '09:25', label: 'Leave for tennis', kind: 'routine' },
  { start: '09:30', end: '15:30', label: 'Tennis', kind: 'routine' },
  { start: '15:30', end: '16:00', label: 'Home, snack, relax', kind: 'break' },
  { start: '16:00', end: '17:00', label: 'Homework Block 1', kind: 'study' },
  { start: '17:00', end: '17:15', label: 'Break', kind: 'break' },
  { start: '17:15', end: '18:15', label: 'Homework Block 2', kind: 'study' },
  { start: '18:15', end: '19:00', label: 'Dinner', kind: 'break' },
  { start: '19:00', end: '20:00', label: 'Homework Block 3', kind: 'study' },
  { start: '20:00', end: '20:30', label: 'Learn a new hobby', kind: 'hobby' },
  { start: '20:30', end: '21:15', label: 'Finish homework or review', kind: 'study' },
  { start: '21:15', end: '22:15', label: 'Shower, stretch, recovery', kind: 'routine' },
  { start: '22:15', end: '23:30', label: 'Free time and bed', kind: 'break' },
]

export const weekendSchedule: ScheduleBlock[] = [
  { start: '09:00', end: '11:00', label: 'Homework Block 1', kind: 'study' },
  { start: '11:00', end: '14:00', label: 'Lunch and free time', kind: 'break' },
  { start: '14:00', end: '16:00', label: 'Homework Block 2', kind: 'study' },
  { start: '16:00', end: '16:30', label: 'Learn a new hobby', kind: 'hobby' },
  { start: '16:30', end: '23:30', label: 'Free time', kind: 'break' },
]

export const scheduleForDate = (date = new Date()) => [0, 6].includes(date.getDay()) ? weekendSchedule : weekdaySchedule
