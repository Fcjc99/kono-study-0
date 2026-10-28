import type {ReactNode} from 'react'

/** KONO's own icons, one style everywhere a button names a place or an action (the island's toolbar, KONO
 * Town's tabs, the KONO bar): rounded strokes in the text color with a soft fill of the same color behind
 * them (two-tone, like the tab bar's NavIcon). Emoji stay for things you collect (food, finds, outfits). */
const shapes:Record<string,{fill:ReactNode;line:ReactNode}>={
 decorate:{fill:<path d="M14.5 4.5l5 5-9.5 9.5H5v-5z"/>,line:<><path d="M14.5 4.5l5 5-9.5 9.5H5v-5z"/><path d="M12.5 6.5l5 5"/></>},
 arcade:{fill:<rect x="2.5" y="7" width="19" height="11" rx="5.5"/>,line:<><rect x="2.5" y="7" width="19" height="11" rx="5.5"/><path d="M7.5 10.5v4M5.5 12.5h4"/><circle cx="15.5" cy="11.5" r=".6"/><circle cx="17.5" cy="13.5" r=".6"/></>},
 map:{fill:<path d="M3.5 6.5l5.5-2 6 2 5.5-2v13l-5.5 2-6-2-5.5 2z"/>,line:<><path d="M3.5 6.5l5.5-2 6 2 5.5-2v13l-5.5 2-6-2-5.5 2z"/><path d="M9 4.5v13M15 6.5v13"/></>},
 camera:{fill:<rect x="3" y="7" width="18" height="12" rx="3"/>,line:<><rect x="3" y="7" width="18" height="12" rx="3"/><path d="M8.5 7l1.5-2.5h4L15.5 7"/><circle cx="12" cy="13" r="3"/></>},
 expand:{fill:<rect x="4" y="4" width="16" height="16" rx="4"/>,line:<><path d="M14 4.5h5.5V10M10 19.5H4.5V14M19.5 4.5l-6 6M4.5 19.5l6-6"/></>},
 close:{fill:<circle cx="12" cy="12" r="8.5"/>,line:<path d="M8.5 8.5l7 7M15.5 8.5l-7 7"/>},
 shop:{fill:<path d="M5 8.5h14l-1 11H6z"/>,line:<><path d="M5 8.5h14l-1 11H6z"/><path d="M9 10.5V7a3 3 0 0 1 6 0v3.5"/></>},
 palette:{fill:<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-1 1.5-2.2-.6-1.4.3-2.8 1.8-2.8H17a3.5 3.5 0 0 0 3.5-3.5C20.5 7.3 16.7 3.5 12 3.5z"/>,line:<><path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-1 1.5-2.2-.6-1.4.3-2.8 1.8-2.8H17a3.5 3.5 0 0 0 3.5-3.5C20.5 7.3 16.7 3.5 12 3.5z"/><circle cx="8" cy="11" r=".9"/><circle cx="10.5" cy="7.5" r=".9"/><circle cx="14.5" cy="7.5" r=".9"/></>},
 wheel:{fill:<circle cx="12" cy="10.5" r="7"/>,line:<><circle cx="12" cy="10.5" r="7"/><path d="M12 3.5v14M5 10.5h14M7 5.5l10 10M17 5.5l-10 10M8.5 21l3.5-3.5 3.5 3.5"/></>},
 album:{fill:<path d="M5 4.5h11.5a2 2 0 0 1 2 2v13H7a2 2 0 0 1-2-2z"/>,line:<><path d="M5 17.5v-13h11.5a2 2 0 0 1 2 2v13H7a2 2 0 0 1-2-2 2 2 0 0 1 2-2h11.5"/><path d="M11.8 9.2l.9 1.8 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2L9 11.3l2-.3z"/></>},
 next:{fill:<circle cx="12" cy="12" r="8.5"/>,line:<path d="M10 8.2l5.5 3.8-5.5 3.8z"/>},
 ask:{fill:<path d="M4 6.5a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-6l-4.5 3.5v-3.5H7a3 3 0 0 1-3-3z"/>,line:<><path d="M4 6.5a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-6l-4.5 3.5v-3.5H7a3 3 0 0 1-3-3z"/><path d="M8.5 10h.01M12 10h.01M15.5 10h.01"/></>},
 help:{fill:<circle cx="12" cy="12" r="8.5"/>,line:<><circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.6-2.4 2-2.4 3.4M12 16.8h.01"/></>},
}
export type KonoIconName=keyof typeof shapes
export default function KonoIcon({name,size=20}:{name:KonoIconName;size?:number}){
 const s=shapes[name]
 return <svg className={'kono-icon ki-'+name} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
  <g className="ki-fill" fill="currentColor" stroke="none">{s.fill}</g>{s.line}
 </svg>
}
