import './production.css'
import './App.css'
import './foundation.css'
import './identity.css'
import './coral.css'
import './sanctuary.css'



const timeParts=(value:string)=>{const [rawHour='0',minute='00']=value.split(':');const hour24=Number(rawHour)||0;return {hour:String(hour24%12||12),minute:minute.padStart(2,'0'),period:(hour24>=12?'PM':'AM') as 'AM'|'PM'}}
const to24Hour=(hour:string,minute:string,period:'AM'|'PM')=>{let h=Math.max(1,Math.min(12,Number(hour)||12));if(period==='AM'&&h===12)h=0;if(period==='PM'&&h!==12)h+=12;return `${String(h).padStart(2,'0')}:${minute.padStart(2,'0')}`}
export function TwelveHourTimeInput({value,onChange,label}:{value:string;onChange:(value:string)=>void;label:string}){const parts=timeParts(value);const update=(next:Partial<typeof parts>)=>{const merged={...parts,...next};onChange(to24Hour(merged.hour,merged.minute,merged.period))};return <div className="time-12-input" aria-label={label}><select aria-label={`${label} hour`} value={parts.hour} onChange={e=>update({hour:e.target.value})}>{Array.from({length:12},(_,i)=><option key={i+1} value={String(i+1)}>{i+1}</option>)}</select><span>:</span><select aria-label={`${label} minute`} value={parts.minute} onChange={e=>update({minute:e.target.value})}>{Array.from({length:60},(_,i)=>String(i).padStart(2,'0')).map(m=><option key={m} value={m}>{m}</option>)}</select><select aria-label={`${label} AM or PM`} value={parts.period} onChange={e=>update({period:e.target.value as 'AM'|'PM'})}><option value="AM">AM</option><option value="PM">PM</option></select></div>}


