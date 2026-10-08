import {records,type Collection} from './store/workspace'
import type {AppData} from './store/model'
import {teamThemeIds} from './teamThemes'

/* Shared by the workspace and its settings screens (WorkspaceSettings.tsx, which loads on demand). */
// Settings tabs, grouped by what a person is trying to do rather than by where each feature was built.
export const SETTINGS_TABS=['Look & feel','Notifications','Family','Schedules','Import & export','Plans & account'] as const
/** 'KONO support' only appears for support accounts; the server enforces the access itself. */
export type SettingsTab=typeof SETTINGS_TABS[number]|'KONO support'
export const pages=['Sanctuary','Planner','Kids','Subjects','Notes','K-Quiz','Exams','Settings','Trash'] as const
export type Page=typeof pages[number]
// Team colors are offered in both Cozy and Simplified, under their own heading.
export const cozyPalettes=['coral','sakura','lavender','mint','honey','zen','floral','ocean']
export const cozyPalette=(theme:string)=>cozyPalettes.includes(theme)||teamThemeIds.includes(theme)?theme:'coral'
// Modern and Zen Ink are each one opinionated, fully art-directed look rather than a color you
// pick — they carry their own fixed palette instead of showing the swatch picker.
export const fixedPaletteExperiences:string[]=['modern','sumi']
export const experienceOptions=[
 {id:'cozy',title:'Cozy',glyph:'🌸',description:'Notebook tabs, colorful pinned papers and gentle movement.'},
 {id:'simplified',title:'Simplified',glyph:'▢',description:'A compact workspace with straightforward cards and bottom navigation.'},
 {id:'modern',title:'Modern',glyph:'⚪',description:'Clean, minimal and spacious — off-white surfaces, quiet type and a single accent, in the spirit of apple.com.'},
 {id:'sumi',title:'Zen Ink',glyph:'⛩️',description:'Sumi ink and washi paper — muted indigo and charcoal, hairline rules and quiet type, in the spirit of Japanese ink-wash art.'},
] as const
export const own=(data:AppData,key:Collection)=>records(data,key).filter(r=>r.profileId===data.activeProfileId)
