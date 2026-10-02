/** When the seasonal outfits (store/konoWardrobe) and finds (store/konoFinds) can be earned: the same
 * days the island has that season's look (game/sanctuary/season.ts). `from`/`to` are month-day,
 * inclusive; winter runs across New Year. (Island events' stickers keep their own dates: store/stickers.) */
export type SeasonId='halloween'|'winter'|'valentine'
export const SEASON_WINDOWS:Record<SeasonId,{from:string;to:string;when:string}>={
 halloween:{from:'10-01',to:'10-31',when:'in October'},
 winter:{from:'12-01',to:'02-14',when:'between December 1 and February 14'},
 valentine:{from:'02-01',to:'02-14',when:'during Valentine’s week (February 1–14)'},
}
export const SEASON_IDS=Object.keys(SEASON_WINDOWS) as SeasonId[]
/** Whether a day (YYYY-MM-DD) falls in a season. */
export function inSeasonWindow(id:SeasonId,day:string):boolean{
 const {from,to}=SEASON_WINDOWS[id],md=day.slice(5)
 return from<=to?md>=from&&md<=to:md>=from||md<=to
}
