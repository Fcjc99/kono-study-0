import {lazyPanel} from '../lazyPanel'

// Panels shown both by the Workspace itself and by an on-demand page: one shared copy of each, so
// once its code has loaded it shows at once wherever it appears.
export const SharedWithMe=lazyPanel(()=>import('../components/SharedWithMe'))
export const WeekRecap=lazyPanel(()=>import('../components/WeekRecap'))
export const ScheduleSetup=lazyPanel(()=>import('../components/ScheduleSetup'))
