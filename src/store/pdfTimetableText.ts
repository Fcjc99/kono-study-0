type TextItem={str:string;transform:number[];width:number}
/** Keep table cells separate instead of mixing teacher names into course names. */
export function pdfTimetableText(items:unknown[]):string{
 const lines:{y:number;items:TextItem[]}[]=[]
 for(const value of items){
  if(!value||typeof value!=='object'||!('str' in value)||!('transform' in value))continue
  const item=value as TextItem
  if(!item.str.trim())continue
  let row=lines.find(r=>Math.abs(r.y-item.transform[5])<3)
  if(!row){row={y:item.transform[5],items:[]};lines.push(row)}
  row.items.push(item)
 }
 return lines.sort((a,b)=>b.y-a.y).map(row=>{
  let end=0
  return row.items.sort((a,b)=>a.transform[4]-b.transform[4]).map((item,i)=>{
   const gap=item.transform[4]-end;end=item.transform[4]+item.width
   return (i?(gap>10?'\t':' '):'')+item.str.trim()
  }).join('')
 }).join('\n')
}

/** Rebuild a seven-column NDA timetable while preserving empty day cells. */
export function pdfSixDayTimetableText(items:unknown[]):string{
 const values=(items as TextItem[]).filter(item=>item&&typeof item.str==='string'&&item.str.trim()&&Array.isArray(item.transform))
 const anchors=values.filter(item=>/^(Time|Day [1-6])$/i.test(item.str.trim())).sort((a,b)=>a.transform[4]-b.transform[4]).map(item=>item.transform[4])
 if(anchors.length!==7)return pdfTimetableText(items)
 const lines:{y:number;items:TextItem[]}[]=[]
 for(const item of values){let row=lines.find(r=>Math.abs(r.y-item.transform[5])<3);if(!row){row={y:item.transform[5],items:[]};lines.push(row)}row.items.push(item)}
 return lines.sort((a,b)=>b.y-a.y).map(row=>{
  const cells=Array.from({length:7},()=>[] as string[])
  for(const item of row.items.sort((a,b)=>a.transform[4]-b.transform[4])){
   let column=0,distance=Infinity
   anchors.forEach((x,index)=>{const d=Math.abs(item.transform[4]-x);if(d<distance){distance=d;column=index}})
   cells[column].push(item.str.trim())
  }
  return cells.map(cell=>cell.join(' ')).join('\t')
 }).join('\n')
}
