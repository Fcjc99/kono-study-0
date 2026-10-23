import {useState} from 'react'
import type {FamilyTodo,Kid,TodoRepeat} from '../store/model'
import {TODO_REPEATS} from '../store/familyTodos'

export type TodoChanges=Pick<FamilyTodo,'title'|'forKidId'|'due'|'repeat'>

/** Change a family to-do: its words, who it's for, its day and how it repeats (a repeat needs a day).
 * Used from the to-do list on Home and from a to-do tapped on the Planner. */
export default function TodoEditor({todo,kids,onSave,onDelete,onCancel}:{todo:FamilyTodo;kids:Kid[];onSave:(changes:TodoChanges)=>void;onDelete:()=>void;onCancel:()=>void}){
 const [title,setTitle]=useState(todo.title),[forKid,setForKid]=useState(todo.forKidId??''),[due,setDue]=useState(todo.due??''),[repeat,setRepeat]=useState<TodoRepeat|''>(todo.repeat??'')
 const save=()=>{const text=title.trim();if(!text)return;onSave({title:text.slice(0,300),forKidId:forKid||undefined,due:due||undefined,repeat:due&&repeat?repeat:undefined})}
 return <form className="todo-editor" onSubmit={e=>{e.preventDefault();save()}}>
  <label>To-do<input value={title} maxLength={300} onChange={e=>setTitle(e.target.value)} autoFocus/></label>
  {kids.length>0&&<label>For<select value={forKid} onChange={e=>setForKid(e.target.value)}><option value="">Everyone</option>{kids.map(k=><option key={k.id} value={k.id}>{(k.emoji?k.emoji+' ':'')+k.name}</option>)}</select></label>}
  <div className="todo-editor-when">
   <label>Day<input type="date" value={due} onChange={e=>setDue(e.target.value)}/></label>
   {due&&<button type="button" className="link-button" onClick={()=>{setDue('');setRepeat('')}}>Any day</button>}
  </div>
  {due&&<label>Repeat<select value={repeat} onChange={e=>setRepeat(e.target.value as TodoRepeat|'')}><option value="">Just once</option>{TODO_REPEATS.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}</select></label>}
  <div className="wb-toolbar"><button type="submit" className="primary" disabled={!title.trim()}>Save</button><button type="button" onClick={onCancel}>Cancel</button><button type="button" className="todo-editor-delete" onClick={onDelete}>🗑 Delete</button></div>
 </form>
}

/** What a page can do to a family to-do (the Workspace saves it, with Undo where it can surprise). */
/** `skip` passes over one turn of a repeating to-do (a holiday, a week off) without ticking it. */
export type TodoOps={skip?:(id:string,on:string)=>void;tick:(id:string,on?:string)=>void;update:(id:string,changes:TodoChanges)=>void;remove:(id:string)=>void;move:(id:string,date:string)=>void}
