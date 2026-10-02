import type {Collection,Entry} from './workspace'

/** What each kind of entry is called (editor titles, Trash, cards). */
export const labels:Record<Collection,string>={tasks:'Assignment',notes:'Note',exams:'Exam / project',calendarEvents:'Event',subjects:'Subject',kids:'Kid',studyPlans:'Study plan',flashcardDecks:'Flashcards',kquizSets:'K-Quiz set',kquizSources:'K-Quiz note',studySeasons:'Schedule'}
/** An entry open in the editor: `original` is how it was when opened (missing for a new one). */
export type Edit={key:Collection;entry:Entry;original?:Entry}
