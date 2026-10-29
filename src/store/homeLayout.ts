/** Your own Home page (Sanctuary › ✏️ Customize Home): which widgets show and in what order. Kept per plan on
 * this device as one line, e.g. "week,sanctuary,-family,schedule": the order, with "-" before a hidden one.
 * Widgets added to KONO later join in their default place, so an older line still works. */
export type HomeWidget='week'|'sanctuary'|'family'|'schedule'|'weekAhead'|'notes'|'todos'|'meals'|'comingUp'|'focus'
/** The default Home, top to bottom (components/HomeCustomize names and describes each). */
export const DEFAULT_ORDER:HomeWidget[]=['week','sanctuary','family','schedule','weekAhead','notes','todos','meals','comingUp','focus']
export type HomeLayout={order:HomeWidget[];hidden:Set<HomeWidget>}
const known=new Set<string>(DEFAULT_ORDER)
export function readLayout(text:string):HomeLayout{
 const order:HomeWidget[]=[],hidden=new Set<HomeWidget>()
 for(const part of text.split(',')){
  const off=part.startsWith('-'),id=(off?part.slice(1):part).trim()
  if(!known.has(id)||order.includes(id as HomeWidget))continue
  order.push(id as HomeWidget);if(off)hidden.add(id as HomeWidget)
 }
 // A widget the line doesn't know yet goes right after the one before it in the default order.
 DEFAULT_ORDER.forEach((id,i)=>{if(order.includes(id))return;const before=DEFAULT_ORDER.slice(0,i).reverse().find(b=>order.includes(b));order.splice(before?order.indexOf(before)+1:0,0,id)})
 return {order,hidden}
}
export const writeLayout=(l:HomeLayout)=>l.order.map(id=>(l.hidden.has(id)?'-':'')+id).join(',')
export const isDefault=(l:HomeLayout)=>writeLayout(l)===DEFAULT_ORDER.join(',')
