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

const HEADER_WORD=/^(class(?: name)?|course(?: title| name| code)?|title|section|subject|teacher|instructors?|professor|faculty|days?|meeting days?|time(?: slot)?|times|building|room|location|format|type|credits?|grading)$/i
/** Rebuild a headed class table whose cells wrap onto several lines ("Tuesday &" / "Thursday",
 * "10:30 AM - 11:45" / "AM", "245 Beacon" / "Street"): one tab-separated line per class, with a cell
 * for every header column, even when it is empty. Returns null when the page has no such header row. */
export function pdfClassTableText(items:unknown[]):string|null{
 const values=(items as TextItem[]).filter(item=>item&&typeof item.str==='string'&&item.str.trim()&&Array.isArray(item.transform))
 const lines:{y:number;items:TextItem[]}[]=[]
 for(const item of values){let row=lines.find(r=>Math.abs(r.y-item.transform[5])<3);if(!row){row={y:item.transform[5],items:[]};lines.push(row)}row.items.push(item)}
 lines.sort((a,b)=>b.y-a.y)
 const header=lines.find(line=>{const words=line.items.map(i=>i.str.trim());return words.filter(w=>HEADER_WORD.test(w)).length>=3&&words.some(w=>/^(meeting )?days?$/i.test(w))&&words.some(w=>/^time/i.test(w))})
 if(!header)return null
 const columns=header.items.filter(i=>HEADER_WORD.test(i.str.trim())).sort((a,b)=>a.transform[4]-b.transform[4])
 const anchors=columns.map(i=>i.transform[4])
 const heights=values.map(i=>Math.abs(i.transform[3])||0).filter(h=>h>0).sort((a,b)=>a-b)
 const lineHeight=heights.length?heights[Math.floor(heights.length/2)]:10
 const above=lines.filter(line=>line.y>header.y).map(line=>line.items.sort((a,b)=>a.transform[4]-b.transform[4]).map(i=>i.str.trim()).join(' '))
 const below=lines.filter(line=>line.y<header.y)
 // Lines close together belong to one class; a wider gap starts the next one.
 const records:{y:number;items:TextItem[]}[][]=[]
 let previous:number|undefined
 for(const line of below){if(previous===undefined||previous-line.y>lineHeight*1.6)records.push([]);records[records.length-1].push(line);previous=line.y}
 const column=(x:number)=>{let found=0;anchors.forEach((a,i)=>{if(x>=a-6)found=i});return found}
 const out=records.map(record=>{
  const cells=anchors.map(()=>[] as string[])
  for(const line of record)for(const item of line.items.sort((a,b)=>a.transform[4]-b.transform[4]))cells[column(item.transform[4])].push(item.str.trim())
  return cells.map(cell=>cell.join(' ').replace(/\s+/g,' ').trim()).join('\t')
 })
 return [...above,columns.map(i=>i.str.trim()).join('\t'),...out].join('\n')
}
