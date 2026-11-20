import type {Page} from '../workspaceShared'

/** The tabs on top of Study and its full pages: the overview, Tests (Exams), Notes and K-Quiz. */
export default function StudyTabs({page,navigate,hidden=[]}:{page:Page;navigate:(p:Page)=>void;hidden?:string[]}){
 const tabs:[Page,string][]=[['Study','Overview'],['Exams','Tests'],['Notes','Notes'],['K-Quiz','K-Quiz']]
 return <nav className="study-tabs" aria-label="Study">{tabs.filter(([id])=>!hidden.includes(id)).map(([id,label])=><button type="button" key={id} aria-current={page===id?'page':undefined} onClick={()=>navigate(id)}>{label}</button>)}</nav>
}
