/** The island's seasonal look: all of October it's the Halloween island (map art from
 * tools/draw_halloween_island.py, plus game/systems/HalloweenSystem). Read from the day it's opened. */
export type IslandSeason = 'halloween'
export const islandSeason = (date: Date): IslandSeason | null => date.getMonth() === 9 ? 'halloween' : null
export const islandMapPath = (phase: string, season: IslandSeason | null) => '/garden/terrace-23.0/' + (season ? season + '/' : '') + phase
