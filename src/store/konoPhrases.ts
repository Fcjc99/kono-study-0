export type KonoPhrase={kind:'greeting'|'reminder'|'affirmation'|'fact'|'celebration';text:string}

const timeGreeting=(hour:number)=>hour<5?'Still up?':hour<12?'Good morning':hour<17?'Good afternoon':hour<21?'Good evening':'Working late?'

const AFFIRMATIONS=[
 "You're doing great — one step at a time.",
 'Small progress is still progress. Keep going.',
 'Proud of you for showing up today.',
 "Rest counts too. You've earned a breath.",
 'Every assignment you finish is a promise kept to yourself.',
 "You've got this.",
]

const FACTS=[
 'Fun fact: octopuses have three hearts.',
 'Fun fact: honey never spoils.',
 "Fun fact: a group of flamingos is called a 'flamboyance.'",
 "Fun fact: bananas are berries, but strawberries aren't.",
 'Fun fact: the Eiffel Tower grows a little taller in summer heat.',
 'Fun fact: sea otters hold hands while sleeping so they don’t drift apart.',
]

const CELEBRATIONS=[
 "Everything's done for today — nicely handled.",
 "That's today's list cleared. Enjoy the rest of your day.",
 'All caught up for today. Go do something nice for yourself.',
]

/** One phrase per Workspace mount (see the lazy useState in Workspace.tsx) — a live-agent "hello"
 * rather than nagging, so it leans on whatever is most useful to say (what's due) and only falls
 * back to something lighter when there's nothing to report. */
export function pickKonoPhrase({name,hour,dueToday}:{name:string;hour:number;dueToday:{title:string}[]},rand:()=>number=Math.random):KonoPhrase{
 const greet=timeGreeting(hour)+(name?', '+name:'')+'.'
 if(dueToday.length>0){
  const detail=dueToday.length===1?'"'+dueToday[0].title+'" is due today.':dueToday.length+' things are due today.'
  return {kind:'reminder',text:greet+' '+detail}
 }
 if(rand()<0.5)return {kind:'affirmation',text:greet+' '+AFFIRMATIONS[Math.floor(rand()*AFFIRMATIONS.length)]}
 return {kind:'fact',text:greet+' '+FACTS[Math.floor(rand()*FACTS.length)]}
}

export function konoCelebration(rand:()=>number=Math.random):KonoPhrase{
 return {kind:'celebration',text:CELEBRATIONS[Math.floor(rand()*CELEBRATIONS.length)]}
}
