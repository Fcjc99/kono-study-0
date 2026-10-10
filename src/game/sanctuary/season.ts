/** The island's seasonal look, read from the day it's opened:
 * - all of October it's the Halloween island, one picture per time of day (tools/import_season_island.py,
 *   game/systems/HalloweenSystem);
 * - from December 1 to February 14 it's the winter island under snow (tools/draw_winter_island.py,
 *   game/systems/WinterSystem), and Valentine's week (February 1-14) adds floating hearts;
 * - from March 20 to May 20 it's the spring island in blossom, and from May 21 to June 20 the end of
 *   the semester's sunny, festive island (tools/draw_spring_island.py, game/systems/SpringSystem).
 * The same dates decide when seasonal outfits and finds can be earned (store/seasonWindows). */
export type IslandSeason = 'halloween' | 'winter' | 'valentine' | 'spring' | 'semester'
const monthDay = (date: Date) => String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0')
export const islandSeason = (date: Date): IslandSeason | null => {
  const md = monthDay(date)
  if (md.startsWith('10-')) return 'halloween'
  if (md >= '02-01' && md <= '02-14') return 'valentine'
  if (md >= '12-01' || md <= '02-14') return 'winter'
  if (md >= '03-20' && md <= '05-20') return 'spring'
  if (md >= '05-21' && md <= '06-20') return 'semester'
  return null
}
const SEASONS: IslandSeason[] = ['halloween', 'winter', 'valentine', 'spring', 'semester']
export const isIslandSeason = (value: unknown): value is IslandSeason => SEASONS.includes(value as IslandSeason)
/** Valentine's week shares the winter island's maps. */
// (halloween-v2: the current Halloween island; a new folder so no browser keeps showing a saved older one.)
const MAP_FOLDER: Record<IslandSeason, string> = { halloween: 'halloween-v2', winter: 'winter', valentine: 'winter', spring: 'spring', semester: 'semester' }
export const islandMapPath = (phase: string, season: IslandSeason | null) => '/garden/terrace-23.0/' + (season ? MAP_FOLDER[season] + '/' : '') + phase
