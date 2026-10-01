import {addDays} from './studyScheduler'
import {aiFail,aiReady,callAi,type AiProvider} from './aiProvider'

/** Big assignments broken into dated steps (Task.subtasks with `due`): an essay due in two weeks
 * becomes research, outline, draft, revise and a final check spread over the days before it. KONO's AI
 * writes steps that fit the assignment when it's available; otherwise a template for the kind of
 * work (writing, a project, reading, or anything else) is used. Steps finish the day before it's due. */
export type StepDraft={title:string;due:string}

const TEMPLATES:{match:RegExp;steps:string[]}[]=[
 {match:/essay|paper|report|research|writ|thesis|article|review|story|poem|speech/i,steps:['Pick your topic and gather sources','Make an outline','Write the first draft','Revise and edit','Read it over one last time']},
 {match:/project|poster|presentation|slides|model|diorama|video|portfolio|fair|lab|build|design/i,steps:['Plan it and list what you need','Gather materials and information','Make the main part','Add the finishing touches','Practice or check it over']},
 {match:/read|book|novel|chapter/i,steps:['Read the first part','Read the middle part','Finish reading','Write your notes or response']},
]
const GENERAL=['Read the instructions and get started','Do the main part','Finish and check your work']

/** The days steps can go on: today through the day before `due` (just `due` if there's no time before). */
const stepWindow=(today:string,due:string)=>{const start=today<due?today:due,last=addDays(due,-1)>=start?addDays(due,-1):due;let days=1;for(let d=start;d<last;d=addDays(d,1))days++;return {start,days}}
/** Spreads `count` steps evenly over those days, first step today and last the day before it's due. */
export function stepDays(count:number,today:string,due:string):string[]{
 const {start,days}=stepWindow(today,due)
 return Array.from({length:count},(_,i)=>addDays(start,count===1?days-1:Math.round(i*(days-1)/(count-1))))
}

export function templateSteps(title:string,today:string,due:string):StepDraft[]{
 const steps=(TEMPLATES.find(t=>t.match.test(title))?.steps??GENERAL).slice()
 // Not enough days for every step: keep the first and last few so it still starts and ends well.
 const room=Math.max(2,stepWindow(today,due).days)
 const kept=steps.length>room?[...steps.slice(0,room-1),steps[steps.length-1]]:steps
 const days=stepDays(kept.length,today,due)
 return kept.map((title,i)=>({title,due:days[i]}))
}

export const stepsPrompt=(title:string,notes:string,today:string,due:string)=>`You help a middle or high school student plan a school assignment.
Assignment: ${JSON.stringify(title)}${notes.trim()?`\nDetails: ${JSON.stringify(notes.trim().slice(0,800))}`:''}
Today is ${today}. It is due ${due}.
Break it into 3 to 6 short, concrete steps in the order to do them, each with the day to do it (YYYY-MM-DD), from ${today} to the day before ${due} (use ${due} only if there is no time before). Space them out; it's fine for two small steps to share a day. Each step title is at most 8 words, written to the student ("Write your thesis statement").
Reply with JSON only: {"steps":[{"title":"...","date":"YYYY-MM-DD"}]}`

/** Checks the AI's reply: 2 to 8 steps, each with a title and a date from today to the due date, in date order. */
export function parseSteps(raw:string,today:string,due:string):StepDraft[]{
 const text=raw.trim().replace(/^```(?:json)?\s*|\s*```$/g,'')
 let obj:unknown
 try{obj=JSON.parse(text)}catch{aiFail('The AI response was not valid JSON. Try again.')}
 const list=obj&&typeof obj==='object'?(obj as Record<string,unknown>).steps:undefined
 if(!Array.isArray(list))aiFail('The AI response was not in the expected format. Try again.')
 const steps=(list as unknown[]).flatMap(item=>{
  if(!item||typeof item!=='object')return []
  const s=item as Record<string,unknown>
  const title=typeof s.title==='string'?s.title.replace(/\s+/g,' ').trim().slice(0,80):''
  const date=typeof s.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s.date)?s.date:''
  return title&&date?[{title,due:date<today?today:date>due?due:date}]:[]
 }).slice(0,8)
 if(steps.length<2)aiFail('The AI didn’t suggest enough steps. Try again.')
 return steps.sort((a,b)=>a.due.localeCompare(b.due))
}

/** KONO's AI first; the template if it isn't available or its answer doesn't check out. */
export async function suggestSteps(title:string,notes:string,today:string,due:string,ai:{provider:AiProvider;apiKey:string}|null):Promise<{steps:StepDraft[];byAi:boolean}>{
 if(ai&&aiReady(ai.apiKey)){
  try{return {steps:parseSteps(await callAi(stepsPrompt(title,notes,today,due),ai.provider,ai.apiKey.trim()),today,due),byAi:true}}
  catch{/* Fall back to the template below. */}
 }
 return {steps:templateSteps(title,today,due),byAi:false}
}
