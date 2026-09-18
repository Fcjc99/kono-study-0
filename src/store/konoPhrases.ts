export type KonoPhrase={kind:'greeting'|'reminder'|'affirmation'|'fact'|'celebration'|'milestone';text:string}

/** Checked with .includes(), not a threshold -- a streak only ever equals one of these on the exact
 * day it's first reached, so this doubles as "is this a day worth celebrating." */
export const STREAK_MILESTONES=[3,7,14,30,60,100,180,365]

const timeGreeting=(hour:number)=>hour<5?'Still up?':hour<12?'Good morning':hour<17?'Good afternoon':hour<21?'Good evening':'Working late?'

/** Deterministic PRNG (xmur3 hash -> mulberry32) seeded from a string -- used to make the
 * affirmation/fact choice stable for a given day+profile instead of re-rolling on every reload, so
 * it reads as an actual "fact of the day" rather than a fresh coin flip each time the greeting
 * happens to fire. */
export function seededRand(seed:string):()=>number{
 let h=1779033703^seed.length
 for(let i=0;i<seed.length;i++){h=Math.imul(h^seed.charCodeAt(i),3432918353);h=h<<13|h>>>19}
 let a=h>>>0
 return()=>{
  a|=0;a=a+0x6D2B79F5|0
  let t=Math.imul(a^a>>>15,1|a)
  t=t+Math.imul(t^t>>>7,61|t)^t
  return((t^t>>>14)>>>0)/4294967296
 }
}

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
 'Fun fact: a single cloud can weigh over a million pounds.',
 'Fun fact: sharks are older than trees — both predate the dinosaurs.',
 'Fun fact: wombat droppings are cube-shaped.',
 'Fun fact: a day on Venus is longer than a year on Venus.',
 'Fun fact: butterflies taste with their feet.',
 'Fun fact: the shortest war on record lasted about 38 minutes.',
 'Fun fact: there are more possible chess games than atoms in the observable universe.',
 'Fun fact: lightning is hotter than the surface of the sun.',
 "Fun fact: the human brain uses about 20% of the body's energy.",
 'Fun fact: polar bears have black skin under their white fur.',
 "Fun fact: a group of crows is called a 'murder.'",
 'Fun fact: Venus is the only planet that spins clockwise.',
 "Fun fact: starfish don't have brains.",
 'Fun fact: cows form close friendships and get stressed when separated from them.',
 "Fun fact: a group of pandas is called an 'embarrassment.'",
 "Fun fact: koalas' fingerprints are almost identical to humans'.",
 'Fun fact: honeybees can recognize individual human faces.',
 "Fun fact: elephants can't jump — they're the only mammal that can't.",
 'Fun fact: a snail can sleep for up to three years.',
 "Fun fact: the dot over a lowercase i or j has a name — it's called a tittle.",
 'Fun fact: dolphins call each other by name, using a signature whistle.',
 "Fun fact: it's basically impossible to hum while holding your nose.",
 'Fun fact: the unicorn is the national animal of Scotland.',
 'Fun fact: a jiffy is a real unit of time — one hundredth of a second.',
 "Fun fact: peanuts aren't technically nuts — they're legumes.",
 'Fun fact: slugs have four noses.',
 'Fun fact: octopuses can taste with their entire skin.',
 'Fun fact: the Great Wall of China is not actually visible from space with the naked eye.',
 'Fun fact: a rainbow can only be seen with the sun behind you.',
 'Fun fact: hummingbirds are the only birds that can fly backward.',
 'Fun fact: short breaks actually improve focus more than pushing straight through.',
 'Fun fact: writing notes by hand tends to help memory more than typing them.',
 'Fun fact: studying a little each day beats one long cram session — it’s called the spacing effect.',
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

const MILESTONE_LINES:Record<number,string>={
 3:"Three days in a row — a streak is forming.",
 7:'Seven days straight. A full week of showing up.',
 14:'Two weeks in a row. This is a real habit now.',
 30:'Thirty days. A whole month — that’s extraordinary.',
 60:'Sixty days running. Nothing about this is an accident anymore.',
 100:'One hundred days. That’s a genuinely rare kind of consistency.',
 180:'Six months in a row. Half a year of showing up for yourself.',
 365:'A full year, every day. However you got here, remember it.',
}

export function konoStreakMilestone(streak:number):KonoPhrase{
 return {kind:'milestone',text:MILESTONE_LINES[streak]??streak+' days in a row. Keep going.'}
}
