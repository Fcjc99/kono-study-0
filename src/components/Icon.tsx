import type {ReactNode} from 'react'

/** KONO's icons: one hand-drawn set on a 24px grid, 1.8px rounded strokes with a soft fill (currentColor at low
 * opacity) for depth. Used for the tabs, page titles, Play tiles and Study; colors come from the CSS around it. */
const F=({children}:{children:ReactNode})=><g fill="currentColor" fillOpacity=".16" stroke="none">{children}</g>
const P:Record<string,ReactNode>={
 today:<><F><circle cx="12" cy="12" r="4.5"/></F><circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></>,
 planner:<><F><rect x="3.5" y="5" width="17" height="15.5" rx="3"/></F><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M8 14h2M14 14h2M8 17h2"/></>,
 family:<><F><circle cx="9" cy="8" r="3.2"/><path d="M3 19.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5z"/></F><circle cx="9" cy="8" r="3.2"/><path d="M3 19.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M15.5 5.2a3 3 0 0 1 0 5.6M17.5 14.4c2 .6 3.5 2.4 3.5 5.1"/></>,
 classes:<><F><path d="M3 5.5c3-1.3 6-1.3 9 .7v13.3c-3-2-6-2-9-.7zM21 5.5c-3-1.3-6-1.3-9 .7v13.3c3-2 6-2 9-.7z"/></F><path d="M3 5.5c3-1.3 6-1.3 9 .7 3-2 6-2 9-.7v13.3c-3-1.3-6-1.3-9 .7-3-2-6-2-9-.7z"/><path d="M12 6.2v13.3"/></>,
 study:<><F><path d="m2.5 9 9.5-4.5L21.5 9 12 13.5z"/></F><path d="m2.5 9 9.5-4.5L21.5 9 12 13.5z"/><path d="M6.5 11v4.5c0 1.7 2.5 3 5.5 3s5.5-1.3 5.5-3V11M21.5 9v5"/></>,
 notes:<><F><path d="M5 4h14v10l-6 6H5z"/></F><path d="M5 4h14v10l-6 6H5z"/><path d="M13 20v-6h6M8.5 8.5h7M8.5 12h4"/></>,
 kquiz:<><F><rect x="3.5" y="4.5" width="17" height="13" rx="3"/></F><rect x="3.5" y="4.5" width="17" height="13" rx="3"/><path d="M9 21h6M12 17.5V21"/><path d="M12 7.5l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/></>,
 tests:<><F><rect x="5" y="4.5" width="14" height="16.5" rx="2.5"/></F><rect x="5" y="4.5" width="14" height="16.5" rx="2.5"/><path d="M9 4.5V3.5h6v1M9 13l2 2 4-4.5"/></>,
 kono:<><F><circle cx="12" cy="13" r="7.5"/></F><path d="M8.2 6.6A7.5 7.5 0 1 0 15.8 6.6"/><path d="M8.2 6.6c.4-1.6 1.8-2.4 3-1.6.6-1.2 2.3-1.2 2.9 0 1.2-.4 2.2.4 1.7 1.6"/><path d="M9.5 12.5v1M14.5 12.5v1M10.6 16.2c.8.6 2 .6 2.8 0"/></>,
 settings:<><F><circle cx="12" cy="12" r="3.2"/></F><circle cx="12" cy="12" r="3.2"/><path d="M12 2.8l1.6 2.4 2.8-.7.7 2.8 2.6 1.3-1 2.7 1 2.7-2.6 1.3-.7 2.8-2.8-.7L12 21.2l-1.6-2.4-2.8.7-.7-2.8-2.6-1.3 1-2.7-1-2.7 2.6-1.3.7-2.8 2.8.7z"/></>,
 more:<><circle cx="5.5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18.5" cy="12" r="1.3" fill="currentColor"/></>,
 add:<path d="M12 5v14M5 12h14"/>,
 trash:<><F><path d="M6 7h12l-1 13H7z"/></F><path d="M4 7h16M6 7l1 13h10l1-13M9.5 7V4.5h5V7M10 11v5M14 11v5"/></>,
 search:<><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.3-4.3"/></>,
 town:<><F><path d="M4.5 10h15v10h-15z"/></F><path d="M3.5 10 5 4.5h14l1.5 5.5c0 1.5-1.3 2.5-2.7 2.5S15.2 11.5 15 10c-.2 1.5-1.4 2.5-3 2.5S9.2 11.5 9 10c-.2 1.5-1.4 2.5-2.8 2.5S3.5 11.5 3.5 10z"/><path d="M5 12.3V20h14v-7.7M10 20v-4.5h4V20"/></>,
 arcade:<><F><path d="M7 7h10a5 5 0 0 1 4.8 6.4l-1 3.4a2.5 2.5 0 0 1-4.2 1L14.5 15.5h-5l-2.1 2.3a2.5 2.5 0 0 1-4.2-1l-1-3.4A5 5 0 0 1 7 7z"/></F><path d="M7 7h10a5 5 0 0 1 4.8 6.4l-1 3.4a2.5 2.5 0 0 1-4.2 1L14.5 15.5h-5l-2.1 2.3a2.5 2.5 0 0 1-4.2-1l-1-3.4A5 5 0 0 1 7 7z"/><path d="M8 10v3M6.5 11.5h3M15.5 11h.01M17.5 12.5h.01"/></>,
 decorate:<><F><path d="M4 12.5a2.5 2.5 0 0 1 5 0V14h6v-1.5a2.5 2.5 0 0 1 5 0V18H4z"/></F><path d="M6.5 10V8a3 3 0 0 1 3-3h5a3 3 0 0 1 3 3v2"/><path d="M4 12.5a2.5 2.5 0 0 1 5 0V14h6v-1.5a2.5 2.5 0 0 1 5 0V18H4zM6 18v2M18 18v2"/></>,
 world:<><F><path d="m9 4.5-5.5 2v13l5.5-2 6 2 5.5-2v-13l-5.5 2z"/></F><path d="m9 4.5-5.5 2v13l5.5-2 6 2 5.5-2v-13l-5.5 2zM9 4.5v13M15 6.5v13"/></>,
 cards:<><F><rect x="6.5" y="7.5" width="13" height="12" rx="2.5"/></F><rect x="6.5" y="7.5" width="13" height="12" rx="2.5"/><path d="M4.5 15.5V7a2.5 2.5 0 0 1 2.5-2.5h9"/></>,
 sets:<><F><path d="M4 4.5h4v15H4zM10 4.5h4v15h-4z"/></F><path d="M4 4.5h4v15H4zM10 4.5h4v15h-4zM15.5 6l3.9-1 3.6 13.8-3.9 1z"/></>,
 play:<path d="M8 5.5v13l10-6.5z" fill="currentColor"/>,
 bell:<><F><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/></F><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 21h4"/></>,
 palette:<><F><path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.3 0 1.8-1 1.2-2-.7-1.2.1-2.5 1.5-2.5H17a3.5 3.5 0 0 0 3.5-3.5c0-5-3.8-9-8.5-9z"/></F><path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.3 0 1.8-1 1.2-2-.7-1.2.1-2.5 1.5-2.5H17a3.5 3.5 0 0 0 3.5-3.5c0-5-3.8-9-8.5-9z"/><circle cx="8" cy="11" r="1" fill="currentColor"/><circle cx="11" cy="7.5" r="1" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1" fill="currentColor"/></>,
 sound:<><F><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/></F><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/></>,
 school:<><F><path d="M5 10h14v10H5z"/></F><path d="M3 10.5 12 5l9 5.5M5 9.5V20h14V9.5M10 20v-4.5h4V20M12 5V2.5h3"/></>,
 transfer:<><path d="M7 4v13M3.5 13.5 7 17l3.5-3.5M17 20V7M13.5 10.5 17 7l3.5 3.5"/></>,
 user:<><F><circle cx="12" cy="8.5" r="3.8"/></F><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c.8-3.5 3.8-5.5 7.5-5.5s6.7 2 7.5 5.5"/></>,
 chat:<><F><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V17A2.5 2.5 0 0 1 4 14.5z"/></F><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V17A2.5 2.5 0 0 1 4 14.5z"/></>,
 info:<><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.5h.01"/></>,
 mic:<><F><rect x="9" y="3.5" width="6" height="11" rx="3"/></F><rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/></>,
 paste:<><F><rect x="5" y="5" width="14" height="16" rx="2.5"/></F><rect x="5" y="5" width="14" height="16" rx="2.5"/><path d="M9 5V3.5h6V5M8.5 10.5h7M8.5 14h7M8.5 17.5h4"/></>,
 scan:<><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M7.5 12h9"/></>,
 sources:<><F><path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/></F><path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/></>,
 star:<><F><path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/></F><path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/></>,
 check:<path d="m5 12.5 4.5 4.5L19 7.5"/>,
 chevron:<path d="m9.5 6 6 6-6 6"/>,
 pencil:<><F><path d="M15 4.5l4.5 4.5L9 19.5H4.5V15z"/></F><path d="M15 4.5l4.5 4.5L9 19.5H4.5V15zM12.5 7l4.5 4.5"/></>,
 sparkle:<><F><path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1-5.1-1.9 5.1-1.9z"/></F><path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1-5.1-1.9 5.1-1.9zM18.5 16v4M16.5 18h4"/></>,
 dinner:<><path d="M5 3.5v7a2.5 2.5 0 0 0 5 0v-7M7.5 3.5v17M17 3.5c-2 1.2-3 3.6-3 7h3v10"/></>,
 recipe:<><F><path d="M5 4.5h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/></F><path d="M5 17.5v-13h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17.5a3 3 0 0 1 3-3h11M9 8.5h6"/></>,
 cart:<><F><path d="M6 7h14l-1.8 7.5H7.5z"/></F><path d="M3 4h2.5L8 16h10M6 7h14l-1.8 7.5H7.5"/><circle cx="9" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/></>,
 wall:<><F><rect x="3" y="4.5" width="18" height="12.5" rx="2.5"/></F><rect x="3" y="4.5" width="18" height="12.5" rx="2.5"/><path d="M9 20.5h6M12 17v3.5"/></>,
}
export type IconName=keyof typeof P
export default function Icon({name,size=24,className}:{name:string;size?:number;className?:string}){
 return <svg className={'kicon'+(className?' '+className:'')} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">{P[name]??P.info}</svg>
}
