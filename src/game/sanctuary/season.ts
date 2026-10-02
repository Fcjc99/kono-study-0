/** The island's seasonal look, read from the day it's opened:
 * - all of October it's the Halloween island (tools/draw_halloween_island.py, game/systems/HalloweenSystem);
 * - from December 1 to February 14 it's the winter island under snow (tools/draw_winter_island.py,
 *   game/systems/WinterSystem), and Valentine's week (February 1-14) adds floating hearts. */
export type IslandSeason = 'halloween' | 'winter' | 'valentine'
const monthDay = (date: Date) => String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0')
export const islandSeason = (date: Date): IslandSeason | null => {
  const md = monthDay(date)
  if (md.startsWith('10-')) return 'halloween'
  if (md >= '02-01' && md <= '02-14') return 'valentine'
  if (md >= '12-01' || md <= '02-14') return 'winter'
  return null
}
export const isIslandSeason = (value: unknown): value is IslandSeason => value === 'halloween' || value === 'winter' || value === 'valentine'
/** Valentine's week shares the winter island's maps. */
const MAP_FOLDER: Record<IslandSeason, string> = { halloween: 'halloween', winter: 'winter', valentine: 'winter' }
export const islandMapPath = (phase: string, season: IslandSeason | null) => '/garden/terrace-23.0/' + (season ? MAP_FOLDER[season] + '/' : '') + phase
