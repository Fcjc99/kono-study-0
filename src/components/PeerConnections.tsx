import {useEffect, useState, type FormEvent} from 'react'
import type {PlannerRepository} from '../store/repository'
import type {ClassmateProfile, ConnectionRow} from '../store/supabaseRemote'
import {isSharedSnapshot, type SharedSchoolSnapshot} from '../store/peerShare'
import './peer-connections.css'

const errorText=(e:unknown,fallback:string)=>e instanceof Error?e.message:fallback

export default function PeerConnections({repository,myUserId}:{repository:PlannerRepository;myUserId:string}){
 const [username,setUsernameField]=useState(''),[displayName,setDisplayName]=useState('')
 const [myName,setMyName]=useState<{username:string;displayName:string}|null>(null)
 const [query,setQuery]=useState(''),[results,setResults]=useState<ClassmateProfile[]>([])
 const [rows,setRows]=useState<ConnectionRow[]>([]),[profiles,setProfiles]=useState<Record<string,ClassmateProfile>>({})
 const [friendId,setFriendId]=useState(''),[friendSnapshot,setFriendSnapshot]=useState<SharedSchoolSnapshot|null>(null)
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('')

 const refresh=async()=>{
  try{
   const mine=await repository.myUsername()
   const loaded=await repository.listConnections()
   setMyName(mine);setRows(loaded.rows);setProfiles(loaded.profiles)
  }catch(e){setMessage(errorText(e,'Could not load your connections.'))}
 }
 useEffect(()=>{
  let gone=false
  void(async()=>{
   try{
    const mine=await repository.myUsername()
    const loaded=await repository.listConnections()
    if(gone)return
    setMyName(mine);setRows(loaded.rows);setProfiles(loaded.profiles)
   }catch(e){if(!gone)setMessage(errorText(e,'Could not load your connections.'))}
  })()
  return()=>{gone=true}
 },[repository])

 const saveUsername=async(e:FormEvent)=>{
  e.preventDefault();setBusy(true);setMessage('')
  try{await repository.setUsername(username,displayName);setMessage('Username saved.');await refresh()}
  catch(e){setMessage(errorText(e,'Could not save your username.'))}
  finally{setBusy(false)}
 }
 const search=async(e:FormEvent)=>{
  e.preventDefault();setBusy(true);setMessage('')
  try{setResults(await repository.findClassmates(query))}
  catch(e){setMessage(errorText(e,'Could not search.'));setResults([])}
  finally{setBusy(false)}
 }
 const connect=async(userId:string)=>{
  setBusy(true);setMessage('')
  try{await repository.sendConnectionRequest(userId);setMessage('Request sent.');setResults(r=>r.filter(p=>p.userId!==userId));await refresh()}
  catch(e){setMessage(errorText(e,'Could not send request.'))}
  finally{setBusy(false)}
 }
 const respond=async(id:string,accept:boolean)=>{
  setBusy(true);setMessage('')
  try{await repository.respondToConnection(id,accept);await refresh()}
  catch(e){setMessage(errorText(e,'Could not respond.'))}
  finally{setBusy(false)}
 }
 const disconnect=async(id:string)=>{
  setBusy(true);setMessage('')
  try{await repository.removeConnection(id);setFriendId('');setFriendSnapshot(null);await refresh()}
  catch(e){setMessage(errorText(e,'Could not remove this connection.'))}
  finally{setBusy(false)}
 }
 const openFriend=async(id:string)=>{
  setFriendId(id);setFriendSnapshot(null)
  if(!id)return
  setBusy(true);setMessage('')
  try{
   const raw=await repository.fetchFriendSnapshot(id)
   if(isSharedSnapshot(raw))setFriendSnapshot(raw)
   else setMessage('This friend has not shared any classes yet.')
  }catch(e){setMessage(errorText(e,'Could not load this friend’s classes.'))}
  finally{setBusy(false)}
 }

 const otherOf=(r:ConnectionRow)=>r.requesterId===myUserId?r.recipientId:r.requesterId
 const nameOf=(userId:string)=>profiles[userId]?.username??'classmate'
 const incoming=rows.filter(r=>r.status==='pending'&&r.recipientId===myUserId)
 const outgoing=rows.filter(r=>r.status==='pending'&&r.requesterId===myUserId)
 const accepted=rows.filter(r=>r.status==='accepted')

 const agenda=(snapshot:SharedSchoolSnapshot)=>{
  const byDate=new Map<string,{title:string;kind:string}[]>()
  const add=(date:string,title:string,kind:string)=>{if(!date)return;if(!byDate.has(date))byDate.set(date,[]);byDate.get(date)!.push({title,kind})}
  snapshot.tasks.filter(t=>!t.done).forEach(t=>add(t.due,t.title,'Assignment'))
  snapshot.exams.filter(e=>!e.done).forEach(e=>add(e.due,e.title,'Exam'))
  snapshot.events.forEach(e=>add(e.date,e.title,e.kind))
  return [...byDate.entries()].sort((a,b)=>a[0].localeCompare(b[0])).slice(0,14)
 }

 return <section className="wb-panel peer-connections">
  <p>Connect with a classmate to see their classes, assignments and exams. Reminders, notes and personal items are never shared either way, and a friend can never edit your plan.</p>

  {myName?<p>Your username: <strong>@{myName.username}</strong></p>:
   <form onSubmit={saveUsername} className="peer-form">
    <label>Choose a username<input value={username} onChange={e=>setUsernameField(e.target.value)} placeholder="e.g. jsmith26" maxLength={32} required/></label>
    <label>Display name (optional)<input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Shown to classmates you connect with" maxLength={80}/></label>
    <button disabled={busy} type="submit">Save username</button>
   </form>}

  <form onSubmit={search} className="peer-form peer-search">
   <label>Find a classmate<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by username" minLength={2}/></label>
   <button disabled={busy||query.trim().length<2} type="submit">Search</button>
  </form>
  {!!results.length&&<ul className="peer-list">{results.map(p=><li key={p.userId}>@{p.username}{p.displayName?' · '+p.displayName:''}<button disabled={busy} onClick={()=>void connect(p.userId)}>Connect</button></li>)}</ul>}

  {!!incoming.length&&<div className="peer-group"><h3>Requests</h3><ul className="peer-list">{incoming.map(r=><li key={r.id}>@{nameOf(otherOf(r))} wants to connect<button disabled={busy} onClick={()=>void respond(r.id,true)}>Accept</button><button disabled={busy} onClick={()=>void respond(r.id,false)}>Decline</button></li>)}</ul></div>}
  {!!outgoing.length&&<div className="peer-group"><h3>Sent</h3><ul className="peer-list">{outgoing.map(r=><li key={r.id}>@{nameOf(otherOf(r))} · waiting<button disabled={busy} onClick={()=>void disconnect(r.id)}>Cancel</button></li>)}</ul></div>}

  <div className="peer-group">
   <h3>Your connections</h3>
   {accepted.length?<ul className="peer-list">{accepted.map(r=><li key={r.id}>@{nameOf(otherOf(r))}<button disabled={busy} onClick={()=>void disconnect(r.id)}>Remove</button></li>)}</ul>
    :<p className="wb-muted">No connections yet. Search for a classmate's username above.</p>}
  </div>

  {!!accepted.length&&<div className="peer-group peer-friend-view">
   <h3>From a friend</h3>
   <label>Show classes from<select value={friendId} onChange={e=>void openFriend(e.target.value)}>
    <option value="">Choose a friend…</option>
    {accepted.map(r=>{const id=otherOf(r);return <option key={id} value={id}>@{nameOf(id)}</option>})}
   </select></label>
   {friendId&&friendSnapshot&&<div className="peer-friend-schedule">
    <p className="wb-muted">Read-only — from @{nameOf(friendId)}'s {friendSnapshot.profileLabel||'classes'}. This never changes your own plan.</p>
    {agenda(friendSnapshot).length?agenda(friendSnapshot).map(([date,items])=><div key={date} className="peer-friend-day"><strong>{date}</strong><ul>{items.map((it,i)=><li key={i}>{it.title} <small>· {it.kind}</small></li>)}</ul></div>)
     :<p>Nothing upcoming shared yet.</p>}
   </div>}
  </div>}

  {message&&<p role="status">{message}</p>}
 </section>
}
