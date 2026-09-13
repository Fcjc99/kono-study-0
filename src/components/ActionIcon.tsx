import type {ReactNode} from 'react'

const paths:Record<string,ReactNode>={
 search:<><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></>,
 edit:<><path d="m5 15-1 5 5-1L20 8l-4-4Z M13 7l4 4"/></>,
 copy:<><rect x="8" y="8" width="12" height="13" rx="3"/><path d="M15 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/></>,
 trash:<><path d="M4 6h16M9 6V3h6v3M6 6l1 14h10l1-14M10 10v6M14 10v6"/></>,
 mic:<><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 21v-4"/></>,
}
export default function ActionIcon({name}:{name:keyof typeof paths}){return <svg className={'kono-action-icon icon-'+name} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>}
