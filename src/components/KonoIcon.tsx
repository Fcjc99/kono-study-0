/** KONO's own icons, one style everywhere a button names a place or an action (the island's toolbar, KONO
 * Town's tabs, the KONO bar): rounded strokes in the text color with a soft fill of the same color behind
 * them (two-tone, like the tab bar's icons). The drawings live in one small sprite (public/icons/
 * kono-icons.svg) so they cost the startup download nothing; `--ki-fill` sets how strong the fill is.
 * Emoji stay for things you collect (food, finds, outfits). */
export type KonoIconName='decorate'|'arcade'|'map'|'camera'|'expand'|'close'|'shop'|'palette'|'wheel'|'album'|'next'|'ask'|'help'
export default function KonoIcon({name,size=20}:{name:KonoIconName;size?:number}){
 return <svg className={'kono-icon ki-'+name} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href={'/icons/kono-icons.svg#ki-'+name}/></svg>
}
