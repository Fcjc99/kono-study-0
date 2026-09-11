export type SubjectKey = 'SAT' | 'Math' | 'Spanish' | 'Theology' | 'History' | 'Science' | '1984' | 'Free'

export type StudyTask = {
  id: string
  date: string
  subject: SubjectKey
  title: string
}

export const subjectMeta: Record<SubjectKey, { label: string; icon: string; totalLabel: string }> = {
  SAT: { label: 'SAT Prep', icon: '▤', totalLabel: '518 pages' },
  Math: { label: 'Algebra II', icon: '⌗', totalLabel: '78 problems' },
  Spanish: { label: 'Spanish', icon: 'A', totalLabel: 'All exercises' },
  Theology: { label: 'Theology', icon: '✦', totalLabel: '10 questions' },
  History: { label: 'History', icon: 'H', totalLabel: '6 annotations per chapter' },
  Science: { label: 'Marine Science', icon: '≈', totalLabel: '3 assignments' },
  '1984': { label: '1984 Literature', icon: 'B', totalLabel: 'Annotate and take notes' },
  Free: { label: 'Organization', icon: '✓', totalLabel: 'Review and catch-up' },
}

const day = (date: string, entries: Array<[SubjectKey, string]>): StudyTask[] =>
  entries.map(([subject, title], index) => ({ id: `${date}-${subject}-${index}`, date, subject, title }))

export const studyTasks: StudyTask[] = [
  ...day('2026-07-13', [['SAT','Pages 1–20'],['Math','Problems 1–3'],['Spanish','Chapter 1'],['1984','Chapter 1']]),
  ...day('2026-07-14', [['SAT','Pages 21–40'],['Math','Problems 4–6'],['History','Prologue + 6 annotations'],['Science','Organism research']]),
  ...day('2026-07-15', [['SAT','Pages 41–60'],['Math','Problems 7–9'],['Spanish','Finish Chapter 1'],['1984','Chapters 2–3']]),
  ...day('2026-07-16', [['SAT','Pages 61–80'],['Math','Problems 10–11'],['Theology','Questions 1–5'],['Science','Research']]),
  ...day('2026-07-17', [['SAT','Pages 81–90'],['Math','Problems 12–13'],['Theology','Questions 6–10'],['History','Chapter 1']]),
  ...day('2026-07-18', [['SAT','Pages 91–105'],['Spanish','Chapter 2'],['Science','PowerPoint']]),
  ...day('2026-07-19', [['Science','Finish Assignment 1'],['1984','Reading'],['Free','Catch up']]),

  ...day('2026-07-20', [['SAT','Pages 106–120'],['Math','Problems 14–16'],['Spanish','Chapter 3'],['History','Chapter 2']]),
  ...day('2026-07-21', [['SAT','Pages 121–140'],['Math','Problems 17–19'],['Spanish','Chapter 3'],['1984','Chapters 4–5']]),
  ...day('2026-07-22', [['SAT','Pages 141–160'],['Math','Problems 20–22'],['Spanish','Finish Chapter 3'],['History','Chapter 3']]),
  ...day('2026-07-23', [['SAT','Pages 161–175'],['Math','Problems 23–24'],['Science','Finish organism project']]),
  ...day('2026-07-24', [['SAT','Pages 176–190'],['Math','Problems 25–26'],['1984','Finish Part 1']]),
  ...day('2026-07-25', [['Spanish','Chapter 4'],['History','Review Chapters 2–3'],['1984','Notes']]),
  ...day('2026-07-26', [['Free','Organize work'],['1984','Light reading']]),

  ...day('2026-07-27', [['SAT','Pages 191–205'],['Math','Problems 27–29'],['Spanish','Chapter 5'],['History','Chapter 4']]),
  ...day('2026-07-28', [['SAT','Pages 206–220'],['Math','Problems 30–31'],['Science','Start experimental design']]),
  ...day('2026-07-29', [['SAT','Pages 221–240'],['Math','Problems 32–34'],['Spanish','Finish Chapter 5'],['1984','Part 2, Chapters 1–2']]),
  ...day('2026-07-30', [['SAT','Pages 241–255'],['Math','Problems 35–36'],['Science','Continue experimental design']]),
  ...day('2026-07-31', [['SAT','Pages 256–275'],['Math','Problems 37–39'],['1984','Part 2, Chapters 3–4']]),
  ...day('2026-08-01', [['Science','Finish experimental design'],['History','Review']]),
  ...day('2026-08-02', [['Free','Catch up'],['1984','Reading']]),

  ...day('2026-08-03', [['SAT','Pages 276–290'],['Math','Problems 40–42'],['Spanish','Chapter 7'],['History','Chapter 5']]),
  ...day('2026-08-04', [['SAT','Pages 291–305'],['Math','Problems 43–44'],['Science','Finish experimental design']]),
  ...day('2026-08-05', [['SAT','Pages 306–320'],['Math','Problems 45–47'],['Spanish','Finish Chapter 7'],['1984','Part 2, Chapters 5–6']]),
  ...day('2026-08-06', [['SAT','Pages 321–335'],['Math','Problems 48–50'],['History','Chapter 6']]),
  ...day('2026-08-07', [['SAT','Pages 336–360'],['Math','Problems 51–52'],['1984','Finish Part 2']]),
  ...day('2026-08-08', [['Spanish','Chapter 8'],['History','Review Chapters 5–6']]),
  ...day('2026-08-09', [['Free','Catch up'],['1984','Reading']]),

  ...day('2026-08-10', [['SAT','Pages 361–375'],['Math','Problems 53–55'],['Spanish','Chapter 9'],['Science','Start beach project']]),
  ...day('2026-08-11', [['SAT','Pages 376–390'],['Math','Problems 56–57'],['Science','Beach research and drawings']]),
  ...day('2026-08-12', [['SAT','Pages 391–410'],['Math','Problems 58–60'],['Spanish','Finish Chapter 9'],['History','Chapter 7']]),
  ...day('2026-08-13', [['SAT','Pages 411–425'],['Math','Problems 61–62'],['Science','Beach project']]),
  ...day('2026-08-14', [['SAT','Pages 426–445'],['Math','Problems 63–65'],['1984','Part 3 + finish book']]),
  ...day('2026-08-15', [['Science','Finish beach project'],['Spanish','Chapter 10']]),
  ...day('2026-08-16', [['History','Chapter 8'],['Free','Catch up']]),

  ...day('2026-08-17', [['SAT','Pages 446–460'],['Math','Problems 66–68'],['Spanish','Finish remaining exercises']]),
  ...day('2026-08-18', [['SAT','Pages 461–475'],['Math','Problems 69–71'],['History','Epilogue + annotations']]),
  ...day('2026-08-19', [['SAT','Pages 476–495'],['Math','Problems 72–75'],['Science','Finish beach project']]),
  ...day('2026-08-20', [['SAT','Pages 496–510'],['Math','Problems 76–77'],['Free','Review all work and organize']]),
  ...day('2026-08-21', [['SAT','Pages 511–518'],['Math','Problem 78'],['Free','Final review']]),
  ...day('2026-08-22', [['Free','Organize all assignments']]),
  ...day('2026-08-23', [['Free','Submit or print; completed']]),
]
