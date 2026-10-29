import type {KQuizQuestion} from './model'

const ROUND=10

/** One round's question: a multiple choice (from the practice test, or a flashcard with other cards'
 * answers as the wrong ones) or a written one the player checks against the model answer. */
export type PlayQuestion={id:string;prompt:string;choices?:string[];correct?:number;answer?:string}
export const shuffle=<T,>(list:T[],seed:number)=>{const a=[...list];let s=seed||1;for(let i=a.length-1;i>0;i--){s=(s*16807)%2147483647;const j=s%(i+1);[a[i],a[j]]=[a[j],a[i]]}return a}

/** A round from a study set: its practice questions plus its flashcards as multiple choice (when the
 * deck has at least four cards to draw wrong answers from), shuffled, ten at most. Pure. */
export function roundFrom(questions:KQuizQuestion[],cards:{id:string;question:string;answer:string}[],seed=Date.now()):PlayQuestion[]{
 const out:PlayQuestion[]=questions.map(q=>q.type==='mcq'?{id:q.id,prompt:q.prompt,choices:q.choices,correct:q.correctIndex}:{id:q.id,prompt:q.prompt,answer:q.answer})
 if(cards.length>=4)for(const [i,c] of cards.entries()){
  const wrong=shuffle(cards.filter(o=>o.id!==c.id&&o.answer.trim()!==c.answer.trim()).map(o=>o.answer),seed+i).slice(0,3)
  if(wrong.length<3)continue
  const choices=shuffle([c.answer,...wrong],seed*7+i)
  out.push({id:'card-'+c.id,prompt:c.question,choices,correct:choices.indexOf(c.answer)})
 }
 return shuffle(out,seed).slice(0,ROUND)
}

