/** Calendar-day distance, independent of hour and daylight-saving transitions. */
export function calendarDaysLeft(due:string,now=new Date()):number {
 const [year,month,day]=due.split('-').map(Number)
 const dueDay=Date.UTC(year,month-1,day)
 const today=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate())
 return Math.max(0,Math.round((dueDay-today)/86400000))
}
