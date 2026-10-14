import {useState,type CSSProperties} from 'react'
import type {Profile} from '../store/model'

const AVATARS=['🦊','🐼','🐨','🐯','🦁','🐸','🐙','🦄','🐝','🦋','🐢','🐬','🌸','🌻','🍀','⭐','🌙','☀️','🌈','🔥','🎧','🎨','📚','⚽','🏀','🎹','🧁','🍓','🚀','👑']
const COLORS=['#c76b8f','#e0685a','#f0a04b','#e7c14b','#7cb36b','#4fa39b','#4f8fd1','#6b72d6','#9b6bd1','#7a6670']

/** Settings › Plans & account: your profile card. A big avatar (an emoji or your initial) on your color,
 * your name, and the plan's name; the color and avatar follow you to the sidebar and the Planner. */
export default function ProfileCard({profile,onSave}:{profile:Profile;onSave:(patch:Partial<Pick<Profile,'name'|'label'|'avatar'|'color'>>)=>void}){
 const [name,setName]=useState(profile.name),[label,setLabel]=useState(profile.label)
 const color=profile.color??COLORS[0]
 const changed=name.trim()&&label.trim()&&(name.trim()!==profile.name||label.trim()!==profile.label)
 return <section className="wb-panel profile-card" style={{'--profile-color':color} as CSSProperties} aria-label="Your profile">
  <div className="profile-card-banner" aria-hidden="true"/>
  <div className="profile-card-head">
   <span className="profile-card-avatar" aria-hidden="true">{profile.avatar||profile.name.charAt(0).toUpperCase()||'?'}</span>
   <div><h2>{profile.name}</h2><p className="wb-muted">{profile.label}</p></div>
  </div>
  <form className="profile-card-names" onSubmit={e=>{e.preventDefault();if(changed)onSave({name:name.trim().slice(0,200),label:label.trim().slice(0,200)})}}>
   <label>Your name<input value={name} maxLength={200} onChange={e=>setName(e.target.value)}/></label>
   <label>Plan name<input value={label} maxLength={200} onChange={e=>setLabel(e.target.value)}/></label>
   <button type="submit" className="primary" disabled={!changed}>Save names</button>
  </form>
  <fieldset className="profile-card-avatars"><legend>Avatar</legend>
   <button type="button" aria-pressed={!profile.avatar} aria-label="Use my initial" onClick={()=>onSave({avatar:undefined})}>{profile.name.charAt(0).toUpperCase()||'A'}</button>
   {AVATARS.map(a=><button type="button" key={a} aria-pressed={profile.avatar===a} aria-label={'Avatar '+a} onClick={()=>onSave({avatar:a})}>{a}</button>)}
  </fieldset>
  <fieldset className="profile-card-colors"><legend>Color</legend>
   {COLORS.map(c=><button type="button" key={c} aria-pressed={color===c} aria-label={'Color '+c} style={{'--swatch':c} as CSSProperties} onClick={()=>onSave({color:c})}/>)}
  </fieldset>
 </section>
}
