import {useRef,useState,type KeyboardEvent,type PointerEvent,type ReactNode} from 'react'

/** A list you can put in your own order: drag the ⠿ handle (mouse or finger), or focus it and use the
 * arrow keys. Only the handle starts a drag, so swiping a row (done / tomorrow) and scrolling still work. */
export default function ReorderList({items,onReorder,label}:{items:{id:string;title:string;node:ReactNode}[];onReorder:(ids:string[])=>void;label:string}){
 const listRef=useRef<HTMLOListElement>(null)
 const [drag,setDrag]=useState<{id:string;dy:number;over:number}|null>(null)
 const startY=useRef(0)
 const ids=items.map(i=>i.id)
 const move=(id:string,to:number)=>{const from=ids.indexOf(id);if(from<0||to<0||to>=ids.length||to===from)return;const next=ids.filter(x=>x!==id);next.splice(to,0,id);onReorder(next)}
 const targetFor=(y:number)=>{const rows=[...(listRef.current?.children??[])] as HTMLElement[];let index=rows.length-1;for(let i=0;i<rows.length;i++){const r=rows[i].getBoundingClientRect();if(y<r.top+r.height/2){index=i;break}}return index}
 const down=(e:PointerEvent<HTMLButtonElement>,id:string)=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);startY.current=e.clientY;setDrag({id,dy:0,over:ids.indexOf(id)})}
 const moveDrag=(e:PointerEvent<HTMLButtonElement>)=>{if(!drag)return;setDrag({...drag,dy:e.clientY-startY.current,over:targetFor(e.clientY)})}
 const up=()=>{if(!drag)return;const d=drag;setDrag(null);move(d.id,d.over)}
 const key=(e:KeyboardEvent<HTMLButtonElement>,id:string)=>{const at=ids.indexOf(id);if(e.key==='ArrowUp'){e.preventDefault();move(id,at-1)}else if(e.key==='ArrowDown'){e.preventDefault();move(id,at+1)}}
 return <ol ref={listRef} className={'reorder-list'+(drag?' is-dragging':'')} aria-label={label}>{items.map((item,index)=><li key={item.id} className={'reorder-row'+(drag?.id===item.id?' is-lifted':'')+(drag&&drag.id!==item.id&&drag.over===index?' is-target':'')} style={drag?.id===item.id?{transform:`translateY(${drag.dy}px)`}:undefined}>
  <button type="button" className="reorder-handle" aria-label={'Reorder '+item.title+' (use the up and down arrow keys)'} onPointerDown={e=>down(e,item.id)} onPointerMove={moveDrag} onPointerUp={up} onPointerCancel={()=>setDrag(null)} onKeyDown={e=>key(e,item.id)}><span aria-hidden="true">⠿</span></button>
  <div className="reorder-body">{item.node}</div>
 </li>)}</ol>
}
