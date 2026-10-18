import {restoreEntry,type Collection} from '../store/workspace'
import {labels} from '../store/entryLabels'
import type {PageContext} from './pageContext'

export default function TrashPage({w}:{w:PageContext}){
 const {data,profile,run,save,setConfirmation}=w
 return <section className="wb-panel"><h2>Recently removed</h2><p>Restore items here, even after a reload. Undo/Redo covers the last 30 changes in this session. Signed-in Trash syncs with your account.</p>{data.trash.filter(t=>t.profileId===profile.id).map(t=><article className="wb-record" key={t.id}><h3>{t.title}</h3><p>{labels[t.collection as Collection]??'Schedule block'} · Removed {new Date(t.deletedAt).toLocaleString()}</p><div className="wb-toolbar"><button onClick={()=>void run(()=>save(d=>restoreEntry(d,t.id)),'Restored.')}>Restore</button><button onClick={()=>{setConfirmation({text:'Permanently delete “'+t.title+'” from Trash? Older backups may still contain it.',action:()=>void run(()=>save(d=>({...d,trash:d.trash.filter(x=>x.id!==t.id)})),'Removed from Trash.')})}}>Delete permanently</button></div></article>)}{!data.trash.some(t=>t.profileId===profile.id)&&<div className="trash-empty"><img src="/garden/kono/happy.webp" alt="" aria-hidden="true"/><p><strong>Trash is empty.</strong><br/>Anything you remove waits here, so you can bring it back.</p></div>}</section>
}
