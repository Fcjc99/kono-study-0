import { createElement, type ReactNode } from 'react'

type Part={tag:'root'|'b'|'i'|'mark';children:ReactNode[];color?:string}
/** Interpret only our tiny formatting language; all other input stays escaped React text. */
export default function SafeNoteBody({text}:{text:string}) {
 const stack:Part[]=[{tag:'root',children:[]}]
 const tokens=text.split(/(<\/?(?:b|i|mark)(?: style="background:#[0-9a-fA-F]{6}")?>|<br\s*\/?>)/g)
 let key=0
 for(const token of tokens){
  const current=stack[stack.length-1]
  const open=/^<(b|i|mark)(?: style="background:(#[0-9a-fA-F]{6})")?>$/.exec(token)
  const close=/^<\/(b|i|mark)>$/.exec(token)
  if(open&&stack.length<16){stack.push({tag:open[1] as Part['tag'],children:[],color:open[2]});continue}
  if(close&&current.tag===close[1]&&stack.length>1){stack.pop();stack[stack.length-1].children.push(createElement(current.tag,{key:key++,style:current.color?{background:current.color}:undefined},...current.children));continue}
  if(/^<br\s*\/?>$/.test(token)){current.children.push(<br key={key++}/>);continue}
  current.children.push(token)
 }
 while(stack.length>1){const current=stack.pop()!;stack[stack.length-1].children.push(createElement(current.tag,{key:key++},...current.children))}
 return <>{stack[0].children}</>
}
